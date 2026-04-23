import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const appState = {
  ticketsCache: [],
  selectedTicket: null
};

// ponte
let ticketsCache = appState.ticketsCache || [];
let selectedTicket = appState.selectedTicket;
function escapeHtml(v) {
  if (v === null || v === undefined) return "";

  const mapa = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };

  return String(v).replace(/[&<>"']/g, (m) => mapa[m]);
}
function formatDateTime(v) {
  if (!v) return "—";

  try {
    let d;

    // 🔥 Firestore Timestamp
    if (typeof v === "object" && typeof v.toDate === "function") {
      d = v.toDate();
    } 
    // 🔥 Date normal
    else if (v instanceof Date) {
      d = v;
    } 
    // 🔥 string ou número
    else {
      d = new Date(v);
    }

    if (Number.isNaN(d.getTime())) return v;

    return d.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    });

  } catch (err) {
    console.warn("Erro formatDateTime:", err);
    return v;
  }
}
function statusClass(s) {
  if (!s) return "status-aberto";

  // 🔤 normaliza (remove acento + lowercase)
  const normalizado = s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const mapa = {
    "aberto": "status-aberto",
    "em andamento": "status-andamento",
    "andamento": "status-andamento",
    "pausado": "status-pausado",
    "concluido": "status-concluido"
  };

  return mapa[normalizado] || "status-aberto";
}
function priorityClass(p) {
  if (!p) return "priority-baixa";

  // 🔤 normaliza (remove acento + lowercase)
  const normalizado = p
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const mapa = {
    baixa: "priority-baixa",
    media: "priority-media",
    alta: "priority-alta",
    critica: "priority-critica"
  };

  return mapa[normalizado] || "priority-baixa";
}

function bindViewButtons() {
  const buttons = document.querySelectorAll("[data-view-btn]");

  buttons.forEach(btn => {

    // 🔄 evita duplicação de evento
    btn.removeEventListener("click", btn._handler);

    btn._handler = () => {
      const view = btn.dataset.viewBtn;

      if (!view) {
        console.warn("Botão sem data-view-btn:", btn);
        return;
      }

      // 🔄 troca view
      if (typeof switchView === "function") {
        switchView(view);
      } else {
        console.error("Função switchView não encontrada");
      }

      // 🎯 UX — botão ativo
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    };

    btn.addEventListener("click", btn._handler);
  });
}
function resetarFormulario() {
  const form = document.getElementById("ticketForm");
  if (!form) return;

  form.reset();

  // 🧼 limpa preview de imagem (se tiver)
  const preview = document.getElementById("previewFoto");
  if (preview) {
    preview.src = "";
    preview.style.display = "none";
  }

  // 🧼 limpa input de arquivo manualmente
  const inputFile = document.getElementById("foto");
  if (inputFile) {
    inputFile.value = "";
  }

  // 🔄 reset selects padrão (se quiser garantir)
  const gravidade = document.getElementById("gravidade");
  if (gravidade) gravidade.value = "Baixa";

  const tipo = document.getElementById("tipoManutencao");
  if (tipo) tipo.value = "";

  // 🔁 reset botão submit
  const btn = form.querySelector("button[type='submit']");
  if (btn) {
    btn.disabled = false;
    btn.textContent = "Salvar chamado";
  }
}
function compressImageSafe(file) {
  return new Promise((resolve) => {
    try {
      if (!file.type.startsWith("image/")) {
        return resolve(file);
      }

      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target.result;
      };

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");

          const maxWidth = 800;
          const maxHeight = 800;

          let width = img.width;
          let height = img.height;

          // 🔥 mantém proporção (largura + altura)
          const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
          width = width * ratio;
          height = height * ratio;

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");

          // 🔥 fundo branco (evita fundo preto em JPG/WebP)
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, width, height);

          ctx.drawImage(img, 0, 0, width, height);

          // 🔥 mantém formato original quando necessário
          const isPng = file.type === "image/png";

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                resolve(file);
              }
            },
            isPng ? "image/png" : "image/webp",
            isPng ? 0.9 : 0.7
          );

        } catch (err) {
          console.warn("Erro compressão interna:", err);
          resolve(file);
        }
      };

      img.onerror = () => resolve(file);
      reader.onerror = () => resolve(file);

      reader.readAsDataURL(file);

    } catch (err) {
      console.warn("Erro geral compressão:", err);
      resolve(file);
    }
  });
}
async function uploadFoto(file) {
  if (!file) return null;

  try {
    // 📏 valida tipo
    if (!file.type.startsWith("image/")) {
      throw new Error("Arquivo precisa ser uma imagem");
    }

    // 📦 limite (ex: 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error("Imagem muito grande (máx. 5MB)");
    }

    // 🔥 compressão segura
    let finalFile = file;
    try {
      finalFile = await compressImageSafe(file);
    } catch (e) {
      console.warn("Erro ao comprimir, usando original");
    }

    const formData = new FormData();
    formData.append("file", finalFile);
    formData.append("upload_preset", "uploads_public");

    const res = await fetch(
      "https://api.cloudinary.com/v1_1/dprkzdmqt/image/upload",
      {
        method: "POST",
        body: formData
      }
    );

    // ❌ erro de rede
    if (!res.ok) {
      throw new Error("Erro ao enviar imagem (rede)");
    }

    const data = await res.json();

    // ❌ erro do Cloudinary
    if (data.error) {
      throw new Error(data.error.message);
    }

    // ✅ sucesso
    return data.secure_url;

  } catch (error) {
    console.error("Erro upload:", error);

    // 💡 fallback (não quebra o sistema)
    alert("Erro ao enviar imagem: " + error.message);

    return null;
  }
}
function renderDashboard(){
  document.getElementById("metricTotal").textContent =
    ticketsCache.filter(t => !t.excluido).length;

  document.getElementById("metricAbertos").textContent =
    ticketsCache.filter(t => t.status === "Aberto" && !t.excluido).length;

  document.getElementById("metricAndamento").textContent =
    ticketsCache.filter(t => t.status === "Em andamento" && !t.excluido).length;

  document.getElementById("metricConcluidos").textContent =
    ticketsCache.filter(t => t.status === "Concluído" && !t.excluido).length;

  document.getElementById("metricCriticos").textContent =
    ticketsCache.filter(t => t.gravidade === "Crítica" && !t.excluido).length;
}

