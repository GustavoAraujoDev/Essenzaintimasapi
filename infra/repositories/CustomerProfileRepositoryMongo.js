const mongoose = require("mongoose");
const CustomerProfileRepository = require("../../domain/entities/CustomerProfileRepository");

/* ==========================
   SCHEMA CUSTOMER PROFILE
========================== */
const customerProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },

    name: { type: String, required: true, index: true },
    phone: { type: String, index: true },

    document: { type: String, default: null },

    address: {
      street: String,
      number: String,
      district: String,
      city: String,
      state: String,
      zipCode: String
    }
  },
  {
    timestamps: true
  }
);

/* ==========================
   ÍNDICES IMPORTANTES
========================== */
customerProfileSchema.index({ userId: 1 }, { unique: true });

const CustomerProfileModel =
  mongoose.models.CustomerProfile ||
  mongoose.model("CustomerProfile", customerProfileSchema);

/* ==========================
   REPOSITORY IMPLEMENTATION
========================== */
class CustomerProfileRepositoryMongo extends CustomerProfileRepository {

  async criar(profile) {
    return await CustomerProfileModel.create(profile);
  }

  async buscarPorId(id) {
    const profile = await CustomerProfileModel.findById(id);

    if (!profile) {
      throw new Error("Perfil não encontrado");
    }

    return profile;
  }

  async buscarPorUserId(userId) {
    return await CustomerProfileModel.findOne({ userId });
  }

  async atualizar(id, dados) {
    const profile = await CustomerProfileModel.findByIdAndUpdate(
      id,
      dados,
      { new: true }
    );

    if (!profile) {
      throw new Error("Perfil não encontrado");
    }

    return profile;
  }

  async deletar(id) {
    const profile = await CustomerProfileModel.findByIdAndDelete(id);

    if (!profile) {
      throw new Error("Perfil não encontrado");
    }

    return profile;
  }
}

module.exports = CustomerProfileRepositoryMongo;