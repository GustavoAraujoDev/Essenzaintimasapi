
const mongoose = require("mongoose");
const VendaRepository = require("../../domain/entities/VendaRepository");

// ============================================================
// SUBSCHEMAS
// ============================================================

const vendaItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      index: true,
    },
    sku: {
      type: String,
      default: null,
    },
    nome: {
      type: String,
      required: true,
      trim: true,
    },
    categoria: {
      type: String,
      default: "SEM_CATEGORIA",
      index: true,
    },
    quantidade: {
      type: Number,
      required: true,
      min: 0.001,
    },
    custoUnitario: {
      type: Number,
      default: 0,
      min: 0,
    },
    precoUnitario: {
      type: Number,
      required: true,
      min: 0,
    },
    desconto: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const pagamentoSchema = new mongoose.Schema(
  {
    metodo: {
      type: String,
      required: true,
      enum: [
        "DINHEIRO",
        "PIX",
        "CARTAO_CREDITO",
        "CARTAO_DEBITO",
        "VALE",
        "OUTRO",
      ],
    },
    valor: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["PENDENTE", "PAGO", "FALHOU", "ESTORNADO"],
      default: "PAGO",
    },
    referencia: {
      type: String,
      default: null,
    },
    parcelas: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { _id: true }
);

const historicoSchema = new mongoose.Schema(
  {
    acao: {
      type: String,
      required: true,
    },
    operadorId: {
      type: String,
      default: null,
    },
    motivo: {
      type: String,
      default: null,
    },
    data: {
      type: Date,
      default: Date.now,
    },
    detalhes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: true }
);

// ============================================================
// VENDA
// ============================================================

const vendaSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    // Funcionário responsável pela operação
    operadorId: {
      type: String,
      required: true,
      index: true,
    },

    // Opcional: identificação para relatórios
    operadorNome: {
      type: String,
      default: null,
    },

    caixaId: {
      type: String,
      default: null,
      index: true,
    },

    cliente: {
      id: { type: String, default: null },
      nome: { type: String, default: null, trim: true },
      telefone: { type: String, default: null },
    },

    itens: {
      type: [vendaItemSchema],
      required: true,
      validate: {
        validator: (itens) => Array.isArray(itens) && itens.length > 0,
        message: "A venda precisa ter pelo menos um item.",
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    desconto: {
      type: Number,
      default: 0,
      min: 0,
    },

    acrescimo: {
      type: Number,
      default: 0,
      min: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    custoTotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    lucroBruto: {
      type: Number,
      default: 0,
    },

    pagamentos: {
      type: [pagamentoSchema],
      required: true,
      validate: {
        validator: (pagamentos) =>
          Array.isArray(pagamentos) && pagamentos.length > 0,
        message: "Informe pelo menos uma forma de pagamento.",
      },
    },

    status: {
      type: String,
      enum: [
        "CONCLUIDA",
        "PENDENTE",
        "CANCELADA",
        "DEVOLVIDA",
        "PARCIALMENTE_DEVOLVIDA",
      ],
      default: "CONCLUIDA",
      index: true,
    },

    origem: {
      type: String,
      enum: ["PDV", "ADMIN"],
      default: "PDV",
      index: true,
    },

    observacoes: {
      type: String,
      default: null,
      maxlength: 2000,
    },

    motivoCancelamento: {
      type: String,
      default: null,
    },

    canceladaPor: {
      type: String,
      default: null,
    },

    canceladaEm: {
      type: Date,
      default: null,
    },

    // Mantém o histórico de auditoria
    historico: {
      type: [historicoSchema],
      default: [],
    },

    // Data efetiva da operação; pode ser usada nos relatórios
    dataVenda: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },

    // Para integração futura com devoluções
    valorDevolvido: {
      type: Number,
      default: 0,
      min: 0,
    },

    quantidadeDevolvida: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: "__v",
  }
);

// ============================================================
// ÍNDICES COMPOSTOS
// ============================================================

