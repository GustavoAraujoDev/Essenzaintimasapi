class AddressRepository {
  async criar(address) {
    throw new Error("Método 'criar' não implementado");
  }

  async buscarPorId(id) {
    throw new Error("Método 'buscarPorId' não implementado");
  }

  async listarPorUser(userId) {
    throw new Error("Método 'listarPorUser' não implementado");
  }

  async atualizar(id, dados) {
    throw new Error("Método 'atualizar' não implementado");
  }

  async definirComoPadrao(userId, addressId) {
    throw new Error("Método 'definirComoPadrao' não implementado");
  }

  async deletar(id) {
    throw new Error("Método 'deletar' não implementado");
  }
}

module.exports = AddressRepository;