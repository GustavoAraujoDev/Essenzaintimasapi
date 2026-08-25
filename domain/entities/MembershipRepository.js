class MembershipRepository {
  async criar(membership) {
    throw new Error("Método 'criar' não implementado");
  }

  async buscarPorId(id) {
    throw new Error("Método 'buscarPorId' não implementado");
  }

  async buscarPorUserECompany(userId, companyId) {
    throw new Error("Método 'buscarPorUserECompany' não implementado");
  }

  async listarPorUser(userId) {
    throw new Error("Método 'listarPorUser' não implementado");
  }

  async listarPorCompany(companyId) {
    throw new Error("Método 'listarPorCompany' não implementado");
  }

  async atualizar(id, dados) {
    throw new Error("Método 'atualizar' não implementado");
  }

  async deletar(id) {
    throw new Error("Método 'deletar' não implementado");
  }
}

module.exports = MembershipRepository;