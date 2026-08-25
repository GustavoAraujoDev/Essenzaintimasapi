const API_URL = "http://127.0.0.1:3000/products";
let allProducts = [];
let selectedItems = [];

// 1. BUSCAR PRODUTOS DA API
async function fetchProducts() {
  try {
    const response = await fetch(API_URL);
    allProducts = await response.json();
    renderProductList();
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    document.getElementById("productList").innerText =
      "Erro ao carregar produtos.";
  }
}

// 2. RENDERIZAR LISTA COM CHECKBOX
function renderProductList(productsToRender = allProducts) {
  const container = document.getElementById("productList");

  if (!productsToRender || productsToRender.length === 0) {
    container.innerHTML =
      '<p class="col-span-full text-center py-10 text-gray-400">Nenhum produto encontrado para essa busca.</p>';
    return;
  }

  container.innerHTML = productsToRender
    .map((prod) => {
      // Ajuste para pegar a primeira imagem do Array 'images'
      const image =
        prod.images && prod.images.length > 0
          ? prod.images[0]
          : "https://via.placeholder.com/150";

      // Ajuste para usar o 'basePrice' conforme seu objeto
      const name = prod.name || "Produto sem nome";
      const price = prod.basePrice || 0;

      // Importante: use prod.id (o ID string) para vincular ao checkbox
      const isChecked = selectedItems.some((item) => item.productId === prod.id)
        ? "checked"
        : "";

      return `
        <label class="flex items-center gap-4 p-3 border border-gray-100 rounded-xl hover:border-red-200 hover:bg-red-50 transition-all cursor-pointer group">
          <img src="${image}" alt="${name}" class="w-14 h-14 rounded-lg object-cover bg-gray-100 shadow-sm border border-gray-100">
          <div class="flex-1">
            <h4 class="font-bold text-gray-800 text-sm group-hover:text-red-600 transition-colors">${name}</h4>
            <p class="text-green-600 font-bold text-xs uppercase italic">R$ ${Number(price).toFixed(2)}</p>
          </div>
          <input type="checkbox" 
                 value="${prod.id}" 
                 ${isChecked}
                 onchange="toggleItem('${prod.id}', ${price})" 
                 class="accent-red-600 w-5 h-5 rounded border-gray-300 cursor-pointer focus:ring-0">
        </label>
      `;
    })
    .join("");
}

// NOVA FUNÇÃO: Filtragem em tempo real
function filterProducts() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();

  const filtered = allProducts.filter((prod) => {
    const name = (prod.name || prod.nome || "").toLowerCase();
    return name.includes(searchTerm);
  });

  renderProductList(filtered);
}

// AJUSTE NA FUNÇÃO toggleItem:
// Agora usamos o toggleItem diretamente no onchange do checkbox para simplificar
function toggleItem(id, price) {
  const index = selectedItems.findIndex((i) => i.productId === id);
  if (index > -1) {
    selectedItems.splice(index, 1);
  } else {
    selectedItems.push({
      productId: id,
      quantity: 1,
      priceAtAggregation: price,
    });
  }
  updateSummary();
}

// 3. GERENCIAR SELEÇÃO
function toggleItem(id, price) {
  const index = selectedItems.findIndex((i) => i.productId === id);
  if (index > -1) {
    selectedItems.splice(index, 1);
  } else {
    selectedItems.push({
      productId: id,
      quantity: 1,
      priceAtAggregation: price,
    });
  }
  updateSummary();
}

function updateSummary() {
  const totalOriginal = selectedItems.reduce(
    (acc, item) => acc + item.priceAtAggregation,
    0,
  );

  // Mapeia os IDs selecionados para buscar os nomes reais na sua lista de produtos
  const listaNomesHtml = selectedItems
    .map((item) => {
      // Procura o produto completo na sua lista global 'allProducts' usando o ID
      const produtoOriginal = allProducts.find((p) => p.id === item.productId);
      const nomeProduto = produtoOriginal
        ? produtoOriginal.name
        : "Item desconhecido";

      return `<li class="text-xs text-blue-900">• ${nomeProduto} (Qtd: ${item.quantity})</li>`;
    })
    .join("");

  document.getElementById("summaryArea").innerHTML = `
    <div class="space-y-2">
      <div><strong>Itens selecionados (${selectedItems.length}):</strong></div>
      <ul class="pl-2 space-y-1 bg-blue-100/50 p-2 rounded-lg">
        ${listaNomesHtml || '<li class="text-xs text-gray-500 italic">Nenhum item selecionado</li>'}
      </ul>
      <div class="pt-2 border-t border-blue-200">
        <strong>Soma original:</strong> R$ ${totalOriginal.toFixed(2)}
      </div>
    </div>
  `;
}

