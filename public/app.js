let deferredPrompt=null;let selectedTicket=null;let ticketsCache=[];
function escapeHtml(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function formatDateTime(v){if(!v)return "—";const d=new Date(v);if(Number.isNaN(d.getTime()))return v;return d.toLocaleString("pt-BR")}
function statusClass(s){if(s==="Em andamento")return "status-andamento";if(s==="Concluído")return "status-concluido";return "status-aberto"}
function priorityClass(p){return {"Baixa":"priority-baixa","Média":"priority-media","Alta":"priority-alta","Crítica":"priority-critica"}[p]||"priority-baixa"}

function switchView(view){document.querySelectorAll(".view").forEach(el=>el.classList.add("hidden"));document.getElementById(view+"View").classList.remove("hidden");document.querySelectorAll("[data-view-btn]").forEach(btn=>btn.classList.toggle("active",btn.dataset.viewBtn===view));if(view==="dashboard")renderDashboard();if(view==="lista")renderTicketList();if(view==="kanban")renderKanban()}
function bindViewButtons(){document.querySelectorAll("[data-view-btn]").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.viewBtn)))}
function resetarFormulario(){document.getElementById("ticketForm").reset()}

async function uploadFoto(file){if(!file)return null;const ext=(file.name.split(".").pop()||"jpg").toLowerCase();const fileName="foto_"+Date.now()+"."+ext;const {error}=await window.supabaseClient.storage.from("chamados-fotos").upload(fileName,file,{cacheControl:"3600",upsert:false,contentType:file.type||"image/jpeg"});if(error)throw error;const {data}=window.supabaseClient.storage.from("chamados-fotos").getPublicUrl(fileName);return data.publicUrl}
function renderDashboard(){
  document.getElementById("metricTotal").textContent = ticketsCache.length;

  document.getElementById("metricAbertos").textContent =
    ticketsCache.filter(t => t.status === "Aberto").length;

  document.getElementById("metricAndamento").textContent =
    ticketsCache.filter(t => t.status === "Em andamento").length;

  document.getElementById("metricConcluidos").textContent =
    ticketsCache.filter(t => t.status === "Concluído").length;

  document.getElementById("metricCriticos").textContent =
    ticketsCache.filter(t => t.gravidade === "Crítica").length;
}
async function salvarChamado(event){
  event.preventDefault();

  const btn = event.target.querySelector("button[type='submit']");
  btn.disabled = true;
  btn.textContent = "Salvando...";

  try {
    const file = document.getElementById("foto").files[0];
    const fotoUrl = await uploadFoto(file);

    const chamado = {
      id: "CH-" + Date.now(),
      nome: document.getElementById("nome").value.trim(),
      unidade: document.getElementById("unidade").value,
      setor: document.getElementById("setor").value,
      setor_problema: document.getElementById("setorProblema").value.trim(),
      tipo_manutencao: document.getElementById("tipoManutencao").value,
      gravidade: document.getElementById("gravidade").value,
      descricao: document.getElementById("descricao").value.trim(),
      foto_url: fotoUrl,
      status: "Aberto",
      data_criacao: new Date().toISOString(),
      data_inicio: null,
      data_finalizacao: null
    };

    // 🔥 SALVA NO SUPABASE (FALTAVA ISSO)
    const { error } = await window.supabaseClient
      .from("chamados")
      .insert([chamado]);

    if (error) {
      console.error(error);
      alert("Erro ao salvar chamado: " + error.message);
      return;
    }

      alert("Chamado salvo com sucesso!");

    resetarFormulario();
    await carregarDados();
    switchView("lista");

  } catch (error) {
    console.error(error);
    alert("Erro ao salvar chamado.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Salvar chamado";
  }
}

function getFilteredTickets(){const busca=document.getElementById("busca")?.value.toLowerCase().trim()||"";const filtroStatus=document.getElementById("filtroStatus")?.value||"";const filtroGravidade=document.getElementById("filtroGravidade")?.value||"";const filtroSetor=document.getElementById("filtroSetor")?.value||"";return ticketsCache.filter(ticket=>{const target=[ticket.id,ticket.nome,ticket.unidade,ticket.setor,ticket.setor_problema,ticket.tipo_manutencao,ticket.descricao].join(" ").toLowerCase();return (!busca||target.includes(busca))&&(!filtroStatus||ticket.status===filtroStatus)&&(!filtroGravidade||ticket.gravidade===filtroGravidade)&&(!filtroSetor||ticket.setor===filtroSetor)})}

function renderDashboard(){document.getElementById("metricTotal").textContent=ticketsCache.length;document.getElementById("metricAbertos").textContent=ticketsCache.filter(t=>t.status==="Aberto").length;document.getElementById("metricAndamento").textContent=ticketsCache.filter(t=>t.status==="Em andamento" || t.status === "Pausado").length;document.getElementById("metricConcluidos").textContent=ticketsCache.filter(t=>t.status==="Concluído").length;document.getElementById("metricCriticos").textContent=ticketsCache.filter(t=>t.gravidade==="Crítica").length}

function renderTicketList(){const list=document.getElementById("ticketList");const filtered=getFilteredTickets();if(!filtered.length){list.innerHTML='<div class="empty-state">Nenhum chamado encontrado com os filtros atuais.</div>';return}list.innerHTML=filtered.map(ticket=>`<article class="ticket-card"><div><h4>${escapeHtml(ticket.unidade)} • ${escapeHtml(ticket.setor)}</h4><div class="ticket-meta"><span class="badge badge-soft">${escapeHtml(ticket.id)}</span><span class="badge badge-soft">${escapeHtml(ticket.nome||"Sem nome")}</span><span class="badge badge-soft">${escapeHtml(ticket.tipo_manutencao||"—")}</span><span class="badge ${statusClass(ticket.status)}">${escapeHtml(ticket.status||"Aberto")}</span><span class="badge ${priorityClass(ticket.gravidade)}">${escapeHtml(ticket.gravidade||"Baixa")}</span></div><p class="ticket-desc">${escapeHtml(ticket.descricao||"")}</p></div><div class="ticket-aside"><div class="date-chip"><strong>Criação:</strong><br>${formatDateTime(ticket.data_criacao)}</div><div class="date-chip"><strong>Início:</strong><br>${formatDateTime(ticket.data_inicio)}</div><div class="date-chip"><strong>Finalização:</strong><br>${formatDateTime(ticket.data_finalizacao)}</div>${ticket.foto_url?`<img class="thumb" src="${escapeHtml(ticket.foto_url)}" alt="Foto do chamado">`:""}<button class="btn btn-secondary" onclick="abrirDetalhes('${ticket.id}')">
  Detalhes
</button>

${ticket.status === "Concluído" ? `
  <button class="btn btn-danger" onclick="excluirChamado('${ticket.id}')">
    🗑️ Lixeira
  </button>
` : ""}</div></article>`).join("")}

function renderKanban(){const aberto=ticketsCache.filter(t=>t.status==="Aberto");const andamento=ticketsCache.filter(t=>t.status==="Em andamento");const concluido=ticketsCache.filter(t=>t.status==="Concluído");document.getElementById("kanbanCountAberto").textContent=aberto.length;document.getElementById("kanbanCountAndamento").textContent=andamento.length;document.getElementById("kanbanCountConcluido").textContent=concluido.length;renderKanbanColumn("kanbanAberto",aberto);renderKanbanColumn("kanbanAndamento",andamento);renderKanbanColumn("kanbanConcluido",concluido)}
function renderKanbanColumn(id,items){const target=document.getElementById(id);if(!items.length){target.innerHTML='<div class="empty-state">Sem chamados nesta coluna.</div>';return}target.innerHTML=items.map(ticket=>`<article class="kanban-card" onclick="abrirDetalhes('${escapeHtml(ticket.id)}')"><strong>${escapeHtml(ticket.unidade)}</strong><div class="ticket-meta"><span class="badge ${priorityClass(ticket.gravidade)}">${escapeHtml(ticket.gravidade||"Baixa")}</span></div><div>${escapeHtml(ticket.setor_problema||"—")}</div><small>${escapeHtml(ticket.setor||"—")} • ${escapeHtml(ticket.tipo_manutencao||"—")}</small></article>`).join("")}

function abrirDetalhes(id){
  const ticket = ticketsCache.find(t => t.id === id);
  if(!ticket) return;

  selectedTicket = ticket;

  document.getElementById("modalTicketId").textContent = ticket.id;

  // 🔥 RECONSTRUIR OS CAMPOS
  const fields = [
    ["Solicitante", ticket.nome],
    ["Unidade", ticket.unidade],
    ["Setor", ticket.setor],
    ["Setor do problema", ticket.setor_problema],
    ["Tipo de manutenção", ticket.tipo_manutencao],
    ["Gravidade", ticket.gravidade],
    ["Criação", formatDateTime(ticket.data_criacao)],
    ["Início", formatDateTime(ticket.data_inicio)],
    ["Finalização", formatDateTime(ticket.data_finalizacao)]
  ];

  document.getElementById("detailGrid").innerHTML = fields.map(([label, value]) => `
    <div class="detail-box">
      <strong>${label}</strong>
      <div>${value || "—"}</div>
    </div>
  `).join("");

  // descrição
  document.getElementById("modalDescricao").textContent = ticket.descricao || "";

  // foto
  const modalFoto = document.getElementById("modalFoto");
  if(ticket.foto_url){
    modalFoto.src = ticket.foto_url;
    modalFoto.classList.remove("hidden");
  } else {
    modalFoto.classList.add("hidden");
  }

  document.getElementById("detailModal").showModal();

  // 🔥 IMPORTANTE (botões)
  atualizarBotoesStatus();
}
function fecharModal(){document.getElementById("detailModal").close()}

async function atualizarChamadoModal(){if(!selectedTicket)return;const novoStatus=document.getElementById("modalStatusSelect").value;const agora=new Date().toISOString();const payload={status:novoStatus};if(novoStatus==="Em andamento"){payload.data_inicio=selectedTicket.data_inicio||agora;payload.data_finalizacao=null}else if(novoStatus==="Concluído"){payload.data_inicio=selectedTicket.data_inicio||agora;payload.data_finalizacao=agora}else{payload.data_inicio=null;payload.data_finalizacao=null}const {error}=await window.supabaseClient.from("chamados").update(payload).eq("id",selectedTicket.id);if(error){alert("Erro ao atualizar chamado: "+error.message);return}fecharModal();await carregarDados();alert("Chamado atualizado com sucesso.")}

async function carregarDados() {
  try {
    const { data, error } = await window.supabaseClient
      .from("chamados")
      .select("*")
      .or("excluido.is.null,excluido.eq.false") // 🔥 CORREÇÃO AQUI
      .order("data_criacao", { ascending: false });

    if (error) {
      console.error("Erro Supabase:", error);
      alert("Erro ao carregar dados: " + error.message);
      return;
    }

    console.log("📦 Dados carregados:", data);

    ticketsCache = Array.isArray(data) ? data : [];

    renderDashboard();
    renderTicketList();
    renderKanban();

  } catch (err) {
    console.error("Erro geral:", err);
    alert("Erro inesperado ao carregar dados.");
  }
}
async function deletarPermanente(id) {
  const confirmar = confirm("Excluir definitivamente?");

  if (!confirmar) return;

  await window.supabaseClient
    .from("chamados")
    .delete()
    .eq("id", id);

  carregarLixeira();
}
async function carregarLixeira() {
  const { data } = await window.supabaseClient
    .from("chamados")
    .select("*")
    .eq("excluido", true);

  const container = document.getElementById("lixeiraList");

  container.innerHTML = data.map(c => `
    <div class="ticket-card">
      <strong>${c.unidade} - ${c.setor}</strong>
      <p>${c.descricao || ""}</p>

      <button class="btn btn-primary" onclick="restaurarChamado('${c.id}')">
        ♻️ Restaurar
      </button>

      <button class="btn btn-danger" onclick="deletarPermanente('${c.id}')">
        ❌ Excluir definitivo
      </button>
    </div>
  `).join("");
}
async function restaurarChamado(id) {
  await window.supabaseClient
    .from("chamados")
    .update({ excluido: false })
    .eq("id", id);

  carregarLixeira();
  carregarDados();
}
function registerPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        await navigator.serviceWorker.register("./service-worker.js");
        console.log("Service Worker registrado");
      } catch (error) {
        console.error("Erro ao registrar Service Worker:", error);
      }
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;

    const installButton = document.getElementById("installButton");
    if (installButton) {
      installButton.classList.remove("hidden");
    }
  });

  const installButton = document.getElementById("installButton");

  // 🔥 PROTEÇÃO CONTRA NULL
  if (installButton) {
    installButton.addEventListener("click", async () => {
      if (!deferredPrompt) {
        alert("O navegador ainda não liberou a instalação.");
        return;
      }

      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;

      installButton.classList.add("hidden");
    });
  }

  window.addEventListener("appinstalled", () => {
    if (installButton) {
      installButton.classList.add("hidden");
    }
  });
}
function exportarListaPDF(){const tickets=getFilteredTickets();if(!tickets.length){alert("Não há chamados para exportar.");return}const rows=tickets.map(ticket=>`<tr><td>${escapeHtml(ticket.id)}</td><td>${escapeHtml(ticket.nome||"")}</td><td>${escapeHtml(ticket.unidade||"")}</td><td>${escapeHtml(ticket.setor||"")}</td><td>${escapeHtml(ticket.setor_problema||"")}</td><td>${escapeHtml(ticket.tipo_manutencao||"")}</td><td>${escapeHtml(ticket.gravidade||"")}</td><td>${escapeHtml(ticket.status||"")}</td><td>${escapeHtml(formatDateTime(ticket.data_criacao))}</td><td>${escapeHtml(formatDateTime(ticket.data_inicio))}</td><td>${escapeHtml(formatDateTime(ticket.data_finalizacao))}</td></tr>`).join("");const popup=window.open("","_blank");if(!popup){alert("Libere pop-ups para exportar o PDF.");return}popup.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Lista de Chamados</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#0f172a}h1{margin:0 0 8px}p{color:#475569;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;vertical-align:top}th{background:#e2e8f0}@page{size:A4 landscape;margin:12mm}</style></head><body><h1>Lista de Chamados de Engenharia</h1><p>Exportado em ${new Date().toLocaleString("pt-BR")}</p><table><thead><tr><th>ID</th><th>Solicitante</th><th>Unidade</th><th>Setor</th><th>Problema</th><th>Manutenção</th><th>Prioridade</th><th>Status</th><th>Criação</th><th>Início</th><th>Finalização</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`);popup.document.close()}

function bindFilters(){["busca","filtroStatus","filtroGravidade","filtroSetor"].forEach(id=>{const el=document.getElementById(id);if(!el)return;el.addEventListener("input",()=>{renderTicketList();renderKanban()});el.addEventListener("change",()=>{renderTicketList();renderKanban()})})}

function registerPWA(){if("serviceWorker"in navigator){window.addEventListener("load",async()=>{try{await navigator.serviceWorker.register("./service-worker.js");console.log("Service Worker registrado")}catch(error){console.error("Erro ao registrar Service Worker:",error)}})}window.addEventListener("beforeinstallprompt",(event)=>{event.preventDefault();deferredPrompt=event;document.getElementById("installButton").classList.remove("hidden")});const installButton=document.getElementById("installButton");installButton.addEventListener("click",async()=>{if(!deferredPrompt){alert("O navegador ainda não liberou a instalação. Abra via HTTPS ou localhost e use o app por alguns instantes.");return}deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installButton.classList.add("hidden")});window.addEventListener("appinstalled",()=>{installButton.classList.add("hidden")})}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.supabaseClient) {
    alert("Supabase não foi inicializado.");
    return;
  }

  bindViewButtons();
  bindFilters();
  registerPWA();

  document.getElementById("ticketForm")
    .addEventListener("submit", salvarChamado);

  switchView("dashboard");
  await carregarDados();

  // 🔥 ORDEM CORRETA
  setTimeout(() => {
    ativarNotificacoesSeguro();
    ativarPushOneSignal();
  }, 1500);

  setTimeout(() => {
    escutarChamadosSeguro();
  }, 2500);
});
// 🔥 EXPORTAR RELATÓRIO MENSAL (CORRIGIDO)
async function exportarRelatorioMensal() {
  try {
    const { data, error } = await window.supabaseClient
      .from("chamados")
      .select("*");

    if (error) {
      alert("Erro ao buscar dados: " + error.message);
      return;
    }

    const hoje = new Date();
    const mes = hoje.getMonth();
    const ano = hoje.getFullYear();

    // ✅ FILTRO: mês atual + apenas CONCLUÍDOS
 const chamadosMes = data.filter(c => {
  if (!c.data_criacao) return false;

  const d = new Date(c.data_criacao);

  return (
    d.getMonth() === mes &&
    d.getFullYear() === ano &&
    c.status === "Concluído" &&
    c.excluido !== true // 🔥 AQUI RESOLVE
  );
});
const chamadosPorSetor = {};
const custoPorSetor = {};

chamadosMes.forEach(c => {
  if (!chamadosPorSetor[c.setor]) {
    chamadosPorSetor[c.setor] = 0;
    custoPorSetor[c.setor] = 0;
  }

  chamadosPorSetor[c.setor]++;

  if (c.data_inicio && c.data_finalizacao) {
    const duracao = (new Date(c.data_finalizacao) - new Date(c.data_inicio)) / (1000 * 60 * 60);
    const custo = duracao * 81;

    custoPorSetor[c.setor] += custo;
  }
  
});
    if (!chamadosMes.length) {
      alert("Nenhum chamado concluído neste mês.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("landscape");

    // 🔧 CONFIG
    const CUSTO_HORA = 81;

    let custoTotal = 0;
    const custoPorLoja = {};
    const chamadosPorLoja = {};

    // 🔥 PROCESSAMENTO
    const linhas = chamadosMes.map(c => {
      let duracao = 0;
      let custo = 0;

      if (c.data_inicio && c.data_finalizacao) {
        const inicio = new Date(c.data_inicio);
        const fim = new Date(c.data_finalizacao);

        duracao = (fim - inicio) / (1000 * 60 * 60);
        custo = duracao * CUSTO_HORA;

        custoTotal += custo;

        if (!custoPorLoja[c.unidade]) custoPorLoja[c.unidade] = 0;
        custoPorLoja[c.unidade] += custo;
      }

      if (!chamadosPorLoja[c.unidade]) chamadosPorLoja[c.unidade] = 0;
      chamadosPorLoja[c.unidade]++;

      return [
        c.id,
        c.nome,
        c.unidade,
        c.setor,
        c.setor_problema,
        c.tipo_manutencao,
        c.gravidade,
        c.status,
        formatDateTime(c.data_criacao),
        formatDateTime(c.data_inicio),
        formatDateTime(c.data_finalizacao),
        duracao ? formatarHoras(duracao) : "",
        "Equipe",
        `R$ ${CUSTO_HORA}`,
        custo ? `R$ ${custo.toFixed(2)}` : "",
        c.descricao || ""
      ];
    });

    // 🧾 ===== PÁGINA 1 - RESUMO =====
    doc.setFontSize(18);
    doc.text("RELATÓRIO MENSAL - CHAMADOS CONCLUÍDOS", 14, 20);

    doc.setFontSize(12);
    doc.text(`Mês: ${mes + 1}/${ano}`, 14, 30);

    doc.text(`Total concluídos: ${chamadosMes.length}`, 14, 40);
    doc.text(`CUSTO TOTAL: R$ ${custoTotal.toFixed(2)}`, 14, 50);

    // 🏆 Ranking por custo
    const ranking = Object.entries(custoPorLoja)
      .sort((a, b) => b[1] - a[1])
      .map(([loja, valor]) => [loja, `R$ ${valor.toFixed(2)}`]);

    doc.autoTable({
      startY: 60,
      head: [["Loja", "Custo Total"]],
      body: ranking
    });

    // 📊 ===== PÁGINA 2 =====
    doc.addPage();

    const resumo = Object.keys(chamadosPorLoja).map(loja => [
      loja,
      chamadosPorLoja[loja],
      `R$ ${(custoPorLoja[loja] || 0).toFixed(2)}`
    ]);

    doc.text("Resumo por Loja", 14, 20);

    doc.autoTable({
      startY: 25,
      head: [["Loja", "Qtd Chamados", "Custo"]],
      body: resumo
    });
	
	// 📊 ===== PÁGINA 3 - RESUMO POR SETOR =====
doc.addPage();

doc.text("Resumo por Setor", 14, 20);

const resumoSetor = Object.keys(chamadosPorSetor).map(setor => [
  setor,
  chamadosPorSetor[setor],
  `R$ ${custoPorSetor[setor].toFixed(2)}`
]);

doc.autoTable({
  startY: 25,
  head: [["Setor", "Qtd Chamados", "Custo Total"]],
  body: resumoSetor
});

    // 📋 ===== PÁGINA 4 =====
    doc.addPage();

    doc.text("Detalhamento dos Chamados Concluídos", 14, 20);

    doc.autoTable({
      startY: 25,
      head: [[
        "ID","Solicitante","Unidade","Setor","Problema","Tipo",
        "Gravidade","Status","Criação","Início","Final",
        "Duração (h)","Equipe","Custo Hora","Custo","Descrição"
      ]],
      body: linhas,
      styles: { fontSize: 6 },
      columnStyles: {
        15: { cellWidth: 50 }
      }
    });

    // 📥 DOWNLOAD
    doc.save(`Relatorio_Concluidos_${mes + 1}_${ano}.pdf`);

  } catch (err) {
    console.error(err);
    alert("Erro ao gerar relatório.");
  }
}
function atualizarBotoesStatus() {
  if (!selectedTicket) return;

  const status = selectedTicket.status;

 const btnIniciar = document.getElementById("btnIniciar");if (btnIniciar) btnIniciar.style.display = "none";
  const btnPausar = document.getElementById("btnPausar");if (btnPausar) btnIniciar.style.display = "none";
  const btnRetomar = document.getElementById("btnRetomar");if (btnRetomar) btnIniciar.style.display = "none";
  const btnFinalizar = document.getElementById("btnFinalizar");if (btnFinalizar) btnIniciar.style.display = "none";


  if (status === "Aberto") {
    btnIniciar.style.display = "inline-block";
  }

  if (status === "Em andamento") {
    btnPausar.style.display = "inline-block";
    btnFinalizar.style.display = "inline-block";
  }

  if (status === "Pausado") {
    btnRetomar.style.display = "inline-block";
    btnFinalizar.style.display = "inline-block";
  }

  if (status === "Concluído") {
    // nenhum botão aparece
  }
}
 // ✅ INICIAR
async function iniciarChamado() {
  try {
    if (!selectedTicket) return;

    const idChamado = selectedTicket.id; // 🔥 salva antes
    const unidade = selectedTicket.unidade;
    const setor = selectedTicket.setor;

    const agora = new Date().toISOString();

    const { error } = await window.supabaseClient
      .from("chamado_tempo")
      .insert([{
        chamado_id: idChamado,
        inicio: agora,
        fim: null
      }]);

    if (error) {
      console.error(error);
      alert("Erro ao iniciar: " + error.message);
      return;
    }

    await window.supabaseClient
      .from("chamados")
      .update({
        status: "Em andamento",
        data_inicio: selectedTicket.data_inicio || agora
      })
      .eq("id", idChamado);

    
    fecharModal();
    await carregarDados();

    alert("▶️ Chamado iniciado!");

  } catch (err) {
    console.error(err);
    alert("Erro inesperado.");
  }
  enviarPushOneSignal(
  "▶️ Chamado iniciado",
  `ID: ${idChamado}`
);
}

 // ✅ PAUSAR
async function pausarChamado() {
  try {
    if (!selectedTicket) return;

    const idChamado = selectedTicket.id;
    const unidade = selectedTicket.unidade;
    const setor = selectedTicket.setor;

    // 🔍 buscar período aberto
    const { data, error } = await window.supabaseClient
      .from("chamado_tempo")
      .select("*")
      .eq("chamado_id", idChamado)
      .is("fim", null)
      .order("inicio", { ascending: false })
      .limit(1);

    if (error) {
      console.error(error);
      alert("Erro ao buscar período: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert("⚠️ Nenhum período em andamento.");
      return;
    }

    const periodo = data[0];

    const { error: updateError } = await window.supabaseClient
      .from("chamado_tempo")
      .update({ fim: new Date().toISOString() })
      .eq("id", periodo.id);

    if (updateError) {
      console.error(updateError);
      alert("Erro ao pausar: " + updateError.message);
      return;
    }

    await window.supabaseClient
      .from("chamados")
      .update({ status: "Pausado" })
      .eq("id", idChamado);



    fecharModal();
    await carregarDados();

    alert("⏸️ Chamado pausado com sucesso!");

  } catch (err) {
    console.error("Erro real:", err);
    alert("Erro inesperado ao pausar.");
  }
  enviarPushOneSignal(
  "⏸️ Chamado pausado",
  `ID: ${idChamado}`
);
}
 // ✅ RETOMAR
async function retomarChamado() {
  if (!selectedTicket) return;

  const idChamado = selectedTicket.id; // 🔥 salva antes
  const unidade = selectedTicket.unidade;
  const setor = selectedTicket.setor;

  await window.supabaseClient
    .from("chamado_tempo")
    .insert([{
      chamado_id: idChamado,
      inicio: new Date().toISOString()
    }]);

  await window.supabaseClient
    .from("chamados")
    .update({ status: "Em andamento" })
    .eq("id", idChamado);


  fecharModal();
  await carregarDados();

  alert("Chamado retomado!");
  enviarPushOneSignal(
  "▶️ Chamado retomado",
  `ID: ${idChamado}`
);
}
 // ✅ FINALIZAR
async function finalizarChamado() {
  if (!selectedTicket) return;

  const idChamado = selectedTicket.id; // 🔥 GUARDA ANTES
  const unidade = selectedTicket.unidade;
  const setor = selectedTicket.setor;

  const { data } = await window.supabaseClient
    .from("chamado_tempo")
    .select("*")
    .eq("chamado_id", idChamado)
    .is("fim", null);

  if (data && data.length > 0) {
    const ultimo = data[data.length - 1];

    await window.supabaseClient
      .from("chamado_tempo")
      .update({ fim: new Date().toISOString() })
      .eq("id", ultimo.id);
  }

  await window.supabaseClient
    .from("chamados")
    .update({
      status: "Concluído",
      data_finalizacao: new Date().toISOString()
    })
    .eq("id", idChamado);

  fecharModal();
  await carregarDados();

  alert("Chamado finalizado!");
  enviarPushOneSignal(
  "✅ Chamado finalizado",
  `ID: ${idChamado}`
);
}
 // ✅ CALCULAR TEMPO REAL
async function calcularDuracaoReal(chamadoId) {
  const { data } = await window.supabaseClient
    .from("chamado_tempo")
    .select("*")
    .eq("chamado_id", chamadoId);

  let total = 0;

  data.forEach(t => {
    if (t.inicio && t.fim) {
      total += (new Date(t.fim) - new Date(t.inicio));
    }
  });

  return (total / (1000 * 60 * 60)).toFixed(2);
}
// notificações
async function ativarNotificacoes() {
  const perm = await Notification.requestPermission();

  if (perm === "granted") {
    console.log("🔔 Notificações ativadas");
  } else {
    alert("Ative as notificações para receber alertas.");
  }
}
function ativarNotificacoesSeguro() {
  if (!("Notification" in window)) return;

  Notification.requestPermission().then(permission => {
    console.log("Permissão:", permission);
  });
}
function notificar(titulo, mensagem) {
  try {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      new Notification(titulo, {
        body: mensagem,
        icon: "/logo.png"
      });
    }
  } catch (e) {
    console.warn("Erro notificação:", e);
  }
}

function escutarChamadosSeguro() {
  try {
    if (!window.supabaseClient) {
      console.warn("Supabase ainda não carregou");
      return;
    }

    const channel = window.supabaseClient.channel("chamados");

    if (!channel) {
      console.warn("Channel não criado");
      return;
    }

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chamados",
        },
        (payload) => {
          console.log("Realtime:", payload);

          const c = payload.new;

          if (payload.eventType === "INSERT") {
            notificar("🚨 Novo chamado", `${c.unidade} - ${c.setor}`);
          }

          if (payload.eventType === "UPDATE") {
            notificar("🔄 Status atualizado", `${c.unidade} - ${c.status}`);
          }
        }
      )
      .subscribe();

  } catch (e) {
    console.warn("Erro realtime:", e);
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => console.log("Service Worker registrado"))
    .catch(err => console.error("Erro SW:", err));
}

