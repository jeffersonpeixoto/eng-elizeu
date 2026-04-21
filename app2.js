let deferredPrompt=null;let selectedTicket=null;let ticketsCache=[];
function escapeHtml(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function formatDateTime(v){if(!v)return "—";const d=new Date(v);if(Number.isNaN(d.getTime()))return v;return d.toLocaleString("pt-BR")}
function statusClass(s){if(s==="Em andamento")return "status-andamento";if(s==="Concluído")return "status-concluido";return "status-aberto"}
function priorityClass(p){return {"Baixa":"priority-baixa","Média":"priority-media","Alta":"priority-alta","Crítica":"priority-critica"}[p]||"priority-baixa"}

function switchView(view){document.querySelectorAll(".view").forEach(el=>el.classList.add("hidden"));document.getElementById(view+"View").classList.remove("hidden");document.querySelectorAll("[data-view-btn]").forEach(btn=>btn.classList.toggle("active",btn.dataset.viewBtn===view));if(view==="dashboard")renderDashboard();if(view==="lista")renderTicketList();if(view==="kanban")renderKanban()}
function bindViewButtons(){document.querySelectorAll("[data-view-btn]").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.viewBtn)))}
function resetarFormulario(){document.getElementById("ticketForm").reset()}
function compressImageSafe(file) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target.result;
      };

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");

          const maxWidth = 800;
          const scale = Math.min(1, maxWidth / img.width);

          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob); // ✅ comprimido
              } else {
                resolve(file); // ⚠️ fallback
              }
            },
            "image/webp",
            0.7
          );
        } catch {
          resolve(file);
        }
      };

      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);

    } catch {
      resolve(file);
    }
  });
}
async function uploadFoto(file) {
  if (!file) return null;

  // 🔥 tenta comprimir, mas não quebra se falhar
  const finalFile = await compressImageSafe(file);

  const formData = new FormData();
  formData.append("file", finalFile);
  formData.append("upload_preset", "uploads_public");

  const res = await fetch("https://api.cloudinary.com/v1_1/dprkzdmqt/image/upload", {
    method: "POST",
    body: formData
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.secure_url;
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

async function salvarChamado(event){
  event.preventDefault();

  const btn = event.target.querySelector("button[type='submit']");
  btn.disabled = true;
  btn.textContent = "Salvando...";

  try {

    // 👇 AQUI É O LUGAR CERTO
    const file = document.getElementById("foto").files[0];

    let fotoUrl = null;

    if (file) {
      fotoUrl = await uploadFoto(file);
    }

    const chamado = {
      id: "CH-" + Date.now(),
      nome: document.getElementById("nome").value.trim(),
      unidade: document.getElementById("unidade").value,
      setor: document.getElementById("setor").value,
      setor_problema: document.getElementById("setorProblema").value.trim(),
      tipo_manutencao: document.getElementById("tipoManutencao").value,
      gravidade: document.getElementById("gravidade").value,
      descricao: document.getElementById("descricao").value.trim(),
      foto_url: fotoUrl, // 👈 já tratado
      status: "Aberto",
      data_criacao: new Date().toISOString(),
      data_inicio: null,
      data_finalizacao: null
    };

    const { error } = await window.supabaseClient
      .from("chamados")
      .insert([chamado]);

    if (error) throw error;

    alert("Chamado salvo com sucesso!");
	// 🔥 AQUI É O SEGREDO
resetarFormulario();
await carregarDados();
switchView("lista");

  } catch (error) {
    console.error(error);
    alert("Erro: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Salvar chamado";
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
	<button class="btn btn-secondary" id="detal" onclick="abrirDetalhes('${ticket.id}')">  Detalhes </button>
	</div>
	<div class="ticket-aside">
	<div class="date-chip">
	<strong>Criação:</strong><br>${formatDateTime(ticket.data_criacao)}
	</div>
	<div class="date-chip"><strong>Início:</strong><br>${formatDateTime(ticket.data_inicio)}</div>
	<div class="date-chip"><strong>Finalização:</strong><br>${formatDateTime(ticket.data_finalizacao)}</div>
	

${ticket.status === "Concluído" ? `
  <button class="btn btn-danger"  onclick="excluirChamado('${ticket.id}')">
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

// foto + comparador
const antes = ticket.foto_url;
const depois = ticket.foto_final_url;

const modalFoto = document.getElementById("modalFoto");
const wrapper = document.getElementById("compareWrapper");

if (antes && depois) {
  // 🔥 mostra slider
  wrapper.style.display = "block";
  modalFoto.classList.add("hidden");

  document.getElementById("imgAntes").src = antes;
  document.getElementById("imgDepois").src = depois;

  setTimeout(iniciarSlider, 100);

} else {
  // 👉 fallback (só uma imagem)
  wrapper.style.display = "none";

  if (antes) {
    modalFoto.src = antes;
    modalFoto.classList.remove("hidden");
  } else {
    modalFoto.classList.add("hidden");
  }
}

  document.getElementById("detailModal").style.display = "flex";

  // 🔥 IMPORTANTE (botões)
  atualizarBotoesStatus();
}
function fecharModal(){
  document.getElementById("detailModal").style.display = "none";
}

async function atualizarChamadoModal(){if(!selectedTicket)return;const novoStatus=document.getElementById("modalStatusSelect").value;const agora=new Date().toISOString();const payload={status:novoStatus};if(novoStatus==="Em andamento"){payload.data_inicio=selectedTicket.data_inicio||agora;payload.data_finalizacao=null}else if(novoStatus==="Concluído"){payload.data_inicio=selectedTicket.data_inicio||agora;payload.data_finalizacao=agora}else{payload.data_inicio=null;payload.data_finalizacao=null}const {error}=await window.supabaseClient.from("chamados").update(payload).eq("id",selectedTicket.id);if(error){alert("Erro ao atualizar chamado: "+error.message);return}fecharModal();await carregarDados();alert("Chamado atualizado com sucesso.")}

async function carregarDados() {
  try {
   const { data, error } = await window.supabaseClient
  .from("chamados")
  .select("*")
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

    // 🔥 AQUI COMEÇA A PARTE NOVA
    const chamadoId = getChamadoDaURL();

    if (chamadoId) {
      const chamado = ticketsCache.find(c => c.id == chamadoId);

      if (chamado) {
        abrirDetalhesChamado(chamado);

        // 🔥 DESTACA E ROLA
        setTimeout(() => {
          const el = document.querySelector(`[data-id="${chamado.id}"]`);
          if (el) {
            el.style.border = "3px solid red";
            el.scrollIntoView({ behavior: "smooth" });
          }
        }, 500);
      }
    }
    // 🔥 AQUI TERMINA

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
        await navigator.serviceWorker.register("service-worker.js", {  scope: "./"});
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

 await carregarDados();
switchView("dashboard");

  

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

    const chamadosMes = data.filter(c => {
      if (!c.data_criacao) return false;

      const d = new Date(c.data_criacao);

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

      // 🔥 BUSCAR TEMPOS ORDENADOS
      const { data: tempos } = await window.supabaseClient
        .from("chamado_tempo")
        .select("*")
        .eq("chamado_id", c.id)
        .order("inicio", { ascending: true });

      let duracao = 0;
      let pausa = 0;

      if (tempos && tempos.length > 0) {
        for (let i = 0; i < tempos.length; i++) {
          const atual = tempos[i];

          // ⏱️ TEMPO TRABALHADO
          if (atual.inicio && atual.fim) {
            duracao += (new Date(atual.fim) - new Date(atual.inicio)) / (1000 * 60 * 60);
          }

          // ⏸️ TEMPO DE PAUSA
          const proximo = tempos[i + 1];
          if (atual.fim && proximo && proximo.inicio) {
            pausa += (new Date(proximo.inicio) - new Date(atual.fim)) / (1000 * 60 * 60);
          }
        }
      }

      const custo = duracao * CUSTO_HORA;
      custoTotal += custo;

      // 📊 AGRUPAMENTO LOJA
      if (!custoPorLoja[c.unidade]) custoPorLoja[c.unidade] = 0;
      custoPorLoja[c.unidade] += custo;

      if (!chamadosPorLoja[c.unidade]) chamadosPorLoja[c.unidade] = 0;
      chamadosPorLoja[c.unidade]++;

      // 📊 AGRUPAMENTO SETOR
      if (!chamadosPorSetor[c.setor]) {
        chamadosPorSetor[c.setor] = 0;
        custoPorSetor[c.setor] = 0;
      }

      chamadosPorSetor[c.setor]++;
      custoPorSetor[c.setor] += custo;

      // 📋 LINHAS DO PDF
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

    // 🧾 PÁGINA 1
    doc.setFontSize(18);
    doc.text("RELATÓRIO MENSAL - CHAMADOS CONCLUÍDOS", 14, 20);

    doc.setFontSize(12);
    doc.text(`Mês: ${mes + 1}/${ano}`, 14, 30);
    doc.text(`Total concluídos: ${chamadosMes.length}`, 14, 40);
    doc.text(`CUSTO TOTAL: R$ ${custoTotal.toFixed(2)}`, 14, 50);

    const ranking = Object.entries(custoPorLoja)
      .sort((a, b) => b[1] - a[1])
      .map(([loja, valor]) => [loja, `R$ ${valor.toFixed(2)}`]);

    doc.autoTable({
      startY: 60,
      head: [["Loja", "Custo Total"]],
      body: ranking
    });

    // 📊 PÁGINA 2
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

    // 📊 PÁGINA 3
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

    // 📋 PÁGINA 4
    doc.addPage();

    doc.text("Detalhamento dos Chamados Concluídos", 14, 20);

    doc.autoTable({
      startY: 25,
      head: [[
        "ID","Solicitante","Unidade","Setor","Problema","Tipo",
        "Gravidade","Status","Criação","Início","Final",
        "Duração (h)","Pausa (h)","Equipe","Custo Hora","Custo","Descrição"
      ]],
      body: linhas,
      styles: { fontSize: 6 },
      columnStyles: {
        16: { cellWidth: 50 }
      }
    });

    doc.save(`Relatorio_Concluidos_${mes + 1}_${ano}.pdf`);

  } catch (err) {
    console.error(err);
    alert("Erro ao gerar relatório.");
  }
}
function atualizarBotoesStatus() {
  if (!selectedTicket) return;

  const status = selectedTicket.status?.toLowerCase();

  const btnIniciar = document.getElementById("btnIniciar");
  const btnPausar = document.getElementById("btnPausar");
  const btnRetomar = document.getElementById("btnRetomar");
  const btnFinalizar = document.getElementById("btnFinalizar");

  const botoes = [btnIniciar, btnPausar, btnRetomar, btnFinalizar];

  // 🔥 esconder todos
  botoes.forEach(btn => btn && (btn.style.display = "none"));

  // 🔥 regras
  if (status === "aberto") {
    btnIniciar && (btnIniciar.style.display = "flex");
  }

  if (status === "em andamento") {
    btnPausar && (btnPausar.style.display = "flex");
    btnFinalizar && (btnFinalizar.style.display = "flex");
  }

  if (status === "pausado") {
    btnRetomar && (btnRetomar.style.display = "flex");
  }

  // concluído = nenhum botão (já escondidos)
}
 // ✅ INICIAR
async function iniciarChamado() {
  try {
    if (!selectedTicket) return;

    const idChamado = selectedTicket.id;
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

// 🔔 PUSH
enviarPushOneSignal(
  "▶️ Chamado iniciado",
  `${selectedTicket.unidade} - ${selectedTicket.setor}`,
  selectedTicket.id
);
	

  } catch (err) {
    console.error(err);
    alert("Erro inesperado.");
  }
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
	// 🔔 PUSH
enviarPushOneSignal(
  "⏸️ Chamado pausado",
  `${selectedTicket.unidade} - ${selectedTicket.setor}`,
  selectedTicket.id
);

  } catch (err) {
    console.error("Erro real:", err);
    alert("Erro inesperado ao pausar.");
  }

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

alert("⏸️ Chamado Retomado com sucesso!");

// 🔔 PUSH
enviarPushOneSignal(
  "⏸️ Chamado Retomado",
  `${selectedTicket.unidade} - ${selectedTicket.setor}`,
  selectedTicket.id
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

alert("✅ Chamado finalizado!");

const userId = localStorage.getItem("user_id");

enviarPushOneSignal(
  "✅ Chamado finalizado",
  `${selectedTicket.unidade} - ${selectedTicket.setor}`,
  selectedTicket.id,
  userId
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


let canalChamados = null;
function escutarChamadosSeguro() {
  try {
    if (!window.supabaseClient) {
      console.warn("Supabase ainda não carregou");
      return;
    }

    // 🔥 trava global anti-duplicação
    if (window.__realtimeAtivo) return;
    window.__realtimeAtivo = true;

    // 🔥 mata canal antigo se existir
    if (canalChamados) {
      window.supabaseClient.removeChannel(canalChamados);
      canalChamados = null;
    }

    canalChamados = window.supabaseClient.channel("chamados");

    canalChamados
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chamados",
        },
        async (payload) => {

          const c = payload.new;

          if (payload.eventType === "INSERT") {
 enviarPushOneSignal(
  "▶️ Chamado Aberto",
  `${selectedTicket.unidade} - ${selectedTicket.setor}`,
  selectedTicket.id
);
          }

          if (payload.eventType === "UPDATE") {
            enviarPushOneSignal(
  "🔄 Status atualizado",
  `${c.unidade} - ${c.status}`,
  c.id
);
          }

          await carregarDados();
        }
      )
      .subscribe();

  } catch (e) {
    console.warn("Erro realtime:", e);
  }
}


async function enviarPushOneSignal(titulo, mensagem, id) {
  try {
    const res = await fetch("https://bubcilkbujuycpvysico.supabase.co/functions/v1/enviar-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1YmNpbGtidWp1eWNwdnlzaWNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzQyMDQsImV4cCI6MjA5MDcxMDIwNH0.0wFvOdVl47GkOl6aKARSvajqnFMaL3U1_Vp_iAMzw3w"
      },
      body: JSON.stringify({
        titulo,
        mensagem,
        id // 🔥 ESSENCIAL
      })
    });

    const data = await res.json();
    console.log("✅ RESPOSTA PUSH:", data);

  } catch (err) {
    console.error("❌ ERRO PUSH:", err);
  }
}
async function excluirChamado(id) {
  if (!id) {
    alert("ID inválido");
    return;
  }

  const confirmar = confirm("Deseja mover este chamado para a lixeira?");
  if (!confirmar) return;

  const agora = new Date().toISOString();

  const { error } = await window.supabaseClient
    .from("chamados")
    .update({ 
      excluido: true,
      status: "Concluído", // 🔥 FORÇA STATUS
      data_finalizacao: agora
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Erro: " + error.message);
    return;
  }

  console.log("✔ Atualizado:", id);

  await carregarDados();
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
function toggleColuna(event, id) {
  const header = event.currentTarget;
  const lista = document.getElementById(id);
  const seta = header.querySelector(".seta");

  if (!lista) return;

  if (lista.classList.contains("hidden")) {
    lista.classList.remove("hidden");
    if (seta) seta.textContent = "⬆️";
  } else {
    lista.classList.add("hidden");
    if (seta) seta.textContent = "⬇️";
  }
}

async function restaurarParaConcluidos() {
  const confirmar = confirm("Restaurar todos os chamados da lixeira como CONCLUÍDOS?");

  if (!confirmar) return;

  const { error } = await window.supabaseClient
    .from("chamados")
    .update({
      excluido: false,
      status: "Concluído",
      data_finalizacao: new Date().toISOString()
    })
    .eq("excluido", true);

  if (error) {
    alert("Erro: " + error.message);
    return;
  }

  alert("Chamados restaurados como concluídos!");

  carregarLixeira();
  carregarDados();
}

function iniciarSlider() {
  const container = document.querySelector(".compare-container");
  const overlay = document.getElementById("overlay");
  const slider = document.getElementById("slider");

  if (!container || !overlay || !slider) return;

  let isDragging = false;

  function mover(x) {
    const rect = container.getBoundingClientRect();

    let pos = x - rect.left;

    // trava dentro da área
    pos = Math.max(0, Math.min(pos, rect.width));

    const percent = (pos / rect.width) * 100;

    overlay.style.width = percent + "%";
    slider.style.left = percent + "%";
  }

  // 🖱️ mouse
  slider.addEventListener("mousedown", () => isDragging = true);
  window.addEventListener("mouseup", () => isDragging = false);

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    mover(e.clientX);
  });

  // 📱 touch (celular)
  slider.addEventListener("touchstart", () => isDragging = true);
  window.addEventListener("touchend", () => isDragging = false);

  window.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    mover(e.touches[0].clientX);
  });
}

function abrirModalFinalizar() {
  document.getElementById("modalFinalizar").classList.add("show");
}

function fecharModalFinalizar() {
  document.getElementById("modalFinalizar").classList.remove("show");
}

async function confirmarFinalizacao() {
  try {
    if (!selectedTicket || !selectedTicket.id) {
      alert("Chamado inválido.");
      return;
    }

    const file = document.getElementById("fotoFinal").files[0];

    let fotoFinalUrl = null;

    // 🔥 upload opcional
    if (file) {
      console.log("📤 Enviando foto...");
      fotoFinalUrl = await uploadFoto(file);
      console.log("✅ URL:", fotoFinalUrl);
    }

    // 🔥 monta update inteligente
    const updateData = {
      status: "Concluído",
      data_finalizacao: new Date().toISOString()
    };

    // só adiciona se existir
    if (fotoFinalUrl) {
      updateData.foto_final_url = fotoFinalUrl;
    }

    const { data, error } = await window.supabaseClient
      .from("chamados")
      .update(updateData)
      .eq("id", selectedTicket.id)
      .select();

    if (error) {
      console.error("Erro Supabase:", error);
      alert("Erro ao finalizar: " + error.message);
      return;
    }

    // 🔥 valida se realmente atualizou
    if (!data || data.length === 0) {
      alert("Nada foi atualizado. Verifique o ID.");
      return;
    }

    console.log("✔ Atualizado no banco:", data);

    alert("✅ Chamado finalizado!");
	const userId = localStorage.getItem("user_id");

enviarPushOneSignal(
  "✅ Chamado finalizado",
  `${selectedTicket.unidade} - ${selectedTicket.setor}`,
  selectedTicket.id,
  userId
);

    fecharModalFinalizar();
    fecharModal();

    document.getElementById("fotoFinal").value = "";

    await carregarDados();

  } catch (err) {
    console.error("Erro geral:", err);
    alert("Erro ao finalizar chamado");
  }
}