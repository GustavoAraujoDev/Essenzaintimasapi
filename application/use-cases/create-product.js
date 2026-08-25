const Product = require("../../domain/entities/product");
const ProductValidator = require("../../domain/entities/productvalidator");
const ProductCreatedEvent = require("../../domain/events/ProductCreatedEvent");

class CreateProduct {
  constructor(productRepo, userRepo, eventDispatcher) {
    this.productRepo = productRepo;
    this.userRepo = userRepo;
    this.eventDispatcher = eventDispatcher;
  }

  async execute({ productData, userId, companyId, context }) {
    let user = null;
    let createdProduct = null;

    try {
      // 🔎 1. Buscar usuário
      user = await this.userRepo.findById(userId);
      if (!user) throw new Error("Usuário não encontrado");

      // 🔐 2. Validação de permissão (nível marketplace)

      // 🛑 2. Garantir companyId (OBRIGATÓRIO)
      if (!companyId) {
        throw new Error("companyId é obrigatório");
      }

      // 🛡 3. Validação de entrada
      ProductValidator.validate(productData);

      // 🔥 4. Normalização com companyId injetado
      const normalizedData = this._normalize({
        ...productData,
        companyId, // 🔥 vindo do controller
      });

      // 🧠 5. Criar entidade rica
      const product = new Product(normalizedData);

      // 🔥 6. Regras de negócio complexas
      this._validateBusinessRules(product);

      // 💾 7. Persistir
      createdProduct = await this.productRepo.create(product);

      // 📡 8. Evento de sucesso
      await this.eventDispatcher.dispatch(
        new ProductCreatedEvent({
          entity: "Product",
          entityId: createdProduct.id,
          userId: user.id,
          userEmail: user.email,
          newData: createdProduct,
          status: "SUCCESS",
          context,
        }),
      );

      return createdProduct;
    } catch (error) {
      // 🚨 Evento de erro (observabilidade real)
      await this.eventDispatcher.dispatch(
        new ProductCreatedEvent({
          entity: "Product",
          entityId: null,
          userId: user?.id,
          userEmail: user?.email,
          newData: productData,
          status: "ERROR",
          context,
          errorMessage: error.message,
        }),
      );

      throw error;
    }
  }

  // 🔥 Normalização padrão marketplace
  _normalize(data) {
    return {
      ...data,
      status: data.status || "ACTIVE",
      attribute_keys: data.attribute_keys || [], // Garanta que ele passe adiante
      images: data.images || [],
      skus: data.skus || [],
      modifiers: data.modifiers || [],
      availability: data.availability || {},
    };
  }

  // 🧠 Regras de negócio nível iFood
  _validateBusinessRules(product) {
    // 🔥 Regra 1: Produto deve ter pelo menos 1 SKU
    if (!product.skus || product.skus.length === 0) {
      throw new Error("Produto deve ter pelo menos um SKU");
    }

    // 🔥 Regra 2: SKU precisa de preço
    product.skus.forEach((sku) => {
      if (sku.price == null || sku.price < 0) {
        throw new Error(`SKU inválido: ${sku.name}`);
      }
    });

    // 🔥 Regra 3: modifiers (min/max)
    product.modifiers.forEach((group) => {
      if (group.min > group.max) {
        throw new Error(`Modifier inválido: ${group.name}`);
      }

      if (group.required && group.min === 0) {
        throw new Error(`Modifier obrigatório precisa min > 0`);
      }
    });

    // 🔥 Regra 4: horário válido
    if (product.availability?.start && product.availability?.end) {
      if (product.availability.start >= product.availability.end) {
        throw new Error("Horário inválido");
      }
    }
  }
}

module.exports = CreateProduct;
