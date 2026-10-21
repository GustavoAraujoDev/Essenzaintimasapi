// routes/deliveryFeeRoutes.js
const express = require("express");
const router = express.Router();
const deliveryFeeController = require("../../http/controllers/taxaController");
const { UserRepositoryMongo } = require( "../../../infra/repositories/UserRepositoryMongo");
const MembershipRepositoryMongo = require("/../../../infra/repositories/MembershipRepositoryMongo");
const userRepository = new UserRepositoryMongo();
const membershipRepository = new MembershipRepositoryMongo();
const AuthMiddleware = require("../auth/AuthMiddleware");
const JwtService = require("../auth/JwtService");
const jwtService = new JwtService();

const authMiddleware = AuthMiddleware(
  jwtService,
  userRepository,
  membershipRepository
);

// As rotas mais específicas devem vir ANTES das rotas com parâmetro dinâmico (:id)
router.get("/search", deliveryFeeController.getByName); // GET /api/delivery-fees/search?nome=bairro
router.use(authMiddleware);
// Rotas CRUD padrão
router.post("/", deliveryFeeController.create); // POST /api/delivery-fees
router.get("/", deliveryFeeController.getAll); // GET /api/delivery-fees
router.get("/:id", deliveryFeeController.getById); // GET /api/delivery-fees/:id
router.put("/:id", deliveryFeeController.update); // PUT /api/delivery-fees/:id
router.delete("/:id", deliveryFeeController.delete); // DELETE /api/delivery-fees/:id

module.exports = router;
