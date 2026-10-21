
"use strict";

const VendaPDVPolicy = require("../../domain/policies/VendaPDVPolicy");

class CancelarVendaPDVUseCase {
  constructor(
    vendaRepository,
    estoqueService = null,
    pagamentoService = null
  ) {
    if (!vendaRepository) {
      throw new Error("O repositório de vendas é obrigatório.");
    }

    this.vendaRepository = vendaRepository;
    this.estoqueService = estoqueService;
    this.pagamentoService = pagamentoService;
  }

  async executar({ vendaId, motivo } = {}, contexto = {}) {
    // 1. Validar os dados básicos do contexto autenticado.
    if (
      !contexto.userId ||
      !contexto.companyId ||
      !contexto.principal
    ) {
      throw new Error(
        "Identidade autenticada, associação à empresa e empresa são obrigatórias."
      );
    }

    if (!vendaId || !String(vendaId).trim()) {
      throw new Error("Informe o identificador da venda.");
    }

    const motivoNormalizado = String(motivo || "").trim();

    if (!motivoNormalizado) {
      throw new Error("O motivo do cancelamento é obrigatório.");
    }

    const userId = String(contexto.userId);
    const companyId = String(contexto.companyId);
    const principal = contexto.principal;

    // 2. Autorizar o cancelamento pela Policy.
    // Somente ADMIN/OWNER pode cancelar vendas.
    // STAFF/EMPLOYEE pode criar vendas, mas não cancelá-las.
    const autorizacao = VendaPDVPolicy.assertCan(
      principal,
      VendaPDVPolicy.ACTION.CANCEL,
      {
        expectedCompanyId: companyId,
      }
    );

    // 3. Garantir que o contexto e a identidade autorizada
    // representam o mesmo usuário.
    if (String(autorizacao.userId) !== userId) {
      throw new VendaPDVPolicy.AuthorizationError(
        VendaPDVPolicy.REASON.INVALID_PRINCIPAL
      );
    }

    if (String(autorizacao.companyId) !== companyId) {
      throw new VendaPDVPolicy.AuthorizationError(
        VendaPDVPolicy.REASON.COMPANY_MISMATCH
      );
    }

    // 4. Buscar a venda dentro da empresa autorizada.
    const venda = await this.vendaRepository.buscarPorId(
      String(vendaId).trim(),
      companyId
    );

    if (!venda) {
      throw new Error("Venda não encontrada nesta empresa.");
    }

    // 5. Garantir que a operação é exclusiva para vendas do PDV.
    if (venda.origem !== "PDV") {
      throw new Error(
        "Esta operação só permite cancelar vendas do PDV."
      );
    }

    // 6. Validar o estado atual da venda.
    if (venda.status === "CANCELADA") {
      throw new Error("Esta venda já foi cancelada.");
    }

    if (venda.status === "DEVOLVIDA") {
      throw new Error(
        "Esta venda já foi devolvida integralmente."
      );
    }

    if (venda.status === "PARCIALMENTE_DEVOLVIDA") {
      throw new Error(
        "Venda com devolução parcial exige tratamento específico."
      );
    }

    if (
      venda.status !== "CONCLUIDA" &&
      venda.status !== "PENDENTE"
    ) {
      throw new Error(
        "O status atual não permite cancelamento."
      );
    }

    // 7. Validar o cancelamento financeiro antes de alterar a venda.
    if (this.pagamentoService) {
      await this.pagamentoService.validarCancelamento({
        venda,
        companyId,
        operadorId: userId,
      });
    }

    // 8. Persistir o cancelamento.
    // O repositório deve garantir que apenas uma operação concorrente
    // consiga cancelar a mesma venda.
    const cancelada = await this.vendaRepository.cancelar(
      venda.id || venda._id || vendaId,
      companyId,
      userId,
      motivoNormalizado
    );

    if (!cancelada) {
      throw new Error(
        "Não foi possível confirmar o cancelamento da venda."
      );
    }

    // 9. Repor o estoque de maneira idempotente.
    // O serviço deve impedir reposições duplicadas da mesma venda.
    if (this.estoqueService) {
      await this.estoqueService.reporItens({
        companyId,
        vendaId: String(venda.id || venda._id || vendaId),
        operadorId: userId,
        itens: venda.itens || [],
        motivo: motivoNormalizado,
      });
    }

    // 10. Estornar pagamentos, quando aplicável.
    if (this.pagamentoService) {
      await this.pagamentoService.estornarSeAplicavel({
        venda: cancelada,
        companyId,
        operadorId: userId,
        motivo: motivoNormalizado,
      });
    }

    // 11. Retornar o resultado.
    return {
      mensagem: "Venda cancelada.",
      venda: cancelada,
    };
  }
}

module.exports = CancelarVendaPDVUseCase;
