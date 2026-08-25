// models/Vehicle.js
const mongoose = require("mongoose");

const VehicleSchema = new mongoose.Schema(
  {
    userId: {
      type: String, // 🎯 CORREÇÃO: Mudado de ObjectId para String para aceitar seu UUID
      required: true,
      unique: true, // Garante que cada motoboy só tenha uma moto ativa cadastrada
    },
    modelo: {
      type: String,
      required: true,
      trim: true,
    },
    placa: {
      type: String,
      required: true,
      unique: true, // Evita duas motos com a mesma placa no sistema
      trim: true,
      uppercase: true, // Salva sempre em maiúsculo (ex: ABC1D23)
    },
    cor: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const VehicleModel = mongoose.model("Vehicle", VehicleSchema);

class VehicleRepositoryMongo {
  // C - Criar o veículo vinculado ao motoboy
  async create(vehicleData) {
    return await VehicleModel.create(vehicleData);
  }

  // R - Buscar veículo pelo ID do Usuário (Motoboy)
  async findByUserId(userId) {
    return await VehicleModel.findOne({ userId });
  }

  // R - Buscar veículo pela Placa
  async findByPlaca(placa) {
    const placaNormalizada = placa.trim().toUpperCase();
    return await VehicleModel.findOne({ placa: placaNormalizada });
  }

  // U - Atualizar dados da moto (caso ele troque de veículo)
  async updateByUserId(userId, updateData) {
    if (updateData.placa) {
      updateData.placa = updateData.placa.trim().toUpperCase();
    }
    return await VehicleModel.findOneAndUpdate({ userId }, updateData, {
      new: true,
      runValidators: true,
    });
  }

  // D - Deletar veículo do sistema
  async deleteByUserId(userId) {
    return await VehicleModel.findOneAndDelete({ userId });
  }
}

// Exporta a classe (não instanciada, para você usar New no Use Case se preferir)
module.exports = VehicleRepositoryMongo;
