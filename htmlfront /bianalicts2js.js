const API_URL = "http://127.0.0.1:3000";
let totalDescartesAcumulado = 0;
const CUSTO_FIXO_DIARIO_ALVO = 800.0; // Parametrização padrão de ponto de equilíbrio

// Variável de escopo global para armazenar os dados calculados mais recentes para o relatório
let dadosUltimoProcessamento = null;

window.addEventListener("DOMContentLoaded", () => {
  // Injeta um botão de exportação formal de forma dinâmica no cabeçalho ao carregar a página
  const headerControles = document.querySelector(
    "header > div.flex.items-center.gap-3.flex-wrap",
  );
  if (headerControles) {
    const btnExportar = document.createElement("button");
    btnExportar.onclick = exportarRelatorioExecutivo;
    btnExportar.className =
      "bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-[11px] font-black px-4 py-2 rounded-xl transition shadow-lg flex items-center gap-2";
    btnExportar.innerHTML = `<i class="fas fa-file-export"></i> Exportar Relatório`;
    headerControles.insertBefore(btnExportar, headerControles.firstChild);
  }

  setPreset("hoje");
  setInterval(acionarMotorBI, 10000);
});

function setPreset(tipo) {
  const hojeLocal = new Date();
  const ano = hojeLocal.getFullYear();
  const mes = String(hojeLocal.getMonth() + 1).padStart(2, "0");
  const dia = String(hojeLocal.getDate()).padStart(2, "0");
  const hojeFormatado = `${ano}-${mes}-${dia}`;

  if (tipo === "hoje") {
    document.getElementById("data-inicio").value = hojeFormatado;
    document.getElementById("data-fim").value = hojeFormatado;
  } else if (tipo === "7dias") {
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    document.getElementById("data-inicio").value =
      `${seteDiasAtras.getFullYear()}-${String(seteDiasAtras.getMonth() + 1).padStart(2, "0")}-${String(seteDiasAtras.getDate()).padStart(2, "0")}`;
    document.getElementById("data-fim").value = hojeFormatado;
  } else if (tipo === "mes") {
    document.getElementById("data-inicio").value = `${ano}-${mes}-01`;
    document.getElementById("data-fim").value = hojeFormatado;
  }
  acionarMotorBI();
}

async function acionarMotorBI() {
  try {
    const res = await fetch(`${API_URL}/pedidos`, {
      credentials: "include",
    });
    const rawData = await res.json();
    const pedidosBase = Array.isArray(rawData)
      ? rawData
      : rawData.data || rawData.pedidos || [];

    // LOG DE AUDITORIA NO CONSOLE
    console.log(
      `[Motor BI] Pedidos brutos recebidos da API: ${pedidosBase.length}`,
    );

    if (pedidosBase.length === 0) {
      console.warn(
        "Aviso: A API retornou zero pedidos. O banco local pode estar vazio.",
      );
    }

    processarAlgoritmosPro(pedidosBase);
  } catch (e) {
    console.error(
      "Erro crítico ao alimentar motor analítico. Verifique se o servidor na porta 3000 está rodando:",
      e,
    );
  }
}

