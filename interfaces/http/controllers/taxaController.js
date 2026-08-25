// controllers/deliveryFeeController.js
const deliveryFeeRepository = require("../../../infra/repositories/taxaRepositoryMongo");

class DeliveryFeeController {
  // ➕ Criar novo bairro/taxa
  async create(req, res) {
    try {
      const { nome, taxa } = req.body;

      if (!nome) {
        return res
          .status(400)
          .json({ error: "O nome do bairro é obrigatório." });
      }

      if (taxa === undefined || taxa < 0) {
        return res
          .status(400)
          .json({ error: "A taxa de entrega não pode ser negativa." });
      }

      // Evita duplicidade no banco de dados do mercado real
      const bairroExiste = await deliveryFeeRepository.findByName(nome);
      if (bairroExiste) {
        return res
          .status(400)
          .json({ error: "Este bairro já está cadastrado." });
      }

      const newFee = await deliveryFeeRepository.create({ nome, taxa });
      return res.status(201).json(newFee);
    } catch (error) {
      return res
        .status(500)
        .json({
          error: "Erro ao criar taxa de entrega.",
          details: error.message,
        });
    }
  }

  // 📋 Listar todos os bairros
  async getAll(req, res) {
    try {
      const fees = await deliveryFeeRepository.findAll();
      return res.status(200).json(fees);
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Erro ao buscar taxas de entrega." });
    }
  }

  // 🔍 Buscar por ID (Útil para o painel administrativo)
  async getById(req, res) {
    try {
      const fee = await deliveryFeeRepository.findById(req.params.id);
      if (!fee) {
        return res
          .status(404)
          .json({ error: "Taxa de entrega não encontrada." });
      }
      return res.status(200).json(fee);
    } catch (error) {
      return res.status(500).json({ error: "Erro ao buscar taxa de entrega." });
    }
  }

  // 🚀 Regra de Negócio: Buscar taxa pelo nome do bairro (Útil para o checkout do cliente)
  async getByName(req, res) {
    try {
      const { nome } = req.query; // Ex: /api/delivery-fees/search?nome=Vila Velha 1
      if (!nome) {
        return res
          .status(400)
          .json({ error: "O parâmetro nome é obrigatório na busca." });
      }

      const fee = await deliveryFeeRepository.findByName(nome);
      if (!fee) {
        return res
          .status(404)
          .json({ error: "Não realizamos entregas neste bairro." });
      }

      if (!fee.isActive) {
        return res
          .status(400)
          .json({
            error:
              "As entregas para este bairro estão temporariamente desativadas.",
          });
      }

      return res.status(200).json(fee);
    } catch (error) {
      return res.status(500).json({ error: "Erro ao buscar bairro." });
    }
  }

  // ✏️ Atualizar taxa ou status do bairro
  async update(req, res) {
    try {
      const { taxa, isActive } = req.body;

      // Validação de negócio: Não permitir taxa negativa na alteração
      if (taxa !== undefined && taxa < 0) {
        return res
          .status(400)
          .json({ error: "A taxa de entrega não pode ser negativa." });
      }

      const updatedFee = await deliveryFeeRepository.update(
        req.params.id,
        req.body,
      );
      if (!updatedFee) {
        return res
          .status(404)
          .json({ error: "Taxa de entrega não encontrada para atualização." });
      }

      return res.status(200).json(updatedFee);
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Erro ao atualizar taxa de entrega." });
    }
  }

  // ❌ Deletar bairro
  async delete(req, res) {
    try {
      const deleted = await deliveryFeeRepository.delete(req.params.id);
      if (!deleted) {
        return res
          .status(404)
          .json({ error: "Taxa de entrega não encontrada para exclusão." });
      }
      return res
        .status(200)
        .json({ message: "Bairro e taxa removidos com sucesso." });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Erro ao deletar taxa de entrega." });
    }
  }
}

module.exports = new DeliveryFeeController();
