const API_URL = "http://127.0.0.1:3000/products";
let isLogin = true;
let cart = [];
let currentProduct = null;
let currentSelectedSku = null;
let taxaEntregaAtual = 0; // Global: será atualizada pela função de frete
// Localização da sua loja (Exemplo: Centro de Fortaleza)
const MINHA_LOJA_COORD = { lat: -3.702528, lng: -38.589886 };
let debounceTimer;

const audioAlerta = new Audio(
  "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3",
);

// Configuração padrão do Toast do SweetAlert2
const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 4000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener("mouseenter", Swal.stopTimer);
    toast.addEventListener("mouseleave", Swal.resumeTimer);
  },
});

function controlarPiscaPisca(inputElement) {
  // Se o usuário digitou algo no campo atual
  if (inputElement.value.trim() !== "") {
    inputElement.classList.remove("piscar-alerta-direto");
    inputElement.classList.add("bg-white", "border-gray-300"); // Estilo limpo enquanto digita
  } else {
    // Se ele apagar tudo, o campo volta a piscar imediatamente
    inputElement.classList.remove("bg-white", "border-gray-300");
    inputElement.classList.add("piscar-alerta-direto");
  }
}

function getStoreFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("loja") || "pratinhopratudo";
}
const storeTag = getStoreFromUrl();
document.getElementById("company-badge").innerText = `Loja: ${storeTag}`;
document.getElementById("store-name-text").innerText = storeTag;

// Toggle Login/Cadastro
const toggleBtn = document.getElementById("toggle-auth");
toggleBtn.addEventListener("click", () => {
  isLogin = !isLogin;
  document.getElementById("group-name").classList.toggle("hidden");
  document.getElementById("group-phone").classList.toggle("hidden");
  document.getElementById("auth-title").querySelector("h2").innerText = isLogin
    ? "Falta pouco para matar sua fome!"
    : "Crie sua conta agora";
  document.getElementById("btn-submit").innerText = isLogin
    ? "Continuar"
    : "Cadastrar";
  document.getElementById("toggle-text").innerText = isLogin
    ? "Não possui conta?"
    : "Já tem conta?";
  toggleBtn.innerText = isLogin ? "Criar conta" : "Fazer login";
});

// Autenticação
document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const endpoint = isLogin ? "/auth/login" : "/auth/registrar";
  const payload = isLogin
    ? { email, password, context: { companyTag: storeTag } }
    : {
        email,
        password,
        role: "CUSTOMER",
        context: { companyTag: storeTag },
        customerData: {
          name: document.getElementById("name").value,
          phone: document.getElementById("phone").value,
        },
      };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Erro na autenticação");

    // Feedback visual de sucesso
    Toast.fire({
      icon: "success",
      title: isLogin ? "Bem-vindo de volta!" : "Conta criada com sucesso!",
    });

    showMenu();
  } catch (err) {
    // Usando seu Swal configurado anteriormente para erros
    Swal.fire({
      icon: "error",
      title: "Falha na Autenticação",
      text: err.message,
    });
  }
});

// Abas
function switchTab(tab) {
  const sections = [
    "menu-section",
    "cart-section",
    "details-section",
    "auth-section",
    "orders-section",
  ];
  sections.forEach((s) => document.getElementById(s).classList.add("hidden"));
  document.getElementById(`${tab}-section`).classList.remove("hidden");
  if (tab === "cart") renderCart();
  if (tab === "orders") {
    // Se já tivermos o telefone do usuário logado, preenchemos e buscamos automaticamente
    /*
    if (currentUser?.profile?.phone) {
      document.getElementById("search-phone").value = currentUser.profile.phone;
      fetchOrdersByPhone();
    }
    */
  }

  // 🔥 CORREÇÃO: Reseta o scroll para o topo sempre que mudar de aba
  window.scrollTo({ top: 0, behavior: "instant" });

  // Se o seu app usa uma div principal com rolagem interna (comum em layouts mobile fixos),
  // descomente a linha abaixo e mude "main-container" para o ID da sua div principal de conteúdo:
  // document.getElementById("main-container").scrollTop = 0;

  // ADICIONE ISSO: Salva a aba atual no navegador
  localStorage.setItem("lastTab", tab);
}

// Carregar Menu
async function showMenu() {
  document.getElementById("auth-section").classList.add("hidden");
  document.getElementById("menu-section").classList.remove("hidden");
  document.getElementById("bottom-nav").classList.remove("hidden");
  document.body.classList.add("pb-24");
  document
    .getElementById("main-content")
    .classList.replace("max-w-md", "max-w-2xl");

  // Busca os dados do usuário e os produtos simultaneamente
  try {
    await Promise.all([
      fetch(`${API_URL}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((products) => renderProducts(products)),
    ]);
  } catch (err) {
    console.error("Erro no carregamento inicial:", err);
  }
}

function renderProducts(products) {
  const container = document.getElementById("categories-container");
  const navContainer = document.getElementById("categories-nav");

  if (!container || !navContainer) return;

  // 1. Filtra produtos ATIVOS e com ESTOQUE POSITIVO em algum SKU
  const filteredProducts = products.filter((p) => {
    const isActive = p.status === "ACTIVE";
    const hasStock = p.skus && p.skus.some((sku) => sku.stock > 0);
    return isActive && hasStock;
  });

  // Se não houver produtos ativos, a loja está visualmente fechada
  updateStoreVisualStatus(filteredProducts.length === 0);

  // Caso não sobre nenhum produto após o filtro
  if (filteredProducts.length === 0) {
    container.innerHTML =
      '<p class="text-center text-gray-400 py-10">Nenhum produto disponível no momento.</p>';
    navContainer.innerHTML = "";
    return;
  }

  // 2. Agrupa por categoria
  const groups = filteredProducts.reduce((acc, p) => {
    const cat = p.categoryId || "Geral";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  // Limpa os containers antes de renderizar para não duplicar dados
  container.innerHTML = "";
  navContainer.innerHTML = "";

  // 3. Renderiza o Menu Horizontal e as Seções de Produtos de forma integrada
  Object.keys(groups).forEach((categoryName, index) => {
    // Cria o ID limpando acentos e espaços para evitar quebra na âncora
    const categoryId = `cat-${categoryName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")}`;

    // Botão do menu horizontal (Estilo iFood)
    const activeClass =
      index === 0 ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-600";
    navContainer.innerHTML += `
      <button 
        onclick="scrollToCategory('${categoryId}', this)" 
        class="category-btn px-4 py-2 rounded-full border border-gray-200 text-sm font-bold ${activeClass} transition-all shrink-0"
      >
        ${categoryName}
      </button>
    `;

    // Seção de produtos com layout preservado
    let sectionHtml = `
      <section id="${categoryId}" class="scroll-mt-20 mb-8">
        <h3 class="font-bold text-gray-700 border-b pb-2 mb-4 uppercase text-xs tracking-widest">${categoryName}</h3>
        <div class="grid gap-4 grid-cols-1">
          ${groups[categoryName]
            .map((p) => {
              // 💰 LÓGICA DO PREÇO: Busca o primeiro SKU com estoque
              const primeiroSku =
                p.skus && p.skus.length > 0 ? p.skus[0] : null;
              const preco = primeiroSku ? primeiroSku.price : 0;
              const precoFormatado = preco.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              });

              return `
              <div class="flex justify-between items-center p-4 border rounded-xl hover:bg-gray-50 cursor-pointer shadow-sm transition-colors bg-white" 
                   onclick='openProductDetails(${JSON.stringify(p).replace(/'/g, "&apos;")})'>
                  <div class="flex-1 pr-4">
                      <h4 class="font-semibold text-gray-800 uppercase text-sm">${p.name}</h4>
                      <p class="text-gray-500 text-xs line-clamp-2 mt-1 mb-2">${p.description || ""}</p>
                      
                      <!-- Preço inserido logo abaixo da descrição -->
                      <span class="font-bold text-green-600 text-sm block mt-1">
                        ${precoFormatado}
                      </span>
                  </div>
                  ${
                    p.images?.[0]
                      ? `
                      <div class="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 bg-cover bg-center" 
                           style="background-image: url('${p.images[0]}')">
                      </div>
                  `
                      : '<div class="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-400 text-[10px]">Sem foto</div>'
                  }
              </div>
            `;
            })
            .join("")}
        </div>
      </section>
    `;

    // Adiciona a seção estruturada ao container
    container.innerHTML += sectionHtml;
  });
}

// 3. Função responsável pela animação de descida/rolagem suave (Mantido idêntico)
function scrollToCategory(id, button) {
  const targetElement = document.getElementById(id);
  if (!targetElement) return;

  // Realiza o movimento de descida de forma nativa e suave
  targetElement.scrollIntoView({ behavior: "smooth", block: "start" });

  // Remove as classes ativas de todos os botões do menu horizontal
  const buttons = document.querySelectorAll(".category-btn");
  buttons.forEach((btn) => {
    btn.classList.remove("bg-gray-950", "text-white");
    btn.classList.add("bg-gray-50", "text-gray-600");
  });

  // Aplica as classes de ativo apenas no botão que acabou de ser clicado
  button.classList.remove("bg-gray-50", "text-gray-600");
  button.classList.add("bg-gray-950", "text-white");
}

function updateStoreVisualStatus(isClosed) {
  const badge = document.getElementById("status-badge");
  const ping = document.getElementById("status-ping");
  const dot = document.getElementById("status-dot");
  const text = document.getElementById("status-text");

  if (isClosed) {
    // Loja Fechada: Cores Cinza/Vermelho e remove o ping (pulsação)
    ping.classList.add("hidden");
    dot.classList.replace("bg-emerald-500", "bg-gray-400");
    text.innerText = "Fechado";
    text.classList.replace("text-gray-700", "text-gray-400");
    badge.classList.add("opacity-80");
  } else {
    // Loja Aberta: Cores Verdes e ativa o ping
    ping.classList.remove("hidden");
    dot.classList.replace("bg-gray-400", "bg-emerald-500");
    text.innerText = "Online";
    text.classList.replace("text-gray-400", "text-gray-700");
    badge.classList.remove("opacity-80");
  }
}

