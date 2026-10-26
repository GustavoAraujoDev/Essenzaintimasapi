
"use strict";

class GerarRelatorioVendasUseCase {
  constructor(vendaRepository) {
    if (!vendaRepository) {
      throw new Error(
        "O repositório de vendas é obrigatório."
      );
    }

    this.vendaRepository = vendaRepository;
  }

  // ==========================================================
  // DATAS
  // Recebe YYYY-MM-DD e considera o fuso de Fortaleza (UTC-3).
  // ==========================================================

  normalizarData(data, campo, finalDoDia = false) {
    if (
      typeof data !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data)
    ) {
      throw new Error(
        `${campo} deve estar no formato YYYY-MM-DD.`
      );
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

  arredondar(valor) {
    const numero = Number(valor) || 0;
    return Math.round((numero + Number.EPSILON) * 100) / 100;
  }

  // ==========================================================
  // EXECUÇÃO
  // contexto: identidade validada pelo backend.
  // filtros: dataInicio, dataFim e filtros opcionais.
  // ==========================================================

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

    // Relatório contábil: acesso restrito a ADMIN/OWNER.
    // A identidade e o papel devem vir do backend/JWT validado.
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

    const { dataInicio, dataFim } = filtros;

    const inicio = this.normalizarData(
      dataInicio,
      "dataInicio"
    );

    const fim = this.normalizarData(
      dataFim,
      "dataFim",
      true
    );

    if (inicio > fim) {
      throw new Error(
        "A data inicial não pode ser posterior à data final."
      );
    }

    // Nunca aceita companyId enviado pelo frontend.
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

    const companyId = contexto.companyId;

    // ========================================================
    // 1. CONSOLIDA OS INDICADORES
    // ========================================================

    const [
      estatisticas,
      pagamentos,
      statusVendas,
      produtos,
    ] = await Promise.all([
      this.vendaRepository.obterEstatisticas(
        companyId,
        filtrosConsulta
      ),

      this.vendaRepository.obterVendasPorPagamento(
        companyId,
        filtrosConsulta
      ),

      this.vendaRepository.contarPorStatus(
        companyId,
        filtrosConsulta
      ),

      this.vendaRepository.obterProdutosMaisVendidos(
        companyId,
        filtrosConsulta,
        100
      ),
    ]);

    // ========================================================
    // 2. BUSCA TODAS AS VENDAS DO PERÍODO
    // Não limita o relatório às primeiras 100 vendas.
    // ========================================================

    const vendas = [];
    let pagina = 1;
    let totalRegistros = 0;

    do {
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
          "Não foi possível consultar as vendas do período."
        );
      }

      vendas.push(...resultado.vendas);

      totalRegistros = resultado.paginacao.total;
      pagina++;

      if (vendas.length >= totalRegistros) {
        break;
      }

      if (resultado.vendas.length === 0) {
        throw new Error(
          "A consulta das vendas foi interrompida antes de concluir."
        );
      }
    } while (vendas.length < totalRegistros);

    // ========================================================
    // 3. RESUMO DE STATUS
    // ========================================================

    const statusMap = Object.fromEntries(
      statusVendas.map((item) => [
        item._id,
        {
          quantidade: item.quantidade,
          valorTotal: this.arredondar(item.valorTotal),
        },
      ])
    );

    const canceladas = statusMap.CANCELADA || {
      quantidade: 0,
      valorTotal: 0,
    };

    const pendentes = statusMap.PENDENTE || {
      quantidade: 0,
      valorTotal: 0,
    };

    const devolvidas = statusMap.DEVOLVIDA || {
      quantidade: 0,
      valorTotal: 0,
    };

    const parcialmenteDevolvidas =
      statusMap.PARCIALMENTE_DEVOLVIDA || {
        quantidade: 0,
        valorTotal: 0,
      };

    // ========================================================
    // 4. DETALHAMENTO DAS VENDAS
    // ========================================================

    const detalhamento = vendas.map((venda) => ({
      id: venda.id,
      dataVenda: venda.dataVenda,
      status: venda.status,
      origem: venda.origem,
      operador: {
        id: venda.operadorId,
        nome: venda.operadorNome || null,
      },
      cliente: {
        id: venda.cliente?.id || null,
        nome: venda.cliente?.nome || null,
      },
      itens: (venda.itens || []).map((item) => ({
        productId: item.productId,
        sku: item.sku || null,
        nome: item.nome,
        categoria: item.categoria,
        quantidade: item.quantidade,
        precoUnitario: this.arredondar(
          item.precoUnitario
        ),
        desconto: this.arredondar(item.desconto),
        total: this.arredondar(item.total),
      })),
      subtotal: this.arredondar(venda.subtotal),
      desconto: this.arredondar(venda.desconto),
      acrescimo: this.arredondar(venda.acrescimo),
      total: this.arredondar(venda.total),
      valorDevolvido: this.arredondar(
        venda.valorDevolvido
      ),
      pagamentos: (venda.pagamentos || []).map(
        (pagamento) => ({
          metodo: pagamento.metodo,
          valor: this.arredondar(pagamento.valor),
          status: pagamento.status,
          parcelas: pagamento.parcelas || 1,
        })
      ),
      motivoCancelamento:
        venda.motivoCancelamento || null,
      canceladaEm: venda.canceladaEm || null,
    }));

    // ========================================================
    // 5. RETORNO DO RELATÓRIO GERENCIAL
    // ========================================================

    return {
      geradoEm: new Date().toISOString(),

      empresa: {
        companyId,
      },

      periodo: {
        dataInicio,
        dataFim,
        timezone: "America/Fortaleza",
      },

      resumo: {
        vendasConcluidas:
          estatisticas.quantidadeVendas || 0,

        faturamentoBruto: this.arredondar(
          estatisticas.faturamentoBruto
        ),

        descontos: this.arredondar(
          estatisticas.descontos
        ),

        acrescimos: this.arredondar(
          estatisticas.acrescimos
        ),

        faturamentoLiquidoGerencial:
          this.arredondar(
            estatisticas.faturamentoLiquido
          ),

        custoTotal: this.arredondar(
          estatisticas.custoTotal
        ),

        lucroBruto: this.arredondar(
          estatisticas.lucroBruto
        ),

        ticketMedio: this.arredondar(
          estatisticas.ticketMedio
        ),

        unidadesVendidas:
          estatisticas.unidadesVendidas || 0,
      },

      ocorrencias: {
        vendasCanceladas: canceladas.quantidade,
        valorVendasCanceladas: canceladas.valorTotal,

        vendasPendentes: pendentes.quantidade,
        valorVendasPendentes: pendentes.valorTotal,

        vendasDevolvidas: devolvidas.quantidade,
        valorVendasDevolvidas: devolvidas.valorTotal,

        vendasParcialmenteDevolvidas:
          parcialmenteDevolvidas.quantidade,
      },

      pagamentos: pagamentos.map((item) => ({
        metodo: item._id,
        quantidadeTransacoes: item.quantidadeTransacoes,
        valorRecebido: this.arredondar(
          item.valorRecebido
        ),
      })),

      produtosMaisVendidos: produtos.map((item) => ({
        productId: item._id,
        nome: item.nome,
        categoria: item.categoria,
        quantidadeVendida: item.quantidadeVendida,
        receita: this.arredondar(item.receita),
        custo: this.arredondar(item.custo),
        lucroBruto: this.arredondar(item.lucroBruto),
      })),

      totalRegistros: detalhamento.length,

      vendas: detalhamento,
    };
  }
}

module.exports = GerarRelatorioVendasUseCase;