function processarAlgoritmosPro(pedidos) {
  const startStr = document.getElementById("data-inicio").value;
  const endStr = document.getElementById("data-fim").value;

  document.getElementById("txt-periodo-sub").innerText =
    `Filtro: ${formatarBR(startStr)} até ${formatarBR(endStr)}`;

  const limiteInicio = new Date(startStr + "T00:00:00");
  const limiteFim = new Date(endStr + "T23:59:59");

  const pedidosFiltrados = pedidos.filter((p) => {
    const target =
      p.createdAt || p.data ? new Date(p.createdAt || p.data) : new Date();
    return target >= limiteInicio && target <= limiteFim;
  });

  let faturamentoTotal = 0;
  let rankingProdutos = {};
  let canais = { DELIVERY: 0, MESA: 0, BALCAO: 0 };

  pedidosFiltrados.forEach((p) => {
    let totalComanda = 0;
    if (p.itens) {
      p.itens.forEach((i) => {
        if (!i) return;
        const preco = parseFloat(i.price || i.preco || 30.0);
        const qtd = parseInt(i.quantity || i.qtd || 1);
        totalComanda += preco * qtd;
        const nomeItem = (i.name || i.nome || "Item").toUpperCase();
        rankingProdutos[nomeItem] = (rankingProdutos[nomeItem] || 0) + qtd;
      });
    }
    if (totalComanda === 0 && p.total) totalComanda = parseFloat(p.total);
    faturamentoTotal += totalComanda;
    p.totalConsolidadoBI = totalComanda;

    const canal = (p.entrega?.tipo || p.tipo || "BALCAO").toUpperCase();
    if (canal.includes("MESA") || canal.includes("SALAO")) canais.MESA++;
    else if (canal.includes("DELIVERY") || canal.includes("APP"))
      canais.DELIVERY++;
    else canais.BALCAO++;
  });

  const totalPedidos = pedidosFiltrados.length;
  const ticketMedio = totalPedidos > 0 ? faturamentoTotal / totalPedidos : 0;
  const lucroLiquidoEstimado = faturamentoTotal * 0.6;

  const diasNoPeriodo = Math.max(
    Math.ceil((limiteFim - limiteInicio) / (1000 * 60 * 60 * 24)),
    1,
  );
  const runRateProjecaoMensal = (faturamentoTotal / diasNoPeriodo) * 30;
  let oee =
    totalDescartesAcumulado > 0
      ? Math.max(100 - totalDescartesAcumulado * 4, 40)
      : 100;

  // Cálculos de Break-Even Dinâmico (Proporcional aos dias selecionados)
  const breakEvenAlvoPeriodo = CUSTO_FIXO_DIARIO_ALVO * diasNoPeriodo;
  const pctBreakEven = Math.min(
    Math.round((faturamentoTotal / breakEvenAlvoPeriodo) * 100),
    100,
  );

  const listaOrdenada = Object.keys(rankingProdutos)
    .map((n) => ({ nome: n, qtd: rankingProdutos[n] }))
    .sort((a, b) => b.qtd - a.qtd);

  // =========================================================================
  // ATUALIZAÇÃO DO CACHE EM ZONA SEGURA (Antes de renderizar elementos HTML)
  // =========================================================================
  dadosUltimoProcessamento = {
    periodo: {
      inicio: formatarBR(startStr),
      fim: formatarBR(endStr),
      dias: diasNoPeriodo,
    },
    financeiro: {
      faturamentoTotal,
      lucroLiquidoEstimado,
      ticketMedio,
      runRateProjecaoMensal,
      breakEvenAlvoPeriodo,
      pctBreakEven,
    },
    operacional: { totalPedidos, totalDescartesAcumulado, oee },
    produtos: listaOrdenada,
    canais: { ...canais },
    ledger: [...pedidosFiltrados],
  };

  // Renderização Financeira Superior
  document.getElementById("m-faturamento").innerText =
    faturamentoTotal.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  document.getElementById("m-lucro-liquido").innerText =
    lucroLiquidoEstimado.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  document.getElementById("m-ticket").innerText = ticketMedio.toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    },
  );
  document.getElementById("m-run-rate").innerText =
    runRateProjecaoMensal.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  document.getElementById("m-pedidos-sub").innerText =
    `${totalPedidos} comandas no filtro`;
  document.getElementById("m-descarte").innerText = totalDescartesAcumulado;
  document.getElementById("m-oee-sub").innerText =
    `Eficiência Operacional OEE: ${oee}%`;

  // Interface Break-Even
  document.getElementById("txt-break-even-progresso").innerText =
    faturamentoTotal.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  document.getElementById("txt-break-even-alvo").innerText =
    `Meta: ${breakEvenAlvoPeriodo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
  document.getElementById("bar-break-even").style.width = `${pctBreakEven}%`;
  document.getElementById("txt-break-even-status").innerText =
    pctBreakEven >= 100
      ? "🎉 Operação em Lucro Líquido Real!"
      : `Faltam ${Math.round(100 - pctBreakEven)}% para cobrir os custos fixos.`;

  renderizarMatrizBCG(listaOrdenada);
  renderizarCanaisVenda(canais, totalPedidos);
  renderizarLedgerCards(pedidosFiltrados);

  // DISPARADOR DO MOTOR DE PRESCRIÇÃO E TOMADA DE DECISÃO
  executarPrescricoesEstrategicas(
    faturamentoTotal,
    ticketMedio,
    canais,
    totalPedidos,
    pctBreakEven,
    listaOrdenada,
  );
}

// MOTOR DE PRESCRIÇÃO TOTAL: "FAÇA X POR CAUSA DE Y E Z"
function ejecutarPrescricoesEstrategicas(
  faturamento,
  ticket,
  canais,
  totalPedidos,
  pctBreakEven,
  produtos,
) {
  const container = document.getElementById("container-prescricoes-core");
  if (!container) return;

  if (totalPedidos === 0) {
    container.innerHTML = `<div class="col-span-3 text-center py-8 text-slate-500 font-bold text-xs"><i class="fas fa-robot block text-xl mb-1 text-cyan-400"></i> Alimente o sistema com transações para gerar diagnósticos direcionados de tomada de decisão.</div>`;
    return;
  }

  let html = "";
  const base = totalPedidos || 1;
  const pctDel = (canais.DELIVERY / base) * 100;

  // DIRETRIZ 1: ALVOS DE PREÇO & TICKET
  if (ticket < 45) {
    html += `
            <div class="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-center"><span class="text-[9px] bg-amber-500/10 text-amber-400 font-black px-2 py-0.5 rounded">ESTRATÉGIA DE TICKET</span> <i class="fas fa-triangle-exclamation text-amber-500 text-xs"></i></div>
                <h4 class="text-xs font-black text-white mt-2">👉 Monte e force combos com bebidas/sobremesas no checkout imediatamente.</h4>
                <p class="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  <b>Por que fazer isso:</b> Seu ticket médio está estagnado em <span class="text-amber-400 font-bold">${ticket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>. Como o custo fixo operacional por comanda é constante, vender itens isolados diminui a margem e prolonga o tempo para atingir o Ponto de Equilíbrio.
                </p>
              </div>
              <div class="text-[10px] text-slate-400 border-t border-slate-800/60 pt-2 mt-3 font-semibold">Meta de Ajuste: Forçar acréscimo de +R$ 10 por pedido</div>
            </div>
          `;
  } else {
    html += `
            <div class="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-center"><span class="text-[9px] bg-emerald-500/10 text-emerald-400 font-black px-2 py-0.5 rounded">SAÚDE OPERACIONAL</span> <i class="fas fa-circle-check text-emerald-400 text-xs"></i></div>
                <h4 class="text-xs font-black text-white mt-2">👉 Evite dar descontos agressivos. Foque em programas de fidelidade por recorrência.</h4>
                <p class="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  <b>Por que fazer isso:</b> Seu ticket médio de <span class="text-emerald-400 font-bold">${ticket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span> está saudável. Queimar preço agora destruirá sua lucratividade voluntariamente sem necessidade, visto que o comportamento de compra atual do cliente já valida sua tabela de preços.
                </p>
              </div>
              <div class="text-[10px] text-slate-400 border-t border-slate-800/60 pt-2 mt-3 font-semibold">Meta de Ajuste: Reter a base compradora existente</div>
            </div>
          `;
  }

  // DIRETRIZ 2: VULNERABILIDADE COMERCIAL (CANAIS)
  if (pctDel >= 60) {
    html += `
            <div class="bg-purple-500/5 border border-purple-500/20 p-4 rounded-xl flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-center"><span class="text-[9px] bg-purple-500/10 text-purple-400 font-black px-2 py-0.5 rounded">DEPENDÊNCIA DE CANAL</span> <i class="fas fa-shield-cat text-purple-400 text-xs"></i></div>
                <h4 class="text-xs font-black text-white mt-2">👉 Incentive o Takeaway (retirada) oferecendo 5% off exclusivo no balcão.</h4>
                <p class="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  <b>Por que fazer isso:</b> O Delivery concentra <span class="text-purple-400 font-bold">${Math.round(pctDel)}%</span> das vendas. Você está excessivamente exposto às taxas abusivas dos marketplaces e riscos de atraso de motoboys. Trazer o fluxo para o balcão recupera até 20% de margem líquida desperdiçada em comissões.
                </p>
              </div>
              <div class="text-[10px] text-slate-400 border-t border-slate-800/60 pt-2 mt-3 font-semibold">Meta de Ajuste: Mitigar riscos de taxas de marketplaces</div>
            </div>
          `;
  } else {
    html += `
            <div class="bg-cyan-500/5 border border-cyan-500/20 p-4 rounded-xl flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-center"><span class="text-[9px] bg-cyan-500/10 text-cyan-400 font-black px-2 py-0.5 rounded">EQUILÍBRIO DE VENDAS</span> <i class="fas fa-scale-balanced text-cyan-400 text-xs"></i></div>
                <h4 class="text-xs font-black text-white mt-2">👉 Mantenha a tração atual e padronize a linha de montagem física.</h4>
                <p class="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  <b>Por que fazer isso:</b> Seus canais internos e externos estão operando em perfeita harmonia comercial. Não mude taxas de entrega nem faça alterações estruturais bruscas no salão para não fragmentar este fluxo estável.
                </p>
              </div>
              <div class="text-[10px] text-slate-400 border-t border-slate-800/60 pt-2 mt-3 font-semibold">Meta de Ajuste: Otimização de tempos de preparo (SLA)</div>
            </div>
          `;
  }

  // DIRETRIZ 3: OTIMIZAÇÃO DE ENGENHARIA DE CARDÁPIO (MATRIZ BCG)
  if (produtos.length > 0) {
    const itemLider = produtos[0].nome;
    html += `
            <div class="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-center"><span class="text-[9px] bg-blue-500/10 text-blue-400 font-black px-2 py-0.5 rounded">GESTÃO DE MENU</span> <i class="fas fa-kitchen-set text-blue-400 text-xs"></i></div>
                <h4 class="text-xs font-black text-white mt-2">👉 Crie porções pré-produzidas e congeladas/resfriadas de: ${itemLider}.</h4>
                <p class="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  <b>Por que fazer isso:</b> O prato <b>${itemLider}</b> é o seu principal motor de tração por volume. Realizar o porcionamento antecipado de pesos e molhos desse item zera o tempo morto de cozinha nos horários de pico e elimina o desperdício acidental de insumos caros por pressa da equipe.
                </p>
              </div>
              <div class="text-[10px] text-slate-400 border-t border-slate-800/60 pt-2 mt-3 font-semibold">Meta de Ajuste: Ganho de velocidade na linha de produção</div>
            </div>
          `;
  } else {
    html += `
            <div class="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
              <h4 class="text-xs font-black text-white">Consolidando Matriz de Engenharia de Pratos...</h4>
            </div>
          `;
  }

  container.innerHTML = html;
}

// RENDERIZADOR AVANÇADO DA MATRIZ STARS & DOGS (BCG)
function renderizarMatrizBCG(lista) {
  const container = document.getElementById("container-matriz-bcg");
  if (!container || lista.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-600 text-center py-10 font-bold">Sem dados de mix mapeados.</p>`;
    return;
  }

  // Regra de separação: Itens acima da média de vendas são STARS (Estrelas), abaixo são DOGS (Cachorros)
  const totalVendido = lista.reduce((acc, curr) => acc + curr.qtd, 0);
  const mediaCorte = totalVendido / lista.length;

  container.innerHTML = lista
    .map((item) => {
      const isStar = item.qtd >= mediaCorte;
      const badgeClass = isStar
        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
        : "bg-slate-800 text-slate-400 border border-slate-700";
      const icon = isStar
        ? "⭐ ITEM ESTRELA (Alto Giro)"
        : "🐕 ITEM CACHORRO (Baixo Giro)";
      const dicaSub = isStar
        ? "Preservar margem e qualidade"
        : "Avaliar remoção ou reengenharia";

      return `
            <div class="bg-[#060913] p-3 rounded-xl border border-slate-800 flex justify-between items-center">
              <div>
                <h5 class="text-xs font-black text-white tracking-wide">${item.nome}</h5>
                <span class="text-[9px] font-black uppercase mt-0.5 block ${isStar ? "text-amber-400" : "text-slate-500"}">${icon}</span>
                <p class="text-[9px] text-slate-500 font-medium">${dicaSub}</p>
              </div>
              <span class="text-xs font-bold font-digital bg-slate-900 px-2 py-1 border border-slate-800 text-slate-300 rounded">${item.qtd} un</span>
            </div>
          `;
    })
    .join("");
}