function openProductDetails(product) {
  currentProduct = product;
  switchTab("details");
  // 🔥 CORREÇÃO: Força a página a voltar para o topo imediatamente ao abrir os detalhes
  window.scrollTo({ top: 0, behavior: "instant" });
  // Nota: Usei "instant" em vez de "smooth" para o cliente não ver a tela subindo,
  // fazendo o produto já abrir direto no topo de forma limpa.

  const content = document.getElementById("product-details-content");

  // Se a sua aba "details" for um elemento com scroll interno (ex: uma div com overflow-y: auto),
  // descomente a linha abaixo e mude para o ID correto do container que rola:
  // document.getElementById("seu-container-de-abas").scrollTop = 0;
  // 1. Renderizar SKUs (Tamanhos)
  const skusHTML = (product.skus || [])
    .map((sku, index) => {
      const isOutOfStock = sku.stock <= 0;
      return `
            <label class="flex-1 ${isOutOfStock ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}">
                <input type="radio" name="sku-opt" value="${sku.price}" 
                    class="peer hidden" 
                    data-name="${sku.name}"
                    data-stock="${sku.stock}"
                    ${index === 0 && !isOutOfStock ? "checked" : ""} 
                    ${isOutOfStock ? "disabled" : ""}
                    onchange="renderAttributes(${index}); updateTotal(); resetMainQty()">
                <div class="p-3 border rounded-xl text-center peer-checked:border-red-600 peer-checked:bg-red-50 transition-all">
                    <span class="block font-bold text-xs uppercase">${sku.name}</span>
                    <span class="block text-xs text-gray-500 font-normal">R$ ${sku.price.toFixed(2)}</span>
                    ${isOutOfStock ? '<span class="text-[10px] text-red-500 font-bold">ESGOTADO</span>' : ""}
                </div>
            </label>
        `;
    })
    .join("");

  // 2. Renderizar Grupos de Modificadores Dinamicamente
  // 2. Renderizar Grupos de Modificadores Dinamicamente
  const modifiersHTML = (product.modifiers || [])
    .map((group, groupIndex) => {
      // FILTRO: Só mostra itens ATIVOS
      const activeItems = group.items.filter(
        (item) => item.status === "ACTIVE",
      );

      if (activeItems.length === 0) return "";

      return `
        <div class="mt-6 border-t pt-4">
            <div class="flex justify-between items-center mb-3">
                <h3 class="font-bold text-xs text-gray-500 uppercase">${groupIndex + 2}. ${group.name}</h3>
                <span class="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-400">
                    Min: ${group.min} / Máx: ${group.max}
                </span>
            </div>
            <div class="space-y-2">
                ${activeItems
                  .map((item, index) => {
                    // 🔥 CORREÇÃO: Removemos o itemIndex problemático e usamos um ID baseado no nome do item (limpo, sem espaços)
                    const itemSafeId = item.name
                      .replace(/\s+/g, "-")
                      .toLowerCase();

                    return `
                    <div class="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                        <div>
                            <span class="text-sm font-medium text-gray-700">${item.name}</span>
                            ${item.price > 0 ? `<span class="block text-[10px] text-gray-400">+ R$ ${item.price.toFixed(2)}</span>` : ""}
                        </div>
                        <div class="flex items-center gap-3 bg-white rounded-lg border p-1">
                            <button onclick="updateModifierQty('${groupIndex}', '${itemSafeId}', -1)" class="w-7 h-7 text-red-600 font-bold">-</button>
                            <input type="number" 
                                id="mod-${groupIndex}-${itemSafeId}" 
                                value="0" 
                                data-price="${item.price}" 
                                data-name="${item.name}" 
                                data-group="${group.name}"
                                data-max="${group.max}"
                                class="modifier-qty w-6 text-center text-sm font-bold border-none bg-transparent" readonly>
                            <button onclick="updateModifierQty('${groupIndex}', '${itemSafeId}', 1)" class="w-7 h-7 text-red-600 font-bold">+</button>
                        </div>
                    </div>
                  `;
                  })
                  .join("")}
            </div>
        </div>
      `;
    })
    .join("");

  content.innerHTML = `
        <div class="space-y-6 pb-20">
            ${product.images?.[0] ? `<img src="${product.images[0]}" class="w-full h-48 object-cover rounded-xl shadow-sm">` : ""}
            <div>
                <h2 class="text-2xl font-bold text-gray-800">${product.name}</h2>
                <p class="text-gray-500 text-sm mt-1">${product.description || ""}</p>
            </div>

            <div>
                <h3 class="font-bold text-xs text-gray-500 uppercase mb-3">1. Escolha o Tamanho</h3>
                <div class="flex gap-2">${skusHTML}</div>
            </div>

            <div id="sku-attributes-container"></div>
            
            <div id="modifiers-dynamic-container">
                ${modifiersHTML}
            </div>

            <div class="flex items-center justify-between pt-4 border-t">
                <span class="font-bold text-gray-700">Quantidade do pedido</span>
                <div class="flex items-center gap-4 bg-gray-100 rounded-xl p-1">
                    <button onclick="updateQty('main-qty', -1)" class="w-10 h-10 bg-white rounded-lg shadow-sm text-xl font-bold">-</button>
                    <input type="number" id="main-qty" value="1" class="w-8 text-center font-bold bg-transparent border-none" readonly>
                    <button onclick="updateQty('main-qty', 1)" class="w-10 h-10 bg-white rounded-lg shadow-sm text-xl font-bold">+</button>
                </div>
            </div>

            <div class="pt-4">
                <h3 class="font-bold text-xs text-gray-500 uppercase mb-2">Alguma observação?</h3>
                <textarea id="product-note" placeholder="Ex: Tirar cebola..." class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-600 outline-none resize-none" rows="3"></textarea>
            </div>
        </div>
    `;

  renderAttributes(0);
  // 🔥 CORREÇÃO AQUI: Calcula o preço base inicial assim que a tela abre
  updateTotal();
}

// 2. SUBSTITUA A SUA FUNÇÃO updateModifierQty POR ESTA:

function updateModifierQty(groupIndex, itemSafeId, delta) {
  // 🔥 CORREÇÃO: Agora busca pelo ID único gerado a partir do nome do item
  const input = document.getElementById(`mod-${groupIndex}-${itemSafeId}`);
  if (!input) return;

  const groupName = input.dataset.group;
  const maxLimit = parseInt(input.dataset.max);

  // Soma quanto já tem selecionado no grupo inteiro
  const inputsDoGrupo = document.querySelectorAll(
    `.modifier-qty[data-group="${groupName}"]`,
  );

  let totalAtualNoGrupo = 0;
  inputsDoGrupo.forEach((el) => {
    totalAtualNoGrupo += parseInt(el.value || 0);
  });

  let valorAtualItem = parseInt(input.value || 0);
  let novoValorItem = valorAtualItem + delta;

  // 1. Impedir menos que zero
  if (novoValorItem < 0) return;

  // 2. Impedir de ultrapassar o máximo do grupo ao clicar no +
  if (delta > 0 && totalAtualNoGrupo >= maxLimit) {
    return;
  }

  input.value = novoValorItem;

  // Atualiza o preço na tela
  if (typeof updateTotal === "function") updateTotal();
}

function renderAttributes(skuIndex) {
  const container = document.getElementById("sku-attributes-container");
  const sku = currentProduct.skus[skuIndex];

  if (!sku || !sku.attributes) {
    container.innerHTML = "";
    return;
  }

  // Pegamos todos os valores (ex: "carne", "frango") dos atributos
  const values = Object.values(sku.attributes);

  // Geramos os botões. Todos compartilham o name="selected-flavor"
  // para que o usuário só possa escolher UM.
  container.innerHTML = `
        <div class="mt-4">
            <h3 class="font-bold text-xs text-gray-500 uppercase mb-2">Escolha o Sabor</h3>
            <div class="flex flex-wrap gap-2">
                ${values
                  .map(
                    (val, i) => `
                    <label class="cursor-pointer">
                        <input type="radio" 
                               name="selected-flavor" 
                               onchange="updateTotal()"
                               value="${val}" 
                               class="peer hidden" 
                               ${i === 0 ? "checked" : ""}>
                        <div class="px-4 py-2 border rounded-full peer-checked:bg-red-600 peer-checked:text-white transition-all text-sm">
                            ${val}
                        </div>
                    </label>
                `,
                  )
                  .join("")}
            </div>
        </div>
    `;
}

function updateQty(id, delta) {
  const input = document.getElementById(id);
  let newVal = parseInt(input.value) + delta;

  if (id === "main-qty") {
    // Busca o SKU selecionado para saber o limite de estoque
    const selectedSku = document.querySelector('input[name="sku-opt"]:checked');
    const maxStock = selectedSku ? parseInt(selectedSku.dataset.stock) : 99;

    if (newVal < 1) newVal = 1;
    if (newVal > maxStock) {
      Toast.fire({
        icon: "warning",
        title: `Ops! Só temos ${maxStock} unidades em estoque.`,
      });
      newVal = maxStock;
    }
  } else {
    // Lógica para adicionais (modifiers) costuma ser livre ou limitada por regra de negócio
    if (newVal < 0) newVal = 0;
  }

  input.value = newVal;
  if (typeof updateTotal === "function") updateTotal();
}

// Função auxiliar para resetar a quantidade ao trocar de tamanho
function resetMainQty() {
  const input = document.getElementById("main-qty");
  if (input) input.value = 1;
}

function updateTotal() {
  const selectedSku = document.querySelector('input[name="sku-opt"]:checked');
  const mainQty = parseInt(document.getElementById("main-qty").value);

  let basePrice = selectedSku ? parseFloat(selectedSku.value) : 0;
  let modifiersTotal = 0;

  // Soma cada adicional multiplicado pela sua quantidade
  document.querySelectorAll(".modifier-qty").forEach((input) => {
    modifiersTotal += parseInt(input.value) * parseFloat(input.dataset.price);
  });

  // O total é (Preço do SKU + Adicionais) * Quantidade de Itens
  const finalTotal = (basePrice + modifiersTotal) * mainQty;

  const priceDisplay = document.getElementById("detail-total-price");
  if (priceDisplay) priceDisplay.innerText = `R$ ${finalTotal.toFixed(2)}`;
}

