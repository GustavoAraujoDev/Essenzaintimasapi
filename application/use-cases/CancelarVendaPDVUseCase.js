"use strict";

const VendaPDVPolicy = require("../../domain/policies/VendaPDVPolicy");
const Product = require("../../domain/entities/product");
const ProductStockAddedEvent = require("../../domain/events/ProductStockAddedEvent"); // Ou um evento de restituição/devolução caso possua

class CancelarVendaPDVUseCase {
  constructor(
    vendaRepository,
    productRepo = null,
    pagamentoService = null,
    eventDispatcher = null
  ) {
    if (!vendaRepository) {
      throw new Error("O repositório de vendas é obrigatório.");
    }

    this.vendaRepository = vendaRepository;
    this.productRepo = productRepo;
    this.pagamentoService = pagamentoService;
    this.eventDispatcher = eventDispatcher;
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
    const autorizacao = VendaPDVPolicy.assertCan(
      principal,
      VendaPDVPolicy.ACTION.CANCEL,
      {
        expectedCompanyId: companyId,
      }
    );

    // 3. Garantir alinhamento de contexto e identidade.
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

    // 8. Persistir o cancelamento da venda.
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

    // 9. Repor o estoque diretamente via productRepo usando a Entidade Product.
    if (this.productRepo && Array.isArray(venda.itens) && venda.itens.length > 0) {
      for (const item of venda.itens) {
        const productId = item.productId || item.produtoId;
        if (!productId) continue;

        const productData = await this.productRepo.findById(productId);
        if (!productData) continue;

        const product = new Product(productData);
        const oldStock = product.stock;

        // Adiciona a quantidade do item devolvido ao estoque do SKU correspondente
        const quantidade = item.quantidade || item.quantity || 0;
        const skuId = item.skuId || null;

        if (quantidade > 0) {
          product.addStock(skuId, quantidade);
          const newData = product.stock;

          // Atualiza o produto
          await this.productRepo.update(product);

          // Dispara auditoria do estoque atualizado se houver eventDispatcher
          if (this.eventDispatcher) {
            await this.eventDispatcher.dispatch(
              new ProductStockAddedEvent({
                entity: "Product",
                entityId: product.id,
                userId,
                userEmail: contexto.userEmail || principal?.email || "",
                oldData: { stock: oldStock },
                newData: { stock: newData },
                snapshot: product,
                status: "SUCCESS",
                contexto: {
                  ...contexto,
                  origem: "CANCELAMENTO_VENDA_PDV",
                  vendaId: venda.id || venda._id || vendaId,
                  motivo: motivoNormalizado,
                },
              })
            );
          }
        }
      }
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
      mensagem: "Venda cancelada e estoque recomposto.",
      venda: cancelada,
    };
  }
}

module.exports = CancelarVendaPDVUseCase;
