
class CriarVendaPDVUseCase {
  constructor(vendaRepository, productRepository, estoqueService = null) {
    this.vendaRepository = vendaRepository;
    this.productRepository = productRepository;
    this.estoqueService = estoqueService;
  }

  numero(valor, campo) {
    const n = Number(valor);

    if (!Number.isFinite(n)) {
      throw new Error(`${campo} inválido.`);
    }

    return n;
  }

  dinheiro(valor) {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }

  async executar(dados, contexto) {
    if (!contexto?.userId || !contexto?.companyId) {
      throw new Error("Usuário autenticado e empresa são obrigatórios.");
    }

    const { userId, companyId, nomeOperador } = contexto;

    if (!Array.isArray(dados?.itens) || dados.itens.length === 0) {
      throw new Error("Adicione pelo menos um produto à venda.");
    }

    if (!Array.isArray(dados.pagamentos) || dados.pagamentos.length === 0) {
      throw new Error("Informe a forma de pagamento.");
    }

    const itens = [];
    const produtosPorId = new Map();

    // Busca os produtos no backend. O preço enviado pelo navegador
    // nunca é considerado a fonte oficial.
    for (const item of dados.itens) {
      const productId = String(item.productId || "").trim();
      const quantidade = this.numero(item.quantidade, "Quantidade");

      if (!productId || quantidade <= 0) {
        throw new Error("Produto ou quantidade inválida.");
      }

      let produto = produtosPorId.get(productId);

      if (!produto) {
        produto = await this.productRepository.findById(
          productId
        );

        if (!produto) {
          throw new Error(`Produto não encontrado: ${productId}.`);
        }

        produtosPorId.set(productId, produto);
      }

      // Ajuste estes campos caso sua entidade Product use outros nomes.
      const status = String(produto.status || "").toUpperCase();

      if (["INACTIVE", "INATIVO", "INACTIVE"].includes(status)) {
        throw new Error(`O produto ${productId} está inativo.`);
      }

      const nome = produto.nome || produto.name;
      const preco = this.numero(
        produto.preco ?? produto.price,
        "Preço do produto"
      );
      const custo = this.numero(
        produto.custo ?? produto.cost ?? 0,
        "Custo do produto"
      );

      if (!nome || preco < 0 || custo < 0) {
        throw new Error(`Dados inválidos para o produto ${productId}.`);
      }

      // Não permite que o cliente escolha uma variante sem validar
      // sua existência, preço e estoque no repositório de produtos.
      // Valida a variante usando o ID real do SKU.

      // O preço oficial é sempre consultado no produto do banco.

      const sku = String(item.skuId || item.sku || "").trim();

      const precoUnitario = await this.obterPrecoValidado(
        produto,
        sku,
        preco,
        companyId
      );

      itens.push({
        productId,
        sku,
        nome,
        categoria: produto.categoria || produto.category || "SEM_CATEGORIA",
        quantidade,
        custoUnitario: custo,
        precoUnitario,
        desconto: 0,
        total: this.dinheiro(quantidade * precoUnitario),
      });
    }

    const subtotal = this.dinheiro(
      itens.reduce((soma, item) => soma + item.total, 0)
    );

    const desconto = this.dinheiro(
      this.numero(dados.desconto ?? 0, "Desconto")
    );

    const acrescimo = this.dinheiro(
      this.numero(dados.acrescimo ?? 0, "Acréscimo")
    );

    if (desconto < 0 || acrescimo < 0 || desconto > subtotal) {
      throw new Error("Desconto ou acréscimo inválido.");
    }

    const total = this.dinheiro(subtotal - desconto + acrescimo);

    const pagamentos = dados.pagamentos.map((pagamento) => {
      const metodo = String(pagamento.metodo || "").toUpperCase();
      const metodosPermitidos = [
        "DINHEIRO",
        "PIX",
        "CARTAO_CREDITO",
        "CARTAO_DEBITO",
        "VALE",
        "OUTRO",
      ];

      if (!metodosPermitidos.includes(metodo)) {
        throw new Error(`Forma de pagamento inválida: ${metodo}.`);
      }

      const valor = this.dinheiro(
        this.numero(pagamento.valor, "Valor do pagamento")
      );

      if (valor <= 0) {
        throw new Error("O valor de cada pagamento deve ser positivo.");
      }

      return {
        metodo,
        valor,
        status: "PAGO",
        referencia: pagamento.referencia || null,
        parcelas: Math.max(1, Number(pagamento.parcelas) || 1),
      };
    });

    const totalPago = this.dinheiro(
      pagamentos.reduce((soma, pagamento) => soma + pagamento.valor, 0)
    );

    if (totalPago !== total) {
      throw new Error(
        `Total dos pagamentos (R$ ${totalPago.toFixed(2)}) ` +
        `diferente do total da venda (R$ ${total.toFixed(2)}).`
      );
    }

    // A baixa de estoque deve ser atômica e validar novamente a
    // disponibilidade. Não implemente esse método como simples
    // atualização de quantidade sem controle de concorrência.
    if (this.estoqueService) {
      await this.estoqueService.validarDisponibilidade({
        companyId,
        itens,
      });
    }

    const custoTotal = this.dinheiro(
      itens.reduce(
        (soma, item) => soma + item.quantidade * item.custoUnitario,
        0
      )
    );

    const lucroBruto = this.dinheiro(total - custoTotal);

    const id =
      `PDV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const vendaData = {
      id,
      companyId,
      operadorId: userId,
      operadorNome: nomeOperador || null,
      caixaId: dados.caixaId || null,
      cliente: {
        id: dados.cliente?.id || null,
        nome: dados.cliente?.nome || null,
        telefone: dados.cliente?.telefone || null,
      },
      itens,
      subtotal,
      desconto,
      acrescimo,
      total,
      custoTotal,
      lucroBruto,
      pagamentos,
      status: "CONCLUIDA",
      origem: "PDV",
      observacoes: dados.observacoes || null,
      dataVenda: new Date(),
    };

    // A gravação e a baixa do estoque precisam ser coordenadas
    // por transação ou operação idempotente na implementação real.
    const venda = await this.vendaRepository.criar(vendaData);

    if (this.estoqueService) {
      await this.estoqueService.baixarItens({
        companyId,
        vendaId: venda.id,
        operadorId: userId,
        itens: venda.itens,
      });
    }

    return venda;
  }

  
async obterPrecoValidado(produto, sku, precoPadrao = null) {
  if (!sku) {
    const preco = Number(precoPadrao);

    if (!Number.isFinite(preco) || preco < 0) {
      throw new Error("Preço do produto inválido.");
    }

    return preco;
  }

  const variantes = produto.variantes || produto.skus || [];

  const skuId = String(sku).trim();

  const variante = variantes.find((v) =>
    String(v._id || v.id || "") === skuId
  );

  if (!variante) {
    throw new Error(
      `SKU ${skuId} não pertence ao produto ${produto.id || produto._id}.`
    );
  }

  const preco = Number(variante.preco ?? variante.price);

  if (!Number.isFinite(preco) || preco < 0) {
    throw new Error(`Preço inválido para o SKU ${skuId}.`);
  }

  return preco;
}
}

module.exports = CriarVendaPDVUseCase;
