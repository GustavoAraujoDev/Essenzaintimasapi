
class EncontrarPedidoPorIdUseCase {
  constructor(pedidoRepo){
    this.pedidoRepo = pedidoRepo;
  }
  async executar(pedidoId) {
    try {
      const pedido = await this.pedidoRepo.buscarPorId(pedidoId);
      return pedido;
    } catch (err) {
      throw new Error('Erro ao encontrar pedido: ' + err.message);
    }
  }
}

module.exports = EncontrarPedidoPorIdUseCase;
