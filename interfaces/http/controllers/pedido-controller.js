const CriarPedidoUseCase = require("../../../application/use-cases/CriarPedidoUseCase");
const EncontrarPedidoPorIdUseCase = require("../../../application/use-cases/EncontrarPedidoPorIdUseCase");
const EncontrarPedidosPorTelefoneUseCase = require("../../../application/use-cases/EncontrarPedidosPorTelefoneUseCase");
const AtualizarStatusPedidoUseCase = require("../../../application/use-cases/AtualizarStatusPedidoUseCase");
const CancelarPedidoUseCase = require("../../../application/use-cases/CancelarPedidoUseCase");
const EncontrarTodosPedidosUseCase = require("../../../application/use-cases/EncontrarTodosPedidosUseCase");
const DeletePedidoUseCase = require("../../../application/use-cases/DeletePedidoUseCase");
const Pedido = require("../../../domain/entities/Pedido");
// Importa a biblioteca no topo do arquivo do seu controller
const sanitizeHtml = require("sanitize-html");
const PedidoRepositoryMongo = require("../../../infra/repositories/pedidoRepositoryMongo");
const legalVersions = require("../../../constants/legalDocs"); // Ajuste o caminho conforme sua estrutura
const {
  ProductRepositoryMongo,
} = require("../../../infra/repositories/productRepositoryMongo");
const ImprimirPedidoUseCase = require("../../../application/use-cases/imprimirPedidoUseCase");
const repo = new PedidoRepositoryMongo();
const pedidoRepo = new PedidoRepositoryMongo();
const { eventDispatcher } = require("../../../bootstrap/container");
const ListAuditLogs = require("../../../application/use-cases/ListAuditLogs");
const PedidoPolicy = require("../../../domain/policies/PedidoPolicy");
const PedidoValidator = require("../../../domain/entities/pedidovalidator");
const EpsonPrinterService = require("../../../infra/printer/EpsonPrinterService");
class PedidoController {
  async criar(req, res) {
    const productRepository = new ProductRepositoryMongo();
    const pedidoRepository = new PedidoRepositoryMongo();
    const criarPedidoUseCase = new CriarPedidoUseCase({
      pedidoRepository,
      productRepository,
      pedidoPolicy: PedidoPolicy, // ✅ correto
      eventDispatcher,
    });
    try {
      const pedidoData = req.body;

      // ✅ Validação mínima (fail fast)
      if (!pedidoData?.itens || !Array.isArray(pedidoData.itens)) {
        return res.status(400).json({
          error: "Itens do pedido são obrigatórios",
        });
      }

      if (!pedidoData?.pagamento) {
        return res.status(400).json({
          error: "Dados de pagamento são obrigatórios",
        });
      }

      if (!pedidoData?.entrega) {
        return res.status(400).json({
          error: "Dados de entrega são obrigatórios",
        });
      }

      // 🧠 Contexto (ABAC)
      const context = {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        rateLimitOk: true,
        requestId: req.id || Date.now().toString(),
      };

      // 🔥 A Mágica acontece aqui:
      // 2. Validação e Blindagem do Consentimento
      if (pedidoData.consentimento) {
        const versaoSolicitada = pedidoData.consentimento.versaoTermos;
        const docsOficiais = legalVersions[versaoSolicitada];

        if (!docsOficiais) {
          return res.status(400).json({
            error: "Versão dos termos de uso inválida ou não suportada.",
          });
        }

        // SOBRESCREVEMOS o que veio do front com os dados oficiais do back + IP
        pedidoData.consentimento = {
          aceitou: pedidoData.consentimento.aceitou,
          dataHoraAceite: pedidoData.consentimento.dataHoraAceite,
          userAgent: req.headers["user-agent"],
          versaoTermos: versaoSolicitada,
          // Aqui está a segurança: usamos o conteúdo do arquivo legalDocs.js
          conteudoTermos: docsOficiais.termos.content,
          conteudoPrivacidade: docsOficiais.privacidade.content,
          ipCliente: context.ip,
        };
      } else {
        return res
          .status(400)
          .json({ error: "O aceite dos termos é obrigatório." });
      }

      // 👤 Actor (auth)
      const actor = req.user
        ? {
            id: req.user.sub || req.user.id,
            role: req.user.role,
            status: "ACTIVE", // 🔥 força
          }
        : {
            id: "ANONYMOUS",
            role: "CUSTOMER",
            status: "ACTIVE",
          };

      const novoPedido = await criarPedidoUseCase.executar({
        actor,
        pedidoData,
        context,
      });

      return res.status(201).json({
        success: true,
        data: novoPedido,
        meta: {
          requestId: context.requestId,
        },
      });
    } catch (err) {
      // ADICIONE ISSO PARA VER O ERRO NO TERMINAL DO VSCODE/NODE:
      console.error("ERRO NO USE CASE:", err);

      // 🎯 Tratamento inteligente
      if (err.message === "Acesso negado para criar pedido") {
        return res.status(403).json({ error: err.message });
      }

      if (err.message.includes("inválido")) {
        return res.status(400).json({ error: err.message });
      }

      return res.status(500).json({
        error: "Erro interno ao criar pedido",
      });
    }
  }

