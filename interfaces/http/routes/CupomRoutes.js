// routes/couponRoutes.js
const express = require("express");
const router = express.Router();
const CouponController = require("../controllers/CupomController");
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

// CRUD Admin
router.post("/admin/coupons", CouponController.create);
router.get("/admin/coupons", CouponController.getAll);
router.get("/admin/coupons/:id", CouponController.getById);
router.put("/admin/coupons/:id", CouponController.update);
router.delete("/admin/coupons/:id", CouponController.delete);

// Checkout / Fluxo Sem Login
router.post("/coupons/validate", CouponController.validateAndCalculate); // body: { code, purchaseValue, customerPhone }
router.post("/coupons/apply", CouponController.applyUsage); // body: { code, customerPhone }

module.exports = router;
