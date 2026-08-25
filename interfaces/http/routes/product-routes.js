const express = require("express");
const router = express.Router();

const ProductController = require("../controllers/product-controller");
const validateRequest = require("../middlewares/validateRequest");
const ProductValidator = require("../../../application/validators/productValidator");
const AuthMiddleware = require("../auth/AuthMiddleware");
const JwtService = require("../auth/JwtService");
const jwtService = new JwtService();

const TableStatus = require("../../../infra/repositories/TableStatusRepositoryMongo");

/**
 * @swagger
 * tags:
 *   name: Produtos
 *   description: Gestão de produtos
 */

/* =========================
   ROTAS PÚBLICAS (AUTH)
========================= */

/**
 * @swagger
 * /products/auth/login:
 *   post:
 *     summary: Login do usuário
 *     tags: [Produtos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@email.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *       401:
 *         description: Credenciais inválidas
 */
router.post("/auth/login", (req, res) => {
  console.log("🔥 LOGIN REALMENTE FOI CHAMADO");
  return ProductController.login(req, res);
});

/**
 * @swagger
 * /products/auth/registrar:
 *   post:
 *     summary: Registrar usuário no sistema (multi-tenant)
 *     tags: [Auth]
 *     description: |
 *       Cria um usuário e opcionalmente uma empresa (ADMIN/EMPLOYEE) ou perfil de cliente (CUSTOMER).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 example: joao@email.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *               role:
 *                 type: string
 *                 enum: [ADMIN, EMPLOYEE, CUSTOMER]
 *                 example: ADMIN
 *
 *               companyData:
 *                 type: object
 *                 description: Dados da empresa (obrigatório para ADMIN/EMPLOYEE)
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: Minha Empresa LTDA
 *                   document:
 *                     type: string
 *                     example: "12345678000199"
 *                   email:
 *                     type: string
 *                     example: empresa@email.com
 *                   phone:
 *                     type: string
 *                     example: "85999999999"
 *
 *               customerData:
 *                 type: object
 *                 description: Dados do cliente (obrigatório para CUSTOMER)
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: João da Silva
 *                   phone:
 *                     type: string
 *                     example: "85988888888"
 *                   document:
 *                     type: string
 *                     example: "12345678900"
 *
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Usuário criado com sucesso
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     status:
 *                       type: string
 *
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso negado
 *       409:
 *         description: Usuário já existe
 *       422:
 *         description: Erro de validação
 *       500:
 *         description: Erro interno do servidor
 */
router.post(
  "/auth/registrar",
  (req, res, next) => {
    const { role } = req.body;

    // DEBUG: Verifique se o body está chegando.
    // Se imprimir {}, o problema é a falta do express.json() no app.js
    console.log("Body recebido na rota:", req.body);

    if (role === "CUSTOMER") {
      console.log("-> Identificado como CUSTOMER: Pulando autenticação.");
      return next(); // Vai direto para o ProductController.Registrer
    }

    console.log("-> Não é CUSTOMER: Exigindo token via AuthMiddleware.");
    return AuthMiddleware(jwtService)(req, res, next);
  },
  (req, res) => ProductController.Registrer(req, res),
);

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Listar todos os produtos
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de produtos
 */
router.get("/", ProductController.getAll);

/* =========================
   MIDDLEWARE DE AUTENTICAÇÃO
========================= */
router.use(AuthMiddleware(jwtService));

/* =========================
   ROTAS PROTEGIDAS
========================= */

/**
 * @swagger
 * /products/users/me:
 * get:
 * summary: Retorna os dados do usuário logado e seu perfil.
 * description: Busca informações da conta e detalhes do perfil baseados no token JWT.
 * tags: [Users]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Dados do usuário e perfil retornados com sucesso.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * id:
 * type: string
 * email:
 * type: string
 * role:
 * type: string
 * status:
 * type: string
 * profile:
 * type: object
 * properties:
 * name:
 * type: string
 * phone:
 * type: string
 * document:
 * type: string
 * address:
 * type: object
 * properties:
 * street:
 * type: string
 * city:
 * type: string
 * 401:
 * description: Não autorizado.
 * 404:
 * description: Usuário não encontrado.
 */
