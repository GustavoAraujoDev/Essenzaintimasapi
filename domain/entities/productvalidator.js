class ProductValidator {

  static validate(data) {

    if (!data) {
      throw new Error("Dados do produto são obrigatórios");
    }

    // 🧾 Nome
    if (!data.name || typeof data.name !== "string" || data.name.length < 3) {
      throw new Error("Nome inválido");
    }

    // 🧾 Descrição
    if (!data.description || typeof data.description !== "string") {
      throw new Error("Descrição obrigatória");
    }

    // 💰 Preço base
    if (typeof data.basePrice !== "number" || data.basePrice < 0) {
      throw new Error("Preço base inválido");
    }

    // 🖼 Imagens
    if (data.images && !Array.isArray(data.images)) {
      throw new Error("Images deve ser um array");
    }

    // 📦 Categoria
    if (!data.categoryId) {
      throw new Error("Categoria obrigatória");
    }

    // 🔥 SKUs (estrutura)
    if (!Array.isArray(data.skus)) {
      throw new Error("SKUs devem ser um array");
    }

    data.skus.forEach((sku, index) => {
      if (!sku.name) {
        throw new Error(`SKU ${index} sem nome`);
      }

      if (typeof sku.price !== "number") {
        throw new Error(`SKU ${sku.name} com preço inválido`);
      }

      if (sku.stock != null && typeof sku.stock !== "number") {
        throw new Error(`SKU ${sku.name} com estoque inválido`);
      }
    });

    // 🔥 Modifiers (estrutura)
    if (data.modifiers && !Array.isArray(data.modifiers)) {
      throw new Error("Modifiers devem ser array");
    }

    data.modifiers?.forEach((group, index) => {
      if (!group.name) {
        throw new Error(`Grupo de modifier ${index} sem nome`);
      }

      if (!Array.isArray(group.items)) {
        throw new Error(`Grupo ${group.name} sem items`);
      }

      group.items.forEach(item => {
        if (!item.name) {
          throw new Error(`Item sem nome no grupo ${group.name}`);
        }

        if (typeof item.price !== "number") {
          throw new Error(`Preço inválido em ${item.name}`);
        }
      });
    });

    // 🔥 Availability (estrutura)
    if (data.availability) {
      const { start, end } = data.availability;

      if (start && typeof start !== "string") {
        throw new Error("Horário inicial inválido");
      }

      if (end && typeof end !== "string") {
        throw new Error("Horário final inválido");
      }
    }
  }
}

module.exports = ProductValidator;