async function salvarChamado(event) {
  event.preventDefault();

  const btn = event.target.querySelector("button[type='submit']");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Salvando...";
  }

  try {
    // 🔹 CAPTURA CAMPOS
    const nome = document.getElementById("nome").value.trim();
    const unidade = document.getElementById("unidade").value;
    const setor = document.getElementById("setor").value;
    const gravidade = document.getElementById("gravidade").value;
    const setorProblema = document.getElementById("setorProblema").value.trim();
    const tipoManutencao = document.getElementById("tipoManutencao").value;
    const descricao = document.getElementById("descricao").value.trim();
    const file = document.getElementById("foto").files[0];

    // 🔒 VALIDAÇÃO PESADA (sem dó)
    if (!nome || !unidade || !setor || !gravidade || !setorProblema || !tipoManutencao || !descricao) {
      throw new Error("Preencha todos os campos obrigatórios.");
    }

    // 📸 UPLOAD (se tiver imagem)
    let fotoUrl = null;

    if (file) {
      fotoUrl = await uploadFoto(file);
    }

    // 🔥 OBJETO FINAL
    const chamado = {
      nome,
      unidade,
      setor,
      gravidade,
      setor_problema: setorProblema,
      tipo_manutencao: tipoManutencao,
      descricao,
      foto_url: fotoUrl || null,

      status: "Aberto",
      excluido: false,
      data_criacao: new Date(),

      data_inicio: null,
      data_finalizacao: null
    };

    // 🔥 SALVA NO FIREBASE
    

    // 🎉 SUCESSO
    alert("✅ Chamado aberto com sucesso!");
const docRef = await addDoc(collection(db, "chamados"), chamado);
const chamadoId = docRef.id;

    resetarFormulario();
    switchView("dashboard");

  } catch (error) {
    console.error(error);
    alert("Erro: " + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Salvar chamado";
    }
  }
}
function getFilteredTickets(){
	const busca=document.getElementById("busca")?.value.toLowerCase().trim()||"";
	const filtroStatus=document.getElementById("filtroStatus")?.value||"";
	const filtroGravidade=document.getElementById("filtroGravidade")?.value||"";
	const filtroSetor=document.getElementById("filtroSetor")?.value||"";

	return ticketsCache.filter(ticket=>{

		if (ticket.excluido) return false; // 🔥 ESSENCIAL

		const target=[
			ticket.id,
			ticket.nome,
			ticket.unidade,
			ticket.setor,
			ticket.setor_problema,
			ticket.tipo_manutencao,
			ticket.descricao
		].join(" ").toLowerCase();

		return (
			(!busca || target.includes(busca)) &&
			(!filtroStatus || ticket.status === filtroStatus) &&
			(!filtroGravidade || ticket.gravidade === filtroGravidade) &&
			(!filtroSetor || ticket.setor === filtroSetor)
		);
	});
}



// =========================
// 📦 LISTA
// =========================
function renderTicketList(){
	const list=document.getElementById("ticketList");
	const filtered=getFilteredTickets();
	if(!filtered.length){list.innerHTML='<div class="empty-state">Nenhum chamado encontrado com os filtros atuais.</div>';return}
	list.innerHTML=filtered.map(ticket=>`<article class="ticket-card"><div><h4>${escapeHtml(ticket.unidade)} • ${escapeHtml(ticket.setor)}</h4>
	<div class="ticket-meta">
	<span class="badge badge-soft">${escapeHtml(ticket.id)}</span>
	<span class="badge badge-soft">${escapeHtml(ticket.nome||"Sem nome")}</span>
	<span class="badge badge-soft">${escapeHtml(ticket.tipo_manutencao||"—")}</span>
	<span class="badge ${statusClass(ticket.status)}">${escapeHtml(ticket.status||"Aberto")}</span>
	<span class="badge ${priorityClass(ticket.gravidade)}">${escapeHtml(ticket.gravidade||"Baixa")}</span>
	</div>
	<p class="ticket-desc">${escapeHtml(ticket.descricao||"")}</p>
	<button class="btn btn-detalhes" data-id="${ticket.id}"> Detalhes</button>
	</div>
	<div class="ticket-aside">
	<div class="date-chip">
	<strong>Criação:</strong><br>${formatDateTime(ticket.data_criacao)}
	</div>
	<div class="date-chip"><strong>Início:</strong><br>${formatDateTime(ticket.data_inicio)}</div>
	<div class="date-chip"><strong>Finalização:</strong><br>${formatDateTime(ticket.data_finalizacao)}</div>
	

${ticket.status === "Concluído" ? `
<button class="btn btn-danger" data-delete="${ticket.id}">
  🗑️ Lixeira
</button>
` : ""}
</div></article>`).join("")
}

