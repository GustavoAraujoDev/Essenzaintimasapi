class ProductRepository {
  create(product) {}

  findAll(filters) {}

  findById(id) {}

  update(product) {}

  delete(id) {}

  // 🔥 novos (nível iFood)
  findByCategory(categoryId) {}

  findActiveProducts() {}

  updateStock(skuId, quantity) {}

  findAvailableNow() {}
}

module.exports = ProductRepository;