const express = require("express");
const PedidoController = require("../controllers/pedido-controller");

const router = express.Router();
const AuthMiddleware = require("../auth/AuthMiddleware");
const JwtService = require("../auth/JwtService");
const jwtService = new JwtService();
const EpsonPrinterService = require("../../../infra/printer/EpsonPrinterService"); // Ajuste o caminho conforme seu projeto
const printerservice = new EpsonPrinterService();

// 🚀 O SEGREDO: Vincula a instância viva das rotas direto na estrutura do Controller.
// Assim, quando o /connect guardar o IP aqui dentro, o Controller terá acesso imediato!
PedidoController.printerService = printerservice;

/**
 * @route   GET /api/printers/discover
 * @desc    Varre a rede local à procura de impressoras térmicas ativas
 * @access  Public
 */
router.get("/discover", async (req, res) => {
  try {
    console.log("[API_PRINTER] Requisição de varredura recebida.");
    const printers = await printerservice.discoverPrinters();

    // Retorna a lista de impressoras encontradas (mesmo que vazia)
    return res.status(200).json(printers);
  } catch (error) {
    console.error("[API_PRINTER_ERROR] Falha ao listar impressoras:", error);
    return res.status(500).json({
      success: false,
      error: "Erro interno ao escanear a rede local.",
    });
  }
});

/**
 * @route   POST /api/printers/connect
 * @desc    Define qual IP de impressora o backend deve usar dinamicamente
 * @access  Public
 */
router.post("/connect", (req, res) => {
  const { ip, port } = req.body;

  // Validação simples para garantir que o IP foi enviado
  if (!ip) {
    return res.status(400).json({
      success: false,
      error: 'O parâmetro "ip" é obrigatório no corpo da requisição.',
    });
  }

  // Usa a porta enviada ou assume o padrão 9100 caso omitida
  const printerPort = port ? parseInt(port, 10) : 9100;

  const connectionResult = printerservice.connectToPrinter(ip, printerPort);

  if (connectionResult.success) {
    return res.status(200).json(connectionResult);
  } else {
    return res.status(500).json(connectionResult);
  }
});

/**
 * @route   POST /api/printers/test-print
 * @desc    Dispara um comando de impressão de teste na impressora atualmente conectada
 * @access  Public
 */
router.post("/test-print", async (req, res) => {
  try {
    const testResult = await printerservice.testPrint();

    if (testResult.success) {
      return res.status(200).json(testResult);
    } else {
      // Caso não esteja conectada ou dê erro físico, retorna Bad Request ou Server Error
      return res.status(400).json(testResult);
    }
  } catch (error) {
    console.error("[API_PRINTER_ERROR] Erro na rota de teste:", error);
    return res.status(500).json({
      success: false,
      error: "Não foi possível processar o teste de impressão.",
    });
  }
});

/**
 * @swagger
 * tags:
 *   name: Pedidos
 *   description: Gestão de pedidos
 */

/**
 * @swagger
 * /pedidos:
 *   post:
 *     summary: Criar um novo pedido
 *     tags: [Pedidos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Pedido'
 *     responses:
 *       201:
 *         description: Pedido criado com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post("/", PedidoController.criar);

/**
 * @swagger
 * /pedidos/pendentes:
 * get:
 * summary: Listar apenas pedidos com status CREATED
 * tags: [Pedidos]
 */
router.get("/pendentes", PedidoController.listarNovosPedidos); // Adicione esta linha

/**
 * @swagger
 * /pedidos/{id}:
 *   get:
 *     summary: Buscar pedido por ID
 *     tags: [Pedidos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pedido encontrado
 *       404:
 *         description: Pedido não encontrado
 */
router.get("/:id", PedidoController.encontrarPedidoPorId);

/**
 * @swagger
 * /pedidos/telefone/{telefone}:
 *   get:
 *     summary: Buscar pedidos por telefone
 *     tags: [Pedidos]
 *     parameters:
 *       - in: path
 *         name: telefone
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de pedidos
 */
router.get("/telefone/:telefone", PedidoController.encontrarPedidosPorTelefone);

/**
 * @swagger
 * /pedidos:
 *   get:
 *     summary: Listar todos os pedidos
 *     tags: [Pedidos]
 *     responses:
 *       200:
 *         description: Lista de pedidos retornada com sucesso
 */
router.get("/", PedidoController.encontrarTodosPedido);

/**
 * @swagger
 * /pedidos/imprimir-parcial:
 * post:
 * summary: Enviar dados da comanda ativa para impressão parcial (conferência)
 * tags: [Pedidos]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required: [mesaId, dadosComanda]
 * properties:
 * mesaId:
 * type: string
 * example: "5"
 * dadosComanda:
 * type: object
 * properties:
 * companyId:
 * type: string
 * example: "ADMIN-LOCAL"
 * itens:
 * type: array
 * items:
 * type: object
 * responses:
 * 200:
 * description: Parcial enviada para a impressora local com sucesso
 * 400:
 * description: Parâmetros obrigatórios ausentes ou inválidos
 * 503:
 * description: Impressora local offline
 * 500:
 * description: Erro interno ao processar comando seguro de impressão parcial
 */
router.post(
  "/imprimir-parcial",
  PedidoController.imprimirParcialMesaController,
);

/* =========================
   MIDDLEWARE DE AUTENTICAÇÃO
========================= */
router.use(AuthMiddleware(jwtService));

/**
 * @swagger
 * /pedidos/{pedidoId}/status:
 *   put:
 *     summary: Atualizar status do pedido
 *     description: Atualiza o status do pedido seguindo regras de fluxo (CREATED → PREPARING → READY → etc)
 *     tags: [Pedidos]
 *     parameters:
 *       - in: path
 *         name: pedidoId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do pedido
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [CREATED, PREPARING, READY, OUT_FOR_DELIVERY, DELIVERED, CANCELLED]
 *                 example: PREPARING
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 *       400:
 *         description: Dados inválidos ou transição inválida
 *       403:
 *         description: Acesso negado
 *       404:
 *         description: Pedido não encontrado
 *       500:
 *         description: Erro interno
 */
router.put("/:pedidoId/status", PedidoController.atualizarStatus);

/**
 * @swagger
 * /pedidos/{pedidoId}/cancelar:
 *   put:
 *     summary: Cancelar pedido
 *     tags: [Pedidos]
 *     parameters:
 *       - in: path
 *         name: pedidoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pedido cancelado com sucesso
 */
router.put("/:pedidoId/cancelar", PedidoController.cancelarPedido);

/**
 * @swagger
 * /pedidos/imprimir:
 *   post:
 *     summary: Enviar pedido para impressão
 *     tags: [Pedidos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pedidoId:
 *                 type: string
 *                 example: "PED-1713123123"
 *     responses:
 *       200:
 *         description: Pedido enviado para impressão com sucesso
 *       400:
 *         description: PedidoId não informado
 *       500:
 *         description: Erro ao imprimir pedido
 */
router.post("/imprimir", PedidoController.imprimirPedidoController);

/**
 * @swagger
 * /pedidos/{pedidoId}:
 *   delete:
 *     summary: Deletar pedido
 *     tags: [Pedidos]
 *     parameters:
 *       - in: path
 *         name: pedidoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pedido removido com sucesso
 */
router.delete("/:pedidoId", PedidoController.DeletarPedido);

module.exports = router;
