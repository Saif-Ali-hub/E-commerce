/**
 * MiniStore - Grand Festival Mega Sale Page Logic
 * Handles festive deal generation, heavy discount math, filtering,
 * countdown timer, coupon copying, cart & wishlist integration.
 */

const API_BASE_URL = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http'))
  ? `${window.location.origin}/api`
  : 'http://localhost:5000/api';

// State
let rawProducts = [];
let festiveProducts = [];
let filteredProducts = [];
let activeCategoryFilter = 'all';
let currentSearchQuery = '';
let currentSort = 'discount-desc';
let currentPage = 1;
const itemsPerPage = 12;

let wishlistProductIds = new Set();
let currentModalProduct = null;

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

// DOM Elements
const festiveSearchInput = document.getElementById('festive-search-input');
const festiveClearSearchBtn = document.getElementById('festive-clear-search-btn');
const festiveSortSelect = document.getElementById('festive-sort-select');
const festiveFilterTabs = document.getElementById('festive-filter-tabs');
const festiveItemsCountDisplay = document.getElementById('festive-items-count-display');
const festiveFilterSummary = document.getElementById('festive-filter-summary');
const festiveFilterSummaryText = document.getElementById('festive-filter-summary-text');
const festiveResetFilterBtn = document.getElementById('festive-reset-filter-btn');

const festiveLoadingState = document.getElementById('festive-loading-state');
const festiveErrorState = document.getElementById('festive-error-state');
const festiveErrorMessage = document.getElementById('festive-error-message');
const festiveRetryBtn = document.getElementById('festive-retry-btn');
const festiveEmptyState = document.getElementById('festive-empty-state');
const festiveEmptyResetBtn = document.getElementById('festive-empty-reset-btn');
const festiveProductsGrid = document.getElementById('festive-products-grid');

const festivePaginationContainer = document.getElementById('festive-pagination-container');
const festivePrevPageBtn = document.getElementById('festive-prev-page-btn');
const festiveNextPageBtn = document.getElementById('festive-next-page-btn');
const festivePaginationPages = document.getElementById('festive-pagination-pages');

// Navigation & Auth Elements
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeToggleIcon = document.getElementById('theme-toggle-icon');
const navCartBtn = document.getElementById('nav-cart-btn');
const cartNavBadge = document.getElementById('cart-nav-badge');
const navWishlistBtn = document.getElementById('nav-wishlist-btn');
const wishlistNavBadge = document.getElementById('wishlist-nav-badge');
const navLoginBtn = document.getElementById('nav-login-btn');
const navUserInfo = document.getElementById('nav-user-info');
const navUserName = document.getElementById('nav-user-name');
const navProfileTriggerBtn = document.getElementById('nav-profile-trigger-btn');
const profileDropdownMenu = document.getElementById('profile-dropdown-menu');
const navAvatarInitials = document.getElementById('nav-avatar-initials');
const navAvatarImg = document.getElementById('nav-avatar-img');
const dropdownAvatarInitials = document.getElementById('dropdown-avatar-initials');
const dropdownAvatarImg = document.getElementById('dropdown-avatar-img');
const dropdownUserName = document.getElementById('dropdown-user-name');
const dropdownUserEmail = document.getElementById('dropdown-user-email');
const dropdownUserRole = document.getElementById('dropdown-user-role');
const navLogoutBtn = document.getElementById('nav-logout-btn');
const dropdownProfileBtn = document.getElementById('dropdown-profile-btn');

// Shared Modals
const productModal = document.getElementById('product-modal');
const productModalCloseBtn = document.getElementById('modal-close-btn');
const productModalContent = document.getElementById('modal-content');
const productModalLoading = document.getElementById('modal-loading');
const productModalError = document.getElementById('modal-error');
const productModalBackBtn = document.getElementById('modal-error-back-btn');

const cartModal = document.getElementById('cart-modal');
const cartCloseBtn = document.getElementById('cart-close-btn');
const cartItemsCountBadge = document.getElementById('cart-items-count-badge');
const cartLoading = document.getElementById('cart-loading');
const cartUnauthState = document.getElementById('cart-unauth-state');
const cartEmptyState = document.getElementById('cart-empty-state');
const cartContent = document.getElementById('cart-content');
const cartItemsList = document.getElementById('cart-items-list');
const cartTotalAmount = document.getElementById('cart-total-amount');
const cartContinueBtn = document.getElementById('cart-continue-btn');
const cartLoginPromptBtn = document.getElementById('cart-login-prompt-btn');

const wishlistModal = document.getElementById('wishlist-modal');
const wishlistCloseBtn = document.getElementById('wishlist-close-btn');
const wishlistItemsCountBadge = document.getElementById('wishlist-items-count-badge');
const wishlistLoading = document.getElementById('wishlist-loading');
const wishlistUnauthState = document.getElementById('wishlist-unauth-state');
const wishlistEmptyState = document.getElementById('wishlist-empty-state');
const wishlistContent = document.getElementById('wishlist-content');
const wishlistItemsList = document.getElementById('wishlist-items-list');
const wishlistContinueBtn = document.getElementById('wishlist-continue-btn');
const wishlistBrowseMoreBtn = document.getElementById('wishlist-browse-more-btn');
const wishlistLoginPromptBtn = document.getElementById('wishlist-login-prompt-btn');

const authModal = document.getElementById('auth-modal');
const authCloseBtn = document.getElementById('auth-close-btn');
const tabLoginBtn = document.getElementById('tab-login-btn');
const tabRegisterBtn = document.getElementById('tab-register-btn');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authErrorAlert = document.getElementById('auth-error-alert');

const profileModal = document.getElementById('profile-modal');
const profileCloseBtn = document.getElementById('profile-close-btn');
const profileCloseActionBtn = document.getElementById('profile-close-action-btn');
const profileForm = document.getElementById('profile-form');
const profileNameInput = document.getElementById('profile-name-input');
const profileEmailInput = document.getElementById('profile-email-input');
const profilePhoneInput = document.getElementById('profile-phone-input');
const profileRoleBadge = document.getElementById('profile-role-badge');
const profileAlertError = document.getElementById('profile-alert-error');
const profileAlertSuccess = document.getElementById('profile-alert-success');
const profileSaveBtnText = document.getElementById('profile-save-btn-text');

const toastNotification = document.getElementById('toast-notification');
let toastTimeout = null;

// ============================================================
// Curated Festive Deals Catalog & Heavy Discount Rules
// (Only selected products receive festive discounts, NOT all products!)
// ============================================================

