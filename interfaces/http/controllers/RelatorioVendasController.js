
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
        margin: 45,
        bufferPages: true,
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

      const margem = 45;
      const largura = doc.page.width - margem * 2;
      const resumo = relatorio.resumo || {};
      const conciliacao = relatorio.conciliacao || {};
      const pagamentos = relatorio.pagamentos || [];
      const vendas = relatorio.vendas || [];

      const titulo = (texto) => {
        doc.moveDown(0.8);
        doc.font("Helvetica-Bold").fontSize(13).text(texto);
        doc.moveDown(0.3);
        doc.font("Helvetica").fontSize(9);
      };

      const linha = (rotulo, valor) => {
        doc.font("Helvetica-Bold").text(`${rotulo}: `, {
          continued: true,
        });

        doc.font("Helvetica").text(
          valor == null ? "Não informado" : String(valor)
        );
      };

      const garantirEspaco = (altura = 60) => {
        if (doc.y + altura > doc.page.height - margem) {
          doc.addPage();
        }
      };

      doc.font("Helvetica-Bold")
        .fontSize(20)
        .text("ESSENZA ÍNTIMAS");

      doc.moveDown(0.3);
      doc.fontSize(15).text("Relatório de vendas");
      doc.moveDown(0.5);

      doc.font("Helvetica").fontSize(9);

      linha("Empresa ID", relatorio.empresa?.companyId);
      linha(
        "Período",
        `${relatorio.periodo.dataInicio} até ${relatorio.periodo.dataFim}`
      );
      linha("Fuso horário", relatorio.periodo.timezone);
      linha("Gerado em", this.formatarData(relatorio.geradoEm));

      titulo("Resumo financeiro");

      linha(
        "Quantidade de vendas consideradas",
        resumo.quantidadeVendasConcluidas ?? 0
      );
      linha("Subtotal", this.formatarMoeda(resumo.subtotal));
      linha("Descontos", this.formatarMoeda(resumo.descontos));
      linha("Acréscimos", this.formatarMoeda(resumo.acrescimos));
      linha(
        "Total vendido antes das devoluções",
        this.formatarMoeda(resumo.totalVendidoAntesDevolucoes)
      );
      linha(
        "Devoluções registradas",
        this.formatarMoeda(resumo.devolucoesRegistradas)
      );
      linha(
        "Vendas após devoluções registradas",
        this.formatarMoeda(resumo.vendasLiquidasAposDevolucoes)
      );
      linha(
        "Custo total registrado",
        this.formatarMoeda(resumo.custoTotalRegistrado)
      );
      linha(
        "Lucro bruto antes das devoluções",
        this.formatarMoeda(resumo.lucroBrutoAntesDevolucoes)
      );
      linha(
        "Ticket médio",
        this.formatarMoeda(resumo.ticketMedio)
      );

      titulo("Conciliação de recebimentos");

      linha(
        "Recebimentos com status PAGO",
        this.formatarMoeda(conciliacao.recebimentoConfirmado)
      );
      linha(
        "Pagamentos pendentes",
        this.formatarMoeda(conciliacao.pagamentosPendentes)
      );
      linha(
        "Pagamentos falhos",
        this.formatarMoeda(conciliacao.pagamentosFalhos)
      );
      linha(
        "Pagamentos marcados como estornados",
        this.formatarMoeda(
          conciliacao.valoresDePagamentosMarcadosEstornados
        )
      );
      linha(
        "Recebimento líquido após devoluções",
        conciliacao.recebimentoLiquidoAposDevolucoes == null
          ? "Não conciliado automaticamente"
          : this.formatarMoeda(
              conciliacao.recebimentoLiquidoAposDevolucoes
            )
      );

      doc.moveDown(0.3);

      if (conciliacao.conciliacaoAutomaticaCompleta === false) {
        doc.font("Helvetica-Bold")
          .fontSize(9)
          .text("ATENÇÃO: conciliação financeira incompleta.", {
            width: largura,
          });

        doc.font("Helvetica").fontSize(8);

        for (const pendencia of conciliacao.pendencias || []) {
          doc.text(`• ${pendencia}`, {
            width: largura,
            indent: 8,
          });
        }
      }

      titulo("Recebimentos por forma de pagamento");

      if (pagamentos.length === 0) {
        doc.text("Nenhum recebimento confirmado no período.");
      } else {
        for (const pagamento of pagamentos) {
          garantirEspaco(25);

          linha(
            pagamento.metodo,
            `${this.formatarMoeda(pagamento.valorRecebido)} — ` +
              `${pagamento.quantidadeTransacoes} transação(ões)`
          );
        }
      }

      titulo("Ocorrências");

      const ocorrencias = relatorio.ocorrencias || {};

      linha("Vendas canceladas", ocorrencias.vendasCanceladas ?? 0);
      linha(
        "Valor original das vendas canceladas",
        this.formatarMoeda(ocorrencias.valorVendasCanceladas)
      );
      linha("Vendas pendentes", ocorrencias.vendasPendentes ?? 0);
      linha("Vendas devolvidas", ocorrencias.vendasDevolvidas ?? 0);
      linha(
        "Vendas parcialmente devolvidas",
        ocorrencias.vendasParcialmenteDevolvidas ?? 0
      );
      linha(
        "Valor das devoluções registradas",
        this.formatarMoeda(ocorrencias.valorDevolucoesRegistradas)
      );

      titulo("Detalhamento das vendas");

      for (const venda of vendas) {
        garantirEspaco(110);

        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").fontSize(9).text(
          `Venda ${venda.id || "sem identificador"}`
        );

        doc.font("Helvetica").fontSize(8);

        linha("Data", this.formatarData(venda.dataVenda));
        linha("Status", venda.status);
        linha("Operador", venda.operador?.nome || "Não informado");
        linha("Cliente", venda.cliente?.nome || "Não informado");

        for (const item of venda.itens || []) {
          garantirEspaco(25);

          doc.text(
            `• ${item.nome || "Produto"} — ` +
            `Qtd.: ${item.quantidade} — ` +
            `Unitário: ${this.formatarMoeda(item.precoUnitario)} — ` +
            `Total: ${this.formatarMoeda(item.total)}`,
            { width: largura }
          );
        }

        linha("Total da venda", this.formatarMoeda(venda.total));
        linha(
          "Devolução registrada",
          this.formatarMoeda(venda.valorDevolvido)
        );
        linha(
          "Recebimento confirmado",
          this.formatarMoeda(
            venda.financeiro?.recebidoConfirmado
          )
        );

        if (venda.pagamentos?.length) {
          const resumoPagamentos = venda.pagamentos
            .map(
              (p) =>
                `${p.metodo || "Método não informado"}: ` +
                `${this.formatarMoeda(p.valor)} (${p.status || "sem status"})`
            )
            .join("; ");

          doc.text(`Pagamentos: ${resumoPagamentos}`, {
            width: largura,
          });
        }

        if (venda.motivoCancelamento) {
          doc.text(
            `Motivo do cancelamento: ${venda.motivoCancelamento}`,
            { width: largura }
          );
        }

        doc.moveDown(0.5);
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