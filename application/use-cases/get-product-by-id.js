const Product = require("../../domain/entities/product");

class GetProductsfindById {
    constructor(productRepo){
    this.productRepo = productRepo;
  }
  async execute(id) {
    return await this.productRepo.findById(id);
  }
}

module.exports = GetProductsfindById;
