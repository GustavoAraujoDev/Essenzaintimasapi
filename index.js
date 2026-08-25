/**
 * @file Server bootstrap
 * @description Arquivo principal responsável por inicializar a aplicação,
 * configurar middlewares, registrar rotas e iniciar o servidor HTTP.
 *
 * @requires dotenv
 * @requires express
 * @requires body-parser
 * @requires cors
 * @requires ./interfaces/http/routes/product-routes
 * @requires ./interfaces/http/routes/pedido-routes
 * @requires ./infra/database/mongodb/mongodb-connection
 */

require("dotenv").config();

const { swaggerUi, swaggerSpec } = require("./swagger");
const express = require("express");
const bodyParser = require("body-parser");
const pinoHttp = require("pino-http");
const client = require("prom-client");
const corsMiddleware = require("./interfaces/http/middlewares/cors.middleware");
const cookie = require("cookie-parser");

const productRoutes = require("./interfaces/http/routes/product-routes");
const pedidoRoutes = require("./interfaces/http/routes/pedido-routes");
const CupomRoutes = require("./interfaces/http/routes/CupomRoutes");
const TaxaRoutes = require("./interfaces/http/routes/taxaRoutes");
const VeiculoRoutes = require("./interfaces/http/routes/motoboy-routes");
const connectToDatabase = require("./infra/database/mongodb/mongodb-connection");

/**

 * =========================
 * METRICS (Prometheus)
 * =========================
 */

// Coleta métricas padrão (CPU, memória, etc)
client.collectDefaultMetrics();

// Histograma de tempo de resposta
const httpRequestDurationMicroseconds = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Duração das requisições HTTP em ms",
  labelNames: ["method", "route", "code"],
});

/**
>>>>>>> 04c4a5a (versao 2k)
 * Instância principal da aplicação Express.
 * @type {import("express").Express}
 */
const app = express();

/**
 * =========================
 * Middlewares globais
 * =========================
 */

/**
 * Middleware responsável por interpretar requisições JSON.
 */
app.use(bodyParser.json());

/**
 * Middleware responsável por permitir requisições CORS.
 */
app.use(corsMiddleware());

app.use(cookie());

// 🔥 LOGS AUTOMÁTICOS (pino)
app.use(pinoHttp());

// 🔥 MÉTRICAS DE PERFORMANCE
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;

    httpRequestDurationMicroseconds
      .labels(req.method, req.route?.path || req.url, res.statusCode)
      .observe(duration);
  });

  next();
});

/**
 * =========================
 * ROTAS ESPECIAIS (OBSERVABILIDADE)
 * =========================
 */

// ✅ Healthcheck
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

// ✅ Métricas Prometheus
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

/**
 * =========================
 * Registro de rotas
 * =========================
 */

/**
 * Rotas relacionadas a produtos.
 * @route /products
 */
app.use("/products", productRoutes);

/**
 * Rotas relacionadas a pedidos.
 * @route /pedidos
 */
app.use("/pedidos", pedidoRoutes);

/**
 * Rotas relacionadas a pedidos.
 * @route /Cupom
 */
app.use("/cupom", CupomRoutes);

/**
 * Rotas relacionadas a pedidos.
 * @route /taxa
 */
app.use("/taxas", TaxaRoutes);

/**
 * Rotas relacionadas a pedidos.
 * @route /veiculos
 */
app.use("/veiculos", VeiculoRoutes);

/**
 * =========================
 * Inicialização do servidor
 * =========================
 */

/**
 * Porta em que o servidor será executado.
 * @type {number}
 */
const PORT = Number(process.env.PORT) || 5001;

/**
 * Inicializa a conexão com o banco de dados.
 */
connectToDatabase();

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * Inicia o servidor HTTP.
 */

// 🔌 1. Criar o servidor HTTP acoplado ao Express (Necessário para o Socket.io)
const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);

// 🔌 2. Inicializar o Socket.io permitindo conexões externas do Agente Local
// 🔌 2. Inicializar o Socket.io permitindo conexões externas do Agente Local
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Referência global do socket conectado
let socketLojaAtivo = null;

io.on("connection", (socket) => {
  // 🔥 CORREÇÃO: Vincula a impressora IMEDIATAMENTE na conexão, sem precisar do "registrar-loja"
  socketLojaAtivo = socket;
  console.log(
    `🏪 [SOCKET] Impressora local conectada e PRONTA! ID: ${socket.id}`,
  );

  socket.on("disconnect", () => {
    if (socketLojaAtivo && socketLojaAtivo.id === socket.id) {
      socketLojaAtivo = null;
      console.log(
        `🛑 [SOCKET] Agente de impressão local desconectou. ID: ${socket.id}`,
      );
    }
  });
});

// 🔌 3. Disponibilizar o socketLojaAtivo globalmente no Express
app.set("io", io);
app.set("getSocketLoja", () => socketLojaAtivo);

/**
 * Inicia o servidor HTTP (Alterado de app.listen para server.listen)
 */
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