function renderizarCanaisVenda(canais, total) {
  const container = document.getElementById("container-canais-venda");
  if (!container) return;
  const base = total || 1;
  container.innerHTML = `
          <div class="space-y-3 text-xs font-bold">
            <div>
              <div class="flex justify-between text-slate-300 mb-1"><span><i class="fas fa-motorcycle text-pink-500 mr-1"></i> Delivery</span><span class="text-slate-400">${Math.round((canais.DELIVERY / base) * 100)}%</span></div>
              <div class="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800"><div class="bg-pink-500 h-full" style="width: ${(canais.DELIVERY / base) * 100}%"></div></div>
            </div>
            <div>
              <div class="flex justify-between text-slate-300 mb-1"><span><i class="fas fa-chair text-sky-400 mr-1"></i> Mesas</span><span class="text-slate-400">${Math.round((canais.MESA / base) * 100)}%</span></div>
              <div class="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800"><div class="bg-sky-400 h-full" style="width: ${(canais.MESA / base) * 100}%"></div></div>
            </div>
            <div>
              <div class="flex justify-between text-slate-300 mb-1"><span><i class="fas fa-store text-teal-400 mr-1"></i> Balcão</span><span class="text-slate-400">${Math.round((canais.BALCAO / base) * 100)}%</span></div>
              <div class="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800"><div class="bg-teal-400 h-full" style="width: ${(canais.BALCAO / base) * 100}%"></div></div>
            </div>
          </div>
        `;
}

