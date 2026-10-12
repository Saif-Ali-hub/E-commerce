/**
 * MiniStore - Dedicated Product Details Page Logic
 * Reuses existing backend APIs: /api/products, /api/cart, /api/wishlist, /api/auth
 */

const API_BASE_URL = 'http://localhost:5000/api';
const FALLBACK_IMAGE_URL = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22600%22%20height%3D%22600%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20600%22%3E%3Crect%20fill%3D%22%23f3f4f6%22%20width%3D%22600%22%20height%3D%22600%22%2F%3E%3Cpath%20d%3D%22M250%20220a40%2040%200%201%200%2080%200%2040%2040%200%201%200-80%200zm-70%20180h240l-75-100-55%2070-35-45-75%2075z%22%20fill%3D%22%239ca3af%22%2F%3E%3Ctext%20fill%3D%22%236b7280%22%20font-family%3D%22sans-serif%22%20font-size%3D%2220%22%20font-weight%3D%22600%22%20x%3D%2250%25%22%20y%3D%2272%25%22%20text-anchor%3D%22middle%22%3EProduct%20Image%3C%2Ftext%3E%3C%2Fsvg%3E';

// Currency Formatter (INR)
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

// State
let currentProduct = null;
let selectedQuantity = 1;
let currentCart = null;
let currentWishlist = null;
let wishlistProductIds = new Set();
let isWishlistLoaded = false;
let isCartLoaded = false;

// DOM Elements - Navigation & Theme
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
const navOrdersBtn = document.getElementById('nav-orders-btn');
const navAddressesBtn = document.getElementById('nav-addresses-btn');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const navSearchWrap = document.getElementById('nav-search-wrap');
const searchSuggestionsDropdown = document.getElementById('search-suggestions-dropdown');
const searchSubmitBtn = document.getElementById('search-submit-btn');

// DOM Elements - Product Details Page States
const pdLoadingState = document.getElementById('pd-loading-state');
const pdErrorState = document.getElementById('pd-error-state');
const pdErrorTitle = document.getElementById('pd-error-title');
const pdErrorMessage = document.getElementById('pd-error-message');
const pdErrorRetryBtn = document.getElementById('pd-error-retry-btn');
const pdContentSection = document.getElementById('pd-content-section');

// DOM Elements - Product Content Fields
const bcCategory = document.getElementById('bc-category');
const bcTitle = document.getElementById('bc-title');
const pdMainImg = document.getElementById('pd-main-img');
const pdThumbStrip = document.getElementById('pd-thumb-strip');
const pdCategoryPill = document.getElementById('pd-category-pill');
const pdBrandTag = document.getElementById('pd-brand-tag');
const pdSkuTag = document.getElementById('pd-sku-tag');
const pdTitle = document.getElementById('pd-title');
const pdRatingStars = document.getElementById('pd-rating-stars');
const pdRatingScore = document.getElementById('pd-rating-score');
const pdReviewsLink = document.getElementById('pd-reviews-link');
const pdReviewsChip = document.getElementById('pd-reviews-chip');
const pdCurrentPrice = document.getElementById('pd-current-price');
const pdOriginalPrice = document.getElementById('pd-original-price');
const pdDiscountPill = document.getElementById('pd-discount-pill');
const pdStockBadge = document.getElementById('pd-stock-badge');
const pdStockText = document.getElementById('pd-stock-text');
const pdDescription = document.getElementById('pd-description');
const pdFeaturesBox = document.getElementById('pd-features-box');
const pdFeaturesList = document.getElementById('pd-features-list');
const pdSpecsBox = document.getElementById('pd-specs-box');
const pdSpecsTable = document.getElementById('pd-specs-table');
const pdQtyMinus = document.getElementById('pd-qty-minus');
const pdQtyPlus = document.getElementById('pd-qty-plus');
const pdQtyInput = document.getElementById('pd-qty-input');
const pdAddCartBtn = document.getElementById('pd-add-cart-btn');
const pdAddCartText = document.getElementById('pd-add-cart-text');
const pdWishlistBtn = document.getElementById('pd-wishlist-btn');
const pdWishlistIcon = document.getElementById('pd-wishlist-icon');
const pdWishlistText = document.getElementById('pd-wishlist-text');
const pdReviewsSummaryCard = document.getElementById('pd-reviews-summary-card');
const pdWriteReviewContainer = document.getElementById('pd-write-review-container');
const pdReviewsList = document.getElementById('pd-reviews-list');
const pdRelatedGrid = document.getElementById('pd-related-grid');

// DOM Elements - Modals
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
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  if (themeToggleIcon) {
    themeToggleIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

// ============================================================
// Authentication & User State
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
    updateCartCountBadge(savedCartCount);

    try {
      const savedWishlistIds = JSON.parse(localStorage.getItem('ministore_wishlist_ids') || '[]');
      if (Array.isArray(savedWishlistIds)) {
        wishlistProductIds = new Set(savedWishlistIds.map(String));
      }
    } catch (e) {
      wishlistProductIds = new Set();
    }
    updateWishlistCountBadge(wishlistProductIds.size);
  } else {
    closeProfileDropdown();
    if (navLoginBtn) navLoginBtn.style.display = 'inline-flex';
    if (navUserInfo) navUserInfo.style.display = 'none';
    if (navUserName) navUserName.textContent = '';
    updateCartCountBadge(0);
    updateWishlistCountBadge(0);
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
  currentWishlist = null;
  updateAuthUI();
  updateWishlistButtonUI();
  showToast('You have been signed out.');
}

// ============================================================
// Wishlist Operations
// ============================================================

function updateWishlistCountBadge(count = 0) {
  const num = Math.max(Number(count) || 0, 0);
  if (wishlistNavBadge) wishlistNavBadge.textContent = num;
  if (wishlistItemsCountBadge) {
    wishlistItemsCountBadge.textContent = `${num} ${num === 1 ? 'item' : 'items'}`;
  }
}

function isProductInWishlist(productId) {
  return wishlistProductIds.has(String(productId));
}

function updateWishlistButtonUI() {
  if (!pdWishlistBtn || !currentProduct) return;
  const inWish = isProductInWishlist(currentProduct._id);
  pdWishlistBtn.classList.toggle('is-active', inWish);
  pdWishlistBtn.setAttribute('aria-label', inWish ? 'Remove from wishlist' : 'Add to wishlist');
  if (pdWishlistIcon) pdWishlistIcon.textContent = inWish ? '♥' : '♡';
  if (pdWishlistText) pdWishlistText.textContent = inWish ? 'In Wishlist' : 'Add to Wishlist';
}

