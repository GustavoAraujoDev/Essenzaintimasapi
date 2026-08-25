const express = require("express");
const router = express.Router();
const AuthMiddleware = require("../auth/AuthMiddleware");
const JwtService = require("../auth/JwtService");
const jwtService = new JwtService();

// Seu Controller
const MotoboyController = require("../controllers/VeiculoController");

/* ==========================================================
   🎯 CORREÇÃO: Aplique o middleware diretamente na rota POST
   ========================================================== */
router.post(
  "/veiculo",
  AuthMiddleware(jwtService), // Executa e gera o middleware com o jwtService injetado
  MotoboyController.cadastrarVeiculo,
);

// No seu arquivo de rotas de veículos:
router.get(
  "/veiculo",
  AuthMiddleware(jwtService),
  MotoboyController.buscarVeiculoDoUsuario, // 👈 Implemente este método no VeiculoController
);

module.exports = router;