document.getElementById("btn-add-cart").onclick = () => {
  // 1. DEFESA DO PRODUTO PAI: Se o produto principal não estiver ativo, mata a execução aqui
  if (currentProduct) {
    if (
      currentProduct.status !== "ACTIVE" &&
      currentProduct.status !== "active"
    ) {
      Swal.fire({
        icon: "error",
        title: "Produto indisponível",
        text: `O item "${currentProduct.name}" está com o status [${currentProduct.status}] no banco e não pode ser vendido.`,
      });
      return;
    }
  }

  const groups = currentProduct.modifiers || [];

  // 2. --- VALIDAÇÃO DE MÍNIMO E MÁXIMO DOS GRUPOS ---
  for (const group of groups) {
    const activeItemsInGroup = group.items.filter(
      (i) => i.status === "ACTIVE" || i.status === "active",
    );

    if (activeItemsInGroup.length === 0) continue;

    const totalSelected = Array.from(
      document.querySelectorAll(`.modifier-qty[data-group="${group.name}"]`),
    ).reduce((sum, input) => sum + parseInt(input.value || 0), 0);

    if (totalSelected < group.min) {
      Toast.fire({
        icon: "warning",
        title: `O grupo "${group.name}" é obrigatório.`,
        text: `Selecione pelo menos ${group.min} itens.`,
      });
      return;
    }

    if (totalSelected > group.max) {
      Toast.fire({
        icon: "error",
        title: "Limite excedido",
        text: `O grupo "${group.name}" permite no máximo ${group.max} itens.`,
      });
      return;
    }
  }

  // 3. --- CAPTURA E DIAGNÓSTICO DE ADICIONAIS ---
  const selectedExtras = [];
  let relatorioItens = "📋 <b>RAIO-X DOS ADICIONAIS SELECIONADOS:</b><br><br>";
  let detectouInativoVazando = false;

  document.querySelectorAll(".modifier-qty").forEach((input) => {
    const qty = parseInt(input.value) || 0;

    if (qty > 0) {
      // Localiza o item na árvore de dados (vinda da API) para checar o DNA dele
      const grupoNoProduto = currentProduct.modifiers?.find(
        (g) => g.name === input.dataset.group,
      );
      const itemNoProduto = grupoNoProduto?.items?.find(
        (i) => i.name === input.dataset.name,
      );

      // Pega o status real registrado no MongoDB
      const statusBanco = itemNoProduto
        ? itemNoProduto.status
        : "NÃO ENCONTRADO";

      // Constrói a linha do relatório para o Alerta na tela
      relatorioItens += `🔹 <b>${qty}x ${input.dataset.name}</b> (${input.dataset.group})<br>`;
      relatorioItens += `&nbsp;&nbsp;&nbsp;&nbsp;• Status no Banco: <span style="color: ${statusBanco === "ACTIVE" ? "green" : "red"}; font-weight: bold;">[${statusBanco}]</span><br>`;

      // Se o status for diferente de ACTIVE, aciona a barreira de segurança
      if (statusBanco !== "ACTIVE" && statusBanco !== "active") {
        relatorioItens += `&nbsp;&nbsp;&nbsp;&nbsp;⚠️ <span style="color: red; font-weight: bold;">[BLOQUEADO] Este item tentou passar mas foi expurgado!</span><br>`;
        detectouInativoVazando = true;
        return; // Pula este item e não joga ele no array selectedExtras
      }

      // Se passou na barreira, monta o payload do adicional
      for (let i = 0; i < qty; i++) {
        selectedExtras.push({
          group: input.dataset.group,
          name: input.dataset.name,
          price: parseFloat(input.dataset.price) || 0,
        });
      }
    }
  });

  // 5. --- CAPTURA DE PREÇO E PROPRIEDADES FINAIS ---
  const skuElement = document.querySelector('input[name="sku-opt"]:checked');
  const flavorElement = document.querySelector(
    'input[name="selected-flavor"]:checked',
  );
  const mainQty = parseInt(document.getElementById("main-qty").value) || 1;
  const notes = document.getElementById("product-note").value;

  const totalDisplay = document.getElementById("detail-total-price").innerText;
  const totalPrice =
    parseFloat(totalDisplay.replace("R$ ", "").replace(",", ".")) || 0;

  const itemParaCarrinho = {
    cartId: Date.now(),
    productId: currentProduct.id,
    name: currentProduct.name,
    size: skuElement ? skuElement.dataset.name : "Padrão",
    flavor: flavorElement ? flavorElement.value : "",
    extras: selectedExtras,
    notes: notes,
    unitPrice: totalPrice / mainQty,
    price: totalPrice,
    quantity: mainQty,
  };

  // 6. PERSISTÊNCIA NA MEMÓRIA E LOCALSTORAGE
  cart.push(itemParaCarrinho);
  localStorage.setItem("cart", JSON.stringify(cart));

  // 7. ATUALIZAÇÃO DA INTERFACE
  updateCartBadge();
  renderCart();
  switchTab("cart");
};

// Garanta que exista um Event Listener para atualizar o carrinho quando o pagamento mudar
document
  .getElementById("payment-method")
  ?.addEventListener("change", renderCart);

function renderCart() {
  const container = document.getElementById("cart-items");
  const summary = document.getElementById("cart-summary");

  if (cart.length === 0) {
    container.innerHTML =
      '<p class="text-center text-gray-400 py-10">Seu carrinho está vazio</p>';
    summary.classList.add("hidden");
    return;
  }

  summary.classList.remove("hidden");

  // Resetar o subtotal para não acumular valores duplicados ao re-renderizar
  let subtotal = 0;

  container.innerHTML = cart
    .map((item) => {
      subtotal += item.price;

      // Lógica para formatar os extras
      const extrasFormatados = item.extras.reduce((acc, current) => {
        if (!acc[current.group]) acc[current.group] = [];
        acc[current.group].push(current.name);
        return acc;
      }, {});

      const extrasText = Object.keys(extrasFormatados)
        .map((groupName) => {
          return `<b class="text-gray-600">${groupName}:</b> ${extrasFormatados[groupName].join(", ")}`;
        })
        .join("<br>");

      const noteText = item.notes
        ? `<div class="mt-1 px-2 py-1 bg-blue-50 border-l-2 border-blue-400 text-[10px] text-blue-700 italic">Obs: ${item.notes}</div>`
        : "";

      return `
        <div class="bg-white p-4 rounded-2xl border border-gray-100 mb-3 shadow-sm">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <h4 class="font-bold text-sm text-gray-800">${item.quantity}x ${item.name}</h4>
                    <p class="text-[10px] text-gray-500 uppercase font-semibold mt-0.5">
                        Tamanho: ${item.size} ${item.flavor ? `| Sabor: ${item.flavor}` : ""}
                    </p>
                    
                    <div class="text-[10px] text-gray-400 mt-2 leading-relaxed">
                        ${extrasText ? extrasText : "Sem adicionais"}
                    </div>
                    
                    ${noteText}
                </div>
                <div class="text-right ml-4">
                    <button onclick="removeFromCart(${item.cartId})" class="text-gray-300 hover:text-red-500 transition">
                        <i class="fas fa-times-circle"></i>
                    </button>
                    <p class="text-red-600 font-bold text-sm mt-4">R$ ${item.price.toFixed(2).replace(".", ",")}</p>
                </div>
            </div>
            <div class="mt-4 text-left">
              <button 
                type="button"
                onclick="switchTab('menu');" 
                class="inline-flex items-center gap-1.5 text-xs font-bold text-[#ea1d2c] hover:text-[#c4121f] transition-colors py-1 group"
              >
                <i class="fas fa-plus-circle text-[#ea1d2c] group-hover:text-[#c4121f] transition-colors"></i> 
                Continuar comprando (adicionar mais itens)
              </button>
            </div>
        </div>
      `;
    })
    .join("");

  // --- LÓGICA DA TAXA DE CARTÃO ---
  const paymentMethod = document.getElementById("payment-method")?.value;
  let cardFee = 0;

  if (paymentMethod === "CARTAO_CREDITO" || paymentMethod === "CARTAO_DEBITO") {
    cardFee = 1.0;
  }

  const cardFeeContainer = document.getElementById("card-fee-container");
  const cardFeeDisplay = document.getElementById("cart-card-fee");

  if (cardFeeContainer && cardFeeDisplay) {
    if (cardFee > 0) {
      cardFeeDisplay.innerText = `R$ ${cardFee.toFixed(2).replace(".", ",")}`;
      cardFeeContainer.classList.remove("hidden");
    } else {
      cardFeeContainer.classList.add("hidden");
    }
  }

  // --- ATUALIZAÇÃO DOS VALORES NO DOM ---
  document.getElementById("cart-subtotal").innerText =
    `R$ ${subtotal.toFixed(2).replace(".", ",")}`;

  if (document.getElementById("cart-shipping")) {
    const taxa = typeof taxaEntregaAtual !== "undefined" ? taxaEntregaAtual : 0;

    // 🔥 CORREÇÃO VISUAL: Se o cupom de frete grátis estiver aplicado, mostra "Grátis"
    if (
      appliedCouponCode === "FRETEGRATIS" ||
      appliedCouponCode === "QUEROFRETE"
    ) {
      document.getElementById("cart-shipping").innerText = "Grátis";
    } else {
      document.getElementById("cart-shipping").innerText =
        `R$ ${taxa.toFixed(2).replace(".", ",")}`;
    }
  }

  // 🔥 ADICIONE ESTA LINHA AQUI: Gatilho de segurança silencioso
  // Ele vai checar se o cupom atual ainda bate com este 'subtotal' novo
  revalidarCupomAtivo(subtotal);

  // --- CENTRALIZAÇÃO DO CÁLCULO DO TOTAL COM CUPOM ---
  // Chamamos a função central para calcular o total abatendo o cupom (se houver) e somando a taxa do cartão
  recalcularTotalGeralCompleto(subtotal, cardFee);
}