router.get("/users/me", (req, res) => ProductController.getMe(req, res));

/**
 * @swagger
 * /products/logout:
 * post:
 * summary: Realiza o logout do usuário
 * description: Remove o cookie de autenticação (HttpOnly) do navegador do cliente.
 * tags: [Autenticação]
 * responses:
 * 200:
 * description: Logout realizado com sucesso. O cookie foi removido.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * message:
 * type: string
 * example: Logout realizado com sucesso
 * 500:
 * description: Erro interno no servidor ao processar o logout.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * error:
 * type: string
 * example: Erro ao deslogar
 */
router.post("/logout", (req, res) => ProductController.logout(req, res));

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Criar um novo produto
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Produto criado com sucesso
 */
router.post(
  "/",
  validateRequest(ProductValidator.Create),
  ProductController.create,
);

/**
 * @swagger
 * tags:
 *   name: Usuários
 *   description: Gestão de usuários
 */

/**
 * @swagger
 * /products/users/list:
 *   get:
 *     summary: Listar todos os usuários
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuários
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   email:
 *                     type: string
 *                   role:
 *                     type: string
 *                   status:
 *                     type: string
 *                   loginAttempts:
 *                     type: integer
 *                   lastLoginAt:
 *                     type: string
 *                     format: date-time
 *                   blockedAt:
 *                     type: string
 *                     format: date-time
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/users/list", ProductController.listAll);

/**
 * @swagger
 * /products/audit/logs:
 *   get:
 *     summary: Listar logs de auditoria (ADMIN)
 *     tags: [Auditoria]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         required: false
 *         description: Página da listagem
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 20
 *         required: false
 *         description: Quantidade de registros por página
 *     responses:
 *       200:
 *         description: Logs retornados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       event:
 *                         type: string
 *                         example: ProductDeletedEvent
 *                       entity:
 *                         type: string
 *                         example: Product
 *                       entityId:
 *                         type: string
 *                         example: 65f2a8c9d91c2a0012ab3456
 *                       userId:
 *                         type: string
 *                         example: 65f2a8c9d91c2a0012ab9999
 *                       userEmail:
 *                         type: string
 *                         example: admin@email.com
 *                       status:
 *                         type: string
 *                         example: SUCCESS
 *                       ip:
 *                         type: string
 *                         example: 192.168.0.1
 *                       occurredAt:
 *                         type: string
 *                         example: 2026-02-20T14:30:00.000Z
 *                 total:
 *                   type: integer
 *                   example: 150
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 8
 *       403:
 *         description: Acesso negado (não é ADMIN)
 *       401:
 *         description: Token inválido ou não informado
 */
router.get("/audit/logs", (req, res) => ProductController.listAudit(req, res));

/**
 * @swagger
 * /products/{id}/sell:
 *   post:
 *     summary: Realizar venda de um produto
 *     description: Remove quantidade do estoque do produto (venda)
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do produto
 *         schema:
 *           type: string
 *           example: 64f9b0c2a12e4f8d9c123456
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: Venda realizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Venda realizada com sucesso
 *       400:
 *         description: Erro de validação ou regra de negócio
 *       401:
 *         description: Usuário não autenticado
 *       403:
 *         description: Usuário sem permissão
 */
router.post("/:id/sell", (req, res) => ProductController.sell(req, res));

