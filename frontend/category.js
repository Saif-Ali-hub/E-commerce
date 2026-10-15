/**
 * MiniStore - Dedicated Category Page Logic
 * Renders all products belonging to a specific category dynamically from MongoDB.
 * Preserves search, sorting, pagination, cart, wishlist, and product detail navigation.
 */

const API_BASE_URL = 'http://localhost:5000/api';
const FALLBACK_IMAGE_URL = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22600%22%20height%3D%22600%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20600%22%3E%3Crect%20fill%3D%22%23f3f4f6%22%20width%3D%22600%22%20height%3D%22600%22%2F%3E%3Cpath%20d%3D%22M250%20220a40%2040%200%201%200%2080%200%2040%2040%200%201%200-80%200zm-70%20180h240l-75-100-55%2070-35-45-75%2075z%22%20fill%3D%22%239ca3af%22%2F%3E%3Ctext%20fill%3D%22%236b7280%22%20font-family%3D%22sans-serif%22%20font-size%3D%2220%22%20font-weight%3D%22600%22%20x%3D%2250%25%22%20y%3D%2272%25%22%20text-anchor%3D%22middle%22%3EProduct%20Image%3C%2Ftext%3E%3C%2Fsvg%3E';

// Category metadata definitions
const CATEGORY_META = {
  'electronics': { icon: '⚡', tint: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.3)', subtitle: 'Audio, gadgets, smart electronics & cutting-edge tech' },
  'computers': { icon: '💻', tint: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)', subtitle: 'High-performance laptops, PCs, monitors & computing peripherals' },
  'accessories': { icon: '🎧', tint: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)', subtitle: 'Cables, cases, chargers, bags & everyday tech accessories' },
  'home': { icon: '🏠', tint: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', subtitle: 'Home essentials, smart decor, lighting & living comforts' },
  'kitchen': { icon: '🍳', tint: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', subtitle: 'Culinary tools, cookware, appliances & kitchen essentials' },
  'sports': { icon: '⚽', tint: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.3)', subtitle: 'Athletic footwear, training equipment & outdoor sports gear' }
};

function getCategoryMeta(catName) {
  if (!catName) return { icon: '📦', tint: 'rgba(107, 114, 128, 0.12)', border: 'rgba(107, 114, 128, 0.3)', subtitle: 'Explore quality products with best pricing' };
  const key = catName.trim().toLowerCase();
  return CATEGORY_META[key] || {
    icon: '📦',
    tint: 'rgba(107, 114, 128, 0.12)',
    border: 'rgba(107, 114, 128, 0.3)',
    subtitle: `Explore authentic ${catName} products with best pricing and fast delivery`
  };
}

// INR Currency Formatter
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

// State
let rawCategoryProducts = [];
let displayedProducts = [];
let currentCategoryName = '';
let availableCategories = [];
let currentPage = 1;
const itemsPerPage = 12;
let totalProductsCount = 0;
let currentSort = 'featured';
let inCategoryQuery = '';
let currentMinPrice = '';
let currentMaxPrice = '';
let currentRating = '';
let currentInStock = false;
let currentFacets = {
  minPrice: 0,
  maxPrice: 0,
  inStockCount: 0,
  scopeMinPrice: 0,
  scopeMaxPrice: 0
};

let wishlistProductIds = new Set();
let currentCart = null;

// DOM Elements
const categoryBreadcrumbCurrent = document.getElementById('category-breadcrumb-current');
const categoryPageIconBadge = document.getElementById('category-page-icon-badge');
const categoryPageTitle = document.getElementById('category-page-title');
const categoryProductCount = document.getElementById('category-product-count');
const categoryPageSubtitle = document.getElementById('category-page-subtitle');
const categoryQuickLinks = document.getElementById('category-quick-links');

const categoryFilterSearch = document.getElementById('category-filter-search');
const categoryClearFilterBtn = document.getElementById('category-clear-filter-btn');
const categorySortSelect = document.getElementById('category-sort-select');
const categoryItemsCountDisplay = document.getElementById('category-items-count-display');
const categoryFilterSummary = document.getElementById('category-filter-summary');
const categoryFilterSummaryText = document.getElementById('category-filter-summary-text');
const categoryResetFilterBtn = document.getElementById('category-reset-filter-btn');

const categoryLoadingState = document.getElementById('category-loading-state');
const categoryErrorState = document.getElementById('category-error-state');
const categoryErrorMessage = document.getElementById('category-error-message');
const categoryRetryBtn = document.getElementById('category-retry-btn');
const categoryEmptyState = document.getElementById('category-empty-state');
const categoryEmptyMessage = document.getElementById('category-empty-message');
const categoryEmptyResetBtn = document.getElementById('category-empty-reset-btn');
const categoryProductsGrid = document.getElementById('category-products-grid');

const categoryPaginationContainer = document.getElementById('category-pagination-container');
const categoryPrevPageBtn = document.getElementById('category-prev-page-btn');
const categoryNextPageBtn = document.getElementById('category-next-page-btn');
const categoryPaginationPages = document.getElementById('category-pagination-pages');

// Faceted Filter DOM Elements
const filterMinPriceInput = document.getElementById('filter-min-price');
const filterMaxPriceInput = document.getElementById('filter-max-price');
const filterPriceApplyBtn = document.getElementById('filter-price-apply-btn');
const filterInStockCheckbox = document.getElementById('filter-in-stock-checkbox');
const filterInStockBadge = document.getElementById('filter-in-stock-badge');
const filterPriceScopeHint = document.getElementById('filter-price-scope-hint');
const filterClearAllBtn = document.getElementById('filter-clear-all-btn');
const btnClearActiveFilters = document.getElementById('btn-clear-active-filters');
const categoryActiveFiltersBar = document.getElementById('category-active-filters-bar');
const activeFiltersPills = document.getElementById('active-filters-pills');
const mobileFilterTriggerBtn = document.getElementById('mobile-filter-trigger-btn');
const mobileFilterActiveCount = document.getElementById('mobile-filter-active-count');
const filterDrawerCloseBtn = document.getElementById('filter-drawer-close-btn');
const filterDrawerBackdrop = document.getElementById('filter-drawer-backdrop');
const filterDrawerApplyBtn = document.getElementById('filter-drawer-apply-btn');
const categoryFilterSidebar = document.getElementById('category-filter-sidebar');
const filterCategoriesList = document.getElementById('filter-categories-list');

// Navigation & Modals
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

// Top Navbar Search Bar
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const searchSubmitBtn = document.getElementById('search-submit-btn');
const searchSuggestionsDropdown = document.getElementById('search-suggestions-dropdown');

// Shared Modals
const cartModal = document.getElementById('cart-modal');
const cartCloseBtn = document.getElementById('cart-close-btn');
const cartItemsCountBadge = document.getElementById('cart-items-count-badge');
const cartLoading = document.getElementById('cart-loading');
const cartUnauthState = document.getElementById('cart-unauth-state');
const cartEmptyState = document.getElementById('cart-empty-state');
const cartContent = document.getElementById('cart-content');
const cartItemsList = document.getElementById('cart-items-list');
const cartTotalAmount = document.getElementById('cart-total-amount');
const cartCheckoutBtn = document.getElementById('cart-checkout-btn');
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
const wishlistLoginPromptBtn = document.getElementById('wishlist-login-prompt-btn');
const wishlistContinueBtn = document.getElementById('wishlist-continue-btn');
const wishlistBrowseMoreBtn = document.getElementById('wishlist-browse-more-btn');

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
const profileAlertError = document.getElementById('profile-alert-error');
const profileAlertSuccess = document.getElementById('profile-alert-success');
const toastNotification = document.getElementById('toast-notification');

// ============================================================
// Helpers & Utilities
// ============================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatProductImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return FALLBACK_IMAGE_URL;
  }
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/images/')) return `http://localhost:5000${trimmed}`;
  if (trimmed.startsWith('images/')) return `http://localhost:5000/${trimmed}`;
  return `http://localhost:5000/images/${trimmed}`;
}

