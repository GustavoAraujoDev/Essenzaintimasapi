class PedidoRepository {
  async criar(pedidoData) {
    throw new Error("Método 'criar' não implementado");
  }

  async buscarPorId(id) {
    throw new Error("Método 'buscarPorId' não implementado");
  }

  async buscarPorTelefone(telefone) {
    throw new Error("Método 'buscarPorTelefone' não implementado");
  }

  async listar() {
    throw new Error("Método 'listar' não implementado");
  }

  async listarPorStatus(status) {
    throw new Error("Método 'listarPorStatus' não implementado");
  }

  async atualizar(id, dados) {
    throw new Error("Método 'atualizar' não implementado");
  }

  async atualizarStatus(id, status) {
    throw new Error("Método 'atualizarStatus' não implementado");
  }

  async deletar(id) {
    throw new Error("Método 'deletar' não implementado");
  }

  async cancelar(id) {
    throw new Error("Método 'cancelar' não implementado");
  }
}

module.exports = PedidoRepository;