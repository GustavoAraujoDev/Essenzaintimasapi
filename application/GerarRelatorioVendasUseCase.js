"use strict";

const STATUS_VENDAS_VALIDAS = new Set([
  "CONCLUIDA",
  "PARCIALMENTE_DEVOLVIDA",
  "DEVOLVIDA",
]);

const STATUS_PAGAMENTO_RECEBIDO = "PAGO";

class GerarRelatorioVendasUseCase {
  constructor(vendaRepository) {
    if (!vendaRepository || typeof vendaRepository.listar !== "function") {
      throw new Error(
        "O repositório de vendas é obrigatório e deve implementar listar()."
      );
    }

    this.vendaRepository = vendaRepository;
  }

  normalizarData(data, campo, finalDoDia = false) {
    if (
      typeof data !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data)
    ) {
      throw new Error(`${campo} deve estar no formato YYYY-MM-DD.`);
    }

    const [ano, mes, dia] = data.split("-").map(Number);
    const verificacao = new Date(Date.UTC(ano, mes - 1, dia));

    if (
      verificacao.getUTCFullYear() !== ano ||
      verificacao.getUTCMonth() !== mes - 1 ||
      verificacao.getUTCDate() !== dia
    ) {
      throw new Error(`${campo} contém uma data inválida.`);
    }

    const horario = finalDoDia
      ? "T23:59:59.999-03:00"
      : "T00:00:00.000-03:00";

