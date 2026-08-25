const API_URL = "http://127.0.0.1:3000";
let modoCrise = false;
let descarteContador = 0;
let ultimaVozAlerta = 0;

orquestrarCommandCenter();
setInterval(orquestrarCommandCenter, 5000);

async function orquestrarCommandCenter() {
  try {
    const res = await fetch(`${API_URL}/pedidos`, {
      credentials: "include",
    });
    const data = await res.json();
    const pedidos = Array.isArray(data)
      ? data
      : data.data || data.pedidos || [];
    processarEngenhariaUltra(pedidos);
  } catch (e) {
    console.error("Falha na orquestração central de dados:", e);
  }
}

function processarEngenhariaUltra(pedidos) {
  const ativos = pedidos.filter(
    (p) =>
      p &&
      p.status &&
      ["CREATED", "PENDING", "CONFIRMED", "PREPARING"].includes(
        p.status.toUpperCase(),
      ),
  );

  // OEE
  const totalAtivos = ativos.length;
  const totalAtrasados = ativos.filter((p) => {
    const min = Math.floor((new Date() - new Date(p.createdAt)) / 1000 / 60);
    return min >= 25;
  }).length;

  let taxaQualidade =
    descarteContador > 0 ? Math.max(100 - descarteContador * 5, 50) : 100;
  let taxaDisponibilidade =
    totalAtivos > 0
      ? Math.max(100 - Math.round((totalAtrasados / totalAtivos) * 100), 10)
      : 100;
  let scoreOEE = Math.round((taxaDisponibilidade * taxaQualidade) / 100);

  const elOee = document.getElementById("m-oee");
  const metricaOee = document.getElementById("oee-metrics");
  if (elOee && metricaOee) {
    elOee.innerText = `${scoreOEE}%`;
    metricaOee.innerHTML = `<span>Disp: ${taxaDisponibilidade}%</span> <span>Qual: ${taxaQualidade}%</span>`;
    elOee.className =
      scoreOEE < 75
        ? "text-4xl font-black text-red-500 font-digital"
        : "text-4xl font-black text-indigo-600 font-digital";
  }

  // TAKT TIME
  const elTakt = document.getElementById("m-takt");
  const elTaktTxt = document.getElementById("m-takt-txt");
  if (elTakt && elTaktTxt) {
    if (totalAtivos > 0) {
      const itensFila = ativos.reduce(
        (acc, p) => acc + (p.itens?.length || 0),
        0,
      );
      const taxaEscoamento = (itensFila / 30).toFixed(1);
      elTakt.innerText = `${taxaEscoamento} un`;
      elTaktTxt.innerText = `Necessário liberar ${taxaEscoamento} pratos por minuto para escoamento.`;
    } else {
      elTakt.innerText = "0.0 un";
      elTaktTxt.innerText = "Cozinha sem carga operacional pendente.";
    }
  }

  // RISK
  let riscoPct = Math.min(totalAtivos * 9, 100);
  if (modoCrise) riscoPct = Math.min(riscoPct + 25, 100);

  const elRiscoPct = document.getElementById("m-risco-pct");
  const elRiscoTxt = document.getElementById("m-risco-txt");
  const cardRisco = document.getElementById("card-risco-container");

  if (elRiscoPct && elRiscoTxt && cardRisco) {
    elRiscoPct.innerText = `${riscoPct}%`;
    if (riscoPct > 75) {
      elRiscoPct.className =
        "text-4xl font-black text-red-600 font-digital animate-pulse";
      elRiscoTxt.innerHTML =
        "⚠ <strong>ESTRESSE SINALIZADO:</strong> Linha sobrecarregada.";
      cardRisco.className =
        "bg-red-50 border border-red-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm";
      dispararAlertaVoz(
        "Aviso ao gestor, linha de montagem em saturação iminente.",
      );
    } else {
      elRiscoPct.className =
        "text-4xl font-black text-emerald-600 font-digital";
      elRiscoTxt.innerText = "Canais operando abaixo da zona de estresse.";
      cardRisco.className =
        "bg-white border border-gray-100 p-5 rounded-2xl flex flex-col justify-between shadow-sm";
    }
  }

  // QUEUE SMART
  const tabelaSmart = document.getElementById("tabela-smart-queue");
  if (tabelaSmart) {
    const filaComScore = ativos
      .map((p) => {
        const min = Math.floor(
          (new Date() - new Date(p.createdAt)) / 1000 / 60,
        );
        const qtdItens = p.itens?.length || 1;
        const pesoCanal =
          p.entrega?.tipo?.toUpperCase() === "DELIVERY" ? 15 : 5;
        const scoreCalculado = Math.round(
          min * 1.5 + qtdItens * 2.0 + pesoCanal,
        );
        return {
          raw: p,
          score: scoreCalculado,
          minutos: min,
          qtd: qtdItens,
        };
      })
      .sort((a, b) => b.score - a.score);

    if (filaComScore.length === 0) {
      tabelaSmart.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-gray-400 font-bold">Esteira limpa. Sem pedidos pendentes.</td></tr>`;
    } else {
      tabelaSmart.innerHTML = filaComScore
        .map((item) => {
          const p = item.raw;
          const idFormatado = (p._id || p.id || "0000")
            .toString()
            .slice(-4)
            .toUpperCase();
          const nome = (p.cliente?.nome || "Cliente Avulso").toUpperCase();
          const canal = (p.entrega?.tipo || "LOCAL").toUpperCase();

          let corScore = "text-emerald-600 bg-emerald-50 border-emerald-100";
          let indicacaoRoteiro = "MANTER SEQL";
          if (item.score > 40) {
            corScore = "text-amber-600 bg-amber-50 border-amber-100";
            indicacaoRoteiro = "ACELERAR FLUXO";
          }
          if (item.score > 70) {
            corScore =
              "text-red-600 bg-red-50 border-red-100 font-black animate-pulse";
            indicacaoRoteiro = "⚠ ATRAVESSAR PRATO";
          }

          return `
                <tr class="hover:bg-gray-50/80 transition">
                  <td class="px-4 py-3.5 font-black text-indigo-600">#${idFormatado}</td>
                  <td class="px-4 py-3.5">
                    <div class="font-bold text-gray-900">${nome}</div>
                    <div class="text-[9px] text-gray-400 font-black tracking-wider uppercase">${canal} ${p.entrega?.mesa ? `• MESA ${p.entrega.mesa}` : ""}</div>
                  </td>
                  <td class="px-4 py-3.5 text-center font-black text-gray-600">${item.qtd}x itens</td>
                  <td class="px-4 py-3.5 text-center">
                    <span class="px-2.5 py-1 border rounded font-digital text-sm ${corScore}">${item.score} pts</span>
                  </td>
                  <td class="px-4 py-3.5 text-right font-black text-[11px] tracking-wide text-gray-500">${indicacaoRoteiro}</td>
                </tr>
              `;
        })
        .join("");
    }
  }

  // DELIVERY JIT
  const containerDelivery = document.getElementById("lista-delivery-match");
  if (containerDelivery) {
    const pedidosDelivery = ativos.filter(
      (p) => p.entrega?.tipo?.toUpperCase() === "DELIVERY",
    );
    if (pedidosDelivery.length === 0) {
      containerDelivery.innerHTML = `<p class="text-xs text-gray-400 text-center py-10 font-bold">Nenhum delivery ativo na esteira.</p>`;
      return;
    }

    containerDelivery.innerHTML = pedidosDelivery
      .map((p) => {
        const idFormatado = (p._id || p.id || "0000")
          .toString()
          .slice(-4)
          .toUpperCase();
        const statusAtual =
          p.status?.toUpperCase() === "PREPARING" ? "NA CHAPA" : "EM ESPERA";
        const minutosEspera = Math.floor(
          (new Date() - new Date(p.createdAt)) / 1000 / 60,
        );

        let statusMotoboy = "MOTOBOY A CAMINHO";
        let corMotoboy =
          "bg-amber-50 text-amber-700 border-amber-100 text-center";

        if (minutosEspera > 12) {
          statusMotoboy = "MOTOBOY AGUARDANDO NA PORTA";
          corMotoboy =
            "bg-red-50 text-red-600 border-red-100 font-black animate-pulse";
        }

        return `
              <div class="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-col gap-2 shadow-sm">
                <div class="flex justify-between items-center">
                  <span class="text-xs font-black text-gray-900">COMANDA #${idFormatado}</span>
                  <span class="text-[9px] bg-gray-200 text-gray-600 font-bold px-2 py-0.5 rounded uppercase">${statusAtual}</span>
                </div>
                <div class="text-[10px] border px-2.5 py-1.5 rounded tracking-wider uppercase font-semibold ${corMotoboy}">
                  <i class="fas fa-shipping-fast mr-1"></i> ${statusMotoboy}
                </div>
              </div>
            `;
      })
      .join("");
  }
}