function handleProductImageError(imgEl, originalUrl, productName) {
  if (!imgEl) return;
  imgEl.onerror = null;
  imgEl.src = FALLBACK_IMAGE_URL;
}

function renderStars(rating) {
  const rounded = Math.round((Number(rating) || 0) * 2) / 2;
  let starsHtml = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= rounded) {
      starsHtml += '<span class="star-filled" style="color: #f59e0b;">★</span>';
    } else if (i - 0.5 === rounded) {
      starsHtml += '<span class="star-half" style="color: #f59e0b;">★</span>';
    } else {
      starsHtml += '<span class="star-empty" style="color: #d1d5db;">☆</span>';
    }
  }
  return starsHtml;
}

function getStockInfo(stock) {
  const s = Number(stock) || 0;
  if (s <= 0) return { label: 'Out of Stock', className: 'stock-out' };
  if (s <= 5) return { label: `Only ${s} left!`, className: 'stock-low' };
  return { label: 'In Stock', className: 'stock-in' };
}

function showToast(message, duration = 3000) {
  if (!toastNotification) return;
  toastNotification.textContent = message;
  toastNotification.style.display = 'block';
  toastNotification.classList.remove('fade-out');
  toastNotification.classList.add('show');

  setTimeout(() => {
    toastNotification.classList.remove('show');
    toastNotification.classList.add('fade-out');
    setTimeout(() => {
      toastNotification.style.display = 'none';
      toastNotification.classList.remove('fade-out');
    }, 300);
  }, duration);
}

// ============================================================
// Theme Management
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
// Auth & User State
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
      if (user.role === 'admin') {
        dropdownUserRole.textContent = 'Administrator';
      } else if (user.role === 'seller') {
        dropdownUserRole.textContent = 'Seller Account';
      } else {
        dropdownUserRole.textContent = 'Customer';
      }
    }

    const navAdminBtn = document.getElementById('nav-admin-btn');
    const navSellerBtn = document.getElementById('nav-seller-btn');
    if (navAdminBtn) {
      navAdminBtn.style.display = user.role === 'admin' ? 'inline-flex' : 'none';
    }
    if (navSellerBtn) {
      const isSeller = user.role === 'seller';
      const isAdmin = user.role === 'admin';
      const isPending = (user.sellerDetails && user.sellerDetails.verificationStatus === 'pending') || user.sellerStatus === 'pending' || user.verificationStatus === 'pending';
      navSellerBtn.style.display = (isSeller || isAdmin) ? 'inline-flex' : 'none';

      const titleEl = navSellerBtn.querySelector('.dropdown-item-title');
      const descEl = navSellerBtn.querySelector('.dropdown-item-desc');
      if (titleEl) {
        titleEl.textContent = 'Merchant Dashboard';
      }
      if (descEl) {
        if (isSeller && isPending) {
          descEl.innerHTML = '<span class="badge-verification badge-pending" style="display: inline-block; padding: 1px 6px; font-size: 0.72rem; margin-top: 2px;">⏳ Pending Review</span>';
        } else {
          descEl.textContent = 'Manage products, orders & payouts';
        }
      }
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
    const navAdminBtn = document.getElementById('nav-admin-btn');
    const navSellerBtn = document.getElementById('nav-seller-btn');
    if (navAdminBtn) navAdminBtn.style.display = 'none';
    if (navSellerBtn) navSellerBtn.style.display = 'none';
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

function openAuthModal(tab = 'login', msg = '') {
  if (!authModal) return;
  closeProfileDropdown();
  authModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  if (authErrorAlert) {
    if (msg) {
      authErrorAlert.textContent = msg;
      authErrorAlert.style.display = 'block';
    } else {
      authErrorAlert.style.display = 'none';
    }
  }

  if (tab === 'login') {
    tabLoginBtn?.classList.add('active');
    tabRegisterBtn?.classList.remove('active');
    if (loginForm) loginForm.style.display = 'flex';
    if (registerForm) registerForm.style.display = 'none';
  } else {
    tabRegisterBtn?.classList.add('active');
    tabLoginBtn?.classList.remove('active');
    if (registerForm) registerForm.style.display = 'flex';
    if (loginForm) loginForm.style.display = 'none';
  }
}

function closeAuthModal() {
  if (!authModal) return;
  authModal.style.display = 'none';
  document.body.style.overflow = '';
}

function logoutUser() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('ministore_cart_count');
  localStorage.removeItem('ministore_wishlist_ids');
  wishlistProductIds.clear();
  currentCart = null;
  updateAuthUI();
  renderProducts();
  showToast('You have been signed out.');
}