function renderKanban(){
const aberto = ticketsCache.filter(t => t.status === "Aberto" && !t.excluido);

const andamento = ticketsCache.filter(t => t.status === "Em andamento" && !t.excluido);

const pausado = ticketsCache.filter(t => t.status === "Pausado" && !t.excluido);

const concluido = ticketsCache.filter(t => t.status === "Concluído" && !t.excluido);

  document.getElementById("kanbanCountAberto").textContent = aberto.length;
  document.getElementById("kanbanCountAndamento").textContent = andamento.length;
  document.getElementById("kanbanCountPausado").textContent = pausado.length; // 🔥 NOVO
  document.getElementById("kanbanCountConcluido").textContent = concluido.length;

  renderKanbanColumn("kanbanAberto", aberto);
  renderKanbanColumn("kanbanAndamento", andamento);
  renderKanbanColumn("kanbanPausado", pausado); // 🔥 NOVO
  renderKanbanColumn("kanbanConcluido", concluido);
}
function renderKanbanColumn(id, items) {
  const target = document.getElementById(id);
  if (!target) {
    console.warn("Coluna não encontrada:", id);
    return;
  }

  // 🔹 estado vazio
  if (!items || !items.length) {
    target.innerHTML = `<div class="empty-state">Sem chamados nesta coluna.</div>`;
    return;
  }

  // 🔹 monta HTML
  const html = items.map(ticket => {
    const prioridade = ticket.gravidade || "Baixa";
    const status = ticket.status || "Aberto";

    return `
      <article class="kanban-card ${statusClass(status)}" data-id="${escapeHtml(ticket.id)}">
        
        <strong>${escapeHtml(ticket.unidade)}</strong>

        <div class="ticket-meta">
          <span class="badge ${priorityClass(prioridade)}">
            ${escapeHtml(prioridade)}
          </span>
        </div>

        <div>${escapeHtml(ticket.setor_problema || "—")}</div>

        <small>
          ${escapeHtml(ticket.setor || "—")} • 
          ${escapeHtml(ticket.tipo_manutencao || "—")}
        </small>

      </article>
    `;
  }).join("");

  target.innerHTML = html;

  // 🔥 adiciona eventos (melhor que onclick inline)
  target.querySelectorAll(".kanban-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      abrirDetalhes(id);
    });
  });
}
function abrirDetalhes(id) {
  const ticket = ticketsCache.find(t => t.id === id);
  if (!ticket) return;
  
  console.log("Selecionado:", appState.selectedTicket);

  selectedTicket = ticket;

  // 🔹 ID
  const elId = document.getElementById("modalTicketId");
  if (elId) elId.textContent = ticket.id;

  // 🔹 CAMPOS
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

  const grid = document.getElementById("detailGrid");
  if (grid) {
    grid.innerHTML = fields.map(([label, value]) => `
      <div class="detail-box">
        <strong>${escapeHtml(label)}</strong>
        <div>${escapeHtml(value || "—")}</div>
      </div>
    `).join("");
  }

  // 🔹 DESCRIÇÃO (usa textContent → mais seguro)
  const desc = document.getElementById("modalDescricao");
  if (desc) desc.textContent = ticket.descricao || "";

  // 🔹 IMAGENS
  const antes = ticket.foto_url;
  const depois = ticket.foto_final_url;

  const modalFoto = document.getElementById("modalFoto");
  const wrapper = document.getElementById("compareWrapper");

 if (wrapper && modalFoto) {

  // 🔥 CASO: duas imagens
  if (antes && depois) {
    wrapper.style.display = "flex";
    wrapper.style.justifyContent = "center";
    wrapper.style.gap = "10px";

    wrapper.innerHTML = `
      <div style="text-align:center;">
        <strong>Antes</strong><br>
        <img src="${antes}" style="max-width:280px; border-radius:8px;">
      </div>
      <div style="text-align:center;">
        <strong>Depois</strong><br>
        <img src="${depois}" style="max-width:280px; border-radius:8px;">
      </div>
    `;

    modalFoto.classList.add("hidden");
  }

  // 🔥 CASO: só tem foto final
  else if (!antes && depois) {
    wrapper.style.display = "block";

    wrapper.innerHTML = `
      <div style="text-align:center;">
        <strong>Imagem</strong><br>
        <img src="${depois}" style="max-width:280px; border-radius:8px;">
      </div>
    `;

    modalFoto.classList.add("hidden");
  }

  // 🔥 CASO: só tem foto inicial
  else if (antes && !depois) {
    wrapper.style.display = "block";

    wrapper.innerHTML = `
      <div style="text-align:center;">
        <strong>Imagem</strong><br>
        <img src="${antes}" style="max-width:280px; border-radius:8px;">
      </div>
    `;

    modalFoto.classList.add("hidden");
  }

  // 🔥 CASO: nenhuma imagem
  else {
    wrapper.style.display = "block";
    wrapper.innerHTML = `<div class="empty-state">Sem imagens</div>`;
    modalFoto.classList.add("hidden");
  }
}

  // 🔹 ABRIR MODAL
  const modal = document.getElementById("detailModal");
  if (modal) modal.style.display = "flex";

  // 🔥 BOTÕES
  if (typeof atualizarBotoesStatus === "function") {
    atualizarBotoesStatus();
  }
}
function fecharModal() {
  const modal = document.getElementById("detailModal");
  if (!modal) return;

  modal.style.display = "none";

  // 🔄 limpa estado
  selectedTicket = null;

  // 🔓 libera scroll
  document.body.style.overflow = "";

  // 🧼 limpa imagem única (se existir)
  const modalFoto = document.getElementById("modalFoto");
  if (modalFoto) modalFoto.src = "";

  // 🧼 limpa container das imagens lado a lado
  const wrapper = document.getElementById("compareWrapper");
  if (wrapper) wrapper.innerHTML = "";
}