// ==========================================
// FUNÇÃO AUXILIAR: CENTRALIZA O CÁLCULO COMPLETO DO TOTAL
// ==========================================
function recalcularTotalGeralCompleto(subtotal, cardFee = 0) {
  const taxa = typeof taxaEntregaAtual !== "undefined" ? taxaEntregaAtual : 0;

  // 🔒 TRAVA DE SEGURANÇA: Se o cupom for de frete grátis, força a variável global a ser 0
  if (
    appliedCouponCode === "FRETEGRATIS" ||
    appliedCouponCode === "QUEROFRETE"
  ) {
    taxaEntregaAtual = 0;
  }

  // Se não foi passado cardFee manualmente (ex: vindo da validação do cupom), calcula dinamicamente
  if (cardFee === 0) {
    const paymentMethod = document.getElementById("payment-method")?.value;
    if (
      paymentMethod === "CARTAO_CREDITO" ||
      paymentMethod === "CARTAO_DEBITO"
    ) {
      cardFee = 1.0;
    }
  }

  // Deduz o cupom global ativo (computedDiscount)
  const totalGeral = subtotal + taxa + cardFee - computedDiscount;
  const totalFinalSeguro = Math.max(0, totalGeral);

  // Injeta o valor final formatado em Real no ID correspondente
  document.getElementById("cart-total").innerText =
    `R$ ${totalFinalSeguro.toFixed(2).replace(".", ",")}`;
}

function updateCartBadge() {
  const b = document.getElementById("cart-badge");
  if (!b) return; // Proteção caso o elemento não exista em alguma página

  b.innerText = cart.length;
  b.classList.toggle("hidden", cart.length === 0);
}