function dispararAlertaVoz(mensagem) {
  const agora = Date.now();
  if (agora - ultimaVozAlerta > 45000) {
    ultimaVozAlerta = agora;
    if ("speechSynthesis" in window) {
      const tom = new SpeechSynthesisUtterance(mensagem);
      tom.lang = "pt-BR";
      tom.rate = 1.1;
      window.speechSynthesis.speak(tom);
    }
  }
}

function testarVoz() {
  if ("speechSynthesis" in window) {
    const tom = new SpeechSynthesisUtterance(
      "Mecanismo de áudio Pratinho Pra Tudo ativo.",
    );
    tom.lang = "pt-BR";
    window.speechSynthesis.speak(tom);
  } else {
    Swal.fire("Erro", "Navegador sem suporte a voz.", "error");
  }
}

function lancarDescarte() {
  Swal.fire({
    title: "Registrar Perda",
    text: "Item descartado para auditoria Lean:",
    input: "text",
    inputPlaceholder: "Ex: 1x Prato queimado",
    showCancelButton: true,
    confirmButtonColor: "#ea1d2c",
    confirmButtonText: "Registrar",
    background: "#fff",
    color: "#000",
  }).then((res) => {
    if (res.isConfirmed && res.value) {
      descarteContador++;
      document.getElementById("m-descarte").innerText = descarteContador;
      orquestrarCommandCenter();
    }
  });
}

function alternarModoCrise() {
  modoCrise = !modoCrise;
  const btn = document.getElementById("btn-crise");
  if (modoCrise) {
    btn.className =
      "bg-red-600 text-white border border-red-500 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition animate-pulse shadow-md";
    Swal.fire({
      icon: "warning",
      title: "MODO CRISE ATIVO",
      text: "Vazão operacional máxima forçada.",
      confirmButtonColor: "#ea1d2c",
    });
  } else {
    btn.className =
      "bg-white hover:bg-red-50 border border-gray-200 text-gray-500 hover:text-[#ea1d2c] px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm";
  }
  orquestrarCommandCenter();
}