// ============================================================
// URL Query Parameter Sync & Filter State
// ============================================================

function readFiltersFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('category') || urlParams.get('name') || '';
  if (catParam) currentCategoryName = catParam.trim();

  currentMinPrice = urlParams.get('minPrice') || '';
  currentMaxPrice = urlParams.get('maxPrice') || '';
  currentRating = urlParams.get('rating') || '';
  currentInStock = urlParams.get('inStock') === 'true';
  currentSort = urlParams.get('sortBy') || urlParams.get('sort') || 'featured';
  inCategoryQuery = urlParams.get('search') || urlParams.get('q') || '';
  const p = parseInt(urlParams.get('page') || '1', 10);
  currentPage = (!isNaN(p) && p > 0) ? p : 1;
}

function syncFiltersToURL(pushHistory = false) {
  const params = new URLSearchParams();
  if (currentCategoryName) params.set('category', currentCategoryName);
  if (currentMinPrice) params.set('minPrice', currentMinPrice);
  if (currentMaxPrice) params.set('maxPrice', currentMaxPrice);
  if (currentRating) params.set('rating', currentRating);
  if (currentInStock) params.set('inStock', 'true');
  if (currentSort && currentSort !== 'featured') params.set('sortBy', currentSort);
  if (inCategoryQuery) params.set('search', inCategoryQuery);
  if (currentPage > 1) params.set('page', String(currentPage));

  const queryStr = params.toString();
  const newUrl = window.location.pathname + (queryStr ? '?' + queryStr : '');

  if (pushHistory) {
    window.history.pushState(null, '', newUrl);
  } else {
    window.history.replaceState(null, '', newUrl);
  }
}

function syncUIWithFilterState() {
  if (filterMinPriceInput) filterMinPriceInput.value = currentMinPrice;
  if (filterMaxPriceInput) filterMaxPriceInput.value = currentMaxPrice;

  const ratingRadios = document.querySelectorAll('input[name="filter-rating-radio"]');
  ratingRadios.forEach(radio => {
    radio.checked = radio.value === String(currentRating);
  });

  if (filterInStockCheckbox) filterInStockCheckbox.checked = currentInStock;
  if (categorySortSelect) categorySortSelect.value = currentSort || 'featured';
  if (categoryFilterSearch) categoryFilterSearch.value = inCategoryQuery;

  updatePriceChipsState();
  renderActiveFilterTags();
}

function updatePriceChipsState() {
  const chips = document.querySelectorAll('.price-chip');
  chips.forEach(chip => {
    const min = chip.dataset.min || '';
    const max = chip.dataset.max || '';
    if (min === String(currentMinPrice) && max === String(currentMaxPrice)) {
      chip.classList.add('is-active');
    } else {
      chip.classList.remove('is-active');
    }
  });
}

function renderActiveFilterTags() {
  if (!categoryActiveFiltersBar || !activeFiltersPills) return;
  activeFiltersPills.innerHTML = '';
  let activeCount = 0;

  if (currentMinPrice || currentMaxPrice) {
    activeCount++;
    let label = '';
    if (currentMinPrice && currentMaxPrice) {
      label = `Price: ₹${currentMinPrice} - ₹${currentMaxPrice}`;
    } else if (currentMinPrice) {
      label = `Price: ≥ ₹${currentMinPrice}`;
    } else {
      label = `Price: ≤ ₹${currentMaxPrice}`;
    }
    const tag = createFilterTag(label, () => {
      currentMinPrice = '';
      currentMaxPrice = '';
      currentPage = 1;
      syncFiltersToURL(true);
      syncUIWithFilterState();
      fetchCategoryPageData();
    });
    activeFiltersPills.appendChild(tag);
  }

  if (currentRating) {
    activeCount++;
    const tag = createFilterTag(`Rating: ${currentRating}★ & above`, () => {
      currentRating = '';
      currentPage = 1;
      syncFiltersToURL(true);
      syncUIWithFilterState();
      fetchCategoryPageData();
    });
    activeFiltersPills.appendChild(tag);
  }

  if (currentInStock) {
    activeCount++;
    const tag = createFilterTag('In Stock Only', () => {
      currentInStock = false;
      currentPage = 1;
      syncFiltersToURL(true);
      syncUIWithFilterState();
      fetchCategoryPageData();
    });
    activeFiltersPills.appendChild(tag);
  }

  if (inCategoryQuery) {
    activeCount++;
    const tag = createFilterTag(`Search: "${inCategoryQuery}"`, () => {
      inCategoryQuery = '';
      currentPage = 1;
      syncFiltersToURL(true);
      syncUIWithFilterState();
      fetchCategoryPageData();
    });
    activeFiltersPills.appendChild(tag);
  }

  if (activeCount > 0) {
    categoryActiveFiltersBar.style.display = 'flex';
  } else {
    categoryActiveFiltersBar.style.display = 'none';
  }

  if (mobileFilterActiveCount) {
    if (activeCount > 0) {
      mobileFilterActiveCount.textContent = activeCount;
      mobileFilterActiveCount.style.display = 'inline-flex';
    } else {
      mobileFilterActiveCount.style.display = 'none';
    }
  }
}

function createFilterTag(text, onRemove) {
  const tag = document.createElement('span');
  tag.className = 'active-filter-tag';
  tag.innerHTML = `<span>${escapeHtml(text)}</span>`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'active-filter-tag-close';
  btn.setAttribute('aria-label', `Remove ${text}`);
  btn.innerHTML = '✕';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onRemove();
  });
  tag.appendChild(btn);
  return tag;
}

function clearAllFilters() {
  currentMinPrice = '';
  currentMaxPrice = '';
  currentRating = '';
  currentInStock = false;
  inCategoryQuery = '';
  currentPage = 1;
  syncFiltersToURL(true);
  syncUIWithFilterState();
  fetchCategoryPageData();
}

