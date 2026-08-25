const PedidoAtualizadoEvent = require("../../domain/events/PedidoAtualizadoEvent");

class AtualizarStatusPedidoUseCase {
  constructor({ pedidoRepository, pedidoPolicy, eventDispatcher }) {
    this.pedidoRepository = pedidoRepository;
    this.pedidoPolicy = pedidoPolicy;
    this.eventDispatcher = eventDispatcher;
  }

  async executar({ actor, pedidoId, novoStatus, context }) {
    console.log(`\n🚀 [UseCase] Iniciando atualização do pedido: ${pedidoId}`);
    console.log(
      `📥 [Payload] Novo Status: ${novoStatus}, Ator ID: ${actor?.id}`,
    );

    let pedido = null;

    try {
      // 🔎 1. Buscar pedido
      pedido = await this.pedidoRepository.buscarPorId(pedidoId);
      if (!pedido) throw new Error("Pedido não encontrado");

      // 🔐 2. Autorização (Passando o novoStatus para a Policy validar a intenção do ator)
      const podeAtualizar = this.pedidoPolicy.canUpdateStatus(
        actor,
        pedido,
        novoStatus,
        context,
      );

      if (!podeAtualizar) {
        throw new Error("Acesso negado para atualizar status");
      }

      // 🧠 3. Regra de negócio (fluxo de status)
      this._validarTransicao(pedido.status, novoStatus);

      // 🛵 REGRA DE VINCULAÇÃO DO ENTREGADOR:
      let entregadorIdParaSalvar = null;

      // Se a transição for para OUT_FOR_DELIVERY, o entregador que está executando a ação assume o pedido
      if (novoStatus === "OUT_FOR_DELIVERY") {
        entregadorIdParaSalvar = actor?.id;
        if (!entregadorIdParaSalvar) {
          throw new Error(
            "Identificação do entregador é obrigatória para iniciar a entrega.",
          );
        }
      }

      // 💾 4. Atualizar banco (Passando o entregador opcional)
      const pedidoAtualizado = await this.pedidoRepository.atualizarStatus(
        pedidoId,
        novoStatus,
        entregadorIdParaSalvar,
      );

      // 📡 5. Evento
      await this.eventDispatcher.dispatch(
        new PedidoAtualizadoEvent({
          entity: "Pedido",
          entityId: pedidoId,
          userId: actor?.id || "ANONYMOUS",
          newData: { status: novoStatus, entregadorId: entregadorIdParaSalvar },
          previousData: { status: pedido.status },
          status: "SUCCESS",
          context,
        }),
      );

      return pedidoAtualizado;
    } catch (error) {
      console.error(`\n🚨 [ERRO NO USE CASE] 🚨`);
      console.error(`Mensagem: ${error.message}`);
      console.error(`Stack: ${error.stack}`);

      // 🚨 Evento de erro
      try {
        console.log("📡 [Evento] Notificando erro ao sistema de eventos...");
        await this.eventDispatcher.dispatch(
          new PedidoAtualizadoEvent({
            entity: "Pedido",
            entityId: pedidoId || "UNKNOWN",
            userId: actor?.id || "ANONYMOUS",
            newData: { status: novoStatus },
            status: "ERROR",
            context,
            errorMessage: error.message,
          }),
        );
      } catch (eventError) {
        console.error(
          "⚠️ [Falha Crítica] Não foi possível disparar o evento de erro:",
          eventError.message,
        );
      }

      throw error;
    }
  }

  _validarTransicao(atual, novo) {
    const fluxo = {
      CREATED: ["PREPARING", "CANCELED"],
      PREPARING: ["READY", "CANCELED"],
      READY: ["OUT_FOR_DELIVERY", "FINISHED", "CANCELED"],
      OUT_FOR_DELIVERY: ["DELIVERED", "CANCELED"],
      DELIVERED: [],
      FINISHED: [],
      CANCELED: [],
    };

    if (!fluxo[atual]?.includes(novo)) {
      const erroMsg = `Transição de status inválida: de ${atual} para ${novo}`;
      // Log extra para ver o que existe no objeto de fluxo para aquele status
      console.log(
        `🚫 [Debug Transição] Opções válidas para ${atual}:`,
        fluxo[atual] || "Nenhuma",
      );
      throw new Error(erroMsg);
    }
  }
}

module.exports = AtualizarStatusPedidoUseCase;
