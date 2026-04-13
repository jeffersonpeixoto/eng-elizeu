// ================= VARIÁVEIS =================
let deferredPrompt = null;
let selectedTicket = null;
let ticketsCache = [];

// ================= HELPERS =================
function escapeHtml(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function formatDateTime(v){if(!v)return "—";const d=new Date(v);return d.toLocaleString("pt-BR")}
function statusClass(s){return s==="Em andamento"?"status-andamento":s==="Concluído"?"status-concluido":"status-aberto"}

// ================= VIEWS =================
function switchView(view){
  document.querySelectorAll(".view").forEach(el=>el.classList.add("hidden"));
  document.getElementById(view+"View").classList.remove("hidden");
}

// ================= UPLOAD =================
async function uploadFoto(file){
  if(!file) return null;
  const fileName="foto_"+Date.now();
  const {error}=await window.supabaseClient.storage.from("chamados-fotos").upload(fileName,file);
  if(error) throw error;
  return window.supabaseClient.storage.from("chamados-fotos").getPublicUrl(fileName).data.publicUrl;
}

// ================= SALVAR =================
async function salvarChamado(e){
  e.preventDefault();

  const file=document.getElementById("foto").files[0];
  const fotoUrl=await uploadFoto(file);

  const chamado={
    id:"CH-"+Date.now(),
    nome:document.getElementById("nome").value,
    unidade:document.getElementById("unidade").value,
    setor:document.getElementById("setor").value,
    setor_problema:document.getElementById("setorProblema").value,
    tipo_manutencao:document.getElementById("tipoManutencao").value,
    gravidade:document.getElementById("gravidade").value,
    descricao:document.getElementById("descricao").value,
    foto_url:fotoUrl,
    status:"Aberto",
    data_criacao:new Date().toISOString()
  };

  await window.supabaseClient.from("chamados").insert([chamado]);

  enviarPushOneSignal("🚨 Novo chamado", chamado.unidade+" - "+chamado.setor);

  await carregarDados();
  switchView("lista");
}

// ================= CRUD STATUS =================
async function iniciarChamado(){
  if(!selectedTicket) return;

  const id=selectedTicket.id;

  await window.supabaseClient.from("chamado_tempo").insert([{
    chamado_id:id,
    inicio:new Date().toISOString()
  }]);

  await window.supabaseClient.from("chamados")
    .update({status:"Em andamento"})
    .eq("id",id);

  enviarPushOneSignal("▶️ Iniciado",id);

  fecharModal();
  await carregarDados();
}

async function pausarChamado(){
  if(!selectedTicket) return;

  const id=selectedTicket.id;

  const {data}=await window.supabaseClient
    .from("chamado_tempo")
    .select("*")
    .eq("chamado_id",id)
    .is("fim",null)
    .limit(1);

  if(!data.length) return;

  await window.supabaseClient
    .from("chamado_tempo")
    .update({fim:new Date().toISOString()})
    .eq("id",data[0].id);

  await window.supabaseClient
    .from("chamados")
    .update({status:"Pausado"})
    .eq("id",id);

  enviarPushOneSignal("⏸️ Pausado",id);

  fecharModal();
  await carregarDados();
}

async function retomarChamado(){
  if(!selectedTicket) return;

  const id=selectedTicket.id;

  await window.supabaseClient.from("chamado_tempo").insert([{
    chamado_id:id,
    inicio:new Date().toISOString()
  }]);

  await window.supabaseClient.from("chamados")
    .update({status:"Em andamento"})
    .eq("id",id);

  enviarPushOneSignal("▶️ Retomado",id);

  fecharModal();
  await carregarDados();
}

async function finalizarChamado(){
  if(!selectedTicket) return;

  const id=selectedTicket.id;

  await window.supabaseClient.from("chamados")
    .update({
      status:"Concluído",
      data_finalizacao:new Date().toISOString()
    })
    .eq("id",id);

  enviarPushOneSignal("✅ Finalizado",id);

  fecharModal();
  await carregarDados();
}

// ================= LISTA =================
async function carregarDados(){
  const {data}=await window.supabaseClient.from("chamados").select("*");
  ticketsCache=data||[];
  console.log("Chamados:",ticketsCache);
}

// ================= MODAL =================
function abrirDetalhes(id){
  selectedTicket=ticketsCache.find(t=>t.id===id);
  document.getElementById("detailModal").showModal();
}
function fecharModal(){
  document.getElementById("detailModal").close();
}

// ================= REALTIME =================
function escutarChamadosSeguro(){
  if(!window.supabaseClient) return;

  window.supabaseClient.channel("chamados")
    .on("postgres_changes",{event:"*",schema:"public",table:"chamados"},payload=>{
      console.log("Realtime:",payload);
    })
    .subscribe();
}

// ================= PWA =================
function registerPWA(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("/OneSignalSDKWorker.js");
  }

  window.addEventListener("beforeinstallprompt",e=>{
    e.preventDefault();
    deferredPrompt=e;
  });
}

// ================= ONESIGNAL =================
function ativarPushOneSignal(){
  window.OneSignal = window.OneSignal || [];

  OneSignal.push(function(){
    OneSignal.showSlidedownPrompt();
  });
}

async function enviarPushOneSignal(titulo,mensagem){
  try{
    await fetch("https://onesignal.com/api/v1/notifications",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":"Basic SUA_API_KEY"
      },
      body:JSON.stringify({
        app_id:"SEU_APP_ID",
        included_segments:["All"],
        headings:{en:titulo},
        contents:{en:mensagem}
      })
    });
  }catch(e){
    console.error("Push erro:",e);
  }
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded",async()=>{
  if(!window.supabaseClient){
    alert("Erro Supabase");
    return;
  }

  document.getElementById("ticketForm")
    .addEventListener("submit",salvarChamado);

  registerPWA();

  await carregarDados();

  setTimeout(()=>{
    ativarPushOneSignal();
  },1500);

  setTimeout(()=>{
    escutarChamadosSeguro();
  },2500);
});