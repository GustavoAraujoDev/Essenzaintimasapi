const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "Gestão Pro API",
      version: "1.0.0",
      description: `
API REST do sistema Gestão Pro.

Documentação gerada automaticamente via JSDoc.
      `,
      contact: {
        name: "Equipe Gestão Pro",
        email: "suporte@gestaopro.com",
      },
    },

    servers: [
      {
        url: "https://prafoodapi.onrender.com",
        description: "Produção",
      },
      {
        url: "http://localhost:5000",
        description: "Desenvolvimento",
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Product: {
          type: "object",
          required: ["name", "description", "basePrice", "categoryId", "skus"],
          properties: {
            name: { type: "string", example: "Pizza Calabresa" },

            description: {
              type: "string",
              example: "Pizza com calabresa e queijo",
            },

            basePrice: { type: "number", example: 30.0 },

            images: {
              type: "array",
              items: {
                type: "string",
                example: "https://site.com/pizza.png",
              },
            },

            categoryId: { type: "string", example: "pizzas" },

            status: {
              type: "string",
              enum: ["ACTIVE", "INACTIVE"],
              example: "ACTIVE",
            },

            // 🔥 SKUs (variações reais)
            skus: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "price"],
                properties: {
                  id: { type: "string", example: "sku123" },
                  name: { type: "string", example: "Pizza Média" },
                  price: { type: "number", example: 40.0 },
                  stock: { type: "number", example: 10 },
                  attributes: {
                    type: "object",
                    example: {
                      tamanho: "M",
                      borda: "catupiry",
                    },
                  },
                },
              },
            },

            // 🔥 Modifiers (extras)
            modifiers: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "items"],
                properties: {
                  id: { type: "string", example: "mod1" },
                  name: { type: "string", example: "Adicionais" },
                  required: { type: "boolean", example: false },
                  min: { type: "number", example: 0 },
                  max: { type: "number", example: 3 },

                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["name", "price"],
                      properties: {
                        id: { type: "string", example: "item1" },
                        name: { type: "string", example: "Bacon" },
                        price: { type: "number", example: 5.0 },
                      },
                    },
                  },
                },
              },
            },

            // 🔥 Disponibilidade
            availability: {
              type: "object",
              properties: {
                days: {
                  type: "array",
                  items: {
                    type: "string",
                    example: "MON",
                  },
                  example: ["MON", "TUE", "WED"],
                },
                start: { type: "string", example: "18:00" },
                end: { type: "string", example: "23:00" },
              },
            },

            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-04-14T18:00:00Z",
            },

            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2026-04-14T18:10:00Z",
            },
          },
        },

        Pedido: {
          type: "object",
          required: ["cliente", "itens", "pagamento", "entrega"],
          properties: {
            id: {
              type: "string",
              example: "PED-17123456789",
            },

            companyId: {
              type: "string",
              example: "17123456789",
            },

            cliente: {
              type: "object",
              required: ["nome", "telefone"],
              properties: {
                nome: { type: "string", example: "João Silva" },
                telefone: { type: "string", example: "85999999999" },
                endereco: { type: "string", example: "Rua A, 123" },
                email: { type: "string", example: "joao@email.com" },
              },
            },

            itens: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["productId", "name", "quantity", "unitPrice"],
                properties: {
                  productId: { type: "string", example: "PROD-001" },
                  name: { type: "string", example: "X-Burger" },
                  category: { type: "string", example: "Lanches" },
                  quantity: { type: "number", example: 2 },
                  unitPrice: { type: "number", example: 18.9 },
                  totalPrice: { type: "number", example: 37.8 },
                  extras: {
                    type: "array",
                    items: { type: "string" },
                    example: ["Bacon", "Queijo extra"],
                  },
                  notes: { type: "string", example: "Sem cebola" },
                },
              },
            },

            pagamento: {
              type: "object",
              required: ["metodo", "total"],
              properties: {
                metodo: {
                  type: "string",
                  enum: ["PIX", "CREDIT_CARD", "DEBIT_CARD", "CASH"],
                  example: "PIX",
                },
                total: { type: "number", example: 45.5 },
                status: {
                  type: "string",
                  enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
                  example: "PAID",
                },
                trocoPara: { type: "number", example: 50 },
                transactionId: { type: "string", example: "TX123456789" },
              },
            },

            entrega: {
              type: "object",
              required: ["tipo"],
              properties: {
                tipo: {
                  type: "string",
                  enum: ["DELIVERY", "PICKUP", "DINE_IN"],
                  example: "DELIVERY",
                },
                endereco: { type: "string", example: "Rua A, 123" },
                mesa: { type: "number", example: 12 },
                taxaEntrega: { type: "number", example: 5 },
                tempoEstimado: {
                  type: "string",
                  format: "date-time",
                  example: "2026-01-12T21:30:00Z",
                },
              },
            },

            status: {
              type: "string",
              enum: [
                "CREATED",
                "CONFIRMED",
                "PREPARING",
                "READY",
                "ON_THE_WAY",
                "DELIVERED",
                "CANCELED",
              ],
              example: "PREPARING",
            },

            rastreamento: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  status: { type: "string", example: "PREPARING" },
                  data: {
                    type: "string",
                    format: "date-time",
                    example: "2026-01-12T20:00:00Z",
                  },
                },
              },
            },

            createdAt: {
              type: "string",
              format: "date-time",
            },

            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },

        ErrorResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Erro ao processar requisição",
            },
          },
        },
      },
    },
  },

  apis: ["./interfaces/http/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  swaggerSpec,
};
