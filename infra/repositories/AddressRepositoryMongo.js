const mongoose = require("mongoose");
const AddressRepository = require("../../domain/entities/AddressRepository");

/* ==========================
   SCHEMA ADDRESS (USER DOMAIN)
========================== */
const addressSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },

    street: { type: String, required: true },
    number: { type: String, required: true },
    district: { type: String, required: true },

    city: { type: String, required: true },
    state: { type: String, required: true },

    zipCode: { type: String, required: true, index: true },

    complement: { type: String, default: null },

    isDefault: { type: Boolean, default: false, index: true }
  },
  {
    timestamps: true
  }
);

/* ==========================
   ÍNDICES (ESCALA)
========================== */
addressSchema.index({ userId: 1 });
addressSchema.index({ userId: 1, isDefault: 1 });

const AddressModel =
  mongoose.models.Address || mongoose.model("Address", addressSchema);

/* ==========================
   REPOSITORY IMPLEMENTATION
========================== */
class AddressRepositoryMongo extends AddressRepository {

  async criar(address) {
    // 🔥 Se novo endereço for padrão, remove outros padrões do user
    if (address.isDefault) {
      await AddressModel.updateMany(
        { userId: address.userId },
        { isDefault: false }
      );
    }

    return await AddressModel.create(address);
  }

  async buscarPorId(id) {
    const address = await AddressModel.findById(id);

    if (!address) {
      throw new Error("Endereço não encontrado");
    }

    return address;
  }

  async listarPorUser(userId) {
    return await AddressModel.find({ userId }).sort({ isDefault: -1 });
  }

  async atualizar(id, dados) {
    const address = await AddressModel.findByIdAndUpdate(
      id,
      dados,
      { new: true }
    );

    if (!address) {
      throw new Error("Endereço não encontrado");
    }

    return address;
  }

  async definirComoPadrao(userId, addressId) {
    // remove padrão atual
    await AddressModel.updateMany(
      { userId },
      { isDefault: false }
    );

    // seta novo padrão
    const address = await AddressModel.findByIdAndUpdate(
      addressId,
      { isDefault: true },
      { new: true }
    );

    if (!address) {
      throw new Error("Endereço não encontrado");
    }

    return address;
  }

  async deletar(id) {
    const address = await AddressModel.findByIdAndDelete(id);

    if (!address) {
      throw new Error("Endereço não encontrado");
    }

    return address;
  }
}

module.exports = AddressRepositoryMongo;