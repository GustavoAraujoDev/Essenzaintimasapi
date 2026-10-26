"use strict";

const express = require("express");
const RelatorioVendasController = require(
  "../controllers/RelatorioVendasController"
);

function criarRotasRelatorioVendas({
  authMiddleware,
  gerarRelatorioVendasUseCase,
}) {
  if (typeof authMiddleware !== "function") {
    throw new Error(
      "O middleware de autenticação é obrigatório."
    );
  }

  if (
    !gerarRelatorioVendasUseCase ||
    typeof gerarRelatorioVendasUseCase.execute !== "function"
  ) {
    throw new Error(
      "GerarRelatorioVendasUseCase é obrigatório."
    );
  }

  const router = express.Router();

  const controller = new RelatorioVendasController(
    gerarRelatorioVendasUseCase
  );

  // Todos os endpoints exigem autenticação.
  router.get(
    "/relatorio",
    authMiddleware,
    controller.gerar
  );

  router.get(
    "/relatorio.csv",
    authMiddleware,
    controller.exportarCSV
  );

  router.get(
    "/relatorio.pdf",
    authMiddleware,
    controller.exportarPDF
  );

  return router;
}

module.exports = criarRotasRelatorioVendas;