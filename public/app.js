let deferredPrompt = null;
let ticketsCache = [];

function escapeHtml(value){return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
function formatDateTime(value){if(!value)return "—";const dt=new Date(value);if(Number.isNaN(dt.getTime()))return value;return dt.toLocaleString("pt-BR");}
function statusClass(status){if(status==="Em andamento")return "status-andamento";if(status==="Concluído")return "status-concluido";return "status-aberto";}
function priorityClass(priority){return {"Baixa":"priority-baixa","Média":"priority-media","Alta":"priority-alta","Crítica":"priority-critica"}[priority]||"priority-baixa";}

function switchView(view){
  document.querySelectorAll(".view").forEach(el=>el.classList.add("hidden"));
  document.getElementById(view+"View").classList.remove("hidden");
  document.querySelectorAll("[data-view-btn]").forEach(btn=>btn.classList.toggle("active", btn.dataset.viewBtn===view));
  if(view==="dashboard") renderDashboard();
  if(view==="lista") renderTicketList();
}
function bindViewButtons(){document.querySelectorAll("[data-view-btn]").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.viewBtn)));}
function resetarFormulario(){document.getElementById("ticketForm").reset();}

async function uploadFoto(file){
  if(!file) return null;
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
  const fileName="foto_"+Date.now()+"."+ext;
  const { error } = await window.supabaseClient.storage.from("chamados-fotos").upload(fileName,file,{cacheControl:"3600",upsert:false,contentType:file.type||"image/jpeg"});
  if(error) throw error;
  const { data } = window.supabaseClient.storage.from("chamados-fotos").getPublicUrl(fileName);
  return data.publicUrl;
}

async function salvarChamado(event){
  event.preventDefault();
  const submitBtn=event.target.querySelector("button[type='submit']");
  submitBtn.disabled=true; submitBtn.textContent="Salvando...";
  try{
    const file=document.getElementById("foto").files[0];
    const fotoUrl=await uploadFoto(file);
    const chamado={
      id:"CH-"+Date.now(),
      nome:document.getElementById("nome").value.trim(),
      unidade:document.getElementById("unidade").value,
      setor:document.getElementById("setor").value,
      setor_problema:document.getElementById("setorProblema").value.trim(),
      tipo_manutencao:document.getElementById("tipoManutencao").value,
      gravidade:document.getElementById("gravidade").value,
      descricao:document.getElementById("descricao").value.trim(),
      foto_url:fotoUrl,
      status:"Aberto",
      data_criacao:new Date().toISOString(),
      data_inicio:null,
      data_finalizacao:null
    };
    const { error } = await window.supabaseClient.from("chamados").insert([chamado]);
    if(error) throw error;
    alert("Chamado salvo com sucesso.");
    resetarFormulario();
    await carregarDados();
    switchView("lista");
  }catch(error){
    alert("Erro ao salvar chamado: "+error.message);
  }finally{
    submitBtn.disabled=false; submitBtn.textContent="Salvar chamado";
  }
}

function getFilteredTickets(){
  const busca=document.getElementById("busca")?.value.toLowerCase().trim()||"";
  const filtroStatus=document.getElementById("filtroStatus")?.value||"";
  const filtroGravidade=document.getElementById("filtroGravidade")?.value||"";
  const filtroSetor=document.getElementById("filtroSetor")?.value||"";
  return ticketsCache.filter(ticket=>{
    const target=[ticket.id,ticket.nome,ticket.unidade,ticket.setor,ticket.setor_problema,ticket.tipo_manutencao,ticket.descricao].join(" ").toLowerCase();
    return (!busca||target.includes(busca)) && (!filtroStatus||ticket.status===filtroStatus) && (!filtroGravidade||ticket.gravidade===filtroGravidade) && (!filtroSetor||ticket.setor===filtroSetor);
  });
}

