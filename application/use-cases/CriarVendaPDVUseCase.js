class CriarVendaPDVUseCase {
  constructor(vendaRepository, productRepository, estoqueService = null) {
    this.vendaRepository = vendaRepository;
    this.productRepository = productRepository;
    this.estoqueService = estoqueService;
    // Ative com DEBUG_PDV=true nas variáveis de ambiente.
    this.debugAtivo = process.env.DEBUG_PDV === "true";
    this.log("CONSTRUTOR_INICIALIZADO", {
      vendaRepository: Boolean(vendaRepository),
      productRepository: Boolean(productRepository),
      estoqueService: Boolean(estoqueService),
      debugAtivo: this.debugAtivo,
    });
  }
  // =========================================================
  // DEBUG
  // =========================================================
  log(etapa, dados = {}) {
    if (!this.debugAtivo) return;
    try {
      console.log(
        `[PDV DEBUG] ${new Date().toISOString()} | ${etapa}`,
        JSON.stringify(dados, (chave, valor) => {
          // Evita exibir campos potencialmente sensíveis.
          if (
            /password|senha|token|authorization|cookie|secret/i.test(chave)
          ) {
            return "[REDACTED]";
          }
          return valor;
        })
      );
    } catch (erro) {
      console.log(`[PDV DEBUG] ${etapa}`, dados);
    }
  }
  logErro(etapa, erro, contexto = {}) {
    console.error(`[PDV ERRO] ${etapa}`, {
      ...contexto,
      message: erro?.message || String(erro),
      name: erro?.name || null,
      stack: erro?.stack || null,
      timestamp: new Date().toISOString(),
    });
  }
  // =========================================================
  // VALIDAÇÕES NUMÉRICAS
  // =========================================================
  numero(valor, campo) {
    this.log("NUMERO_VALIDACAO_ENTRADA", {
      campo,
      valor,
      tipo: typeof valor,
    });
    // Não transforma null ou string vazia em zero silenciosamente.
    if (
      valor === null ||
      valor === undefined ||
      (typeof valor === "string" && valor.trim() === "")
    ) {
      this.log("NUMERO_INVALIDO_VAZIO", { campo, valor });
      throw new Error(`${campo} inválido.`);
    }
    const n = Number(valor);
    if (!Number.isFinite(n)) {
      this.log("NUMERO_INVALIDO_NAO_FINITO", {
        campo,
        valor,
        resultado: n,
      });
      throw new Error(`${campo} inválido.`);
    }
    this.log("NUMERO_VALIDADO", { campo, valor, resultado: n });
    return n;
  }
  dinheiro(valor) {
    const resultado =
      Math.round((valor + Number.EPSILON) * 100) / 100;
    this.log("ARREDONDAMENTO_DINHEIRO", {
      entrada: valor,
      resultado,
    });
    return resultado;
  }
  
  // =========================================================
  // EXECUTAR VENDA
  // =========================================================
  async executar(dados, contexto) {
     const inicio = Date.now();

  this.log("VENDA_INICIADA", {
    data: new Date().toISOString(),
    userId: contexto?.userId || null,
    companyId: contexto?.companyId || null,
    nomeOperador: contexto?.nomeOperador || null,
  });

  try {
    // -----------------------------------------------------
    // 1. VALIDAR CONTEXTO AUTENTICADO
    // -----------------------------------------------------

    if (
      !contexto?.userId ||
      !contexto?.companyId ||
      !contexto?.principal
    ) {
      throw new Error(
        "Identidade autenticada e empresa são obrigatórias."
      );
    }

    const { userId, companyId, nomeOperador } = contexto;
    const principal = contexto.principal;

    // A identidade do contexto precisa corresponder
    // à identidade confiável usada na autorização.

    const identidade = VendaPDVPolicy.validatePrincipal(
      principal
    );

    if (!identidade.allowed) {
      VendaPDVPolicy.assertCan(
        principal,
        VendaPDVPolicy.ACTION.CREATE,
        { expectedCompanyId: companyId }
      );
    }

    if (String(identidade.userId) !== String(userId)) {
      throw new VendaPDVPolicy.AuthorizationError(
        VendaPDVPolicy.REASON.INVALID_PRINCIPAL
      );
    }

    // -----------------------------------------------------
    // 2. AUTORIZAR CRIAÇÃO DA VENDA
    // -----------------------------------------------------
    VendaPDVPolicy.assertCan(
      principal,
      VendaPDVPolicy.ACTION.CREATE,
      {
        expectedCompanyId: companyId,
      }
    );

    // A empresa e o operador autorizados devem ser
    // os mesmos utilizados para registrar a venda.
    if (String(identidade.companyId) !== String(companyId)) {
      throw new VendaPDVPolicy.AuthorizationError(
        VendaPDVPolicy.REASON.COMPANY_MISMATCH
      );
    }

    this.log("VENDA_AUTORIZADA", {
      userId: identidade.userId,
      companyId: identidade.companyId,
      role: identidade.role,
      action: VendaPDVPolicy.ACTION.CREATE,
    });

      // -----------------------------------------------------
      // 2. VALIDAR ITENS E PAGAMENTOS
      // -----------------------------------------------------
      if (!Array.isArray(dados?.itens) || dados.itens.length === 0) {
        this.log("ITENS_INVALIDOS", {
          itensEhArray: Array.isArray(dados?.itens),
          quantidade: dados?.itens?.length ?? null,
        });
        throw new Error("Adicione pelo menos um produto à venda.");
      }
      if (
        !Array.isArray(dados.pagamentos) ||
        dados.pagamentos.length === 0
      ) {
        this.log("PAGAMENTOS_INVALIDOS", {
          pagamentosEhArray: Array.isArray(dados?.pagamentos),
          quantidade: dados?.pagamentos?.length ?? null,
        });
        throw new Error("Informe a forma de pagamento.");
      }
      this.log("ENTRADA_VALIDADA", {
        quantidadeItens: dados.itens.length,
        quantidadePagamentos: dados.pagamentos.length,
      });
      const itens = [];
      const produtosPorId = new Map();
      // -----------------------------------------------------
      // 3. PROCESSAR CADA ITEM
      // -----------------------------------------------------
      for (let indice = 0; indice < dados.itens.length; indice++) {
        const item = dados.itens[indice];
        this.log("ITEM_INICIADO", {
          indice,
          productId: item?.productId || null,
          skuId: item?.skuId || null,
          sku: item?.sku || null,
          quantidade: item?.quantidade ?? null,
          precoUnitarioEnviado: item?.precoUnitario ?? null,
        });
        const productId = String(item?.productId || "").trim();
        const quantidade = this.numero(
          item?.quantidade,
          "Quantidade"
        );
        if (!productId || quantidade <= 0) {
          this.log("ITEM_IDENTIFICACAO_INVALIDA", {
            indice,
            productId,
            quantidade,
          });
          throw new Error("Produto ou quantidade inválida.");
        }
        // ---------------------------------------------------
        // 4. BUSCAR PRODUTO NO REPOSITÓRIO
        // ---------------------------------------------------
        let produto = produtosPorId.get(productId);
        if (produto) {
          this.log("PRODUTO_ENCONTRADO_NO_CACHE", {
            productId,
            indice,
          });
        } else {
          this.log("PRODUTO_BUSCA_INICIADA", {
            productId,
            metodo: "productRepository.findById",
          });
          produto = await this.productRepository.findById(productId);
          if (!produto) {
            this.log("PRODUTO_NAO_ENCONTRADO", { productId });
            throw new Error(
              `Produto não encontrado: ${productId}.`
            );
          }
          produtosPorId.set(productId, produto);
          this.log("PRODUTO_RETORNADO_PELO_REPOSITORIO", {
            productId,
            chaves: Object.keys(produto),
            id: produto.id ?? null,
            _id: produto._id ? String(produto._id) : null,
            nome: produto.nome ?? null,
            name: produto.name ?? null,
            status: produto.status ?? null,
            preco: produto.preco ?? null,
            price: produto.price ?? null,
            custo: produto.custo ?? null,
            cost: produto.cost ?? null,
            skusEhArray: Array.isArray(produto.skus),
            quantidadeSkus: Array.isArray(produto.skus)
              ? produto.skus.length
              : null,
            variantesEhArray: Array.isArray(produto.variantes),
            quantidadeVariantes: Array.isArray(produto.variantes)
              ? produto.variantes.length
              : null,
            // Exibe somente informações úteis para depuração.
            skus: (produto.skus || produto.variantes || []).map(
              (sku) => ({
                id: sku.id ?? null,
                _id: sku._id ? String(sku._id) : null,
                name: sku.name ?? null,
                nome: sku.nome ?? null,
                price: sku.price ?? null,
                preco: sku.preco ?? null,
                stock: sku.stock ?? null,
                estoque: sku.estoque ?? null,
              })
            ),
          });
        }
        // ---------------------------------------------------
        // 5. VALIDAR STATUS
        // ---------------------------------------------------
        const status = String(produto.status || "").toUpperCase();
        this.log("VALIDACAO_STATUS_PRODUTO", {
          productId,
          statusOriginal: produto.status ?? null,
          statusNormalizado: status,
        });
        if (["INACTIVE", "INATIVO", "INATIVO"].includes(status)) {
          this.log("PRODUTO_INATIVO", { productId, status });
          throw new Error(
            `O produto ${productId} está inativo.`
          );
        }
        // ---------------------------------------------------
        // 6. VALIDAR NOME E CUSTO
        // ---------------------------------------------------
        const nome = produto.nome || produto.name;
        const custo = this.numero(
          produto.custo ?? produto.cost ?? 0,
          "Custo do produto"
        );
        this.log("DADOS_BÁSICOS_PRODUTO", {
          productId,
          nome: nome || null,
          custo,
        });
        if (!nome || custo < 0) {
          this.log("DADOS_BÁSICOS_INVALIDOS", {
            productId,
            temNome: Boolean(nome),
            custo,
          });
          throw new Error(
            `Dados inválidos para o produto ${productId}.`
          );
        }
        // IMPORTANTE:
        // Não validar produto.preco ou produto.price aqui.
        // Seu produto pode não ter preço geral: o preço pode
        // existir somente no SKU selecionado.
        //
        // O preço oficial será obtido de produto.skus.
        // ---------------------------------------------------
        // 7. VALIDAR SKU E PREÇO
        // ---------------------------------------------------
        const sku = String(
          item.skuId || item.sku || ""
        ).trim() || null;
        this.log("SKU_RECEBIDO_PARA_VALIDACAO", {
          productId,
          skuRecebido: sku,
          precoGeral: produto.preco ?? null,
          priceGeral: produto.price ?? null,
          skuEnviadoPeloFront: item.skuId || item.sku || null,
        });
        const precoUnitario = await this.obterPrecoValidado(
          produto,
          sku,
          produto.preco ?? produto.price ?? null
        );
        this.log("PRECO_UNITARIO_VALIDADO", {
          productId,
          sku,
          precoUnitario,
          origem: sku ? "SKU_DO_BANCO" : "PRECO_GERAL_DO_PRODUTO",
        });
        // ---------------------------------------------------
        // 8. MONTAR ITEM DA VENDA
        // ---------------------------------------------------
        const itemVenda = {
          productId,
          sku,
          nome,
          categoria:
            produto.categoria ||
            produto.category ||
            "SEM_CATEGORIA",
          quantidade,
          custoUnitario: custo,
          precoUnitario,
          desconto: 0,
          total: this.dinheiro(quantidade * precoUnitario),
        };
        itens.push(itemVenda);
        this.log("ITEM_PROCESSADO", {
          indice,
          ...itemVenda,
        });
      }
      // -----------------------------------------------------
      // 9. CALCULAR SUBTOTAL, DESCONTO E ACRÉSCIMO
      // -----------------------------------------------------
      const subtotal = this.dinheiro(
        itens.reduce((soma, item) => soma + item.total, 0)
      );
      const desconto = this.dinheiro(
        this.numero(dados.desconto ?? 0, "Desconto")
      );
      const acrescimo = this.dinheiro(
        this.numero(dados.acrescimo ?? 0, "Acréscimo")
      );
      this.log("CALCULO_INICIAL", {
        itens: itens.map((item) => ({
          productId: item.productId,
          sku: item.sku,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario,
          total: item.total,
        })),
        subtotal,
        desconto,
        acrescimo,
      });
      if (
        desconto < 0 ||
        acrescimo < 0 ||
        desconto > subtotal
      ) {
        this.log("DESCONTO_OU_ACRESCIMO_INVALIDO", {
          subtotal,
          desconto,
          acrescimo,
        });
        throw new Error("Desconto ou acréscimo inválido.");
      }
      const total = this.dinheiro(
        subtotal - desconto + acrescimo
      );
      this.log("TOTAL_VENDA_CALCULADO", {
        subtotal,
        desconto,
        acrescimo,
        total,
      });
      // -----------------------------------------------------
      // 10. VALIDAR PAGAMENTOS
      // -----------------------------------------------------
      const pagamentos = dados.pagamentos.map(
        (pagamento, indice) => {
          const metodo = String(
            pagamento.metodo || ""
          ).toUpperCase();
          this.log("PAGAMENTO_RECEBIDO", {
            indice,
            metodo,
            valor: pagamento.valor ?? null,
            parcelas: pagamento.parcelas ?? null,
          });
          const metodosPermitidos = [
            "DINHEIRO",
            "PIX",
            "CARTAO_CREDITO",
            "CARTAO_DEBITO",
            "VALE",
            "OUTRO",
          ];
          if (!metodosPermitidos.includes(metodo)) {
            this.log("METODO_PAGAMENTO_INVALIDO", {
              indice,
              metodo,
              metodosPermitidos,
            });
            throw new Error(
              `Forma de pagamento inválida: ${metodo}.`
            );
          }
          const valor = this.dinheiro(
            this.numero(
              pagamento.valor,
              "Valor do pagamento"
            )
          );
          if (valor <= 0) {
            this.log("VALOR_PAGAMENTO_INVALIDO", {
              indice,
              valor,
            });
            throw new Error(
              "O valor de cada pagamento deve ser positivo."
            );
          }
          const pagamentoValidado = {
            metodo,
            valor,
            status: "PAGO",
            referencia: pagamento.referencia || null,
            parcelas: Math.max(
              1,
              Number(pagamento.parcelas) || 1
            ),
          };
          this.log("PAGAMENTO_VALIDADO", {
            indice,
            ...pagamentoValidado,
          });
          return pagamentoValidado;
        }
      );
      const totalPago = this.dinheiro(
        pagamentos.reduce(
          (soma, pagamento) => soma + pagamento.valor,
          0
        )
      );
      this.log("COMPARACAO_TOTAL_PAGAMENTO", {
        totalVenda: total,
        totalPago,
        diferenca: this.dinheiro(totalPago - total),
        pagamentos: pagamentos.map((pagamento) => ({
          metodo: pagamento.metodo,
          valor: pagamento.valor,
        })),
      });
      if (totalPago !== total) {
        throw new Error(
          `Total dos pagamentos (R$ ${totalPago.toFixed(2)}) ` +
          `diferente do total da venda (R$ ${total.toFixed(2)}).`
        );
      }
      // -----------------------------------------------------
      // 11. VALIDAR ESTOQUE
      // -----------------------------------------------------
      if (this.estoqueService) {
        this.log("ESTOQUE_VALIDACAO_INICIADA", {
          companyId,
          itens: itens.map((item) => ({
            productId: item.productId,
            sku: item.sku,
            quantidade: item.quantidade,
          })),
        });
        await this.estoqueService.validarDisponibilidade({
          companyId,
          itens,
        });
        this.log("ESTOQUE_VALIDADO", { companyId });
      } else {
        this.log("ESTOQUE_SERVICE_AUSENTE", {
          mensagem:
            "Nenhuma validação ou baixa de estoque será executada por este caso de uso.",
        });
      }
      // -----------------------------------------------------
      // 12. CALCULAR CUSTO E LUCRO
      // -----------------------------------------------------
      const custoTotal = this.dinheiro(
        itens.reduce(
          (soma, item) =>
            soma + item.quantidade * item.custoUnitario,
          0
        )
      );
      const lucroBruto = this.dinheiro(
        total - custoTotal
      );
      this.log("RESULTADO_FINANCEIRO", {
        subtotal,
        desconto,
        acrescimo,
        total,
        custoTotal,
        lucroBruto,
      });
      // -----------------------------------------------------
      // 13. MONTAR DOCUMENTO DA VENDA
      // -----------------------------------------------------
      const id =
        `PDV-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
      const vendaData = {
        id,
        companyId,
        operadorId: userId,
        operadorNome: nomeOperador || null,
        caixaId: dados.caixaId || null,
        cliente: {
          id: dados.cliente?.id || null,
          nome: dados.cliente?.nome || null,
          telefone: dados.cliente?.telefone || null,
        },
        itens,
        subtotal,
        desconto,
        acrescimo,
        total,
        custoTotal,
        lucroBruto,
        pagamentos,
        status: "CONCLUIDA",
        origem: "PDV",
        observacoes: dados.observacoes || null,
        dataVenda: new Date(),
      };
      this.log("VENDA_DOCUMENTO_PREPARADO", {
        id: vendaData.id,
        companyId: vendaData.companyId,
        operadorId: vendaData.operadorId,
        quantidadeItens: vendaData.itens.length,
        subtotal: vendaData.subtotal,
        total: vendaData.total,
        custoTotal: vendaData.custoTotal,
        lucroBruto: vendaData.lucroBruto,
        status: vendaData.status,
        origem: vendaData.origem,
      });
      // -----------------------------------------------------
      // 14. GRAVAR VENDA
      // -----------------------------------------------------
      this.log("PERSISTENCIA_VENDA_INICIADA", {
        id: vendaData.id,
      });
      const venda = await this.vendaRepository.criar(vendaData);
      if (!venda) {
        this.log("PERSISTENCIA_SEM_RETORNO", {
          id: vendaData.id,
        });
        throw new Error(
          "O repositório não retornou a venda criada."
        );
      }
      this.log("VENDA_GRAVADA", {
        idSolicitado: vendaData.id,
        idRetornado: venda.id ?? null,
        _idRetornado: venda._id
          ? String(venda._id)
          : null,
      });
      // -----------------------------------------------------
      // 15. BAIXAR ESTOQUE
      // -----------------------------------------------------
      if (this.estoqueService) {
        this.log("BAIXA_ESTOQUE_INICIADA", {
          vendaId: venda.id || vendaData.id,
          companyId,
          operadorId: userId,
        });
        await this.estoqueService.baixarItens({
          companyId,
          vendaId: venda.id || vendaData.id,
          operadorId: userId,
          itens: venda.itens,
        });
        this.log("BAIXA_ESTOQUE_CONCLUIDA", {
          vendaId: venda.id || vendaData.id,
        });
      }
      this.log("VENDA_CONCLUIDA", {
        vendaId: venda.id || vendaData.id,
        total: venda.total ?? total,
        duracaoMs: Date.now() - inicio,
      });
      return venda;
    } catch (erro) {
      this.logErro("EXECUTAR_VENDA_FALHOU", erro, {
        userId: contexto?.userId || null,
        companyId: contexto?.companyId || null,
        duracaoMs: Date.now() - inicio,
      });
      throw erro;
    }
  }
  // =========================================================
  // OBTER PREÇO OFICIAL DO SKU
  // =========================================================
  async obterPrecoValidado(produto, sku, precoPadrao = null) {
    const variantes = Array.isArray(produto?.skus)
      ? produto.skus
      : Array.isArray(produto?.variantes)
        ? produto.variantes
        : [];
    this.log("PRECO_VALIDACAO_INICIADA", {
      productId: produto?.id ?? null,
      _id: produto?._id ? String(produto._id) : null,
      skuRecebido: sku,
      precoPadrao: precoPadrao ?? null,
      quantidadeVariantes: variantes.length,
      variantes: variantes.map((variante) => ({
        id: variante.id ?? null,
        _id: variante._id
          ? String(variante._id)
          : null,
        name: variante.name ?? null,
        nome: variante.nome ?? null,
        price: variante.price ?? null,
        preco: variante.preco ?? null,
        stock: variante.stock ?? null,
        estoque: variante.estoque ?? null,
      })),
    });
    // Se o front selecionou um SKU, ele precisa existir no produto.
    if (sku) {
      const skuId = String(sku).trim();
      const variante = variantes.find(
        (v) =>
          String(v._id ?? v.id ?? "").trim() === skuId
      );
      if (!variante) {
        this.log("SKU_NAO_ENCONTRADO_NO_PRODUTO", {
          productId: produto?.id ?? null,
          _id: produto?._id
            ? String(produto._id)
            : null,
          skuRecebido: skuId,
          idsDisponiveis: variantes.map(
            (v) => String(v._id ?? v.id ?? "")
          ),
          observacao:
            "Verifique se findById está retornando a lista skus completa.",
        });
        throw new Error(
          `SKU ${skuId} não pertence ao produto ` +
          `${produto?.id || produto?._id}.`
        );
      }
      this.log("SKU_ENCONTRADO", {
        skuId,
        nomeSKU: variante.name ?? variante.nome ?? null,
        price: variante.price ?? null,
        preco: variante.preco ?? null,
        stock: variante.stock ?? null,
        estoque: variante.estoque ?? null,
      });
      const valorPreco = variante.price ?? variante.preco;
      if (
        valorPreco === null ||
        valorPreco === undefined ||
        (typeof valorPreco === "string" &&
          valorPreco.trim() === "")
      ) {
        this.log("SKU_SEM_PRECO", {
          skuId,
          price: variante.price ?? null,
          preco: variante.preco ?? null,
        });
        throw new Error(
          `Preço inválido para o SKU ${skuId}.`
        );
      }
      const preco = Number(valorPreco);
      if (!Number.isFinite(preco) || preco < 0) {
        this.log("SKU_PRECO_INVALIDO", {
          skuId,
          valorPreco,
          precoConvertido: preco,
        });
        throw new Error(
          `Preço inválido para o SKU ${skuId}.`
        );
      }
      this.log("PRECO_SKU_VALIDADO", {
        skuId,
        preco,
      });
      return preco;
    }
    // Sem SKU selecionado, utiliza o preço geral do produto.
    if (
      precoPadrao === null ||
      precoPadrao === undefined ||
      (typeof precoPadrao === "string" &&
        precoPadrao.trim() === "")
    ) {
      this.log("PRODUTO_SEM_PRECO_GERAL", {
        productId: produto?.id ?? null,
        _id: produto?._id
          ? String(produto._id)
          : null,
        precoPadrao,
        quantidadeVariantes: variantes.length,
      });
      throw new Error("Preço do produto inválido.");
    }
    const preco = Number(precoPadrao);
    if (!Number.isFinite(preco) || preco < 0) {
      this.log("PRECO_GERAL_INVALIDO", {
        precoPadrao,
        precoConvertido: preco,
      });
      throw new Error("Preço do produto inválido.");
    }
    this.log("PRECO_GERAL_VALIDADO", { preco });
    return preco;
  }
}
module.exports = CriarVendaPDVUseCase;