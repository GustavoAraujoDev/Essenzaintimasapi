const mongoose = require("mongoose");
const MembershipRepository = require("../../domain/entities/MembershipRepository");

/* ==========================
   SCHEMA MEMBERSHIP (TENANT CORE)
========================== */
const membershipSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    companyId: { type: String, required: true, index: true },

    role: {
      type: String,
      enum: ["OWNER", "ADMIN", "STAFF"],
      required: true,
      index: true
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true
    }
  },
  {
    timestamps: true
  }
);

/* ==========================
   ÍNDICES IMPORTANTES
========================== */
membershipSchema.index({ userId: 1, companyId: 1 }, { unique: true });
membershipSchema.index({ companyId: 1, role: 1 });

const MembershipModel =
  mongoose.models.Membership || mongoose.model("Membership", membershipSchema);

/* ==========================
   REPOSITORY IMPLEMENTATION
========================== */
class MembershipRepositoryMongo extends MembershipRepository {

  async criar(membership) {
    return await MembershipModel.create(membership);
  }

  async buscarPorId(userId) {
    const membership = await MembershipModel.findOne({ userId });

    if (!membership) {
      throw new Error("Membership não encontrada");
    }

    return membership;
  }

  async buscarPorUserECompany(userId, companyId) {
    return await MembershipModel.findOne({ userId, companyId });
  }

  async listarPorUser(userId) {
    return await MembershipModel.find({ userId });
  }

  async listarPorCompany(companyId) {
    return await MembershipModel.find({ companyId });
  }

  async atualizar(id, dados) {
    const membership = await MembershipModel.findByIdAndUpdate(
      id,
      dados,
      { new: true }
    );

    if (!membership) {
      throw new Error("Membership não encontrada");
    }

    return membership;
  }

  async deletar(id) {
    const membership = await MembershipModel.findByIdAndDelete(id);

    if (!membership) {
      throw new Error("Membership não encontrada");
    }

    return membership;
  }
}

module.exports = MembershipRepositoryMongo;