/**
 * @swagger
 * /products/{id}/addstock:
 *   patch:
 *     summary: Adicionar estoque ao produto
 *     description: Adiciona uma quantidade ao estoque atual do produto e registra evento de auditoria.
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do produto
 *         schema:
 *           type: string
 *           example: "64f1c9d2a8f4b2a1c9e12345"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: number
 *                 example: 10
 *                 description: Quantidade a ser adicionada ao estoque
 *     responses:
 *       200:
 *         description: Estoque atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "64f1c9d2a8f4b2a1c9e12345"
 *                 name:
 *                   type: string
 *                   example: "Produto X"
 *                 stock:
 *                   type: number
 *                   example: 50
 *       401:
 *         description: Usuário não autenticado
 *       422:
 *         description: Quantidade inválida
 *       404:
 *         description: Produto não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.post("/:id/addstock", ProductController.addStock);

/**
 * @swagger
 * /products/userstatus:
 * post:
 * summary: Atualiza o status de um usuário (Ativa, Inativa ou Bloqueia)
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - id
 * - status
 * properties:
 * id:
 * type: string
 * description: ID do usuário
 * example: "12345"
 * status:
 * type: string
 * enum: [ACTIVE, inactive, blocked]
 * example: "ACTIVE"
 * responses:
 * 200:
 * description: Status atualizado com sucesso
 * 400:
 * description: Status inválido ou dados ausentes
 * 404:
 * description: Usuário não encontrado
 * 500:
 * description: Erro interno no servidor
 */
router.post("/storestatus", (req, res) =>
  ProductController.toggleStoreProducts(req, res),
);

/**
 * @swagger
 * /products/status:
 * post:
 * summary: Ativa ou desativa um produto
 * tags: [Products]
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: ID do produto (ex: PROD-123)
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status:
 * type: string
 * enum: [ACTIVE, INACTIVE]
 * example: ACTIVE
 * responses:
 * 200:
 * description: Status atualizado com sucesso
 * 400:
 * description: Status inválido
 * 404:
 * description: Produto não encontrado
 * 500:
 * description: Erro interno no servidor
 */
router.post("/status", (req, res) => ProductController.toggleStatus(req, res));

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Buscar produto por ID
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Produto encontrado
 */
router.get("/:id", ProductController.findById);

/**
 * @swagger
 * /products/{id}:
 * put:
 * summary: Atualizar um produto existente
 * description: Atualiza os dados de um produto. Requer permissão de ADMIN ou EMPLOYEE (dependendo do status do produto).
 * tags: [Produtos]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * description: ID de negócio do produto (ex: PROD-123)
 * schema:
 * type: string
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/ProductUpdate'
 * responses:
 * 200:
 * description: Produto atualizado com sucesso
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status: { type: string, example: "success" }
 * message: { type: string, example: "Produto atualizado com sucesso" }
 * data: { $ref: '#/components/schemas/Product' }
 * 400:
 * description: Erro de validação nos dados enviados
 * 401:
 * description: Usuário não autenticado
 * 403:
 * description: Usuário sem permissão para editar este produto (Policy)
 * 404:
 * description: Produto não encontrado
 */
router.put(
  "/:id",
  validateRequest(ProductValidator.Update),
  ProductController.update,
);

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Deletar produto
 *     tags: [Produtos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Produto deletado
 */
router.delete("/:id", ProductController.delete);

router.post("/tables/sync", async (req, res) => {
  try {
    const { companyId, tables } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: "companyId é obrigatório" });
    }

    // 1. Tenta encontrar um registro existente
    let status = await TableStatus.findOne({ companyId });

    if (!status) {
      // 2. Se não existir, cria um novo
      status = new TableStatus({
        companyId,
        tables,
        updatedAt: new Date(),
      });
    } else {
      // 3. Se existir, atualiza os dados
      status.tables = tables;
      status.updatedAt = new Date();

      // EXTREMAMENTE IMPORTANTE:
      // Como 'tables' é um Map/Objeto dinâmico, o Mongoose precisa desse aviso
      // para entender que o conteúdo interno mudou e precisa ser gravado.
      status.markModified("tables");
    }

    // 4. Salva no banco de dados
    await status.save();

    res.status(200).json({ success: true, data: status });
  } catch (err) {
    console.error("Erro no sync de mesas:", err);
    res.status(500).json({ error: "Erro interno ao salvar estado das mesas." });
  }
});