async function logout() {
  try {
    await fetch(`${API_URL}/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error(err);
  }

  currentUser = null;
  cart = [];
  localStorage.clear();
  sessionStorage.clear();

  // força apagar qualquer cache visual
  document.getElementById("menu-section").classList.add("hidden");
  document.getElementById("bottom-nav").classList.add("hidden");

  // volta login SEM reload
  switchTab("auth");

  Toast.fire({
    icon: "success",
    title: "Logout realizado com sucesso",
  });
}

function toggleAddressField() {
  const typeEl = document.getElementById("order-type");
  const addrField = document.getElementById("order-address");

  if (typeEl && addrField) {
    const type = typeEl.value;
    // Se for PICKUP (Retirada), esconde o campo de endereço
    addrField.style.display = type === "DELIVERY" ? "block" : "none";
  }
}

function toggleAddressField() {
  const type = document.getElementById("order-type").value;
  const addrField = document.getElementById("order-address");
  addrField.style.display = type === "DELIVERY" ? "block" : "none";
}

async function checkout() {
  if (cart.length === 0)
    return Toast.fire({ icon: "error", title: "Carrinho vazio" });

  const nomeCliente = document.getElementById("client-name").value;
  const foneCliente = document.getElementById("client-phone").value;
  const orderType = document.getElementById("order-type").value;
  const address = document.getElementById("order-address").value;
  const concordouTermos = document.getElementById("check-termos").checked;

  if (!nomeCliente || !foneCliente) {
    return Swal.fire({
      icon: "warning",
      title: "Dados incompletos",
      text: "Nome e WhatsApp são obrigatórios.",
    });
  }

  // 🔥 VALIDAÇÃO DO DELIVERY
  let bairro = "";
  if (orderType === "DELIVERY") {
    bairro = document.getElementById("address-neighborhood").value;
    const endereco = address.trim();

    // 1. Verifica se os campos básicos estão vazios
    if (!endereco || !bairro || bairro === "" || bairro === "selecione") {
      return Swal.fire({
        icon: "warning",
        title: "Dados de entrega incompletos",
        text: "Por favor, preencha o endereço completo e selecione o bairro para a entrega.",
      });
    }
  }

  // 3. Validação dos Termos
  if (!concordouTermos)
    return Toast.fire({
      icon: "info",
      title: "Aceite os termos para continuar",
    });

  // 🛒 CÁLCULO DO SUBTOTAL (Multiplicando pela quantidade para evitar erros de soma)
  const subtotal = cart.reduce((sum, item) => sum + item.price, 0);

  // Certifique-se de que 'taxaEntregaAtual' existe globalmente no seu código
  const taxaEntrega =
    orderType === "DELIVERY"
      ? typeof taxaEntregaAtual !== "undefined"
        ? taxaEntregaAtual
        : 0
      : 0;

  // 🔥 CAPTURA DO MÉTODO DE PAGAMENTO
  const metodoPagamento = document.getElementById("payment-method").value;

  // 💳 Lógica da taxa do cartão (R$ 1,00) se for Crédito ou Débito
  let taxaCartao = 0;
  if (
    metodoPagamento === "CARTAO_CREDITO" ||
    metodoPagamento === "CARTAO_DEBITO"
  ) {
    taxaCartao = 1.0;
  }

  const valorTotalPedido = subtotal + taxaEntrega + taxaCartao;

  // 💰 Captura e Validação de Troco para Dinheiro
  let valorTrocoPara = null;

  if (metodoPagamento === "DINHEIRO") {
    const inputTroco = document.getElementById("change-amount");
    if (inputTroco && inputTroco.value.trim() !== "") {
      valorTrocoPara = parseFloat(inputTroco.value);

      if (valorTrocoPara < valorTotalPedido) {
        return Swal.fire({
          icon: "warning",
          title: "Valor de troco inválido",
          text: `O valor para troco (R$ ${valorTrocoPara.toFixed(2).replace(".", ",")}) não pode ser menor que o total do pedido (R$ ${valorTotalPedido.toFixed(2).replace(".", ",")}).`,
        });
      }
    }
  }

  // Montagem do endereço string completo para o backend/cliente
  const enderecoCompleto =
    orderType === "DELIVERY"
      ? `${address} - Bairro: ${bairro}`
      : "Retirada no local";

  const pedidoFinal = {
    companyId: typeof storeTag !== "undefined" ? storeTag : "STORE_DEFAULT",
    entity: "Pedido",
    entityId: `PED-${Date.now()}`,
    actor: { id: "000000000000000000000000", role: "CUSTOMER" },

    cliente: {
      nome: nomeCliente,
      telefone: foneCliente,
      endereco: enderecoCompleto,
      email: "cliente_avulso@prafood.com",
    },
    // --- BLOCO DE SEGURANÇA JURÍDICA ---
    consentimento: {
      aceitou: true,
      dataHoraAceite: new Date().toISOString(),
      userAgent: navigator.userAgent,
      versaoTermos: "v1.2024-05",
      conteudoTermos:
        typeof legalData !== "undefined"
          ? legalData.termos.content
          : "Termos aceitos no checkout",
      conteudoPrivacidade:
        typeof legalData !== "undefined"
          ? legalData.privacidade.content
          : "Privacidade aceita no checkout",
    },
    // ----------------------------------------------
    itens: cart.map((item) => ({
      productId: item.productId,
      name: item.name,
      size: item.size,
      quantity: item.quantity,
      extras: item.extras
        ? item.extras.map((e) => (typeof e === "object" ? e.name : e))
        : [],
      notes: item.notes || "",
    })),
    // 🔥 AS TRÊS LINHAS ABAIXO INTEGRAM TODOS OS CUPONS COM O BACKEND:
    cupom: appliedCouponCode, // Ex: "QUERO10" ou "FRETEGRATIS"
    desconto: computedDiscount, // Ex: 10.40 (o valor calculado pelo front para o backend abater)
    pagamento: {
      metodo: metodoPagamento,
      total: valorTotalPedido,
      trocoPara: valorTrocoPara,
    },
    entrega: {
      tipo: orderType,
      endereco: enderecoCompleto,
      taxaEntrega,
    },
  };

  // Função auxiliar interna para limpar o estado do app após finalizar o processo
  const limparCarrinhoNoSucesso = () => {
    cart = [];
    localStorage.removeItem("cart");
    if (typeof updateCartBadge === "function") updateCartBadge();
    if (typeof renderCart === "function") renderCart();
  };

  try {
    const pedidoSalvo = await criarPedidoNoSistema(pedidoFinal);
    enviarParaWhatsApp(pedidoSalvo, cart);
    limparCarrinhoNoSucesso();
  } catch (err) {
    console.error("Erro no checkout:", err);
    Swal.fire({
      icon: "warning",
      title: "Pedido enviado via WhatsApp",
      text: "Houve um erro ao registrar no banco, mas você pode seguir pelo WhatsApp.",
      confirmButtonText: "Abrir WhatsApp",
    }).then(() => {
      enviarParaWhatsApp(pedidoFinal, cart);
      limparCarrinhoNoSucesso(); // Limpa o carrinho mesmo indo pelo fluxo alternativo (WhatsApp)
    });
  }
}

function enviarParaWhatsApp(pedido, itensDoCarrinho) {
  const agora = new Date();

  // Ajuste para pegar a taxa de entrega se existir, ou 0
  const taxa = pedido.entrega?.taxaEntrega || 0;

  // 💳 NOVO: Descobre a taxa do cartão localmente olhando apenas para o método de pagamento
  const metodoPagamentoRaw = pedido.pagamento?.metodo || "Não informado";
  let taxaCartao = 0;
  if (
    metodoPagamentoRaw === "CREDIT_CARD" ||
    metodoPagamentoRaw === "DEBIT_CARD"
  ) {
    taxaCartao = 1.0;
  }

  // Formatação dos itens
  const itensTexto = itensDoCarrinho
    .map((item) => {
      // Formata os extras removendo espaços extras
      const extrasFormatados =
        item.extras && item.extras.length > 0
          ? item.extras
              .map((e) => (typeof e === "object" ? e.name.trim() : e.trim()))
              .filter((e) => e !== "") // Remove itens vazios
              .join(", ")
          : "";

      const descExtra = extrasFormatados
        ? `\n   ┗━━ ➕ *Add:* ${extrasFormatados}`
        : "";

      // No seu JSON o campo é "notes"
      const descObs = item.notes?.trim()
        ? `\n   ┗━━ 📝 *Obs:* _${item.notes}_`
        : "";

      // CORREÇÃO: No JSON enviado, a propriedade é unitPrice, não price
      const valorUnitario = item.unitPrice || 0;

      return `🛍️ *${item.quantity}x ${item.name.toUpperCase()}*\n🔹 Tam: ${item.size}${descExtra}${descObs}\n💰 _R$ ${valorUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}_`;
    })
    .join("\n\n---\n\n");

  // Verificações de segurança para campos que podem vir vazios no objeto pagamento
  const totalPedido = pedido.pagamento?.total || 0;
  const metodoPagamento = pedido.pagamento?.metodo || "Não informado";
  const tipoEntrega =
    pedido.entrega?.tipo === "DELIVERY" ? "🚀 Delivery" : "🏢 Retirada";

  // 💰 LOGICA DO TROCO ADICIONADA AQUI
  let blocoTroco = "";
  if (metodoPagamento === "DINHEIRO" && pedido.pagamento?.trocoPara) {
    const pagoCom = pedido.pagamento.trocoPara;
    const valorTroco = pagoCom - totalPedido;

    // Se o valor digitado for maior que o total, calcula o troco; se não, avisa que é valor exato
    if (valorTroco > 0) {
      blocoTroco = `\n💵 *PAGO COM:* R$ ${pagoCom.toFixed(2).replace(".", ",")}\n🔄 *LEVAR TROCO DE:* R$ ${valorTroco.toFixed(2).replace(".", ",")}`;
    } else {
      blocoTroco = `\n💵 *PAGO COM:* Valor exato (R$ ${totalPedido.toFixed(2).replace(".", ",")})`;
    }
  }

  // 💳 NOVO: Bloco de texto montado localmente se houver taxa de cartão
  const blocoTaxaCartao =
    taxaCartao > 0
      ? `\n💳 *TAXA CARTÃO:* R$ ${taxaCartao.toFixed(2).replace(".", ",")}`
      : "";

  const textoZap = `
📌 *PEDIDO #${pedido.id || "NOVO"}*
------------------------------------------------
👤 *CLIENTE:* ${pedido.cliente.nome}
📞 *FONE:* ${pedido.cliente.telefone}
📍 *TIPO:* ${tipoEntrega}
🏠 *END:* ${pedido.cliente.endereco}
------------------------------------------------
🛒 *ITENS:*

${itensTexto}

------------------------------------------------
🚚 *TAXA:* R$ ${taxa.toFixed(2).replace(".", ",")}${blocoTaxaCartao}
💰 *TOTAL: R$ ${totalPedido.toFixed(2).replace(".", ",")}*
💳 *PAGAMENTO:* ${metodoPagamento}${blocoTroco}
------------------------------------------------
⏰ ${agora.toLocaleString("pt-BR")}
`;

  const foneLoja = "5585991924340";
  const url = `https://api.whatsapp.com/send?phone=${foneLoja}&text=${encodeURIComponent(textoZap)}`;

  window.open(url, "_blank");
}

async function criarPedidoNoSistema(pedidoFinal) {
  Swal.fire({
    title: "Processando pedido...",
    didOpen: () => Swal.showLoading(),
    allowOutsideClick: false,
  });

  const res = await fetch(`http://127.0.0.1:3000/pedidos`, {
    // Usando a constante de ambiente que definimos antes
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pedidoFinal),
  });

  const result = await res.json();

  if (!res.ok) {
    throw new Error(result.error || result.message || "Erro ao salvar pedido.");
  }

  return result.data; // Retorna o pedido criado (contendo o ID gerado pelo banco)
}

window.onload = async () => {
  // Recuperar carrinho do LocalStorage
  const cartSalvo = localStorage.getItem("cart");
  if (cartSalvo) {
    try {
      cart = JSON.parse(cartSalvo);
      updateCartBadge();
    } catch (e) {
      cart = [];
    }
  }

  // Abre direto no Menu, sem verificar sessão
  showMenu();
};

async function fetchOrdersByPhone() {
  const phone = document.getElementById("search-phone").value;
  const container = document.getElementById("orders-list");

  if (!phone) {
    return Toast.fire({
      icon: "warning",
      title: "Campo obrigatório",
      text: "Digite um telefone para buscar.",
    });
  }

  container.innerHTML =
    '<p class="text-center text-gray-400 py-10">Buscando pedidos...</p>';

  try {
    const response = await fetch(
      `http://127.0.0.1:3000/pedidos/telefone/${phone}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) throw new Error("Não foi possível encontrar pedidos.");

    const orders = await response.json();
    renderOrders(orders);
  } catch (err) {
    container.innerHTML = `<p class="text-center text-red-500 py-10">${err.message}</p>`;
  }
}

function renderOrders(orders) {
  const container = document.getElementById("orders-list");

  if (!orders || orders.length === 0) {
    container.innerHTML =
      '<p class="text-center text-gray-400 py-10">Nenhum pedido encontrado.</p>';
    return;
  }

  // Número da loja (substitua pelo número real ou pegue da API se disponível)
  const storePhone = "5585991924340";

  container.innerHTML = orders
    .map((order) => {
      // Criar mensagem personalizada para o WhatsApp
      const msg = encodeURIComponent(
        `Olá! Gostaria de informações sobre o meu pedido ID: ${order.id}`,
      );
      const waLink = `https://wa.me/${storePhone}?text=${msg}`;

      return `
        <div class="border border-gray-200 rounded-xl p-4 shadow-sm bg-white">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ID: ${order.id}</span>
                    <h4 class="text-sm font-bold text-gray-800">${new Date(order.createdAt).toLocaleDateString("pt-BR")} às ${new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</h4>
                </div>
                <span class="px-2 py-1 rounded text-[10px] font-bold ${order.status === "PREPARING" ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}">
                    ${order.status}
                </span>
            </div>
            
            <div class="space-y-1 mb-3">
                ${order.itens
                  .map(
                    (item) => `
                    <div class="flex justify-between text-xs text-gray-600">
                        <span>${item.quantity}x ${item.name}</span>
                        <span>R$ ${item.totalPrice.toFixed(2)}</span>
                    </div>
                `,
                  )
                  .join("")}
            </div>

            <div class="border-t pt-3 flex justify-between items-center">
                <div class="flex flex-col">
                    <span class="text-xs font-semibold text-gray-500">Total</span>
                    <span class="text-sm font-bold text-gray-800">R$ ${order.pagamento.total.toFixed(2)}</span>
                </div>
                
                <a href="${waLink}" target="_blank" class="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-green-600 transition-colors">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.674 1.436 5.662 1.436h.008c6.548 0 11.88-5.335 11.883-11.892a11.785 11.785 0 00-3.488-8.412z"/></svg>
                    Suporte
                </a>
            </div>
        </div>
        `;
    })
    .reverse()
    .join("");
}

const foneInput = document.getElementById("client-phone");

foneInput.addEventListener("input", (e) => {
  let value = e.target.value;

  // 1. Remove tudo que não for número
  value = value.replace(/\D/g, "");

  // 2. Limita a 11 caracteres (padrão Brasil)
  if (value.length > 11) {
    value = value.slice(0, 11);
  }

  // 3. Aplica a máscara dinamicamente
  if (value.length > 10) {
    // Formato Celular: (XX) XXXXX-XXXX
    value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
  } else if (value.length > 6) {
    // Formato Fixo ou celular incompleto: (XX) XXXX-XXXX
    value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
  } else if (value.length > 2) {
    // Formato com DDD: (XX) XXXX
    value = value.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
  } else if (value.length > 0) {
    // Apenas o DDD: (XX
    value = value.replace(/^(\d{0,2})/, "($1");
  }

  e.target.value = value;
});

const searchphone = document.getElementById("search-phone");

searchphone.addEventListener("input", (e) => {
  let value = e.target.value;

  // 1. Remove tudo que não for número
  value = value.replace(/\D/g, "");

  // 2. Limita a 11 caracteres (padrão Brasil)
  if (value.length > 11) {
    value = value.slice(0, 11);
  }

  // 3. Aplica a máscara dinamicamente
  if (value.length > 10) {
    // Formato Celular: (XX) XXXXX-XXXX
    value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
  } else if (value.length > 6) {
    // Formato Fixo ou celular incompleto: (XX) XXXX-XXXX
    value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
  } else if (value.length > 2) {
    // Formato com DDD: (XX) XXXX
    value = value.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
  } else if (value.length > 0) {
    // Apenas o DDD: (XX
    value = value.replace(/^(\d{0,2})/, "($1");
  }

  e.target.value = value;
});

function openLegalModal(type) {
  const modal = document.getElementById("legalModal");
  const title = document.getElementById("modalTitle");
  const content = document.getElementById("modalContent");

  title.innerText = legalData[type].title;
  content.innerHTML = legalData[type].content;

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.style.overflow = "hidden"; // Trava o scroll da página
}

function closeLegalModal() {
  const modal = document.getElementById("legalModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  document.body.style.overflow = "auto"; // Destrava o scroll
}

// Conteúdos Detalhados e Blindados (LGPD / CDC / Fluxo de Automação)
const legalData = {
  termos: {
    title: "Termos de Uso e Fluxo do Pedido",
    content: `
        <h4 class="font-bold text-gray-800 mt-2">1. Objeto e Funcionamento do Sistema</h4>
        <p class="text-gray-600 text-xs">O PraFood atua como plataforma de intermediação tecnológica. Ao finalizar uma compra, seu pedido é primeiramente registrado de forma segura em nosso banco de dados e, em seguida, direcionado ao canal de atendimento (WhatsApp) do estabelecimento para validação.</p>
        
        <h4 class="font-bold text-gray-800 mt-3">2. Notificações e Atualizações de Status</h4>
        <p class="text-gray-600 text-xs">O usuário concorda em receber mensagens automáticas e notificações em seu WhatsApp informando sobre as atualizações do status do seu pedido (ex: "Em Preparo", "Saiu para Entrega", "Disponível para Retirada") disparadas pelo painel administrativo da empresa.</p>

        <h4 class="font-bold text-gray-800 mt-3">3. Responsabilidades</h4>
        <p class="text-gray-600 text-xs">O estabelecimento comercial é o único e exclusivo responsável pelo preparo, acondicionamento, qualidade, precificação e logística de entrega dos produtos. O usuário é inteiramente responsável por fornecer dados exatos de contato e endereço.</p>
        
        <h4 class="font-bold text-gray-800 mt-3">4. Política de Cancelamento (CDC)</h4>
        <p class="text-gray-600 text-xs">Em conformidade com o Código de Defesa do Consumidor, tratando-se de produtos perecíveis e de consumo imediato, o cancelamento ou alteração do pedido só poderá ser efetuado antes do início do preparo por parte da cozinha do estabelecimento.</p>
        
        <h4 class="font-bold text-gray-800 mt-3">5. Pagamentos e Taxas</h4>
        <p class="text-gray-600 text-xs">Todos os valores dos itens, bem como as taxas de entrega calculadas por bairro/região, são estipulados diretamente pelo restaurante. Eventuais divergências ou falhas de processamento devem ser comunicadas imediatamente ao canal de suporte do estabelecimento.</p>
      `,
  },
  privacidade: {
    title: "Política de Privacidade e Proteção de Dados (LGPD)",
    content: `
        <div class="mb-2 p-2 bg-red-50 rounded-xl border border-red-100">
          <h4 class="font-black text-red-600 uppercase text-[10px] flex items-center gap-1">
            <i class="fas fa-shield-alt"></i> 100% Em Conformidade com a LGPD (Lei nº 13.709/18)
          </h4>
        </div>
        
        <p class="text-gray-600 text-xs mb-2"><strong>Dados Coletados estritamente necessários (Princípio da Minimização):</strong> Nome completo, número de telefone celular/WhatsApp e endereço completo de entrega.</p>
        
        <h4 class="font-bold text-gray-800 mt-3">1. Finalidade do Tratamento de Dados</h4>
        <p class="text-gray-600 text-xs">Seus dados pessoais são utilizados unicamente para as seguintes finalidades operacionais: Registrar o pedido de forma auditável no banco de dados, gerar a autenticação da compra, emitir as informações necessárias para a entrega física e permitir que o painel da empresa envie alertas de status do pedido para o seu WhatsApp.</p>
        
        <h4 class="font-bold text-gray-800 mt-3">2. Compartilhamento estrito para Operação</h4>
        <p class="text-gray-600 text-xs">Para que seu pedido seja atendido, seus dados de identificação e endereço são compartilhados apenas com a equipe interna do restaurante (gestão e cozinha) e com o agente logístico encarregado (entregador/motoboy). É expressamente vedada a venda, cessão ou compartilhamento desses dados com terceiros para fins de marketing.</p>
        
        <h4 class="font-bold text-gray-800 mt-3">3. Armazenamento e Histórico de Consentimento</h4>
        <p class="text-gray-600 text-xs">No momento do checkout, o sistema captura de forma digital o seu aceite, registrando a data, a hora e as especificações do dispositivo (User Agent), garantindo segurança jurídica para ambas as partes. Os dados permanecem salvos em ambiente seguro para fins de cumprimento de obrigação legal e histórico de pedidos.</p>

        <h4 class="font-bold text-gray-800 mt-3">4. Direitos do Titular dos Dados</h4>
        <p class="text-gray-600 text-xs">Você possui o direito de confirmar a existência do tratamento, acessar seus dados ou solicitar a exclusão definitiva de suas informações da nossa base de dados a qualquer momento, bastando formalizar a requisição junto ao suporte do estabelecimento.</p>
      `,
  },
};

// 1. Monitora o método de pagamento selecionado
function handlePaymentChange() {
  const paymentMethod = document.getElementById("payment-method").value;
  const pixBox = document.getElementById("pix-info-box");

  if (paymentMethod === "PIX") {
    pixBox.classList.remove("hidden"); // Mostra os dados do Pix de forma limpa
  } else {
    pixBox.classList.add("hidden"); // Oculta se escolher cartão ou dinheiro
  }
}

// 2. Copia o número e altera o texto do botão temporariamente sem fechar o modal
function copySwalPix(buttonElement) {
  const keyElement = document.getElementById("swal-pix-key");

  if (!keyElement) {
    console.error("Elemento da chave Pix não encontrado no DOM.");
    return;
  }

  const keyText = keyElement.innerText.trim();

  navigator.clipboard
    .writeText(keyText)
    .then(() => {
      if (buttonElement) {
        const originalContent = buttonElement.innerHTML;

        // Desabilita temporariamente para evitar cliques duplos confusos
        buttonElement.disabled = true;
        buttonElement.style.backgroundColor = "#DEF7EC"; // Fundo verde claro
        buttonElement.style.borderColor = "#31C48D";
        buttonElement.innerHTML = `<i class="fas fa-check text-green-600"></i> <span class="text-green-800">Copiado com sucesso!</span>`;

        // Retorna o botão ao estado original após 2 segundos
        setTimeout(() => {
          buttonElement.style.backgroundColor = "";
          buttonElement.style.borderColor = "";
          buttonElement.innerHTML = originalContent;
          buttonElement.disabled = false;
        }, 2000);
      }
    })
    .catch((err) => {
      console.error("Erro ao copiar: ", err);
      // Fallback caso o navegador bloqueie a Clipboard API em contextos não-seguros (HTTP)
      const storage = document.createElement("textarea");
      storage.value = keyText;
      document.body.appendChild(storage);
      storage.select();
      document.execCommand("copy");
      document.body.removeChild(storage);

      if (buttonElement) {
        buttonElement.innerHTML = `<span>Chave copiada!</span>`;
        setTimeout(() => {
          buttonElement.innerHTML = originalContent;
        }, 2000);
      }
    });
}

// Inicializa a verificação caso o Pix venha selecionado por padrão na carga da página
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("payment-method")) {
    handlePaymentChange();
  }
});