async function atualizarChamadoModal() {
  if (!selectedTicket) return;

  try {
    const novoStatus = document.getElementById("modalStatusSelect").value;
    const agora = new Date(); // 🔥 Firebase usa Date, não ISO

    const payload = {
      status: novoStatus
    };

    if (novoStatus === "Em andamento") {
      payload.data_inicio = selectedTicket.data_inicio || agora;
      payload.data_finalizacao = null;

    } else if (novoStatus === "Concluído") {
      payload.data_inicio = selectedTicket.data_inicio || agora;
      payload.data_finalizacao = agora;

    } else {
      payload.data_inicio = null;
      payload.data_finalizacao = null;
    }

    // 🔥 FIREBASE
   await updateDoc(
  doc(db, "chamados", selectedTicket.id),
  payload
);

fecharModal();

    // ⚠️ opcional — só se NÃO estiver usando realtime
    if (typeof carregarDados === "function") {
      await carregarDados();
    }

    alert("Chamado atualizado com sucesso.");

  } catch (error) {
    console.error("Erro ao atualizar:", error);
    alert("Erro ao atualizar chamado: " + error.message);
  }
}
async function carregarDados() {
  try {

const q = query(
  collection(db, "chamados"),
  orderBy("data_criacao", "desc"),
  
);

const snapshot = await getDocs(q);

ticketsCache.length = 0;

snapshot.docs.forEach(doc => {
  ticketsCache.push({
    id: doc.id,
    ...doc.data()
  });
});

    renderDashboard();
    renderTicketList();
    renderKanban();

    // 🔥 deep link seguro
    const chamadoId = typeof getChamadoDaURL === "function"
      ? getChamadoDaURL()
      : null;

    if (chamadoId) {
      const chamado = ticketsCache.find(c => c.id === chamadoId);

      if (chamado) {
        // 🔥 pequeno delay evita bug de DOM não renderizado
        setTimeout(() => abrirDetalhes(chamado.id), 100);
      }
    }

  } catch (err) {
    console.error("Erro ao carregar dados:", err);

    // 🔥 mensagem mais amigável
    alert("Não foi possível carregar os chamados. Verifique sua conexão.");
  }
}
window.getChamadoDaURL = function () {
  try {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    // 🔒 validação básica
    if (!id || id.trim() === "") return null;

    // 🔧 sanitiza (remove espaços)
    return id.trim();

  } catch (err) {
    console.warn("Erro ao ler URL:", err);
    return null;
  }
};
async function deletarPermanente(id) {
  const confirmar = confirm("Excluir definitivamente?");

  if (!confirmar) return;

  try {

   await deleteDoc(doc(db, "chamados", id));

    // 🔄 atualiza lixeira (se existir)
    if (typeof carregarLixeira === "function") {
      await carregarLixeira();
    }

  } catch (error) {
    console.error("Erro ao excluir:", error);
    alert("Erro ao excluir chamado: " + error.message);
  }
}
async function carregarLixeira() {
  try {

  const q = query(
  collection(db, "chamados"),
  where("excluido", "==", true),
  orderBy("data_criacao", "desc")
);

const snapshot = await getDocs(q);

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const container = document.getElementById("lixeiraList");
    if (!container) return;

    if (!data.length) {
      container.innerHTML = `<div class="empty-state">Nenhum item na lixeira.</div>`;
      return;
    }

    container.innerHTML = data.map(c => `
      <div class="ticket-card">

        <strong>${escapeHtml(c.unidade)} - ${escapeHtml(c.setor)}</strong>

        <p>${escapeHtml(c.descricao || "")}</p>

        <button class="btn btn-primary" data-restore="${c.id}">
          ♻️ Restaurar
        </button>

        <button class="btn btn-danger" data-delete="${c.id}">
          ❌ Excluir definitivo
        </button>

      </div>
    `).join("");

    // 🔥 eventos (melhor que onclick inline)
    container.querySelectorAll("[data-restore]").forEach(btn => {
      btn.addEventListener("click", () => {
        restaurarChamado(btn.dataset.restore);
      });
    });

    container.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", () => {
        deletarPermanente(btn.dataset.delete);
      });
    });

  } catch (error) {
    console.error("Erro ao carregar lixeira:", error);
    alert("Erro ao carregar lixeira");
  }
}
async function restaurarChamado(id) {
  if (!id) {
    alert("ID inválido");
    return;
  }

  try {

  await updateDoc(
  doc(db, "chamados", id),
  { excluido: false }
);

    // 🔄 atualiza lixeira
    if (typeof carregarLixeira === "function") {
      await carregarLixeira();
    }

    // 🔄 atualiza lista principal (opcional se tiver realtime)
    if (typeof carregarDados === "function") {
      await carregarDados();
    }

  } catch (error) {
    console.error("Erro ao restaurar:", error);
    alert("Erro ao restaurar chamado: " + error.message);
  }
}
function registerPWA() {
  // ❌ navegador não suporta
  if (!("serviceWorker" in navigator)) return;

  // ❌ evita erro comum (file:// ou origem inválida)
  if (!window.location.origin || window.location.origin === "null") {
    console.warn("Service Worker não pode rodar em origem inválida.");
    return;
  }

  window.addEventListener("load", async () => {
    try {

      // 🔍 verifica se já existe SW
      const existing = await navigator.serviceWorker.getRegistration();

      if (existing) {
        console.log("Service Worker já registrado:", existing.scope);

        // 🔄 força atualização
        existing.update();
        return;
      }

      // 🔥 registra novo
      const reg = await navigator.serviceWorker.register("./service-worker.js", {
        scope: "./"
      });

      console.log("Service Worker registrado:", reg.scope);

      // 🔄 detecta atualização
      reg.onupdatefound = () => {
        const newWorker = reg.installing;

        newWorker.onstatechange = () => {
          if (newWorker.state === "installed") {
            if (navigator.serviceWorker.controller) {
              console.log("Nova versão disponível!");
            } else {
              console.log("Conteúdo cacheado para uso offline.");
            }
          }
        };
      };

    } catch (err) {
      console.error("Erro ao registrar Service Worker:", err);
    }
  });
}
function exportarListaPDF() {
  try {

    const tickets = typeof getFilteredTickets === "function"
      ? getFilteredTickets()
      : [];

    if (!tickets.length) {
      alert("Não há chamados para exportar.");
      return;
    }

    const rows = tickets.map(ticket => `
      <tr>
        <td>${escapeHtml(ticket.id)}</td>
        <td>${escapeHtml(ticket.nome || "")}</td>
        <td>${escapeHtml(ticket.unidade || "")}</td>
        <td>${escapeHtml(ticket.setor || "")}</td>
        <td>${escapeHtml(ticket.setor_problema || "")}</td>
        <td>${escapeHtml(ticket.tipo_manutencao || "")}</td>
        <td>${escapeHtml(ticket.gravidade || "")}</td>
        <td>${escapeHtml(ticket.status || "")}</td>
        <td>${escapeHtml(formatDateTime(ticket.data_criacao))}</td>
        <td>${escapeHtml(formatDateTime(ticket.data_inicio))}</td>
        <td>${escapeHtml(formatDateTime(ticket.data_finalizacao))}</td>
      </tr>
    `).join("");

    const popup = window.open("", "_blank");

    if (!popup) {
      alert("Libere pop-ups para exportar o PDF.");
      return;
    }

    popup.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Lista de Chamados</title>

        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #0f172a;
          }

          h1 {
            margin-bottom: 4px;
          }

          p {
            margin-bottom: 12px;
            color: #475569;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }

          th, td {
            border: 1px solid #cbd5e1;
            padding: 6px;
            text-align: left;
            vertical-align: top;
          }

          th {
            background: #e2e8f0;
          }

          tr {
            page-break-inside: avoid;
          }

          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        </style>
      </head>

      <body>
        <h1>Lista de Chamados de Engenharia</h1>
        <p>Exportado em ${new Date().toLocaleString("pt-BR")}</p>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Solicitante</th>
              <th>Unidade</th>
              <th>Setor</th>
              <th>Problema</th>
              <th>Manutenção</th>
              <th>Prioridade</th>
              <th>Status</th>
              <th>Criação</th>
              <th>Início</th>
              <th>Finalização</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            setTimeout(() => window.print(), 300);
          };
        </script>
      </body>
      </html>
    `);

    popup.document.close();

  } catch (error) {
    console.error("Erro ao exportar PDF:", error);
    alert("Erro ao exportar PDF");
  }
}
function bindFilters() {
	
  const ids = ["busca", "filtroStatus", "filtroGravidade", "filtroSetor"];

  const aplicarFiltros = debounce(() => {
    renderTicketList();
    renderKanban();
  }, 300); // 🔥 evita excesso de render

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    // 🔄 evita duplicar eventos
    el.removeEventListener("input", el._handler);
    el.removeEventListener("change", el._handler);

    el._handler = aplicarFiltros;

    // 🔥 usa apenas um listener eficiente
    el.addEventListener("input", el._handler);
  });
}
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
document.addEventListener("DOMContentLoaded", () => {
	configurarInstalacaoPWA();
  // 🔧 binds
  bindViewButtons?.();
  bindFilters?.();
  registerPWA?.();
  document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-delete]");
  if (!btn) return;

  const id = btn.dataset.delete;
  excluirChamado(id);
});

window.OneSignalDeferred = window.OneSignalDeferred || [];

OneSignalDeferred.push(async function(OneSignal) {

  // 🔔 verifica permissão
  const permission = OneSignal.Notifications.permission;

  if (permission === "granted") {
    await OneSignal.User.addTag("usuario_ativo", "true");
  }

  // 🔄 listener automático
  OneSignal.Notifications.addEventListener("permissionChange", async (permission) => {
    if (permission === "granted") {
      await OneSignal.User.addTag("usuario_ativo", "true");
    } else {
      await OneSignal.User.addTag("usuario_ativo", "false");
    }
  });

});


document.getElementById("btnConfirmarFinalizacao")
  ?.addEventListener("click", confirmarFinalizacao);
document.querySelectorAll(".kanban-header").forEach(header => {
  header.addEventListener("click", (event) => {
    const id = header.dataset.coluna;
    toggleColuna(event, id);
  });
});
const btnFechar = document.getElementById("btnFecharModal");

if (btnFechar) {
  btnFechar.addEventListener("click", fecharModal);
}
  // 📝 formulário
  const form = document.getElementById("ticketForm");
  if (form) {
    form.addEventListener("submit", salvarChamado);
  }
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  switch (action) {
    case "iniciar":
      iniciarChamado();
      break;

    case "pausar":
      pausarChamado();
      break;

    case "retomar":
      retomarChamado();
      break;

    case "finalizar":
      abrirModalFinalizar();
      break;
  }
});
  // 📊 tela inicial
  switchView?.("dashboard");

  // 🔥 FIREBASE REALTIME (substitui carregarDados)
  if (typeof escutarChamadosSeguro === "function") {
    escutarChamadosSeguro();
  } else {
    // fallback
    carregarDados?.();
  }
document.addEventListener("click", (e) => {

  const btn = e.target.closest(".btn-detalhes");
  if (!btn) return;

  abrirDetalhes(btn.dataset.id);
});
});
// 🔥 EXPORTAR RELATÓRIO MENSAL (CORRIGIDO)
async function exportarRelatorioMensal() {
  try {

    // 🔥 BUSCAR CHAMADOS (FIREBASE)
    const snapshot = await getDocs(collection(db, "chamados"));

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const hoje = new Date();
    const mes = hoje.getMonth();
    const ano = hoje.getFullYear();

    const chamadosMes = data.filter(c => {
      if (!c.data_criacao) return false;

      const d = c.data_criacao.toDate
        ? c.data_criacao.toDate()
        : new Date(c.data_criacao);

      return (
        d.getMonth() === mes &&
        d.getFullYear() === ano &&
        c.status === "Concluído" &&
        c.excluido !== true
      );
    });

    if (!chamadosMes.length) {
      alert("Nenhum chamado concluído neste mês.");
      return;
    }

    // 🔥 BUSCAR TEMPOS
   const snapshotTempos = await getDocs(
  collection(db, "chamado_tempo")
);

   const temposTodos = snapshotTempos.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("landscape");

    const CUSTO_HORA = 81;

    let custoTotal = 0;
    const custoPorLoja = {};
    const chamadosPorLoja = {};
    const chamadosPorSetor = {};
    const custoPorSetor = {};

    const linhas = [];

    for (const c of chamadosMes) {

      const tempos = temposTodos.filter(t => t.chamado_id === c.id);

      let duracao = 0;
      let pausa = 0;

      if (tempos.length > 0) {
        for (let i = 0; i < tempos.length; i++) {
          const atual = tempos[i];

          // ⏱️ TEMPO TRABALHADO
          if (atual.inicio && atual.fim) {
            duracao += (
              (new Date(atual.fim) - new Date(atual.inicio)) /
              (1000 * 60 * 60)
            );
          }

          // ⏸️ PAUSA
          const proximo = tempos[i + 1];
          if (atual.fim && proximo?.inicio) {
            pausa += (
              (new Date(proximo.inicio) - new Date(atual.fim)) /
              (1000 * 60 * 60)
            );
          }
        }
      }

      const custo = duracao * CUSTO_HORA;
      custoTotal += custo;

      // 📊 LOJA
      custoPorLoja[c.unidade] = (custoPorLoja[c.unidade] || 0) + custo;
      chamadosPorLoja[c.unidade] = (chamadosPorLoja[c.unidade] || 0) + 1;

      // 📊 SETOR
      chamadosPorSetor[c.setor] = (chamadosPorSetor[c.setor] || 0) + 1;
      custoPorSetor[c.setor] = (custoPorSetor[c.setor] || 0) + custo;

      // 📋 LINHAS
      linhas.push([
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
        pausa ? formatarHoras(pausa) : "",
        "Equipe",
        `R$ ${CUSTO_HORA}`,
        custo ? `R$ ${custo.toFixed(2)}` : "",
        c.descricao || ""
      ]);
    }

    // 📄 PÁGINA 1
    doc.setFontSize(18);
    doc.text("RELATÓRIO MENSAL - CHAMADOS CONCLUÍDOS", 14, 20);

    doc.setFontSize(12);
    doc.text(`Mês: ${mes + 1}/${ano}`, 14, 30);
    doc.text(`Total: ${chamadosMes.length}`, 14, 40);
    doc.text(`CUSTO TOTAL: R$ ${custoTotal.toFixed(2)}`, 14, 50);

    const ranking = Object.entries(custoPorLoja)
      .sort((a, b) => b[1] - a[1])
      .map(([loja, valor]) => [loja, `R$ ${valor.toFixed(2)}`]);

    doc.autoTable({
      startY: 60,
      head: [["Loja", "Custo Total"]],
      body: ranking
    });

    // 📄 PÁGINA 2
    doc.addPage();

    const resumo = Object.keys(chamadosPorLoja).map(loja => [
      loja,
      chamadosPorLoja[loja],
      `R$ ${custoPorLoja[loja].toFixed(2)}`
    ]);

    doc.text("Resumo por Loja", 14, 20);

    doc.autoTable({
      startY: 25,
      head: [["Loja", "Qtd", "Custo"]],
      body: resumo
    });

    // 📄 PÁGINA 3
    doc.addPage();

    const resumoSetor = Object.keys(chamadosPorSetor).map(setor => [
      setor,
      chamadosPorSetor[setor],
      `R$ ${custoPorSetor[setor].toFixed(2)}`
    ]);

    doc.text("Resumo por Setor", 14, 20);

    doc.autoTable({
      startY: 25,
      head: [["Setor", "Qtd", "Custo"]],
      body: resumoSetor
    });

    // 📄 PÁGINA 4
    doc.addPage();

    doc.text("Detalhamento dos Chamados", 14, 20);

    doc.autoTable({
      startY: 25,
      head: [[
        "ID","Solicitante","Unidade","Setor","Problema","Tipo",
        "Gravidade","Status","Criação","Início","Final",
        "Duração","Pausa","Equipe","Custo Hora","Custo","Descrição"
      ]],
      body: linhas,
      styles: { fontSize: 6 },
      columnStyles: { 16: { cellWidth: 50 } }
    });

    doc.save(`Relatorio_${mes + 1}_${ano}.pdf`);

  } catch (err) {
    console.error(err);
    alert("Erro ao gerar relatório.");
  }
}
function atualizarBotoesStatus() {
  if (!selectedTicket) return;

  // 🔤 normaliza status (remove acento + lowercase)
  const status = (selectedTicket.status || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const btnIniciar = document.getElementById("btnIniciar");
  const btnPausar = document.getElementById("btnPausar");
  const btnRetomar = document.getElementById("btnRetomar");
  const btnFinalizar = document.getElementById("btnFinalizar");

  const botoes = {
    iniciar: btnIniciar,
    pausar: btnPausar,
    retomar: btnRetomar,
    finalizar: btnFinalizar
  };

  // 🔥 função helper
  const mostrar = (btn) => btn && (btn.style.display = "flex");
  const esconder = (btn) => btn && (btn.style.display = "none");

  // 🔄 esconde todos primeiro
  Object.values(botoes).forEach(esconder);

  // 🔥 regras
  switch (status) {
    case "aberto":
      mostrar(botoes.iniciar);
      break;

    case "em andamento":
    case "andamento":
      mostrar(botoes.pausar);
      mostrar(botoes.finalizar);
      break;

    case "pausado":
      mostrar(botoes.retomar);
      break;

    // concluído → não mostra nada
  }
}
 // ✅ INICIAR
async function iniciarChamado() {
  try {
    if (!selectedTicket) return;

    const idChamado = selectedTicket.id;
    const agora = new Date(); // 🔥 Firebase usa Date

    // 🔥 inserir tempo
  await addDoc(collection(db, "chamado_tempo"), {
  chamado_id: idChamado,
  inicio: agora,
  fim: null
});

    // 🔥 atualizar chamado
  await updateDoc(doc(db, "chamados", idChamado), {
  status: "Em andamento",
  data_inicio: selectedTicket?.data_inicio || agora
});

    fecharModal();

    // ⚠️ opcional se NÃO usar realtime
    if (typeof carregarDados === "function") {
      await carregarDados();
    }

    alert("▶️ Chamado iniciado!");

   
  } catch (err) {
    console.error(err);
    alert("Erro ao iniciar chamado.");
  }
}

 // ✅ PAUSAR
async function pausarChamado() {
  try {
    if (!selectedTicket?.id) {
      alert("Chamado inválido");
      return;
    }

    const idChamado = selectedTicket.id;

    const q = query(
      collection(db, "chamado_tempo"),
      where("chamado_id", "==", idChamado),
      where("fim", "==", null),
     
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      alert("⚠️ Nenhum período em andamento.");
      return;
    }

    const docPeriodo = snapshot.docs[0];

    await updateDoc(doc(db, "chamado_tempo", docPeriodo.id), {
      fim: serverTimestamp()
    });

    await updateDoc(doc(db, "chamados", idChamado), {
      status: "Pausado"
    });

    fecharModal();

    if (typeof carregarDados === "function") {
      await carregarDados();
    }

    alert("⏸️ Chamado pausado com sucesso!");
	
  } catch (err) {
    console.error("Erro ao pausar:", err);
    alert("Erro inesperado ao pausar.");
  }
}
 // ✅ RETOMAR
async function retomarChamado() {
  try {
    if (!selectedTicket?.id) {
      alert("Chamado inválido");
      return;
    }

    const idChamado = selectedTicket.id;
    const agora = new Date();

    // 🔍 fecha qualquer período aberto antes
    const snapshot = await getDocs(
      query(
        collection(db, "chamado_tempo"),
        where("chamado_id", "==", idChamado),
        where("fim", "==", null)
      )
    );

    const batch = writeBatch(db);

    snapshot.forEach(docSnap => {
      batch.update(doc(db, "chamado_tempo", docSnap.id), {
        fim: agora
      });
    });

    await batch.commit();

    // 🔄 atualiza status
    await updateDoc(doc(db, "chamados", idChamado), {
      status: "Em andamento"
    });

    // ▶️ abre novo período (APENAS UMA VEZ)
    await addDoc(collection(db, "chamado_tempo"), {
      chamado_id: idChamado,
      inicio: agora,
      fim: null
    });

    fecharModal();

    if (typeof carregarDados === "function") {
      await carregarDados();
    }

    alert("▶️ Chamado retomado com sucesso!");

  } catch (err) {
    console.error("Erro ao retomar:", err);
    alert("Erro ao retomar chamado.");
  }
}

async function finalizarChamado() {
  try {
    if (!selectedTicket) return;

    const idChamado = selectedTicket.id;

    // 🔍 buscar períodos abertos
    const q = query(
      collection(db, "chamado_tempo"),
      where("chamado_id", "==", idChamado),
      where("fim", "==", null)
    );

    const snapshot = await getDocs(q);

    // 🔥 fechar todos os períodos abertos
    if (!snapshot.empty) {
      const batch = writeBatch(db);

      snapshot.forEach((docItem) => {
        batch.update(docItem.ref, {
          fim: serverTimestamp()
        });
      });

      await batch.commit();
    }

    // 🔄 atualizar chamado
    await updateDoc(
      doc(db, "chamados", idChamado),
      {
        status: "Concluído",
        data_finalizacao: serverTimestamp()
      }
    );

    fecharModal();

    // 🔄 recarregar dados (se não usar realtime)
    if (typeof carregarDados === "function") {
      await carregarDados();
    }

    alert("✅ Chamado finalizado!");

  } catch (err) {
    console.error("Erro ao finalizar:", err);
    alert("Erro ao finalizar chamado.");
  }
}

// 🔥 CALCULAR TEMPO REAL
async function calcularDuracaoReal(chamadoId) {
  try {
    if (!chamadoId) return 0;

    const q = query(
      collection(db, "chamado_tempo"),
      where("chamado_id", "==", chamadoId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return 0;

    let totalMs = 0;

    snapshot.forEach((docItem) => {
      const t = docItem.data();

      if (!t.inicio || !t.fim) return;

      const inicio = t.inicio.toDate
        ? t.inicio.toDate()
        : new Date(t.inicio);

      const fim = t.fim.toDate
        ? t.fim.toDate()
        : new Date(t.fim);

      totalMs += (fim.getTime() - inicio.getTime());
    });

    // 🔥 retorna em horas
    return Number((totalMs / (1000 * 60 * 60)).toFixed(2));

  } catch (err) {
    console.error("Erro ao calcular duração:", err);
    return 0;
  }
}
// notificações

let unsubscribeChamados = null;

function escutarChamadosSeguro() {
  try {

    // 🔥 remove listener anterior
    if (unsubscribeChamados) {
      unsubscribeChamados();
      unsubscribeChamados = null;
    }

    const q = query(
      collection(db, "chamados"),
      orderBy("data_criacao", "desc"),
      
    );

    unsubscribeChamados = onSnapshot(q, (snapshot) => {

      snapshot.docChanges().forEach(change => {

        const c = {
          id: change.doc.id,
          ...change.doc.data()
        };

         
        // 🚀 ATUALIZA CACHE LOCAL
        const index = ticketsCache.findIndex(t => t.id === c.id);

        if (index !== -1) {
          ticketsCache[index] = {
            ...ticketsCache[index],
            ...c
          };
        } else {
          ticketsCache.unshift(c);
        }

      });

      // 🔄 render (1 vez)
      renderDashboard();
      renderTicketList();
      renderKanban();

    });

  } catch (e) {
    console.warn("Erro realtime:", e);
  }
}

async function excluirChamado(id) {
  if (!id) {
    alert("ID inválido");
    return;
  }

  const confirmar = confirm("Deseja mover este chamado para a lixeira?");
  if (!confirmar) return;

  try {
    await updateDoc(doc(db, "chamados", id), {
      excluido: true,
      status: "Concluído",
      data_finalizacao: serverTimestamp()
    });

    console.log("✔ Atualizado:", id);

    if (typeof carregarDados === "function") {
      await carregarDados();
    }

  } catch (error) {
    console.error(error);
    alert("Erro ao excluir chamado: " + error.message);
  }
}
function formatarHoras(horasDecimal) {
  if (!horasDecimal || isNaN(horasDecimal)) return "—";

  let horas = Math.floor(horasDecimal);
  let minutos = Math.round((horasDecimal - horas) * 60);

  // 🔥 corrige caso minutos vire 60
  if (minutos === 60) {
    horas += 1;
    minutos = 0;
  }

  return `${horas}h ${minutos}min`;
}
function switchView(view, el = null) {

  const views = ["dashboard", "lista", "kanban", "lixeira", "novo"];

  // 🔒 valida view
  if (!views.includes(view)) {
    console.warn("View inválida:", view);
    return;
  }

  // 🔄 troca tela
  document.querySelectorAll(".view")
    .forEach(v => v.classList.add("hidden"));

  const target = document.getElementById(view + "View");
  if (target) {
    target.classList.remove("hidden");
  } else {
    console.warn("Elemento da view não encontrado:", view);
  }

  // 🎯 remove ativo
  const botoes = document.querySelectorAll(".menu-btn");
  botoes.forEach(btn => btn.classList.remove("active"));

  // 🎯 adiciona ativo
  if (el) {
    el.classList.add("active");
  } else {
    // 🔥 usa dataset ao invés de onclick
    const btn = document.querySelector(`.menu-btn[data-view-btn="${view}"]`);
    if (btn) btn.classList.add("active");
  }

  // 🔥 render inteligente
  const renderMap = {
    dashboard: renderDashboard,
    lista: renderTicketList,
    kanban: renderKanban,
    lixeira: carregarLixeira
  };

  if (typeof renderMap[view] === "function") {
    renderMap[view]();
  }
}
window.toggleColuna = function (event, id) {
  if (!event) return;

  const header = event.currentTarget;
  const lista = document.getElementById(id);

  if (!lista) {
    console.warn("Coluna não encontrada:", id);
    return;
  }

  const seta = header.querySelector(".seta");

  const isHidden = lista.classList.contains("hidden");

  if (isHidden) {
    lista.classList.remove("hidden");
    if (seta) seta.textContent = "⬆️";
  } else {
    lista.classList.add("hidden");
    if (seta) seta.textContent = "⬇️";
  }
};


async function restaurarParaConcluidos() {
  const confirmar = confirm("Restaurar TODOS os chamados da lixeira como CONCLUÍDOS?");
  if (!confirmar) return;

  try {
    const q = query(
      collection(db, "chamados"),
      where("excluido", "==", true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      alert("Nenhum chamado na lixeira.");
      return;
    }

    const docs = snapshot.docs;
    const total = docs.length;

    let processados = 0;
    const tamanhoLote = 400;

    // ⚠️ melhor que new Date()
    const agora = serverTimestamp();

    criarProgresso(total);

    for (let i = 0; i < total; i += tamanhoLote) {
      const batch = writeBatch(db);
      const lote = docs.slice(i, i + tamanhoLote);

      lote.forEach((docItem) => {
        batch.update(doc(db, "chamados", docItem.id), {
          excluido: false,
          status: "Concluído",
          data_finalizacao: agora
        });
      });

      await batch.commit();

      processados += lote.length;
      atualizarProgresso(processados, total);

      await new Promise(r => setTimeout(r, 50));
    }

    finalizarProgresso();

    alert(`✔ ${total} chamados restaurados com sucesso!`);

    await carregarLixeira?.();
    await carregarDados?.();

  } catch (error) {
    console.error(error);
    alert("Erro na restauração em massa.");
  }
}
function criarProgresso(total) {
  const div = document.createElement("div");
  div.id = "progressBox";

  div.innerHTML = `
    <div style="position:fixed;bottom:20px;left:20px;background:#fff;padding:12px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);z-index:9999;">
      <strong>Restaurando chamados...</strong>
      <div id="progressText">0 / ${total}</div>
      <div style="background:#eee;height:8px;border-radius:4px;margin-top:6px;">
        <div id="progressBar" style="height:8px;background:#28a745;width:0%;border-radius:4px;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(div);
}