  // Dentro do seu PedidoController.js
  async listarNovosPedidos(req, res) {
    try {
      // Chame o novo método do repositório
      const pedidos = await pedidoRepo.listarPendentes();
      res.json(pedidos);
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar novos pedidos" });
    }
  }

  // Encontrar pedido por ID
  async encontrarPedidoPorId(req, res) {
    try {
      const { id } = req.params;
      const buscarpedidoPorId = new EncontrarPedidoPorIdUseCase(repo);
      const pedido = await buscarpedidoPorId.executar(id);
      res.status(200).json(pedido);
    } catch (err) {
      res.status(404).json({ erro: err.message });
    }
  }
  // Encontrar pedido por ID
  async encontrarTodosPedido(req, res) {
    try {
      const buscarTodosPedido = new EncontrarTodosPedidosUseCase(repo);
      const pedidos = await buscarTodosPedido.executar();
      res.status(200).json(pedidos);
    } catch (err) {
      res.status(404).json({ erro: err.message });
    }
  }

  // Encontrar pedidos por telefone
  async encontrarPedidosPorTelefone(req, res) {
    try {
      const telefone = req.params.telefone;
      const buscarpedidoPorTelefone = new EncontrarPedidosPorTelefoneUseCase(
        repo,
      );
      const pedidos = await buscarpedidoPorTelefone.executar(telefone);
      res.status(200).json(pedidos);
    } catch (err) {
      res.status(404).json({ erro: err.message });
    }
  }

  async atualizarStatus(req, res) {
    const pedidoRepository = new PedidoRepositoryMongo();

    const useCase = new AtualizarStatusPedidoUseCase({
      pedidoRepository,
      pedidoPolicy: PedidoPolicy,
      eventDispatcher,
    });

    try {
      console.log("\n--- 🌐 [Controller] Nova requisição recebida ---");

      const { pedidoId } = req.params;
      const { status } = req.body;

      console.log(`📍 Rota: PATCH /pedidos/${pedidoId}/status`);
      console.log(`📦 Body recebido:`, req.body);

      if (!status) {
        console.warn(
          "⚠️ [Aviso] Tentativa de atualização sem informar o status.",
        );
        return res.status(400).json({ error: "Status é obrigatório" });
      }

      const context = {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        requestId: req.id || Date.now().toString(),
      };

      const actor = req.user;

      // Log para conferir se o middleware de autenticação preencheu o req.user
      console.log(
        `👤 Usuário autenticado (actor):`,
        actor ? { id: actor.id, role: actor.role } : "Nenhum usuário logado",
      );

      console.log("🛠️ Chamando UseCase.executar()...");

      const pedidoAtualizado = await useCase.executar({
        actor,
        pedidoId,
        novoStatus: status,
        context,
      });

      console.log("✅ [Controller] Resposta enviada com sucesso.");
      return res.status(200).json({
        success: true,
        data: pedidoAtualizado,
        meta: { requestId: context.requestId },
      });
    } catch (err) {
      // Aqui capturamos qualquer erro que "subiu" do UseCase
      console.error("\n🔥 [Controller] Capturado erro no fluxo:");
      console.error(`❌ Mensagem: ${err.message}`);

      if (
        err.message.includes("Transição inválida") ||
        err.message.includes("status inválida")
      ) {
        console.log("👉 Motivo: Erro de regra de negócio (Workflow de Status)");
        return res.status(400).json({ error: err.message });
      }

      if (err.message.includes("Acesso negado")) {
        console.log("👉 Motivo: Falha na Policy (Permissão)");
        return res.status(403).json({ error: err.message });
      }

      if (err.message.includes("não encontrado")) {
        console.log("👉 Motivo: ID de pedido inexistente no banco.");
        return res.status(404).json({ error: err.message });
      }

      console.log("👉 Motivo: Erro interno não mapeado.");
      return res.status(500).json({
        error: "Erro ao atualizar status do pedido",
        details: err.message, // Adicionado temporariamente para te ajudar a ver o erro real no Postman
      });
    }
  }

