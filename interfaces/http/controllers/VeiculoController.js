// controllers/motoboy-controller.js
const VehicleRepositoryMongo = require("../../../infra/repositories/veiculoRepositoryMongo");

class MotoboyController {
  async cadastrarVeiculo(req, res) {
    try {
      const userId = req.user.id;
      const { placa, modelo, cor } = req.body;

      if (!placa || !modelo || !cor) {
        return res
          .status(422)
          .json({ error: "Placa, modelo e cor são obrigatórios." });
      }

      const vehicleRepo = new VehicleRepositoryMongo();

      // Regra de negócio: impede duplicidade de placa
      const placaExiste = await vehicleRepo.findByPlaca(placa);
      if (placaExiste) {
        return res.status(409).json({
          error: "Esta placa de veículo já está cadastrada no sistema.",
        });
      }

      // Regra de negócio: impede que o mesmo motoboy cadastre duas motos
      const jaPossuiVeiculo = await vehicleRepo.findByUserId(userId);
      if (jaPossuiVeiculo) {
        return res
          .status(409)
          .json({ error: "Você já possui um veículo cadastrado." });
      }

      // Se você for usar a classe isolada de Use Case (Recomendado pelo seu padrão Clean):
      // const cadastrarVeiculoUseCase = new CadastrarVeiculoUseCase(vehicleRepo);
      // const veiculo = await cadastrarVeiculoUseCase.execute({ userId, placa, modelo, cor });

      // Salvando direto via repositório temporariamente:
      const veiculo = await vehicleRepo.create({
        userId,
        placa,
        modelo,
        cor,
      });

      return res.status(201).json({
        success: true,
        message: "Veículo cadastrado com sucesso e vinculado ao seu perfil.",
        data: veiculo,
      });
    } catch (error) {
      console.error("[VEHICLE_CONTROLLER_ERROR]", error.message);
      return res.status(500).json({
        error: "Erro interno ao cadastrar veículo.",
        details: error.message, // 👈 Isso vai retornar no seu 'dados.error' do front o que quebrou!
      });
    }
  }

  async buscarVeiculoDoUsuario(req, res) {
    try {
      const userId = req.user.id;

      // 🎯 CORREÇÃO: Instancia o repositório assim como você fez no cadastro
      const vehicleRepo = new VehicleRepositoryMongo();

      // 🎯 CORREÇÃO: Usa o método correto do repositório isolando o Mongoose
      const veiculo = await vehicleRepo.findByUserId(userId);

      if (!veiculo) {
        return res
          .status(404)
          .json({ error: "Nenhum veículo configurado para este usuário." });
      }

      return res.status(200).json(veiculo);
    } catch (err) {
      console.error("[VEHICLE_CONTROLLER_GET_ERROR]", err.message);
      return res
        .status(500)
        .json({
          error: "Erro ao buscar veículo do banco.",
          details: err.message,
        });
    }
  }
}

module.exports = new MotoboyController();