// 4. POSTAR O COMBO NA API
async function saveCombo() {
  // 🚨 ALERTAS DE INSPECÇÃO PARA O USUÁRIO
  const textoSelected = JSON.stringify(selectedItems, null, 2);

  // Pega só o primeiro produto para o alert não estourar o tamanho da tela
  const exemploProduto =
    allProducts && allProducts.length > 0
      ? JSON.stringify(allProducts[0], null, 2)
      : "Nenhum produto encontrado em allProducts";

  alert(`1. Itens selecionados no momento (selectedItems):\n${textoSelected}`);
  alert(
    `2. Exemplo de estrutura de um produto real (allProducts[0]):\n${exemploProduto}`,
  );

  const name = document.getElementById("comboName").value.trim();
  const description = document.getElementById("comboDesc").value.trim();
  const basePrice = parseFloat(document.getElementById("comboPrice").value);

  const imageUrl = document.getElementById("comboImage")?.value.trim() || "";
  const startTime = document.getElementById("availStart")?.value || "00:00";
  const endTime = document.getElementById("availEnd")?.value || "23:59";

  // 🚨 DEFESA 1: Se não tiver itens selecionados, impede o envio antes de quebrar o Joi
  if (!selectedItems || selectedItems.length === 0) {
    alert("⚠️ Você precisa selecionar pelo menos 1 item para compor o combo!");
    return;
  }

  if (!name || isNaN(basePrice)) {
    alert("⚠️ Preencha o nome e o preço do combo!");
    return;
  }

  // 🔥 Mapeando os itens selecionados exatamente no formato que o modifierItemSchema exige
  // 🔥 Ajuste cirúrgico dentro da sua função saveCombo():
  const comboItems = selectedItems.map((item) => {
    // Busca o produto real em 'allProducts' pelo ID guardado
    const produtoOriginal = allProducts.find((p) => p.id === item.productId);

    return {
      name: produtoOriginal ? produtoOriginal.name : "Item do Combo", // Garante a String real do nome!
      price: 0,
      status: "ACTIVE",
      id: produtoOriginal ? produtoOriginal.id : "PROD-000000",
    };
  });

  // 📦 O Objeto gêmeo do productData que você sabe que funciona
  const newCombo = {
    name: name,
    description: description || "Combo promocional",
    basePrice: basePrice,
    images: [imageUrl || "https://site.com/placeholder.png"],
    categoryId: "Combos",
    attribute_keys: [], // Array vazia pura, igual ao Array.from() vazio
    status: "ACTIVE",

    // SKUs exatamente na estrutura aceita pelo banco
    skus: [
      {
        name: "Único",
        price: basePrice,
        stock: 999,
        // Removido o attributes vazio para deixar o .default({}) do Joi agir por conta própria
      },
    ],

    // Modifiers estruturados respeitando as regras de min/max e garantindo itens preenchidos
    modifiers: [
      {
        name: "Itens Inclusos no Combo",
        required: true,
        min: 1,
        max: comboItems.length,
        items: comboItems, // Nunca estará vazio por causa da DEFESA 1 acima
      },
    ],

    availability: {
      days: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
      start: startTime,
      end: endTime,
    },
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCombo),
    });

    const responseData = await response.json().catch(() => ({}));

    if (response.ok) {
      alert("🎉 Combo salvo com sucesso!");
      location.reload();
    } else {
      console.error("Erro detalhado do back-end:", responseData);
      // Exibe o erro exato retornado pela propriedade .error do seu controller
      alert(
        `⚠️ Falha na validação do servidor:\n\n${responseData.error || "Dados inválidos"}`,
      );
    }
  } catch (error) {
    console.error("Erro no POST:", error);
    alert(`❌ Erro de conexão: ${error.message}`);
  }
}

// Iniciar busca ao abrir a página
fetchProducts();