    return new Date(`${data}${horario}`);
  }

  numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  }

  dinheiro(valor) {
    return Math.round((this.numero(valor) + Number.EPSILON) * 100) / 100;
  }

  texto(valor) {
    return valor == null ? "" : String(valor);
  }

  arredondarQuantidade(valor) {
    return Math.round((this.numero(valor) + Number.EPSILON) * 10000) / 10000;
  }

  obterId(venda) {
    return venda.id || venda._id?.toString?.() || null;
  }

  obterData(venda) {
    const data = venda.dataVenda || venda.createdAt || null;
    return data ? new Date(data) : null;
  }

  calcularPagamento(pagamentos = []) {
    const resultado = {
      recebidoConfirmado: 0,
      pagamentosPendentes: 0,
      pagamentosFalhos: 0,
      pagamentosEstornados: 0,
      pagamentosPagos: 0,
      porMetodo: new Map(),
    };

    for (const pagamento of pagamentos) {
      const status = String(pagamento.status || "").toUpperCase();
      const metodo = String(pagamento.metodo || "NAO_INFORMADO").toUpperCase();
      const valor = this.dinheiro(pagamento.valor);

      if (status === "PAGO") {
        resultado.recebidoConfirmado += valor;
        resultado.pagamentosPagos += 1;

        const atual = resultado.porMetodo.get(metodo) || {
          metodo,
          quantidadeTransacoes: 0,
          valorRecebido: 0,
        };

        atual.quantidadeTransacoes += 1;
        atual.valorRecebido = this.dinheiro(atual.valorRecebido + valor);
        resultado.porMetodo.set(metodo, atual);
      } else if (status === "PENDENTE") {
        resultado.pagamentosPendentes += valor;
      } else if (status === "FALHOU") {
        resultado.pagamentosFalhos += valor;
      } else if (status === "ESTORNADO") {
        // Não soma como recebimento.
        // O valor do estorno não é necessariamente o valor efetivamente
        // estornado; o schema atual não informa esse montante separadamente.
        resultado.pagamentosEstornados += valor;
      }
    }

    resultado.recebidoConfirmado = this.dinheiro(
      resultado.recebidoConfirmado
    );
    resultado.pagamentosPendentes = this.dinheiro(
      resultado.pagamentosPendentes
    );
    resultado.pagamentosFalhos = this.dinheiro(
      resultado.pagamentosFalhos
    );
    resultado.pagamentosEstornados = this.dinheiro(
      resultado.pagamentosEstornados
    );

    return resultado;
  }

  async listarTodasAsVendas(filtrosConsulta, companyId) {
    const vendas = [];
    let pagina = 1;
    let totalRegistros = null;

    while (true) {
      const resultado = await this.vendaRepository.listar(
        {
          ...filtrosConsulta,
          companyId,
        },
        {
          pagina,
          limite: 100,
          ordenarPor: "recente",
        }
      );

      if (!resultado || !Array.isArray(resultado.vendas)) {
        throw new Error(
          "O repositório retornou uma resposta inválida ao consultar as vendas."
        );
      }

      const totalInformado = Number(resultado.paginacao?.total);

      if (!Number.isFinite(totalInformado) || totalInformado < 0) {
        throw new Error(
          "O repositório não retornou o total de vendas para a paginação."
        );
      }

      if (totalRegistros === null) {
        totalRegistros = totalInformado;
      }

      vendas.push(...resultado.vendas);

      if (vendas.length >= totalRegistros) {
        break;
      }

      if (resultado.vendas.length === 0) {
        throw new Error(
          "A consulta das vendas terminou antes de recuperar todos os registros."
        );
      }

      pagina += 1;

      if (pagina > Math.ceil(totalRegistros / 100) + 1) {
        throw new Error("A paginação das vendas excedeu o limite esperado.");
      }
    }

    return vendas;
  }

  montarResumo(vendas) {
    const resumo = {
      quantidadeVendasConcluidas: 0,
      unidadesVendidas: 0,
      subtotal: 0,
      descontos: 0,
      acrescimos: 0,
      totalVendidoAntesDevolucoes: 0,
      devolucoesRegistradas: 0,
      vendasLiquidasAposDevolucoes: 0,
      custoTotalRegistrado: 0,
      lucroBrutoAntesDevolucoes: 0,
      recebidoConfirmado: 0,
      pagamentosPendentes: 0,
      pagamentosFalhos: 0,
      pagamentosEstornadosRegistrados: 0,
      ticketMedio: 0,
    };

    const pagamentosPorMetodo = new Map();
    const status = new Map();

    for (const venda of vendas) {
      const situacao = String(venda.status || "NAO_INFORMADO").toUpperCase();
      const total = this.dinheiro(venda.total);
      const valorDevolvido = Math.max(
        0,
        this.dinheiro(venda.valorDevolvido)
      );

      const contador = status.get(situacao) || {
        quantidade: 0,
        valorTotal: 0,
      };

      contador.quantidade += 1;
      contador.valorTotal = this.dinheiro(contador.valorTotal + total);
      status.set(situacao, contador);

      // Canceladas e pendentes não entram no total de vendas realizadas.
      if (!STATUS_VENDAS_VALIDAS.has(situacao)) {
        continue;
      }

      resumo.quantidadeVendasConcluidas += 1;
      resumo.subtotal += this.numero(venda.subtotal);
      resumo.descontos += this.numero(venda.desconto);
      resumo.acrescimos += this.numero(venda.acrescimo);
      resumo.totalVendidoAntesDevolucoes += total;
      resumo.devolucoesRegistradas += valorDevolvido;
      resumo.custoTotalRegistrado += this.numero(venda.custoTotal);

      for (const item of venda.itens || []) {
        resumo.unidadesVendidas += this.numero(item.quantidade);
      }

      const financeiro = this.calcularPagamento(venda.pagamentos || []);

      resumo.recebidoConfirmado += financeiro.recebidoConfirmado;
      resumo.pagamentosPendentes += financeiro.pagamentosPendentes;
      resumo.pagamentosFalhos += financeiro.pagamentosFalhos;
      resumo.pagamentosEstornadosRegistrados +=
        financeiro.pagamentosEstornados;

      for (const [metodo, pagamento] of financeiro.porMetodo) {
        const atual = pagamentosPorMetodo.get(metodo) || {
          metodo,
          quantidadeTransacoes: 0,
          valorRecebido: 0,
        };

        atual.quantidadeTransacoes += pagamento.quantidadeTransacoes;
        atual.valorRecebido = this.dinheiro(
          atual.valorRecebido + pagamento.valorRecebido
        );

        pagamentosPorMetodo.set(metodo, atual);
      }
    }

    for (const campo of [
      "subtotal",
      "descontos",
      "acrescimos",
      "totalVendidoAntesDevolucoes",
      "devolucoesRegistradas",
      "custoTotalRegistrado",
      "recebidoConfirmado",
      "pagamentosPendentes",
      "pagamentosFalhos",
      "pagamentosEstornadosRegistrados",
    ]) {
      resumo[campo] = this.dinheiro(resumo[campo]);
    }

    resumo.vendasLiquidasAposDevolucoes = this.dinheiro(
      resumo.totalVendidoAntesDevolucoes - resumo.devolucoesRegistradas
    );

    resumo.lucroBrutoAntesDevolucoes = this.dinheiro(
      resumo.totalVendidoAntesDevolucoes - resumo.custoTotalRegistrado
    );

    resumo.ticketMedio = resumo.quantidadeVendasConcluidas > 0
      ? this.dinheiro(
          resumo.totalVendidoAntesDevolucoes /
          resumo.quantidadeVendasConcluidas
        )
      : 0;

    return {
      resumo,
      status: Array.from(status, ([situacao, valores]) => ({
        status: situacao,
        quantidade: valores.quantidade,
        valorTotal: this.dinheiro(valores.valorTotal),
      })),
      pagamentos: Array.from(pagamentosPorMetodo.values()),
    };
  }

  montarProdutos(vendas) {
    const produtos = new Map();

    for (const venda of vendas) {
      const status = String(venda.status || "").toUpperCase();

      if (!STATUS_VENDAS_VALIDAS.has(status)) {
        continue;
      }

      for (const item of venda.itens || []) {
        const chave = [
          item.productId || "",
          item.sku || "",
          item.nome || "",
        ].join("|");

        const atual = produtos.get(chave) || {
          productId: item.productId || null,
          sku: item.sku || null,
          nome: item.nome || "Produto sem nome",
          categoria: item.categoria || null,
          quantidadeVendida: 0,
          receita: 0,
          custo: 0,
        };

        atual.quantidadeVendida += this.numero(item.quantidade);
        atual.receita += this.numero(item.total);
        atual.custo += this.numero(item.custoTotal);

        produtos.set(chave, atual);
      }
    }

    return Array.from(produtos.values())
      .map((produto) => ({
        ...produto,
        quantidadeVendida: this.arredondarQuantidade(
          produto.quantidadeVendida
        ),
        receita: this.dinheiro(produto.receita),
        custo: this.dinheiro(produto.custo),
        lucroBruto: this.dinheiro(produto.receita - produto.custo),
      }))
      .sort((a, b) => b.quantidadeVendida - a.quantidadeVendida)
      .slice(0, 100);
  }

  montarDetalhamento(vendas) {
    return vendas.map((venda) => {
      const financeiro = this.calcularPagamento(venda.pagamentos || []);
      const data = this.obterData(venda);

      return {
        id: this.obterId(venda),
        dataVenda: data && !Number.isNaN(data.getTime())
          ? data.toISOString()
          : null,
        status: venda.status || "NAO_INFORMADO",
        origem: venda.origem || null,

        operador: {
          id: venda.operadorId || null,
          nome: venda.operadorNome || null,
        },

        cliente: {
          id: venda.cliente?.id || null,
          nome: venda.cliente?.nome || null,
        },

        itens: (venda.itens || []).map((item) => ({
          productId: item.productId || null,
          sku: item.sku || null,
          nome: item.nome || "Produto sem nome",
          categoria: item.categoria || null,
          quantidade: this.arredondarQuantidade(item.quantidade),
          precoUnitario: this.dinheiro(item.precoUnitario),
          desconto: this.dinheiro(item.desconto),
          total: this.dinheiro(item.total),
        })),

        subtotal: this.dinheiro(venda.subtotal),
        desconto: this.dinheiro(venda.desconto),
        acrescimo: this.dinheiro(venda.acrescimo),
        total: this.dinheiro(venda.total),
        custoTotal: this.dinheiro(venda.custoTotal),
        lucroBrutoRegistrado: this.dinheiro(venda.lucroBruto),

        valorDevolvido: Math.max(
          0,
          this.dinheiro(venda.valorDevolvido)
        ),

        financeiro: {
          recebidoConfirmado: financeiro.recebidoConfirmado,
          pagamentosPendentes: financeiro.pagamentosPendentes,
          pagamentosFalhos: financeiro.pagamentosFalhos,
          pagamentosEstornadosRegistrados:
            financeiro.pagamentosEstornados,
        },

        pagamentos: (venda.pagamentos || []).map((pagamento) => ({
          metodo: pagamento.metodo || "NAO_INFORMADO",
          valor: this.dinheiro(pagamento.valor),
          status: pagamento.status || "NAO_INFORMADO",
          parcelas: pagamento.parcelas || 1,
          referencia: pagamento.referencia || null,
        })),

        motivoCancelamento: venda.motivoCancelamento || null,
        canceladaPor: venda.canceladaPor || null,
        canceladaEm: venda.canceladaEm || null,
      };
    });
  }

  async execute(contexto, filtros = {}) {
    if (!contexto || !contexto.companyId) {
      throw new Error(
        "Empresa não identificada no contexto autenticado."
      );
    }

    const userId =
      contexto.userId ||
      contexto.id ||
      contexto.user?.userId ||
      contexto.user?.id;

    if (!userId) {
      throw new Error("Usuário não identificado.");
    }

    const papel = String(
      contexto.membership?.role ||
      contexto.role ||
      contexto.globalRole ||
      ""
    ).toUpperCase();

    if (!["ADMIN", "OWNER"].includes(papel)) {
      throw new Error(
        "Você não tem permissão para gerar relatórios contábeis."
      );
    }

    const inicio = this.normalizarData(
      filtros.dataInicio,
      "dataInicio"
    );

    const fim = this.normalizarData(
      filtros.dataFim,
      "dataFim",
      true
    );

    if (inicio > fim) {
      throw new Error(
        "A data inicial não pode ser posterior à data final."
      );
    }

    // O companyId vem exclusivamente do contexto autenticado.
    const companyId = contexto.companyId;

    const filtrosConsulta = {
      dataInicio: inicio,
      dataFim: fim,
    };

    if (filtros.operadorId) {
      filtrosConsulta.operadorId = filtros.operadorId;
    }

    if (filtros.caixaId) {
      filtrosConsulta.caixaId = filtros.caixaId;
    }

    const vendas = await this.listarTodasAsVendas(
      filtrosConsulta,
      companyId
    );

    const { resumo, status, pagamentos } = this.montarResumo(vendas);
    const detalhamento = this.montarDetalhamento(vendas);

    const contagemStatus = Object.fromEntries(
      status.map((item) => [item.status, item])
    );

    const ocorrencias = {
      vendasCanceladas: contagemStatus.CANCELADA?.quantidade || 0,
      valorVendasCanceladas: contagemStatus.CANCELADA?.valorTotal || 0,

      vendasPendentes: contagemStatus.PENDENTE?.quantidade || 0,
      valorVendasPendentes: contagemStatus.PENDENTE?.valorTotal || 0,

      vendasDevolvidas: contagemStatus.DEVOLVIDA?.quantidade || 0,
      valorOriginalVendasDevolvidas:
        contagemStatus.DEVOLVIDA?.valorTotal || 0,

      vendasParcialmenteDevolvidas:
        contagemStatus.PARCIALMENTE_DEVOLVIDA?.quantidade || 0,

      valorDevolucoesRegistradas: resumo.devolucoesRegistradas,
    };

    return {
      versaoRelatorio: 2,
      geradoEm: new Date().toISOString(),

      empresa: {
        companyId,
      },

      periodo: {
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
        timezone: "America/Fortaleza",
      },

      resumo,

      conciliacao: {
        recebimentoConfirmado: resumo.recebidoConfirmado,
        pagamentosPendentes: resumo.pagamentosPendentes,
        pagamentosFalhos: resumo.pagamentosFalhos,
        valoresDePagamentosMarcadosEstornados:
          resumo.pagamentosEstornadosRegistrados,
        devolucoesRegistradas: resumo.devolucoesRegistradas,

        // Não subtrai devoluções automaticamente do recebido confirmado:
        // o schema atual não permite provar se a devolução já foi registrada
        // como estorno em um pagamento. Fazer isso poderia descontar em dobro.
        recebimentoLiquidoAposDevolucoes:
          null,

        conciliacaoAutomaticaCompleta: false,

        pendencias: [
          "Para calcular o recebimento líquido com segurança, registre cada estorno/devolução como evento financeiro com valor, data e referência do pagamento original.",
          "O status ESTORNADO não informa, sozinho, o valor efetivamente estornado.",
          "O campo valorDevolvido não identifica, sozinho, se o dinheiro foi devolvido ao cliente ou se houve apenas devolução de mercadoria.",
        ],
      },

      ocorrencias,

      pagamentos,

      produtosMaisVendidos: this.montarProdutos(vendas),

      totalRegistros: detalhamento.length,

      vendas: detalhamento,
    };
  }
}

module.exports = GerarRelatorioVendasUseCase;