  // Cancelar pedido
  async cancelarPedido(req, res) {
    try {
      const { pedidoId } = req.params;
      const cancelarpedido = new CancelarPedidoUseCase(repo);
      const pedidoCancelado = await cancelarpedido.executar(pedidoId);
      res.status(200).json(pedidoCancelado);
    } catch (err) {
      res.status(400).json({ erro: err.message });
    }
  }

  // Cancelar pedido
  async DeletarPedido(req, res) {
    try {
      const { pedidoId } = req.params;
      const deletarpedido = new DeletePedidoUseCase(repo);
      const pedidodeletado = await deletarpedido.executar(pedidoId);
      res.status(200).json(pedidodeletado);
    } catch (err) {
      res.status(400).json({ erro: err.message });
    }
  }

  async imprimirPedidoController(req, res) {
    const pedidoValidator = new PedidoValidator();

    try {
      const { pedidoId } = req.body;

      if (!pedidoId) {
        return res.status(400).json({
          erro: "pedidoId é obrigatório",
        });
      }

      // 🔍 1. Buscar os dados completos do pedido no Banco de Dados (MongoDB)
      const pedidoCompleto = await pedidoRepo.buscarPorId(pedidoId); // Adapte para o método real do seu repositório

      if (!pedidoCompleto) {
        return res.status(404).json({
          erro: "Pedido não encontrado no banco de dados",
        });
      }

      // 🔌 2. Recupera o Socket da loja injetado no Express (configurado no seu server.js)
      const getSocketLoja = req.app.get("getSocketLoja");
      const socketLoja = getSocketLoja ? getSocketLoja() : null;

      // 🛡️ 3. Se a impressora da loja estiver online, dispara o JSON do pedido
      if (socketLoja) {
        // Envia o payload completo do pedido para o Agente Local processar a formatação e o USB
        socketLoja.emit("imprimir-pedido", pedidoCompleto);

        console.log(
          `🚀 [PRINT] Pedido #${pedidoId} enviado com sucesso via WebSocket.`,
        );

        return res.status(200).json({
          sucesso: true,
          mensagem: "Pedido enviado para o painel de impressão local",
          modo: "real",
        });
      }

      // ⚠️ 4. Se a loja estiver offline, avisa o cliente/painel administrativo
      console.warn(
        `⚠️ [PRINT_WARN] Tentativa de impressão do pedido #${pedidoId}, mas a impressora está offline.`,
      );

      return res.status(503).json({
        sucesso: false,
        erro: "A impressora local do estabelecimento está offline",
        detalhe:
          "Certifique-se de que o aplicativo Agente de Impressão está rodando na máquina da loja.",
      });
    } catch (error) {
      console.error("[PRINT_CONTROLLER_ERROR]", error);

      return res.status(500).json({
        erro: "Erro ao processar comando de impressão",
        detalhe: error.message,
      });
    }
  }

