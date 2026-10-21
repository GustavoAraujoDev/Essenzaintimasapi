const express = require("express");
const router = express.Router();
const AuthMiddleware = require("../auth/AuthMiddleware");
const JwtService = require("../auth/JwtService");
const jwtService = new JwtService();

// Seu Controller
const MotoboyController = require("../controllers/VeiculoController");
const { UserRepositoryMongo } = require( "../../../infra/repositories/UserRepositoryMongo");
const MembershipRepositoryMongo = require("../../../infra/repositories/MembershipRepositoryMongo");
const userRepository = new UserRepositoryMongo();
const membershipRepository = new MembershipRepositoryMongo();

const authMiddleware = AuthMiddleware(
  jwtService,
  userRepository,
  membershipRepository
);

router.use(authMiddleware);
/* ==========================================================
   🎯 CORREÇÃO: Aplique o middleware diretamente na rota POST
   ========================================================== */
router.post(
  "/veiculo",
  // Executa e gera o middleware com o jwtService injetado
  MotoboyController.cadastrarVeiculo,
);

// No seu arquivo de rotas de veículos:
router.get(
  "/veiculo",
  MotoboyController.buscarVeiculoDoUsuario, // 👈 Implemente este método no VeiculoController
);

module.exports = router;
