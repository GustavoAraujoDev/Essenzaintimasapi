const joi = require("joi");

// 🛠 Auxiliar para itens dos modificadores (com status conforme o Schema)
const modifierItemSchema = joi.object({
  _id: joi.string().optional(), // Opcional no update/create
  id: joi.string().optional(),
  name: joi.string().required(),
  price: joi.number().min(0).required(),
  status: joi.string().valid("ACTIVE", "INACTIVE").default("ACTIVE"),
});

// 🛠 Auxiliar para grupos de modificadores
const modifierGroupSchema = joi.object({
  _id: joi.string().optional(),
  name: joi.string().required(),
  required: joi.boolean().required(),
  min: joi.number().min(0).required(),
  max: joi.number().min(1).required(),
  items: joi.array().items(modifierItemSchema).min(1).required(),
});

// 🛠 Auxiliar para SKUs (com attributes Map e timestamps automáticos no Mongo)
const skuSchema = joi.object({
  _id: joi.string().optional(),
  name: joi.string().required(),
  price: joi.number().min(0).required(),
  stock: joi.number().integer().min(0).default(0),
  attributes: joi.object().pattern(joi.string(), joi.string()).default({}),
  // pattern garante que a Chave e Valor do Map sejam Strings
});

// 🛠 Auxiliar para Disponibilidade
const availabilitySchema = joi.object({
  days: joi
    .array()
    .items(joi.string().valid("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"))
    .unique(),
  start: joi
    .string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .message("Formato de hora deve ser HH:mm"),
  end: joi
    .string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .message("Formato de hora deve ser HH:mm"),
});

const ProductValidator = {
  // 🚀 CREATE: Segue rigorosamente os campos 'required: true' do ProductSchema
  Create: joi.object({
    id: joi.string().optional().allow(null, ""),
    companyId: joi.string().optional().allow(null, ""),
    name: joi.string().min(3).required(),
    description: joi.string().required(),
    basePrice: joi.number().min(0).required(),
    categoryId: joi.string().required(),

    images: joi.array().items(joi.string().uri()).default([]),
    status: joi.string().valid("ACTIVE", "INACTIVE").default("ACTIVE"),
    attribute_keys: joi.array().items(joi.string()).default([]),

    skus: joi.array().items(skuSchema).min(1).required(),
    modifiers: joi.array().items(modifierGroupSchema).default([]),
    availability: availabilitySchema.optional(),
  }),

  // 🚀 UPDATE: Todos os campos opcionais, mas validando o formato se enviados
  Update: joi
    .object({
      // id e companyId geralmente NÃO são alteráveis, mas definimos como opcionais
      // caso o seu UseCase precise referenciá-los.
      name: joi.string().min(3),
      description: joi.string(),
      basePrice: joi.number().min(0),
      categoryId: joi.string(),
      images: joi.array().items(joi.string().uri()),
      status: joi.string().valid("ACTIVE", "INACTIVE"),
      attribute_keys: joi.array().items(joi.string()),

      skus: joi.array().items(skuSchema),
      modifiers: joi.array().items(modifierGroupSchema),
      availability: availabilitySchema,
    })
    .min(1), // Garante que pelo menos um campo seja enviado para atualizar
};

module.exports = ProductValidator;
