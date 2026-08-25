
class DeletePedidoUseCase {
  constructor(pedidoRepo){
    this.pedidoRepo = pedidoRepo;
  }
  async executar(pedidoId) {
    try {
      const pedidoDeletado = await this.pedidoRepo.deletarPedido(pedidoId);
      return pedidoDeletado;
    } catch (err) {
      throw new Error('Erro ao Delete pedido: ' + err.message);
    }
  }
}

module.exports = DeletePedidoUseCase;
