
"use strict";

const Product = require("../../../domain/entities/product");
const ProductStockAddedEvent = require(
  "../../../domain/events/ProductStockAddedEvent"
);

class RestoreStockOnSaleCancelledHandler {
  constructor(productRepo, eventDispatcher) {
    this.productRepo = productRepo;
    this.eventDispatcher = eventDispatcher;
  }

  async handle(event) {
    const { venda, contexto } = event.payload;

    if (
      !venda ||
      !Array.isArray(venda.itens) ||
      venda.itens.length === 0
    ) {
      console.warn(
        "[REPOSIÇÃO] Venda sem itens para restaurar."
      );
      return;
    }

    for (const item of venda.itens) {
      const productId = item.productId || item.produtoId;

      const quantity = Number(
        item.quantidade ?? item.quantity ?? 0
      );

      // A venda salva o identificador em "sku".
      const skuOriginal =
        item.skuId ??
        item.sku?._id ??
        item.sku?.id ??
        item.sku ??
        null;

      const skuId =
        skuOriginal == null
          ? null
          : String(skuOriginal).trim();

      if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(
          `Item inválido para reposição: ${productId || "sem produto"}`
        );
      }

      if (!skuId) {
        throw new Error(
          `SKU não identificado na venda para o produto ${productId}.`
        );
      }

      try {
        const productData =
          await this.productRepo.findById(productId);

        if (!productData) {
          throw new Error(
            `Produto ${productId} não encontrado.`
          );
        }

        const product = new Product(productData);


        // Confirma que o SKU existe antes de modificar o estoque.
        const skuEncontrado = (product.skus || []).find((sku) => {
          const id = sku?._id ?? sku?.id;

          return id != null && String(id) === skuId;
        });

        if (!skuEncontrado) {
          throw new Error(
            `SKU ${skuId} não encontrado no produto ${productId}.`
          );
        }

        const oldStock = product.stock;
        const oldSkuStock = Number(skuEncontrado.stock ?? 0);

        // Utiliza a regra de negócio existente na entidade.
        product.addStock(skuId, quantity);

        const newSkuStock = Number(skuEncontrado.stock ?? 0);


        // Persiste no repositório.
        await this.productRepo.update(product);


        // Mantém o evento de auditoria existente.
        if (this.eventDispatcher) {
          await this.eventDispatcher.dispatch(
            new ProductStockAddedEvent({
              entity: "Product",
              entityId: product.id,
              userId: contexto?.userId,
              userEmail: contexto?.userEmail || "",
              oldData: {
                stock: oldStock,
                skuStock: oldSkuStock,
              },
              newData: {
                stock: product.stock,
                skuStock: newSkuStock,
              },
              snapshot: product,
              status: "SUCCESS",
              context: {
                ...contexto,
                origem: "CANCELAMENTO_VENDA_PDV",
                vendaId: venda.id || venda._id,
                skuId,
                quantidadeReposta: quantity,
              },
            })
          );
        }
      } catch (error) {
        console.error("[ERRO REPOSIÇÃO ESTOQUE]", {
          productId,
          skuId,
          quantity,
          message: error.message,
          stack: error.stack,
        });

        // Não declarar a reposição como concluída se ela falhou.
        throw error;
      }
    }
  }
}

module.exports = RestoreStockOnSaleCancelledHandler;