async function fetchWishlist() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/wishlist`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success && result.data) {
        currentWishlist = result.data;
        isWishlistLoaded = true;
        const prods = currentWishlist.products || [];
        wishlistProductIds = new Set(prods.map(p => String(p._id || p)));
        localStorage.setItem('ministore_wishlist_ids', JSON.stringify(Array.from(wishlistProductIds)));
        updateWishlistCountBadge(wishlistProductIds.size);
        updateWishlistButtonUI();
      }
    }
  } catch (err) {
    console.error('Failed to fetch wishlist:', err);
  }
}

async function toggleWishlistProduct(productId, triggerBtn = null) {
  const token = getAuthToken();
  if (!token) {
    openAuthModal('login', 'Please log in to add items to your wishlist.');
    return false;
  }

  if (!productId) return false;
  const prodIdStr = String(productId);
  const isCurrentlyWishlisted = wishlistProductIds.has(prodIdStr);

  try {
    const url = isCurrentlyWishlisted
      ? `${API_BASE_URL}/wishlist/${productId}`
      : `${API_BASE_URL}/wishlist`;
    const method = isCurrentlyWishlisted ? 'DELETE' : 'POST';

    const opts = {
      method,
      headers: { Authorization: `Bearer ${token}` }
    };
    if (method === 'POST') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify({ productId });
    }

    const response = await fetch(url, opts);
    let result = null;
    try {
      result = await response.json();
    } catch (e) {
      result = { success: false, message: `Server error (${response.status})` };
    }

    if (response.status === 401) {
      logoutUser();
      openAuthModal('login', 'Session expired. Please sign in again.');
      return false;
    }

    if (!response.ok || !result || !result.success) {
      showToast((result && result.message) || 'Could not update wishlist.');
      return false;
    }

    if (isCurrentlyWishlisted) {
      wishlistProductIds.delete(prodIdStr);
      showToast('Removed from wishlist');
    } else {
      wishlistProductIds.add(prodIdStr);
      showToast('Added to wishlist ❤️');
    }

    localStorage.setItem('ministore_wishlist_ids', JSON.stringify(Array.from(wishlistProductIds)));
    updateWishlistCountBadge(wishlistProductIds.size);
    updateWishlistButtonUI();

    // If wishlist modal is open, re-render
    if (wishlistModal && wishlistModal.style.display === 'flex') {
      renderWishlistContent();
    }

    return true;
  } catch (err) {
    console.error('Wishlist error:', err);
    showToast('Network error updating wishlist.');
    return false;
  }
}

function openWishlistModal() {
  closeProfileDropdown();
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

  if (wishlistUnauthState) wishlistUnauthState.style.display = 'none';
  if (isWishlistLoaded && currentWishlist) {
    if (wishlistLoading) wishlistLoading.style.display = 'none';
    renderWishlistContent();
    return;
  }

  if (wishlistLoading) wishlistLoading.style.display = 'flex';
  fetchWishlist().then(() => {
    if (wishlistLoading) wishlistLoading.style.display = 'none';
    renderWishlistContent();
  });
}

function closeWishlistModal() {
  if (wishlistModal) {
    wishlistModal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function renderWishlistContent() {
  if (!wishlistContent || !wishlistItemsList) return;
  const products = currentWishlist && Array.isArray(currentWishlist.products)
    ? currentWishlist.products
    : [];

  if (products.length === 0) {
    if (wishlistEmptyState) wishlistEmptyState.style.display = 'flex';
    wishlistContent.style.display = 'none';
    updateWishlistCountBadge(0);
    return;
  }

  if (wishlistEmptyState) wishlistEmptyState.style.display = 'none';
  wishlistContent.style.display = 'block';
  wishlistItemsList.innerHTML = '';

  products.forEach(p => {
    if (!p) return;
    const itemCard = document.createElement('div');
    itemCard.className = 'wishlist-item-card';
    itemCard.innerHTML = `
      <img src="${formatProductImageUrl(p.image)}" alt="${escapeHtml(p.name)}" class="wishlist-item-thumb"
        onerror="handleProductImageError(this, '${escapeHtml(p.image || '')}', '${escapeHtml(p.name || '')}')" />
      <div class="wishlist-item-info">
        <span class="wishlist-item-category">${escapeHtml(p.category)}</span>
        <h4 class="wishlist-item-name"><a href="product-details.html?id=${p._id}" style="color: inherit; text-decoration: none;">${escapeHtml(p.name)}</a></h4>
        <div class="wishlist-item-meta">
          <span class="wishlist-item-price">${currencyFormatter.format(p.price)}</span>
        </div>
      </div>
      <div class="wishlist-item-actions">
        <button type="button" class="btn btn-primary btn-sm btn-wishlist-cart" data-id="${p._id}">+ Add to Cart</button>
        <button type="button" class="wishlist-item-remove-btn" data-id="${p._id}">✕ Remove</button>
      </div>
    `;

    itemCard.querySelector('.btn-wishlist-cart')?.addEventListener('click', () => {
      addToCart(p._id, 1);
    });

    itemCard.querySelector('.wishlist-item-remove-btn')?.addEventListener('click', async () => {
      await toggleWishlistProduct(p._id);
    });

    wishlistItemsList.appendChild(itemCard);
  });
}

// ============================================================
// Shopping Cart Operations
// ============================================================

function updateCartCountBadge(count = 0) {
  const num = Math.max(Number(count) || 0, 0);
  if (cartNavBadge) cartNavBadge.textContent = num;
  if (cartItemsCountBadge) {
    cartItemsCountBadge.textContent = `${num} ${num === 1 ? 'item' : 'items'}`;
  }
}

async function fetchCart() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success && result.data) {
        currentCart = result.data;
        isCartLoaded = true;
        const totalItems = (currentCart.items || []).reduce((sum, item) => sum + item.quantity, 0);
        updateCartCountBadge(totalItems);
        localStorage.setItem('ministore_cart_count', String(totalItems));
      }
    }
  } catch (err) {
    console.error('Failed to fetch cart:', err);
  }
}

async function addToCart(productId, quantity = 1, visualElement = null) {
  const token = getAuthToken();
  if (!token) {
    openAuthModal('login', 'Please log in to add items to your cart.');
    return;
  }

  if (pdAddCartBtn) {
    pdAddCartBtn.disabled = true;
    if (pdAddCartText) pdAddCartText.textContent = 'Adding...';
  }

  try {
    const response = await fetch(`${API_BASE_URL}/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ productId, quantity })
    });

    const result = await response.json();

    if (response.status === 401) {
      logoutUser();
      openAuthModal('login', 'Session expired. Please log in again.');
      return;
    }

    if (!response.ok || !result.success) {
      showToast(result.message || 'Could not add item to cart.');
      return;
    }

    currentCart = result.data;
    isCartLoaded = true;
    const totalItems = (currentCart.items || []).reduce((sum, item) => sum + item.quantity, 0);
    updateCartCountBadge(totalItems);
    localStorage.setItem('ministore_cart_count', String(totalItems));

    showToast(`✓ Added ${quantity} item(s) to your cart!`);

    // Bounce cart badge animation
    if (cartNavBadge) {
      cartNavBadge.classList.remove('badge-pop');
      void cartNavBadge.offsetWidth;
      cartNavBadge.classList.add('badge-pop');
    }
  } catch (err) {
    console.error('Add to cart error:', err);
    showToast('Network error adding to cart.');
  } finally {
    if (pdAddCartBtn && currentProduct && currentProduct.stock > 0) {
      pdAddCartBtn.disabled = false;
      if (pdAddCartText) pdAddCartText.textContent = 'Add to Cart';
    }
  }
}