  async imprimirParcialMesaController(req, res) {
    try {
      const { mesaId, dadosComanda } = req.body;

      // 🛡️ VALIDAÇÃO 1: Presença dos dados brutos
      if (!mesaId) {
        return res.status(400).json({ erro: "mesaId é obrigatório" });
      }
      if (
        !dadosComanda ||
        !dadosComanda.itens ||
        !Array.isArray(dadosComanda.itens) ||
        dadosComanda.itens.length === 0
      ) {
        return res
          .status(400)
          .json({ erro: "Estrutura de itens inválida ou vazia" });
      }

      // 🔥 SANITIZAÇÃO PROFISSIONAL: Remove qualquer tag HTML/Script existente por completo
      // O objeto { allowedTags: [], allowedAttributes: {} } garante que vira TEXTO PURO (Strings limpas)
      const opcoesSanitize = { allowedTags: [], allowedAttributes: {} };

      const mesaIdSanitizado = sanitizeHtml(
        String(mesaId),
        opcoesSanitize,
      ).trim();

      // 🛡️ VALIDAÇÃO 2: Sanitização de Dados e Recálculo Matemático de Segurança (Anti-Fraude)
      let subtotalCalculadoNoServidor = 0;
      const itensSeguros = [];

      for (const item of dadosComanda.itens) {
        // Garante que os valores numéricos são válidos, absolutos e limpos
        const quantity = Math.abs(parseInt(item.quantity)) || 0;
        let unitPrice = Math.abs(parseFloat(item.unitPrice)) || 0;

        const ehCredito =
          String(item.productId).includes("CREDITO") ||
          String(item.name).includes("PAGTO");

        if (!ehCredito) {
          // Se for um produto normal (comida/bebida), não pode ser negativo nem zero
          unitPrice = Math.abs(unitPrice);
          if (quantity <= 0 || unitPrice <= 0) {
            return res.status(400).json({
              erro: `Item ${sanitizeHtml(item.name || "", opcoesSanitize)} possui quantidade ou preço inválidos.`,
            });
          }
        } else {
          // Se for crédito/abatimento, garantimos que ele permaneça NEGATIVO para subtrair do subtotal
          if (unitPrice > 0) {
            unitPrice = -unitPrice;
          }
        }

        // Proteção matemática: O servidor calcula o total baseado nos valores unitários limpos
        const totalPriceCalculado = Number((quantity * unitPrice).toFixed(2));
        subtotalCalculadoNoServidor += totalPriceCalculado;

        // Sanitiza o array de adicionais/detalhes se houver
        const extrasSanitizados = Array.isArray(item.extras)
          ? item.extras
              .map((ext) => sanitizeHtml(ext, opcoesSanitize).trim())
              .filter(Boolean)
          : [];

        itensSeguros.push({
          productId: sanitizeHtml(
            String(item.productId || ""),
            opcoesSanitize,
          ).trim(),
          name: sanitizeHtml(String(item.name || ""), opcoesSanitize).trim(),
          category: sanitizeHtml(
            String(item.category || "Geral"),
            opcoesSanitize,
          ).trim(),
          size: sanitizeHtml(
            String(item.size || "Padrão"),
            opcoesSanitize,
          ).trim(),
          quantity,
          unitPrice,
          totalPrice: totalPriceCalculado, // Valor blindado pelo servidor
          extras: extrasSanitizados,
          notes: sanitizeHtml(String(item.notes || ""), opcoesSanitize).trim(),
        });
      }

      // Arredonda o subtotal final para evitar dízimas de ponto flutuante do Javascript
      subtotalCalculadoNoServidor = Number(
        subtotalCalculadoNoServidor.toFixed(2),
      );

      // 🛡️ VALIDAÇÃO 3: Reconstrução do Payload Seguro e Consolidado
      const payloadParcialSeguro = {
        companyId: sanitizeHtml(
          String(dadosComanda.companyId || "ADMIN-LOCAL"),
          opcoesSanitize,
        ).trim(),
        userId: sanitizeHtml(
          String(dadosComanda.userId || ""),
          opcoesSanitize,
        ).trim(),
        cliente: {
          nome: `Mesa ${mesaIdSanitizado} (PARCIAL)`,
          telefone: "000000000",
          email: "atendimento@local.com",
        },
        consentimento: {
          aceitou: true,
          dataHoraAceite: new Date().toISOString(),
          userAgent: sanitizeHtml(
            String(req.headers["user-agent"] || ""),
            opcoesSanitize,
          ).trim(),
          versaoTermos: "v1.2024-05",
          conteudoTermos: "",
          conteudoPrivacidade: "",
        },
        itens: itensSeguros, // Lista de produtos auditada e higienizada
        pagamento: {
          metodo: "BALCÃO",
          total: subtotalCalculadoNoServidor, // Total recalculado na API
          status: "PENDING",
        },
        entrega: {
          tipo: "DINE_IN",
          mesa: mesaIdSanitizado,
          taxaEntrega: 0,
        },
        status: "CONFIRMED",
      };

      // 🔌 4. Recupera o Socket da loja
      const getSocketLoja = req.app.get("getSocketLoja");
      const socketLoja = getSocketLoja ? getSocketLoja() : null;

      // 🛡️ 5. Envio seguro via WebSocket
      if (socketLoja) {
        socketLoja.emit("imprimir-parcial", {
          mesaId: mesaIdSanitizado,
          dadosComanda: payloadParcialSeguro, // ✅ Mantém a estrutura idêntica à do front-end
        });

        console.log(
          `🚀 [SECURE_PRINT] Parcial da Mesa ${mesaIdSanitizado} higienizada e enviada.`,
        );

        return res.status(200).json({
          sucesso: true,
          message:
            "Parcial da comanda enviada de forma segura para a impressora local",
          modo: "parcial",
        });
      }

      console.warn(
        `⚠️ [PRINT_WARN] Tentativa de impressão parcial, mas a impressora está offline.`,
      );
      return res.status(503).json({
        sucesso: false,
        error: "A impressora local do estabelecimento está offline",
        detalhe:
          "Certifique-se de que o aplicativo Agente de Impressão está rodando na máquina da loja.",
      });
    } catch (error) {
      console.error("[PRINT_PARTIAL_CONTROLLER_ERROR]", error);
      return res.status(500).json({
        erro: "Erro interno ao processar comando seguro de impressão",
        detalhe: error.message,
      });
    }
  }
}

module.exports = new PedidoController();