const FESTIVE_DEALS_CATALOG = {
  // Electronics
  'wireless mouse': { discountPct: 50, dealTag: '⚡ 50% OFF FESTIVE STEAL' },
  'mechanical gaming keyboard': { discountPct: 54, dealTag: '🔥 BLOCKBUSTER DEAL (54% OFF)' },
  'wireless noise-canceling headphones': { discountPct: 60, dealTag: '⚡ MEGA STEAL (60% OFF)' },
  'smart fitness watch': { discountPct: 52, dealTag: '🔥 BLOCKBUSTER DEAL (52% OFF)' },
  'waterproof bluetooth speaker': { discountPct: 50, dealTag: '🪔 FESTIVE SUPER DEAL (50% OFF)' },
  'wireless anc earbuds': { discountPct: 50, dealTag: '🪔 FESTIVE SUPER DEAL (50% OFF)' },
  '10,000mah magnetic power bank': { discountPct: 53, dealTag: '🔥 BLOCKBUSTER DEAL (53% OFF)' },
  'rgb gaming soundbar': { discountPct: 50, dealTag: '🪔 FESTIVE SUPER DEAL (50% OFF)' },
  'usb condenser microphone': { discountPct: 52, dealTag: '🔥 BLOCKBUSTER DEAL (52% OFF)' },

  // Computers
  'gaming laptop': { discountPct: 40, dealTag: '💻 FESTIVE SPECIAL (40% OFF)' },

  // Accessories
  'canvas laptop backpack': { discountPct: 60, dealTag: '⚡ MEGA STEAL (60% OFF)' },
  'polarized aviator sunglasses': { discountPct: 56, dealTag: '🔥 BLOCKBUSTER DEAL (56% OFF)' },
  'stainless steel mesh watch': { discountPct: 50, dealTag: '🪔 FESTIVE SUPER DEAL (50% OFF)' },
  'crossbody sling bag': { discountPct: 50, dealTag: '🪔 FESTIVE SUPER DEAL (50% OFF)' },
  'waxed canvas duffel bag': { discountPct: 52, dealTag: '🔥 BLOCKBUSTER DEAL (52% OFF)' },

  // Home
  'minimalist led desk lamp': { discountPct: 50, dealTag: '🪔 FESTIVE SUPER DEAL (50% OFF)' },
  'aromatherapy essential oil diffuser': { discountPct: 50, dealTag: '🪔 FESTIVE SUPER DEAL (50% OFF)' },
  'linen throw blanket': { discountPct: 50, dealTag: '🪔 FESTIVE SUPER DEAL (50% OFF)' },
  'rechargeable led table lamp': { discountPct: 50, dealTag: '🪔 FESTIVE SUPER DEAL (50% OFF)' },

  // Kitchen
  'electric gooseneck kettle': { discountPct: 44, dealTag: '🔥 BLOCKBUSTER DEAL (44% OFF)' },
  'borosilicate glass french press': { discountPct: 50, dealTag: '🪔 FESTIVE SUPER DEAL (50% OFF)' },
  'cast iron dutch oven': { discountPct: 44, dealTag: '🔥 BLOCKBUSTER DEAL (44% OFF)' },
  'non-stick frying pan': { discountPct: 46, dealTag: '🪔 FESTIVE SUPER DEAL (46% OFF)' },

  // Sports
  'insulated sports bottle 1l': { discountPct: 50, dealTag: '🪔 FESTIVE SUPER DEAL (50% OFF)' },
  'non-slip yoga mat': { discountPct: 50, dealTag: '🪔 FESTIVE SUPER DEAL (50% OFF)' },
  'high-density foam roller': { discountPct: 50, dealTag: '🪔 FESTIVE SUPER DEAL (50% OFF)' },
  'resistance bands (set of 5)': { discountPct: 50, dealTag: '🪔 FESTIVE SUPER DEAL (50% OFF)' }
};

function getFestiveDealInfo(product) {
  if (!product) return null;
  const nameKey = (product.name || '').trim().toLowerCase();

  for (const [key, rule] of Object.entries(FESTIVE_DEALS_CATALOG)) {
    if (nameKey === key || nameKey.includes(key) || key.includes(nameKey)) {
      return rule;
    }
  }

  // If product already has an explicit discountPrice set in the database that is less than regular price
  if (product.discountPrice && Number(product.discountPrice) < Number(product.price)) {
    const orig = Number(product.price);
    const disc = Number(product.discountPrice);
    const pct = Math.round(((orig - disc) / orig) * 100);
    return {
      discountPct: pct,
      festivePrice: disc,
      dealTag: `🔥 FESTIVE DEAL (${pct}% OFF)`
    };
  }

  // Not a festive discount product
  return null;
}

function enrichProductWithFestiveDeals(product) {
  const dealInfo = getFestiveDealInfo(product);
  // Only selected products receive festive discounts! Products not in the festive list return null
  if (!dealInfo) return null;

  // The regular catalog price (from homepage / database) is the original MRP
  const originalPrice = Math.max(99, Number(product.price) || 999);
  const discountPct = dealInfo.discountPct || 50;

  // Calculate genuine heavy discount price FROM regular homepage price
  let festivePrice = dealInfo.festivePrice;
  if (!festivePrice) {
    // Clean retail pricing ending in 9 (e.g. Wireless Mouse 999 at 50% discount -> 499)
    festivePrice = Math.round((originalPrice * (1 - (discountPct / 100))) / 10) * 10 - 1;
    if (festivePrice <= 0 || festivePrice >= originalPrice) {
      festivePrice = Math.floor(originalPrice * (1 - (discountPct / 100)));
    }
  }

  // Safeguard: Ensure festive deal price is strictly lower than original regular price
  if (festivePrice >= originalPrice) {
    festivePrice = Math.round(originalPrice * 0.5);
  }

  const savings = Math.max(0, originalPrice - festivePrice);
  const actualDiscountPct = Math.round((savings / originalPrice) * 100);

  const hash = String(product._id || product.name || 'deal').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const claimedPct = 72 + (hash % 24); // 72% to 95% claimed

  return {
    ...product,
    originalPrice,        // Struck-through original regular price (e.g. ₹999)
    festivePrice,         // Discounted festive deal price (e.g. ₹499)
    discountPct: actualDiscountPct,
    savings,
    claimedPct,
    dealTag: dealInfo.dealTag || `⚡ ${actualDiscountPct}% OFF`
  };
}

// ============================================================
// Data Fetching & Deal Processing
// ============================================================

async function fetchFestiveDeals() {
  hideAllStates();
  if (festiveLoadingState) festiveLoadingState.style.display = 'grid';

  try {
    const res = await fetch(`${API_BASE_URL}/products?all=true`);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

    const json = await res.json();
    rawProducts = (json.success && Array.isArray(json.data)) ? json.data : [];

    // ONLY keep products that have festive discounts!
    festiveProducts = rawProducts
      .map(enrichProductWithFestiveDeals)
      .filter(p => p !== null && p.stock > 0);

    // If stock check left too few, include all festive deal products regardless of stock
    if (festiveProducts.length === 0) {
      festiveProducts = rawProducts
        .map(enrichProductWithFestiveDeals)
        .filter(p => p !== null);
    }

    applyFiltersAndSort();
  } catch (err) {
    console.error('Failed to load festive deals:', err);
    showErrorState(err.message);
  }
}

// ============================================================
// Filtering, Sorting & View State Management
// ============================================================