function openCartModal() {
  closeProfileDropdown();
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

  if (cartUnauthState) cartUnauthState.style.display = 'none';
  if (isCartLoaded && currentCart) {
    if (cartLoading) cartLoading.style.display = 'none';
    renderCartContent();
    return;
  }

  if (cartLoading) cartLoading.style.display = 'flex';
  fetchCart().then(() => {
    if (cartLoading) cartLoading.style.display = 'none';
    renderCartContent();
  });
}

function closeCartModal() {
  if (cartModal) {
    cartModal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function renderCartContent() {
  if (!cartContent || !cartItemsList) return;
  const items = currentCart && Array.isArray(currentCart.items) ? currentCart.items : [];

  if (items.length === 0) {
    if (cartEmptyState) cartEmptyState.style.display = 'flex';
    cartContent.style.display = 'none';
    updateCartCountBadge(0);
    return;
  }

  if (cartEmptyState) cartEmptyState.style.display = 'none';
  cartContent.style.display = 'block';
  cartItemsList.innerHTML = '';

  items.forEach(item => {
    const p = item.product;
    if (!p) return;

    const row = document.createElement('div');
    row.className = 'cart-item-card';
    row.innerHTML = `
      <img src="${formatProductImageUrl(p.image)}" alt="${escapeHtml(p.name)}" class="cart-item-thumb"
        onerror="handleProductImageError(this, '${escapeHtml(p.image || '')}', '${escapeHtml(p.name || '')}')" />
      <div class="cart-item-info">
        <span class="cart-item-category">${escapeHtml(p.category)}</span>
        <h4 class="cart-item-name"><a href="product-details.html?id=${p._id}" style="color: inherit; text-decoration: none;">${escapeHtml(p.name)}</a></h4>
        <div class="cart-item-meta">
          <span class="cart-item-price">${currencyFormatter.format(p.price)}</span>
        </div>
      </div>
      <div class="cart-item-actions">
        <div class="cart-quantity-controls">
          <button type="button" class="cart-qty-btn cart-qty-minus" data-id="${p._id}">−</button>
          <span class="cart-qty-val">${item.quantity}</span>
          <button type="button" class="cart-qty-btn cart-qty-plus" data-id="${p._id}">+</button>
        </div>
        <button type="button" class="cart-item-remove-btn" data-id="${p._id}">✕ Remove</button>
      </div>
    `;

    row.querySelector('.cart-qty-minus')?.addEventListener('click', async () => {
      await updateCartItemQuantity(p._id, item.quantity - 1);
    });

    row.querySelector('.cart-qty-plus')?.addEventListener('click', async () => {
      await updateCartItemQuantity(p._id, item.quantity + 1);
    });

    row.querySelector('.cart-item-remove-btn')?.addEventListener('click', async () => {
      await updateCartItemQuantity(p._id, 0);
    });

    cartItemsList.appendChild(row);
  });

  if (cartTotalAmount) {
    cartTotalAmount.textContent = currencyFormatter.format(currentCart.totalAmount || 0);
  }
}

async function updateCartItemQuantity(productId, quantity) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const url = quantity > 0 ? `${API_BASE_URL}/cart/${productId}` : `${API_BASE_URL}/cart/${productId}`;
    const method = quantity > 0 ? 'PUT' : 'DELETE';
    const opts = {
      method,
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
    if (quantity > 0) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify({ quantity });
    }

    const response = await fetch(url, opts);
    const result = await response.json();

    if (response.ok && result.success) {
      currentCart = result.data;
      const totalItems = (currentCart.items || []).reduce((sum, item) => sum + item.quantity, 0);
      updateCartCountBadge(totalItems);
      renderCartContent();
    } else {
      showToast(result.message || 'Could not update item');
    }
  } catch (err) {
    console.error('Cart item update error:', err);
  }
}

// ============================================================
// Product Details Core Loader
// ============================================================

function showProductError(title, message) {
  if (pdLoadingState) pdLoadingState.style.display = 'none';
  if (pdContentSection) pdContentSection.style.display = 'none';
  if (pdErrorState) {
    pdErrorState.style.display = 'block';
    if (pdErrorTitle) pdErrorTitle.textContent = title || 'Product Not Found';
    if (pdErrorMessage) pdErrorMessage.textContent = message || 'Unable to retrieve product details.';
  }
  document.title = `${title || 'Error'} | MiniStore`;
}