function openMobileDrawer() {
  if (categoryFilterSidebar) categoryFilterSidebar.classList.add('is-open');
  if (filterDrawerBackdrop) filterDrawerBackdrop.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeMobileDrawer() {
  if (categoryFilterSidebar) categoryFilterSidebar.classList.remove('is-open');
  if (filterDrawerBackdrop) filterDrawerBackdrop.style.display = 'none';
  document.body.style.overflow = '';
}

// ============================================================
// Category Products Fetching & Data Flow
// ============================================================

async function fetchCategoryPageData() {
  showLoadingState();

  try {
    // 1. Fetch available categories from existing backend API if not yet loaded
    if (availableCategories.length === 0) {
      const catRes = await fetch(`${API_BASE_URL}/products/categories`);
      if (catRes.ok) {
        const catData = await catRes.json();
        if (catData.success && Array.isArray(catData.data)) {
          availableCategories = catData.data;
        }
      }
    }

    // Read filters from current URL query parameters on initial boot or popstate
    if (!currentCategoryName && availableCategories.length > 0) {
      currentCategoryName = availableCategories[0];
      syncFiltersToURL(false);
    }

    // 2. Fetch products with faceted filter query parameters
    const queryParams = new URLSearchParams();
    if (currentCategoryName && currentCategoryName.toLowerCase() !== 'all') {
      queryParams.set('category', currentCategoryName);
    }
    if (currentMinPrice) queryParams.set('minPrice', currentMinPrice);
    if (currentMaxPrice) queryParams.set('maxPrice', currentMaxPrice);
    if (currentRating) queryParams.set('rating', currentRating);
    if (currentInStock) queryParams.set('inStock', 'true');
    if (currentSort) queryParams.set('sortBy', currentSort);
    if (inCategoryQuery) queryParams.set('search', inCategoryQuery);
    queryParams.set('page', String(currentPage));
    queryParams.set('limit', String(itemsPerPage));

    const res = await fetch(`${API_BASE_URL}/products?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

    const data = await res.json();
    rawCategoryProducts = (data.success && Array.isArray(data.data)) ? data.data : [];
    displayedProducts = rawCategoryProducts;
    totalProductsCount = data.total !== undefined ? data.total : (data.pagination ? data.pagination.totalProducts : rawCategoryProducts.length);
    if (data.facets) {
      currentFacets = data.facets;
    }

    // If category wasn't explicit, detect from products or fallback
    if (!currentCategoryName && rawCategoryProducts.length > 0) {
      currentCategoryName = rawCategoryProducts[0].category || 'Products';
    }

    updateCategoryHeaderUI();
    renderQuickCategoryLinks();
    renderSidebarCategoryList();
    updateFacetUI();
    syncUIWithFilterState();
    renderProducts(data.pagination);
  } catch (err) {
    console.error('Failed to load category products:', err);
    showErrorState(err.message);
  }
}

function updateCategoryHeaderUI() {
  const meta = getCategoryMeta(currentCategoryName);
  document.title = `${currentCategoryName || 'Category'} Products | MiniStore`;

  if (categoryBreadcrumbCurrent) {
    categoryBreadcrumbCurrent.textContent = currentCategoryName || 'All Categories';
  }
  if (categoryPageIconBadge) {
    categoryPageIconBadge.textContent = meta.icon;
    categoryPageIconBadge.style.background = meta.tint;
    categoryPageIconBadge.style.border = `1px solid ${meta.border}`;
  }
  if (categoryPageTitle) {
    categoryPageTitle.textContent = currentCategoryName || 'All Category Products';
  }
  if (categoryPageSubtitle) {
    categoryPageSubtitle.textContent = meta.subtitle;
  }
  if (categoryProductCount) {
    categoryProductCount.textContent = `${totalProductsCount} ${totalProductsCount === 1 ? 'product' : 'products'} found`;
  }
  if (categoryItemsCountDisplay) {
    categoryItemsCountDisplay.textContent = `${totalProductsCount} ${totalProductsCount === 1 ? 'product' : 'products'} found`;
  }
}

function renderQuickCategoryLinks() {
  if (!categoryQuickLinks) return;
  if (!availableCategories || availableCategories.length === 0) {
    categoryQuickLinks.innerHTML = '';
    return;
  }

  categoryQuickLinks.innerHTML = '';
  availableCategories.forEach(cat => {
    const isActive = cat.toLowerCase() === currentCategoryName.toLowerCase();
    const meta = getCategoryMeta(cat);
    const link = document.createElement('a');
    link.href = `category.html?category=${encodeURIComponent(cat)}`;
    link.className = `category-quick-pill ${isActive ? 'is-active' : ''}`;
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    }
    link.innerHTML = `<span class="pill-icon" aria-hidden="true">${meta.icon}</span><span class="pill-label">${escapeHtml(cat)}</span>`;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      currentCategoryName = cat;
      currentPage = 1;
      syncFiltersToURL(true);
      fetchCategoryPageData();
    });
    categoryQuickLinks.appendChild(link);
  });
}

function renderSidebarCategoryList() {
  const container = document.getElementById('filter-categories-list');
  if (!container) return;
  if (!availableCategories || availableCategories.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';
  availableCategories.forEach(cat => {
    const isActive = cat.toLowerCase() === currentCategoryName.toLowerCase();
    const meta = getCategoryMeta(cat);
    const item = document.createElement('a');
    item.href = `category.html?category=${encodeURIComponent(cat)}`;
    item.className = `filter-category-item ${isActive ? 'is-active' : ''}`;
    item.innerHTML = `
      <span style="display: flex; align-items: center; gap: 8px;">
        <span>${meta.icon}</span>
        <span>${escapeHtml(cat)}</span>
      </span>
      ${isActive ? '<span style="font-size: 0.75rem; color: var(--color-primary);">●</span>' : ''}
    `;
    item.addEventListener('click', (e) => {
      e.preventDefault();
      currentCategoryName = cat;
      currentPage = 1;
      syncFiltersToURL(true);
      closeMobileDrawer();
      fetchCategoryPageData();
    });
    container.appendChild(item);
  });
}

function updateFacetUI() {
  const inStockBadge = document.getElementById('filter-in-stock-badge');
  if (inStockBadge) {
    inStockBadge.textContent = currentFacets.inStockCount !== undefined ? currentFacets.inStockCount : '0';
  }

  const priceHint = document.getElementById('filter-price-scope-hint');
  if (priceHint) {
    const min = currentFacets.scopeMinPrice || currentFacets.minPrice || 0;
    const max = currentFacets.scopeMaxPrice || currentFacets.maxPrice || 0;
    if (max > 0) {
      priceHint.textContent = `₹${min.toLocaleString('en-IN')} - ₹${max.toLocaleString('en-IN')}`;
    }
  }
}

function renderProducts(pagination) {
  if (!categoryProductsGrid) return;

  hideAllStates();

  if (displayedProducts.length === 0) {
    showEmptyState();
    return;
  }

  categoryProductsGrid.style.display = 'grid';
  categoryProductsGrid.innerHTML = '';

  displayedProducts.forEach((product, idx) => {
    const card = createCategoryProductCard(product, idx);
    categoryProductsGrid.appendChild(card);
  });

  const totalPages = pagination ? pagination.totalPages : Math.ceil(totalProductsCount / itemsPerPage);
  renderPaginationControls(totalProductsCount, totalPages);
}


function createCategoryProductCard(product, index = 0) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.id = `cat-prod-${product._id}`;
  card.style.animationDelay = `${(index % 8) * 40}ms`;

  const stockInfo = getStockInfo(product.stock);
  const formattedPrice = currencyFormatter.format(product.price);
  const isOutOfStock = product.stock <= 0;
  const isWishlisted = wishlistProductIds.has(String(product._id));
  const avgRating = Number(product.averageRating) || 0;
  const totalReviews = Number(product.totalReviews) || (product.reviews ? product.reviews.length : 0);
  const hasRating = totalReviews > 0 || avgRating > 0;

  card.innerHTML = `
    <div class="card-media">
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
      <h3 class="card-title">${escapeHtml(product.name)}</h3>
      ${hasRating ? `
        <div class="card-rating-row" aria-label="Rating: ${avgRating.toFixed(1)} out of 5 stars">
          <span class="rating-stars-inline" style="font-size: 0.82rem;">${renderStars(avgRating)}</span>
          <span class="card-rating-text">${avgRating.toFixed(1)}</span>
          <span class="card-rating-count">(${totalReviews})</span>
        </div>
      ` : ''}
      <p class="card-description">${escapeHtml(product.description || '')}</p>
      <div class="card-footer">
        <div class="price-tag">
          <span class="price-label">Price</span>
          <span class="price-value">${formattedPrice}</span>
        </div>
        <span class="stock-badge ${stockInfo.className}">
          ${stockInfo.label}
        </span>
      </div>
      <div class="card-actions">
        <button
          type="button"
          class="btn btn-secondary btn-sm btn-details"
          data-id="${escapeHtml(product._id)}"
        >
          View Details
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm btn-add-cart"
          data-id="${escapeHtml(product._id)}"
          ${isOutOfStock ? 'disabled' : ''}
        >
          ${isOutOfStock ? 'Out of Stock' : '+ Add to Cart'}
        </button>
      </div>
    </div>
  `;

  // Navigate to existing product details page on card click
  card.style.cursor = 'pointer';
  card.addEventListener('click', (e) => {
    if (e.target.closest('.btn-add-cart') || e.target.closest('.wishlist-heart-btn')) return;
    window.location.href = `product-details.html?id=${encodeURIComponent(product._id)}`;
  });

  const detailsBtn = card.querySelector('.btn-details');
  if (detailsBtn) {
    detailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = `product-details.html?id=${encodeURIComponent(product._id)}`;
    });
  }

  // Add to cart button
  const addCartBtn = card.querySelector('.btn-add-cart');
  if (addCartBtn && !isOutOfStock) {
    addCartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardImg = card.querySelector('.card-image');
      handleAddToCart(product._id, 1, cardImg);
    });
  }

  // Wishlist heart button
  const heartBtn = card.querySelector('.wishlist-heart-btn');
  if (heartBtn) {
    heartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleToggleWishlist(product._id, heartBtn);
    });
  }

  return card;
}

function renderPaginationControls(totalItems, totalPages) {
  if (!categoryPaginationContainer) return;

  if (totalPages <= 1) {
    categoryPaginationContainer.style.display = 'none';
    return;
  }

  categoryPaginationContainer.style.display = 'flex';

  if (categoryPrevPageBtn) {
    categoryPrevPageBtn.disabled = currentPage <= 1;
  }
  if (categoryNextPageBtn) {
    categoryNextPageBtn.disabled = currentPage >= totalPages;
  }

  if (categoryPaginationPages) {
    categoryPaginationPages.innerHTML = '';
    for (let p = 1; p <= totalPages; p++) {
      const pageBtn = document.createElement('button');
      pageBtn.type = 'button';
      pageBtn.className = `pagination-page-btn ${p === currentPage ? 'is-active active' : ''}`;
      pageBtn.textContent = p;
      pageBtn.setAttribute('aria-label', `Go to page ${p}`);
      pageBtn.addEventListener('click', () => {
        currentPage = p;
        renderProducts();
        window.scrollTo({ top: categoryProductsGrid.offsetTop - 120, behavior: 'smooth' });
      });
      categoryPaginationPages.appendChild(pageBtn);
    }
  }
}

// State display helpers
function hideAllStates() {
  if (categoryLoadingState) categoryLoadingState.style.display = 'none';
  if (categoryErrorState) categoryErrorState.style.display = 'none';
  if (categoryEmptyState) categoryEmptyState.style.display = 'none';
  if (categoryProductsGrid) categoryProductsGrid.style.display = 'none';
  if (categoryPaginationContainer) categoryPaginationContainer.style.display = 'none';
}

function showLoadingState() {
  hideAllStates();
  if (categoryLoadingState) categoryLoadingState.style.display = 'grid';
}

function showErrorState(msg) {
  hideAllStates();
  if (categoryErrorState) {
    categoryErrorState.style.display = 'block';
    if (categoryErrorMessage && msg) {
      categoryErrorMessage.textContent = msg;
    }
  }
}

function showEmptyState() {
  hideAllStates();
  if (categoryEmptyState) {
    categoryEmptyState.style.display = 'block';
    if (inCategoryQuery) {
      categoryEmptyMessage.textContent = `No products found matching "${inCategoryQuery}" in category ${currentCategoryName}.`;
      if (categoryEmptyResetBtn) categoryEmptyResetBtn.style.display = 'inline-flex';
    } else {
      categoryEmptyMessage.textContent = `There are currently no products available in category "${currentCategoryName}".`;
      if (categoryEmptyResetBtn) categoryEmptyResetBtn.style.display = 'none';
    }
  }
}

// ============================================================
// Cart Operations & Animation
// ============================================================

function animateFlyToCart(sourceImg) {
  if (!sourceImg || !navCartBtn) return;
  const startRect = sourceImg.getBoundingClientRect();
  const targetRect = navCartBtn.getBoundingClientRect();

  const flyer = document.createElement('img');
  flyer.src = sourceImg.src || FALLBACK_IMAGE_URL;
  flyer.className = 'fly-to-cart-element';
  flyer.style.width = '60px';
  flyer.style.height = '60px';
  flyer.style.left = `${startRect.left + startRect.width / 2 - 30}px`;
  flyer.style.top = `${startRect.top + startRect.height / 2 - 30}px`;

  document.body.appendChild(flyer);

  const deltaX = (targetRect.left + targetRect.width / 2) - (startRect.left + startRect.width / 2);
  const deltaY = (targetRect.top + targetRect.height / 2) - (startRect.top + startRect.height / 2);

  if (typeof flyer.animate === 'function') {
    const anim = flyer.animate([
      { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
      { offset: 0.5, transform: `translate3d(${deltaX * 0.5}px, ${deltaY * 0.4 - 50}px, 0) scale(0.7)`, opacity: 0.9 },
      { transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.1)`, opacity: 0.1 }
    ], {
      duration: 600,
      easing: 'cubic-bezier(0.2, 0.7, 0.25, 1)',
      fill: 'forwards'
    });
    anim.onfinish = () => flyer.remove();
  } else {
    setTimeout(() => flyer.remove(), 600);
  }
}

