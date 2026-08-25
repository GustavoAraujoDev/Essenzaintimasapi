const API_URL = "http://127.0.0.1:3000";
let pedidosLocais = [];
let historicoExpedidos = [];
let pracaAtiva = "TODOS";
let somAlerta;

try {
  somAlerta = new Audio(
    "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg",
  );
  somAlerta.loop = true;
} catch (e) {
  console.error("Erro áudio:", e);
}

setInterval(() => {
  const agora = new Date();
  document.getElementById("clock-display").innerText =
    agora.toLocaleTimeString("pt-BR") +
    ` - ${agora.toLocaleDateString("pt-BR")}`;
}, 1000);

carregarPedidosDoBanco();
setInterval(carregarPedidosDoBanco, 8000);

let socket;
try {
  socket = io(API_URL);
  socket.on("connect", () => {
    const b = document.getElementById("connection-badge");
    if (b) {
      b.className =
        "px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black border border-emerald-200 uppercase";
      b.innerHTML = `<i class="fas fa-wifi mr-1"></i> ONLINE`;
    }
    carregarPedidosDoBanco();
  });
  socket.on("disconnect", () => {
    const b = document.getElementById("connection-badge");
    if (b) {
      b.className =
        "px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-black border border-red-200 uppercase";
      b.innerHTML = `<i class="fas fa-wifi-slash mr-1"></i> LOG OFF`;
    }
  });
  socket.on("imprimir-pedido", (pedido) => {
    adicionarOuAtualizarPedido(pedido);
  });
} catch (err) {
  console.error("Erro Socket.io:", err);
}

async function carregarPedidosDoBanco() {
  try {
    const r = await fetch(`${API_URL}/pedidos`, {
      credentials: "include",
    });
    const dados = await r.json();
    const listaPedidos = Array.isArray(dados)
      ? dados
      : dados.data || dados.pedidos || [];

    pedidosLocais = listaPedidos.filter(
      (p) =>
        p &&
        p.status &&
        ["CREATED", "PENDING", "CONFIRMED", "PREPARING"].includes(
          p.status.toUpperCase(),
        ),
    );
    historicoExpedidos = listaPedidos
      .filter(
        (p) =>
          p &&
          p.status &&
          ["READY", "CONCLUDED", "DELIVERED"].includes(p.status.toUpperCase()),
      )
      .slice(-15);
    renderizarKDS();
  } catch (err) {
    console.error("Falha ao carregar banco:", err);
  }
}

