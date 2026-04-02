let deferredPrompt = null;
let selectedTicket = null;
let ticketsCache = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTime(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString("pt-BR");
}

function statusClass(status) {
  if (status === "Em andamento") return "status-andamento";
  if (status === "Concluído") return "status-concluido";
  return "status-aberto";
}

function priorityClass(priority) {
  return {
    "Baixa": "priority-baixa",
    "Média": "priority-media",
    "Alta": "priority-alta",
    "Crítica": "priority-critica"
  }[priority] || "priority-baixa";
}

function switchView(view) {
  document.querySelectorAll(".view").forEach(el => el.classList.add("hidden"));
  document.getElementById(view + "View").classList.remove("hidden");

  document.querySelectorAll("[data-view-btn]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.viewBtn === view);
  });

  if (view === "lista") renderTicketList();
  if (view === "dashboard") renderDashboard();
}

function bindViewButtons() {
  document.querySelectorAll("[data-view-btn]").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.viewBtn));
  });
}

function abrirFormularioComSetor(setor) {
  switchView("novo");
  document.getElementById("setor").value = setor;
}

function resetarFormulario() {
  document.getElementById("ticketForm").reset();
}

async function uploadFoto(file) {
  if (!file) return null;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const fileName = "foto_" + Date.now() + "." + ext;

  const { error } = await supabase.storage
    .from("chamados-fotos")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg"
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("chamados-fotos")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

async function salvarChamado(event) {
  event.preventDefault();
  const submitBtn = event.target.querySelector("button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.textContent = "Salvando...";

  try {
    const file = document.getElementById("foto").files[0];
    const fotoUrl = await uploadFoto(file);

    const chamado = {
      id: "CH-" + Date.now(),
      nome: document.getElementById("nome").value.trim(),
      unidade: document.getElementById("unidade").value.trim(),
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

    const { error } = await supabase.from("chamados").insert([chamado]);
    if (error) throw error;

    alert("Chamado salvo com sucesso.");
    resetarFormulario();
    await carregarDados();
    switchView("lista");
  } catch (error) {
    alert("Erro ao salvar chamado: " + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Salvar chamado";
  }
}

function getFilteredTickets() {
  const busca = document.getElementById("busca")?.value.toLowerCase().trim() || "";
  const filtroStatus = document.getElementById("filtroStatus")?.value || "";
  const filtroGravidade = document.getElementById("filtroGravidade")?.value || "";
  const filtroSetor = document.getElementById("filtroSetor")?.value || "";

  return ticketsCache.filter(ticket => {
    const target = [
      ticket.id, ticket.nome, ticket.unidade, ticket.setor, ticket.setor_problema,
      ticket.tipo_manutencao, ticket.descricao
    ].join(" ").toLowerCase();

    return (!busca || target.includes(busca))
      && (!filtroStatus || ticket.status === filtroStatus)
      && (!filtroGravidade || ticket.gravidade === filtroGravidade)
      && (!filtroSetor || ticket.setor === filtroSetor);
  });
}

function renderMetrics() {
  document.getElementById("metricTotal").textContent = ticketsCache.length;
  document.getElementById("metricAbertos").textContent = ticketsCache.filter(t => t.status === "Aberto").length;
  document.getElementById("metricAndamento").textContent = ticketsCache.filter(t => t.status === "Em andamento").length;
  document.getElementById("metricConcluidos").textContent = ticketsCache.filter(t => t.status === "Concluído").length;
}

function renderRecentList() {
  const list = document.getElementById("recentList");
  const recent = ticketsCache.slice(0, 4);

  if (!recent.length) {
    list.innerHTML = '<div class="empty-state">Nenhum chamado recente encontrado.</div>';
    return;
  }

  list.innerHTML = recent.map(item => `
    <article class="recent-item">
      <strong>${escapeHtml(item.unidade)} • ${escapeHtml(item.setor)}</strong>
      <span>${escapeHtml(item.status)} • ${formatDateTime(item.data_criacao)}</span>
    </article>
  `).join("");
}

function renderDashboard() {
  renderMetrics();
  renderRecentList();
}

function renderTicketList() {
  const list = document.getElementById("ticketList");
  const filtered = getFilteredTickets();

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">Nenhum chamado encontrado com os filtros atuais.</div>';
    return;
  }

  list.innerHTML = filtered.map(ticket => `
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
        <button class="btn btn-secondary" onclick="abrirDetalhes('${escapeHtml(ticket.id)}')">Detalhes</button>
      </div>
    </article>
  `).join("");
}

function abrirDetalhes(id) {
  const ticket = ticketsCache.find(t => t.id === id);
  if (!ticket) return;

  selectedTicket = ticket;
  document.getElementById("modalTicketId").textContent = ticket.id;
  document.getElementById("modalStatusSelect").value = ticket.status || "Aberto";
  document.getElementById("modalDescricao").textContent = ticket.descricao || "";

  const detailGrid = document.getElementById("detailGrid");
  const fields = [
    ["Solicitante", ticket.nome],
    ["Unidade", ticket.unidade],
    ["Setor", ticket.setor],
    ["Setor do problema", ticket.setor_problema],
    ["Tipo de manutenção", ticket.tipo_manutencao],
    ["Gravidade", ticket.gravidade],
    ["Status", ticket.status],
    ["Data da criação", formatDateTime(ticket.data_criacao)],
    ["Data de início", formatDateTime(ticket.data_inicio)],
    ["Data de finalização", formatDateTime(ticket.data_finalizacao)]
  ];

  detailGrid.innerHTML = fields.map(([label, value]) => `
    <div class="detail-box">
      <strong>${escapeHtml(label)}</strong>
      <div>${escapeHtml(value || "—")}</div>
    </div>
  `).join("");

  const modalFoto = document.getElementById("modalFoto");
  if (ticket.foto_url) {
    modalFoto.src = ticket.foto_url;
    modalFoto.classList.remove("hidden");
  } else {
    modalFoto.classList.add("hidden");
  }

  document.getElementById("detailModal").showModal();
}

function fecharModal() {
  document.getElementById("detailModal").close();
}

async function atualizarStatusModal() {
  if (!selectedTicket) return;

  const novoStatus = document.getElementById("modalStatusSelect").value;
  const agora = new Date().toISOString();
  const updateData = { status: novoStatus };

  if (novoStatus === "Em andamento") {
    updateData.data_inicio = selectedTicket.data_inicio || agora;
    updateData.data_finalizacao = null;
  } else if (novoStatus === "Concluído") {
    updateData.data_inicio = selectedTicket.data_inicio || agora;
    updateData.data_finalizacao = agora;
  } else {
    updateData.data_inicio = null;
    updateData.data_finalizacao = null;
  }

  const { error } = await supabase
    .from("chamados")
    .update(updateData)
    .eq("id", selectedTicket.id);

  if (error) {
    alert("Erro ao atualizar status: " + error.message);
    return;
  }

  fecharModal();
  await carregarDados();
  alert("Status atualizado com sucesso.");
}

async function carregarDados() {
  const { data, error } = await supabase
    .from("chamados")
    .select("*")
    .order("data_criacao", { ascending: false });

  if (error) {
    alert("Erro ao carregar dados: " + error.message);
    return;
  }

  ticketsCache = Array.isArray(data) ? data : [];
  renderDashboard();
  renderTicketList();
}

function exportarListaPDF() {
  const tickets = getFilteredTickets();
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
        body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
        h1 { margin: 0 0 8px; }
        p { color: #475569; margin: 0 0 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #e2e8f0; }
        @page { size: A4 landscape; margin: 12mm; }
      </style>
    </head>
    <body>
      <h1>Lista de Chamados de Engenharia</h1>
      <p>Exportado em ${new Date().toLocaleString("pt-BR")}</p>
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Solicitante</th><th>Unidade</th><th>Setor</th><th>Problema</th>
            <th>Manutenção</th><th>Prioridade</th><th>Status</th><th>Criação</th><th>Início</th><th>Finalização</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <script>window.onload = () => window.print();<\/script>
    </body>
    </html>
  `);
  popup.document.close();
}

function bindFilters() {
  ["busca", "filtroStatus", "filtroGravidade", "filtroSetor"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", renderTicketList);
    el.addEventListener("change", renderTicketList);
  });
}

function registerPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js");
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    document.getElementById("installButton").classList.remove("hidden");
  });

  document.getElementById("installButton").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById("installButton").classList.add("hidden");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindViewButtons();
  bindFilters();
  registerPWA();
  document.getElementById("ticketForm").addEventListener("submit", salvarChamado);
  switchView("dashboard");
  carregarDados();
});