function applyFiltersAndSort() {
  let list = [...festiveProducts];

  // Category / Tab filter
  if (activeCategoryFilter === 'mega-deals') {
    list = list.filter(p => p.discountPct >= 60);
  } else if (activeCategoryFilter !== 'all') {
    const filterCat = activeCategoryFilter.toLowerCase();
    list = list.filter(p => (p.category || '').toLowerCase().includes(filterCat));
  }

  // Search filter
  if (currentSearchQuery) {
    const q = currentSearchQuery.toLowerCase().trim();
    list = list.filter(p => {
      const name = (p.name || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || cat.includes(q);
    });
  }

  // Sorting
  switch (currentSort) {
    case 'discount-desc':
      list.sort((a, b) => b.discountPct - a.discountPct);
      break;
    case 'price-asc':
      list.sort((a, b) => a.festivePrice - b.festivePrice);
      break;
    case 'price-desc':
      list.sort((a, b) => b.festivePrice - a.festivePrice);
      break;
    case 'rating':
      list.sort((a, b) => (Number(b.averageRating) || 0) - (Number(a.averageRating) || 0));
      break;
    case 'featured':
    default:
      list.sort((a, b) => (b.savings || 0) - (a.savings || 0));
      break;
  }

  filteredProducts = list;
  currentPage = 1;

  // Update count display
  if (festiveItemsCountDisplay) {
    festiveItemsCountDisplay.textContent = `${filteredProducts.length} Heavy Discount Deals Live`;
  }

  // Filter summary row
  if (festiveFilterSummary && festiveFilterSummaryText) {
    if (currentSearchQuery || activeCategoryFilter !== 'all') {
      festiveFilterSummary.style.display = 'flex';
      const label = activeCategoryFilter === 'mega-deals' ? '60%+ Mega Deals' : (activeCategoryFilter !== 'all' ? activeCategoryFilter : '');
      const parts = [];
      if (label) parts.push(label);
      if (currentSearchQuery) parts.push(`"${currentSearchQuery}"`);
      festiveFilterSummaryText.textContent = `Showing: ${parts.join(' • ')} (${filteredProducts.length} deals)`;
    } else {
      festiveFilterSummary.style.display = 'none';
    }
  }

  renderProducts();
}

function hideAllStates() {
  if (festiveLoadingState) festiveLoadingState.style.display = 'none';
  if (festiveErrorState) festiveErrorState.style.display = 'none';
  if (festiveEmptyState) festiveEmptyState.style.display = 'none';
  if (festiveProductsGrid) festiveProductsGrid.style.display = 'none';
  if (festivePaginationContainer) festivePaginationContainer.style.display = 'none';
}

function showErrorState(msg) {
  hideAllStates();
  if (festiveErrorState) {
    festiveErrorState.style.display = 'flex';
    if (festiveErrorMessage) festiveErrorMessage.textContent = msg || 'Could not load festival deals.';
  }
}

function showEmptyState() {
  hideAllStates();
  if (festiveEmptyState) festiveEmptyState.style.display = 'flex';
}

function renderProducts() {
  if (!festiveProductsGrid) return;
  hideAllStates();

  if (filteredProducts.length === 0) {
    showEmptyState();
    return;
  }

  festiveProductsGrid.style.display = 'grid';
  festiveProductsGrid.innerHTML = '';

  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const pageItems = filteredProducts.slice(startIndex, endIndex);

  pageItems.forEach((product, idx) => {
    const card = createFestiveProductCard(product, idx);
    festiveProductsGrid.appendChild(card);
  });

  renderPaginationControls(totalItems, totalPages);
}

// ============================================================
// Festive Product Card Component Creation
// ============================================================

function createFestiveProductCard(product, index = 0) {
  const card = document.createElement('article');
  card.className = 'product-card festive-product-card';
  card.id = `festive-prod-${product._id}`;
  card.style.animationDelay = `${(index % 8) * 45}ms`;

  const isWishlisted = wishlistProductIds.has(String(product._id));
  const avgRating = Number(product.averageRating) || 0;
  const totalReviews = Number(product.totalReviews) || (product.reviews ? product.reviews.length : 0);
  const formattedDealPrice = currencyFormatter.format(product.festivePrice);
  const formattedOriginalPrice = currencyFormatter.format(product.originalPrice);
  const formattedSavings = currencyFormatter.format(product.savings);

  card.innerHTML = `
    <div class="card-media">
      <!-- Festive Corner Badge -->
      <div class="festive-deal-badge">
        <span class="badge-flame">🔥</span>
        <span>${product.discountPct}% OFF</span>
      </div>

      <span class="card-category">${escapeHtml(product.category)}</span>

      <button
        type="button"
        class="wishlist-heart-btn ${isWishlisted ? 'is-active' : ''}"
        data-id="${escapeHtml(product._id)}"
        aria-label="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}"
        title="${isWishlisted ? 'In Wishlist' : 'Add to Wishlist'}"
      >
        <span class="heart-icon">${isWishlisted ? '♥' : '♡'}</span>
      </button>

      <img
        src="${formatProductImageUrl(product.image)}"
        alt="${escapeHtml(product.name)}"
        class="card-image"
        loading="lazy"
        onerror="handleProductImageError(this, '${escapeHtml(product.image || '')}', '${escapeHtml(product.name || '')}')"
      />
    </div>

    <div class="card-body">
      <div class="festive-card-tag-row">
        <span class="festive-micro-tag">${escapeHtml(product.dealTag)}</span>
      </div>

      <h3 class="card-title">${escapeHtml(product.name)}</h3>

      <div class="card-rating-row" aria-label="Rating: ${avgRating.toFixed(1)} out of 5 stars">
        <span class="rating-stars-inline" style="font-size: 0.82rem;">${renderStars(avgRating || 4.5)}</span>
        <span class="card-rating-text">${(avgRating || 4.7).toFixed(1)}</span>
        <span class="card-rating-count">(${totalReviews || (24 + (index * 7))})</span>
      </div>

      <!-- Heavy Discount Price Breakdown -->
      <div class="festive-price-block">
        <div class="festive-price-row">
          <span class="festive-deal-price">${formattedDealPrice}</span>
          <span class="festive-original-price">${formattedOriginalPrice}</span>
        </div>
        <div class="festive-save-pill">
          <span>Save ${formattedSavings} (${product.discountPct}% OFF)</span>
        </div>
      </div>

      <!-- Claimed Urgency Progress Bar -->
      <div class="festive-claimed-box">
        <div class="claimed-text-row">
          <span class="claimed-label">⚡ ${product.claimedPct}% Claimed</span>
          <span class="claimed-status">Selling Fast</span>
        </div>
        <div class="claimed-track" role="progressbar" aria-valuenow="${product.claimedPct}" aria-valuemin="0" aria-valuemax="100">
          <div class="claimed-fill" style="width: ${product.claimedPct}%;"></div>
        </div>
      </div>

      <div class="card-actions">
        <button
          type="button"
          class="btn btn-primary btn-sm add-cart-btn festive-claim-btn"
          data-id="${escapeHtml(product._id)}"
          aria-label="Claim deal for ${escapeHtml(product.name)}"
        >
          <span>Claim Festive Deal</span>
          <span aria-hidden="true">🛒</span>
        </button>
      </div>
    </div>
  `;

  // Click card to open product details modal
  card.addEventListener('click', (e) => {
    if (e.target.closest('.wishlist-heart-btn') || e.target.closest('.add-cart-btn')) {
      return;
    }
    openFestiveProductModal(product);
  });

  return card;
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = (rating - full) >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '★' : '') + '☆'.repeat(empty);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatProductImageUrl(imagePath) {
  if (!imagePath) return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return cleanPath;
}

function handleProductImageError(imgEl, originalSrc, productName) {
  const fallbacks = [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80'
  ];
  imgEl.onerror = null;
  imgEl.src = fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ============================================================
// Pagination Controls
// ============================================================

function renderPaginationControls(totalItems, totalPages) {
  if (!festivePaginationContainer || !festivePaginationPages) return;

  if (totalPages <= 1) {
    festivePaginationContainer.style.display = 'none';
    return;
  }

  festivePaginationContainer.style.display = 'flex';
  festivePaginationPages.innerHTML = '';

  if (festivePrevPageBtn) festivePrevPageBtn.disabled = currentPage <= 1;
  if (festiveNextPageBtn) festiveNextPageBtn.disabled = currentPage >= totalPages;

  for (let i = 1; i <= totalPages; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.type = 'button';
    pageBtn.className = `pagination-btn pagination-page-btn ${i === currentPage ? 'is-active active' : ''}`;
    pageBtn.textContent = i;
    pageBtn.setAttribute('aria-label', `Page ${i}`);
    if (i === currentPage) pageBtn.setAttribute('aria-current', 'page');

    pageBtn.addEventListener('click', () => {
      currentPage = i;
      renderProducts();
      window.scrollTo({ top: festiveProductsGrid.offsetTop - 120, behavior: 'smooth' });
    });

    festivePaginationPages.appendChild(pageBtn);
  }
}

// ============================================================
// Product Details Modal
// ============================================================

function openFestiveProductModal(product) {
  if (!productModal) return;
  currentModalProduct = product;

  productModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  if (productModalLoading) productModalLoading.style.display = 'none';
  if (productModalError) productModalError.style.display = 'none';
  if (productModalContent) {
    productModalContent.style.display = 'block';

    const formattedDealPrice = currencyFormatter.format(product.festivePrice);
    const formattedOriginalPrice = currencyFormatter.format(product.originalPrice);
    const formattedSavings = currencyFormatter.format(product.savings);
    const isWishlisted = wishlistProductIds.has(String(product._id));

    productModalContent.innerHTML = `
      <div class="product-details-grid">
        <div class="product-details-media">
          <div class="festive-modal-deal-ribbon">🔥 ${product.discountPct}% FESTIVE DISCOUNT</div>
          <img
            src="${formatProductImageUrl(product.image)}"
            alt="${escapeHtml(product.name)}"
            class="product-details-img"
            onerror="handleProductImageError(this, '${escapeHtml(product.image || '')}', '${escapeHtml(product.name || '')}')"
          />
        </div>

        <div class="product-details-info">
          <div class="product-meta-row">
            <span class="card-category">${escapeHtml(product.category)}</span>
            <span class="stock-badge stock-badge-available">In Stock (${product.stock} left)</span>
          </div>

          <h2 class="product-details-title">${escapeHtml(product.name)}</h2>

          <div class="card-rating-row" style="margin-bottom: 14px;">
            <span class="rating-stars-inline">${renderStars(Number(product.averageRating) || 4.7)}</span>
            <span class="card-rating-text">${(Number(product.averageRating) || 4.7).toFixed(1)}</span>
            <span class="card-rating-count">(${product.totalReviews || 48} verified reviews)</span>
          </div>

          <!-- Festive Price Breakdown in Modal -->
          <div class="festive-modal-price-box">
            <div class="modal-price-row">
              <span class="festive-modal-deal-price">${formattedDealPrice}</span>
              <span class="festive-modal-original-price">${formattedOriginalPrice}</span>
            </div>
            <div class="festive-save-pill modal-save-pill">
              <span>Save ${formattedSavings} (${product.discountPct}% OFF Festive Price)</span>
            </div>
            <p class="modal-festive-coupon-note">🎟️ Apply coupon <strong>FESTIVE10</strong> for additional ₹200 savings at checkout!</p>
          </div>

          <p class="product-details-description">${escapeHtml(product.description || 'Verified authentic festival deal item. Handpicked for premium performance and endurance.')}</p>

          <div class="festive-modal-guarantees">
            <span class="guarantee-item">✓ 1-Year Manufacturer Warranty</span>
            <span class="guarantee-item">✓ 7-Day Easy Returns</span>
            <span class="guarantee-item">✓ Free Express Delivery</span>
          </div>

          <div class="product-details-actions">
            <button type="button" class="btn btn-primary btn-lg add-cart-btn" data-id="${escapeHtml(product._id)}" style="flex: 1;">
              <span>Add to Cart with Festive Discount</span>
              <span aria-hidden="true">🛒</span>
            </button>
            <button
              type="button"
              class="btn btn-secondary wishlist-heart-btn ${isWishlisted ? 'is-active' : ''}"
              data-id="${escapeHtml(product._id)}"
              aria-label="Wishlist item"
              title="Add to Wishlist"
            >
              <span>${isWishlisted ? '❤️ In Wishlist' : '♡ Wishlist'}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

function closeProductModal() {
  if (!productModal) return;
  productModal.style.display = 'none';
  document.body.style.overflow = '';
}

// ============================================================
// Cart Operations
// ============================================================

async function addToCart(productId) {
  const token = getAuthToken();
  if (!token) {
    showToast('Please log in to add items to your cart.');
    openAuthModal('login');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ productId, quantity: 1 })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add item to cart');

    const totalItems = (data.data?.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
    updateCartBadge(totalItems);
    localStorage.setItem('ministore_cart_count', String(totalItems));
    showToast('🎉 Festive deal added to your cart!');
  } catch (err) {
    showToast(err.message || 'Error updating cart');
  }
}

async function fetchCart() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && data.data) {
      const items = data.data.items || [];
      const count = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
      updateCartBadge(count);
      localStorage.setItem('ministore_cart_count', String(count));
    }
  } catch (e) {
    console.error('Cart fetch failed:', e);
  }
}

function openCartModal() {
  if (!cartModal) return;
  cartModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const token = getAuthToken();
  if (!token) {
    if (cartLoading) cartLoading.style.display = 'none';
    if (cartContent) cartContent.style.display = 'none';
    if (cartEmptyState) cartEmptyState.style.display = 'none';
    if (cartUnauthState) cartUnauthState.style.display = 'flex';
    return;
  }

  renderCartContent();
}

function closeCartModal() {
  if (!cartModal) return;
  cartModal.style.display = 'none';
  document.body.style.overflow = '';
}

async function renderCartContent() {
  const token = getAuthToken();
  if (!token) return;

  if (cartLoading) cartLoading.style.display = 'block';
  if (cartContent) cartContent.style.display = 'none';
  if (cartEmptyState) cartEmptyState.style.display = 'none';
  if (cartUnauthState) cartUnauthState.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (cartLoading) cartLoading.style.display = 'none';

    if (!res.ok || !data.success || !data.data || !data.data.items || data.data.items.length === 0) {
      if (cartEmptyState) cartEmptyState.style.display = 'flex';
      if (cartItemsCountBadge) cartItemsCountBadge.textContent = '0 items';
      updateCartBadge(0);
      return;
    }

    const items = data.data.items;
    const totalCount = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
    if (cartItemsCountBadge) cartItemsCountBadge.textContent = `${totalCount} ${totalCount === 1 ? 'item' : 'items'}`;
    updateCartBadge(totalCount);

    if (cartContent) cartContent.style.display = 'block';
    if (cartItemsList) {
      cartItemsList.innerHTML = '';
      items.forEach(item => {
        const prod = item.product || item.productId || item;
        const enriched = enrichProductWithFestiveDeals(prod);

        // Effective unit price with festive discount
        const effectivePrice = item.unitPrice !== undefined ? item.unitPrice : (item.price !== undefined ? item.price : (enriched ? enriched.festivePrice : (prod.price || 0)));
        const regularPrice = item.regularPrice || (enriched ? enriched.originalPrice : (prod.price || effectivePrice));
        const isDiscounted = item.isFestiveDiscount || (effectivePrice < regularPrice);
        const discountPct = enriched ? enriched.discountPct : (regularPrice > 0 ? Math.round(((regularPrice - effectivePrice) / regularPrice) * 100) : 0);
        const itemSubtotal = item.subtotal !== undefined ? item.subtotal : (effectivePrice * (item.quantity || 1));
        const prodId = prod._id || (typeof item.product === 'object' ? item.product._id : item.product);

        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item-card';
        itemEl.id = `cart-item-${prodId}`;
        itemEl.innerHTML = `
          <img
            src="${formatProductImageUrl(prod.image)}"
            alt="${escapeHtml(prod.name || 'Product')}"
            class="cart-item-thumb"
            style="width: 84px; height: 84px; object-fit: cover; border-radius: 8px;"
            onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=120&auto=format&fit=crop&q=80'"
          />
          <div class="cart-item-info">
            <span class="cart-item-category" style="font-size: 0.74rem; font-weight: 600; text-transform: uppercase; color: var(--color-text-muted);">${escapeHtml(prod.category || 'Deal')}</span>
            <h4 class="cart-item-name" style="font-size: 0.95rem; font-weight: 700; margin: 2px 0;">${escapeHtml(prod.name || 'Product')}</h4>
            <div class="cart-item-price-wrap" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 4px 0;">
              <span class="cart-item-unit-price" style="font-weight: 800; color: ${isDiscounted ? '#10b981' : 'var(--color-text-main)'}; font-size: 1rem;">${currencyFormatter.format(effectivePrice)} each</span>
              ${isDiscounted ? `<span style="text-decoration: line-through; color: var(--color-text-muted); font-size: 0.82rem;">${currencyFormatter.format(regularPrice)}</span>` : ''}
              ${isDiscounted ? `<span style="background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">${discountPct}% FESTIVE OFF</span>` : ''}
            </div>
            <div style="font-size: 0.78rem; color: var(--color-text-muted); margin-top: 2px;">
              Subtotal: <strong style="color: var(--color-text-main); font-weight: 700;">${currencyFormatter.format(itemSubtotal)}</strong> (${item.quantity || 1} × ${currencyFormatter.format(effectivePrice)})
            </div>
          </div>
          <div class="cart-item-actions" style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
            <span class="cart-item-subtotal" style="font-size: 1.15rem; font-weight: 800;">${currencyFormatter.format(itemSubtotal)}</span>
            <div class="qty-stepper">
              <button type="button" class="qty-btn btn-qty-dec" data-id="${escapeHtml(prodId)}" data-qty="${item.quantity || 1}" title="Decrease quantity">−</button>
              <span class="qty-value">${item.quantity || 1}</span>
              <button type="button" class="qty-btn btn-qty-inc" data-id="${escapeHtml(prodId)}" data-qty="${item.quantity || 1}" title="Increase quantity">+</button>
            </div>
            <button type="button" class="cart-item-remove-btn btn-remove-item" data-id="${escapeHtml(prodId)}" aria-label="Remove item" title="Remove item">
              🗑️ Remove
            </button>
          </div>
        `;
        cartItemsList.appendChild(itemEl);
      });
    }

    // Accurate calculation of total amount based on festive deal prices
    let calculatedTotal = 0;
    items.forEach(item => {
      const prod = item.product || item.productId || item;
      const enriched = enrichProductWithFestiveDeals(prod);
      const effectivePrice = item.unitPrice !== undefined ? item.unitPrice : (item.price !== undefined ? item.price : (enriched ? enriched.festivePrice : (prod.price || 0)));
      calculatedTotal += effectivePrice * (item.quantity || 1);
    });

    const displayTotal = calculatedTotal > 0 ? calculatedTotal : (data.data.totalAmount || 0);

    if (cartTotalAmount) {
      cartTotalAmount.textContent = currencyFormatter.format(displayTotal);
    }
  } catch (err) {
    if (cartLoading) cartLoading.style.display = 'none';
    if (cartEmptyState) cartEmptyState.style.display = 'flex';
  }
}

async function updateCartQty(productId, newQty) {
  const token = getAuthToken();
  if (!token) return;

  if (newQty <= 0) {
    return removeCartItem(productId);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/cart/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ quantity: newQty })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update quantity');
    renderCartContent();
  } catch (err) {
    showToast(err.message || 'Error updating quantity');
  }
}

async function removeCartItem(productId) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/cart/${productId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to remove item');
    showToast('Item removed from cart');
    renderCartContent();
  } catch (err) {
    showToast(err.message || 'Error removing item');
  }
}

// ============================================================
// Wishlist Operations
// ============================================================

async function toggleWishlist(productId) {
  const token = getAuthToken();
  if (!token) {
    showToast('Please log in to save items to your wishlist.');
    openAuthModal('login');
    return;
  }

  const idStr = String(productId);
  const isInWishlist = wishlistProductIds.has(idStr);
  const endpoint = isInWishlist ? `${API_BASE_URL}/wishlist/remove` : `${API_BASE_URL}/wishlist/add`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ productId })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Wishlist update failed');

    if (isInWishlist) {
      wishlistProductIds.delete(idStr);
      showToast('Removed from wishlist');
    } else {
      wishlistProductIds.add(idStr);
      showToast('❤️ Added to wishlist!');
    }

    localStorage.setItem('ministore_wishlist_ids', JSON.stringify([...wishlistProductIds]));
    updateWishlistBadge(wishlistProductIds.size);
    updateAllWishlistButtons();
  } catch (err) {
    showToast(err.message || 'Error updating wishlist');
  }
}

function updateAllWishlistButtons() {
  document.querySelectorAll('.wishlist-heart-btn').forEach(btn => {
    const id = btn.getAttribute('data-id');
    const isActive = wishlistProductIds.has(String(id));
    btn.classList.toggle('is-active', isActive);
    const heart = btn.querySelector('.heart-icon');
    if (heart) heart.textContent = isActive ? '♥' : '♡';
  });
}

async function fetchWishlist() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/wishlist`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && Array.isArray(data.data?.products)) {
      wishlistProductIds = new Set(data.data.products.map(p => String(p._id || p)));
      localStorage.setItem('ministore_wishlist_ids', JSON.stringify([...wishlistProductIds]));
      updateWishlistBadge(wishlistProductIds.size);
      updateAllWishlistButtons();
    }
  } catch (e) {
    console.error('Wishlist fetch error:', e);
  }
}

function openWishlistModal() {
  if (!wishlistModal) return;
  wishlistModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const token = getAuthToken();
  if (!token) {
    if (wishlistLoading) wishlistLoading.style.display = 'none';
    if (wishlistContent) wishlistContent.style.display = 'none';
    if (wishlistEmptyState) wishlistEmptyState.style.display = 'none';
    if (wishlistUnauthState) wishlistUnauthState.style.display = 'flex';
    return;
  }

  renderWishlistContent();
}

function closeWishlistModal() {
  if (!wishlistModal) return;
  wishlistModal.style.display = 'none';
  document.body.style.overflow = '';
}

async function renderWishlistContent() {
  const token = getAuthToken();
  if (!token) return;

  if (wishlistLoading) wishlistLoading.style.display = 'block';
  if (wishlistContent) wishlistContent.style.display = 'none';
  if (wishlistEmptyState) wishlistEmptyState.style.display = 'none';
  if (wishlistUnauthState) wishlistUnauthState.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE_URL}/wishlist`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (wishlistLoading) wishlistLoading.style.display = 'none';

    if (!res.ok || !data.success || !data.data || !data.data.products || data.data.products.length === 0) {
      if (wishlistEmptyState) wishlistEmptyState.style.display = 'flex';
      if (wishlistItemsCountBadge) wishlistItemsCountBadge.textContent = '0 items';
      updateWishlistBadge(0);
      return;
    }

    const products = data.data.products;
    if (wishlistItemsCountBadge) wishlistItemsCountBadge.textContent = `${products.length} ${products.length === 1 ? 'item' : 'items'}`;
    updateWishlistBadge(products.length);

    if (wishlistContent) wishlistContent.style.display = 'block';
    if (wishlistItemsList) {
      wishlistItemsList.innerHTML = '';
      products.forEach(prod => {
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        itemEl.innerHTML = `
          <img src="${formatProductImageUrl(prod.image)}" alt="${escapeHtml(prod.name)}" class="cart-item-img" />
          <div class="cart-item-info">
            <h4 class="cart-item-title">${escapeHtml(prod.name)}</h4>
            <div class="cart-item-price">${currencyFormatter.format(prod.price)}</div>
          </div>
          <button type="button" class="btn btn-primary btn-sm add-cart-btn" data-id="${escapeHtml(prod._id)}">Add to Cart</button>
          <button type="button" class="btn-remove-item wishlist-remove-btn" data-id="${escapeHtml(prod._id)}" aria-label="Remove from wishlist">✕</button>
        `;
        wishlistItemsList.appendChild(itemEl);
      });
    }
  } catch (err) {
    if (wishlistLoading) wishlistLoading.style.display = 'none';
    if (wishlistEmptyState) wishlistEmptyState.style.display = 'flex';
  }
}

// ============================================================
// Auth & User Profile Functions
// ============================================================

function getAuthToken() {
  return localStorage.getItem('token');
}

function getAuthUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function updateAuthUI() {
  const token = getAuthToken();
  const user = getAuthUser();

  if (token && user) {
    if (navLoginBtn) navLoginBtn.style.display = 'none';
    if (navUserInfo) navUserInfo.style.display = 'flex';
    if (navUserName) navUserName.textContent = user.name || 'User';

    const initials = (user.name || 'U').charAt(0).toUpperCase();
    if (navAvatarInitials) navAvatarInitials.textContent = initials;
    if (dropdownAvatarInitials) dropdownAvatarInitials.textContent = initials;
    if (dropdownUserName) dropdownUserName.textContent = user.name || 'User';
    if (dropdownUserEmail) dropdownUserEmail.textContent = user.email || '';
    if (dropdownUserRole) {
      dropdownUserRole.textContent = user.role === 'admin' ? 'Administrator' : 'Customer';
    }

    const savedCartCount = parseInt(localStorage.getItem('ministore_cart_count') || '0', 10);
    updateCartBadge(savedCartCount);

    try {
      const savedWishlistIds = JSON.parse(localStorage.getItem('ministore_wishlist_ids') || '[]');
      if (Array.isArray(savedWishlistIds)) {
        wishlistProductIds = new Set(savedWishlistIds.map(String));
      }
    } catch (e) {
      wishlistProductIds = new Set();
    }
    updateWishlistBadge(wishlistProductIds.size);
  } else {
    closeProfileDropdown();
    if (navLoginBtn) navLoginBtn.style.display = 'inline-flex';
    if (navUserInfo) navUserInfo.style.display = 'none';
    if (navUserName) navUserName.textContent = '';
    updateCartBadge(0);
    updateWishlistBadge(0);
  }
}

function updateCartBadge(count) {
  if (cartNavBadge) {
    cartNavBadge.textContent = count;
    cartNavBadge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

function updateWishlistBadge(count) {
  if (wishlistNavBadge) {
    wishlistNavBadge.textContent = count;
    wishlistNavBadge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

function toggleProfileDropdown() {
  if (!profileDropdownMenu) return;
  const isHidden = profileDropdownMenu.style.display === 'none' || !profileDropdownMenu.style.display;
  profileDropdownMenu.style.display = isHidden ? 'block' : 'none';
  if (navProfileTriggerBtn) {
    navProfileTriggerBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  }
}

function closeProfileDropdown() {
  if (profileDropdownMenu) profileDropdownMenu.style.display = 'none';
  if (navProfileTriggerBtn) navProfileTriggerBtn.setAttribute('aria-expanded', 'false');
}

function openAuthModal(tab = 'login') {
  if (!authModal) return;
  authModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  if (authErrorAlert) authErrorAlert.style.display = 'none';
  switchAuthTab(tab);
}

function closeAuthModal() {
  if (!authModal) return;
  authModal.style.display = 'none';
  document.body.style.overflow = '';
}

function switchAuthTab(tab) {
  if (tab === 'login') {
    if (tabLoginBtn) tabLoginBtn.classList.add('active');
    if (tabRegisterBtn) tabRegisterBtn.classList.remove('active');
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
  } else {
    if (tabLoginBtn) tabLoginBtn.classList.remove('active');
    if (tabRegisterBtn) tabRegisterBtn.classList.add('active');
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
  }
}

function openProfileModal() {
  closeProfileDropdown();
  const user = getAuthUser();
  if (!user) {
    openAuthModal('login');
    return;
  }
  if (!profileModal) return;

  if (profileNameInput) profileNameInput.value = user.name || '';
  if (profileEmailInput) profileEmailInput.value = user.email || '';
  if (profilePhoneInput) profilePhoneInput.value = user.phone || '';
  if (profileRoleBadge) profileRoleBadge.textContent = user.role === 'admin' ? 'Administrator' : 'Customer';

  if (profileAlertError) profileAlertError.style.display = 'none';
  if (profileAlertSuccess) profileAlertSuccess.style.display = 'none';

  profileModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeProfileModal() {
  if (!profileModal) return;
  profileModal.style.display = 'none';
  document.body.style.overflow = '';
}

function handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('ministore_cart_count');
  localStorage.removeItem('ministore_wishlist_ids');
  updateAuthUI();
  showToast('Logged out successfully');
}

// ============================================================
// Toast Notification
// ============================================================

function showToast(msg) {
  if (!toastNotification) return;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastNotification.textContent = msg;
  toastNotification.style.display = 'block';
  toastNotification.classList.add('show');

  toastTimeout = setTimeout(() => {
    toastNotification.classList.remove('show');
    setTimeout(() => {
      toastNotification.style.display = 'none';
    }, 300);
  }, 3500);
}

// ============================================================
// Countdown Timer & Coupon Code Handling
// ============================================================

function initFestiveCountdown() {
  const dEl = document.getElementById('festive-hero-days');
  const hEl = document.getElementById('festive-hero-hours');
  const mEl = document.getElementById('festive-hero-minutes');
  const sEl = document.getElementById('festive-hero-seconds');
  const copyBtn = document.getElementById('btn-copy-ticket');

  let targetTime = localStorage.getItem('ministore_festive_end_time');
  if (!targetTime || isNaN(Number(targetTime)) || Number(targetTime) <= Date.now()) {
    targetTime = Date.now() + (2 * 24 * 60 * 60 * 1000) + (14 * 60 * 60 * 1000) + (38 * 60 * 1000);
    localStorage.setItem('ministore_festive_end_time', String(targetTime));
  } else {
    targetTime = Number(targetTime);
  }

  function update() {
    const now = Date.now();
    let diff = Math.max(0, targetTime - now);

    if (diff <= 0) {
      targetTime = Date.now() + (48 * 60 * 60 * 1000);
      localStorage.setItem('ministore_festive_end_time', String(targetTime));
      diff = targetTime - now;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    if (dEl) dEl.textContent = String(d).padStart(2, '0');
    if (hEl) hEl.textContent = String(h).padStart(2, '0');
    if (mEl) mEl.textContent = String(m).padStart(2, '0');
    if (sEl) sEl.textContent = String(s).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const code = 'FESTIVE10';
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(code);
        } else {
          const ta = document.createElement('textarea');
          ta.value = code;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        copyBtn.classList.add('copied');
        const copyLabel = copyBtn.querySelector('.copy-label');
        if (copyLabel) copyLabel.textContent = '✓ Copied!';
        showToast('🎉 Coupon code FESTIVE10 copied! Flat ₹200 OFF at checkout.');
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          if (copyLabel) copyLabel.textContent = 'Copy Code';
        }, 3000);
      } catch (err) {
        showToast('Coupon code: FESTIVE10');
      }
    });
  }
}

// ============================================================
// Theme Toggle
// ============================================================

function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);
  showToast(next === 'dark' ? 'Dark mode enabled 🌙' : 'Light mode enabled ☀️');
}

function updateThemeIcon(theme) {
  if (themeToggleIcon) {
    themeToggleIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

// ============================================================
// Event Listeners Initialization
// ============================================================

function initEventListeners() {
  // Theme Toggle
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  // Profile Dropdown
  if (navProfileTriggerBtn) {
    navProfileTriggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProfileDropdown();
    });
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#nav-user-info')) {
      closeProfileDropdown();
    }
  });

  if (dropdownProfileBtn) dropdownProfileBtn.addEventListener('click', openProfileModal);
  if (profileCloseBtn) profileCloseBtn.addEventListener('click', closeProfileModal);
  if (profileCloseActionBtn) profileCloseActionBtn.addEventListener('click', closeProfileModal);
  if (navLogoutBtn) navLogoutBtn.addEventListener('click', handleLogout);

  // Auth Modals
  if (navLoginBtn) navLoginBtn.addEventListener('click', () => openAuthModal('login'));
  if (authCloseBtn) authCloseBtn.addEventListener('click', closeAuthModal);
  if (tabLoginBtn) tabLoginBtn.addEventListener('click', () => switchAuthTab('login'));
  if (tabRegisterBtn) tabRegisterBtn.addEventListener('click', () => switchAuthTab('register'));

  // Login Form Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email')?.value?.trim();
      const password = document.getElementById('login-password')?.value;
      if (authErrorAlert) authErrorAlert.style.display = 'none';

      try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Login failed');

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        closeAuthModal();
        updateAuthUI();
        fetchWishlist();
        fetchCart();
        showToast(`Welcome back, ${data.user.name}! 🪔`);
      } catch (err) {
        if (authErrorAlert) {
          authErrorAlert.textContent = err.message;
          authErrorAlert.style.display = 'block';
        }
      }
    });
  }

  // Register Form Submission
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name')?.value?.trim();
      const email = document.getElementById('reg-email')?.value?.trim();
      const password = document.getElementById('reg-password')?.value;
      if (authErrorAlert) authErrorAlert.style.display = 'none';

      try {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Registration failed');

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        closeAuthModal();
        updateAuthUI();
        showToast(`Account created! Welcome, ${data.user.name}! 🎉`);
      } catch (err) {
        if (authErrorAlert) {
          authErrorAlert.textContent = err.message;
          authErrorAlert.style.display = 'block';
        }
      }
    });
  }

  // Cart Modal
  if (navCartBtn) navCartBtn.addEventListener('click', openCartModal);
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCartModal);
  if (cartContinueBtn) cartContinueBtn.addEventListener('click', closeCartModal);
  if (cartLoginPromptBtn) cartLoginPromptBtn.addEventListener('click', () => { closeCartModal(); openAuthModal('login'); });

  // Wishlist Modal
  if (navWishlistBtn) navWishlistBtn.addEventListener('click', openWishlistModal);
  if (wishlistCloseBtn) wishlistCloseBtn.addEventListener('click', closeWishlistModal);
  if (wishlistContinueBtn) wishlistContinueBtn.addEventListener('click', closeWishlistModal);
  if (wishlistBrowseMoreBtn) wishlistBrowseMoreBtn.addEventListener('click', closeWishlistModal);
  if (wishlistLoginPromptBtn) wishlistLoginPromptBtn.addEventListener('click', () => { closeWishlistModal(); openAuthModal('login'); });

  // Product Modal
  if (productModalCloseBtn) productModalCloseBtn.addEventListener('click', closeProductModal);
  if (productModalBackBtn) productModalBackBtn.addEventListener('click', closeProductModal);

  // Global Click delegation for Add-to-Cart and Wishlist
  document.addEventListener('click', (e) => {
    // Add to Cart Click
    const addCartBtn = e.target.closest('.add-cart-btn');
    if (addCartBtn) {
      e.stopPropagation();
      const id = addCartBtn.getAttribute('data-id');
      if (id) addToCart(id);
      return;
    }

    // Wishlist Toggle Click
    const wishlistBtn = e.target.closest('.wishlist-heart-btn');
    if (wishlistBtn) {
      e.stopPropagation();
      const id = wishlistBtn.getAttribute('data-id');
      if (id) toggleWishlist(id);
      return;
    }

    // Cart Quantity Increase/Decrease/Remove
    const qtyIncBtn = e.target.closest('.btn-qty-inc');
    if (qtyIncBtn) {
      e.stopPropagation();
      const id = qtyIncBtn.getAttribute('data-id');
      const currentQty = parseInt(qtyIncBtn.getAttribute('data-qty'), 10) || 1;
      if (id) updateCartQty(id, currentQty + 1);
      return;
    }

    const qtyDecBtn = e.target.closest('.btn-qty-dec');
    if (qtyDecBtn) {
      e.stopPropagation();
      const id = qtyDecBtn.getAttribute('data-id');
      const currentQty = parseInt(qtyDecBtn.getAttribute('data-qty'), 10) || 1;
      if (id) updateCartQty(id, currentQty - 1);
      return;
    }

    const removeBtn = e.target.closest('.btn-remove-item');
    if (removeBtn) {
      e.stopPropagation();
      const id = removeBtn.getAttribute('data-id');
      if (id) removeCartItem(id);
      return;
    }
  });

  // Filter Tabs
  if (festiveFilterTabs) {
    festiveFilterTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.festive-tab');
      if (!tab) return;
      document.querySelectorAll('.festive-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeCategoryFilter = tab.getAttribute('data-filter') || 'all';
      applyFiltersAndSort();
    });
  }

  // Live Search Input
  if (festiveSearchInput) {
    festiveSearchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.trim();
      if (festiveClearSearchBtn) {
        festiveClearSearchBtn.style.display = currentSearchQuery ? 'inline-flex' : 'none';
      }
      applyFiltersAndSort();
    });
  }

  if (festiveClearSearchBtn) {
    festiveClearSearchBtn.addEventListener('click', () => {
      if (festiveSearchInput) festiveSearchInput.value = '';
      currentSearchQuery = '';
      festiveClearSearchBtn.style.display = 'none';
      applyFiltersAndSort();
    });
  }

  if (festiveResetFilterBtn) {
    festiveResetFilterBtn.addEventListener('click', () => {
      if (festiveSearchInput) festiveSearchInput.value = '';
      currentSearchQuery = '';
      activeCategoryFilter = 'all';
      document.querySelectorAll('.festive-tab').forEach((t, i) => {
        t.classList.toggle('active', i === 0);
        t.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      });
      applyFiltersAndSort();
    });
  }

  if (festiveEmptyResetBtn) {
    festiveEmptyResetBtn.addEventListener('click', () => {
      if (festiveSearchInput) festiveSearchInput.value = '';
      currentSearchQuery = '';
      activeCategoryFilter = 'all';
      document.querySelectorAll('.festive-tab').forEach((t, i) => {
        t.classList.toggle('active', i === 0);
        t.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      });
      applyFiltersAndSort();
    });
  }

  // Sort Select Dropdown
  if (festiveSortSelect) {
    festiveSortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      applyFiltersAndSort();
    });
  }

  // Pagination Next & Prev
  if (festivePrevPageBtn) {
    festivePrevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderProducts();
        window.scrollTo({ top: festiveProductsGrid.offsetTop - 120, behavior: 'smooth' });
      }
    });
  }

  if (festiveNextPageBtn) {
    festiveNextPageBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderProducts();
        window.scrollTo({ top: festiveProductsGrid.offsetTop - 120, behavior: 'smooth' });
      }
    });
  }

  if (festiveRetryBtn) {
    festiveRetryBtn.addEventListener('click', fetchFestiveDeals);
  }
}

// ============================================================
// Festive Live Countdown Timer & Coupon Code Handler
// ============================================================

function initFestiveCountdown() {
  const daysEl = document.getElementById('festive-hero-days');
  const hoursEl = document.getElementById('festive-hero-hours');
  const minsEl = document.getElementById('festive-hero-minutes');
  const secsEl = document.getElementById('festive-hero-seconds');
  const copyBtn = document.getElementById('btn-copy-ticket');

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const code = 'FESTIVE10';
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(code);
        } else {
          const ta = document.createElement('textarea');
          ta.value = code;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        copyBtn.classList.add('is-copied');
        copyBtn.innerHTML = '<span class="copy-label">Copied! ✓</span>';
        showToast('Coupon code FESTIVE10 copied to clipboard! Extra ₹200 OFF applied at checkout 🪔', 'success');
        setTimeout(() => {
          copyBtn.classList.remove('is-copied');
          copyBtn.innerHTML = '<span class="copy-label">Copy Code</span>';
        }, 3000);
      } catch (err) {
        showToast('Use coupon code FESTIVE10 at checkout for Extra ₹200 OFF!', 'info');
      }
    });
  }

  if (!daysEl || !hoursEl || !minsEl || !secsEl) return;

  let targetTime = Date.now() + (48 * 3600 * 1000);
  let isSaleLive = true;

  fetch(`${API_BASE_URL}/sales/current`)
    .then(r => r.json())
    .then(res => {
      if (res && res.success && res.data) {
        const sale = res.data;
        isSaleLive = Boolean(sale.isLive);
        if (sale.endDate) {
          targetTime = new Date(sale.endDate).getTime();
        }
        if (!isSaleLive) {
          const heroSubtitle = document.querySelector('.festive-hero-subtitle');
          if (heroSubtitle) {
            heroSubtitle.innerHTML = '<span style="color:#ef4444; font-weight:800;">🛑 CAMPAIGN CONCLUDED:</span> The festive discount window has ended by store administration. Current items reflect standard catalog pricing.';
          }
          const badgeEl = document.querySelector('.festive-tag-badge');
          if (badgeEl) {
            badgeEl.textContent = 'SALE ENDED';
            badgeEl.style.background = '#ef4444';
          }
        }
      }
    })
    .catch(() => {});

  function updateTimer() {
    const remaining = Math.max(0, targetTime - Date.now());

    if (!isSaleLive || remaining <= 0) {
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minsEl.textContent = '00';
      secsEl.textContent = '00';
      return;
    }

    const totalSecs = Math.floor(remaining / 1000);
    const d = Math.floor(totalSecs / 86400);
    const h = Math.floor((totalSecs % 86400) / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;

    daysEl.textContent = String(d).padStart(2, '0');
    hoursEl.textContent = String(h).padStart(2, '0');
    minsEl.textContent = String(m).padStart(2, '0');
    secsEl.textContent = String(s).padStart(2, '0');
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

function readUrlParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('filter') || params.get('category');
    if (filterParam) {
      activeCategoryFilter = filterParam;
      document.querySelectorAll('.festive-tab').forEach(t => {
        const tabFilter = t.getAttribute('data-filter') || '';
        const isMatch = tabFilter.toLowerCase() === filterParam.toLowerCase();
        t.classList.toggle('active', isMatch);
        t.setAttribute('aria-selected', isMatch ? 'true' : 'false');
      });
    }
    const searchParam = params.get('search') || params.get('q');
    if (searchParam && festiveSearchInput) {
      currentSearchQuery = searchParam;
      festiveSearchInput.value = searchParam;
      if (festiveClearSearchBtn) festiveClearSearchBtn.style.display = 'inline-flex';
    }
  } catch (e) {
    // ignore
  }
}

// Initial Boot
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  updateAuthUI();
  initFestiveCountdown();
  if (typeof window.initFestiveFirecrackers === 'function') {
    window.initFestiveFirecrackers('festive-page-firecrackers-canvas', 'festive-page-hero');
  }
  initEventListeners();
  readUrlParams();
  fetchFestiveDeals();
});

