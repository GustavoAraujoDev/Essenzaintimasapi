const ProductPolicy = require("../../domain/policies/ProductPolicy");
const Product = require("../../domain/entities/product");
const ProductDeletedEvent = require("../../domain/events/ProductDeletedEvent");

class DeleteProducts {
  constructor(productRepo, userRepo, eventDispatcher) {
    this.productRepo = productRepo;
    this.userRepo = userRepo;
    this.eventDispatcher = eventDispatcher;
  }

  async execute({ id, userId, context }) {
    let productData = null;
    let user = null;

    try {
      // 🔎 1️⃣ Buscar usuário
      user = await this.userRepo.findById(userId);
      if (!user) throw new Error("Usuário não encontrado");

      // 📦 3️⃣ Buscar produto
      productData = await this.productRepo.findById(id);
      if (!productData) throw new Error("Produto não encontrado");

         const product = new Product(productData);
      // 🔐 2️⃣ Autorização
      ProductPolicy.canDelete({ user, product });

      // 🧠 4️⃣ Regra de domínio
      product.canBeDeleted();

      // 🗑 5️⃣ Exclusão
      await this.productRepo.delete(id);

      // ✅ Auditoria SUCCESS
      await this.eventDispatcher.dispatch(
        new ProductDeletedEvent({
          entity: "Product",
          entityId: id,
          userId: user.id,
          userEmail: user.email,
          snapshot: productData,
          status: "SUCCESS",
          context
        })
      );

      return { message: "Produto deletado com sucesso" };

    } catch (error) {

      // 🚫 Auditoria BLOCKED ou ERROR
      await this.eventDispatcher.dispatch(
        new ProductDeletedEvent({
          entity: "Product",
          entityId: id,
          userId: user?.id,
          userEmail: user?.email,
          snapshot: productData,
          status: error.message.includes("Usuário") ? "BLOCKED" : "ERROR",
          context,
          errorMessage: error.message
        })
      );

      throw error;
    }
  }
}

module.exports = DeleteProducts;
