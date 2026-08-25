const API_BASE_URL = "http://127.0.0.1:3000/cupom/admin/coupons";

let allCoupons = [];
let currentCategory = "all";
let currentSlideIndex = 0;
let carouselInterval = null;

document.addEventListener("DOMContentLoaded", fetchCouponsForClients);

async function fetchCouponsForClients() {
  try {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) throw new Error();

    const data = await response.json();

    // Filtra apenas cupons utilizáveis (Ativos, Não Expirados, Com Estoque Global)
    allCoupons = data.filter((coupon) => {
      const isExpired = new Date() > new Date(coupon.expirationDate);
      const hasRemainingUses = coupon.usageLimit
        ? coupon.usageCount < coupon.usageLimit
        : true;
      return coupon.isActive && !isExpired && hasRemainingUses;
    });

    // Constrói os Banners e depois a Listagem inferior
    buildDynamicCarousel(allCoupons);
    filterAndRenderAll();
  } catch (error) {
    console.error(error);
    document.getElementById("carousel-wrapper").innerHTML = `
            <div class="h-full bg-red-950 flex flex-col justify-center items-center text-red-200 px-6 text-center">
              <i class="fa-solid fa-triangle-exclamation text-3xl mb-2"></i>
              <p class="font-bold text-sm">Instabilidade temporária na conexão com a cozinha de dados.</p>
            </div>`;
  }
}

