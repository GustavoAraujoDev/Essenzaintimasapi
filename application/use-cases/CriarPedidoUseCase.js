const Pedido = require("../../domain/entities/Pedido");
const PedidoCriadoEvent = require("../../domain/events/PedidoCriadoEvent");

class CriarPedidoUseCase {
  constructor({
    pedidoRepository,
    productRepository,
    pedidoPolicy,
    eventDispatcher,
  }) {
    this.pedidoRepository = pedidoRepository;
    this.productRepository = productRepository;
    this.pedidoPolicy = pedidoPolicy;
    this.eventDispatcher = eventDispatcher;
  }

  async executar({ actor, pedidoData, context }) {
    console.log(
      "Dados do Pedido Recebidos:",
      JSON.stringify(pedidoData, null, 2),
    );

    try {
      // 🔐 1. Autorização (ABAC)
      if (!this.pedidoPolicy.canCreate(actor, context)) {
        throw new Error("Acesso negado para criar pedido");
      }

      // 🛡 2. Validação básica
      if (!pedidoData.itens || pedidoData.itens.length === 0) {
        throw new Error("O carrinho está vazio");
      }

      // 💰 Separa os itens de abatimento financeiro para calcular o desconto depois
      let totalDescontosAbatimento = 0;
      const itensFinanceiros = pedidoData.itens.filter(
        (item) =>
          item.category === "Financeiro" ||
          item.productId.startsWith("CREDITO-"),
      );

      // Soma o valor dos abatimentos (ex: -40 virará 40 de desconto)
      itensFinanceiros.forEach((item) => {
        // Como o priceUnit vem negativo (-40), usamos Math.abs para extrair o valor absoluto
        totalDescontosAbatimento += Math.abs(
          item.unitPrice || item.priceUnit || 0,
        );
      });

      // 🔥 3. Filtrar apenas os produtos REAIS para validação no Banco de Dados
      const itensProdutosReais = pedidoData.itens.filter(
        (item) =>
          item.category !== "Financeiro" &&
          !item.productId.startsWith("CREDITO-"),
      );

      let totalItens = 0;
      const itensFormatados = await Promise.all(
        itensProdutosReais.map(async (item) => {
          // Busca o produto real no banco
          const produtoDb = await this.productRepository.findById(
            item.productId,
          );
          if (!produtoDb)
            throw new Error(`Produto não encontrado: ${item.productId}`);

          // Busca o SKU (tamanho) para pegar o preço base correto
          // OBS: Ajustado para mapear se vier como item.size ou item.sku
          const tamanhoItem = item.size || item.sku;
          const skuDb = produtoDb.skus.find((s) => s.name === tamanhoItem);
          if (!skuDb)
            throw new Error(
              `Tamanho/SKU inválido para o produto ${produtoDb.name}`,
            );

          let unitPrice = skuDb.price;

          // Tratamento de Extras (Lida com "3x Peixe, 1x arroz")
          if (item.extras && Array.isArray(item.extras)) {
            item.extras.forEach((extraString) => {
              const partes = extraString.split(",").map((p) => p.trim());

              partes.forEach((parte) => {
                const match = parte.match(/^(\d+)x\s+(.+)$/);
                const qtdExtra = match ? parseInt(match[1]) : 1;
                const nomeExtra = match ? match[2] : parte;

                let extraEncontrado = null;
                produtoDb.modifiers.forEach((group) => {
                  const found = group.items.find(
                    (e) => e.name.toLowerCase() === nomeExtra.toLowerCase(),
                  );
                  if (found) extraEncontrado = found;
                });

                if (extraEncontrado) {
                  unitPrice += extraEncontrado.price * qtdExtra;
                } else {
                  console.warn(
                    `Adicional [${nomeExtra}] não encontrado no banco.`,
                  );
                }
              });
            });
          }

          const quantity = item.quantity || item.qty || 1;
          const totalPrice = unitPrice * quantity;
          totalItens += totalPrice;

          return {
            productId: item.productId,
            name: `${produtoDb.name} ${skuDb.name}`,
            category: produtoDb.categoryId,
            size: tamanhoItem,
            quantity: quantity,
            unitPrice: unitPrice,
            totalPrice: totalPrice,
            extras: item.extras || [],
            notes: item.notes || item.obs || null,
          };
        }),
      );

      const entregataxaatual = pedidoData.entrega?.taxaEntrega;
      // =================================================================
      // 🚚 4. TRATAMENTO DE CUPONS E TAXA DE ENTREGA (DINÂMICO)
      // =================================================================
      let taxaEntrega =
        pedidoData.entrega?.tipo === "DELIVERY"
          ? pedidoData.entrega?.taxaEntrega || 0
          : 0;

      // 💳 ADICIONADO: Verificar se o pagamento é cartão para adicionar R$ 1,00 na auditoria do backend
      let taxaCartao = 0;
      const metodoPagamento = pedidoData.pagamento?.metodo;
      if (
        metodoPagamento === "CARTAO_CREDITO" ||
        metodoPagamento === "CARTAO_DEBITO"
      ) {
        taxaCartao = 1.0;
      }

      let descontoDoCupom = 0;

      // Unifica a captura do cupom enviado pelo Front-end (prioriza a raiz 'cupom')
      const cupomEnviado =
        pedidoData.cupom ||
        pedidoData.couponCode ||
        pedidoData.pagamento?.cupom;

      // Normaliza o código do cupom se ele existir
      const codigoCupomNorm = cupomEnviado
        ? cupomEnviado.toUpperCase().trim()
        : null;

      if (codigoCupomNorm) {
        console.log(
          `[CriarPedidoUseCase] Processando cupom cadastrado: ${codigoCupomNorm}`,
        );

        if (
          codigoCupomNorm === "FRETEGRATIS" ||
          codigoCupomNorm === "QUEROFRETE"
        ) {
          // CASO A: Cupom de Frete Grátis zera a taxa de entrega
          descontoDoCupom = 0; // O benefício é o frete zero, não desconto no subtotal
          taxaEntrega = 0;
          console.log(
            `[CriarPedidoUseCase] Sucesso: Taxa de entrega zerada via cupom.`,
          );
        } else {
          // CASO B: Outros cupons (Valor fixo ou porcentagem)
          // Mapeia corretamente 'desconto' enviado pelo front do pedidoFinal
          const descontoInformado = parseFloat(
            pedidoData.desconto ||
              pedidoData.discountValue ||
              pedidoData.pagamento?.desconto ||
              0,
          );

          // 🛡️ TRAVA DE SEGURANÇA: O desconto do cupom não pode ser maior que o total dos itens
          descontoDoCupom = Math.min(descontoInformado, totalItens);

          console.log(
            `[CriarPedidoUseCase] Sucesso: Aplicado abatimento de R$ ${descontoDoCupom} do cupom.`,
          );
        }
      }

      // =================================================================
      // 💰 5. CÁLCULO DO TOTAL GERAL (Produtos + Entrega - Cupom - Créditos)
      // =================================================================
      const totalGeral =
        totalItens +
        taxaCartao +
        taxaEntrega -
        descontoDoCupom -
        totalDescontosAbatimento;
      const totalFinalSeguro = Math.max(0, totalGeral); // Proteção para nunca ficar negativo

      console.log(
        `[CriarPedidoUseCase] Cálculo Final: Subtotal(${totalItens}) + Entrega(${taxaEntrega}) - Cupom(${descontoDoCupom}) - Créditos(${totalDescontosAbatimento}) = Total: ${totalFinalSeguro}`,
      );

      // =================================================================
      // 🚚 6. CONFIGURAÇÃO DO OBJETO DE ENTREGA
      // =================================================================
      const entrega = {
        ...pedidoData.entrega,
        taxaEntrega,
        tempoEstimado: this._gerarTempoEntrega(),
      };

      // 📦 7. Definição do Status Inicial
      const statusInicial =
        pedidoData.companyId === "ADMIN-LOCAL" ? "DELIVERED" : "CREATED";
      const statusPagamentoInicial =
        pedidoData.companyId === "ADMIN-LOCAL" ? "PAGO" : "PENDENTE";

      // Re-injeta os itens financeiros no histórico se necessário
      itensFinanceiros.forEach((fin) => {
        itensFormatados.push({
          productId: fin.productId,
          name: fin.name,
          category: fin.category,
          size: fin.sku || "UN",
          quantity: fin.qty || 1,
          unitPrice: fin.priceUnit || fin.unitPrice,
          totalPrice: fin.total || fin.totalPrice,
          extras: [],
          notes: fin.obs || fin.notes || null,
        });
      });

      // =================================================================
      // 📦 8. CONSTRUÇÃO DA ENTIDADE RICA DO PEDIDO
      // =================================================================
      const pedido = new Pedido({
        ...pedidoData,
        id: `PED-${Date.now()}`,
        userId: actor.id,
        itens: itensFormatados,

        // 🔥 CORREÇÃO AQUI: Passando as chaves exatas na raiz que o constructor de Pedido espera
        cupom: codigoCupomNorm,
        descontoCupom: descontoDoCupom,

        pagamento: {
          ...pedidoData.pagamento,
          subtotal: totalItens,
          taxaEntrega: taxaEntrega,
          descontoCupom: descontoDoCupom, // Mantido aqui também para fins de histórico/legado
          total: totalFinalSeguro,
          status: statusPagamentoInicial,
        },
        entrega,
        status: statusInicial,
        rastreamento: [{ status: "CREATED", data: new Date() }],
      });

      // 💾 9. Persistir
      const novoPedido = await this.pedidoRepository.criar(pedido);

      return novoPedido;
    } catch (error) {
      // 🚨 Evento de erro
      await this.eventDispatcher.dispatch(
        new PedidoCriadoEvent({
          status: "ERROR",
          errorMessage: error.message,
          actor,
          context,
        }),
      );
      throw error;
    }
  }

  _gerarTempoEntrega() {
    const minutos = Math.floor(Math.random() * (120 - 50 + 1)) + 50;
    return new Date(Date.now() + minutos * 60000);
  }
}

module.exports = CriarPedidoUseCase;
