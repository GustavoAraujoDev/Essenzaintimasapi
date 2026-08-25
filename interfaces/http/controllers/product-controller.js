const CreateProduct = require("../../../application/use-cases/create-product");
const GetProducts = require("../../../application/use-cases/get-products");
const findById = require("../../../application/use-cases/get-product-by-id");
const DeleteProducts = require("../../../application/use-cases/delete-product");
const UpdateProductUseCase = require("../../../application/use-cases/update-product");
const LoginUserUseCase = require("../../../application/use-cases/auth/LoginUserUseCase");
const RegisterUserUseCase = require("../../../application/use-cases/RegisterUserUseCase");
const ListUsersUseCase = require("../../../application/use-cases/ListUsersUseCase");
const SellProduct = require("../../../application/use-cases/SellProduct");
const StockAddProduct = require("../../../application/use-cases/StockAddProduct");
const {
  ProductRepositoryMongo,
  ProductModel,
} = require("../../../infra/repositories/productRepositoryMongo");
const AuditRepositoryMongo = require("../../../infra/repositories/AuditRepositoryMongo");
const {
  UserRepositoryMongo,
} = require("../../../infra/repositories/UserRepositoryMongo");
const CompanyRepositoryMongo = require("../../../infra/repositories/CompanyRepositoryMongo");
const MembershipRepositoryMongo = require("../../../infra/repositories/MembershipRepositoryMongo");
const CustomerRepositoryMongo = require("../../../infra/repositories/CustomerProfileRepositoryMongo");
const JwtService = require("../auth/JwtService");
const repoCustomer = new CustomerRepositoryMongo();
const repoUser = new UserRepositoryMongo();
const repoProd = new ProductRepositoryMongo();
const BcryptPasswordService = require("../security/BcryptPasswordService");
const UserBlocked = require("../../../domain/events/UserBlocked");
const UserLoggedIn = require("../../../domain/events/UserLoggedIn");
const { eventDispatcher } = require("../../../bootstrap/container");
const ListAuditLogs = require("../../../application/use-cases/ListAuditLogs");
const Product = require("../../../domain/entities/product"); // Sua classe de domínio
// Importe o repositório de Membership no topo do arquivo
const repoMembership = new MembershipRepositoryMongo();

class ProductController {
  async toggleStoreProducts(req, res) {
    try {
      const { id, status } = req.body; // id do usuário
      const targetStatus = status === "ACTIVE" ? "ACTIVE" : "INACTIVE";

      // 1. Buscar o Membership (é aqui que vamos salvar o estado da loja)
      const membership = await repoMembership.buscarPorId(id);
      if (!membership) {
        return res
          .status(404)
          .json({ message: "Loja não encontrada para este usuário." });
      }

      // 2. ATUALIZAR STATUS DA LOJA (No Membership, não no User!)
      // Isso garante que o login (User) continue funcionando
      await repoMembership.atualizar(membership._id, { status: targetStatus });

      // 3. ATUALIZAR PRODUTOS EM MASSA
      const result = await ProductModel.updateMany(
        { companyId: membership.companyId },
        { $set: { status: targetStatus } },
      );

      console.log(
        `[LOJA] ${targetStatus}: ${result.modifiedCount} produtos alterados.`,
      );

      return res.status(200).json({
        message: targetStatus === "ACTIVE" ? "Loja Aberta!" : "Loja Fechada!",
        status: targetStatus,
      });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erro ao processar status da loja" });
    }
  }

