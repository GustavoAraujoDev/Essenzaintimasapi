const request = require("supertest");
const mongoose = require("mongoose");
const { MongoDBContainer } = require("@testcontainers/mongodb");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");

const app = require("../../app-test");
// Importamos o UserModel para manipulação direta na infra de teste
const { UserModel } = require("../../infra/repositories/UserRepositoryMongo");

describe("Product Routes - E2E (Senior Pattern)", () => {
  let container;
  let authToken;

  const testUser = {
    id: uuidv4(),
    email: "admin-test@clinicintelligent.com.br",
    passwordRaw: "Admin@123",
    role: "ADMIN"
  };

  const validProduct = {
    name: "Relógio Digital Premium",
    description: "Resistente à água e com notificações",
    price: 299.90,
    images: ["relogio.jpg"],
    category: "Acessórios",
    colors: ["Black"],
    tamanhos: ["U"],
    stock: 15,
    status: "active"
  };

  beforeAll(async () => {

    // 🚀 DEFINA A SECRET AQUI PARA O AMBIENTE DE TESTE
    process.env.JWT_SECRET = "4f7961239f82637492104857362910475628193746502938475612";
    
    // 1. Inicializa container isolado
    container = await new MongoDBContainer("mongo:7").start();
    await mongoose.connect(container.getConnectionString(), { directConnection: true });

    // 2. Seed: Criar usuário compatível com a Entidade User
    const passwordHash = await bcrypt.hash(testUser.passwordRaw, 1);
    
    await UserModel.create({
      id: testUser.id,
      email: testUser.email,
      passwordHash: passwordHash,
      role: testUser.role,
      status: 'active',
      loginAttempts: 0, // Necessário para o método registerSuccessfulLogin() não falhar
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 3. Login: Note a correção da rota para /auth/login (padrão de mercado)
    // Se a sua rota for diferente, ajuste aqui.
    const loginRes = await request(app)
      .post("/products/auth/login") 
      .send({
        email: testUser.email,
        password: testUser.passwordRaw
      });

    // Validamos se o login funcionou antes de prosseguir
    if (loginRes.status !== 200) {
      throw new Error(`Falha no login de setup: ${JSON.stringify(loginRes.body)}`);
    }

    // Alinhado com o retorno do seu LoginUserUseCase: { accessToken, refreshToken }
    authToken = loginRes.body.accessToken; 
    
  }, 40000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (container) await container.stop();
  });

  afterEach(async () => {
    // Limpeza seletiva para manter o usuário vivo
    if (mongoose.connection.readyState === 1) {
        await mongoose.connection.collection("products").deleteMany({});
    }
  });

  describe("POST /products", () => {
    it("should create a product when user is authenticated", async () => {
      const { status, body } = await request(app)
        .post("/products")
        .set("Authorization", `Bearer ${authToken}`)
        .send(validProduct);

      expect(status).toBe(201);
      expect(body).toMatchObject({
        name: validProduct.name,
        price: validProduct.price
      });
      expect(body).toHaveProperty("_id");
    });

    it("should return 401 when token is missing", async () => {
      const { status } = await request(app)
        .post("/products")
        .send(validProduct);

      expect(status).toBe(401);
    });
  });

  describe("GET /products", () => {
    it("should list all products currently in database", async () => {
      // Criamos um produto via API
      await request(app)
        .post("/products")
        .set("Authorization", `Bearer ${authToken}`)
        .send(validProduct);

      const { status, body } = await request(app)
        .get("/products")
        .set("Authorization", `Bearer ${authToken}`);

      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });
  });
});
