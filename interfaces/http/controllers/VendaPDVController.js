
class VendaPDVController {
  constructor({
    criarVendaUseCase,
    cancelarVendaUseCase,
    vendaRepository,
  }) {
    this.criarVendaUseCase = criarVendaUseCase;
    this.cancelarVendaUseCase = cancelarVendaUseCase;
    this.vendaRepository = vendaRepository;

    this.criar = this.criar.bind(this);
    this.cancelar = this.cancelar.bind(this);
    this.buscarPorId = this.buscarPorId.bind(this);
    this.listar = this.listar.bind(this);
    this.dashboard = this.dashboard.bind(this);
    this.estatisticas = this.estatisticas.bind(this);
    this.comparativo = this.comparativo.bind(this);
    this.vendasPorDia = this.vendasPorDia.bind(this);
    this.vendasPorHora = this.vendasPorHora.bind(this);
    this.produtosMaisVendidos = this.produtosMaisVendidos.bind(this);
    this.vendasPorOperador = this.vendasPorOperador.bind(this);
    this.vendasPorPagamento = this.vendasPorPagamento.bind(this);
    this.vendasPorCategoria = this.vendasPorCategoria.bind(this);
    this.contarPorStatus = this.contarPorStatus.bind(this);
  }

  // Nunca confie no companyId ou operadorId enviado pelo front-end.
  contexto(req) {
  const usuario = req.user;

  if (!usuario?.id || !usuario?.companyId || !usuario?.membership) {
    const erro = new Error(
      "Identidade autenticada e associação à empresa são obrigatórias."
    );
    erro.statusCode = 403;
    throw erro;
  }

  return {
    userId: String(usuario.id),
    companyId: String(usuario.companyId),
    nomeOperador:
      usuario.profile?.name ||
      usuario.nome ||
      usuario.name ||
      null,
    role: usuario.membership.role,
    principal: {
      userId: String(usuario.id),
      userStatus: usuario.status,
      membership: {
        role: usuario.membership.role,
        status: usuario.membership.status,
        companyId: String(usuario.membership.companyId),
      },
    },
  };
}

  respostaErro(res, erro) {
    const status = erro.statusCode || 400;

    if (status >= 500) {
      console.error("[VENDA_PDV_CONTROLLER_ERROR]", erro);
    }

    return res.status(status).json({
      sucesso: false,
      mensagem:
        status >= 500
          ? "Erro interno ao processar a operação."
          : erro.message,
    });
  }

  async criar(req, res) {
    try {
      const contexto = this.contexto(req);
      
      console.log("DEBUG CONTEXTO PDV:", {

  user: req.user || null,

  userId: req.user?.id || req.user?._id || null,

  companyId: req.user?.companyId || null,

  membership: req.user?.membership || null,

});

      const venda = await this.criarVendaUseCase.executar(
        req.body,
        contexto
      );

      return res.status(201).json({
        sucesso: true,
        mensagem: "Venda registrada com sucesso.",
        venda,
      });
    } catch (erro) {
      return this.respostaErro(res, erro);
    }
  }

  async cancelar(req, res) {
    try {
      const contexto = this.contexto(req);

      const resultado = await this.cancelarVendaUseCase.executar(
        {
          vendaId: req.params.id,
          motivo: req.body.motivo,
        },
        contexto
      );

      return res.status(200).json({
        sucesso: true,
        ...resultado,
      });
    } catch (erro) {
      return this.respostaErro(res, erro);
    }
  }

  async buscarPorId(req, res) {
    try {
      const { companyId } = this.contexto(req);

      const venda = await this.vendaRepository.buscarPorId(
        req.params.id,
        companyId
      );

      if (venda.origem !== "PDV") {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Venda do PDV não encontrada.",
        });
      }