function renderizarLedgerCards(pedidos) {
  const container = document.getElementById("lista-ledger-cards");
  if (!container) return;
  if (pedidos.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-600 text-center py-10 font-bold">Nenhum registro contábil indexado.</p>`;
    return;
  }

  container.innerHTML = pedidos
    .slice(0, 15)
    .map((p) => {
      const id = (p._id || p.id || "0000").toString().slice(-4).toUpperCase();
      const cliente = (
        p.cliente?.nome ||
        p.nomeCliente ||
        "C. Padrão"
      ).toUpperCase();
      const canal = (p.entrega?.tipo || p.tipo || "BALCAO").toUpperCase();
      const valor = (p.totalConsolidadoBI || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      return `
            <div class="bg-[#050811] p-2.5 rounded-xl border border-slate-800/80 flex justify-between items-center text-xs">
              <div>
                <div class="flex items-center gap-2"><span class="font-black text-indigo-400">#${id}</span> <span class="text-slate-300 font-bold text-[11px] truncate w-24 block">${cliente}</span></div>
                <span class="text-[9px] text-slate-500 font-bold font-mono uppercase">${canal}</span>
              </div>
              <span class="font-digital font-bold text-emerald-400">${valor}</span>
            </div>
          `;
    })
    .join("");
}

function formatarBR(dataStr) {
  if (!dataStr) return "";
  const partes = dataStr.split("-");
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function registrarDescarteRapido() {
  totalDescartesAcumulado++;
  acionarMotorBI();
}

// FUNÇÃO FORMAL DE EXPORTAÇÃO DE RELATÓRIO EXECUTIVO EM PDF (VIA HTML2PDF)
function exportarRelatorioExecutivo() {
  // Validação de segurança para garantir que existem dados no cache
  if (!dadosUltimoProcessamento) {
    Swal.fire({
      icon: "warning",
      title: "Exportação Indisponível",
      text: "Não há dados processados no painel para gerar o relatório.",
      confirmButtonColor: "#06b6d4",
    });
    return;
  }

  const d = dadosUltimoProcessamento;
  const formatarMoeda = (v) =>
    typeof v === "number"
      ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "R$ 0,00";

  // Garante que o total de pedidos seja lido corretamente para evitar divisões por zero
  const totalPedidosSeguro = d.operacional?.totalPedidos || 0;
  const divisorCanais = totalPedidosSeguro > 0 ? totalPedidosSeguro : 1;

  // Criamos um elemento HTML temporário na memória para o html2pdf processar
  const elementoRelatorio = document.createElement("div");
  elementoRelatorio.style.padding = "30px";
  elementoRelatorio.style.background = "#ffffff";
  elementoRelatorio.style.color = "#111827";
  elementoRelatorio.style.fontFamily = "Arial, sans-serif";
  elementoRelatorio.style.fontSize = "12px";

  // Montagem do conteúdo do relatório
  let conteudoHTML = `
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px;">
            <h1 style="font-size: 20px; font-weight: 900; margin: 0; color: #0f172a; text-transform: uppercase;">PratinhoPraTudo Ultra v6.0</h1>
            <p style="margin: 4px 0 0 0; color: #4b5563; font-size: 10px; font-weight: bold; text-transform: uppercase;">Relatório Executivo de Controladoria</p>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 25px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px;">
            <div>
              <strong>Data de Emissão:</strong> ${new Date().toLocaleDateString("pt-BR")}<br>
              <strong>Responsável:</strong> Auditoria Digital
            </div>
            <div style="text-align: right;">
              <strong>Período:</strong> ${d.periodo?.inicio || "-"} até ${d.periodo?.fim || "-"}<br>
              <strong>Dias Analisados:</strong> ${d.periodo?.dias || 1} dias
            </div>
          </div>

          <div style="font-size: 12px; font-weight: bold; background: #0f172a; color: white; padding: 4px 8px; margin-top: 15px; margin-bottom: 10px; text-transform: uppercase;">1. Desempenho Financeiro</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
            <tr style="border-bottom: 1px dashed #e2e8f0;"><td style="padding: 5px 0;">Faturamento Bruto Consolidado</td><td style="text-align: right; font-weight: bold;">${formatarMoeda(d.financeiro?.faturamentoTotal)}</td></tr>
            <tr style="border-bottom: 1px dashed #e2e8f0;"><td style="padding: 5px 0;">Margem de Lucro Est. (60%)</td><td style="text-align: right; font-weight: bold;">${formatarMoeda(d.financeiro?.lucroLiquidoEstimado)}</td></tr>
            <tr style="border-bottom: 1px dashed #e2e8f0;"><td style="padding: 5px 0;">Ticket Médio por Comanda</td><td style="text-align: right; font-weight: bold;">${formatarMoeda(d.financeiro?.ticketMedio)}</td></tr>
            <tr style="border-bottom: 1px dashed #e2e8f0;"><td style="padding: 5px 0;">Previsão de Caixa (Run Rate)</td><td style="text-align: right; font-weight: bold;">${formatarMoeda(d.financeiro?.runRateProjecaoMensal)}</td></tr>
            <tr style="border-bottom: 1px dashed #e2e8f0;"><td style="padding: 5px 0;">Meta Ponto de Equilíbrio</td><td style="text-align: right; font-weight: bold;">${formatarMoeda(d.financeiro?.breakEvenAlvoPeriodo)}</td></tr>
            <tr style="border-bottom: 1px dashed #e2e8f0;"><td style="padding: 5px 0;">Cobertura do Break-Even</td><td style="text-align: right; font-weight: bold;">${d.financeiro?.pctBreakEven || 0}%</td></tr>
          </table>

          <div style="font-size: 12px; font-weight: bold; background: #0f172a; color: white; padding: 4px 8px; margin-top: 15px; margin-bottom: 10px; text-transform: uppercase;">2. Performance Operacional</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
            <tr style="border-bottom: 1px dashed #e2e8f0;"><td style="padding: 5px 0;">Total de Comandas Processadas</td><td style="text-align: right; font-weight: bold;">${totalPedidosSeguro}</td></tr>
            <tr style="border-bottom: 1px dashed #e2e8f0;"><td style="padding: 5px 0;">Descartes de Cozinha</td><td style="text-align: right; font-weight: bold;">${d.operacional?.totalDescartesAcumulado || 0}</td></tr>
            <tr style="border-bottom: 1px dashed #e2e8f0;"><td style="padding: 5px 0;">Eficiência Operacional (OEE)</td><td style="text-align: right; font-weight: bold;">${d.operacional?.oee || 100}%</td></tr>
          </table>

          <div style="font-size: 12px; font-weight: bold; background: #0f172a; color: white; padding: 4px 8px; margin-top: 15px; margin-bottom: 10px; text-transform: uppercase;">3. Distribuição por Canais</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px;">
            <thead>
              <tr style="background: #f1f5f9;"><th style="text-align: left; padding: 5px;">Canal</th><th style="text-align: center; padding: 5px;">Porcentagem</th><th style="text-align: right; padding: 5px;">Quantidade</th></tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 5px;">Delivery</td><td style="text-align: center; font-weight: bold;">${Math.round(((d.canais?.DELIVERY || 0) / divisorCanais) * 100)}%</td><td style="text-align: right;">${d.canais?.DELIVERY || 0} un</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 5px;">Mesa</td><td style="text-align: center; font-weight: bold;">${Math.round(((d.canais?.MESA || 0) / divisorCanais) * 100)}%</td><td style="text-align: right;">${d.canais?.MESA || 0} un</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 5px;">Balcão</td><td style="text-align: center; font-weight: bold;">${Math.round(((d.canais?.BALCAO || 0) / divisorCanais) * 100)}%</td><td style="text-align: right;">${d.canais?.BALCAO || 0} un</td></tr>
            </tbody>
          </table>

          <div style="font-size: 12px; font-weight: bold; background: #0f172a; color: white; padding: 4px 8px; margin-top: 15px; margin-bottom: 10px; text-transform: uppercase;">4. Engenharia de Cardápio (Mix BCG)</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px;">
            <thead>
              <tr style="background: #f1f5f9;"><th style="text-align: left; padding: 5px;">Item</th><th style="text-align: center; padding: 5px;">Quantidade Vendida</th></tr>
            </thead>
            <tbody>
        `;

  if (!d.produtos || d.produtos.length === 0) {
    conteudoHTML += `<tr><td colspan="2" style="text-align: center; padding: 10px; color: #6b7280;">Nenhum item registrado.</td></tr>`;
  } else {
    d.produtos.forEach((item) => {
      conteudoHTML += `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 5px;"><strong>${item.nome}</strong></td>
                <td style="text-align: center;">${item.qtd} un</td>
              </tr>
            `;
    });
  }

  conteudoHTML += `
            </tbody>
          </table>

          <div style="text-align: center; margin-top: 30px; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px;">
            PRATINHOPRATUDO CONTROLADORIA © 2026 - RELATÓRIO EXECUTIVO GERADO AUTOMATICAMENTE
          </div>
        `;

  elementoRelatorio.innerHTML = conteudoHTML;

  // Configurações do html2pdf
  const configuracao = {
    margin: 10,
    filename: `Relatorio_Controladoria_${d.periodo?.inicio || "export"}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, logging: false, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };

  // Dispara o motor de conversão e faz o download automático
  html2pdf()
    .set(configuracao)
    .from(elementoRelatorio)
    .save()
    .then(() => {
      Swal.fire({
        icon: "success",
        title: "PDF Exportado!",
        text: "O relatório executivo em PDF foi baixado com sucesso.",
        confirmButtonColor: "#06b6d4",
      });
    })
    .catch((erro) => {
      console.error("Erro na geração do PDF:", erro);
      Swal.fire({
        icon: "error",
        title: "Erro na Exportação",
        text: "Houve uma falha interna ao processar o arquivo PDF.",
        confirmButtonColor: "#dc2626",
      });
    });
}