router.get("/tables/status/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;

    const status = await TableStatus.findOne({ companyId });

    if (!status) {
      return res.status(200).json({ tables: {} });
    }

    // O .toJSON() garante que o Map seja convertido de volta para Objeto para o Frontend
    const data = status.toJSON();
    res.status(200).json({ tables: data.tables || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔥 NOVA ROTA: Registra um pagamento parcial (abatimento) sem fechar a mesa
router.post("/tables/abater-parcial", async (req, res) => {
  // 🔌 4. Recupera o Socket da loja
  const getSocketLoja = req.app.get("getSocketLoja");
  const socketLoja = getSocketLoja ? getSocketLoja() : null;

  try {
    const { companyId, mesaId, valorAbatido, metodoPagamento, userId } =
      req.body;

    // 1. Validações básicas
    if (!companyId || !mesaId || !valorAbatido || valorAbatido <= 0) {
      return res
        .status(400)
        .json({ error: "Dados de abatimento incompletos ou inválidos." });
    }

    // 2. Busca o estado atual das mesas da empresa no banco
    let status = await TableStatus.findOne({ companyId });
    if (!status || !status.tables || !status.tables.has(String(mesaId))) {
      return res
        .status(404)
        .json({ error: "Mesa não encontrada ou sem itens ativos." });
    }

    // Como o Mongoose armazena como Map, usamos o .get()
    let itensMesa = status.tables.get(String(mesaId));

    if (!Array.isArray(itensMesa) || itensMesa.length === 0) {
      return res
        .status(400)
        .json({ error: "A comanda desta mesa está vazia." });
    }

    // 3. Calcula o total acumulado atual da mesa
    const totalAtualMesa = itensMesa.reduce(
      (sum, item) => sum + (Number(item.total) || 0),
      0,
    );

    if (valorAbatido > totalAtualMesa) {
      return res.status(400).json({
        error: `O valor inserido (R$ ${valorAbatido}) é maior do que o saldo devedor da mesa (R$ ${totalAtualMesa}).`,
      });
    }

    // 4. REGRA DE NEGÓCIO: Cria uma linha de CRÉDITO NEGATIVO na comanda
    const itemCredito = {
      productId: `CREDITO-${Date.now()}`,
      name: `PAGTO PARCIAL (${metodoPagamento})`,
      category: "Financeiro",
      sku: "UN",
      qty: 1,
      priceUnit: -parseFloat(valorAbatido),
      total: -parseFloat(valorAbatido), // Negativo para subtrair do subtotal
      details: "",
      obs: `Recebido por admin ID: ${userId || "Local"}`,
    };

    itensMesa.push(itemCredito);

    // 5. Atualiza o Map interno e avisa o Mongoose para salvar
    status.tables.set(String(mesaId), itensMesa);
    status.updatedAt = new Date();
    status.markModified("tables");
    await status.save();

    // 6. ENVIAR PARA O AGENTE ELECTRON EMITIR O RECIBO DO CLIENTE
    // IMPORTANTE: Ajuste a chamada abaixo para usar a sua função/mapa global de sockets do seu server.js
    // Exemplo comum se você exporta o 'io' ou tem um 'getSocketLoja':
    if (typeof getSocketLoja === "function") {
      const socketLoja = getSocketLoja(companyId);
      if (socketLoja) {
        // Envia estruturado para o Electron cair no socket.on("imprimir-parcial")
        socketLoja.emit("imprimir-recibo-abatimento", {
          mesaId: mesaId,
          dadosComanda: {
            companyId,
            userId,
            itens: [
              {
                name: `RECIBO DE ABATIMENTO`,
                quantity: 1,
                unitPrice: parseFloat(valorAbatido),
                total: parseFloat(valorAbatido),
              },
            ],
            pagamento: {
              metodo: metodoPagamento,
              total: parseFloat(valorAbatido),
              status: "PAGO (PARCIAL)",
            },
          },
        });
      }
    }

    // 7. Retorna os dados atualizados para o Front-End
    // O front-end vai atualizar o 'tablesData[selectedTable]' com essa nova lista
    res.status(200).json({
      success: true,
      mensagem: "Abatimento registrado!",
      itensAtualizados: itensMesa,
    });
  } catch (err) {
    console.error("Erro no abatimento parcial da mesa:", err);
    res
      .status(500)
      .json({ error: "Erro interno ao processar abatimento parcial." });
  }
});

module.exports = router;
