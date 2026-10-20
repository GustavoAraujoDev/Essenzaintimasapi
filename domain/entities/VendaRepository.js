
class VendaRepository {
  async criar(vendaData) {
    throw new Error("Método criar() não implementado.");
  }

  async buscarPorId(id, companyId) {
    throw new Error("Método buscarPorId() não implementado.");
  }

  async buscarPorCodigo(id, companyId) {
    throw new Error("Método buscarPorCodigo() não implementado.");
  }

  async listar(filtros, opcoes) {
    throw new Error("Método listar() não implementado.");
  }

  async listarPorOperador(companyId, operadorId, filtros) {
    throw new Error("Método listarPorOperador() não implementado.");
  }

  async listarPorStatus(companyId, status, opcoes) {
    throw new Error("Método listarPorStatus() não implementado.");
  }

  async listarPorPeriodo(companyId, dataInicio, dataFim, opcoes) {
    throw new Error("Método listarPorPeriodo() não implementado.");
  }

  async atualizar(id, companyId, dados, operadorId) {
    throw new Error("Método atualizar() não implementado.");
  }

  async cancelar(id, companyId, operadorId, motivo) {
    throw new Error("Método cancelar() não implementado.");
  }

  async deletar(id, companyId) {
    throw new Error("Método deletar() não implementado.");
  }

  async obterEstatisticas(companyId, filtros) {
    throw new Error("Método obterEstatisticas() não implementado.");
  }

  async compararPeriodos(companyId, dataInicio, dataFim) {
    throw new Error("Método compararPeriodos() não implementado.");
  }

  async obterVendasPorDia(companyId, dataInicio, dataFim) {
    throw new Error("Método obterVendasPorDia() não implementado.");
  }

  async obterVendasPorHora(companyId, dataInicio, dataFim) {
    throw new Error("Método obterVendasPorHora() não implementado.");
  }

  async obterProdutosMaisVendidos(companyId, filtros, limite) {
    throw new Error("Método obterProdutosMaisVendidos() não implementado.");
  }

  async obterVendasPorOperador(companyId, filtros) {
    throw new Error("Método obterVendasPorOperador() não implementado.");
  }

  async obterVendasPorPagamento(companyId, filtros) {
    throw new Error("Método obterVendasPorPagamento() não implementado.");
  }

  async obterVendasPorCategoria(companyId, filtros) {
    throw new Error("Método obterVendasPorCategoria() não implementado.");
  }

  async obterDashboard(companyId, filtros) {
    throw new Error("Método obterDashboard() não implementado.");
  }

  async contarPorStatus(companyId, filtros) {
    throw new Error("Método contarPorStatus() não implementado.");
  }

  async contarVendas(companyId, filtros) {
    throw new Error("Método contarVendas() não implementado.");
  }
}

module.exports = VendaRepository;
