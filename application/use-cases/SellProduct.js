const Product = require("../../domain/entities/product");
const ProductPolicy = require("../../domain/policies/ProductPolicy");
const ProductSoldEvent = require("../../domain/events/ProductSoldEvent");

class SellProduct {
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
      ProductPolicy.canSell({
        user,
        product,
        quantity
      });

      const oldStock = product.stock;

      // 🧠 4️⃣ Regra de domínio
      product.removeStock(skuId, quantity);

      // 💾 5️⃣ Persistir
      await this.productRepo.update(product);

      // ✅ 6️⃣ Auditoria SUCCESS
      await this.eventDispatcher.dispatch(
        new ProductSoldEvent({
          entity: "Product",
          entityId: product.id,
          userId: user.id,
          userEmail: user.email,
          oldData: { stock: oldStock },
          newData: { stock: product.stock },
          snapshot: product,
          status: "SUCCESS",
          context
        })
      );

      return { message: "Venda realizada com sucesso" };

    } catch (error) {

      // 🚫 Auditoria BLOCKED / ERROR
      await this.eventDispatcher.dispatch(
        new ProductSoldEvent({
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

module.exports = SellProduct;