async function loadProductDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  // Validate ObjectId format: exactly 24 hex characters
  const isValidId = typeof productId === 'string' && /^[0-9a-fA-F]{24}$/.test(productId);

  if (!productId || !isValidId) {
    showProductError(
      'Invalid Product ID',
      'The product link is missing or invalid. Please check the URL or browse our catalog for valid products.'
    );
    return;
  }

  // Show Loading state
  if (pdLoadingState) pdLoadingState.style.display = 'grid';
  if (pdErrorState) pdErrorState.style.display = 'none';
  if (pdContentSection) pdContentSection.style.display = 'none';

  try {
    const response = await fetch(`${API_BASE_URL}/products/${productId}`);
    const result = await response.json();

    if (!response.ok || !result.success || !result.data) {
      const msg = result.message || `Product not found (Status ${response.status})`;
      showProductError('Product Not Found', msg);
      return;
    }

    currentProduct = result.data;
    selectedQuantity = 1;

    renderProductDetails(currentProduct);
    fetchRelatedProducts(currentProduct._id, currentProduct.category);
  } catch (err) {
    console.error('Error fetching product details:', err);
    showProductError(
      'Network Error',
      'Could not connect to the backend server. Please verify the server is running on http://localhost:5000 and try again.'
    );
  }
}

function renderProductDetails(product) {
  if (!product) return;

  // 1. Page Title & Breadcrumbs
  document.title = `${product.name} | MiniStore`;
  if (bcCategory) {
    bcCategory.textContent = product.category || 'Catalog';
    bcCategory.href = `index.html?category=${encodeURIComponent(product.category || '')}`;
  }
  if (bcTitle) bcTitle.textContent = product.name;

  // 2. Images & Gallery
  if (pdMainImg) {
    pdMainImg.src = formatProductImageUrl(product.image);
    pdMainImg.alt = product.name;
    pdMainImg.onerror = () => handleProductImageError(pdMainImg, product.image, product.name);
  }

  // Multi-image thumbnails
  const allImages = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : (product.image ? [product.image] : []);

  if (pdThumbStrip) {
    if (allImages.length > 1) {
      pdThumbStrip.style.display = 'flex';
      pdThumbStrip.innerHTML = '';
      allImages.forEach((imgUrl, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `gallery-thumb-btn ${idx === 0 ? 'is-active' : ''}`;
        btn.innerHTML = `<img src="${formatProductImageUrl(imgUrl)}" alt="Thumbnail ${idx + 1}" />`;
        btn.addEventListener('click', () => {
          pdThumbStrip.querySelectorAll('.gallery-thumb-btn').forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          if (pdMainImg) pdMainImg.src = formatProductImageUrl(imgUrl);
        });
        pdThumbStrip.appendChild(btn);
      });
    } else {
      pdThumbStrip.style.display = 'none';
    }
  }

  // 3. Header Metadata
  if (pdCategoryPill) pdCategoryPill.textContent = product.category || 'General';
  if (pdBrandTag) {
    if (product.brand) {
      pdBrandTag.textContent = `Brand: ${product.brand}`;
      pdBrandTag.style.display = 'inline-block';
    } else {
      pdBrandTag.style.display = 'none';
    }
  }
  if (pdSkuTag) {
    if (product.sku) {
      pdSkuTag.textContent = `SKU: ${product.sku}`;
      pdSkuTag.style.display = 'inline-block';
    } else {
      pdSkuTag.style.display = 'none';
    }
  }

  if (pdTitle) pdTitle.textContent = product.name;

  // 4. Rating & Reviews
  const avgRating = Number(product.averageRating) || 0;
  const totalReviews = Number(product.totalReviews) || (product.reviews ? product.reviews.length : 0);
  if (pdRatingStars) pdRatingStars.innerHTML = renderStars(avgRating);
  if (pdRatingScore) pdRatingScore.textContent = avgRating.toFixed(1);
  if (pdReviewsLink) {
    pdReviewsLink.textContent = `(${totalReviews} ${totalReviews === 1 ? 'Customer Review' : 'Customer Reviews'})`;
  }
  if (pdReviewsChip) {
    pdReviewsChip.textContent = `${totalReviews} ${totalReviews === 1 ? 'Review' : 'Reviews'}`;
  }

  // 5. Pricing
  if (pdCurrentPrice) pdCurrentPrice.textContent = currencyFormatter.format(product.price);
  if (product.discountPrice && product.discountPrice > product.price) {
    if (pdOriginalPrice) {
      pdOriginalPrice.textContent = currencyFormatter.format(product.discountPrice);
      pdOriginalPrice.style.display = 'inline';
    }
    const pct = Math.round(((product.discountPrice - product.price) / product.discountPrice) * 100);
    if (pdDiscountPill) {
      pdDiscountPill.textContent = `Save ${pct}%`;
      pdDiscountPill.style.display = 'inline-block';
    }
  } else {
    if (pdOriginalPrice) pdOriginalPrice.style.display = 'none';
    if (pdDiscountPill) pdDiscountPill.style.display = 'none';
  }

  // 6. Stock Status
  const isOutOfStock = product.stock <= 0;
  if (pdStockBadge) {
    pdStockBadge.textContent = isOutOfStock ? 'Out of Stock' : 'In Stock';
    pdStockBadge.className = `stock-badge ${isOutOfStock ? 'badge-danger' : 'badge-success'}`;
  }
  if (pdStockText) {
    pdStockText.textContent = isOutOfStock
      ? 'Currently unavailable. Check back soon.'
      : `${product.stock} units available for immediate dispatch`;
  }

  // 7. Description
  if (pdDescription) pdDescription.textContent = product.description || 'No description provided.';

  // 8. Key Features
  if (pdFeaturesBox && pdFeaturesList) {
    if (Array.isArray(product.features) && product.features.length > 0) {
      pdFeaturesBox.style.display = 'block';
      pdFeaturesList.innerHTML = product.features
        .map(f => `<li class="feature-item"><span class="feature-check">✓</span> <span>${escapeHtml(f)}</span></li>`)
        .join('');
    } else {
      pdFeaturesBox.style.display = 'none';
    }
  }

  // 9. Specifications
  if (pdSpecsBox && pdSpecsTable) {
    const specs = product.specifications;
    if (specs && typeof specs === 'object' && Object.keys(specs).length > 0) {
      pdSpecsBox.style.display = 'block';
      const tbody = pdSpecsTable.querySelector('tbody') || pdSpecsTable;
      tbody.innerHTML = Object.entries(specs)
        .map(([k, v]) => `<tr><td class="spec-key">${escapeHtml(k)}</td><td class="spec-val">${escapeHtml(v)}</td></tr>`)
        .join('');
    } else {
      pdSpecsBox.style.display = 'none';
    }
  }

  // 10. Quantity Controls & Action Buttons
  selectedQuantity = 1;
  if (pdQtyInput) {
    pdQtyInput.value = '1';
    pdQtyInput.max = String(Math.max(product.stock, 1));
    pdQtyInput.disabled = isOutOfStock;
  }
  if (pdQtyMinus) pdQtyMinus.disabled = isOutOfStock;
  if (pdQtyPlus) pdQtyPlus.disabled = isOutOfStock || product.stock <= 1;

  if (pdAddCartBtn) {
    pdAddCartBtn.disabled = isOutOfStock;
    if (pdAddCartText) pdAddCartText.textContent = isOutOfStock ? 'Out of Stock' : 'Add to Cart';
  }

  updateWishlistButtonUI();

  // 11. Reviews Section
  renderReviewsSection(product);

  // Switch states
  if (pdLoadingState) pdLoadingState.style.display = 'none';
  if (pdErrorState) pdErrorState.style.display = 'none';
  if (pdContentSection) pdContentSection.style.display = 'block';
}