function atualizarProgresso(atual, total) {
  const percent = (atual / total) * 100;

  document.getElementById("progressText").textContent = `${atual} / ${total}`;
  document.getElementById("progressBar").style.width = percent + "%";
}

function finalizarProgresso() {
  const box = document.getElementById("progressBox");
  if (box) box.remove();
}

function abrirModalFinalizar() {
  const modal = document.getElementById("modalFinalizar");
  if (!modal) return;

  modal.classList.add("show");

  // 🔒 trava scroll da página
  document.body.style.overflow = "hidden";

  // 🎯 foco no primeiro botão (UX)
  const btn = modal.querySelector("button");
  if (btn) btn.focus();
}

function fecharModalFinalizar() {
  const modal = document.getElementById("modalFinalizar");
  if (!modal) return;

  modal.classList.remove("show");

  // 🔓 libera scroll da página
  document.body.style.overflow = "";

  // 🧼 opcional: limpar campos do modal (se houver)
  const form = modal.querySelector("form");
  if (form) form.reset();

  // 🎯 devolve foco para o botão que abriu (se você guardar a referência)
  if (window.__lastFocusEl) {
    window.__lastFocusEl.focus();
    window.__lastFocusEl = null;
  }
}
let deferredPrompt = null;

function configurarInstalacaoPWA() {
  const btn = document.getElementById("installButton");
  if (!btn) return;

  // 🔥 captura evento de instalação
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // impede popup automático

    deferredPrompt = e;

    // mostra botão
    btn.classList.remove("hidden");

    console.log("PWA pode ser instalado");
  });

  // 🔥 clique no botão
  btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;

    console.log("Resultado instalação:", outcome);

    if (outcome === "accepted") {
      console.log("Usuário instalou o app 👍");
    } else {
      console.log("Usuário cancelou ❌");
    }

    deferredPrompt = null;
    btn.classList.add("hidden");
  });

  // 🔥 detecta se já está instalado
  window.addEventListener("appinstalled", () => {
    console.log("App instalado com sucesso 🎉");
    btn.classList.add("hidden");
  });
}


