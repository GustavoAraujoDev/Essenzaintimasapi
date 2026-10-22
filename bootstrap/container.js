
"use strict";

const EventDispatcher = require("../infra/audit/EventDispatcher");
const AuditLogHandler = require("../infra/audit/handlers/AuditLogHandler");
const AuditRepositoryMongo = require("../infra/repositories/AuditRepositoryMongo");

const ProductRepositoryMongo = require("../infra/repositories/ProductRepositoryMongo");
const RestoreStockOnSaleCancelledHandler = require(
  "../application/handlers/RestoreStockOnSaleCancelledHandler"
);

const eventDispatcher = new EventDispatcher();
const auditRepository = new AuditRepositoryMongo();
const productRepository = new ProductRepositoryMongo();

const auditHandler = new AuditLogHandler(auditRepository);

const restoreStockHandler = new RestoreStockOnSaleCancelledHandler(
  productRepository,
  eventDispatcher
);

// 🔥 Product Events
eventDispatcher.register("ProductDeletedEvent", auditHandler);
eventDispatcher.register("ProductStockAddedEvent", auditHandler);
eventDispatcher.register("ProductCreatedEvent", auditHandler);
eventDispatcher.register("ProductSoldEvent", auditHandler);

// 🔥 Order Events
eventDispatcher.register("PedidoCriadoEvent", auditHandler);
eventDispatcher.register("PedidoAtualizadoEvent", auditHandler);

// 🔥 Sale Cancellation
eventDispatcher.register(
  "SaleCancelledEvent",
  restoreStockHandler
);

// 🔥 User Events
eventDispatcher.register("UserBlocked", auditHandler);
eventDispatcher.register("UserLoggedIn", auditHandler);

module.exports = {
  eventDispatcher,
  auditRepository,
};