function renderReviewsSection(product) {
  if (!pdReviewsSummaryCard) return;

  const avgRating = Number(product.averageRating) || 0;
  const reviews = Array.isArray(product.reviews) ? product.reviews : [];
  const totalReviews = reviews.length;

  pdReviewsSummaryCard.innerHTML = `
    <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
      <div style="text-align: center; padding: 12px 20px; background: var(--color-bg-alt); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
        <div style="font-size: 2.2rem; font-weight: 800; color: var(--color-text-main); line-height: 1;">${avgRating.toFixed(1)}</div>
        <div style="font-size: 0.82rem; color: var(--color-text-muted); font-weight: 600;">out of 5 stars</div>
      </div>
      <div>
        <div style="font-size: 1.3rem; margin-bottom: 4px;">${renderStars(avgRating)}</div>
        <div style="font-size: 0.9rem; color: var(--color-text-muted);">
          Based on ${totalReviews} verified customer ${totalReviews === 1 ? 'review' : 'reviews'}
        </div>
      </div>
    </div>
  `;

  // Write a Review Form
  if (pdWriteReviewContainer) {
    const token = getAuthToken();
    if (!token) {
      pdWriteReviewContainer.innerHTML = `
        <div style="padding: 16px 20px; background: var(--color-bg-alt); border: 1px dashed var(--color-border); border-radius: var(--radius-md); margin-top: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: gap: 12px;">
          <span>Have you used this product? Log in to leave a verified review.</span>
          <button type="button" class="btn btn-secondary btn-sm" id="review-login-prompt-btn">Sign In to Review</button>
        </div>
      `;
      document.getElementById('review-login-prompt-btn')?.addEventListener('click', () => {
        openAuthModal('login', 'Please sign in to write a review.');
      });
    } else {
      pdWriteReviewContainer.innerHTML = `
        <form id="pd-review-form" style="padding: 20px; background: var(--color-bg-alt); border: 1px solid var(--color-border); border-radius: var(--radius-md); margin-top: 16px; display: flex; flex-direction: column; gap: 12px;">
          <h4 style="margin: 0; font-size: 1rem; font-weight: 700;">Write a Customer Review</h4>
          <div>
            <label class="form-label" style="margin-bottom: 6px;">Your Rating (1 to 5 Stars):</label>
            <div id="star-picker" style="font-size: 1.6rem; cursor: pointer; display: inline-flex; gap: 4px;">
              <span class="star-pick" data-val="1">★</span>
              <span class="star-pick" data-val="2">★</span>
              <span class="star-pick" data-val="3">★</span>
              <span class="star-pick" data-val="4">★</span>
              <span class="star-pick" data-val="5">★</span>
            </div>
            <input type="hidden" id="review-rating-val" value="5" />
          </div>
          <div>
            <label for="review-comment-val" class="form-label">Review Details:</label>
            <textarea id="review-comment-val" class="form-input" rows="3" required placeholder="Share your experience with this product..."></textarea>
          </div>
          <div style="display: flex; justify-content: flex-end;">
            <button type="submit" class="btn btn-primary btn-sm" id="review-submit-btn">Submit Review</button>
          </div>
        </form>
      `;

      // Star picker interaction
      let currentStar = 5;
      const stars = pdWriteReviewContainer.querySelectorAll('.star-pick');
      const updateStarUI = (val) => {
        stars.forEach((s, idx) => {
          s.style.color = idx < val ? '#f59e0b' : '#d1d5db';
        });
      };
      updateStarUI(currentStar);

      stars.forEach(s => {
        s.addEventListener('click', () => {
          currentStar = parseInt(s.getAttribute('data-val'), 10);
          document.getElementById('review-rating-val').value = currentStar;
          updateStarUI(currentStar);
        });
      });

      // Submit review handler
      document.getElementById('pd-review-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rating = parseInt(document.getElementById('review-rating-val').value, 10);
        const comment = document.getElementById('review-comment-val').value.trim();
        const submitBtn = document.getElementById('review-submit-btn');

        if (!comment) return;
        if (submitBtn) submitBtn.disabled = true;

        try {
          const res = await fetch(`${API_BASE_URL}/products/${product._id}/review`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ rating, comment })
          });
          const resJson = await res.json();

          if (res.ok && resJson.success) {
            showToast('✓ Review submitted successfully!');
            // Reload product details to update reviews
            loadProductDetails();
          } else {
            showToast(resJson.message || 'Failed to submit review.');
          }
        } catch (err) {
          showToast('Network error submitting review.');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }

  // Render Reviews List
  if (pdReviewsList) {
    if (reviews.length === 0) {
      pdReviewsList.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--color-text-muted); font-size: 0.9rem;">
          No customer reviews yet. Be the first to review this product!
        </div>
      `;
    } else {
      pdReviewsList.innerHTML = reviews.map(r => `
        <div class="review-item-card">
          <div class="review-item-header">
            <div class="review-author-cluster">
              <div class="review-author-avatar">${escapeHtml((r.name || 'C').charAt(0).toUpperCase())}</div>
              <div>
                <strong style="color: var(--color-text-main); font-size: 0.92rem;">${escapeHtml(r.name || 'Verified Customer')}</strong>
                <div style="font-size: 0.76rem; color: var(--color-text-muted);">${r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Verified Buyer'}</div>
              </div>
            </div>
            <div style="color: #f59e0b; font-size: 0.95rem;">${renderStars(r.rating)}</div>
          </div>
          <p style="margin: 0; font-size: 0.9rem; color: var(--color-text-main); line-height: 1.5;">${escapeHtml(r.comment)}</p>
        </div>
      `).join('');
    }
  }
}

async function fetchRelatedProducts(productId, category) {
  if (!pdRelatedGrid) return;

  try {
    const res = await fetch(`${API_BASE_URL}/products/${productId}/related?limit=4`);
    if (!res.ok) return;

    const result = await res.json();
    const related = result.data || [];

    if (related.length === 0) {
      const relatedSection = document.getElementById('related-section');
      if (relatedSection) relatedSection.style.display = 'none';
      return;
    }

    pdRelatedGrid.innerHTML = '';
    related.forEach(p => {
      const isWish = isProductInWishlist(p._id);
      const isOutOfStock = p.stock <= 0;
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <div class="card-media">
          <span class="category-badge">${escapeHtml(p.category)}</span>
          <button type="button" class="wishlist-heart-btn ${isWish ? 'is-active' : ''}" data-id="${p._id}" aria-label="Wishlist">
            <span class="heart-icon">${isWish ? '♥' : '♡'}</span>
          </button>
          <img src="${formatProductImageUrl(p.image)}" alt="${escapeHtml(p.name)}" class="card-image" loading="lazy"
            onerror="handleProductImageError(this, '${escapeHtml(p.image || '')}', '${escapeHtml(p.name || '')}')" />
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(p.name)}</h3>
          <p class="card-description">${escapeHtml(p.description)}</p>
          <div class="card-footer">
            <div class="price-tag">
              <span class="price-label">Price</span>
              <span class="price-value">${currencyFormatter.format(p.price)}</span>
            </div>
            <span class="stock-badge ${isOutOfStock ? 'badge-danger' : 'badge-success'}">${isOutOfStock ? 'Out of Stock' : 'In Stock'}</span>
          </div>
          <div class="card-actions">
            <a href="product-details.html?id=${p._id}" class="btn btn-secondary btn-sm" style="text-align: center; text-decoration: none;">View Details</a>
            <button type="button" class="btn btn-primary btn-sm btn-rel-cart" data-id="${p._id}" ${isOutOfStock ? 'disabled' : ''}>${isOutOfStock ? 'Out of Stock' : '+ Add'}</button>
          </div>
        </div>
      `;

      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        if (e.target.closest('.wishlist-heart-btn') || e.target.closest('.btn-rel-cart')) return;
        window.location.href = `product-details.html?id=${p._id}`;
      });

      card.querySelector('.btn-rel-cart')?.addEventListener('click', (e) => {
        e.stopPropagation();
        addToCart(p._id, 1, card.querySelector('.card-image'));
      });

      card.querySelector('.wishlist-heart-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleWishlistProduct(p._id);
        const inWishNow = isProductInWishlist(p._id);
        const heartBtn = card.querySelector('.wishlist-heart-btn');
        if (heartBtn) {
          heartBtn.classList.toggle('is-active', inWishNow);
          const icon = heartBtn.querySelector('.heart-icon');
          if (icon) icon.textContent = inWishNow ? '♥' : '♡';
        }
      });

      pdRelatedGrid.appendChild(card);
    });
  } catch (e) {
    console.error('Error fetching related products:', e);
  }
}

