// models/DeliveryFee.js
const mongoose = require("mongoose");

const DeliveryFeeSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    taxa: {
      type: Number,
      required: true,
      default: 0.0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const DeliveryFeeModel = mongoose.model("DeliveryFee", DeliveryFeeSchema);

class DeliveryFeeRepository {
  // C - CREATE (Criar taxa de entrega de um novo bairro)
  async create(feeData) {
    return await DeliveryFeeModel.create(feeData);
  }

  // R - READ ALL (Buscar todas as taxas cadastradas)
  async findAll() {
    return await DeliveryFeeModel.find().sort({ nome: 1 });
  }

  // R - READ BY ID (Buscar uma taxa específica pelo ID)
  async findById(id) {
    return await DeliveryFeeModel.findById(id);
  }

  // R - READ BY NAME (Buscar pelo nome do bairro)
  async findByName(nome) {
    // Busca ignorando maiúsculas/minúsculas e espaços extras nas pontas
    return await DeliveryFeeModel.findOne({
      nome: { $regex: new RegExp(`^${nome.trim()}$`, "i") },
    });
  }

  // U - UPDATE (Atualizar valor da taxa ou status de ativo)
  async update(id, updateData) {
    return await DeliveryFeeModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }

  // D - DELETE (Remover bairro e taxa do banco)
  async delete(id) {
    return await DeliveryFeeModel.findByIdAndDelete(id);
  }
}

module.exports = new DeliveryFeeRepository();
