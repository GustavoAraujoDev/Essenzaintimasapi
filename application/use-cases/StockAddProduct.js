const Product = require("../../domain/entities/product");
const ProductPolicy = require("../../domain/policies/ProductPolicy");
const ProductStockAddedEvent = require("../../domain/events/ProductStockAddedEvent");

class StockAddProduct {
  constructor(productRepo, userRepo, eventDispatcher) {
    this.productRepo = productRepo;
    this.userRepo = userRepo;
    this.eventDispatcher = eventDispatcher;
  }

  async execute({ productId, quantity, userId, context, skuId }) {
    let productData = null;
    let user = null;

    try {
      // 🔎 1️⃣ Buscar usuário
      user = await this.userRepo.findById(userId);
      if (!user) throw new Error("Usuário não encontrado");

      // 📦 2️⃣ Buscar produto
      productData = await this.productRepo.findById(productId);
      if (!productData) throw new Error("Produto não encontrado");

      const product = new Product(productData);

      // 🔐 3️⃣ Autorização ABAC
      ProductPolicy.canAddStock({
        user,
        product
      });

      const oldStock = product.stock;

      // 🧠 4️⃣ Regra de domínio
      product.addStock(skuId, quantity);

      const newData = product.stock;

      // 💾 5️⃣ Persistir
      await this.productRepo.update(product);

      // ✅ 6️⃣ Auditoria SUCCESS
      await this.eventDispatcher.dispatch(
        new ProductStockAddedEvent({
          entity: "Product",
          entityId: product.id,
          userId: user.id,
          userEmail: user.email,
          oldData: { stock: oldStock },
          newData: { stock: newData },
          snapshot: product,
          status: "SUCCESS",
          context
        })
      );

      return { message: "Stock Atualizado com sucesso" };

    } catch (error) {

      // 🚫 Auditoria BLOCKED / ERROR
      await this.eventDispatcher.dispatch(
        new ProductStockAddedEvent({
          entity: "Product",
          entityId: productId,
          userId: user?.id,
          userEmail: user?.email,
          snapshot: productData,
          status: error.message.includes("perm") ? "BLOCKED" : "ERROR",
          context,
          errorMessage: error.message
        })
      );

      throw error;
    }
  }
}

module.exports = StockAddProduct;