// ==========================================
// CONFIGURAÇÃO DOS BAIRROS E CONFIGURAÇÃO DE SEGURANÇA
// ==========================================

// Lista oficial de bairros mantida de forma segura no código JS
const LISTA_BAIRROS = [
  { nome: "Vila Velha 1", taxa: 0.0 },
  { nome: "Vila Velha 2", taxa: 0.0 },
  { nome: "Vila Velha 3", taxa: 0.0 },
  { nome: "Vila Velha 4", taxa: 0.0 },
  { nome: "Jardim Guanabara", taxa: 0.0 },
  { nome: "Quintino Cunha", taxa: 0.0 },
  { nome: "Olavo Oliveira", taxa: 0.0 },
  { nome: "Jardim Iracema", taxa: 0.0 },
  // Adicione novos bairros aqui: { nome: "Nome", taxa: 0.00 }
];

// --- FUNÇÕES DE HIGIENIZAÇÃO E VALIDAÇÃO (ANTI-FRAUDE) ---

function higenizarTextoSeguro(texto) {
  const div = document.createElement("div");
  div.innerText = texto;
  return div.innerHTML;
}

function validarTaxaSegura(valor) {
  const taxa = parseFloat(valor);
  if (isNaN(taxa) || taxa < 0 || !isFinite(taxa)) {
    console.warn("Tentativa de manipulação de valor detectada.");
    return 0;
  }
  return taxa;
}

// --- LÓGICA DE INJEÇÃO E EVENTOS ---

// Armazena os bairros globalmente após puxar da API, mantendo a compatibilidade com a sua lógica de input
let listaBairrosDisponiveis = [];
const API_URLTAXAS = "http://127.0.0.1:3000/taxas"; // Sua URL corrigida do back-end

async function inicializarBairros() {
  const selectBairro = document.getElementById("address-neighborhood");
  const inputRua = document.getElementById("order-address");

  if (!selectBairro) return;

  try {
    // 1. Busca os bairros direto da sua nova API do banco de dados
    const response = await fetch(API_URLTAXAS);
    if (!response.ok) throw new Error("Falha ao carregar as taxas de entrega");

    const bairrosdoBanco = await response.json();

    // Filtra apenas os bairros que o administrador deixou ativos no painel
    listaBairrosDisponiveis = bairrosdoBanco.filter((b) => b.isActive);

    // 2. Monta as opções do Select dinamicamente
    let opcoesHTML = `<option value="" selected disabled>Selecione para usar taxa fixa...</option>`;

    listaBairrosDisponiveis.forEach((bairro) => {
      // Usamos uma higienização simples caso a função higenizarTextoSeguro não esteja no escopo
      const nomeSeguro =
        typeof higenizarTextoSeguro === "function"
          ? higenizarTextoSeguro(bairro.nome)
          : bairro.nome;

      const textoTaxa =
        bairro.taxa === 0 ? "Grátis" : `R$ ${bairro.taxa.toFixed(2)}`;

      // Guardamos o _id do Mongo no value e a taxa num atributo customizado 'data-taxa'
      opcoesHTML += `<option value="${bairro._id}" data-taxa="${bairro.taxa}">${nomeSeguro} - ${textoTaxa}</option>`;
    });

    selectBairro.innerHTML = opcoesHTML;
  } catch (error) {
    console.error("❌ Erro ao inicializar bairros da API:", error);
    selectBairro.innerHTML = `<option value="" disabled>Erro ao carregar bairros...</option>`;
    return; // Aborta o listener se a API falhar
  }

  // 🔥 PROTEÇÃO COMPLEMENTAR: Monitora a digitação do usuário em tempo real
  if (inputRua) {
    // Remove listeners antigos se a função for chamada mais de uma vez
    inputRua.removeEventListener("input", gerenciarDigitacaoRua);
    inputRua.addEventListener("input", gerenciarDigitacaoRua);
  }
}

/**
 * Isolamos a lógica do evento de input para manter o código limpo e assíncrono
 */
function gerenciarDigitacaoRua(e) {
  const selectBairro = document.getElementById("address-neighborhood");
  const valorAtual = e.target.value;
  const idBairro = selectBairro.value;

  // Se não tem bairro selecionado, o que ele digita é a própria rua pura
  if (idBairro === "") {
    e.target.setAttribute("data-rua-original", valorAtual);
    return;
  }

  // Busca o bairro correto no array global usando o ID do MongoDB
  const dadosBairro = listaBairrosDisponiveis.find((b) => b._id === idBairro);

  // Se ele apagar o texto todo manualmente com o bairro selecionado
  if (valorAtual === "") {
    e.target.setAttribute("data-rua-original", "");
    return;
  }

  // Se o texto digitado termina com o nome do bairro, isolamos a rua original
  if (dadosBairro && valorAtual.endsWith(dadosBairro.nome)) {
    let ruaIsolada = valorAtual.slice(0, -dadosBairro.nome.length);
    if (ruaIsolada.endsWith(", ")) ruaIsolada = ruaIsolada.slice(0, -2);
    else if (ruaIsolada.endsWith(",")) ruaIsolada = ruaIsolada.slice(0, -1);

    e.target.setAttribute("data-rua-original", ruaIsolada);
  } else {
    // Se ele quebrou a estrutura editando o meio do texto, consideramos o texto atual como a nova rua
    e.target.setAttribute("data-rua-original", valorAtual);
  }
}