async function handleAddToCart(productId, quantity = 1, sourceImg = null) {
  const token = getAuthToken();
  if (!token) {
    openAuthModal('login', 'Please log in to add products to your cart.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ productId, quantity })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add item to cart');

    if (sourceImg) animateFlyToCart(sourceImg);

    // Update cart state and badge
    if (data.cart) {
      currentCart = data.cart;
      const count = (data.cart.items || []).reduce((acc, item) => acc + (item.quantity || 1), 0);
      localStorage.setItem('ministore_cart_count', String(count));
      updateCartBadge(count);
    }
    showToast('Product added to cart! 🛒');
  } catch (err) {
    console.error('Cart add error:', err);
    showToast(err.message || 'Error adding product to cart');
  }
}

// ============================================================
// Wishlist Operations
// ============================================================

async function handleToggleWishlist(productId, heartBtn) {
  const token = getAuthToken();
  if (!token) {
    openAuthModal('login', 'Please log in to manage your wishlist.');
    return;
  }

  const pId = String(productId);
  const isCurrentlyIn = wishlistProductIds.has(pId);

  try {
    const res = await fetch(`${API_BASE_URL}/wishlist/${pId}`, {
      method: isCurrentlyIn ? 'DELETE' : 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Wishlist operation failed');

    if (isCurrentlyIn) {
      wishlistProductIds.delete(pId);
      if (heartBtn) {
        heartBtn.classList.remove('is-active');
        heartBtn.querySelector('.heart-icon').textContent = '♡';
      }
      showToast('Removed from wishlist');
    } else {
      wishlistProductIds.add(pId);
      if (heartBtn) {
        heartBtn.classList.add('is-active');
        heartBtn.querySelector('.heart-icon').textContent = '♥';
      }
      showToast('Added to wishlist ❤️');
    }

    localStorage.setItem('ministore_wishlist_ids', JSON.stringify(Array.from(wishlistProductIds)));
    updateWishlistBadge(wishlistProductIds.size);
  } catch (err) {
    console.error('Wishlist toggle error:', err);
    showToast(err.message || 'Could not update wishlist');
  }
}

// ============================================================
// Cart Modal Display & Item Management
// ============================================================

async function openCartModal() {
  if (!cartModal) return;
  cartModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const token = getAuthToken();
  if (!token) {
    if (cartLoading) cartLoading.style.display = 'none';
    if (cartContent) cartContent.style.display = 'none';
    if (cartEmptyState) cartEmptyState.style.display = 'none';
    if (cartUnauthState) cartUnauthState.style.display = 'block';
    return;
  }

  if (cartUnauthState) cartUnauthState.style.display = 'none';
  if (cartEmptyState) cartEmptyState.style.display = 'none';
  if (cartContent) cartContent.style.display = 'none';
  if (cartLoading) cartLoading.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE_URL}/cart`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (cartLoading) cartLoading.style.display = 'none';

    if (res.ok && data.success && data.data) {
      currentCart = data.data;
      renderCartContent(data.data);
    } else {
      if (cartEmptyState) cartEmptyState.style.display = 'block';
    }
  } catch (err) {
    if (cartLoading) cartLoading.style.display = 'none';
    if (cartEmptyState) cartEmptyState.style.display = 'block';
  }
}

function renderCartContent(cart) {
  const items = (cart && Array.isArray(cart.items)) ? cart.items : [];
  if (cartItemsCountBadge) {
    const count = items.reduce((acc, item) => acc + (item.quantity || 1), 0);
    cartItemsCountBadge.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
    localStorage.setItem('ministore_cart_count', String(count));
    updateCartBadge(count);
  }

  if (items.length === 0) {
    if (cartEmptyState) cartEmptyState.style.display = 'block';
    if (cartContent) cartContent.style.display = 'none';
    return;
  }

  if (cartEmptyState) cartEmptyState.style.display = 'none';
  if (cartContent) cartContent.style.display = 'block';

  if (cartItemsList) {
    cartItemsList.innerHTML = '';
    let totalAmt = 0;

    items.forEach(item => {
      const prod = item.product || {};
      const qty = item.quantity || 1;
      const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (item.price !== undefined ? item.price : (Number(prod.price) || 0));
      const regularPrice = item.regularPrice || Number(prod.price) || unitPrice;
      const isDiscounted = item.isFestiveDiscount || (unitPrice < regularPrice);
      const subtotal = item.subtotal !== undefined ? item.subtotal : (unitPrice * qty);
      totalAmt += subtotal;

      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item-row';
      itemEl.innerHTML = `
        <img src="${formatProductImageUrl(prod.image)}" alt="${escapeHtml(prod.name || 'Product')}" class="cart-item-thumb" />
        <div class="cart-item-info">
          <div class="cart-item-title">${escapeHtml(prod.name || 'Product')}</div>
          <div class="cart-item-meta">
            <span style="font-weight: 700; color: ${isDiscounted ? '#10b981' : 'inherit'};">${currencyFormatter.format(unitPrice)}</span> × ${qty} = <strong>${currencyFormatter.format(subtotal)}</strong>
            ${isDiscounted ? `<span style="text-decoration: line-through; color: var(--color-text-muted); font-size: 0.8em; margin-left: 6px;">${currencyFormatter.format(regularPrice)}</span> <span style="color: #10b981; font-size: 0.72rem; font-weight: 700; background: rgba(16, 185, 129, 0.12); padding: 1px 5px; border-radius: 4px;">Festive Deal</span>` : ''}
          </div>
        </div>
        <button class="cart-item-remove-btn" data-id="${escapeHtml(prod._id || item._id)}" title="Remove item" aria-label="Remove item">✕</button>
      `;

      const removeBtn = itemEl.querySelector('.cart-item-remove-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => removeCartItem(prod._id || item._id));
      }

      cartItemsList.appendChild(itemEl);
    });

    if (cartTotalAmount) {
      cartTotalAmount.textContent = currencyFormatter.format(totalAmt);
    }
  }
}

async function removeCartItem(productId) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/cart/${productId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.cart) {
      renderCartContent(data.cart);
      showToast('Item removed from cart');
    }
  } catch (err) {
    showToast('Failed to remove item');
  }
}

function closeCartModal() {
  if (!cartModal) return;
  cartModal.style.display = 'none';
  document.body.style.overflow = '';
}

// ============================================================
// Wishlist Modal Display
// ============================================================

async function openWishlistModal() {
  if (!wishlistModal) return;
  wishlistModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const token = getAuthToken();
  if (!token) {
    if (wishlistLoading) wishlistLoading.style.display = 'none';
    if (wishlistContent) wishlistContent.style.display = 'none';
    if (wishlistEmptyState) wishlistEmptyState.style.display = 'none';
    if (wishlistUnauthState) wishlistUnauthState.style.display = 'block';
    return;
  }

  if (wishlistUnauthState) wishlistUnauthState.style.display = 'none';
  if (wishlistEmptyState) wishlistEmptyState.style.display = 'none';
  if (wishlistContent) wishlistContent.style.display = 'none';
  if (wishlistLoading) wishlistLoading.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE_URL}/wishlist`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (wishlistLoading) wishlistLoading.style.display = 'none';

    if (res.ok && data.success && data.data) {
      renderWishlistContent(data.data);
    } else {
      if (wishlistEmptyState) wishlistEmptyState.style.display = 'block';
    }
  } catch (err) {
    if (wishlistLoading) wishlistLoading.style.display = 'none';
    if (wishlistEmptyState) wishlistEmptyState.style.display = 'block';
  }
}