// --- 1. CONSTRUÇÃO DO CARROSSEL BASEADO NOS CUPONS DA API ---
// --- 1. CONSTRUÇÃO DO CARROSSEL 100% DINÂMICO, TEMÁTICO E COM IMAGENS REAIS ---
function buildDynamicCarousel(activeCoupons) {
  const wrapper = document.getElementById("carousel-wrapper");
  const dotsContainer = document.getElementById("carousel-dots");

  wrapper.innerHTML = "";
  dotsContainer.innerHTML = "";

  // Se não houver cupons ativos, exibe o banner institucional padrão
  if (activeCoupons.length === 0) {
    wrapper.innerHTML = `
            <div class="carousel-item active h-full bg-gradient-to-r from-red-700 to-[#ea1d2c] relative">
              <div class="relative max-w-5xl mx-auto px-8 h-full flex flex-col justify-center text-white space-y-2">
                <h2 class="text-3xl md:text-5xl font-[900] tracking-tight">Novidades deliciosas chegando!</h2>
                <p class="text-red-100 text-sm max-w-md">No momento nossos cupons estão esgotados, mas fique de olho nas nossas redes sociais.</p>
              </div>
            </div>`;
    return;
  }

  activeCoupons.forEach((coupon, index) => {
    const discountText =
      coupon.type === "percentage"
        ? `${coupon.value}% DE DESCONTO`
        : `R$ ${coupon.value.toFixed(2)} DE DESCONTO`;

    const isActiveClass = index === 0 ? "active" : "";
    const codeUpper = coupon.code.toUpperCase();

    // --- CONFIGURAÇÃO PADRÃO DO BANNER ---
    let bgGradientClass = "from-red-900 via-[#ea1d2c] to-red-700";
    let badgeColorClass = "bg-white/20 text-white";
    let iconHeader =
      '<i class="fa-solid fa-fire text-yellow-300"></i> OFERTA PRATINHO';
    // Imagem padrão de comida bonita caso não entre em nenhum tema comemorativo
    let bgImageUrl =
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80";

    // --- DETECTOR DE TEMAS INTELEGENTE (POR PALAVRA-CHAVE NO CÓDIGO) ---

    // 1. TEMA DIA DOS NAMORADOS / ROMÂNTICO
    if (
      codeUpper.includes("AMOR") ||
      codeUpper.includes("NAMORADOS") ||
      codeUpper.includes("LOVE") ||
      codeUpper.includes("MOZAO")
    ) {
      bgGradientClass = "from-rose-900 via-pink-700 to-rose-600";
      badgeColorClass = "bg-white/30 text-rose-100";
      iconHeader =
        '<i class="fa-solid fa-heart text-pink-300 animate-pulse"></i> ESPECIAL DIA DOS NAMORADOS';
      bgImageUrl =
        "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=1200&q=80"; // Imagem romântica/casal jantando
    }

    // 2. TEMA COPA DO MUNDO / FUTEBOL / BRASIL
    else if (
      codeUpper.includes("COPA") ||
      codeUpper.includes("HEXA") ||
      codeUpper.includes("BRASIL") ||
      codeUpper.includes("SELECAO")
    ) {
      bgGradientClass = "from-green-900 via-yellow-600 to-blue-900";
      badgeColorClass = "bg-yellow-400 text-green-950 font-black";
      iconHeader =
        '<i class="fa-solid fa-trophy text-yellow-300"></i> RUMO AO HEXA! COPA VIBES';
      bgImageUrl =
        "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80"; // Imagem de futebol/estádio/torcida
    }

    // 3. TEMA NATAL / FIM DE ANO
    else if (
      codeUpper.includes("NATAL") ||
      codeUpper.includes("NOEL") ||
      codeUpper.includes("FESTAS")
    ) {
      bgGradientClass = "from-red-950 via-emerald-800 to-red-900";
      badgeColorClass = "bg-amber-500 text-white font-bold";
      iconHeader =
        '<i class="fa-solid fa-gift text-amber-300"></i> PRESENTE DE NATAL';
      bgImageUrl =
        "https://images.unsplash.com/photo-1543589077-47d81606733f?auto=format&fit=crop&w=1200&q=80"; // Luzes de Natal/Mesa natalina
    }

    // 4. TEMA MADRUGADA / LANCHE DA NOITE
    else if (
      codeUpper.includes("CORUJA") ||
      codeUpper.includes("NOITE") ||
      codeUpper.includes("MADRUGA")
    ) {
      bgGradientClass = "from-slate-950 via-indigo-950 to-purple-950";
      badgeColorClass = "bg-indigo-500/50 text-indigo-200";
      iconHeader =
        '<i class="fa-solid fa-moon text-yellow-200"></i> CUPOM DA CORUJA';
      bgImageUrl =
        "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=1200&q=80"; // Pizza de noite/Madrugada
    }

    // 5. CASO NÃO SEJA TEMA, VERIFICA SE É UM CUPOM PREMIUM POR VALOR (Ouro)
    else if (
      coupon.value >= 25 ||
      (coupon.type === "percentage" && coupon.value >= 25)
    ) {
      bgGradientClass = "from-amber-700 via-yellow-600 to-amber-900";
      badgeColorClass = "bg-amber-950 text-yellow-300 font-extrabold";
      iconHeader =
        '<i class="fa-solid fa-crown text-yellow-300"></i> DESCONTO MASTER';
      bgImageUrl =
        "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80"; // Hambúrguer/Churrasco premium
    }

    // Criar elemento do slide injetando as imagens e gradientes correspondentes
    const slide = document.createElement("div");
    slide.className = `carousel-item ${isActiveClass} h-full bg-gradient-to-tr ${bgGradientClass} relative`;
    slide.innerHTML = `
            <div class="absolute inset-0 bg-cover bg-center mix-blend-multiply opacity-25" style="background-image: url('${bgImageUrl}');"></div>
            
            <div class="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:20px_20px] mix-blend-overlay"></div>
            
            <div class="relative max-w-5xl mx-auto px-8 md:px-12 h-full flex flex-col justify-center text-white space-y-3">
              <span class="${badgeColorClass} text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full w-max flex items-center gap-1.5 backdrop-blur-sm shadow-sm">
                ${iconHeader}
              </span>
              <h2 class="text-3xl md:text-5xl font-[900] tracking-tight leading-none text-white drop-shadow-md">
                Garanta <span class="text-yellow-300">${discountText}</span>
              </h2>
              <p class="text-gray-100/90 text-xs md:text-sm max-w-md font-medium drop-shadow">
                Válido para compras acima de R$ ${coupon.minPurchaseValue.toFixed(2)}. Aproveite esse momento especial!
              </p>
              
              <div class="flex items-center gap-2 pt-1 w-max">
                <div class="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-xl font-mono text-sm md:text-base font-black text-white tracking-widest shadow-inner">
                  ${coupon.code}
                </div>
                <button onclick="copyToClipboard('${coupon.code}', this)" class="bg-white text-gray-900 hover:bg-gray-100 font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow transform active:scale-95">
                  <i class="fa-solid fa-copy text-gray-500"></i> Copiar
                </button>
              </div>
            </div>`;
    wrapper.appendChild(slide);

    // Criar pontinho (dot) correspondente
    const dotOpacity = index === 0 ? "opacity-100" : "opacity-40";
    const dot = document.createElement("span");
    dot.className = `w-2 h-2 rounded-full bg-white ${dotOpacity} cursor-pointer transition-all`;
    dot.setAttribute("onclick", `goToSlide(${index})`);
    dotsContainer.appendChild(dot);
  });

  // Se houver mais de 1 cupom ativo, ativa os controles de setas e o autoplay
  if (activeCoupons.length > 1) {
    document.getElementById("carousel-controls").classList.remove("hidden");
    startCarouselAutoPlay();
  }
}

// --- INTERRUPTORES E MOVIMENTAÇÃO DO CARROSSEL ---
function startCarouselAutoPlay() {
  if (carouselInterval) clearInterval(carouselInterval);
  carouselInterval = setInterval(nextSlide, 6000); // Rotaciona a cada 6 segundos
}

