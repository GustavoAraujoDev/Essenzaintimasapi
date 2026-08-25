class CompanyRepository {
  async criar(companyData) {
    throw new Error("Método 'criar' não implementado");
  }

  async buscarPorId(id) {
    throw new Error("Método 'buscarPorId' não implementado");
  }

  async buscarPorDocumento(document) {
    throw new Error("Método 'buscarPorDocumento' não implementado");
  }

  async listar() {
    throw new Error("Método 'listar' não implementado");
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
}

module.exports = CompanyRepository;