const Product = require("../../domain/entities/product");

describe("Product Entity", () => {
  it("should create a valid product entity", () => {
    const data = {
      name: "Camisa Nike",
      description: "Camisa seca rápido",
      price: 120.5,
      images: ["img1.jpg"],
      category: "Roupas",
      colors: ["Preto"],
      tamanhos: ["M"],
      stock: 10,
      status: "active"
    };

    const product = new Product(data);

    expect(product.name).toBe(data.name);
    expect(product.category).toBe("Roupas");
    expect(product.price).toBe(120.5);
  });

  // Ajustado para a mensagem real que o seu código lança
  it("should throw error when name is missing", () => {
    expect(() => {
      new Product({});
    }).toThrow("Nome inválido");
  });

  // Testes adicionais para garantir que as outras validações funcionam
  it("should throw error when description is missing", () => {
    expect(() => {
      new Product({ name: "Camisa" });
    }).toThrow("Descrição inválida");
  });

  it("should throw error when price is invalid", () => {
    expect(() => {
      new Product({ 
        name: "Camisa", 
        description: "Desc", 
        price: -10 // Preço negativo
      });
    }).toThrow("Preço deve ser maior que zero");
  });

  it("should throw error when status is invalid", () => {
    const data = {
      name: "Camisa",
      description: "Desc",
      price: 100,
      category: "Roupas",
      stock: 5,
      status: "invalid_status" // Status não permitido
    };
    expect(() => new Product(data)).toThrow("Status inválido");
  });
});
