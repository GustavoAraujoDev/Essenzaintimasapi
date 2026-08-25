const mongoose = require("mongoose");
const CompanyRepository = require("../../domain/entities/companyRepository");

/* ==========================
   SCHEMA COMPANY (TENANT)
========================== */
const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    document: { type: String, required: true, unique: true },

    email: String,
    phone: String,

    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "INACTIVE"],
      default: "ACTIVE",
      index: true
    },

    plan: {
      type: String,
      enum: ["FREE", "PRO", "ENTERPRISE"],
      default: "FREE"
    },

    address: {
      street: String,
      number: String,
      city: String,
      state: String,
      zipCode: String
    },

    settings: {
      type: Object,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

/* ==========================
   INDEX (ESCALA)
========================== */
companySchema.index({ document: 1 });
companySchema.index({ status: 1 });

const CompanyModel =
  mongoose.models.Company || mongoose.model("Company", companySchema);

/* ==========================
   REPOSITORY IMPLEMENTATION
========================== */
class CompanyRepositoryMongo extends CompanyRepository {

  async criar(companyData) {
    return await CompanyModel.create(companyData);
  }

  async buscarPorId(id) {
    const company = await CompanyModel.findById(id);

    if (!company) {
      throw new Error("Empresa não encontrada");
    }

    return company;
  }

  async buscarPorDocumento(document) {
    return await CompanyModel.findOne({ document });
  }

  async listar() {
    return await CompanyModel.find().sort({ createdAt: -1 });
  }

  async atualizar(id, dados) {
    const company = await CompanyModel.findByIdAndUpdate(
      id,
      dados,
      { new: true }
    );

    if (!company) {
      throw new Error("Empresa não encontrada");
    }

    return company;
  }

  async atualizarStatus(id, status) {
    const company = await CompanyModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!company) {
      throw new Error("Empresa não encontrada");
    }

    return company;
  }

  async deletar(id) {
    const company = await CompanyModel.findByIdAndDelete(id);

    if (!company) {
      throw new Error("Empresa não encontrada");
    }

    return company;
  }
}

module.exports = CompanyRepositoryMongo;