"use strict";

const Product = require("../../../domain/entities/product");
const ProductStockAddedEvent = require("../../../domain/events/ProductStockAddedEvent");

class RestoreStockOnSaleCancelledHandler {
  constructor(productRepo, eventDispatcher) {
    this.productRepo = productRepo;
    this.eventDispatcher = eventDispatcher;
  }

  async handle(event) {
    const { venda, contexto } = event.payload;

    if (!venda || !Array.isArray(venda.itens) || venda.itens.length === 0) {
      return;
    }

    for (const item of venda.itens) {
      const productId = item.productId || item.produtoId;
      const quantity = Number(item.quantidade || item.quantity || 0);
      const skuId = item.skuId || null;

      if (!productId || quantity <= 0) continue;

      let productData = null;

      try {
        productData = await this.productRepo.findById(productId);
        if (!productData) continue;

        const product = new Product(productData);
        const oldStock = product.stock;

        // Reutiliza o método seguro da entidade
        product.addStock(skuId, quantity);
        const newData = product.stock;

        await this.productRepo.update(product);

        // Dispara o teu evento de auditoria existente
        if (this.eventDispatcher) {
          await this.eventDispatcher.dispatch(
            new ProductStockAddedEvent({
              entity: "Product",
              entityId: product.id,
              userId: contexto?.userId,
              userEmail: contexto?.userEmail || "",
              oldData: { stock: oldStock },
              newData: { stock: newData },
              snapshot: product,
              status: "SUCCESS",
              context: {
                ...contexto,
                origem: "CANCELAMENTO_VENDA_PDV",
                vendaId: venda.id || venda._id,
              },
            })
          );
        }
      } catch (error) {
        console.error(`[ERRO REPOSIÇÃO ESTOQUE] Produto ${productId}:`, error.message);
      }
    }
  }
}

module.exports = RestoreStockOnSaleCancelledHandler;
