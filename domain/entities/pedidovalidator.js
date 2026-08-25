class PedidoValidator {
  validarParaImpressao(pedido) {
    if (!pedido) {
      throw new Error("Pedido inválido");
    }

    // 📦 Deve ter itens
    if (!pedido.itens || pedido.itens.length === 0) {
      throw new Error("Pedido sem itens não pode ser impresso");
    }

    // 💰 Pagamento obrigatório
    if (!pedido.pagamento || !pedido.pagamento.total) {
      throw new Error("Pedido sem pagamento válido");
    }

    // 🚫 Status inválido
    const statusPermitidos = ["PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"];

    if (!statusPermitidos.includes(pedido.status)) {
      throw new Error(`Pedido com status ${pedido.status} não pode ser impresso`);
    }

    // 🔍 Validação de itens
    pedido.itens.forEach((item) => {
      if (!item.name || !item.quantity || !item.unitPrice) {
        throw new Error("Item inválido no pedido");
      }
    });
  }
}

module.exports = PedidoValidator;