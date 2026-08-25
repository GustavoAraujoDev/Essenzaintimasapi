// models/Coupon.js
const mongoose = require("mongoose");

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: { type: String, enum: ["percentage", "fixed"], required: true },
    value: { type: Number, required: true },
    minPurchaseValue: { type: Number, default: 0 },
    maxDiscountValue: { type: Number },
    expirationDate: { type: Date, required: true },
    usageLimit: { type: Number, default: null }, // Limite global de usos do cupom
    usageCount: { type: Number, default: 0 },
    limitPerPhone: { type: Number, default: 1 }, // Limite de vezes que CADA telefone pode usar (Ex: 1 por cliente)
    isActive: { type: Boolean, default: true },
    // Histórico de uso por telefone
    usedBy: [
      {
        customerPhone: { type: String, required: true },
        count: { type: Number, default: 1 },
        orderValue: { type: Number, default: 0 }, // 💰 Valor bruto da compra
        discountApplied: { type: Number, default: 0 }, // 💸 Quanto de desconto o cupom gerou nessa venda
        usedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

const CupomModel = mongoose.model("Cupom", CouponSchema);

class CouponRepository {
  async create(couponData) {
    return await CupomModel.create(couponData);
  }

  async findAll() {
    return await CupomModel.find().sort({ createdAt: -1 });
  }

  async findById(id) {
    return await CupomModel.findById(id);
  }

  async findByCode(code) {
    return await CupomModel.findOne({ code: code.toUpperCase() });
  }

  async update(id, updateData) {
    return await CupomModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }

  async delete(id) {
    return await CupomModel.findByIdAndDelete(id);
  }

  // 🔥 VERSÃO CORRIGIDA: Agora recebe e grava orderValue e discountApplied no Mongo
  async incrementUsage(id, customerPhone, orderValue, discountApplied) {
    // Garante que estamos procurando e salvando APENAS os números limpos do telefone
    const cleanPhone = customerPhone.replace(/\D/g, "");

    // Força a conversão para número para evitar salvar strings vazias ou nulas
    const value = parseFloat(orderValue) || 0;
    const discount = parseFloat(discountApplied) || 0;

    // 1. Tenta atualizar atomicamente se o telefone limpo JÁ EXISTIR no array
    const updated = await CupomModel.findOneAndUpdate(
      { _id: id, "usedBy.customerPhone": cleanPhone },
      {
        $inc: {
          usageCount: 1,
          "usedBy.$.count": 1,
          "usedBy.$.orderValue": value, // 💰 Soma ao valor bruto acumulado deste cliente
          "usedBy.$.discountApplied": discount, // 💸 Soma ao desconto acumulado deste cliente
        },
      },
      { new: true },
    );

    if (updated) return updated;

    // 2. Se o telefone não existia no array, adiciona o subdocumento com os valores reais enviados
    return await CupomModel.findByIdAndUpdate(
      id,
      {
        $inc: { usageCount: 1 },
        $push: {
          usedBy: {
            customerPhone: cleanPhone,
            count: 1,
            orderValue: value, // 💰 Salva o valor bruto da primeira compra
            discountApplied: discount, // 💸 Salva o desconto da primeira compra
          },
        },
      },
      { new: true },
    );
  }
}

module.exports = new CouponRepository();
