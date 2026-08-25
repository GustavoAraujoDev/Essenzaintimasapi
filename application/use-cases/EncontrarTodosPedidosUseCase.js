class EncontrarTodosPedidosUseCase {
  constructor(pedidoRepo){
    this.pedidoRepo = pedidoRepo;
  }
  async executar() {
    try {
      const pedidos = await this.pedidoRepo.listar();
      return pedidos;
    } catch (err) {
      throw new Error('Erro ao encontrar pedido: ' + err.message);
    }
  }
}

module.exports = EncontrarTodosPedidosUseCase;
