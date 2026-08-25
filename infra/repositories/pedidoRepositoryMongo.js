const mongoose = require("mongoose");
const PedidoRepository = require("../../domain/entities/pedidoRepository");
const { required } = require("joi");

const consentimentoSchema = new mongoose.Schema({
  // Removido a chave "consentimento: {" que envolvia tudo
  aceitou: { type: Boolean, required: true },
  dataHoraAceite: { type: String, required: true },
  userAgent: { type: String, required: true },
  versaoTermos: { type: String, required: true },
  conteudoTermos: { type: String, required: true },
  conteudoPrivacidade: { type: String, required: true },
  ipCliente: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const itemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  size: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  extras: [{ type: String }],
  notes: String,
});

const pedidoSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      index: true,
      unique: true,
    },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: false,
      index: true,
    },
    cliente: {
      nome: { type: String, required: true },
      telefone: { type: String, required: false, index: true },
      endereco: String,
      email: String,
    },

    itens: [itemSchema],
    consentimento: [consentimentoSchema],

    pagamento: {
      metodo: {
        type: String,
        // Traduzido para os métodos que seu front-end envia (Ex: "DINHEIRO", "CARTAO_CREDITO")
        enum: ["PIX", "CARTAO_CREDITO", "CARTAO_DEBITO", "DINHEIRO", "BALCÃO"],
        required: true,
      },
      total: { type: Number, required: true },
      status: {
        type: String,
        // Traduzido para o padrão em português. O default agora passa a ser "PENDENTE"
        enum: ["PENDENTE", "PAGO", "FALHOU", "REEMBOLSADO"],
        default: "PENDENTE",
      },
      trocoPara: Number,
      transactionId: String,
    },

    cupom: {
      type: String,
      required: false,
      default: null,
    }, // 🌟 Adicionado
    descontoCupom: {
      type: Number,
      required: false,
      default: 0,
    }, // 🌟 Adicionado

    entrega: {
      tipo: {
        type: String,
        // Traduzido: DELIVERY -> ENTREGA, PICKUP -> RETIRADA, DINE_IN -> CONSUMO_LOCAL (ou NO_LOCAL)
        enum: ["DELIVERY", "RETIRADA", "CONSUMO_LOCAL", "PICKUP"],
        required: true,
      },
      endereco: String,
      mesa: { type: Number, index: true }, // 🔥 MUDANÇA: Indexar mesa ajuda na busca rápida
      taxaEntrega: Number,
      tempoEstimado: Date,
      // 🛵 ADICIONADO: Campo opcional para salvar qual entregador aceitou a corrida
      entregadorId: { type: String, required: false, index: true },
    },

    status: {
      type: String,
      enum: [
        "CREATED",
        "CONFIRMED",
        "PREPARING",
        "READY",
        "CONCLUDED", // 🔥 DICA: Adicione 'CONCLUDED' para pedidos finalizados
        "ON_THE_WAY",
        "DELIVERED",
        "CANCELED",
      ],
      default: "CREATED",
      index: true,
    },

    rastreamento: [
      {
        status: String,
        data: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true, // createdAt + updatedAt automático
  },
);

// Índices importantes (escala)
pedidoSchema.index({ "cliente.telefone": 1 });
pedidoSchema.index({ status: 1 });
pedidoSchema.index({ createdAt: -1 });

const PedidoModel =
  mongoose.models.Pedido || mongoose.model("Pedido", pedidoSchema);

class PedidoRepositoryMongo extends PedidoRepository {
  async criar(pedidoData) {
    return await PedidoModel.create(pedidoData);
  }

  async buscarPorId(id) {
    let pedido;
    // Tenta primeiro pelo _id do Mongo (se for um ID válido de 24 caracteres)
    if (mongoose.Types.ObjectId.isValid(id)) {
      pedido = await PedidoModel.findById(id);
    }
    // Se não achou, tenta pelo seu campo 'id' customizado (PED-...)
    if (!pedido) {
      pedido = await PedidoModel.findOne({ id: id });
    }

    if (!pedido) throw new Error("Pedido não encontrado");
    return pedido;
  }

  async buscarPorTelefone(telefone) {
    return await PedidoModel.find({ "cliente.telefone": telefone });
  }

  async listar() {
    return await PedidoModel.find().sort({ createdAt: -1 });
  }

  async listarPorStatus(status) {
    return await PedidoModel.find({ status });
  }

  async atualizar(id, dados) {
    const pedido = await PedidoModel.findByIdAndUpdate(id, dados, {
      new: true,
    });

    if (!pedido) throw new Error("Pedido não encontrado");
    return pedido;
  }

  async atualizarStatus(id, status, entregadorId = null) {
    const updateData = {
      status,
      $push: {
        rastreamento: { status },
      },
    };

    // Se o entregador aceitou o pedido, gravamos o ID dele no subdocumento de entrega
    if (entregadorId) {
      updateData["entrega.entregadorId"] = entregadorId;
    }

    // Tenta buscar pelo campo 'id' customizado (Ex: PED-123) ou pelo _id do Mongo
    let pedido = await PedidoModel.findOneAndUpdate({ id: id }, updateData, {
      new: true,
    });

    if (!pedido && mongoose.Types.ObjectId.isValid(id)) {
      pedido = await PedidoModel.findByIdAndUpdate(id, updateData, {
        new: true,
      });
    }

    if (!pedido) throw new Error("Pedido não encontrado");
    return pedido;
  }

  // Adicione este método dentro da classe PedidoRepositoryMongo
  async listarPendentes() {
    return await PedidoModel.find({ status: "CREATED" }).sort({ createdAt: 1 });
  }

  async deletar(id) {
    const pedido = await PedidoModel.findByIdAndDelete(id);
    if (!pedido) throw new Error("Pedido não encontrado");
    return pedido;
  }
}

module.exports = PedidoRepositoryMongo;
