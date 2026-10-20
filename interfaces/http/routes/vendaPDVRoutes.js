const express = require("express");

const router = express.Router();

function criarVendaPDVRoutes({
  criarVendaUseCase,
  cancelarVendaUseCase,
  vendaRepository,
  authMiddleware,
}) {
  const VendaPDVController = require("../controllers/VendaPDVController");

  const controller = new VendaPDVController({
    criarVendaUseCase,
    cancelarVendaUseCase,
    vendaRepository,
  });

  // Protege todas as rotas com seu middleware de autenticação.
  router.use(authMiddleware);

  router.get("/dashboard", controller.dashboard);
  router.get("/estatisticas", controller.estatisticas);
  router.get("/comparativo", controller.comparativo);
  router.get("/por-dia", controller.vendasPorDia);
  router.get("/por-hora", controller.vendasPorHora);
  router.get("/produtos-mais-vendidos", controller.produtosMaisVendidos);
  router.get("/operadores", controller.vendasPorOperador);
  router.get("/pagamentos", controller.vendasPorPagamento);
  router.get("/categorias", controller.vendasPorCategoria);
  router.get("/status/resumo", controller.resumoPorStatus);

  router.post("/", controller.criar);
  router.get("/", controller.listar);
  router.get("/:id", controller.buscarPorId);
  router.patch("/:id/cancelar", controller.cancelar);

  return router;
}

module.exports = criarVendaPDVRoutes;