// controllers/CouponController.js
const CouponRepository = require("../../../infra/repositories/CupomRepositoryMongo");

class CouponController {
  // ==========================================
  // CRUD BÁSICO
  // ==========================================

  async create(req, res) {
    try {
      const existing = await CouponRepository.findByCode(req.body.code);
      if (existing)
        return res
          .status(400)
          .json({ error: "Código de cupom já cadastrado." });

      const coupon = await CouponRepository.create(req.body);
      return res.status(201).json(coupon);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const coupons = await CouponRepository.findAll();
      return res.json(coupons);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const coupon = await CouponRepository.findById(req.params.id);
      if (!coupon)
        return res.status(404).json({ error: "Cupom não encontrado." });
      return res.json(coupon);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const coupon = await CouponRepository.update(req.params.id, req.body);
      if (!coupon)
        return res.status(404).json({ error: "Cupom não encontrado." });
      return res.json(coupon);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const coupon = await CouponRepository.delete(req.params.id);
      if (!coupon)
        return res.status(404).json({ error: "Cupom não encontrado." });
      return res.json({ message: "Cupom deletado com sucesso." });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ==========================================
  // REGRAS DE NEGÓCIO EXTRAS PARA A TELA
  // ==========================================

  // ==========================================
  // VALIDAÇÃO POR TELEFONE
  // ==========================================

  async validateAndCalculate(req, res) {
    try {
      const { code, purchaseValue, customerPhone } = req.body;

      const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, "") : "";

      const coupon = await CouponRepository.findByCode(code);
      if (!coupon)
        return res.status(404).json({ valid: false, error: "Cupom inválido." });

      if (!coupon.isActive)
        return res
          .status(400)
          .json({ valid: false, error: "Este cupom está inativo." });

      // 1. Validação de Data
      if (new Date() > new Date(coupon.expirationDate)) {
        return res
          .status(400)
          .json({ valid: false, error: "Este cupom já expirou." });
      }

      // 2. Validação de Limite Global de Usos
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return res
          .status(400)
          .json({ valid: false, error: "Este cupom esgotou." });
      }

      // 3. Validação de Valor Mínimo
      if (purchaseValue < coupon.minPurchaseValue) {
        return res.status(400).json({
          valid: false,
          error: `O valor mínimo para este cupom é R$ ${coupon.minPurchaseValue.toFixed(2).replace(".", ",")}`,
        });
      }

      // 4. VALIDAÇÃO POR TELEFONE
      if (cleanPhone) {
        const phoneUsage = coupon.usedBy.find(
          (u) => u.customerPhone === cleanPhone,
        );
        if (phoneUsage && phoneUsage.count >= coupon.limitPerPhone) {
          return res.status(400).json({
            valid: false,
            error: `Este número de telefone já atingiu o limite de uso para este cupom.`,
          });
        }
      }

      // 5. Cálculo do Desconto
      let discount = 0;
      if (coupon.type === "fixed") {
        discount = coupon.value;
      } else if (coupon.type === "percentage") {
        discount = purchaseValue * (coupon.value / 100);
        if (coupon.maxDiscountValue && discount > coupon.maxDiscountValue) {
          discount = coupon.maxDiscountValue;
        }
      }

      if (discount > purchaseValue) discount = purchaseValue;

      // 🔥 RETORNO ENRIQUECIDO: Passando type, value e maxDiscountValue para o carrinho calcular o teto dinâmico
      return res.json({
        valid: true,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        maxDiscountValue: coupon.maxDiscountValue || 0,
        discountValue: discount,
        finalValue: purchaseValue - discount,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // 🔥 MÉTODO ATUALIZADO: Agora captura as métricas financeiras enviadas no checkout
  async applyUsage(req, res) {
    try {
      // 💰 Pegando o valor bruto e o desconto aplicado vindos do corpo da requisição (req.body)
      const { code, customerPhone, orderValue, discountApplied } = req.body;

      if (!customerPhone)
        return res.status(400).json({
          error: "O telefone do cliente é obrigatório para aplicar o cupom.",
        });

      const cleanPhone = customerPhone.replace(/\D/g, "");
      const coupon = await CouponRepository.findByCode(code);

      if (!coupon)
        return res.status(404).json({ error: "Cupom não encontrado." });

      // 💸 Repassando os valores para o repositório salvar de forma atômica no Mongo
      const updatedCoupon = await CouponRepository.incrementUsage(
        coupon._id,
        cleanPhone,
        orderValue,
        discountApplied,
      );

      return res.json({
        message: "Cupom aplicado com sucesso ao telefone informado.",
        usageCount: updatedCoupon.usageCount,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new CouponController();
