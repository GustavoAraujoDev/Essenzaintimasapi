class Pedido {
  constructor({
    id,
    companyId,
    userId,
    cliente,
    itens,
    consentimento,
    cupom,
    descontoCupom,
    pagamento,
    entrega,
    status = "CREATED",
    rastreamento = [],
    criadoEm = new Date(),
    atualizadoEm = new Date(),
  }) {
    this._validar(cliente, itens, pagamento, entrega);

    this.id = id || this._gerarId();
    this.companyId = companyId;
    this.userId = userId || null; // 🔥 userId opcional
    this.cliente = cliente;
    this.itens = itens;
    // No constructor da classe Pedido
    this.consentimento = consentimento || [];
    this.cupom = cupom;
    this.descontoCupom = descontoCupom;
    this.pagamento = this._formatarPagamento(pagamento);
    this.entrega = this._formatarEntrega(entrega);
    this.status = status;
    this.rastreamento = rastreamento;
    this.criadoEm = criadoEm;
    this.atualizadoEm = atualizadoEm;
  }

  _validar(cliente, itens, pagamento, entrega) {
    // 🔥 MUDANÇA: Se for DINE_IN (Mesa), não obriga o telefone
    const isMesa = entrega?.tipo === "DINE_IN";

    if (!cliente?.nome || (!isMesa && !cliente?.telefone)) {
      throw new Error(
        "Cliente inválido: nome e telefone são obrigatórios (exceto mesa)",
      );
    }

    if (!Array.isArray(itens) || itens.length === 0) {
      throw new Error("Pedido sem itens");
    }

    itens.forEach((item) => {
      // Nota: productId é importante para o estoque
      if (!item.productId || !item.name || !item.quantity || !item.unitPrice) {
        throw new Error("Item inválido no pedido");
      }
    });

    if (!pagamento?.metodo || !pagamento?.total) {
      throw new Error("Pagamento inválido");
    }

    if (!entrega?.tipo) {
      throw new Error("Entrega inválida");
    }
  }

  _formatarPagamento(pagamento) {
    return {
      metodo: pagamento.metodo, // PIX, CARD, CASH
      total: pagamento.total,
      status: pagamento.status || "PENDING",
      trocoPara: pagamento.trocoPara || null,
      gateway: pagamento.gateway || null,
      transactionId: pagamento.transactionId || null,
    };
  }

  _formatarEntrega(entrega) {
    if (entrega.tipo === "DELIVERY") {
      return {
        tipo: "DELIVERY",
        endereco: entrega.endereco,
        taxaEntrega: entrega.taxaEntrega || 0,
        tempoEstimado: this._gerarTempoEntrega(),
      };
    }

    if (entrega.tipo === "PICKUP") {
      return {
        tipo: "PICKUP",
        horarioRetirada: entrega.horarioRetirada || null,
      };
    }

    if (entrega.tipo === "DINE_IN") {
      return {
        tipo: "DINE_IN",
        mesa: entrega.mesa, // 🔥 Certifica que o número da mesa está aqui
        taxaEntrega: 0,
      };
    }

    throw new Error("Tipo de entrega inválido");
  }

  _gerarTempoEntrega() {
    const min = 50;
    const max = 120;
    const minutos = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Date(Date.now() + minutos * 60000);
  }

  _gerarId() {
    // Adicionei um sufixo para facilitar a leitura no banco
    return "PED-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  }

  atualizarStatus(novoStatus) {
    this.status = novoStatus;
    this.atualizadoEm = new Date();

    this.rastreamento.push({
      status: novoStatus,
      data: new Date(),
    });
  }
}

module.exports = Pedido;