      return res.status(200).json({
        sucesso: true,
        venda,
      });
    } catch (erro) {
      return this.respostaErro(res, erro);
    }
  }

  async listar(req, res) {
    try {
      const { companyId } = this.contexto(req);

      const filtros = {
        companyId,
        operadorId: req.query.operadorId,
        caixaId: req.query.caixaId,
        status: req.query.status,
        metodoPagamento: req.query.metodoPagamento,
        productId: req.query.productId,
        categoria: req.query.categoria,
        clienteId: req.query.clienteId,
        busca: req.query.busca,
        dataInicio: req.query.dataInicio,
        dataFim: req.query.dataFim,
        valorMinimo: req.query.valorMinimo,
        valorMaximo: req.query.valorMaximo,
        origem: "PDV",
      };

      const opcoes = {
        pagina: req.query.pagina,
        limite: req.query.limite,
        ordenarPor: req.query.ordenarPor,
      };

      const resultado = await this.vendaRepository.listar(
        filtros,
        opcoes
      );

      // Defesa adicional para não retornar pedidos de delivery.
      const vendas = resultado.vendas.filter(
        (venda) => venda.origem === "PDV"
      );

      return res.status(200).json({
        sucesso: true,
        ...resultado,
        vendas,
      });
    } catch (erro) {
      return this.respostaErro(res, erro);
    }
  }

  async dashboard(req, res) {
    try {
      const { companyId } = this.contexto(req);

      const filtros = this.filtrosRelatorio(req.query);

      const dados = await this.vendaRepository.obterDashboard(
        companyId,
        filtros
      );

      return res.status(200).json({
        sucesso: true,
        dados,
      });
    } catch (erro) {
      return this.respostaErro(res, erro);
    }
  }

  async estatisticas(req, res) {
    try {
      const { companyId } = this.contexto(req);

      const dados = await this.vendaRepository.obterEstatisticas(
        companyId,
        this.filtrosRelatorio(req.query)
      );

      return res.status(200).json({
        sucesso: true,
        dados,
      });
    } catch (erro) {
      return this.respostaErro(res, erro);
    }
  }

  async comparativo(req, res) {
    try {
      const { companyId } = this.contexto(req);

      const { dataInicio, dataFim } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Informe dataInicio e dataFim.",
        });
      }

      const dados = await this.vendaRepository.compararPeriodos(
        companyId,
        dataInicio,
        dataFim
      );

      return res.status(200).json({
        sucesso: true,
        dados,
      });
    } catch (erro) {
      return this.respostaErro(res, erro);
    }
  }

  async vendasPorDia(req, res) {
    return this.executarRelatorio(
      req,
      res,
      "obterVendasPorDia"
    );
  }

  async vendasPorHora(req, res) {
    return this.executarRelatorio(
      req,
      res,
      "obterVendasPorHora"
    );
  }

  async produtosMaisVendidos(req, res) {
    try {
      const { companyId } = this.contexto(req);

      const limite = Math.min(
        100,
        Math.max(1, parseInt(req.query.limite, 10) || 10)
      );

      const dados =
        await this.vendaRepository.obterProdutosMaisVendidos(
          companyId,
          this.filtrosRelatorio(req.query),
          limite
        );

      return res.status(200).json({
        sucesso: true,
        dados,
      });
    } catch (erro) {
      return this.respostaErro(res, erro);
    }
  }

  async vendasPorOperador(req, res) {
    return this.executarRelatorio(
      req,
      res,
      "obterVendasPorOperador"
    );
  }

  async vendasPorPagamento(req, res) {
    return this.executarRelatorio(
      req,
      res,
      "obterVendasPorPagamento"
    );
  }

  async vendasPorCategoria(req, res) {
    return this.executarRelatorio(
      req,
      res,
      "obterVendasPorCategoria"
    );
  }

  async contarPorStatus(req, res) {
    return this.executarRelatorio(
      req,
      res,
      "contarPorStatus"
    );
  }

  async executarRelatorio(req, res, metodo) {
    try {
      const { companyId } = this.contexto(req);

      const funcao = this.vendaRepository[metodo];

      if (typeof funcao !== "function") {
        throw new Error(`Relatório não implementado: ${metodo}`);
      }

      const filtros = this.filtrosRelatorio(req.query);
      let dados;

      if (metodo === "obterVendasPorDia" ||
          metodo === "obterVendasPorHora") {
        dados = await funcao.call(
          this.vendaRepository,
          companyId,
          filtros.dataInicio,
          filtros.dataFim
        );
      } else {
        dados = await funcao.call(
          this.vendaRepository,
          companyId,
          filtros
        );
      }

      return res.status(200).json({
        sucesso: true,
        dados,
      });
    } catch (erro) {
      return this.respostaErro(res, erro);
    }
  }

  filtrosRelatorio(query) {
    return {
      dataInicio: query.dataInicio,
      dataFim: query.dataFim,
      operadorId: query.operadorId,
      caixaId: query.caixaId,
      status: query.status,
      metodoPagamento: query.metodoPagamento,
      productId: query.productId,
      categoria: query.categoria,
      origem: "PDV",
    };
  }
}

module.exports = VendaPDVController;
