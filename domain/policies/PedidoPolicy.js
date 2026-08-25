class PedidoPolicy {
  /**
   * Criar pedido
   */
  static canCreate(actor, context) {
    return (
      actor?.status === "ACTIVE" &&
      context?.ip !== "BLOCKED" &&
      context?.rateLimitOk === true
    );
  }

  /**
   * Atualizar status
   */
  static canUpdateStatus(actor, pedido, novoStatus) {
    // 1. O usuário precisa estar ativo e o pedido não pode estar cancelado ou finalizado
    if (
      actor?.status !== "ACTIVE" ||
      pedido.status === "CANCELED" ||
      pedido.status === "FINISHED"
    ) {
      return false;
    }

    // 2. Se for ADMIN ou RESTAURANT, gerenciam o fluxo interno da cozinha e cancelamentos
    if (actor?.role === "ADMIN" || actor?.role === "RESTAURANT") {
      return true;
    }

    // 🎯 3. Regras para o Motoboy (Sua role 'CUSTOMER')
    if (actor?.role === "CUSTOMER") {
      // 3.1 Ele só pode aceitar o pedido se o status atual for READY e ele estiver movendo para OUT_FOR_DELIVERY
      if (pedido.status === "READY" && novoStatus === "OUT_FOR_DELIVERY") {
        return true;
      }

      // 3.2 Ele só pode marcar como DELIVERED se ele for o MESMO entregador que aceitou o pedido antes
      if (pedido.status === "OUT_FOR_DELIVERY" && novoStatus === "DELIVERED") {
        return pedido.entrega?.entregadorId === actor.id;
      }

      // 🌟 3.3 NOVO: O motoboy pode CANCELAR/DESISTIR da corrida se ele for o dono dela atual
      if (pedido.status === "OUT_FOR_DELIVERY" && novoStatus === "CANCELED") {
        return pedido.entrega?.entregadorId === actor.id;
      }
    }

    return false;
  }

  /**
   * Cancelar pedido
   */
  static canCancel(actor, pedido) {
    return (
      actor?.status === "ACTIVE" &&
      pedido.status !== "DELIVERED" &&
      pedido.status !== "CANCELED"
    );
  }

  /**
   * Visualizar pedido
   */
  static canView(actor, pedido) {
    return actor?.role === "ADMIN" || actor?.id === pedido.cliente?.id;
  }
}

module.exports = PedidoPolicy;