// ============================================================
// Event Listeners & Initialization
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  updateAuthUI();

  // If user is authenticated, synchronize cart and wishlist
  if (getAuthToken()) {
    fetchCart();
    fetchWishlist();
  }

  // Load the target product
  loadProductDetails();

  // Theme Toggle Button
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Navbar Cart Button
  if (navCartBtn) {
    navCartBtn.addEventListener('click', openCartModal);
  }

  // Cart Modal Close
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCartModal);
  if (cartContinueBtn) cartContinueBtn.addEventListener('click', closeCartModal);
  if (cartLoginPromptBtn) cartLoginPromptBtn.addEventListener('click', () => {
    closeCartModal();
    openAuthModal('login', 'Please sign in to view your shopping cart.');
  });
  if (cartCheckoutBtn) {
    cartCheckoutBtn.addEventListener('click', () => {
      closeCartModal();
      window.location.href = 'index.html';
    });
  }

  // Wishlist Navbar Button
  if (navWishlistBtn) {
    navWishlistBtn.addEventListener('click', openWishlistModal);
  }
  if (wishlistCloseBtn) wishlistCloseBtn.addEventListener('click', closeWishlistModal);
  if (wishlistLoginPromptBtn) wishlistLoginPromptBtn.addEventListener('click', () => {
    closeWishlistModal();
    openAuthModal('login', 'Please sign in to view your wishlist.');
  });

  // User Profile Trigger & Dropdown
  if (navProfileTriggerBtn) {
    navProfileTriggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProfileDropdown();
    });
  }

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#profile-nav-wrapper')) {
      closeProfileDropdown();
    }
  });

  // Login Button
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
      if (profileModal) {
        const u = getAuthUser();
        if (u) {
          if (profileNameInput) profileNameInput.value = u.name || '';
          if (profileEmailInput) profileEmailInput.value = u.email || '';
          if (profilePhoneInput) profilePhoneInput.value = u.phone || '';
        }
        profileModal.style.display = 'flex';
      }
    });
  }
  if (profileCloseBtn) profileCloseBtn.addEventListener('click', () => { profileModal.style.display = 'none'; });
  if (profileCloseActionBtn) profileCloseActionBtn.addEventListener('click', () => { profileModal.style.display = 'none'; });

  // Auth Modal Controls
  if (authCloseBtn) authCloseBtn.addEventListener('click', closeAuthModal);
  if (tabLoginBtn) tabLoginBtn.addEventListener('click', () => openAuthModal('login'));
  if (tabRegisterBtn) tabRegisterBtn.addEventListener('click', () => openAuthModal('register'));

  // Auth Modal Outside Click
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuthModal();
    });
  }

  // Login Form Submit
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authErrorAlert.style.display = 'none';
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const resJson = await res.json().catch(() => ({}));

        if (!res.ok || !resJson.success) {
          authErrorAlert.textContent = resJson.message || 'Login failed';
          authErrorAlert.style.display = 'block';
          return;
        }

        localStorage.setItem('token', resJson.token);
        localStorage.setItem('user', JSON.stringify(resJson.user));
        updateAuthUI();
        closeAuthModal();
        showToast(`Welcome back, ${resJson.user.name}!`);
        await fetchCart();
        await fetchWishlist();
        if (currentProduct) renderReviewsSection(currentProduct);
      } catch (err) {
        authErrorAlert.textContent = 'Server connection error. Please try again.';
        authErrorAlert.style.display = 'block';
      }
    });
  }

  // Register Form Submit
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authErrorAlert.style.display = 'none';
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;

      try {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        const resJson = await res.json().catch(() => ({}));

        if (!res.ok || !resJson.success) {
          authErrorAlert.textContent = resJson.message || 'Registration failed';
          authErrorAlert.style.display = 'block';
          return;
        }

        // Log in immediately
        const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const loginJson = await loginRes.json().catch(() => ({}));

        if (loginRes.ok && loginJson.success) {
          localStorage.setItem('token', loginJson.token);
          localStorage.setItem('user', JSON.stringify(loginJson.user));
          updateAuthUI();
          closeAuthModal();
          showToast(`Account created! Welcome, ${loginJson.user.name}!`);
          await fetchCart();
          await fetchWishlist();
        } else {
          openAuthModal('login', 'Account created! Please sign in.');
        }
      } catch (err) {
        authErrorAlert.textContent = 'Server connection error. Please try again.';
        authErrorAlert.style.display = 'block';
      }
    });
  }

  // ============================================================
  // Live Search Autocomplete System (product-details.html)
  // ============================================================
  let suggestionDebounceTimer = null;
  let activeSuggestionIndex = -1;
  let currentSuggestionsList = [];
  let latestSuggestionRequestId = 0;
  let suggestionAbortController = null;

  window.handleSuggestionImageError = function (img) {
    if (!img) return;
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent) {
      parent.innerHTML = '<span class="suggestion-thumb-fallback" aria-hidden="true">📦</span>';
    }
  };

  function closeSuggestionsDropdown() {
    if (!searchSuggestionsDropdown) return;
    searchSuggestionsDropdown.style.display = 'none';
    searchSuggestionsDropdown.innerHTML = '';
    currentSuggestionsList = [];
    activeSuggestionIndex = -1;
    if (searchInput) {
      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.removeAttribute('aria-activedescendant');
    }
  }

  function highlightMatch(text, query) {
    if (!text) return '';
    if (!query || !query.trim()) return escapeHtml(text);
    const safeText = escapeHtml(text);
    const tokens = query.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return safeText;
    const escapedTokens = tokens.map((t) => t.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'));
    const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
    return safeText.replace(regex, '<span class="suggestion-highlight">$1</span>');
  }

  function renderSuggestionsDropdown(suggestions, query, totalMatches = 0, hasMore = false) {
    if (!searchSuggestionsDropdown) return;

    if (!suggestions || suggestions.length === 0) {
      const emptyHtml = `
        <div class="suggestions-status-message suggestions-empty" role="status">
          <span class="suggestions-empty-icon" aria-hidden="true">🔍</span>
          <span class="suggestions-empty-title">No matching products found</span>
          <span class="suggestions-empty-sub">Try checking your spelling or using different keywords</span>
        </div>
      `;
      searchSuggestionsDropdown.innerHTML = emptyHtml;
      searchSuggestionsDropdown.style.display = 'block';
      if (searchInput) {
        searchInput.setAttribute('aria-expanded', 'true');
        searchInput.removeAttribute('aria-activedescendant');
      }
      currentSuggestionsList = [];
      activeSuggestionIndex = -1;
      return;
    }

    currentSuggestionsList = suggestions;
    activeSuggestionIndex = -1;

    let html = '<ul class="suggestions-list" role="listbox" id="suggestions-list-box">';
    suggestions.forEach((item, index) => {
      const highlightedName = highlightMatch(item.name, query);
      const categoryLabel = item.category ? escapeHtml(item.category) : '';
      const priceLabel = item.price ? `₹${item.price.toLocaleString('en-IN')}` : '';
      const imgUrl = formatProductImageUrl(item.image);
      const isOutOfStock = typeof item.stock === 'number' && item.stock <= 0;
      const stockTag = isOutOfStock
        ? '<span class="suggestion-stock-tag out-of-stock">Out of stock</span>'
        : (item.stock && item.stock <= 5 ? `<span class="suggestion-stock-tag">Only ${item.stock} left</span>` : '');

      html += `
        <li class="suggestion-item" role="option" id="suggestion-item-${index}" data-index="${index}" data-id="${item.id || item._id}" data-name="${escapeHtml(item.name)}" aria-selected="false">
          <div class="suggestion-thumb-wrap">
            <img
              src="${imgUrl}"
              alt="${escapeHtml(item.name)}"
              class="suggestion-thumb"
              loading="lazy"
              onerror="handleSuggestionImageError(this)"
            />
          </div>
          <div class="suggestion-info">
            <div class="suggestion-name">${highlightedName}</div>
            <div class="suggestion-meta">
              ${categoryLabel ? `<span class="suggestion-category">${categoryLabel}</span>` : ''}
              ${stockTag}
            </div>
          </div>
          <div class="suggestion-price-col">
            ${priceLabel ? `<span class="suggestion-price">${priceLabel}</span>` : ''}
          </div>
        </li>
      `;
    });
    html += '</ul>';

    const displayTotal = totalMatches || suggestions.length;
    html += `
      <div class="suggestions-footer">
        <div class="suggestions-footer-info">
          <span>${displayTotal} matching ${displayTotal === 1 ? 'product' : 'products'}</span>
          ${hasMore ? `<button type="button" class="suggestions-view-all-btn" id="suggestions-view-all-btn" title="View all matching products">View all results ➔</button>` : ''}
        </div>
        <div class="suggestions-footer-keys" aria-hidden="true">
          <span class="suggestions-key-badge">↑↓</span> navigate
          <span class="suggestions-key-badge">↵</span> select
          <span class="suggestions-key-badge">esc</span> dismiss
        </div>
      </div>
    `;

    searchSuggestionsDropdown.innerHTML = html;
    searchSuggestionsDropdown.style.display = 'block';
    if (searchInput) {
      searchInput.setAttribute('aria-expanded', 'true');
    }

    const items = searchSuggestionsDropdown.querySelectorAll('.suggestion-item');
    items.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const productId = item.dataset.id;
        if (productId) {
          closeSuggestionsDropdown();
          window.location.href = `product-details.html?id=${encodeURIComponent(productId)}`;
        }
      });

      item.addEventListener('mouseenter', () => {
        const idx = parseInt(item.dataset.index, 10);
        activeSuggestionIndex = idx;
        updateHighlightedSuggestion();
      });
    });

    const viewAllBtn = searchSuggestionsDropdown.querySelector('#suggestions-view-all-btn');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSuggestionsDropdown();
        submitSearchRedirect(query);
      });
    }
  }

  function updateHighlightedSuggestion() {
    if (!searchSuggestionsDropdown) return;
    const items = searchSuggestionsDropdown.querySelectorAll('.suggestion-item');
    items.forEach((item, idx) => {
      const isSelected = idx === activeSuggestionIndex;
      item.classList.toggle('is-selected', isSelected);
      item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      if (isSelected) {
        item.scrollIntoView({ block: 'nearest' });
        if (searchInput) {
          searchInput.setAttribute('aria-activedescendant', `suggestion-item-${idx}`);
        }
      }
    });

    if (activeSuggestionIndex === -1 && searchInput) {
      searchInput.removeAttribute('aria-activedescendant');
    }
  }

  function submitSearchRedirect(query) {
    const q = (query !== undefined ? query : (searchInput ? searchInput.value : '')).trim();
    closeSuggestionsDropdown();
    if (q) {
      window.location.href = `index.html?search=${encodeURIComponent(q)}`;
    }
  }

  async function fetchSuggestions(query) {
    const trimmed = (query || '').trim();
    if (!trimmed || trimmed.length < 1) {
      closeSuggestionsDropdown();
      return;
    }

    if (suggestionAbortController) {
      suggestionAbortController.abort();
    }
    suggestionAbortController = new AbortController();
    const currentRequestId = ++latestSuggestionRequestId;

    try {
      const response = await fetch(`${API_BASE_URL}/products/suggestions?q=${encodeURIComponent(trimmed)}&limit=12`, {
        signal: suggestionAbortController.signal
      });

      if (currentRequestId !== latestSuggestionRequestId) return;
      if (!response.ok) {
        closeSuggestionsDropdown();
        return;
      }

      const result = await response.json();
      if (!searchInput || searchInput.value.trim().length < 1) {
        closeSuggestionsDropdown();
        return;
      }

      if (result.success && Array.isArray(result.data)) {
        renderSuggestionsDropdown(result.data, trimmed, result.totalMatches, result.hasMore);
      } else {
        closeSuggestionsDropdown();
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.debug('Autocomplete fetch error:', error);
      if (currentRequestId === latestSuggestionRequestId) {
        closeSuggestionsDropdown();
      }
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      clearSearchBtn.style.display = e.target.value ? 'block' : 'none';

      clearTimeout(suggestionDebounceTimer);
      if (query.length < 1) {
        closeSuggestionsDropdown();
      } else {
        suggestionDebounceTimer = setTimeout(() => {
          fetchSuggestions(query);
        }, 220);
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      const isDropdownVisible = searchSuggestionsDropdown && searchSuggestionsDropdown.style.display === 'block';

      if (e.key === 'ArrowDown') {
        if (isDropdownVisible && currentSuggestionsList.length > 0) {
          e.preventDefault();
          activeSuggestionIndex = (activeSuggestionIndex + 1) % currentSuggestionsList.length;
          updateHighlightedSuggestion();
          return;
        }
      } else if (e.key === 'ArrowUp') {
        if (isDropdownVisible && currentSuggestionsList.length > 0) {
          e.preventDefault();
          if (activeSuggestionIndex <= 0) {
            activeSuggestionIndex = currentSuggestionsList.length - 1;
          } else {
            activeSuggestionIndex--;
          }
          updateHighlightedSuggestion();
          return;
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isDropdownVisible && activeSuggestionIndex >= 0 && activeSuggestionIndex < currentSuggestionsList.length) {
          const selected = currentSuggestionsList[activeSuggestionIndex];
          const selectedId = selected.id || selected._id;
          closeSuggestionsDropdown();
          if (selectedId) {
            window.location.href = `product-details.html?id=${encodeURIComponent(selectedId)}`;
          }
          return;
        }
        submitSearchRedirect(searchInput.value);
        return;
      } else if (e.key === 'Escape') {
        if (isDropdownVisible) {
          e.preventDefault();
          closeSuggestionsDropdown();
          return;
        }
      } else if (e.key === 'Tab') {
        closeSuggestionsDropdown();
      }
    });
  }

  if (searchSubmitBtn) {
    searchSubmitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      submitSearchRedirect(searchInput ? searchInput.value : '');
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      clearTimeout(suggestionDebounceTimer);
      if (suggestionAbortController) suggestionAbortController.abort();
      closeSuggestionsDropdown();
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      searchInput.focus();
    });
  }

  document.addEventListener('click', (e) => {
    if (navSearchWrap && !navSearchWrap.contains(e.target)) {
      closeSuggestionsDropdown();
    }
  });

  // Quantity controls
  if (pdQtyMinus) {
    pdQtyMinus.addEventListener('click', () => {
      if (selectedQuantity > 1) {
        selectedQuantity--;
        if (pdQtyInput) pdQtyInput.value = selectedQuantity;
      }
    });
  }

  if (pdQtyPlus) {
    pdQtyPlus.addEventListener('click', () => {
      const maxStock = currentProduct ? currentProduct.stock : 99;
      if (selectedQuantity < maxStock) {
        selectedQuantity++;
        if (pdQtyInput) pdQtyInput.value = selectedQuantity;
      } else {
        showToast(`Maximum available stock is ${maxStock}`);
      }
    });
  }

  if (pdQtyInput) {
    pdQtyInput.addEventListener('change', () => {
      const maxStock = currentProduct ? currentProduct.stock : 99;
      let val = parseInt(pdQtyInput.value, 10) || 1;
      val = Math.max(1, Math.min(val, maxStock));
      selectedQuantity = val;
      pdQtyInput.value = val;
    });
  }

  // Add to Cart Button
  if (pdAddCartBtn) {
    pdAddCartBtn.addEventListener('click', () => {
      if (currentProduct && currentProduct.stock > 0) {
        addToCart(currentProduct._id, selectedQuantity, pdMainImg);
      }
    });
  }

  // Wishlist Button
  if (pdWishlistBtn) {
    pdWishlistBtn.addEventListener('click', () => {
      if (currentProduct) {
        toggleWishlistProduct(currentProduct._id, pdWishlistBtn);
      }
    });
  }

  // Error retry button
  if (pdErrorRetryBtn) {
    pdErrorRetryBtn.addEventListener('click', loadProductDetails);
  }
});