function renderDashboard(){
  document.getElementById("metricTotal").textContent=ticketsCache.length;
  document.getElementById("metricAbertos").textContent=ticketsCache.filter(t=>t.status==="Aberto").length;
  document.getElementById("metricAndamento").textContent=ticketsCache.filter(t=>t.status==="Em andamento").length;
  document.getElementById("metricConcluidos").textContent=ticketsCache.filter(t=>t.status==="Concluído").length;
  document.getElementById("metricCriticos").textContent=ticketsCache.filter(t=>t.gravidade==="Crítica").length;
}

function renderTicketList(){
  const list=document.getElementById("ticketList");
  const filtered=getFilteredTickets();
  if(!filtered.length){list.innerHTML='<div class="empty-state">Nenhum chamado encontrado com os filtros atuais.</div>';return;}
  list.innerHTML=filtered.map(ticket=>`
    <article class="ticket-card">
      <div>
        <h4>${escapeHtml(ticket.unidade)} • ${escapeHtml(ticket.setor)}</h4>
        <div class="ticket-meta">
          <span class="badge badge-soft">${escapeHtml(ticket.id)}</span>
          <span class="badge badge-soft">${escapeHtml(ticket.nome || "Sem nome")}</span>
          <span class="badge badge-soft">${escapeHtml(ticket.tipo_manutencao || "—")}</span>
          <span class="badge ${statusClass(ticket.status)}">${escapeHtml(ticket.status || "Aberto")}</span>
          <span class="badge ${priorityClass(ticket.gravidade)}">${escapeHtml(ticket.gravidade || "Baixa")}</span>
        </div>
        <p class="ticket-desc">${escapeHtml(ticket.descricao || "")}</p>
      </div>
      <div class="ticket-aside">
        <div class="date-chip"><strong>Criação:</strong><br>${formatDateTime(ticket.data_criacao)}</div>
        <div class="date-chip"><strong>Início:</strong><br>${formatDateTime(ticket.data_inicio)}</div>
        <div class="date-chip"><strong>Finalização:</strong><br>${formatDateTime(ticket.data_finalizacao)}</div>
        ${ticket.foto_url ? `<img class="thumb" src="${escapeHtml(ticket.foto_url)}" alt="Foto do chamado">` : ""}
      </div>
    </article>
  `).join("");
}

async function carregarDados(){
  const { data, error } = await window.supabaseClient.from("chamados").select("*").order("data_criacao",{ascending:false});
  if(error){alert("Erro ao carregar dados: "+error.message);return;}
  ticketsCache=Array.isArray(data)?data:[];
  renderDashboard();
  renderTicketList();
}

function bindFilters(){
  ["busca","filtroStatus","filtroGravidade","filtroSetor"].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener("input", renderTicketList);
    el.addEventListener("change", renderTicketList);
  });
}

function registerPWA(){
  if("serviceWorker" in navigator){
    window.addEventListener("load", async ()=>{
      try{
        await navigator.serviceWorker.register("./service-worker.js");
        console.log("Service Worker registrado");
      }catch(error){
        console.error("Erro ao registrar Service Worker:", error);
      }
    });
  }

  window.addEventListener("beforeinstallprompt", (event)=>{
    console.log("PWA disponível para instalação");
    event.preventDefault();
    deferredPrompt=event;
    document.getElementById("installButton").classList.remove("hidden");
  });

  const installButton=document.getElementById("installButton");
  installButton.addEventListener("click", async ()=>{
    if(!deferredPrompt){
      alert("O navegador ainda não liberou a instalação. Abra via HTTPS ou localhost e use o app por alguns instantes.");
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt=null;
    installButton.classList.add("hidden");
  });

  window.addEventListener("appinstalled", ()=>{
    console.log("PWA instalado com sucesso");
    installButton.classList.add("hidden");
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  if(!window.supabaseClient){alert("Supabase não foi inicializado. Verifique o arquivo supabase.js.");return;}
  bindViewButtons();
  bindFilters();
  registerPWA();
  document.getElementById("ticketForm").addEventListener("submit", salvarChamado);
  switchView("dashboard");
  carregarDados();
});
