let deferredPrompt = null;
let selectedTicket = null;
let ticketsCache = [];

/* ================= UTIL ================= */
function escapeHtml(v){
  return String(v ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
}

function formatDateTime(v){
  if(!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleString("pt-BR");
}

/* ================= VIEW ================= */
function switchView(view, el = null){
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));

  document.getElementById(view+"View")?.classList.remove("hidden");

  document.querySelectorAll(".menu-btn")
    .forEach(btn=>btn.classList.remove("active"));

  if(el) el.classList.add("active");

  if(view==="dashboard") renderDashboard();
  if(view==="lista") renderTicketList();
  if(view==="kanban") renderKanban();
}

/* ================= DASHBOARD ================= */
function renderDashboard(){
  document.getElementById("metricTotal").textContent = ticketsCache.length;
  document.getElementById("metricAbertos").textContent =
    ticketsCache.filter(t=>t.status==="Aberto").length;
  document.getElementById("metricAndamento").textContent =
    ticketsCache.filter(t=>t.status==="Em andamento" || t.status==="Pausado").length;
  document.getElementById("metricConcluidos").textContent =
    ticketsCache.filter(t=>t.status==="Concluído").length;
}

/* ================= LISTA ================= */
function renderTicketList(){
  const list = document.getElementById("ticketList");

  list.innerHTML = ticketsCache.map(t => `
    <div class="ticket-card">
      <strong>${escapeHtml(t.unidade)} - ${escapeHtml(t.setor)}</strong>
      <p>${escapeHtml(t.descricao || "")}</p>

      <button class="btn" onclick="abrirDetalhes('${t.id}')">
        Detalhes
      </button>
    </div>
  `).join("");
}

/* ================= MODAL ================= */
function abrirDetalhes(id){
  const ticket = ticketsCache.find(t=>t.id===id);
  if(!ticket) return;

  selectedTicket = ticket;

  document.getElementById("modalTicketId").textContent = ticket.id;
  document.getElementById("modalDescricao").textContent = ticket.descricao || "";

  // 🔥 ABRIR MODAL CORRETO
  document.getElementById("detailModal").style.display = "flex";

  atualizarBotoesStatus();
}

function fecharModal(){
  document.getElementById("detailModal").style.display = "none";
}

/* ================= BOTÕES ================= */
function atualizarBotoesStatus(){
  if(!selectedTicket) return;

  const status = selectedTicket.status;

  const btnIniciar = document.getElementById("btnIniciar");
  const btnPausar = document.getElementById("btnPausar");
  const btnRetomar = document.getElementById("btnRetomar");
  const btnFinalizar = document.getElementById("btnFinalizar");

  [btnIniciar, btnPausar, btnRetomar, btnFinalizar].forEach(btn=>{
    if(btn) btn.classList.add("hidden");
  });

  if(status==="Aberto"){
    btnIniciar?.classList.remove("hidden");
  }

  if(status==="Em andamento"){
    btnPausar?.classList.remove("hidden");
    btnFinalizar?.classList.remove("hidden");
  }

  if(status==="Pausado"){
    btnRetomar?.classList.remove("hidden");
    btnFinalizar?.classList.remove("hidden");
  }
}

/* ================= DADOS ================= */
async function carregarDados(){
  const { data } = await window.supabaseClient
    .from("chamados")
    .select("*")
    .order("data_criacao",{ascending:false});

  ticketsCache = data || [];

  renderDashboard();
  renderTicketList();
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async ()=>{
  await carregarDados();
});