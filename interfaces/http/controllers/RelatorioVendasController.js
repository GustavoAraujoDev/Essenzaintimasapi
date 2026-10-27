
"use strict";

const PDFDocument = require("pdfkit");

class RelatorioVendasController {
  constructor(gerarRelatorioVendasUseCase) {
    if (
      !gerarRelatorioVendasUseCase ||
      typeof gerarRelatorioVendasUseCase.execute !== "function"
    ) {
      throw new Error(
        "O caso de uso GerarRelatorioVendasUseCase é obrigatório."
      );
    }

    this.gerarRelatorioVendasUseCase =
      gerarRelatorioVendasUseCase;

    this.gerar = this.gerar.bind(this);
    this.exportarCSV = this.exportarCSV.bind(this);
    this.exportarPDF = this.exportarPDF.bind(this);
  }

  
    obterParametros(req) {
  const inicio = req.query.inicio || req.query.dataInicial;
  const fim = req.query.fim || req.query.dataFinal;

  if (!inicio || !fim) {
    const erro = new Error(
      "Informe as datas de início e fim do relatório."
    );
    erro.statusCode = 400;
    throw erro;
  }

  return {
    dataInicio: inicio,
    dataFim: fim,
    operadorId: req.query.operadorId || undefined,
    caixaId: req.query.caixaId || undefined,
  };
}

  async obterRelatorio(req) {
    if (!req.user) {
      const erro = new Error("Usuário não autenticado.");
      erro.statusCode = 401;
      throw erro;
    }

    const filtros = this.obterParametros(req);

    return this.gerarRelatorioVendasUseCase.execute(
      req.user,
      filtros
    );
  }

  nomeArquivo(relatorio, extensao) {
    const inicio = relatorio.periodo.dataInicio;
    const fim = relatorio.periodo.dataFim;

    return `relatorio-vendas-${inicio}-a-${fim}.${extensao}`;
  }

  arredondar(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return 0;

    return Math.round(
      (numero + Number.EPSILON) * 100
    ) / 100;
  }

