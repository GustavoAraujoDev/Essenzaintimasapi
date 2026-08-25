const Product = require("../../domain/entities/product");
class GetProducts {
    constructor(productRepo){
    this.productRepo = productRepo;
  }
  async execute() {
    return await this.productRepo.findAll();
  }
}

module.exports = GetProducts;
