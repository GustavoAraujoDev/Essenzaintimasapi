class CancelarPedidoUseCase {
  constructor(pedidoRepo) {
    this.pedidoRepo = pedidoRepo;
  }
  async executar(pedidoId) {
    try {
      const pedidoCancelado = await this.pedidoRepo.cancelarPedido(pedidoId);
      return pedidoCancelado;
    } catch (err) {
      throw new Error("Erro ao cancelar pedido: " + err.message);
    }
  }
}

module.exports = CancelarPedidoUseCase;
