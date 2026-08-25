// Importamos a CLASSE, não a instância, conforme seu module.exports
const { ProductRepositoryMongo } = require("../../infra/repositories/productRepositoryMongo");
const CreateProduct = require("../../application/use-cases/create-product");

describe("CreateProduct Use Case", () => {
  let productRepo;
  let userRepo;
  let eventDispatcher;
  let useCase;

  beforeEach(() => {
    jest.clearAllMocks();

    // Criamos instâncias mockadas das dependências
    productRepo = { create: jest.fn() };
    userRepo = { findById: jest.fn() };
    eventDispatcher = { dispatch: jest.fn() };

    // Injetamos no Use Case pelo constructor
    useCase = new CreateProduct(productRepo, userRepo, eventDispatcher);
  });

  it("should create product successfully", async () => {
    // 1. Mock do Usuário (necessário porque o use case busca o user logo no início)
    userRepo.findById.mockResolvedValue({ id: "user-123", email: "admin@loja.com" });

    // 2. Mock do retorno do Repositório
    const mockCreatedProduct = {
      id: "prod-123",
      name: "Camisa",
      description: "Camisa top",
      price: 100,
      images: ["img.jpg"],
      category: "Roupas",
      colors: ["Preto"],
      tamanhos: ["M"],
      stock: 10,
      status: "active"
    };
    productRepo.create.mockResolvedValue(mockCreatedProduct);

    // 3. Execução enviando TODOS os campos que a Entidade Product exige
    const result = await useCase.execute({
      userId: "user-123",
      productData: {
        name: "Camisa",
        description: "Camisa top",
        price: 100,
        images: ["img.jpg"],
        category: "Roupas",
        colors: ["Preto"],
        tamanhos: ["M"],
        stock: 10,
        status: "active"
      }
    });

    // Asserts
    expect(result.id).toBe("prod-123");
    expect(productRepo.create).toHaveBeenCalled();
    expect(eventDispatcher.dispatch).toHaveBeenCalled(); // Garante que a auditoria rodou
  });
});