function showSlide(index) {
  const slides = document.querySelectorAll(".carousel-item");
  const dots = document.querySelectorAll("#carousel-dots span");
  if (slides.length === 0) return;

  slides[currentSlideIndex].classList.remove("active");
  if (dots[currentSlideIndex])
    dots[currentSlideIndex].classList.replace("opacity-100", "opacity-40");

  currentSlideIndex = (index + slides.length) % slides.length;

  slides[currentSlideIndex].classList.add("active");
  if (dots[currentSlideIndex])
    dots[currentSlideIndex].classList.replace("opacity-40", "opacity-100");
}

function nextSlide() {
  showSlide(currentSlideIndex + 1);
}

function prevSlide() {
  showSlide(currentSlideIndex - 1);
  startCarouselAutoPlay(); // Reseta timer após clique manual
}

function goToSlide(index) {
  showSlide(index);
  startCarouselAutoPlay();
}

// --- 2. FILTRAGEM E EXIBIÇÃO NO GRID INFERIOR ---
function changeCategory(category, button) {
  currentCategory = category;
  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.className =
      "category-btn px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-gray-200 transition";
  });
  button.className =
    "category-btn px-4 py-2 bg-[#ea1d2c] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition";
  filterAndRenderAll();
}

function filterAndRenderAll() {
  const searchTerm = document
    .getElementById("search-input")
    .value.toUpperCase()
    .trim();
  let filtered = allCoupons;

  if (currentCategory !== "all") {
    filtered = filtered.filter((c) => c.type === currentCategory);
  }

  if (searchTerm) {
    filtered = filtered.filter((c) => c.code.includes(searchTerm));
  }

  renderCouponsGrid(filtered);
}

function renderCouponsGrid(couponsList) {
  const grid = document.getElementById("coupons-grid");
  grid.innerHTML = "";

  if (couponsList.length === 0) {
    grid.innerHTML = `
            <div class="col-span-full bg-white py-12 px-4 rounded-3xl border border-gray-100 shadow-sm text-center text-gray-400">
              <i class="fa-solid fa-face-frown text-3xl mb-2 block text-gray-300"></i>
              Nenhum cupom disponível na categoria ou termo selecionado.
            </div>`;
    return;
  }

  couponsList.forEach((coupon) => {
    const discountBadge =
      coupon.type === "percentage"
        ? `${coupon.value}% OFF`
        : `R$ ${coupon.value.toFixed(2)} OFF`;
    const dateFormatted = new Date(coupon.expirationDate).toLocaleDateString(
      "pt-BR",
      { timeZone: "UTC" },
    );

    const card = document.createElement("div");
    card.className =
      "bg-white rounded-2xl border-2 border-dashed border-gray-200 p-6 relative shadow-sm hover:shadow-md hover:border-[#ea1d2c] transition-all flex flex-col justify-between space-y-4 overflow-hidden";
    card.innerHTML = `
            <div class="flex justify-between items-start">
              <span class="bg-red-50 text-[#ea1d2c] text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg">
                ${discountBadge}
              </span>
              <span class="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                <i class="fa-regular fa-calendar"></i> Até ${dateFormatted}
              </span>
            </div>
            <div class="space-y-1">
              <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Código Promocional</h4>
              <div class="flex items-center justify-between bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-xl font-mono text-sm font-black text-indigo-700 tracking-wider">
                <span>${coupon.code}</span>
                <button onclick="copyToClipboard('${coupon.code}', this)" class="text-gray-400 hover:text-[#ea1d2c] transition p-1">
                  <i class="fa-solid fa-copy"></i>
                </button>
              </div>
            </div>
            <div class="text-[11px] text-gray-500 space-y-1 pt-2 border-t border-gray-100">
              <div class="flex items-center gap-1.5">
                <i class="fa-solid fa-circle-info text-gray-300 text-[10px]"></i>
                <span>Para compras acima de <strong>R$ ${coupon.minPurchaseValue.toFixed(2)}</strong></span>
              </div>
              ${
                coupon.maxDiscountValue
                  ? `
              <div class="flex items-center gap-1.5">
                <i class="fa-solid fa-circle-chevron-up text-gray-300 text-[10px]"></i>
                <span>Teto máximo de desconto: <strong>R$ ${coupon.maxDiscountValue.toFixed(2)}</strong></span>
              </div>`
                  : ""
              }
            </div>`;
    grid.appendChild(card);
  });
}

// Auxiliar para Cópia rápida
function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    const original = button.innerHTML;
    button.innerHTML = `<i class="fa-solid fa-check text-emerald-500"></i> Copiado!`;
    setTimeout(() => {
      button.innerHTML = original;
    }, 2000);
  });
}