function ativarPushOneSignal() {
  window.OneSignal = window.OneSignal || [];

  OneSignal.push(function() {
    OneSignal.showSlidedownPrompt();
  });
}

async function enviarPushOneSignal(titulo, mensagem) {
  try {
    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "9e2f1bcd-0cb7-4ab3-9a6b-eebf02ec6cb5"
      },
      body: JSON.stringify({
        app_id: "os_v2_app_tyxrxtimw5flhgtl527qf3dmwvzwl7xa3klebvm7vs7a6vvzzvhkj6656ebpqcw63pptn4jycoiam4pm4jlycd63jgym5kyzeeqngqy", 
        included_segments: ["All"],
        headings: { en: titulo },
        contents: { en: mensagem }
      })
    });
  } catch (err) {
    console.error("Erro push:", err);
  }
}
async function excluirChamado(id) {
  const confirmar = confirm("Deseja mover este chamado para a lixeira?");

  if (!confirmar) return;

  try {
    const { error } = await window.supabaseClient
      .from("chamados")
      .update({ excluido: true }) // 🔥 NÃO DELETA
      .eq("id", id);

    if (error) {
      alert("Erro: " + error.message);
      return;
    }

    alert("Chamado movido para lixeira!");

    await carregarDados();

  } catch (err) {
    console.error(err);
    alert("Erro inesperado.");
  }
}
function formatarHoras(horasDecimal) {
  if (!horasDecimal) return "—";

  const horas = Math.floor(horasDecimal);
  const minutos = Math.round((horasDecimal - horas) * 60);

  return `${horas}h ${minutos}min`;
}
function switchView(view, el = null) {
  // troca tela
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));

  const target = document.getElementById(view + 'View');
  if (target) target.classList.remove('hidden');

  // remove ativo
  document.querySelectorAll('.menu-btn')
    .forEach(btn => btn.classList.remove('active'));

  // adiciona ativo (SE existir)
  if (el) {
    el.classList.add('active');
  }

  // fallback automático (caso venha do JS)
  else {
    const btn = document.querySelector(`.menu-btn[onclick*="${view}"]`);
    if (btn) btn.classList.add('active');
  }

  // renderizações
  if (view === "dashboard") renderDashboard();
  if (view === "lista") renderTicketList();
  if (view === "kanban") renderKanban();
}