function renderizarKDS() {
  const colNovos = document.getElementById("col-novos");
  const colPreparo = document.getElementById("col-preparo");
  if (!colNovos || !colPreparo) return;

  colNovos.innerHTML = "";
  colPreparo.innerHTML = "";
  let cNovos = 0,
    cPreparo = 0,
    precisaTocarSom = false;

  pedidosLocais.forEach((p) => {
    if (!p || !p.itens || p.itens.length === 0) return;
    const statusAtual = p.status ? p.status.toUpperCase() : "CREATED";

    const contemItemDaPraca = p.itens.some((item) => {
      if (!item) return false;
      const cat = item.category ? item.category.toUpperCase() : "COZINHA";
      return pracaAtiva === "TODOS" || cat === pracaAtiva;
    });
    if (!contemItemDaPraca) return;

    const mins = Math.floor((new Date() - new Date(p.createdAt)) / 1000 / 60);
    let corSLA = "bg-gray-800 text-white";
    if (mins >= 15 && mins < 25) corSLA = "bg-amber-500 text-white";
    if (mins >= 25) corSLA = "animate-pulse-critical text-white font-black";

    if (["CREATED", "PENDING", "CONFIRMED"].includes(statusAtual))
      precisaTocarSom = true;

    const idBanco = p._id || p.id;
    const idExibicao = (idBanco || "0000").toString().slice(-4).toUpperCase();
    const tipoEntrega = (p.entrega?.tipo || "LOCAL").toUpperCase();
    const nomeCliente = (p.cliente?.nome || "Cliente Avulso").toUpperCase();
    const numeroMesa = p.entrega?.mesa || null;
    const obsGeralPedido = p.observacao || p.observacoes || p.notes || null;

    const cardHtml = `
            <div class="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-fit">
              <div class="px-4 py-3 ${corSLA} flex justify-between items-center text-xs font-bold">
                <div class="flex items-center gap-2">
                  <span class="font-black text-sm tracking-wider">#${idExibicao}</span>
                  <span class="bg-black/20 border border-white/10 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-widest">${tipoEntrega}</span>
                </div>
                <div class="flex items-center gap-2">
                  <button onclick="abrirVisualizacaoComanda('${idBanco}')" class="bg-white/20 hover:bg-white/30 p-1.5 rounded transition"><i class="fas fa-eye text-white"></i></button>
                  <span class="bg-black/20 px-2 py-1 rounded font-black text-[10px]"><i class="far fa-clock mr-1"></i>${mins} MIN</span>
                </div>
              </div>
              <div class="p-4 space-y-3 flex-1">
                <div class="text-[10px] text-gray-500 font-black uppercase tracking-wider flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <span class="truncate"><i class="fas fa-user text-gray-400 mr-1.5"></i>${nomeCliente}</span>
                  ${numeroMesa ? `<span class="bg-red-50 text-[#ea1d2c] border border-red-100 px-2 py-0.5 rounded font-black text-[9px]">MESA ${numeroMesa}</span>` : ""}
                </div>
                ${obsGeralPedido ? `<div class="bg-red-50 border border-red-100 text-[#ea1d2c] font-bold p-2.5 rounded-xl text-xs"><span class="text-[9px] font-black block uppercase tracking-wide">OBS GERAL:</span><p class="mt-0.5">${obsGeralPedido.toUpperCase()}</p></div>` : ""}
                <div class="space-y-2">
                  ${p.itens
                    .map((i) => {
                      if (!i) return "";
                      const nomeProduto = (
                        i.name ||
                        i.nome ||
                        "Produto"
                      ).toUpperCase();
                      return `
                      <div class="border-b border-gray-100 last:border-none pb-2 last:pb-0">
                        <div class="flex justify-between items-start text-sm font-bold text-gray-900">
                          <span>${i.quantity || 1}x ${nomeProduto}</span>
                          ${i.size ? `<span class="text-[9px] bg-gray-100 text-gray-500 border px-1 rounded uppercase">${i.size}</span>` : ""}
                        </div>
                        ${i.extras && i.extras.length > 0 ? `<div class="text-xs text-emerald-600 font-bold mt-0.5 pl-1">${i.extras.map((e) => `+ ${e.toUpperCase()}`).join(", ")}</div>` : ""}
                        ${i.notes || i.observacao ? `<div class="bg-amber-50 border border-amber-100 text-amber-700 text-[11px] p-1.5 rounded-md mt-1 font-bold">${(i.notes || i.observacao).toUpperCase()}</div>` : ""}
                      </div>
                    `;
                    })
                    .join("")}
                </div>
              </div>
              <div class="p-2 bg-gray-50 border-t border-gray-100 flex gap-2">
                ${
                  ["CREATED", "PENDING", "CONFIRMED"].includes(statusAtual)
                    ? `<button onclick="mudarStatus('${idBanco}', 'PREPARING')" class="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-2 rounded-xl text-xs uppercase tracking-wider transition">Preparar</button>`
                    : `<button onclick="mudarStatus('${idBanco}', 'READY')" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-2 rounded-xl text-xs uppercase tracking-wider transition">Concluir</button>`
                }
              </div>
            </div>
          `;

    if (["CREATED", "PENDING", "CONFIRMED"].includes(statusAtual)) {
      colNovos.innerHTML += cardHtml;
      cNovos++;
    } else if (statusAtual === "PREPARING") {
      colPreparo.innerHTML += cardHtml;
      cPreparo++;
    }
  });

  document.getElementById("badge-novos").innerText = cNovos;
  document.getElementById("badge-preparo").innerText = cPreparo;

  if (somAlerta) {
    if (precisaTocarSom) somAlerta.play().catch(() => {});
    else {
      somAlerta.pause();
      somAlerta.currentTime = 0;
    }
  }
  recalcularInsumosConsolidados();
}

function adicionarOuAtualizarPedido(pedido) {
  if (!pedido) return;
  const idx = pedidosLocais.findIndex(
    (pl) => pl._id === pedido._id || pl.id === pedido.id,
  );
  if (idx !== -1) pedidosLocais[idx] = pedido;
  else pedidosLocais.unshift(pedido);
  renderizarKDS();
}

function filtrarPraca(praca) {
  pracaAtiva = praca;
  ["TODOS", "COZINHA", "BEBIDAS"].forEach((p) => {
    const btn = document.getElementById(`btn-praca-${p}`);
    if (btn)
      btn.className =
        p === praca
          ? "px-3 py-1.5 rounded-lg bg-[#ea1d2c] text-white transition-all uppercase"
          : "px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 transition-all uppercase";
  });
  renderizarKDS();
}

function recalcularInsumosConsolidados() {
  const container = document.getElementById("lista-insumos-consolidados");
  if (!container) return;
  const mapaInsumos = {};

  pedidosLocais.forEach((p) => {
    if (p && p.status?.toUpperCase() === "PREPARING" && p.itens) {
      p.itens.forEach((item) => {
        if (!item) return;
        const cat = item.category ? item.category.toUpperCase() : "COZINHA";
        if (pracaAtiva !== "TODOS" && cat !== pracaAtiva) return;

        const nomeFinal = (item.name || item.nome || "Produto").toUpperCase();
        if (!mapaInsumos[nomeFinal]) mapaInsumos[nomeFinal] = { qtd: 0 };
        mapaInsumos[nomeFinal].qtd += item.quantity || 1;
      });
    }
  });

  const chaves = Object.keys(mapaInsumos);
  document.getElementById("badge-total-esteira").innerText =
    `${chaves.length} ITENS`;

  if (chaves.length === 0) {
    container.innerHTML = `<p class="text-xs text-gray-400 text-center py-6">Nenhum insumo pendente.</p>`;
    return;
  }

  container.innerHTML = chaves
    .map(
      (nome) => `
          <div class="bg-gray-50 p-3 rounded-xl border border-gray-200 flex justify-between items-center shadow-xs">
            <span class="text-xs font-bold text-gray-900">${nome}</span>
            <span class="bg-red-50 text-[#ea1d2c] px-2 py-0.5 rounded font-black text-xs border border-red-100">x${mapaInsumos[nome].qtd}</span>
          </div>
        `,
    )
    .join("");
}

function abrirVisualizacaoComanda(id) {
  const pedido =
    pedidosLocais.find((p) => p._id === id || p.id === id) ||
    historicoExpedidos.find((p) => p._id === id || p.id === id);
  if (!pedido) return;

  const idExibicao = (pedido._id || pedido.id || "0000")
    .toString()
    .slice(-4)
    .toUpperCase();
  const nomeCliente = (pedido.cliente?.nome || "CLIENTE AVULSO").toUpperCase();
  const tipoEntrega = (pedido.entrega?.tipo || "LOCAL").toUpperCase();
  let itensHtml = (pedido.itens || [])
    .map(
      (i) => `
          <div class="my-2 border-b border-dashed border-gray-200 pb-2">
            <div class="flex justify-between font-bold text-xs"><span>${i.quantity || 1}x ${(i.name || i.nome || "").toUpperCase()}</span></div>
            ${i.notes || i.observacao ? `<div class="text-[10px] pl-2 font-bold text-red-600">OBS: ${(i.notes || i.observacao).toUpperCase()}</div>` : ""}
          </div>
        `,
    )
    .join("");

  document.getElementById("conteudo-comanda-papel").innerHTML = `
          <div class="text-center font-bold tracking-widest border-b border-black pb-1 mb-2">*** PRATINHO KDS ***</div>
          <div class="text-[11px] space-y-0.5 mb-2">
            <div><strong>PEDIDO:</strong> #${idExibicao}</div>
            <div><strong>CLIENTE:</strong> ${nomeCliente}</div>
            <div><strong>ENTREGA:</strong> ${tipoEntrega}</div>
          </div>
          <div class="divide-y divide-gray-100">${itensHtml}</div>
        `;
  const modal = document.getElementById("modal-comanda");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function fecharModalComanda() {
  const m = document.getElementById("modal-comanda");
  m.classList.remove("flex");
  m.classList.add("hidden");
}

async function mudarStatus(id, status) {
  try {
    const r = await fetch(`${API_URL}/pedidos/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
      credentials: "include",
    });
    if (r.ok) carregarPedidosDoBanco();
  } catch (err) {
    console.error(err);
  }
}

