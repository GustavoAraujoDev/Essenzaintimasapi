
"use strict";

const VendaPDVPolicy = require("../../domain/policies/VendaPDVPolicy");
const SaleCancelledEvent = require(
  "../../domain/events/SaleCancelledEvent"
);

class CancelarVendaPDVUseCase {
  constructor(
    vendaRepository,
    productRepo = null, // Mantido temporariamente para compatibilidade
    pagamentoService = null,
    eventDispatcher = null
  ) {
    if (!vendaRepository) {
      throw new Error("O repositório de vendas é obrigatório.");
    }

    this.vendaRepository = vendaRepository;
    this.pagamentoService = pagamentoService;
    this.eventDispatcher = eventDispatcher;
  }

  async executar({ vendaId, motivo } = {}, contexto = {}) {
    // 1. Validar a identidade autenticada.
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

    // 2. Validar a infraestrutura necessária antes de cancelar.
    if (
      !this.eventDispatcher ||
      typeof this.eventDispatcher.dispatch !== "function"
    ) {
      throw new Error(
        "EventDispatcher obrigatório para processar o cancelamento e a reposição de estoque."
      );
    }

    // 3. Autorizar a operação pela Policy.
    const autorizacao = VendaPDVPolicy.assertCan(
      principal,
      VendaPDVPolicy.ACTION.CANCEL,
      {
        expectedCompanyId: companyId,
      }
    );

    // 4. Validar o alinhamento da identidade e da empresa.
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

    // 5. Buscar a venda dentro da empresa autorizada.
    const venda = await this.vendaRepository.buscarPorId(
      String(vendaId).trim(),
      companyId
    );

    if (!venda) {
      throw new Error("Venda não encontrada nesta empresa.");
    }

    // 6. Permitir exclusivamente vendas originadas no PDV.
    if (venda.origem !== "PDV") {
      throw new Error(
        "Esta operação só permite cancelar vendas do PDV."
      );
    }

    // 7. Validar o estado atual da venda.
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

    // 8. Validar o cancelamento financeiro.
    if (this.pagamentoService) {
      await this.pagamentoService.validarCancelamento({
        venda,
        companyId,
        operadorId: userId,
      });
    }

    // 9. Persistir o cancelamento antes de disparar o evento.
    const vendaIdFinal =
      venda.id || venda._id || String(vendaId).trim();

    const cancelada = await this.vendaRepository.cancelar(
      vendaIdFinal,
      companyId,
      userId,
      motivoNormalizado
    );

    if (!cancelada) {
      throw new Error(
        "Não foi possível confirmar o cancelamento da venda."
      );
    }

    console.log(

  "[ETAPA 1] Itens originais da venda:",

  JSON.stringify(venda.itens, null, 2)

);

    // 10. Disparar o evento de cancelamento.
    // O handler será responsável por repor o estoque
    // e registrar a auditoria dos produtos atualizados.
    const vendaParaEvento = {
      ...venda,
      ...cancelada,
      id: cancelada.id || cancelada._id || vendaIdFinal,

      // Preservar os itens originais vendidos.
      itens: venda.itens,
    };

    console.log(

  "[ETAPA 2] Itens enviados ao evento:",

  JSON.stringify(vendaParaEvento.itens, null, 2)

);
    
    await this.eventDispatcher.dispatch(
      new SaleCancelledEvent({
        venda: vendaParaEvento,
        contexto: {
          ...contexto,
          userId,
          companyId,
          userEmail:
            contexto.userEmail || principal.email || "",
          origem: "CANCELAMENTO_VENDA_PDV",
          vendaId: String(vendaIdFinal),
          motivo: motivoNormalizado,
        },
      })
    );

    // 11. Estornar pagamentos, quando aplicável.
    if (this.pagamentoService) {
      await this.pagamentoService.estornarSeAplicavel({
        venda: cancelada,
        companyId,
        operadorId: userId,
        motivo: motivoNormalizado,
      });
    }

    // 12. Retornar o resultado.
    return {
      mensagem:
        "Venda cancelada. Evento de reposição de estoque processado.",
      venda: cancelada,
    };
  }
}

module.exports = CancelarVendaPDVUseCase;
