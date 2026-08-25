// routes/deliveryFeeRoutes.js
const express = require("express");
const router = express.Router();
const deliveryFeeController = require("../../http/controllers/taxaController");

// As rotas mais específicas devem vir ANTES das rotas com parâmetro dinâmico (:id)
router.get("/search", deliveryFeeController.getByName); // GET /api/delivery-fees/search?nome=bairro

// Rotas CRUD padrão
router.post("/", deliveryFeeController.create); // POST /api/delivery-fees
router.get("/", deliveryFeeController.getAll); // GET /api/delivery-fees
router.get("/:id", deliveryFeeController.getById); // GET /api/delivery-fees/:id
router.put("/:id", deliveryFeeController.update); // PUT /api/delivery-fees/:id
router.delete("/:id", deliveryFeeController.delete); // DELETE /api/delivery-fees/:id

module.exports = router;
