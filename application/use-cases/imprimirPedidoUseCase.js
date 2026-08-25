class ImprimirPedidoUseCase {
  constructor({ pedidoRepo, printerService, pedidoValidator }) {
    this.pedidoRepo = pedidoRepo;
    this.printerService = printerService;
    this.pedidoValidator = pedidoValidator;
  }

  async executar(pedidoId) {
    try {
      // 1. Buscar do banco
      const pedido = await this.pedidoRepo.buscarPorId(pedidoId);

      if (!pedido) {
        throw new Error("Pedido não encontrado");
      }

      // 2. Validar
      this.pedidoValidator.validarParaImpressao(pedido);

      // 3. Imprimir direto (service cuida do resto)
      await this.printerService.imprimir(pedido);

      return { sucesso: true };

    } catch (err) {
      console.error("[PRINT_ERROR]", err);
      throw new Error("Falha ao imprimir pedido");
    }
  }
}

module.exports = ImprimirPedidoUseCase;