
class CancelarVendaPDVUseCase {
  constructor(vendaRepository, estoqueService = null, pagamentoService = null) {
    this.vendaRepository = vendaRepository;
    this.estoqueService = estoqueService;
    this.pagamentoService = pagamentoService;
  }

  async executar({ vendaId, motivo }, contexto) {
    if (!contexto?.userId || !contexto?.companyId) {
      throw new Error("Usuário autenticado e empresa são obrigatórios.");
    }

    if (!vendaId) {
      throw new Error("Informe o identificador da venda.");
    }

    if (!motivo || !String(motivo).trim()) {
      throw new Error("O motivo do cancelamento é obrigatório.");
    }

    const { userId, companyId } = contexto;

    const venda = await this.vendaRepository.buscarPorId(
      vendaId,
      companyId
    );

    if (venda.origem !== "PDV") {
      throw new Error("Esta operação só permite cancelar vendas do PDV.");
    }

    if (venda.status === "CANCELADA") {
      throw new Error("Esta venda já foi cancelada.");
    }

    if (venda.status === "DEVOLVIDA") {
      throw new Error("Esta venda já foi devolvida integralmente.");
    }

    if (venda.status === "PARCIALMENTE_DEVOLVIDA") {
      throw new Error(
        "Venda com devolução parcial exige tratamento específico."
      );
    }

    if (venda.status !== "CONCLUIDA" && venda.status !== "PENDENTE") {
      throw new Error("O status atual não permite cancelamento.");
    }

    // Para pagamentos já capturados, o serviço deve confirmar o
    // estorno antes de considerar o processo financeiro concluído.
    if (this.pagamentoService) {
      await this.pagamentoService.validarCancelamento({
        venda,
        companyId,
        operadorId: userId,
      });
    }

    const cancelada = await this.vendaRepository.cancelar(
      venda.id,
      companyId,
      userId,
      String(motivo).trim()
    );

    // A devolução ao estoque deve ser idempotente: executar duas
    // vezes para a mesma venda não pode repor os produtos em dobro.
    if (this.estoqueService) {
      await this.estoqueService.reporItens({
        companyId,
        vendaId: venda.id,
        operadorId: userId,
        itens: venda.itens,
        motivo: String(motivo).trim(),
      });
    }

    if (this.pagamentoService) {
      await this.pagamentoService.estornarSeAplicavel({
        venda: cancelada,
        companyId,
        operadorId: userId,
        motivo: String(motivo).trim(),
      });
    }

    return {
      mensagem: "Venda cancelada.",
      venda: cancelada,
    };
  }
}

module.exports = CancelarVendaPDVUseCase;
