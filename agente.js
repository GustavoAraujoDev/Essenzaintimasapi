const { io } = require("socket.io-client");
const EpsonPrinterService = require("../pasta sem título/infra/printer/EpsonPrinterService");

// 🔴 Insira o endereço real do seu projeto hospedado no Render
const URL_RENDER = "https://prafoodapi.onrender.com";
const URL_LOCAL = "http://127.0.0.1:3000";

console.log("[AGENTE] Iniciando escuta local...");

const printerService = new EpsonPrinterService();
printerService.connectToPrinter(); // Conecta na USB usando a função modificada

const socket = io(URL_LOCAL);

socket.on("connect", () => {
  console.log("✅ Conectado ao Render com sucesso!");
  socket.emit("registrar-loja"); // Avisa o Render que a impressora está online
});

// Escuta o evento disparado pela nuvem
socket.on("imprimir-pedido", async (pedido) => {
  console.log(
    `🚀 Novo pedido recebido (#${pedido.id}). Enviando para a USB...`,
  );
  try {
    // Roda o seu método imprimir original que processa o layout
    await printerService.imprimir(pedido);
    console.log("✅ Impresso!");
  } catch (err) {
    console.error("❌ Falha ao cuspir na bobina:", err.message);
  }
});

socket.on("disconnect", () => {
  console.log("⚠️ Conexão perdida com o Render. Tentando restabelecer...");
});