function renderWishlistContent(wishlist) {
  const items = (wishlist && Array.isArray(wishlist.products)) ? wishlist.products : [];
  if (wishlistItemsCountBadge) {
    wishlistItemsCountBadge.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
  }

  if (items.length === 0) {
    if (wishlistEmptyState) wishlistEmptyState.style.display = 'block';
    if (wishlistContent) wishlistContent.style.display = 'none';
    return;
  }

  if (wishlistEmptyState) wishlistEmptyState.style.display = 'none';
  if (wishlistContent) wishlistContent.style.display = 'block';

  if (wishlistItemsList) {
    wishlistItemsList.innerHTML = '';
    items.forEach(prod => {
      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item-row';
      itemEl.innerHTML = `
        <img src="${formatProductImageUrl(prod.image)}" alt="${escapeHtml(prod.name)}" class="cart-item-thumb" />
        <div class="cart-item-info">
          <div class="cart-item-title">${escapeHtml(prod.name)}</div>
          <div class="cart-item-meta">${currencyFormatter.format(prod.price)}</div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <a href="product-details.html?id=${encodeURIComponent(prod._id)}" class="btn btn-secondary btn-sm">View</a>
          <button class="cart-item-remove-btn" data-id="${escapeHtml(prod._id)}" title="Remove from wishlist">✕</button>
        </div>
      `;

      const removeBtn = itemEl.querySelector('.cart-item-remove-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', async () => {
          await handleToggleWishlist(prod._id, null);
          openWishlistModal();
        });
      }

      wishlistItemsList.appendChild(itemEl);
    });
  }
}

