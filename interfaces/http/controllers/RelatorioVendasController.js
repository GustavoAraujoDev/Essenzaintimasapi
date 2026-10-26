
"use strict";

class RelatorioVendasController {
  constructor(gerarRelatorioVendasUseCase) {
    if (!gerarRelatorioVendasUseCase) {
      throw new Error(
        "GerarRelatorioVendasUseCase é obrigatório."
      );
    }

    this.gerarRelatorioVendasUseCase =
      gerarRelatorioVendasUseCase;

    this.gerar = this.gerar.bind(this);
  }

  async gerar(req, res, next) {
    try {
      // A autenticação deve ter sido realizada pelo middleware.
      const contexto = req.user;

      if (!contexto) {
        return res.status(401).json({
          sucesso: false,
          mensagem: "Usuário não autenticado.",
        });
      }

      const { inicio, fim } = req.query;

      if (!inicio || !fim) {
        return res.status(400).json({
          sucesso: false,
          mensagem:
            "Informe as datas de início e fim do relatório.",
          exemplo:
            "/vendas/relatorio?inicio=2026-10-01&fim=2026-10-31",
        });
      }

      const relatorio =
        await this.gerarRelatorioVendasUseCase.execute(
          contexto,
          {
            dataInicio: inicio,
            dataFim: fim,
          }
        );

      res.setHeader(
        "Cache-Control",
        "no-store, private"
      );

      return res.status(200).json({
        sucesso: true,
        mensagem: "Relatório gerado com sucesso.",
        relatorio,
      });
    } catch (erro) {
      // Encaminha erros para o middleware global do Express.
      return next(erro);
    }
  }
}

module.exports = RelatorioVendasController;