// Executa assim que a página carregar
document.addEventListener("DOMContentLoaded", inicializarBairros);

// --- SELEÇÃO DE BAIRRO ---

// --- SELEÇÃO DE BAIRRO (VERSÃO API) ---

function selecionarTaxaPorBairro() {
  const selectBairro = document.getElementById("address-neighborhood");
  const infoText = document.getElementById("delivery-info");
  const inputRua = document.getElementById("order-address");

  if (!selectBairro || !inputRua) return;

  // Agora o valor é o _id do MongoDB (String) e não mais um índice numérico
  const idBairroSelecionado = selectBairro.value;

  // Se o "back-up" da rua original não existir no input, inicializa com o valor atual
  if (!inputRua.hasAttribute("data-rua-original")) {
    inputRua.setAttribute("data-rua-original", inputRua.value);
  }

  // Caso selecione a opção vazia/padrão (Limpar seleção)
  if (idBairroSelecionado === "") {
    taxaEntregaAtual = 0;
    if (infoText) infoText.innerText = "";

    // Restaura o que o usuário tinha digitado de rua e limpa o back-up
    inputRua.value = inputRua.getAttribute("data-rua-original") || "";
    inputRua.removeAttribute("data-rua-original");

    if (typeof renderCart === "function") renderCart();
    return;
  }

  // 🔥 MUDANÇA CHAVE: Busca o bairro na lista global usando o .find() pelo ID do banco
  const dadosBairro = listaBairrosDisponiveis.find(
    (b) => b._id === idBairroSelecionado,
  );

  if (dadosBairro) {
    // Garante que as suas funções de segurança continuem funcionando
    const taxaValidada =
      typeof validarTaxaSegura === "function"
        ? validarTaxaSegura(dadosBairro.taxa)
        : dadosBairro.taxa;
    const nomeSeguro =
      typeof higenizarTextoSeguro === "function"
        ? higenizarTextoSeguro(dadosBairro.nome)
        : dadosBairro.nome;

    taxaEntregaAtual = taxaValidada;

    // Exibição do texto informativo com a correção do IF/ELSE
    if (infoText) {
      if (taxaValidada === 0) {
        infoText.innerHTML = `🎉 Bairro: <b>${nomeSeguro}</b> | Taxa de Entrega: <b class="text-green-600">GRÁTIS (Aniversário do PratinhoPraTudo! 🎂)</b>`;
      } else {
        infoText.innerHTML = `🛵 Bairro: <b>${nomeSeguro}</b> | Taxa Fixa: <b class="text-red-600">R$ ${taxaValidada.toFixed(2)}</b>`;
      }
    }

    // Pega o texto puro da rua que está salvo no atributo oculto
    const ruaPura = (inputRua.getAttribute("data-rua-original") || "").trim();

    // Atualiza o valor visível do input: "Rua e Número, Bairro"
    if (ruaPura) {
      inputRua.value = `${ruaPura}, ${dadosBairro.nome}`;
    } else {
      inputRua.value = dadosBairro.nome;
    }

    // Recalcula o carrinho na tela
    if (typeof renderCart === "function") renderCart();
  }
}

// --- FUNÇÃO TOGGLE REESTRUTURADA (CORREÇÃO DO LOOP INFINITO) ---

function toggleAddressField() {
  const type = document.getElementById("order-type").value;

  const addrContainer = document.getElementById("order-address-container");
  const selectBairro = document.getElementById("address-neighborhood");
  const inputRua = document.getElementById("order-address");
  const infoText = document.getElementById("delivery-info");

  if (type === "DELIVERY") {
    if (addrContainer) addrContainer.style.display = "block";
  } else {
    if (addrContainer) addrContainer.style.display = "none";

    if (selectBairro) selectBairro.selectedIndex = 0;

    if (inputRua) {
      inputRua.value = "";
      inputRua.removeAttribute("data-rua-original"); // Remove o backup oculto
    }

    if (infoText) infoText.innerText = "";

    taxaEntregaAtual = 0;
    renderCart();
  }
}

function validarEstruturaEndereco(endereco) {
  // Esta Regex verifica se o texto tem: [Qualquer coisa] + [Vírgula] + [Número/S/N] + [Vírgula] + [Bairro]
  // Ela aceita números puros (123), blocos (Ap 402), ou "S/N" / "Sem Número"
  const regexEndereco =
    /^(.+),\s*([0-9]+|[0-9]+[a-zA-Z]*-?[0-9]*|s\/n|S\/N|sem número|Sem Número),\s*(.+)$/;

  return regexEndereco.test(endereco.trim());
}

document.addEventListener("DOMContentLoaded", () => {
  const paymentMethod = document.getElementById("payment-method");
  const changeContainer = document.getElementById("change-container");
  const changeInput = document.getElementById("change-amount");

  paymentMethod.addEventListener("change", (e) => {
    if (e.target.value === "DINHEIRO") {
      // Mostra o campo se for Dinheiro
      changeContainer.classList.remove("hidden");
    } else {
      // Esconde o campo e limpa o valor digitado se mudar de ideia
      changeContainer.classList.add("hidden");
      changeInput.value = "";
    }
  });
});

// ==========================================
// GLOBAIS DE CONTROLE DO CUPOM
// ==========================================
const API_BASE_COUPONS = "http://127.0.0.1:3000/cupom"; // Ajuste se necessário
let appliedCouponCode = null;
let computedDiscount = 0;

// ==========================================
// 1. ATUALIZAR TOTAIS COM DESCONTO (VERSÃO CORRIGIDA E ÚNICA)
// ==========================================
// Substitua a antiga atualizarTotaisComDesconto por esta:
function atualizarTotaisComDesconto(discount = 0) {
  // Atualiza o estado global do desconto obtido
  computedDiscount = parseFloat(discount) || 0;

  const textSubtotal = document.getElementById("cart-subtotal")
    ? document.getElementById("cart-subtotal").innerText
    : "R$ 0,00";

  // Limpa string R$ para obter float puro
  const subtotal =
    parseFloat(textSubtotal.replace(",", ".").replace(/[^\d.]/g, "")) || 0;

  // Executa o cálculo completo injetando os valores na tela
  recalcularTotalGeralCompleto(subtotal);

  // 🔥 SOLUÇÃO VISUAL: Força a linha da taxa de entrega a exibir "Grátis"
  if (
    appliedCouponCode === "FRETEGRATIS" ||
    appliedCouponCode === "QUEROFRETE"
  ) {
    taxaEntregaAtual = 0; // Garante que a variável interna seja zerada

    // Buscamos o elemento que exibe a taxa no resumo (o seu "cart-shipping")
    const elementoTaxa = document.getElementById("cart-shipping");
    if (elementoTaxa) {
      elementoTaxa.innerText = "Grátis";
    }
  }
}
// ==========================================
// 2. VALIDAÇÃO DO CUPOM
// ==========================================
// ==========================================
// 2. VALIDAÇÃO DO CUPOM (VERSÃO COM UX MELHORADA)
// ==========================================
async function validateCoupon() {
  const phoneInput = document.getElementById("client-phone").value.trim();
  const couponInput = document.getElementById("coupon-code");
  const codeInput = couponInput.value.toUpperCase().trim();
  const textSubtotal = document.getElementById("cart-subtotal")
    ? document.getElementById("cart-subtotal").innerText
    : "R$ 0.00";

  // Extrai o valor do subtotal mantendo o ponto original do JS
  const currentSubtotal =
    parseFloat(textSubtotal.replace(",", ".").replace(/[^\d.]/g, "")) || 0;

  if (!phoneInput) {
    showCouponMessage(
      "Digite seu WhatsApp primeiro na seção 'Seus Dados'.",
      "error",
    );
    document.getElementById("client-phone").focus();
    return;
  }

  if (!codeInput) {
    showCouponMessage("Por favor, insira o código do cupom.", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_COUPONS}/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: codeInput,
        purchaseValue: currentSubtotal,
        customerPhone: phoneInput,
      }),
    });

    const result = await response.json();

    if (response.ok && result.valid) {
      appliedCouponCode = result.code;
      computedDiscount = parseFloat(result.discountValue) || 0;

      // 🔥 NOVA REGRA: Se o código do cupom for de Frete Grátis
      if (
        appliedCouponCode === "FRETEGRATIS" ||
        appliedCouponCode === "QUEROFRETE"
      ) {
        taxaEntregaAtual = 0; // Zera a variável global da taxa de entrega
        computedDiscount = 0; // Zera o desconto em dinheiro para não acumular os dois

        // Atualiza visualmente o texto informativo do bairro (se houver)
        const infoText = document.getElementById("delivery-info");
        if (infoText) {
          infoText.innerHTML = `🛵 Cupom Aplicado: <b class="text-emerald-600">FRETE GRÁTIS ATIVADO!</b>`;
        }

        showCouponMessage(
          `Cupom de Frete Grátis aplicado com sucesso!`,
          "success",
        );
      } else {
        showCouponMessage(`Cupom ${result.code} aplicado!`, "success");
      }

      updateCouponUI(true, computedDiscount);
      atualizarTotaisComDesconto(computedDiscount);
    } else {
      // 💡 Se o backend recusar (ex: subtotal menor que o mínimo),
      // mostra o erro amigável retornado da API e preserva o texto no input
      showCouponMessage(
        result.error || "Cupom inválido para esta compra.",
        "error",
      );

      // Reseta os estados globais de desconto sem limpar o campo de texto
      appliedCouponCode = null;
      computedDiscount = 0;

      // Mantém a UI em modo "erro" (não bloqueia o input e não esconde o botão aplicar)
      updateCouponUI(false, 0);
      atualizarTotaisComDesconto(0);
    }
  } catch (error) {
    console.error("Erro na requisição do cupom:", error);
    showCouponMessage("Erro de conexão ao validar o cupom.", "error");
  }
}

