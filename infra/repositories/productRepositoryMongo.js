const mongoose = require("mongoose");
const ProductRepository = require("../../domain/entities/productReposity");

const SkuSchema = new mongoose.Schema(
  {
    // Opcional: Um nome amigável gerado automaticamente (ex: "Lasanha Carne G")
    name: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },

    // Aqui salvamos os pares. Ex: { "Sabor": "Frango", "Tamanho": "M" }
    attributes: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    _id: true,
    timestamps: true,
  },
);

const ModifierItemSchema = new mongoose.Schema(
  {
    name: String,
    price: Number,
    id: String,
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { _id: true },
);

const ModifierGroupSchema = new mongoose.Schema(
  {
    name: String,
    required: Boolean,
    min: Number,
    max: Number,
    items: [ModifierItemSchema],
  },
  { _id: true },
);

const AvailabilitySchema = new mongoose.Schema(
  {
    days: [String],
    start: String,
    end: String,
  },
  { _id: false },
);

const ProductSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    description: { type: String, required: true },

    basePrice: { type: Number, required: true },

    images: [String],

    categoryId: { type: String, required: true },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },

    attribute_keys: [String],

    skus: [SkuSchema],

    modifiers: [ModifierGroupSchema],

    availability: AvailabilitySchema,
  },
  { timestamps: true },
);

const ProductModel = mongoose.model("Product", ProductSchema);

class ProductRepositoryMongo extends ProductRepository {
  async create(productData) {
    const product = await ProductModel.create(productData);
    return this._mapToDomain(product);
  }

  async findAll(filters = {}) {
    const query = {};

    if (filters.categoryId) {
      query.categoryId = filters.categoryId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    const products = await ProductModel.find(query).lean();

    return products.map(this._mapToDomain);
  }

  async findById(id) {
    const product = await ProductModel.findOne({ id: id }).lean();
    if (!product) return null;

    return this._mapToDomain(product);
  }

  async findByCategory(categoryId) {
    const products = await ProductModel.find({ categoryId }).lean();
    return products.map(this._mapToDomain);
  }

  async findActiveProducts() {
    const products = await ProductModel.find({ status: "ACTIVE" }).lean();
    return products.map(this._mapToDomain);
  }

  async findAvailableNow() {
    const now = new Date();
    const hour = now.toTimeString().slice(0, 5);

    const products = await ProductModel.find({
      status: "ACTIVE",
      "availability.start": { $lte: hour },
      "availability.end": { $gte: hour },
    }).lean();

    return products.map(this._mapToDomain);
  }

  async update(product) {
    const updated = await ProductModel.findOneAndUpdate(
      { id: product.id }, // 1. Filtro para achar o documento
      {
        // 2. Dados para atualizar
        $set: {
          name: product.name,
          description: product.description,
          basePrice: product.basePrice,
          images: product.images,
          categoryId: product.categoryId,
          status: product.status,
          skus: product.skus, // Aqui o estoque reduzido é enviado
          modifiers: product.modifiers,
          availability: product.availability,
        },
      },
      {
        new: true, // Retorna o documento já atualizado
        runValidators: true,
      },
    ).lean();

    if (!updated) {
      throw new Error(
        `Produto ${product.id} não encontrado no banco para atualização.`,
      );
    }

    return this._mapToDomain(updated);
  }

  async updateStock(skuId, quantity) {
    const product = await ProductModel.findOne({ "skus._id": skuId });

    if (!product) throw new Error("SKU não encontrado");

    const sku = product.skus.id(skuId);
    sku.stock = quantity;

    await product.save();

    return true;
  }

  async delete(id) {
    // findOneAndDelete aceita qualquer campo, findByIdAndDelete só aceita _id
    return await ProductModel.findOneAndDelete({ id: id });
  }

  // 🔥 mapper central (padrão enterprise)
  _mapToDomain(product) {
    if (!product) return null;

    return {
      // Se existir o campo 'id' (PROD-xxx), usa ele. Caso contrário, usa o _id.
      id: product.id || product._id.toString(),
      _id: product._id.toString(), // Mantém o _id original disponível se precisar
      companyId: product.companyId,
      name: product.name,
      description: product.description,
      basePrice: product.basePrice,
      images: product.images,
      categoryId: product.categoryId,
      attribute_keys: product.attribute_keys || [], // <-- ADICIONE ISSO AQUI
      status: product.status,
      skus: product.skus,
      modifiers: product.modifiers,
      availability: product.availability,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}

module.exports = {
  ProductRepositoryMongo,
  ProductModel,
};