async function confirmarFinalizacao() {
  try {
    if (!selectedTicket?.id) {
      alert("Chamado inválido.");
      return;
    }

    const idChamado = selectedTicket.id;

    const inputFile = document.getElementById("fotoFinal");
    const file = inputFile?.files?.[0];

    let fotoFinalUrl = null;

    // 📸 upload opcional
    if (file) {
      console.log("📤 Enviando foto...");
      fotoFinalUrl = await uploadFoto(file);
      console.log("✅ URL:", fotoFinalUrl);
    }

    // 🔥 fechar períodos abertos
    const q = query(
      collection(db, "chamado_tempo"),
      where("chamado_id", "==", idChamado),
      where("fim", "==", null)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const batch = writeBatch(db);

      snapshot.forEach((docItem) => {
        batch.update(doc(db, "chamado_tempo", docItem.id), {
          fim: serverTimestamp()
        });
      });

      await batch.commit();
    }

    // 🔄 update chamado
    const updateData = {
      status: "Concluído",
      data_finalizacao: serverTimestamp()
    };

    if (fotoFinalUrl) {
      updateData.foto_final_url = fotoFinalUrl;
    }

    await updateDoc(
      doc(db, "chamados", idChamado),
      updateData
    );

    console.log("✔ Atualizado no Firebase:", idChamado);

    alert("✅ Chamado finalizado!");

    fecharModalFinalizar();
    fecharModal();

    if (inputFile) inputFile.value = "";

    if (typeof carregarDados === "function") {
      await carregarDados();
    }

  } catch (err) {
    console.error("Erro geral:", err);
    alert("Erro ao finalizar chamado");
  }
}
async function enviarNotificacao({ titulo, mensagem, url }) {
  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic os_v2_app_tyxrxtimw5flhgtl527qf3dmwximdzxkmyuufuuihowmvft2ku6m7e2m5nlbsgqnggxq3eu2frskvbvw2hoh5hzv4ggtrgvserm7f5q"
      },
      body: JSON.stringify({
        app_id: "9e2f1bcd-0cb7-4ab3-9a6b-eebf02ec6cb5",

        // 🔥 ESSENCIAL (QUEM RECEBE)
        filters: [
          { field: "tag", key: "usuario_ativo", relation: "=", value: "true" }
        ],

        headings: {
          pt: titulo,
          en: titulo
        },
        contents: {
          pt: mensagem,
          en: mensagem
        },

        url: url,

        chrome_web_icon: "https://cdn-icons-png.flaticon.com/512/1827/1827392.png",
        chrome_web_badge: "https://cdn-icons-png.flaticon.com/512/1827/1827392.png",

        priority: 10
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Erro OneSignal:", data);
      throw new Error(data.errors?.[0] || "Erro ao enviar notificação");
    }

    console.log("✅ Notificação enviada:", data.id);

  } catch (error) {
    console.error("🚨 Falha ao enviar push:", error.message);
  }
}
// ... todas suas funções acima ...