// ==========================================
// 3. REMOÇÃO DO CUPOM
// ==========================================
function removeCoupon() {
  appliedCouponCode = null;
  computedDiscount = 0;
  document.getElementById("coupon-code").value = "";

  updateCouponUI(false, 0);
  hideCouponMessage();

  // 🔄 Restaura a taxa de entrega original chamando a função do bairro novamente
  const selectBairro = document.getElementById("address-neighborhood");
  if (selectBairro && selectBairro.value !== "") {
    selecionarTaxaPorBairro(); // Recalcula a taxa real do bairro dele
  } else {
    taxaEntregaAtual = 0;
    if (typeof renderCart === "function") renderCart();
  }

  // Recalcula os totais zerando o desconto do cupom
  atualizarTotaisComDesconto(0);
}

// ==========================================
// 4. SEGURANÇA SE MUDAR O WHATSAPP
// ==========================================
function resetCouponState() {
  if (appliedCouponCode) {
    removeCoupon();
    showCouponMessage(
      "WhatsApp alterado! Valide o cupom novamente.",
      "warning",
    );
  }
}

// ==========================================
// 5. PROCESSO DE CHECKOUT COM INTEGRAÇÃO (VERSÃO ATUALIZADA)
// ==========================================
async function processCheckout() {
  const phoneInput = document.getElementById("client-phone").value.trim();

  // 1. Captura o subtotal atual da tela para enviar como o valor bruto do pedido (orderValue)
  const textSubtotal = document.getElementById("cart-subtotal")
    ? document.getElementById("cart-subtotal").innerText
    : "R$ 0,00";
  const currentSubtotal =
    parseFloat(textSubtotal.replace(",", ".").replace(/[^\d.]/g, "")) || 0;

  if (appliedCouponCode) {
    try {
      // 2. Faz a requisição enviando as métricas financeiras exatamente como o backend espera
      const response = await fetch(`${API_BASE_COUPONS}/coupons/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: appliedCouponCode,
          customerPhone: phoneInput,
          orderValue: currentSubtotal, // 💰 Valor bruto enviado ao backend
          discountApplied: computedDiscount, // 💸 Desconto aplicado enviado ao backend
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        alert(
          "Erro com o cupom: " +
            (err.error || "Não foi possível aplicar o cupom."),
        );
        return;
      }
    } catch (e) {
      console.error("Erro ao aplicar cupom no checkout:", e);
      alert("Erro de conexão ao processar o cupom.");
      return;
    }
  }

  // Se passou pela aplicação do cupom (ou se não tinha cupom), segue para o checkout final
  if (typeof checkout === "function") {
    checkout();
  } else {
    alert("Pedido finalizado com sucesso!");
  }
}

// ==========================================
// INTERFACE E RENDER DO CARRINHO
// ==========================================
function updateCouponUI(hasCoupon, discountValue) {
  const input = document.getElementById("coupon-code");
  const icon = document.getElementById("coupon-success-icon");
  const btnApply = document.getElementById("btn-apply-coupon");
  const btnRemove = document.getElementById("btn-remove-coupon");
  const rowDiscount = document.getElementById("row-discount");
  const displayDiscount = document.getElementById("cart-discount");

  if (hasCoupon) {
    input.disabled = true;
    input.classList.add(
      "bg-emerald-50",
      "border-emerald-300",
      "text-emerald-800",
      "font-bold",
    );
    if (icon) icon.classList.remove("hidden");
    if (btnApply) btnApply.classList.add("hidden");
    if (btnRemove) btnRemove.classList.remove("hidden");
    if (rowDiscount) rowDiscount.classList.remove("hidden");
    if (displayDiscount)
      displayDiscount.innerText = `- R$ ${discountValue.toFixed(2).replace(".", ",")}`;
  } else {
    input.disabled = false;
    input.classList.remove(
      "bg-emerald-50",
      "border-emerald-300",
      "text-emerald-800",
      "font-bold",
    );
    if (icon) icon.classList.add("hidden");
    if (btnApply) btnApply.classList.remove("hidden");
    if (btnRemove) btnRemove.classList.add("hidden");
    if (rowDiscount) rowDiscount.classList.add("hidden");
  }
}

function showCouponMessage(text, type) {
  const msg = document.getElementById("coupon-message");
  if (!msg) return;
  msg.innerText = text;
  msg.classList.remove(
    "hidden",
    "text-red-500",
    "text-emerald-600",
    "text-amber-500",
  );

  if (type === "error") msg.classList.add("text-red-500");
  if (type === "success") msg.classList.add("text-emerald-600");
  if (type === "warning") msg.classList.add("text-amber-500");
}

function hideCouponMessage() {
  const msg = document.getElementById("coupon-message");
  if (msg) msg.classList.add("hidden");
}

function removeFromCart(id) {
  cart = cart.filter((i) => i.cartId !== id);
  if (cart.length === 0) {
    localStorage.removeItem("cart");
  } else {
    localStorage.setItem("cart", JSON.stringify(cart));
  }
  if (typeof updateCartBadge === "function") updateCartBadge();
  renderCart();
}

// ==========================================
// MODAL DE CUPONS DISPONÍVEIS
// ==========================================
async function openAvailableCouponsModal() {
  const listContainer = document.getElementById("available-coupons-list");
  document.getElementById("modal-available-coupons").classList.remove("hidden");

  listContainer.innerHTML = `
    <div class="text-center py-6 text-gray-400">
      <i class="fas fa-spinner fa-spin text-xl mb-2 block"></i> Buscando os melhores descontos...
    </div>`;

  try {
    const response = await fetch(`${API_BASE_COUPONS}/admin/coupons`);
    if (!response.ok) throw new Error();

    const coupons = await response.json();

    const activeCoupons = coupons.filter((c) => {
      const isExpired = new Date() > new Date(c.expirationDate);
      return c.isActive && !isExpired;
    });

    if (activeCoupons.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-6 text-gray-500 text-sm">
          <i class="fa-solid fa-face-frown text-xl text-gray-300 mb-2 block"></i> Nenhum cupom ativo disponível no momento.
        </div>`;
      return;
    }

    listContainer.innerHTML = "";
    activeCoupons.forEach((coupon) => {
      const labelDesconto =
        coupon.type === "percentage"
          ? `${coupon.value}% OFF`
          : `R$ ${coupon.value.toFixed(2).replace(".", ",")} de Desconto`;
      const regraMinimo =
        coupon.minPurchaseValue > 0
          ? `Válido para compras acima de R$ ${coupon.minPurchaseValue.toFixed(2).replace(".", ",")}`
          : "Sem valor mínimo de compra";
      const regraLimite =
        coupon.limitPerPhone > 1
          ? `Limite de ${coupon.limitPerPhone} usos por WhatsApp`
          : "Válido para 1 uso por WhatsApp";

      const div = document.createElement("div");
      div.className =
        "bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-center justify-between gap-3 hover:border-red-100 transition-colors";
      div.innerHTML = `
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="bg-red-50 text-[#ea1d2c] font-mono font-black text-xs px-2.5 py-1 rounded-lg border border-red-100 tracking-wider">
              ${coupon.code}
            </span>
            <span class="text-xs font-bold text-gray-900">${labelDesconto}</span>
          </div>
          <p class="text-[11px] text-gray-500 font-medium">${regraMinimo} • ${regraLimite}</p>
        </div>
        <button type="button" onclick="selectCouponFromModal('${coupon.code}')" class="bg-[#ea1d2c] hover:bg-[#d91a29] text-white text-[11px] font-bold px-3 py-2 rounded-xl transition active:scale-95 shadow-sm">
          Pegar
        </button>`;
      listContainer.appendChild(div);
    });
  } catch (error) {
    listContainer.innerHTML = `
      <div class="text-center py-6 text-red-500 text-xs font-semibold">
        <i class="fas fa-exclamation-triangle text-lg mb-1 block"></i> Erro ao carregar cupons.
      </div>`;
  }
}

function closeAvailableCouponsModal() {
  document.getElementById("modal-available-coupons").classList.add("hidden");
}

function selectCouponFromModal(code) {
  document.getElementById("coupon-code").value = code;
  closeAvailableCouponsModal();
  validateCoupon();
}

// ==========================================
// REVALIDAÇÃO AUTOMÁTICA DO CUPOM AO ALTERAR O CARRINHO
// ==========================================
// ==========================================
// REVALIDAÇÃO AUTOMÁTICA DO CUPOM AO ALTERAR O CARRINHO (CORRIGIDA)
// ==========================================
async function revalidarCupomAtivo(novoSubtotal) {
  // Se não tem cupom aplicado, não precisa fazer nada
  if (!appliedCouponCode) return;

  const phoneInput = document.getElementById("client-phone").value.trim();

  // Se o usuário tirou itens e o carrinho ficou zerado, remove o cupom direto
  if (novoSubtotal === 0) {
    removeCoupon();
    return;
  }

  try {
    const response = await fetch(`${API_BASE_COUPONS}/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: appliedCouponCode,
        purchaseValue: novoSubtotal,
        customerPhone: phoneInput || "00000000000",
      }),
    });

    const result = await response.json();

    // Se a API disser que NÃO é mais válido
    if (!response.ok || !result.valid) {
      removeCoupon(); // Limpa as variáveis globais e esconde a linha de desconto

      // TRATAMENTO DE ERRO SEGURO:
      // 1. Prioriza a mensagem amigável que a própria API já devolve (ex: result.error)
      // 2. Se a API mandar o valor numérico em outro formato (ex: result.minValue), trata aqui
      // 3. Se tudo falhar, usa um texto genérico elegante.
      let mensagemErro =
        "Cupom removido: o valor mínimo da compra não foi atingido.";

      if (result.error) {
        mensagemErro = result.error; // Usa o texto exato do seu backend (Ex: "Subtotal menor que o mínimo de R$ 50,00")
      } else if (result.minPurchaseValue) {
        mensagemErro = `Cupom removido: o valor mínimo desta compra é R$ ${parseFloat(result.minPurchaseValue).toFixed(2).replace(".", ",")}`;
      }

      showCouponMessage(mensagemErro, "error");
    } else {
      // Se continuar válido, garante que o desconto está atualizado no estado global
      computedDiscount = parseFloat(result.discountValue) || 0;
      updateCouponUI(true, computedDiscount);
    }
  } catch (error) {
    console.error("Erro ao revalidar cupom automaticamente:", error);
  }
}
