class CustomerProfileRepository {
  async criar(profile) {
    throw new Error("Método 'criar' não implementado");
  }

  async buscarPorId(id) {
    throw new Error("Método 'buscarPorId' não implementado");
  }

  async buscarPorUserId(userId) {
    throw new Error("Método 'buscarPorUserId' não implementado");
  }

  async atualizar(id, dados) {
    throw new Error("Método 'atualizar' não implementado");
  }

  async deletar(id) {
    throw new Error("Método 'deletar' não implementado");
  }
}

module.exports = CustomerProfileRepository;