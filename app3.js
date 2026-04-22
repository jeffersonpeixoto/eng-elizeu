// 🔥 FIREBASE CONFIG
 const firebaseConfig = {
    apiKey: "AIzaSyCyhg8K7l48_k8sNTGuVxNf37sDf865T1A",
    authDomain: "eng-bd-elizeu.firebaseapp.com",
    projectId: "eng-bd-elizeu",
    storageBucket: "eng-bd-elizeu.firebasestorage.app",
    messagingSenderId: "169199632971",
    appId: "1:169199632971:web:4bca2feccd2e5b31db03ce"
  };

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 🔄 VARIÁVEIS
let selectedTicket = null;
let ticketsCache = [];

// 🔧 UTIL
function escapeHtml(v){return String(v??"")}
function formatDateTime(v){
  if(!v) return "—";
  const d = v.toDate ? v.toDate() : new Date(v);
  return d.toLocaleString("pt-BR");
}

// 📊 DASHBOARD
function renderDashboard(){
  document.getElementById("metricTotal").textContent =
    ticketsCache.filter(t => !t.excluido).length;

  document.getElementById("metricAbertos").textContent =
    ticketsCache.filter(t => t.status === "Aberto" && !t.excluido).length;

  document.getElementById("metricAndamento").textContent =
    ticketsCache.filter(t => t.status === "Em andamento" && !t.excluido).length;

  document.getElementById("metricConcluidos").textContent =
    ticketsCache.filter(t => t.status === "Concluído" && !t.excluido).length;
}

// 📥 REALTIME
function escutarChamadosSeguro() {
  db.collection("chamados")
    .orderBy("data_criacao", "desc")
    .limit(50)
    .onSnapshot(snapshot => {

      ticketsCache = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      renderDashboard();
      renderTicketList();
      renderKanban();
    });
}

// 📥 LISTA
function renderTicketList(){
  const list = document.getElementById("ticketList");

  list.innerHTML = ticketsCache.map(ticket => `
    <div class="ticket-card">
      <strong>${ticket.unidade} - ${ticket.setor}</strong>
      <p>${ticket.descricao || ""}</p>
      <button onclick="abrirDetalhes('${ticket.id}')">Detalhes</button>
    </div>
  `).join("");
}

// 📦 KANBAN
function renderKanban(){
  // simples (mantém lógica)
}

// 📂 DETALHES
function abrirDetalhes(id){
  selectedTicket = ticketsCache.find(t => t.id === id);
  alert("Chamado: " + selectedTicket.id);
}

// ➕ SALVAR
async function salvarChamado(event){
  event.preventDefault();

  const chamado = {
    nome: document.getElementById("nome").value,
    unidade: document.getElementById("unidade").value,
    setor: document.getElementById("setor").value,
    descricao: document.getElementById("descricao").value,
    status: "Aberto",
    excluido: false,
    data_criacao: new Date()
  };

  await db.collection("chamados").add(chamado);

  alert("Salvo!");
}

// 🔄 ATUALIZAR
async function atualizarChamadoModal(){
  if(!selectedTicket) return;

  await db.collection("chamados")
    .doc(selectedTicket.id)
    .update({
      status: "Concluído",
      data_finalizacao: new Date()
    });
}

// ❌ EXCLUIR
async function excluirChamado(id){
  await db.collection("chamados")
    .doc(id)
    .update({ excluido: true });
}

// 🗑️ DELETAR DEFINITIVO
async function deletarPermanente(id){
  await db.collection("chamados")
    .doc(id)
    .delete();
}

// 🔧 INIT
document.addEventListener("DOMContentLoaded", () => {

  document.getElementById("ticketForm")
    .addEventListener("submit", salvarChamado);

  escutarChamadosSeguro();
});