function closeWishlistModal() {
  if (!wishlistModal) return;
  wishlistModal.style.display = 'none';
  document.body.style.overflow = '';
}

// ============================================================
// Event Listeners & Initialization
// ============================================================

function initEventListeners() {
  // Theme Toggle
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Profile Dropdown
  if (navProfileTriggerBtn) {
    navProfileTriggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProfileDropdown();
    });
  }
  document.addEventListener('click', (e) => {
    if (profileDropdownMenu && !profileDropdownMenu.contains(e.target) && e.target !== navProfileTriggerBtn) {
      closeProfileDropdown();
    }
  });

  // Login Button in Navbar
  if (navLoginBtn) {
    navLoginBtn.addEventListener('click', () => openAuthModal('login'));
  }

  // Logout Button
  if (navLogoutBtn) {
    navLogoutBtn.addEventListener('click', logoutUser);
  }

  // Profile Modal
  if (dropdownProfileBtn) {
    dropdownProfileBtn.addEventListener('click', () => {
      closeProfileDropdown();
      const user = getAuthUser();
      if (!user) {
        openAuthModal('login');
        return;
      }
      if (profileNameInput) profileNameInput.value = user.name || '';
      if (profileEmailInput) profileEmailInput.value = user.email || '';
      if (profilePhoneInput) profilePhoneInput.value = user.phone || '';
      if (profileModal) profileModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });
  }

  if (profileCloseBtn) profileCloseBtn.addEventListener('click', () => { profileModal.style.display = 'none'; document.body.style.overflow = ''; });
  if (profileCloseActionBtn) profileCloseActionBtn.addEventListener('click', () => { profileModal.style.display = 'none'; document.body.style.overflow = ''; });

  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = getAuthToken();
      if (!token) return;

      const updatedName = profileNameInput.value.trim();
      const updatedPhone = profilePhoneInput.value.trim();

      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: updatedName, phone: updatedPhone })
        });
        const data = await res.json();
        if (res.ok && data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          updateAuthUI();
          showToast('Profile updated successfully! ✨');
          profileModal.style.display = 'none';
          document.body.style.overflow = '';
        } else {
          throw new Error(data.message || 'Could not update profile');
        }
      } catch (err) {
        if (profileAlertError) {
          profileAlertError.textContent = err.message;
          profileAlertError.style.display = 'block';
        }
      }
    });
  }

  // Auth Modals Tabs & Forms
  if (authCloseBtn) authCloseBtn.addEventListener('click', closeAuthModal);
  if (tabLoginBtn) tabLoginBtn.addEventListener('click', () => openAuthModal('login'));
  if (tabRegisterBtn) tabRegisterBtn.addEventListener('click', () => openAuthModal('register'));

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

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
        showToast(`Welcome back, ${data.user.name}! 👋`);
      } catch (err) {
        if (authErrorAlert) {
          authErrorAlert.textContent = err.message;
          authErrorAlert.style.display = 'block';
        }
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;

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

  // Global search redirect to index.html with search query
  if (searchSubmitBtn) {
    searchSubmitBtn.addEventListener('click', () => {
      const q = searchInput?.value?.trim();
      if (q) {
        window.location.href = `index.html?search=${encodeURIComponent(q)}`;
      }
    });
  }
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q) {
          window.location.href = `index.html?search=${encodeURIComponent(q)}`;
        }
      }
    });
  }

  // In-Category Live Search
  if (categoryFilterSearch) {
    categoryFilterSearch.addEventListener('input', (e) => {
      inCategoryQuery = e.target.value.trim();
      if (categoryClearFilterBtn) {
        categoryClearFilterBtn.style.display = inCategoryQuery ? 'inline-flex' : 'none';
      }
      currentPage = 1;
      syncFiltersToURL(true);
      fetchCategoryPageData();
    });
  }

  if (categoryClearFilterBtn) {
    categoryClearFilterBtn.addEventListener('click', () => {
      if (categoryFilterSearch) categoryFilterSearch.value = '';
      inCategoryQuery = '';
      categoryClearFilterBtn.style.display = 'none';
      currentPage = 1;
      syncFiltersToURL(true);
      fetchCategoryPageData();
    });
  }

  // Price range filters
  if (filterPriceApplyBtn) {
    filterPriceApplyBtn.addEventListener('click', () => {
      currentMinPrice = filterMinPriceInput ? filterMinPriceInput.value.trim() : '';
      currentMaxPrice = filterMaxPriceInput ? filterMaxPriceInput.value.trim() : '';
      currentPage = 1;
      syncFiltersToURL(true);
      closeMobileDrawer();
      fetchCategoryPageData();
    });
  }

  if (filterMinPriceInput) {
    filterMinPriceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') filterPriceApplyBtn?.click();
    });
  }

  if (filterMaxPriceInput) {
    filterMaxPriceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') filterPriceApplyBtn?.click();
    });
  }

  // Price quick preset chips
  const priceChips = document.querySelectorAll('.price-chip');
  priceChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const min = chip.dataset.min || '';
      const max = chip.dataset.max || '';
      if (currentMinPrice === min && currentMaxPrice === max) {
        currentMinPrice = '';
        currentMaxPrice = '';
      } else {
        currentMinPrice = min;
        currentMaxPrice = max;
      }
      currentPage = 1;
      syncFiltersToURL(true);
      closeMobileDrawer();
      fetchCategoryPageData();
    });
  });

  // Customer rating radio options
  const ratingRadios = document.querySelectorAll('input[name="filter-rating-radio"]');
  ratingRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentRating = e.target.value;
      currentPage = 1;
      syncFiltersToURL(true);
      closeMobileDrawer();
      fetchCategoryPageData();
    });
  });

  // In Stock checkbox
  if (filterInStockCheckbox) {
    filterInStockCheckbox.addEventListener('change', (e) => {
      currentInStock = e.target.checked;
      currentPage = 1;
      syncFiltersToURL(true);
      closeMobileDrawer();
      fetchCategoryPageData();
    });
  }

  // Clear all filters handlers
  [filterClearAllBtn, btnClearActiveFilters, categoryResetFilterBtn, categoryEmptyResetBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        clearAllFilters();
        closeMobileDrawer();
      });
    }
  });

  // Mobile Drawer controls
  if (mobileFilterTriggerBtn) mobileFilterTriggerBtn.addEventListener('click', openMobileDrawer);
  if (filterDrawerCloseBtn) filterDrawerCloseBtn.addEventListener('click', closeMobileDrawer);
  if (filterDrawerBackdrop) filterDrawerBackdrop.addEventListener('click', closeMobileDrawer);
  if (filterDrawerApplyBtn) filterDrawerApplyBtn.addEventListener('click', closeMobileDrawer);

  // Sorting Select
  if (categorySortSelect) {
    categorySortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      currentPage = 1;
      syncFiltersToURL(true);
      fetchCategoryPageData();
    });
  }

  // Pagination Next & Prev
  if (categoryPrevPageBtn) {
    categoryPrevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        syncFiltersToURL(true);
        fetchCategoryPageData();
        window.scrollTo({ top: categoryProductsGrid.offsetTop - 120, behavior: 'smooth' });
      }
    });
  }

  if (categoryNextPageBtn) {
    categoryNextPageBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(totalProductsCount / itemsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        syncFiltersToURL(true);
        fetchCategoryPageData();
        window.scrollTo({ top: categoryProductsGrid.offsetTop - 120, behavior: 'smooth' });
      }
    });
  }

  // Browser navigation popstate (Back/Forward)
  window.addEventListener('popstate', () => {
    readFiltersFromURL();
    syncUIWithFilterState();
    fetchCategoryPageData();
  });

  // Retry Button
  if (categoryRetryBtn) {
    categoryRetryBtn.addEventListener('click', fetchCategoryPageData);
  }
}

// Initial Boot
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  updateAuthUI();
  readFiltersFromURL();
  syncUIWithFilterState();
  initEventListeners();
  fetchCategoryPageData();
});
