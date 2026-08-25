class Product {
  constructor({
    id,
    companyId,
    name,
    description,
    basePrice,
    images = [],
    categoryId,
    status = "ACTIVE",
    attribute_keys = [],
    skus = [],
    modifiers = [],
    availability = {},
    createdAt = new Date(),
    updatedAt = new Date(),
  }) {
    // 🔒 validações básicas
    if (!name || typeof name !== "string") {
      throw new Error("Nome inválido");
    }

    if (!description || typeof description !== "string") {
      throw new Error("Descrição inválida");
    }

    if (typeof basePrice !== "number" || basePrice < 0) {
      throw new Error("Preço base inválido");
    }

    if (!Array.isArray(images)) {
      throw new Error("Images deve ser array");
    }

    if (!categoryId) {
      throw new Error("Categoria obrigatória");
    }

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      throw new Error("Status inválido");
    }

    if (!Array.isArray(skus)) {
      throw new Error("SKUs inválidos");
    }

    if (!Array.isArray(modifiers)) {
      throw new Error("Modifiers inválidos");
    }

    // 📦 dados principais
    this.id = id || this._gerarId();
    this.companyId = companyId;
    this.name = name;
    this.description = description;
    this.basePrice = basePrice;
    this.images = images;
    this.categoryId = categoryId;
    this.status = status;

    // 🔥 nível iFood
    this.attribute_keys = attribute_keys;
    this.skus = skus; // variações reais
    this.modifiers = modifiers; // adicionais
    this.availability = availability; // horários
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // 🔥 criar SKU (variação real)
  addSku({ id, name, price, stock = 0, attributes = {} }) {
    if (!name) throw new Error("Nome do SKU obrigatório");
    if (price < 0) throw new Error("Preço inválido");

    this.skus.push({
      id,
      name,
      price,
      stock,
      attributes, // { tamanho: "G", bebida: "Coca" }
      createdAt: new Date(),
    });
  }

  // 🔥 remover SKU
  removeSku(skuId) {
    this.skus = this.skus.filter((sku) => sku.id !== skuId);
  }

  // 🔥 adicionar grupo de complementos
  addModifierGroup(group) {
    /*
      {
        id,
        name: "Adicionais",
        required: false,
        min: 0,
        max: 3,
        items: [
          { id, name: "Queijo", price: 5 },
          { id, name: "Bacon", price: 7 }
        ]
      }
    */
    this.modifiers.push(group);
  }

  _gerarId() {
    return "PROD-" + Date.now();
  }

  canBeDeleted() {
    // Exemplo de Regra: Não permitir deletar produto com estoque positivo
    if (this.stock > 0) {
      throw new Error(
        "Não é permitido excluir um produto que ainda possui estoque disponível.",
      );
    }

    // Exemplo de Regra: Não permitir deletar se estiver em uma campanha ativa
    if (this.status === "ACTIVE") {
      throw new Error(
        "Produto não pode ser excluído enquanto estiver em uma promoção ativa.",
      );
    }

    return true;
  }

  // 🔥 atualizar disponibilidade
  setAvailability(schedule) {
    /*
      {
        days: ["MON", "TUE"],
        start: "18:00",
        end: "23:00"
      }
    */
    this.availability = schedule;
  }

  // 🔥 ativar/desativar
  activate() {
    this.status = "ACTIVE";
  }

  deactivate() {
    this.status = "INACTIVE";
  }

  // 🔥 controle de estoque por SKU
  updateStock(skuId, quantity) {
    const sku = this.skus.find((s) => s.id === skuId);
    if (!sku) throw new Error("SKU não encontrado");

    if (quantity < 0) throw new Error("Estoque inválido");

    sku.stock = quantity;
  }

  // 🔥 remover estoque de um SKU específico
  removeStock(skuId, quantity) {
    // Use .toString() para garantir que ambos sejam strings na comparação
    const sku = this.skus.find((s) => s._id.toString() === skuId.toString());

    if (!sku) {
      throw new Error("SKU não encontrado para baixa de estoque");
    }

    if (quantity <= 0) {
      throw new Error("A quantidade a remover deve ser maior que zero");
    }

    if (sku.stock < quantity) {
      throw new Error(
        `Estoque insuficiente para o SKU ${sku.name}. Disponível: ${sku.stock}`,
      );
    }

    sku.stock -= quantity;
    this.updatedAt = new Date(); // Boa prática atualizar o timestamp da entidade pai
  }

  // 🔥 adicionar estoque a um SKU específico
  addStock(skuId, quantity) {
    // Localiza o SKU no array
    const sku = this.skus.find((s) => s._id.toString() === skuId.toString());

    if (!sku) {
      throw new Error("SKU não encontrado para reposição de estoque");
    }

    // Validação de entrada
    if (quantity <= 0) {
      throw new Error("A quantidade a adicionar deve ser maior que zero");
    }

    // Incrementa o estoque
    sku.stock += quantity;

    // Atualiza o timestamp da entidade pai (Produto)
    this.updatedAt = new Date();
  }

  // 🔥 verificar disponibilidade
  isAvailableNow() {
    if (!this.availability.start) return true;

    const now = new Date();
    const hour = now.toTimeString().slice(0, 5);

    return hour >= this.availability.start && hour <= this.availability.end;
  }
}

module.exports = Product;