  formatarMoeda(valor) {
    return this.arredondar(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  formatarData(valor) {
    if (!valor) return "Não informada";

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) {
      return "Data inválida";
    }

    return data.toLocaleString("pt-BR", {
      timeZone: "America/Fortaleza",
    });
  }

  // Protege células CSV contra fórmulas executáveis no Excel.
  protegerCSV(valor) {
    let texto = valor == null ? "" : String(valor);

    if (/^[\s]*[=+\-@]/.test(texto)) {
      texto = `'${texto}`;
    }

    return `"${texto.replace(/"/g, '""')}"`;
  }

  montarCSV(relatorio) {
    const cabecalho = [
      "ID da venda",
      "Data da venda",
      "Status",
      "Origem",
      "Operador",
      "Cliente",
      "Subtotal (R$)",
      "Desconto (R$)",
      "Acréscimo (R$)",
      "Total da venda (R$)",
      "Valor devolvido registrado (R$)",
      "Recebimento confirmado (R$)",
      "Pagamento pendente (R$)",
      "Pagamento falho (R$)",
      "Valor de pagamentos marcados estornados (R$)",
      "Formas e status dos pagamentos",
      "Itens",
      "Motivo do cancelamento",
    ];

    const linhas = [cabecalho];

    for (const venda of relatorio.vendas || []) {
      const pagamentos = (venda.pagamentos || [])
        .map((p) => {
          return [
            p.metodo || "NAO_INFORMADO",
            p.status || "NAO_INFORMADO",
            this.formatarMoeda(p.valor),
          ].join(" - ");
        })
        .join(" | ");

      const itens = (venda.itens || [])
        .map((item) => {
          return `${item.nome} (${item.sku || "sem SKU"}) x${item.quantidade}`;
        })
        .join(" | ");

      const financeiro = venda.financeiro || {};

      linhas.push([
        venda.id,
        this.formatarData(venda.dataVenda),
        venda.status,
        venda.origem,
        venda.operador?.nome,
        venda.cliente?.nome,
        this.arredondar(venda.subtotal).toFixed(2).replace(".", ","),
        this.arredondar(venda.desconto).toFixed(2).replace(".", ","),
        this.arredondar(venda.acrescimo).toFixed(2).replace(".", ","),
        this.arredondar(venda.total).toFixed(2).replace(".", ","),
        this.arredondar(venda.valorDevolvido).toFixed(2).replace(".", ","),
        this.arredondar(financeiro.recebidoConfirmado)
          .toFixed(2).replace(".", ","),
        this.arredondar(financeiro.pagamentosPendentes)
          .toFixed(2).replace(".", ","),
        this.arredondar(financeiro.pagamentosFalhos)
          .toFixed(2).replace(".", ","),
        this.arredondar(financeiro.pagamentosEstornadosRegistrados)
          .toFixed(2).replace(".", ","),
        pagamentos,
        itens,
        venda.motivoCancelamento,
      ]);
    }

    const conteudo = linhas
      .map((linha) =>
        linha.map((valor) => this.protegerCSV(valor)).join(";")
      )
      .join("\r\n");

    // BOM ajuda o Excel a reconhecer UTF-8 corretamente.
    return "\uFEFF" + conteudo;
  }

  async gerar(req, res, next) {
    try {
      const relatorio = await this.obterRelatorio(req);

      res.setHeader("Cache-Control", "no-store, private");

      return res.status(200).json({
        sucesso: true,
        mensagem: "Relatório gerado com sucesso.",
        relatorio,
      });
    } catch (erro) {
      return next(erro);
    }
  }

  async exportarCSV(req, res, next) {
    try {
      const relatorio = await this.obterRelatorio(req);
      const csv = this.montarCSV(relatorio);
      const nome = this.nomeArquivo(relatorio, "csv");

      res.setHeader(
        "Content-Type",
        "text/csv; charset=utf-8"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${nome}"`
      );

      res.setHeader("Cache-Control", "no-store, private");

      return res.status(200).send(csv);
    } catch (erro) {
      return next(erro);
    }
  }

  async exportarPDF(req, res, next) {
  let doc;

  try {
    const relatorio = await this.obterRelatorio(req);
    const nome = this.nomeArquivo(relatorio, "pdf");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nome}"`
    );
    res.setHeader("Cache-Control", "no-store, private");

    doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true, // Necessário para contagem total de páginas no rodapé
      info: {
        Title: "Relatório de Vendas - Essenza Íntimas",
        Author: "Essenza Íntimas",
        Subject: "Relatório gerencial e financeiro",
      },
    });

    doc.on("error", (erro) => {
      if (!res.headersSent) {
        next(erro);
      } else {
        res.destroy(erro);
      }
    });

    doc.pipe(res);

    // 🎨 PALETA PREMIUM ESSENZA ÍNTIMAS
    const CORES = {
      marromPrincipal: "#7D5D4B",
      textoEscuro: "#2B2523",
      textoSuave: "#8C7A6B",
      fundoCard: "#FAF7F5",
      bordaSuave: "#EAE3DE",
      branco: "#FFFFFF",
    };

    const margem = 40;
    const largura = doc.page.width - margem * 2;
    const resumo = relatorio.resumo || {};
    const conciliacao = relatorio.conciliacao || {};
    const pagamentos = relatorio.pagamentos || [];
    const vendas = relatorio.vendas || [];

    // Helper: Garantir espaço livre na página
    const garantirEspaco = (altura = 50) => {
      if (doc.y + altura > doc.page.height - margem - 30) {
        doc.addPage();
        desenharCabecalhoSimplificado();
      }
    };

    // Helper: Desenha títulos de seção elegantes
    const tituloSecao = (texto) => {
      garantirEspaco(40);
      doc.moveDown(0.8);
      
      const yAtual = doc.y;
      
      // Pequena indicação visual lateral marrom
      doc.rect(margem, yAtual, 4, 14)
         .fill(CORES.marromPrincipal);

      doc.fillColor(CORES.textoEscuro)
         .font("Helvetica-Bold")
         .fontSize(11)
         .text(texto.toUpperCase(), margem + 10, yAtual + 1);

      doc.moveDown(0.6);
    };

    // Helper: Linha Chave - Valor estilizada
    const linhaChaveValor = (rotulo, valor, x = margem, w = largura) => {
      const valorFormatado = valor == null ? "Não informado" : String(valor);
      
      doc.fillColor(CORES.textoSuave)
         .font("Helvetica")
         .fontSize(8.5)
         .text(rotulo, x, doc.y, { width: w * 0.55, continued: true });

      doc.fillColor(CORES.textoEscuro)
         .font("Helvetica-Bold")
         .text(valorFormatado, { align: "right" });

      doc.moveDown(0.2);
    };

    // Header reduzido para páginas secundárias
    const desenharCabecalhoSimplificado = () => {
      doc.fillColor(CORES.textoSuave)
         .font("Helvetica")
         .fontSize(8)
         .text("ESSENZA ÍNTIMAS — RELATÓRIO DE VENDAS", margem, 20);
      
      doc.moveTo(margem, 32)
         .lineTo(doc.page.width - margem, 32)
         .strokeColor(CORES.bordaSuave)
         .lineWidth(0.5)
         .stroke();

      doc.y = 45;
    };

    // ==========================================
    // 1. CABEÇALHO PRINCIPAL DA MARCA
    // ==========================================
    const yInicio = doc.y;

    // Monograma da Logo "E" em círculo (Estilo foto[cite: 1])
    doc.circle(margem + 18, yInicio + 18, 18)
       .lineWidth(1)
       .strokeColor(CORES.marromPrincipal)
       .stroke();

    doc.fillColor(CORES.marromPrincipal)
       .font("Helvetica")
       .fontSize(16)
       .text("E", margem + 12, yInicio + 11);

    // Texto da Marca
    doc.fillColor(CORES.textoEscuro)
       .font("Helvetica-Bold")
       .fontSize(14)
       .text("ESSENZA", margem + 45, yInicio + 7);

    doc.fillColor(CORES.textoSuave)
       .font("Helvetica")
       .fontSize(8)
       .text("Í N T I M A S", margem + 46, yInicio + 22);

    // Etiqueta de Subtítulo do Topo
    doc.fillColor(CORES.textoSuave)
       .font("Helvetica")
       .fontSize(8)
       .text("GESTÃO COMERCIAL", margem, yInicio + 48);

    doc.fillColor(CORES.textoEscuro)
       .font("Helvetica-Bold")
       .fontSize(18)
       .text("Relatório de Vendas", margem, yInicio + 58);

    doc.moveDown(0.8);

    // Card de Informações do Período
    const yCardHeader = doc.y;
    doc.roundedRect(margem, yCardHeader, largura, 45, 6)
       .fillAndStroke(CORES.fundoCard, CORES.bordaSuave);

    doc.y = yCardHeader + 8;
    linhaChaveValor("Empresa ID", relatorio.empresa?.companyId, margem + 12, largura - 24);
    linhaChaveValor("Período", `${relatorio.periodo.dataInicio} até ${relatorio.periodo.dataFim}`, margem + 12, largura - 24);
    linhaChaveValor("Gerado em", this.formatarData(relatorio.geradoEm), margem + 12, largura - 24);

    doc.y = yCardHeader + 55;

    // ==========================================
    // 2. RESUMO FINANCEIRO
    // ==========================================
    tituloSecao("Resumo Financeiro");

    const itensResumo = [
      ["Qtd. de vendas consideradas", resumo.quantidadeVendasConcluidas ?? 0],
      ["Subtotal", this.formatarMoeda(resumo.subtotal)],
      ["Descontos", this.formatarMoeda(resumo.descontos)],
      ["Acréscimos", this.formatarMoeda(resumo.acrescimos)],
      ["Total vendido antes das devoluções", this.formatarMoeda(resumo.totalVendidoAntesDevolucoes)],
      ["Devoluções registradas", this.formatarMoeda(resumo.devolucoesRegistradas)],
      ["Vendas líquidas após devoluções", this.formatarMoeda(resumo.vendasLiquidasAposDevolucoes)],
      ["Custo total registrado", this.formatarMoeda(resumo.custoTotalRegistrado)],
      ["Lucro bruto antes das devoluções", this.formatarMoeda(resumo.lucroBrutoAntesDevolucoes)],
      ["Ticket médio", this.formatarMoeda(resumo.ticketMedio)],
    ];

    for (const [rotulo, valor] of itensResumo) {
      garantirEspaco(18);
      linhaChaveValor(rotulo, valor);
    }

    // ==========================================
    // 3. CONCILIAÇÃO DE RECEBIMENTOS
    // ==========================================
    tituloSecao("Conciliação de Recebimentos");

    linhaChaveValor("Recebimentos com status PAGO", this.formatarMoeda(conciliacao.recebimentoConfirmado));
    linhaChaveValor("Pagamentos pendentes", this.formatarMoeda(conciliacao.pagamentosPendentes));
    linhaChaveValor("Pagamentos falhos", this.formatarMoeda(conciliacao.pagamentosFalhos));
    linhaChaveValor("Pagamentos marcados como estornados", this.formatarMoeda(conciliacao.valoresDePagamentosMarcadosEstornados));
    linhaChaveValor(
      "Recebimento líquido após devoluções",
      conciliacao.recebimentoLiquidoAposDevolucoes == null
        ? "Não conciliado automaticamente"
        : this.formatarMoeda(conciliacao.recebimentoLiquidoAposDevolucoes)
    );

    if (conciliacao.conciliacaoAutomaticaCompleta === false) {
      doc.moveDown(0.5);
      const yAlerta = doc.y;
      
      doc.roundedRect(margem, yAlerta, largura, 20 + (conciliacao.pendencias?.length || 0) * 12, 4)
         .fill("#FFF8F5");

      doc.fillColor("#9E4A3A")
         .font("Helvetica-Bold")
         .fontSize(8.5)
         .text("ATENÇÃO: conciliação financeira incompleta.", margem + 10, yAlerta + 6);

      doc.font("Helvetica").fontSize(8);
      for (const pendencia of conciliacao.pendencias || []) {
        doc.fillColor("#7A3528").text(`• ${pendencia}`, margem + 12);
      }
      doc.moveDown(0.5);
    }

    // ==========================================
    // 4. RECEBIMENTOS POR FORMA DE PAGAMENTO
    // ==========================================
    tituloSecao("Recebimentos por Forma de Pagamento");

    if (pagamentos.length === 0) {
      doc.fillColor(CORES.textoSuave).text("Nenhum recebimento confirmado no período.");
    } else {
      for (const pagamento of pagamentos) {
        garantirEspaco(20);
        linhaChaveValor(
          pagamento.metodo,
          `${this.formatarMoeda(pagamento.valorRecebido)} (${pagamento.quantidadeTransacoes} transação/ões)`
        );
      }
    }

    // ==========================================
    // 5. OCORRÊNCIAS
    // ==========================================
    tituloSecao("Ocorrências");

    const ocorrencias = relatorio.ocorrencias || {};
    linhaChaveValor("Vendas canceladas", ocorrencias.vendasCanceladas ?? 0);
    linhaChaveValor("Valor original das vendas canceladas", this.formatarMoeda(ocorrencias.valorVendasCanceladas));
    linhaChaveValor("Vendas pendentes", ocorrencias.vendasPendentes ?? 0);
    linhaChaveValor("Vendas devolvidas", ocorrencias.vendasDevolvidas ?? 0);
    linhaChaveValor("Vendas parcialmente devolvidas", ocorrencias.vendasParcialmenteDevolvidas ?? 0);
    linhaChaveValor("Valor das devoluções registradas", this.formatarMoeda(ocorrencias.valorDevolucoesRegistradas));

    // ==========================================
    // 6. DETALHAMENTO DAS VENDAS
    // ==========================================
    tituloSecao("Detalhamento das Vendas");

    for (const venda of vendas) {
      garantirEspaco(90);

      const yVenda = doc.y;

      // Card para cada Venda
      doc.roundedRect(margem, yVenda, largura, 18, 3)
         .fill(CORES.fundoCard);

      doc.fillColor(CORES.marromPrincipal)
         .font("Helvetica-Bold")
         .fontSize(9)
         .text(`Venda #${venda.id || "S/I"}`, margem + 8, yVenda + 4);

      doc.fillColor(CORES.textoEscuro)
         .font("Helvetica")
         .fontSize(8)
         .text(
           `${this.formatarData(venda.dataVenda)} | Status: ${venda.status}`,
           margem + 8,
           yVenda + 4,
           { align: "right", width: largura - 16 }
         );

      doc.y = yVenda + 24;

      linhaChaveValor("Operador", venda.operador?.nome || "Não informado");
      linhaChaveValor("Cliente", venda.cliente?.nome || "Não informado");

      // Tabela interna de itens
      if (venda.itens?.length) {
        doc.moveDown(0.2);
        for (const item of venda.itens) {
          garantirEspaco(16);
          doc.fillColor(CORES.textoSuave)
             .font("Helvetica")
             .fontSize(8)
             .text(
               `  • ${item.nome || "Produto"} (${item.quantidade}x ${this.formatarMoeda(item.precoUnitario)})`,
               margem,
               doc.y,
               { continued: true }
             );

          doc.fillColor(CORES.textoEscuro)
             .font("Helvetica-Bold")
             .text(this.formatarMoeda(item.total), { align: "right" });
        }
      }

      linhaChaveValor("Total da Venda", this.formatarMoeda(venda.total));
      linhaChaveValor("Devolução Registrada", this.formatarMoeda(venda.valorDevolvido));

      if (venda.motivoCancelamento) {
        doc.fillColor("#9E4A3A")
           .fontSize(8)
           .text(`Motivo cancelamento: ${venda.motivoCancelamento}`);
      }

      doc.moveDown(0.6);
    }

    // ==========================================
    // 7. RODAPÉ E NUMERAÇÃO DE PÁGINAS DINÂMICA
    // ==========================================
    const totalPaginas = doc.bufferedPageRange().count;

    for (let i = 0; i < totalPaginas; i++) {
      doc.switchToPage(i);

      // Linha do rodapé
      doc.moveTo(margem, doc.page.height - 30)
         .lineTo(doc.page.width - margem, doc.page.height - 30)
         .strokeColor(CORES.bordaSuave)
         .lineWidth(0.5)
         .stroke();

      // Texto do Rodapé
      doc.fillColor(CORES.textoSuave)
         .font("Helvetica")
         .fontSize(7.5)
         .text(
           "Essenza Íntimas — Documento Gerencial Confidencial",
           margem,
           doc.page.height - 22
         );

      doc.text(
        `Página ${i + 1} de ${totalPaginas}`,
        margem,
        doc.page.height - 22,
        { align: "right", width: largura }
      );
    }

    doc.end();
  } catch (erro) {
    if (doc && !res.headersSent) {
      doc.destroy();
    }

    if (res.headersSent) {
      return res.destroy(erro);
    }

    return next(erro);
  }
}
}

module.exports = RelatorioVendasController;