function abrirModalHistorico() {
  const container = document.getElementById("lista-historico");
  const modal = document.getElementById("modal-historico");
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  if (historicoExpedidos.length === 0) {
    container.innerHTML = `<p class="text-xs text-gray-400 text-center py-6">Nenhum histórico.</p>`;
    return;
  }
  container.innerHTML = historicoExpedidos
    .map((p) => {
      const idFormatado = (p.id || p._id || "0000")
        .toString()
        .slice(-4)
        .toUpperCase();
      return `
            <div class="bg-gray-50 p-3 rounded-xl border border-gray-200 flex justify-between items-center shadow-xs">
              <div><p class="text-xs font-black text-gray-900">#${idFormatado} - ${(p.cliente?.nome || "Avulso").toUpperCase()}</p></div>
              <button onclick="desfazerExpedicao('${p._id || p.id}')" class="bg-red-50 text-[#ea1d2c] border border-red-100 hover:bg-[#ea1d2c] hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-black transition">Estornar</button>
            </div>
          `;
    })
    .join("");
}

function fecharModalHistorico() {
  const m = document.getElementById("modal-historico");
  m.classList.remove("flex");
  m.classList.add("hidden");
}

async function desfazerExpedicao(id) {
  fecharModalHistorico();
  await mudarStatus(id, "PREPARING");
}