  async toggleStatus(req, res) {
    try {
      const { id } = req.body;
      const { status } = req.body;

      console.log(id);
      console.log(status);

      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return res
          .status(400)
          .json({ message: "Status inválido. Use ACTIVE ou INACTIVE." });
      }

      // 1. Busca os dados no banco
      const productData = await repoProd.findById(id);
      if (!productData) {
        return res.status(404).json({ message: "Produto não encontrado" });
      }

      // 2. Instancia a Entidade de Domínio para usar as regras de negócio
      const productEntity = new Product(productData);

      // 3. Aplica a alteração
      if (status === "ACTIVE") {
        productEntity.activate();
      } else {
        productEntity.deactivate();
      }

      // 4. Salva via repositório
      const updatedProduct = await repoProd.update(productEntity);

      return res.status(200).json(updatedProduct);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async addStock(req, res) {
    console.log("====================================");
    console.log("🔥 [ADD STOCK] ROTA CHAMADA");
    console.log("📅 Data:", new Date().toISOString());
    console.log("📌 Params:", req.params);
    console.log("📦 Body:", req.body);
    console.log("👤 User:", req.user);
    console.log("🌍 IP:", req.ip);
    console.log("🖥 UserAgent:", req.headers["user-agent"]);
    console.log("====================================");

    try {
      const { id } = req.params;
      const { quantity } = req.body;
      const { skuId } = req.body;

      if (!req.user) {
        console.error("❌ req.user está undefined");
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const userId = req.user.id;

      if (!quantity || Number(quantity) <= 0) {
        console.error("❌ Quantidade inválida:", quantity);
        return res.status(422).json({ error: "Quantidade inválida" });
      }

      const context = {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      };

      console.log("🔎 Criando repositórios...");
      const userRepo = new UserRepositoryMongo();
      const repo = new ProductRepositoryMongo();

      if (!eventDispatcher) {
        console.error("❌ eventDispatcher está undefined");
      }

      console.log("🚀 Executando use case SellProduct...");

      const stockAddProduct = new StockAddProduct(
        repo,
        userRepo,
        eventDispatcher,
      );

      const result = await stockAddProduct.execute({
        productId: id,
        quantity: Number(quantity),
        userId,
        context,
        skuId,
      });

      console.log("✅ stock atualizado com sucesso:", result);

      return res.status(200).json(result);
    } catch (error) {
      console.error("====================================");
      console.error("💥 ERRO NO ADD STOCK");
      console.error("Mensagem:", error.message);
      console.error("Stack:", error.stack);
      console.error("====================================");

      return res.status(500).json({
        error: "Erro interno ao realizar venda",
        message: error.message, // ✅ aqui
        stack: error.stack,
      });
    }
  }

  async sell(req, res) {
    console.log("====================================");
    console.log("🔥 [SELL] ROTA CHAMADA");
    console.log("📅 Data:", new Date().toISOString());
    console.log("📌 Params:", req.params);
    console.log("📦 Body:", req.body);
    console.log("👤 User:", req.user);
    console.log("🌍 IP:", req.ip);
    console.log("🖥 UserAgent:", req.headers["user-agent"]);
    console.log("====================================");

    try {
      const { id } = req.params;
      const { quantity } = req.body;
      const { skuId } = req.body;

      if (!req.user) {
        console.error("❌ req.user está undefined");
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const userId = req.user.id;

      if (!quantity || Number(quantity) <= 0) {
        console.error("❌ Quantidade inválida:", quantity);
        return res.status(422).json({ error: "Quantidade inválida" });
      }

      const context = {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      };

      console.log("🔎 Criando repositórios...");
      const userRepo = new UserRepositoryMongo();
      const repo = new ProductRepositoryMongo();

      if (!eventDispatcher) {
        console.error("❌ eventDispatcher está undefined");
      }

      console.log("🚀 Executando use case SellProduct...");

      const sellProduct = new SellProduct(repo, userRepo, eventDispatcher);

      const result = await sellProduct.execute({
        productId: id,
        quantity: Number(quantity),
        userId,
        context,
        skuId,
      });

      console.log("✅ Venda realizada com sucesso:", result);

      return res.status(200).json(result);
    } catch (error) {
      console.error("====================================");
      console.error("💥 ERRO NO SELL");
      console.error("Mensagem:", error.message);
      console.error("Stack:", error.stack);
      console.error("====================================");

      return res.status(500).json({
        error: "Erro interno ao realizar venda",
        message: error.message, // ✅ aqui
        stack: error.stack,
      });
    }
  }

  async getMe(req, res) {
    try {
      console.log(req.user.id);
      // O id vem do middleware de autenticação (ex: req.user.id)
      // Para (forma mais segura):
      const userId = req.user?.id || req.user?.sub;

      // 1. Busca dados da conta (Email, Role, Status)
      const user = await repoUser.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // 2. Busca dados do perfil (Nome, Telefone, Endereço)
      const profile = await repoCustomer.buscarPorUserId(userId);
      // 🎯 AQUI ESTÁ A CORREÇÃO: Coloque a busca do membership dentro de um try/catch isolado
      let membership = null;
      try {
        membership = await repoMembership.buscarPorId(userId);
      } catch (membershipError) {
        // Se não encontrar o membership (caso dos motoboys), o sistema apenas ignora o erro
        // e mantém a variável como null, sem derrubar o servidor com erro 500
        console.log(
          `[INFO] Usuário ${userId} não possui membership. Prosseguindo como autônomo.`,
        );
      }

      // 3. Monta o objeto consolidado para o Frontend
      const userData = {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        // O status do USER é para o login, o status do MEMBERSHIP é para a loja
        storeStatus: membership ? membership.status : "INACTIVE",
        profile: profile
          ? {
              name: profile.name,
              phone: profile.phone,
              document: profile.document,
              address: profile.address,
            }
          : null,
      };

      return res.status(200).json(userData);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Erro interno ao buscar perfil" });
    }
  }

  async Registrer(req, res) {
    try {
      const { email, password, role, companyData, customerData } = req.body;
      const authUserId = req.user?.id;

      // 🔥 NOVA LÓGICA: Só barra o 401 se NÃO for CUSTOMER e não tiver token
      if (role !== "CUSTOMER" && !authUserId) {
        return res.status(401).json({
          error: "Não autenticado: Apenas clientes podem se auto-registrar.",
        });
      }

      const context = {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        mfaValidated: true,
        sessionAgeMinutes: 2,
      };

      // 🔥 Dependências (ideal depois mover para DI container)
      const userRepo = new UserRepositoryMongo();
      const passwordService = new BcryptPasswordService();
      const companyRepository = new CompanyRepositoryMongo();
      const membershipRepository = new MembershipRepositoryMongo();
      const customerRepository = new CustomerRepositoryMongo();

      const registerUserUseCase = new RegisterUserUseCase(
        userRepo,
        passwordService,
        companyRepository,
        membershipRepository,
        customerRepository,
      );

      const result = await registerUserUseCase.execute({
        authUserId,
        context,
        email,
        password,
        role,
        companyData,
        customerData,
      });

      return res.status(201).json({
        message: "Usuário criado com sucesso",
        user: result,
      });
    } catch (error) {
      console.error("[REGISTER_CONTROLLER_ERROR]", error.message);

      const message = error.message || "Erro interno";

      // 🔥 Mapeamento simples de erros (compatível com UseCase)
      if (message.includes("Não autenticado")) {
        return res.status(401).json({ error: message });
      }

      if (message.includes("Acesso negado")) {
        return res.status(403).json({ error: message });
      }

      if (message.includes("já existe")) {
        return res.status(409).json({ error: message });
      }

      if (message.includes("Email e senha")) {
        return res.status(422).json({ error: message });
      }

      if (message.includes("Role inválida")) {
        return res.status(422).json({ error: message });
      }

      return res.status(500).json({
        error: "Erro interno ao criar usuário",
      });
    }
  }

  async login(req, res) {
    console.log("[LOGIN_CONTROLLER] Request recebida");
    console.log("[LOGIN] JWT_SECRET:", process.env.JWT_SECRET);
    try {
      const { email, password } = req.body;
      console.log("[LOGIN_CONTROLLER] Email recebido:", email);

      if (!email || !password) {
        return res.status(422).json({
          error: "Email e senha são obrigatórios",
        });
      }

      const context = {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        deviceTrusted: true, // vindo de um DeviceService
        mfaValidated: true, // ou true se validado
        sessionAgeMinutes: 0,
        time: {
          isBusinessHours: () => true,
        },
      };

      const userRepo = new UserRepositoryMongo();
      const passwordService = new BcryptPasswordService();
      const jwtService = new JwtService();
      const membershipRepository = new MembershipRepositoryMongo();

      const loginUser = new LoginUserUseCase(
        userRepo,
        membershipRepository,
        passwordService,
        jwtService,
        eventDispatcher,
      );

      const auth = await loginUser.execute({ email, password, context });

      // --- CONFIGURAÇÃO DO COOKIE SEGURO ---
      res.cookie("accessToken", auth.accessToken, {
        httpOnly: true, // ✅ Impede que o JavaScript (XSS) acesse o token
        secure: true, // ✅ Apenas via HTTPS em produção
        sameSite: "none", // ✅ Protege contra ataques CSRF
        maxAge: 7 * 24 * 60 * 60 * 1000, // ✅ Expira em 7 dias (ajuste conforme seu JWT)
        path: "/", // 🔥 ADICIONADO: Garante que o cookie fique visível em TODAS as rotas do sistema
      });

      console.log("[LOGIN_CONTROLLER] Login OK");
      // para garantir que o frontend não tente salvá-lo no localStorage por hábito.
      return res.status(200).json({
        user: auth.user,
        profile: auth.profile,
      });
    } catch (error) {
      console.error("[LOGIN_CONTROLLER_ERROR]", error);

      if (error.message?.includes("Credenciais")) {
        return res.status(401).json({
          error: "Email ou senha inválidos",
        });
      }

      return res.status(500).json({
        error: "Erro interno ao realizar login",
        message: error.message, // ✅ aqui
        stack: error.stack, // opcional, só pra debug
      });
    }
  }

  async logout(req, res) {
    try {
      res.clearCookie("accessToken", {
        httpOnly: true,
        secure: true, // Deixe false para testar em localhost (HTTP), mude para true em prod (HTTPS)
        sameSite: "none", // Recomendado para compatibilidade com localhost
        path: "/",
      });

      return res.status(200).json({ message: "Logout realizado com sucesso" });
    } catch (error) {
      console.error("Erro no logout:", error);
      return res.status(500).json({ error: "Erro ao deslogar" });
    }
  }

  async create(req, res) {
    console.log("[ProductController.create] Requisição recebida:", {
      body: req.body,
      user: req.user,
      time: new Date().toISOString(),
    });

    try {
      const userRepo = new UserRepositoryMongo();
      const repo = new ProductRepositoryMongo();
      const createProduct = new CreateProduct(repo, userRepo, eventDispatcher);

      if (!req.body || Object.keys(req.body).length === 0) {
        console.warn("[ProductController.create] req.body está vazio!");
        return res
          .status(400)
          .json({ error: "O corpo da requisição está vazio" });
      }

      // 🔐 CONTEXTO DE SEGURANÇA (multi-tenant)
      const context = {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        deviceTrusted: true,
        mfaValidated: false,
        sessionAgeMinutes: 0,
        time: {
          isBusinessHours: true,
        },
      };

      console.log("[AUTH REQ USER]", req.user);

      // 🚀 EXECUÇÃO COM companyId (ESSENCIAL)
      const product = await createProduct.execute({
        productData: req.body,
        userId: req.user.id,
        companyId: req.user.companyId, // 🔥 AQUI ESTÁ O FIX
        context,
      });

      console.log("[ProductController.create] Produto criado com sucesso:", {
        productId: product._id,
        name: product.name,
        companyId: req.user.companyId,
        time: new Date().toISOString(),
      });

      return res.status(201).json(product);
    } catch (error) {
      console.error("[ProductController.create] Erro ao criar produto:", {
        message: error.message,
        stack: error.stack,
        time: new Date().toISOString(),
      });

      return res.status(400).json({ error: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const repo = new ProductRepositoryMongo();
      const getProducts = new GetProducts(repo);
      const products = await getProducts.execute();
      return res.status(200).json(products);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async findById(req, res) {
    const { id } = req.params;
    try {
      const repo = new ProductRepositoryMongo();
      const findByIdproduct = new findById(repo);
      const products = await findByIdproduct.execute(id);
      return res.status(200).json(products);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async delete(req, res) {
    const { id } = req.params;
    const userId = req.user?.id; // vindo do JWT middleware

    try {
      const productRepo = new ProductRepositoryMongo();
      const userRepo = new UserRepositoryMongo();

      const deleteProduct = new DeleteProducts(
        productRepo,
        userRepo,
        eventDispatcher,
      );
      const context = {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      };
      const result = await deleteProduct.execute({
        id,
        userId,
        context,
      });

      return res.status(200).json(result);
    } catch (error) {
      // 🔐 Autorização
      if (
        error.message.includes("ADMIN") ||
        error.message.includes("Usuário inativo")
      ) {
        return res.status(403).json({ error: error.message });
      }

      // 🔎 Não encontrado
      if (error.message.includes("não encontrado")) {
        return res.status(404).json({ error: error.message });
      }

      // 📌 Regra de negócio
      if (
        error.message.includes("estoque") ||
        error.message.includes("ativo")
      ) {
        return res.status(400).json({ error: error.message });
      }

      console.error(error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Em um sistema real, o user é injetado pelo middleware de autenticação (JWT)
      const user = req.user;

      const repo = new ProductRepositoryMongo();
      const updateUseCase = new UpdateProductUseCase(repo);

      const updatedProduct = await updateUseCase.execute({
        user,
        productId: id,
        updateData,
      });

      return res.status(200).json({
        success: true,
        message: "Produto atualizado com sucesso",
        data: updatedProduct,
      });
    } catch (error) {
      // Tratamento de erros baseado no tipo ou mensagem
      return res.status(400).json({ error: error.message });
    }
  }

  async listAudit(req, res) {
    try {
      const userRepo = new UserRepositoryMongo();
      const AuditRepository = new AuditRepositoryMongo();
      const listAuditLogsUseCase = new ListAuditLogs(AuditRepository, userRepo);
      const result = await listAuditLogsUseCase.execute({
        userId: req.user.id,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });

      return res.status(200).json(result);
    } catch (error) {
      return res.status(403).json({
        error: error.message,
      });
    }
  }

  /**
   * Listar todos os usuários
   * @param {*} req
   * @param {*} res
   */
  async listAll(req, res) {
    try {
      const userRepo = new UserRepositoryMongo();
      const listUsersUseCase = new ListUsersUseCase(userRepo);
      const users = await listUsersUseCase.execute();
      return res.status(200).json(users);
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      return res.status(500).json({
        error: "Erro interno do servidor",
        message: error.message, // ✅ aqui
        stack: error.stack,
      });
    }
  }
  // Métodos para update, delete e getById seguem o mesmo padrão.
}

module.exports = new ProductController();