vendaSchema.index({ companyId: 1, dataVenda: -1 });
vendaSchema.index({ companyId: 1, status: 1, dataVenda: -1 });
vendaSchema.index({ companyId: 1, operadorId: 1, dataVenda: -1 });
vendaSchema.index({ companyId: 1, "itens.productId": 1, dataVenda: -1 });
vendaSchema.index({ companyId: 1, "pagamentos.metodo": 1, dataVenda: -1 });
vendaSchema.index({ companyId: 1, caixaId: 1, dataVenda: -1 });

// Evita conflito caso o modelo já tenha sido registrado.
const VendaModel =
  mongoose.models.Venda ||
  mongoose.model("Venda", vendaSchema);

// ============================================================
// REPOSITÓRIO
// ============================================================

class VendaRepositoryMongo extends VendaRepository {
  constructor() {
    super();
  }

  // ----------------------------------------------------------
  // UTILITÁRIOS
  // ----------------------------------------------------------

  normalizarData(valor, campo) {
    if (valor === undefined || valor === null || valor === "") {
      return null;
    }

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) {
      throw new Error(`Data inválida no campo ${campo}.`);
    }

    return data;
  }

  montarFiltro(filtros = {}) {
    const {
      companyId,
      operadorId,
      caixaId,
      status,
      metodoPagamento,
      productId,
      categoria,
      clienteId,
      busca,
      dataInicio,
      dataFim,
      valorMinimo,
      valorMaximo,
    } = filtros;

    if (!companyId) {
      throw new Error("companyId é obrigatório para consultar vendas.");
    }

    const filtro = { companyId };

    if (operadorId) filtro.operadorId = operadorId;
    if (caixaId) filtro.caixaId = caixaId;
    if (clienteId) filtro["cliente.id"] = clienteId;

    if (status) {
      const permitidos = [
        "CONCLUIDA",
        "PENDENTE",
        "CANCELADA",
        "DEVOLVIDA",
        "PARCIALMENTE_DEVOLVIDA",
      ];

      if (!permitidos.includes(status)) {
        throw new Error("Status de venda inválido.");
      }

      filtro.status = status;
    }

    if (metodoPagamento) {
      filtro.pagamentos = {
        $elemMatch: {
          metodo: metodoPagamento,
          status: "PAGO",
        },
      };
    }

    if (productId) {
      filtro["itens.productId"] = productId;
    }

    if (categoria) {
      filtro["itens.categoria"] = categoria;
    }

    const inicio = this.normalizarData(dataInicio, "dataInicio");
    const fim = this.normalizarData(dataFim, "dataFim");

    if (inicio || fim) {
      filtro.dataVenda = {};

      if (inicio) filtro.dataVenda.$gte = inicio;
      if (fim) filtro.dataVenda.$lte = fim;

      if (inicio && fim && inicio > fim) {
        throw new Error("dataInicio não pode ser posterior a dataFim.");
      }
    }

    if (valorMinimo !== undefined || valorMaximo !== undefined) {
      filtro.total = {};

      if (valorMinimo !== undefined) {
        const valor = Number(valorMinimo);
        if (!Number.isFinite(valor) || valor < 0) {
          throw new Error("valorMinimo inválido.");
        }
        filtro.total.$gte = valor;
      }

      if (valorMaximo !== undefined) {
        const valor = Number(valorMaximo);
        if (!Number.isFinite(valor) || valor < 0) {
          throw new Error("valorMaximo inválido.");
        }
        filtro.total.$lte = valor;
      }

      if (
        filtro.total.$gte !== undefined &&
        filtro.total.$lte !== undefined &&
        filtro.total.$gte > filtro.total.$lte
      ) {
        throw new Error("valorMinimo não pode superar valorMaximo.");
      }
    }

    if (busca && String(busca).trim()) {
      const termo = String(busca).trim().slice(0, 100);
      const regex = new RegExp(
        termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );

      filtro.$or = [
        { id: regex },
        { "cliente.nome": regex },
        { "cliente.telefone": regex },
        { operadorNome: regex },
        { "itens.nome": regex },
      ];
    }

    return filtro;
  }

  // Relatórios comerciais excluem cancelamentos.
  // Devoluções totais também não contam como venda realizada.
  filtroVendasValidas(companyId, filtros = {}) {
    return {
      ...this.montarFiltro({ ...filtros, companyId }),
      status: {
        $in: ["CONCLUIDA", "PARCIALMENTE_DEVOLVIDA"],
      },
    };
  }

  // ----------------------------------------------------------
  // CRUD
  // ----------------------------------------------------------

  async criar(vendaData) {
    if (!vendaData || !vendaData.companyId) {
      throw new Error("companyId é obrigatório.");
    }

    if (!vendaData.operadorId) {
      throw new Error("operadorId é obrigatório.");
    }

    if (!vendaData.id) {
      throw new Error("O identificador da venda é obrigatório.");
    }

    if (!Array.isArray(vendaData.itens) || vendaData.itens.length === 0) {
      throw new Error("A venda precisa conter itens.");
    }

    if (
      !Array.isArray(vendaData.pagamentos) ||
      vendaData.pagamentos.length === 0
    ) {
      throw new Error("A venda precisa conter pagamentos.");
    }

    // Não confia em valores calculados enviados pelo navegador.
    // O caso de uso deve calcular preços e validar o estoque
    // consultando os produtos reais antes de chamar este método.
    return VendaModel.create({
      ...vendaData,
      historico: [
        ...(vendaData.historico || []),
        {
          acao: "VENDA_CRIADA",
          operadorId: vendaData.operadorId,
          data: new Date(),
        },
      ],
    });
  }

  async buscarPorId(id, companyId) {
    if (!id || !companyId) {
      throw new Error("id e companyId são obrigatórios.");
    }

    const filtro = { companyId };

    if (mongoose.Types.ObjectId.isValid(id)) {
      filtro.$or = [{ _id: id }, { id }];
    } else {
      filtro.id = id;
    }

    const venda = await VendaModel.findOne(filtro);

    if (!venda) throw new Error("Venda não encontrada.");
    return venda;
  }

  async buscarPorCodigo(id, companyId) {
    const venda = await VendaModel.findOne({ id, companyId });

    if (!venda) throw new Error("Venda não encontrada.");
    return venda;
  }

  async listar(filtros = {}, opcoes = {}) {
    const filtro = this.montarFiltro(filtros);

    const pagina = Math.max(1, parseInt(opcoes.pagina, 10) || 1);
    const limite = Math.min(
      100,
      Math.max(1, parseInt(opcoes.limite, 10) || 20)
    );

    const ordenacoes = {
      recente: { dataVenda: -1 },
      antiga: { dataVenda: 1 },
      maior_valor: { total: -1 },
      menor_valor: { total: 1 },
      maior_lucro: { lucroBruto: -1 },
    };

    const ordenacao = ordenacoes[opcoes.ordenarPor] ||
      ordenacoes.recente;

    const [vendas, total] = await Promise.all([
      VendaModel.find(filtro)
        .sort(ordenacao)
        .skip((pagina - 1) * limite)
        .limit(limite)
        .lean(),

      VendaModel.countDocuments(filtro),
    ]);

    return {
      vendas,
      paginacao: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite),
        temProxima: pagina * limite < total,
        temAnterior: pagina > 1,
      },
    };
  }

  async listarPorOperador(companyId, operadorId, filtros = {}) {
    return this.listar(
      { ...filtros, companyId, operadorId },
      filtros.opcoes || {}
    );
  }

  async listarPorStatus(companyId, status, opcoes = {}) {
    return this.listar({ companyId, status }, opcoes);
  }

  async listarPorPeriodo(companyId, dataInicio, dataFim, opcoes = {}) {
    return this.listar(
      { companyId, dataInicio, dataFim },
      opcoes
    );
  }

  async atualizar(id, companyId, dados, operadorId) {
    const permitidos = [
      "cliente",
      "observacoes",
    ];

    const atualizacoes = {};

    for (const campo of permitidos) {
      if (Object.prototype.hasOwnProperty.call(dados, campo)) {
        atualizacoes[campo] = dados[campo];
      }
    }

    if (Object.keys(atualizacoes).length === 0) {
      throw new Error("Nenhum campo permitido para atualização.");
    }

    const venda = await this.buscarPorId(id, companyId);

    if (["CANCELADA", "DEVOLVIDA"].includes(venda.status)) {
      throw new Error("Não é possível editar uma venda encerrada.");
    }

    atualizacoes.$push = {
      historico: {
        acao: "VENDA_ATUALIZADA",
        operadorId: operadorId || null,
        data: new Date(),
        detalhes: { campos: Object.keys(atualizacoes) },
      },
    };

    const atualizada = await VendaModel.findOneAndUpdate(
      { _id: venda._id, companyId },
      { $set: Object.fromEntries(
          Object.entries(atualizacoes).filter(([k]) => k !== "$push")
        ),
        $push: atualizacoes.$push,
      },
      { new: true, runValidators: true }
    );

    if (!atualizada) throw new Error("Venda não encontrada.");
    return atualizada;
  }

  async cancelar(id, companyId, operadorId, motivo) {
    if (!motivo || !String(motivo).trim()) {
      throw new Error("Informe o motivo do cancelamento.");
    }

    const venda = await this.buscarPorId(id, companyId);

    if (venda.status === "CANCELADA") {
      throw new Error("A venda já está cancelada.");
    }

    if (venda.status === "DEVOLVIDA") {
      throw new Error("A venda já foi devolvida integralmente.");
    }

    const cancelada = await VendaModel.findOneAndUpdate(
      {
        _id: venda._id,
        companyId,
        status: {
          $nin: ["CANCELADA", "DEVOLVIDA"],
        },
      },
      {
        $set: {
          status: "CANCELADA",
          motivoCancelamento: String(motivo).trim(),
          canceladaPor: operadorId,
          canceladaEm: new Date(),
        },
        $push: {
          historico: {
            acao: "VENDA_CANCELADA",
            operadorId,
            motivo: String(motivo).trim(),
            data: new Date(),
          },
        },
      },
      { new: true, runValidators: true }
    );

    if (!cancelada) {
      throw new Error("A venda não pôde ser cancelada.");
    }

    return cancelada;
  }

  async deletar(id, companyId) {
    // Preserva o histórico financeiro.
    // Use cancelar() em vez de excluir vendas.
    throw new Error(
      "Exclusão física de vendas desabilitada. Use cancelar()."
    );
  }

  // ----------------------------------------------------------
  // DASHBOARD FINANCEIRO
  // ----------------------------------------------------------

  async obterEstatisticas(companyId, filtros = {}) {
    const filtro = this.filtroVendasValidas(companyId, filtros);

    const [resultado] = await VendaModel.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: null,
          quantidadeVendas: { $sum: 1 },
          faturamentoBruto: { $sum: "$subtotal" },
          descontos: { $sum: "$desconto" },
          acrescimos: { $sum: "$acrescimo" },
          faturamentoLiquido: {
            $sum: {
              $subtract: [
                { $add: ["$subtotal", "$acrescimo"] },
                "$desconto",
              ],
            },
          },
          custoTotal: { $sum: "$custoTotal" },
          lucroBruto: { $sum: "$lucroBruto" },
          ticketMedio: { $avg: "$total" },
          menorVenda: { $min: "$total" },
          maiorVenda: { $max: "$total" },
          unidadesVendidas: {
            $sum: {
              $sum: "$itens.quantidade",
            },
          },
        },
      },
    ]);

    const pendentes = await VendaModel.countDocuments({
      companyId,
      status: "PENDENTE",
    });

    const canceladas = await VendaModel.countDocuments({
      ...this.montarFiltro({ ...filtros, companyId }),
      status: "CANCELADA",
    });

    const base = resultado || {
      quantidadeVendas: 0,
      faturamentoBruto: 0,
      descontos: 0,
      acrescimos: 0,
      faturamentoLiquido: 0,
      custoTotal: 0,
      lucroBruto: 0,
      ticketMedio: 0,
      menorVenda: 0,
      maiorVenda: 0,
      unidadesVendidas: 0,
    };

    const margemLucro =
      base.faturamentoLiquido > 0
        ? (base.lucroBruto / base.faturamentoLiquido) * 100
        : 0;

    return {
      ...base,
      margemLucro: Number(margemLucro.toFixed(2)),
      pendentes,
      canceladas,
    };
  }

  // ----------------------------------------------------------
  // COMPARAÇÃO COM PERÍODO ANTERIOR
  // ----------------------------------------------------------

  async compararPeriodos(companyId, dataInicio, dataFim) {
    const inicio = this.normalizarData(dataInicio, "dataInicio");
    const fim = this.normalizarData(dataFim, "dataFim");

    if (!inicio || !fim || inicio > fim) {
      throw new Error("Informe um período válido.");
    }

    const duracao = fim.getTime() - inicio.getTime();
    const inicioAnterior = new Date(inicio.getTime() - duracao - 1);
    const fimAnterior = new Date(inicio.getTime() - 1);

    const [atual, anterior] = await Promise.all([
      this.obterEstatisticas(companyId, {
        dataInicio: inicio,
        dataFim: fim,
      }),
      this.obterEstatisticas(companyId, {
        dataInicio: inicioAnterior,
        dataFim: fimAnterior,
      }),
    ]);

    const variacao = (novo, antigo) =>
      antigo === 0
        ? novo > 0 ? 100 : 0
        : Number((((novo - antigo) / Math.abs(antigo)) * 100).toFixed(2));

    return {
      atual,
      anterior,
      variacao: {
        faturamento: variacao(
          atual.faturamentoLiquido,
          anterior.faturamentoLiquido
        ),
        quantidadeVendas: variacao(
          atual.quantidadeVendas,
          anterior.quantidadeVendas
        ),
        ticketMedio: variacao(
          atual.ticketMedio,
          anterior.ticketMedio
        ),
        lucroBruto: variacao(atual.lucroBruto, anterior.lucroBruto),
      },
    };
  }

  // ----------------------------------------------------------
  // VENDAS AGRUPADAS POR DIA
  // ----------------------------------------------------------

  async obterVendasPorDia(companyId, dataInicio, dataFim) {
    const filtro = this.filtroVendasValidas(companyId, {
      dataInicio,
      dataFim,
    });

    return VendaModel.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$dataVenda",
              timezone: "America/Fortaleza",
            },
          },
          quantidadeVendas: { $sum: 1 },
          faturamento: { $sum: "$total" },
          lucro: { $sum: "$lucroBruto" },
          ticketMedio: { $avg: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  // ----------------------------------------------------------
  // VENDAS AGRUPADAS POR HORA
  // ----------------------------------------------------------

  async obterVendasPorHora(companyId, dataInicio, dataFim) {
    const filtro = this.filtroVendasValidas(companyId, {
      dataInicio,
      dataFim,
    });

    return VendaModel.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: {
            $hour: {
              date: "$dataVenda",
              timezone: "America/Fortaleza",
            },
          },
          quantidadeVendas: { $sum: 1 },
          faturamento: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  // ----------------------------------------------------------
  // PRODUTOS MAIS VENDIDOS
  // ----------------------------------------------------------

  async obterProdutosMaisVendidos(companyId, filtros = {}, limite = 10) {
    const filtro = this.filtroVendasValidas(companyId, filtros);

    limite = Math.min(100, Math.max(1, parseInt(limite, 10) || 10));

    return VendaModel.aggregate([
      { $match: filtro },
      { $unwind: "$itens" },
      {
        $group: {
          _id: "$itens.productId",
          nome: { $first: "$itens.nome" },
          categoria: { $first: "$itens.categoria" },
          quantidadeVendida: { $sum: "$itens.quantidade" },
          receita: { $sum: "$itens.total" },
          custo: {
            $sum: {
              $multiply: [
                "$itens.custoUnitario",
                "$itens.quantidade",
              ],
            },
          },
        },
      },
      {
        $addFields: {
          lucroBruto: { $subtract: ["$receita", "$custo"] },
        },
      },
      { $sort: { quantidadeVendida: -1, receita: -1 } },
      { $limit: limite },
    ]);
  }

  // ----------------------------------------------------------
  // DESEMPENHO POR OPERADOR
  // ----------------------------------------------------------

  async obterVendasPorOperador(companyId, filtros = {}) {
    const filtro = this.filtroVendasValidas(companyId, filtros);

    return VendaModel.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: "$operadorId",
          operadorNome: { $first: "$operadorNome" },
          quantidadeVendas: { $sum: 1 },
          faturamento: { $sum: "$total" },
          lucroBruto: { $sum: "$lucroBruto" },
          ticketMedio: { $avg: "$total" },
        },
      },
      { $sort: { faturamento: -1 } },
    ]);
  }

  // ----------------------------------------------------------
  // FORMAS DE PAGAMENTO
  // ----------------------------------------------------------

  async obterVendasPorPagamento(companyId, filtros = {}) {
    const filtro = this.filtroVendasValidas(companyId, filtros);

    return VendaModel.aggregate([
      { $match: filtro },
      { $unwind: "$pagamentos" },
      { $match: { "pagamentos.status": "PAGO" } },
      {
        $group: {
          _id: "$pagamentos.metodo",
          quantidadeTransacoes: { $sum: 1 },
          valorRecebido: { $sum: "$pagamentos.valor" },
        },
      },
      { $sort: { valorRecebido: -1 } },
    ]);
  }

  // ----------------------------------------------------------
  // CATEGORIAS
  // ----------------------------------------------------------

  async obterVendasPorCategoria(companyId, filtros = {}) {
    const filtro = this.filtroVendasValidas(companyId, filtros);

    return VendaModel.aggregate([
      { $match: filtro },
      { $unwind: "$itens" },
      {
        $group: {
          _id: "$itens.categoria",
          quantidadeVendida: { $sum: "$itens.quantidade" },
          receita: { $sum: "$itens.total" },
        },
      },
      { $sort: { receita: -1 } },
    ]);
  }

  // ----------------------------------------------------------
  // RESUMO GERAL PARA O DASHBOARD
  // ----------------------------------------------------------

  async obterDashboard(companyId, filtros = {}) {
    const [
      estatisticas,
      vendasPorDia,
      vendasPorHora,
      produtosMaisVendidos,
      vendasPorOperador,
      vendasPorPagamento,
      vendasPorCategoria,
    ] = await Promise.all([
      this.obterEstatisticas(companyId, filtros),
      this.obterVendasPorDia(
        companyId,
        filtros.dataInicio,
        filtros.dataFim
      ),
      this.obterVendasPorHora(
        companyId,
        filtros.dataInicio,
        filtros.dataFim
      ),
      this.obterProdutosMaisVendidos(companyId, filtros, 10),
      this.obterVendasPorOperador(companyId, filtros),
      this.obterVendasPorPagamento(companyId, filtros),
      this.obterVendasPorCategoria(companyId, filtros),
    ]);

    return {
      filtrosAplicados: {
        dataInicio: filtros.dataInicio || null,
        dataFim: filtros.dataFim || null,
        operadorId: filtros.operadorId || null,
        caixaId: filtros.caixaId || null,
      },
      estatisticas,
      graficos: {
        vendasPorDia,
        vendasPorHora,
        vendasPorPagamento,
        vendasPorCategoria,
      },
      rankings: {
        produtosMaisVendidos,
        vendasPorOperador,
      },
    };
  }

  // ----------------------------------------------------------
  // CONTAGENS OPERACIONAIS
  // ----------------------------------------------------------

  async contarPorStatus(companyId, filtros = {}) {
    const filtro = this.montarFiltro({ ...filtros, companyId });

    // O status é agrupado no banco; o filtro de status individual
    // não deve limitar os demais grupos.
    delete filtro.status;

    return VendaModel.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: "$status",
          quantidade: { $sum: 1 },
          valorTotal: { $sum: "$total" },
        },
      },
      { $sort: { quantidade: -1 } },
    ]);
  }

  async contarVendas(companyId, filtros = {}) {
    return VendaModel.countDocuments(
      this.montarFiltro({ ...filtros, companyId })
    );
  }
}

module.exports = VendaRepositoryMongo;
module.exports.VendaModel = VendaModel;
