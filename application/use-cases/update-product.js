// domain/use-cases/UpdateProductUseCase.js
const ProductPolicy = require("../../domain/policies/ProductPolicy");

class UpdateProductUseCase {
  constructor(productRepo) {
    this.productRepo = productRepo;
  }

  async execute({ user, productId, updateData }) {
    // 1. Recuperar o produto atual para validar contra a Policy
    const currentProduct = await this.productRepo.findById(productId);

    if (!currentProduct) {
      throw new Error(`Produto ${productId} não encontrado.`);
    }

    // 2. Aplicação da Policy (Autorização)
    // Se não tiver permissão, a Policy lança o erro e interrompe o fluxo
    ProductPolicy.canEdit({ user, product: currentProduct });

    // 3. Sanitização de dados (Segurança)
    const protectedFields = ["id", "_id", "companyId", "createdAt"];
    protectedFields.forEach((field) => delete updateData[field]);

    // 4. Persistência
    return await this.productRepo.update({
      id: productId,
      ...updateData,
    });
  }
}

module.exports = UpdateProductUseCase;
