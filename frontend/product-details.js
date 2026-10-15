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
const pdVariantsContainer = document.getElementById('pd-variants-container');
const pdVariantsGroups = document.getElementById('pd-variants-groups');
let selectedVariant = null;
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

// DOM Elements - Product Q&A Subsystem
const pdQaSection = document.getElementById('qa-section');
const pdQaChip = document.getElementById('pd-qa-chip');
const pdAskQuestionTriggerBtn = document.getElementById('pd-ask-question-trigger-btn');
const pdQaSearchInput = document.getElementById('pd-qa-search-input');
const pdQaSearchClear = document.getElementById('pd-qa-search-clear');
const pdAskQuestionFormCard = document.getElementById('pd-ask-question-form-card');
const pdCloseAskQuestionBtn = document.getElementById('pd-close-ask-question-btn');
const pdCancelAskQuestionBtn = document.getElementById('pd-cancel-ask-question-btn');
const pdAskQuestionForm = document.getElementById('pd-ask-question-form');
const pdQuestionInput = document.getElementById('pd-question-input');
const pdQuestionCharCount = document.getElementById('pd-question-char-count');
const pdSubmitQuestionBtn = document.getElementById('pd-submit-question-btn');
const pdQaLoading = document.getElementById('pd-qa-loading');
const pdQaEmpty = document.getElementById('pd-qa-empty');
const pdEmptyAskBtn = document.getElementById('pd-empty-ask-btn');
const pdQaList = document.getElementById('pd-qa-list');

let productQuestions = [];
let qaSearchQuery = '';

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
    const navAdminBtn = document.getElementById('nav-admin-btn');
    const navSellerBtn = document.getElementById('nav-seller-btn');
    if (navAdminBtn) navAdminBtn.style.display = 'none';
    if (navSellerBtn) navSellerBtn.style.display = 'none';
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

async function addToCart(productId, quantity = 1, visualElement = null, variantPayload = null) {
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
    const varObj = variantPayload || (selectedVariant && selectedVariant.variantId ? selectedVariant : null);
    const bodyPayload = { productId, quantity };
    if (varObj) {
      bodyPayload.selectedVariant = {
        variantId: varObj.variantId,
        sku: varObj.sku || null,
        title: varObj.title || null,
        price: varObj.price,
        attributes: varObj.attributes || null
      };
    }

    const response = await fetch(`${API_BASE_URL}/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(bodyPayload)
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
    const activeStock = (selectedVariant && typeof selectedVariant.stock === 'number')
      ? selectedVariant.stock
      : (currentProduct ? currentProduct.stock : 0);
    if (pdAddCartBtn && activeStock > 0) {
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

  let grandTotal = 0;
  items.forEach(item => {
    const p = item.product;
    if (!p) return;

    const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (item.price !== undefined ? item.price : (Number(p.price) || 0));
    const regularPrice = item.regularPrice || Number(p.price) || unitPrice;
    const isDiscounted = item.isFestiveDiscount || (unitPrice < regularPrice);
    const subtotal = item.subtotal !== undefined ? item.subtotal : (unitPrice * (item.quantity || 1));
    grandTotal += subtotal;

    const varId = item.selectedVariant?.variantId || null;
    const row = document.createElement('div');
    row.className = 'cart-item-card';
    row.innerHTML = `
      <img src="${formatProductImageUrl(p.image)}" alt="${escapeHtml(p.name)}" class="cart-item-thumb"
        onerror="handleProductImageError(this, '${escapeHtml(p.image || '')}', '${escapeHtml(p.name || '')}')" />
      <div class="cart-item-info">
        <span class="cart-item-category">${escapeHtml(p.category)}</span>
        <h4 class="cart-item-name"><a href="product-details.html?id=${p._id}" style="color: inherit; text-decoration: none;">${escapeHtml(p.name)}</a></h4>
        ${item.selectedVariant && item.selectedVariant.title ? `<div class="cart-item-variant" style="font-size: 0.78rem; color: var(--color-primary, #2563eb); font-weight: 600; margin-top: 2px;">Variant: ${escapeHtml(item.selectedVariant.title)}</div>` : ''}
        <div class="cart-item-meta" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span class="cart-item-price" style="font-weight: 700; color: ${isDiscounted ? '#10b981' : 'inherit'};">${currencyFormatter.format(unitPrice)}</span>
          ${isDiscounted ? `<span style="text-decoration: line-through; color: var(--color-text-muted); font-size: 0.85em;">${currencyFormatter.format(regularPrice)}</span>` : ''}
          ${isDiscounted ? `<span style="color: #10b981; font-size: 0.72rem; font-weight: 700; background: rgba(16, 185, 129, 0.12); padding: 1px 5px; border-radius: 4px;">Festive Deal</span>` : ''}
        </div>
      </div>
      <div class="cart-item-actions">
        <span class="cart-item-subtotal" style="font-weight: 700;">${currencyFormatter.format(subtotal)}</span>
        <div class="cart-quantity-controls">
          <button type="button" class="cart-qty-btn cart-qty-minus" data-id="${p._id}">−</button>
          <span class="cart-qty-val">${item.quantity}</span>
          <button type="button" class="cart-qty-btn cart-qty-plus" data-id="${p._id}">+</button>
        </div>
        <button type="button" class="cart-item-remove-btn" data-id="${p._id}">✕ Remove</button>
      </div>
    `;

    row.querySelector('.cart-qty-minus')?.addEventListener('click', async () => {
      await updateCartItemQuantity(p._id, item.quantity - 1, varId);
    });

    row.querySelector('.cart-qty-plus')?.addEventListener('click', async () => {
      await updateCartItemQuantity(p._id, item.quantity + 1, varId);
    });

    row.querySelector('.cart-item-remove-btn')?.addEventListener('click', async () => {
      await updateCartItemQuantity(p._id, 0, varId);
    });

    cartItemsList.appendChild(row);
  });

  if (cartTotalAmount) {
    const finalTotal = grandTotal > 0 ? grandTotal : (currentCart.totalAmount || 0);
    cartTotalAmount.textContent = currencyFormatter.format(finalTotal);
  }
}

async function updateCartItemQuantity(productId, quantity, variantId = null) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const url = variantId
      ? `${API_BASE_URL}/cart/${productId}?variantId=${encodeURIComponent(variantId)}`
      : `${API_BASE_URL}/cart/${productId}`;
    const method = quantity > 0 ? 'PUT' : 'DELETE';
    const opts = {
      method,
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
    if (quantity > 0) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify({ quantity, ...(variantId ? { variantId } : {}) });
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
    fetchProductQA(currentProduct._id);
  } catch (err) {
    console.error('Error fetching product details:', err);
    showProductError(
      'Network Error',
      'Could not connect to the backend server. Please verify the server is running on http://localhost:5000 and try again.'
    );
  }
}

function renderVariantsSelector(product) {
  if (!pdVariantsContainer || !pdVariantsGroups) return;

  if (!Array.isArray(product.variants) || product.variants.length === 0) {
    pdVariantsContainer.style.display = 'none';
    selectedVariant = null;
    return;
  }

  pdVariantsContainer.style.display = 'block';

  // Pre-select the first in-stock variant by default, or the first variant if none are in stock
  selectedVariant = product.variants.find(v => v.stock > 0) || product.variants[0];

  function updateVariantUI() {
    if (!selectedVariant) return;

    // 1. Dynamically update the displayed price
    if (pdCurrentPrice) {
      pdCurrentPrice.textContent = currencyFormatter.format(selectedVariant.price);
    }

    // 2. Dynamically update the stock badge ("In Stock (X left)" vs "Out of Stock")
    const varStock = typeof selectedVariant.stock === 'number' ? selectedVariant.stock : 0;
    const isOut = varStock <= 0;
    if (pdStockBadge) {
      pdStockBadge.textContent = isOut ? 'Out of Stock' : (varStock <= 5 ? `In Stock (${varStock} left)` : 'In Stock');
      pdStockBadge.className = `stock-badge ${isOut ? 'badge-danger' : 'badge-success'}`;
    }
    if (pdStockText) {
      pdStockText.textContent = isOut
        ? 'Selected option is currently out of stock.'
        : `${varStock} units available for this selection`;
    }

    // 3. Dynamically update the main product image if the variant has its own image
    if (selectedVariant.image && pdMainImg) {
      pdMainImg.src = formatProductImageUrl(selectedVariant.image);
    } else if (product.image && pdMainImg) {
      pdMainImg.src = formatProductImageUrl(product.image);
    }

    // 4. Update SKU tag if variant defines one
    if (pdSkuTag) {
      if (selectedVariant.sku) {
        pdSkuTag.textContent = `SKU: ${selectedVariant.sku}`;
        pdSkuTag.style.display = 'inline-block';
      } else if (product.sku) {
        pdSkuTag.textContent = `SKU: ${product.sku}`;
        pdSkuTag.style.display = 'inline-block';
      }
    }

    // 5. Disable the "Add to Cart" button if the selected variant stock is 0
    if (pdAddCartBtn) {
      pdAddCartBtn.disabled = isOut;
      if (pdAddCartText) pdAddCartText.textContent = isOut ? 'Out of Stock' : 'Add to Cart';
    }

    // 6. Adjust quantity limits
    if (pdQtyInput) {
      pdQtyInput.max = String(Math.max(varStock, 1));
      pdQtyInput.disabled = isOut;
      if (parseInt(pdQtyInput.value, 10) > varStock) {
        pdQtyInput.value = isOut ? '1' : String(varStock);
        selectedQuantity = parseInt(pdQtyInput.value, 10);
      }
    }
    if (pdQtyMinus) pdQtyMinus.disabled = isOut;
    if (pdQtyPlus) pdQtyPlus.disabled = isOut || varStock <= 1;

    // 7. Update pill styling for active state
    pdVariantsGroups.querySelectorAll('.variant-chip-btn').forEach(btn => {
      const vid = btn.getAttribute('data-variant-id');
      if (vid === selectedVariant.variantId) {
        btn.classList.add('active');
        btn.style.borderColor = 'var(--color-primary, #2563eb)';
        btn.style.backgroundColor = 'rgba(37, 99, 235, 0.08)';
        btn.style.boxShadow = '0 0 0 2px var(--color-primary, #2563eb)';
      } else {
        btn.classList.remove('active');
        btn.style.borderColor = 'var(--color-border, #d1d5db)';
        btn.style.backgroundColor = 'var(--color-bg, #ffffff)';
        btn.style.boxShadow = 'none';
      }
    });
  }

  // Render pill/chip buttons
  pdVariantsGroups.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
      <span style="font-size: 0.9rem; font-weight: 700; color: var(--color-text-main);">Available Options / Variants</span>
      <span style="font-size: 0.8rem; color: var(--color-text-muted);">${product.variants.length} option(s)</span>
    </div>
    <div class="variant-chips-wrap" style="display: flex; flex-wrap: wrap; gap: 8px;">
      ${product.variants.map(v => {
        let label = v.title;
        if (!label && v.attributes) {
          const parts = [];
          if (v.attributes.size) parts.push(`Size: ${v.attributes.size}`);
          if (v.attributes.color) parts.push(`Color: ${v.attributes.color}`);
          if (v.attributes.storage) parts.push(`Storage: ${v.attributes.storage}`);
          label = parts.length > 0 ? parts.join(' / ') : v.variantId;
        }
        if (!label) label = v.variantId;

        const isOut = (v.stock || 0) <= 0;
        return `
          <button
            type="button"
            class="variant-chip-btn ${isOut ? 'is-out-of-stock' : ''}"
            data-variant-id="${escapeHtml(v.variantId)}"
            style="padding: 7px 14px; border-radius: 9999px; border: 1px solid var(--color-border, #d1d5db); background: var(--color-bg, #ffffff); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 0.86rem; transition: all 0.2s ease; ${isOut ? 'opacity: 0.6; text-decoration: line-through;' : ''}"
          >
            <span style="font-weight: 600;">${escapeHtml(label)}</span>
            <span style="font-weight: 700; color: var(--color-primary, #2563eb); font-size: 0.82rem;">${currencyFormatter.format(v.price)}</span>
            ${isOut ? '<span style="font-size: 0.72rem; color: #ef4444; font-weight: 700; text-decoration: none;">(Sold out)</span>' : ''}
          </button>
        `;
      }).join('')}
    </div>
  `;

  pdVariantsGroups.querySelectorAll('.variant-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const vid = btn.getAttribute('data-variant-id');
      const found = product.variants.find(v => v.variantId === vid);
      if (found) {
        selectedVariant = found;
        updateVariantUI();
      }
    });
  });

  updateVariantUI();
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

  // 9.5 Optional Variants Selector (Size, Color, Storage)
  renderVariantsSelector(product);

  // 10. Quantity Controls & Action Buttons
  selectedQuantity = 1;
  const initialStock = (selectedVariant && typeof selectedVariant.stock === 'number')
    ? selectedVariant.stock
    : product.stock;
  const initialOutOfStock = initialStock <= 0;

  if (pdQtyInput) {
    pdQtyInput.value = '1';
    pdQtyInput.max = String(Math.max(initialStock, 1));
    pdQtyInput.disabled = initialOutOfStock;
  }
  if (pdQtyMinus) pdQtyMinus.disabled = initialOutOfStock;
  if (pdQtyPlus) pdQtyPlus.disabled = initialOutOfStock || initialStock <= 1;

  if (pdAddCartBtn) {
    pdAddCartBtn.disabled = initialOutOfStock;
    if (pdAddCartText) pdAddCartText.textContent = initialOutOfStock ? 'Out of Stock' : 'Add to Cart';
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

// ============================================================
// Product Q&A Subsystem (Customer Questions & Answers)
// ============================================================

async function fetchProductQA(productId) {
  if (!pdQaSection || !productId) return;

  if (pdQaLoading) pdQaLoading.style.display = 'block';
  if (pdQaEmpty) pdQaEmpty.style.display = 'none';
  if (pdQaList) pdQaList.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE_URL}/products/${productId}/questions`);
    if (!res.ok) {
      if (pdQaLoading) pdQaLoading.style.display = 'none';
      return;
    }

    const data = await res.json();
    productQuestions = Array.isArray(data.data) ? data.data : [];

    if (pdQaChip) {
      pdQaChip.textContent = `${productQuestions.length} Question${productQuestions.length === 1 ? '' : 's'}`;
    }

    renderProductQA();
  } catch (err) {
    console.error('Error fetching questions:', err);
  } finally {
    if (pdQaLoading) pdQaLoading.style.display = 'none';
  }
}

function renderProductQA() {
  if (!pdQaList) return;

  const currentUser = getAuthUser();
  const currentUserId = currentUser ? String(currentUser.id || currentUser._id) : null;

  // Filter by search query if any
  const query = (qaSearchQuery || '').trim().toLowerCase();
  let displayedQuestions = productQuestions;

  if (query) {
    displayedQuestions = productQuestions.filter(q => {
      const qMatch = (q.questionText || '').toLowerCase().includes(query);
      const authorMatch = (q.userName || '').toLowerCase().includes(query);
      const aMatch = Array.isArray(q.answers) && q.answers.some(a =>
        (a.answerText || '').toLowerCase().includes(query) || (a.userName || '').toLowerCase().includes(query)
      );
      return qMatch || authorMatch || aMatch;
    });
  }

  if (displayedQuestions.length === 0) {
    if (pdQaEmpty) {
      pdQaEmpty.style.display = 'block';
      const emptyTitle = pdQaEmpty.querySelector('.qa-empty-title');
      const emptyDesc = pdQaEmpty.querySelector('.qa-empty-desc');
      if (emptyTitle && emptyDesc) {
        if (query) {
          emptyTitle.textContent = 'No matching questions found';
          emptyDesc.textContent = `No questions or answers matched "${escapeHtml(query)}". Try different keywords or ask your own question.`;
        } else {
          emptyTitle.textContent = 'No questions yet';
          emptyDesc.textContent = 'Have a question about this product? Ask the community and verified sellers.';
        }
      }
    }
    pdQaList.innerHTML = '';
    return;
  }

  if (pdQaEmpty) pdQaEmpty.style.display = 'none';

  pdQaList.innerHTML = displayedQuestions.map(q => {
    const qDate = q.createdAt ? new Date(q.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const answers = Array.isArray(q.answers) ? q.answers : [];

    const answersHtml = answers.length > 0 ? answers.map(a => {
      const aDate = a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      const isAdmin = a.userRole === 'admin';
      const isVerified = a.isVerifiedSeller || a.userRole === 'seller';
      const upvotedByList = Array.isArray(a.upvotedBy) ? a.upvotedBy.map(id => String(id)) : [];
      const hasUpvoted = currentUserId && upvotedByList.includes(currentUserId);

      // Official Role Badges
      let badgeHtml = '';
      if (isAdmin) {
        badgeHtml = `<span class="badge-admin" title="MiniStore Administrator"><i class="fas fa-shield-alt"></i> ✓ Admin</span>`;
      } else if (isVerified) {
        badgeHtml = `<span class="badge-verified-merchant" title="Verified Merchant / Seller"><i class="fas fa-check-circle"></i> ✓ Verified Merchant</span>`;
      }

      const cardClass = isAdmin ? 'qa-answer-card is-admin-answer' : (isVerified ? 'qa-answer-card is-merchant-answer' : 'qa-answer-card');

      return `
        <div class="${cardClass}" id="qa-answer-${a.answerId}">
          <div class="qa-answer-header">
            <div class="qa-answer-author-cluster">
              <span class="qa-answer-author-name">${escapeHtml(a.userName || 'Shopper')}</span>
              ${badgeHtml}
            </div>
            <span class="qa-answer-date">${aDate}</span>
          </div>
          <div class="qa-answer-text">${escapeHtml(a.answerText)}</div>
          <div class="qa-answer-footer">
            <button type="button" class="btn-qa-upvote ${hasUpvoted ? 'has-upvoted' : ''}" 
                    data-qid="${q.questionId}" data-aid="${a.answerId}" data-upvotes="${a.upvotes || 0}"
                    title="${hasUpvoted ? 'Remove helpful vote' : 'Mark answer as helpful'}">
              <i class="fas fa-thumbs-up btn-qa-upvote-icon"></i> 
              <span class="qa-upvote-label">Helpful</span> 
              (<span class="qa-upvote-count">${a.upvotes || 0}</span>)
            </button>
          </div>
        </div>
      `;
    }).join('') : `
      <div class="qa-no-answers-box">No answers yet. Be the first to answer this question!</div>
    `;

    return `
      <div class="qa-card" id="qa-question-${q.questionId}">
        <div class="qa-question-row">
          <div class="qa-pill-q">Q</div>
          <div class="qa-question-body">
            <h4 class="qa-question-text">${escapeHtml(q.questionText)}</h4>
            <div class="qa-question-meta">
              <span>Asked by <strong>${escapeHtml(q.userName || 'Customer')}</strong></span>
              <span class="qa-meta-sep">•</span>
              <span>${qDate}</span>
              <span class="qa-meta-sep">•</span>
              <span>${answers.length} ${answers.length === 1 ? 'Answer' : 'Answers'}</span>
            </div>
          </div>
        </div>

        <!-- Answers Section -->
        <div class="qa-answers-container">
          ${answersHtml}

          <!-- Answer Accordion Toggle & Form -->
          <div class="qa-reply-wrapper" style="margin-top: 8px;">
            <button type="button" class="qa-reply-toggle-btn" data-qid="${q.questionId}">
              <i class="fas fa-reply"></i> Answer this question
            </button>
            <div class="qa-reply-form-box" id="qa-reply-box-${q.questionId}" style="display: none;">
              <form class="qa-reply-form" data-qid="${q.questionId}">
                <div class="qa-form-group">
                  <textarea class="qa-form-textarea qa-reply-textarea" rows="2" maxlength="1000" 
                            placeholder="Write your answer clearly and concisely (fellow shoppers appreciate helpful advice)..." required></textarea>
                  <div class="qa-form-hints">
                    <span>Answers are reviewed and publicly visible.</span>
                    <span class="qa-reply-char-count">0/1000</span>
                  </div>
                </div>
                <div class="qa-form-actions">
                  <button type="button" class="btn btn-secondary btn-sm qa-reply-cancel-btn" data-qid="${q.questionId}">Cancel</button>
                  <button type="submit" class="btn btn-primary btn-sm qa-reply-submit-btn">
                    <i class="fas fa-paper-plane"></i> Submit Answer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  attachQaDynamicEventListeners();
}

function attachQaDynamicEventListeners() {
  if (!pdQaList) return;

  // Upvote buttons
  const upvoteBtns = pdQaList.querySelectorAll('.btn-qa-upvote');
  upvoteBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const questionId = btn.getAttribute('data-qid');
      const answerId = btn.getAttribute('data-aid');
      await handleUpvoteAnswer(questionId, answerId, btn);
    });
  });

  // Reply toggle buttons
  const replyToggles = pdQaList.querySelectorAll('.qa-reply-toggle-btn');
  replyToggles.forEach(btn => {
    btn.addEventListener('click', () => {
      const token = getAuthToken();
      if (!token) {
        showToast('Please sign in to answer questions.');
        openAuthModal('login', 'Please sign in to submit an answer');
        return;
      }
      const qid = btn.getAttribute('data-qid');
      const replyBox = document.getElementById(`qa-reply-box-${qid}`);
      if (replyBox) {
        const isHidden = replyBox.style.display === 'none';
        replyBox.style.display = isHidden ? 'block' : 'none';
        btn.style.display = isHidden ? 'none' : 'inline-flex';
        if (isHidden) {
          const textarea = replyBox.querySelector('.qa-reply-textarea');
          if (textarea) textarea.focus();
        }
      }
    });
  });

  // Reply cancel buttons
  const replyCancels = pdQaList.querySelectorAll('.qa-reply-cancel-btn');
  replyCancels.forEach(btn => {
    btn.addEventListener('click', () => {
      const qid = btn.getAttribute('data-qid');
      const replyBox = document.getElementById(`qa-reply-box-${qid}`);
      const replyToggle = pdQaList.querySelector(`.qa-reply-toggle-btn[data-qid="${qid}"]`);
      if (replyBox) replyBox.style.display = 'none';
      if (replyToggle) replyToggle.style.display = 'inline-flex';
    });
  });

  // Reply character counters
  const replyTextareas = pdQaList.querySelectorAll('.qa-reply-textarea');
  replyTextareas.forEach(textarea => {
    textarea.addEventListener('input', () => {
      const counter = textarea.closest('.qa-form-group')?.querySelector('.qa-reply-char-count');
      if (counter) counter.textContent = `${textarea.value.length}/1000`;
    });
  });

  // Reply form submissions
  const replyForms = pdQaList.querySelectorAll('.qa-reply-form');
  replyForms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const qid = form.getAttribute('data-qid');
      const textarea = form.querySelector('.qa-reply-textarea');
      const submitBtn = form.querySelector('.qa-reply-submit-btn');
      if (!textarea || !qid) return;

      const answerText = textarea.value.trim();
      if (answerText.length < 2) {
        showToast('Answer must be at least 2 characters.');
        return;
      }

      await submitAnswer(qid, answerText, submitBtn);
    });
  });
}

async function submitQuestion(questionText) {
  const token = getAuthToken();
  if (!token) {
    showToast('Please sign in to ask a question.');
    openAuthModal('login', 'Please sign in to post a question');
    return;
  }

  if (!currentProduct || !currentProduct._id) return;

  if (pdSubmitQuestionBtn) {
    pdSubmitQuestionBtn.disabled = true;
    pdSubmitQuestionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/products/${currentProduct._id}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ questionText })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Question posted successfully!');
      if (pdQuestionInput) pdQuestionInput.value = '';
      if (pdQuestionCharCount) pdQuestionCharCount.textContent = '0/500';
      if (pdAskQuestionFormCard) pdAskQuestionFormCard.style.display = 'none';
      if (pdAskQuestionTriggerBtn) pdAskQuestionTriggerBtn.style.display = 'inline-flex';
      await fetchProductQA(currentProduct._id);
    } else {
      showToast(data.message || 'Failed to post question.');
    }
  } catch (err) {
    console.error('Error posting question:', err);
    showToast('Network error while posting question.');
  } finally {
    if (pdSubmitQuestionBtn) {
      pdSubmitQuestionBtn.disabled = false;
      pdSubmitQuestionBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post Question';
    }
  }
}

async function submitAnswer(questionId, answerText, submitBtn) {
  const token = getAuthToken();
  if (!token) {
    showToast('Please sign in to answer questions.');
    openAuthModal('login', 'Please sign in to submit an answer');
    return;
  }

  if (!currentProduct || !currentProduct._id) return;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/products/${currentProduct._id}/questions/${questionId}/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ answerText })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Answer submitted successfully!');
      await fetchProductQA(currentProduct._id);
    } else {
      showToast(data.message || 'Failed to submit answer.');
    }
  } catch (err) {
    console.error('Error submitting answer:', err);
    showToast('Network error while submitting answer.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Answer';
    }
  }
}

async function handleUpvoteAnswer(questionId, answerId, btn) {
  const token = getAuthToken();
  if (!token) {
    showToast('Please sign in to upvote answers.');
    openAuthModal('login', 'Please sign in to vote for helpful answers');
    return;
  }

  if (!currentProduct || !currentProduct._id) return;

  try {
    btn.disabled = true;
    const res = await fetch(`${API_BASE_URL}/products/${currentProduct._id}/questions/${questionId}/answers/${answerId}/upvote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      const hasUpvoted = Boolean(data.hasUpvoted);
      const newUpvotes = typeof data.upvotes === 'number' ? data.upvotes : 0;

      // Update button classes and text
      if (hasUpvoted) {
        btn.classList.add('has-upvoted');
        btn.title = 'Remove helpful vote';
      } else {
        btn.classList.remove('has-upvoted');
        btn.title = 'Mark answer as helpful';
      }

      const countSpan = btn.querySelector('.qa-upvote-count');
      if (countSpan) countSpan.textContent = newUpvotes;
      btn.setAttribute('data-upvotes', newUpvotes);

      // Also update in local state productQuestions array so search/filter retains correct state
      const targetQ = productQuestions.find(q => q.questionId === questionId);
      if (targetQ && Array.isArray(targetQ.answers)) {
        const targetA = targetQ.answers.find(a => a.answerId === answerId);
        if (targetA) {
          targetA.upvotes = newUpvotes;
          const user = getAuthUser();
          const uid = user ? String(user.id || user._id) : null;
          if (uid) {
            targetA.upvotedBy = targetA.upvotedBy || [];
            const idx = targetA.upvotedBy.findIndex(id => String(id) === uid);
            if (hasUpvoted && idx === -1) {
              targetA.upvotedBy.push(uid);
            } else if (!hasUpvoted && idx !== -1) {
              targetA.upvotedBy.splice(idx, 1);
            }
          }
        }
      }

      showToast(hasUpvoted ? 'Marked as helpful!' : 'Upvote removed');
    } else {
      showToast(data.message || 'Could not update vote.');
    }
  } catch (err) {
    console.error('Error toggling upvote:', err);
    showToast('Network error while toggling upvote.');
  } finally {
    btn.disabled = false;
  }
}

function initProductQA() {
  if (pdAskQuestionTriggerBtn) {
    pdAskQuestionTriggerBtn.addEventListener('click', () => {
      const token = getAuthToken();
      if (!token) {
        showToast('Please sign in to ask a question.');
        openAuthModal('login', 'Please sign in to ask a question');
        return;
      }
      if (pdAskQuestionFormCard) {
        pdAskQuestionFormCard.style.display = 'block';
        pdAskQuestionTriggerBtn.style.display = 'none';
        if (pdQuestionInput) {
          pdQuestionInput.focus();
        }
      }
    });
  }

  if (pdEmptyAskBtn) {
    pdEmptyAskBtn.addEventListener('click', () => {
      if (pdAskQuestionTriggerBtn) {
        pdAskQuestionTriggerBtn.click();
      }
    });
  }

  if (pdCloseAskQuestionBtn) {
    pdCloseAskQuestionBtn.addEventListener('click', () => {
      if (pdAskQuestionFormCard) pdAskQuestionFormCard.style.display = 'none';
      if (pdAskQuestionTriggerBtn) pdAskQuestionTriggerBtn.style.display = 'inline-flex';
    });
  }

  if (pdCancelAskQuestionBtn) {
    pdCancelAskQuestionBtn.addEventListener('click', () => {
      if (pdAskQuestionFormCard) pdAskQuestionFormCard.style.display = 'none';
      if (pdAskQuestionTriggerBtn) pdAskQuestionTriggerBtn.style.display = 'inline-flex';
    });
  }

  if (pdQuestionInput) {
    pdQuestionInput.addEventListener('input', () => {
      if (pdQuestionCharCount) {
        pdQuestionCharCount.textContent = `${pdQuestionInput.value.length}/500`;
      }
    });
  }

  if (pdAskQuestionForm) {
    pdAskQuestionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!pdQuestionInput) return;
      const text = pdQuestionInput.value.trim();
      if (text.length < 3) {
        showToast('Question must be at least 3 characters.');
        return;
      }
      await submitQuestion(text);
    });
  }

  // Quick search
  if (pdQaSearchInput) {
    pdQaSearchInput.addEventListener('input', (e) => {
      qaSearchQuery = e.target.value;
      if (pdQaSearchClear) {
        pdQaSearchClear.style.display = qaSearchQuery ? 'flex' : 'none';
      }
      renderProductQA();
    });
  }

  if (pdQaSearchClear) {
    pdQaSearchClear.addEventListener('click', () => {
      if (pdQaSearchInput) {
        pdQaSearchInput.value = '';
        qaSearchQuery = '';
        pdQaSearchClear.style.display = 'none';
        renderProductQA();
      }
    });
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
      const activeStock = (selectedVariant && typeof selectedVariant.stock === 'number')
        ? selectedVariant.stock
        : (currentProduct ? currentProduct.stock : 0);
      if (currentProduct && activeStock > 0) {
        addToCart(currentProduct._id, selectedQuantity, pdMainImg, selectedVariant);
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

  // Feature 4: Pincode Delivery Estimator
  const pdPinInput = document.getElementById('pd-pincode-input');
  const pdPinBtn = document.getElementById('pd-pincode-check-btn');
  const pdPinResult = document.getElementById('pd-pincode-result');

  async function checkPdPincode(pincode) {
    if (!pdPinResult) return;
    const cleanPin = String(pincode || '').trim();
    if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
      pdPinResult.className = 'pincode-result-box pincode-result-error';
      pdPinResult.innerHTML = '⚠️ Please enter a valid 6-digit Indian PIN code (e.g. 110001, 560001).';
      pdPinResult.style.display = 'block';
      return;
    }

    pdPinResult.className = 'pincode-result-box';
    pdPinResult.innerHTML = 'Checking delivery speed and hub availability...';
    pdPinResult.style.display = 'block';

    try {
      const res = await fetch(`${API_BASE_URL}/addresses/check-pincode/${cleanPin}`);
      const data = await res.json();
      if (!res.ok || !data.serviceable) {
        pdPinResult.className = 'pincode-result-box pincode-result-error';
        pdPinResult.innerHTML = `⚠️ ${data.message || 'Location currently unserviceable.'}`;
        return;
      }

      localStorage.setItem('ministore_checked_pincode', cleanPin);
      pdPinResult.className = 'pincode-result-box pincode-result-success';
      pdPinResult.innerHTML = `
        <div class="pincode-delivery-line">
          <span>🚚 Delivery by ${data.estimatedDeliveryDate} (${data.estimatedDays})</span>
        </div>
        <div class="pincode-location-line">
          📍 Delivering to <strong>${data.city}, ${data.state}</strong> (${cleanPin})
        </div>
        <div class="pincode-perk-chips">
          <span class="pincode-perk-chip">✓ Free Delivery</span>
          ${data.codAvailable ? '<span class="pincode-perk-chip">✓ Cash on Delivery Available</span>' : ''}
          ${data.expressAvailable ? '<span class="pincode-perk-chip">⚡ Express Metro Hub</span>' : ''}
        </div>
        <div class="pincode-cutoff-text">
          ⏱️ ${data.cutoffText || 'Order now for fastest courier dispatch'}
        </div>
      `;
    } catch (e) {
      pdPinResult.className = 'pincode-result-box pincode-result-error';
      pdPinResult.innerHTML = '⚠️ Unable to connect to courier estimator service.';
    }
  }

  if (pdPinBtn && pdPinInput) {
    pdPinBtn.addEventListener('click', () => checkPdPincode(pdPinInput.value));
    pdPinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        checkPdPincode(pdPinInput.value);
      }
    });

    const lastPin = localStorage.getItem('ministore_checked_pincode') || '110001';
    pdPinInput.value = lastPin;
    checkPdPincode(lastPin);
  }

  // Feature 5: Sync Wallet Header Pill
  const navWalletBtn = document.getElementById('nav-wallet-btn');
  const navWalletBalanceText = document.getElementById('nav-wallet-balance-text');
  const navWalletCoinsText = document.getElementById('nav-wallet-coins-text');
  const userToken = getAuthToken();

  if (userToken && navWalletBtn) {
    navWalletBtn.style.display = 'inline-flex';
    fetch(`${API_BASE_URL}/wallet`, {
      headers: { Authorization: `Bearer ${userToken}` }
    })
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          if (navWalletBalanceText) navWalletBalanceText.textContent = `₹${res.data.walletBalance.toFixed(0)}`;
          if (navWalletCoinsText) navWalletCoinsText.textContent = res.data.coins;
        }
      })
      .catch(() => {});
  }

  // ============================================================
  // Step 2: 1-Click Express Checkout ("Buy Now") Logic
  // ============================================================
  const pdBuyNowBtn = document.getElementById('pd-buy-now-btn');
  const expressCheckoutModal = document.getElementById('express-checkout-modal');
  const expressModalCloseBtn = document.getElementById('express-modal-close-btn');
  const expressModalCancelBtn = document.getElementById('express-modal-cancel-btn');
  const expressModalFormView = document.getElementById('express-modal-form-view');
  const expressSuccessView = document.getElementById('express-success-view');

  const expressProductImg = document.getElementById('express-product-img');
  const expressProductTitle = document.getElementById('express-product-title');
  const expressVariantTag = document.getElementById('express-variant-tag');
  const expressUnitPrice = document.getElementById('express-unit-price');
  const expressStockStatus = document.getElementById('express-stock-status');
  const expressQtyMinus = document.getElementById('express-qty-minus');
  const expressQtyInput = document.getElementById('express-qty-input');
  const expressQtyPlus = document.getElementById('express-qty-plus');

  const expressAddressesGrid = document.getElementById('express-addresses-grid');
  const expressNoAddressBox = document.getElementById('express-no-address-box');
  const expressAddAddrToggleBtn = document.getElementById('express-add-addr-toggle-btn');
  const expressNewAddrBox = document.getElementById('express-new-addr-box');
  const expressSaveAddrBtn = document.getElementById('express-save-addr-btn');
  const expressCancelAddrBtn = document.getElementById('express-cancel-addr-btn');

  const expressPayRazorpay = document.getElementById('express-pay-razorpay');
  const expressPayWallet = document.getElementById('express-pay-wallet');
  const expressPayCod = document.getElementById('express-pay-cod');
  const expressCardRazorpay = document.getElementById('express-card-razorpay');
  const expressCardWallet = document.getElementById('express-card-wallet');
  const expressCardCod = document.getElementById('express-card-cod');
  const expressWalletPill = document.getElementById('express-wallet-pill');

  const expressCouponInput = document.getElementById('express-coupon-input');
  const expressCouponApplyBtn = document.getElementById('express-coupon-apply-btn');
  const expressCouponFeedback = document.getElementById('express-coupon-feedback');
  const expressAppliedCouponCard = document.getElementById('express-applied-coupon-card');
  const expressAppliedCouponCode = document.getElementById('express-applied-coupon-code');
  const expressAppliedCouponSaving = document.getElementById('express-applied-coupon-saving');
  const expressRemoveCouponBtn = document.getElementById('express-remove-coupon-btn');

  const expressWalletToggleBox = document.getElementById('express-wallet-toggle-box');
  const expressUseWalletCheckbox = document.getElementById('express-use-wallet-checkbox');
  const expressWalletMaxText = document.getElementById('express-wallet-max-text');
  const expressWalletDeductBadge = document.getElementById('express-wallet-deduct-badge');
  const expressCoinsText = document.getElementById('express-coins-text');

  const expressSubtotalVal = document.getElementById('express-subtotal-val');
  const expressShippingVal = document.getElementById('express-shipping-val');
  const expressDiscountRow = document.getElementById('express-discount-row');
  const expressDiscountVal = document.getElementById('express-discount-val');
  const expressWalletRow = document.getElementById('express-wallet-row');
  const expressWalletVal = document.getElementById('express-wallet-val');
  const expressGrandTotal = document.getElementById('express-grand-total');
  const expressErrorAlert = document.getElementById('express-error-alert');
  const expressPlaceOrderBtn = document.getElementById('express-place-order-btn');

  const expressSuccessOrderId = document.getElementById('express-success-order-id');
  const expressSuccessTrackingId = document.getElementById('express-success-tracking-id');
  const expressSuccessInvoiceId = document.getElementById('express-success-invoice-id');
  const expressSuccessPayment = document.getElementById('express-success-payment');
  const expressSuccessTotal = document.getElementById('express-success-total');
  const expressSuccessDelivery = document.getElementById('express-success-delivery');
  const expressDownloadInvoiceBtn = document.getElementById('express-download-invoice-btn');
  const expressSuccessContinueBtn = document.getElementById('express-success-continue-btn');

  // Express State
  let expressQuantity = 1;
  let expressAddresses = [];
  let selectedAddressId = null;
  let expressPaymentMethod = 'RAZORPAY';
  let expressWalletBalance = 0;
  let expressAppliedCoupon = null;
  let lastPlacedExpressOrder = null;

  function closeExpressCheckoutModal() {
    if (expressCheckoutModal) {
      expressCheckoutModal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  function getEffectiveExpressUnitPrice() {
    if (selectedVariant && typeof selectedVariant.price === 'number') {
      return selectedVariant.price;
    }
    return currentProduct ? currentProduct.price : 0;
  }

  function getAvailableStock() {
    if (selectedVariant && typeof selectedVariant.stock === 'number') {
      return selectedVariant.stock;
    }
    return currentProduct ? currentProduct.stock : 0;
  }

  function calculateExpressTotals() {
    const unitPrice = getEffectiveExpressUnitPrice();
    const subtotal = Math.round((unitPrice * expressQuantity) * 100) / 100;
    const shipping = subtotal >= 500 ? 0 : 50;

    let discount = 0;
    if (expressAppliedCoupon && expressAppliedCoupon.discountAmount > 0) {
      discount = Math.min(expressAppliedCoupon.discountAmount, subtotal);
    }

    const maxFairCeiling = Math.round((subtotal * 0.50) * 100) / 100;
    const availableWalletCap = Math.min(expressWalletBalance, maxFairCeiling);

    let walletDeduction = 0;
    if (expressPaymentMethod === 'WALLET') {
      walletDeduction = Math.min(subtotal + shipping - discount, availableWalletCap);
    } else if (expressUseWalletCheckbox && expressUseWalletCheckbox.checked) {
      walletDeduction = Math.min(subtotal + shipping - discount, availableWalletCap);
    }

    const grandTotal = Math.max(0, Math.round((subtotal + shipping - discount - walletDeduction) * 100) / 100);
    const coinsReward = Math.max(10, Math.floor(subtotal * 0.05));

    // Update DOM
    if (expressSubtotalVal) expressSubtotalVal.textContent = currencyFormatter.format(subtotal);
    if (expressShippingVal) {
      expressShippingVal.textContent = shipping === 0 ? 'FREE' : currencyFormatter.format(shipping);
      expressShippingVal.style.color = shipping === 0 ? '#10b981' : 'inherit';
    }

    if (expressDiscountRow && expressDiscountVal) {
      if (discount > 0) {
        expressDiscountRow.style.display = 'flex';
        expressDiscountVal.textContent = `-${currencyFormatter.format(discount)}`;
      } else {
        expressDiscountRow.style.display = 'none';
      }
    }

    if (expressWalletRow && expressWalletVal) {
      if (walletDeduction > 0) {
        expressWalletRow.style.display = 'flex';
        expressWalletVal.textContent = `-${currencyFormatter.format(walletDeduction)}`;
      } else {
        expressWalletRow.style.display = 'none';
      }
    }

    if (expressWalletMaxText) {
      expressWalletMaxText.textContent = currencyFormatter.format(availableWalletCap);
    }
    if (expressWalletDeductBadge) {
      expressWalletDeductBadge.textContent = `-${currencyFormatter.format(walletDeduction)}`;
    }

    if (expressGrandTotal) expressGrandTotal.textContent = currencyFormatter.format(grandTotal);
    if (expressCoinsText) expressCoinsText.textContent = `+${coinsReward} SuperCoins`;

    // Wallet pill in payment method
    if (expressWalletPill) {
      expressWalletPill.textContent = currencyFormatter.format(expressWalletBalance);
    }

    return {
      subtotal,
      shipping,
      discount,
      walletDeduction,
      grandTotal,
      coinsReward
    };
  }

  function renderExpressAddresses() {
    if (!expressAddressesGrid) return;
    expressAddressesGrid.innerHTML = '';

    if (!expressAddresses || expressAddresses.length === 0) {
      if (expressNoAddressBox) expressNoAddressBox.style.display = 'block';
      selectedAddressId = null;
      return;
    }

    if (expressNoAddressBox) expressNoAddressBox.style.display = 'none';

    // Ensure a default is selected if none currently selected
    if (!selectedAddressId || !expressAddresses.some(a => a._id === selectedAddressId)) {
      const def = expressAddresses.find(a => a.isDefault) || expressAddresses[0];
      selectedAddressId = def ? def._id : null;
    }

    expressAddresses.forEach(addr => {
      const isSel = addr._id === selectedAddressId;
      const card = document.createElement('label');
      card.className = `express-address-card ${isSel ? 'is-selected' : ''}`;
      card.htmlFor = `express-addr-radio-${addr._id}`;
      card.innerHTML = `
        <input type="radio" name="expressAddressChoice" id="express-addr-radio-${addr._id}" value="${addr._id}" class="express-addr-radio" ${isSel ? 'checked' : ''} />
        <div class="express-addr-body">
          <div class="express-addr-header">
            <span class="express-addr-name">${escapeHtml(addr.fullName)}</span>
            <span class="express-addr-type-pill">${escapeHtml(addr.addressType || 'Home')}</span>
            ${addr.isDefault ? '<span class="express-addr-default-pill">Default</span>' : ''}
          </div>
          <div class="express-addr-line">${escapeHtml(addr.addressLine1)}${addr.addressLine2 ? ', ' + escapeHtml(addr.addressLine2) : ''}</div>
          <div class="express-addr-line">${escapeHtml(addr.city)}, ${escapeHtml(addr.state)} - <strong>${escapeHtml(addr.postalCode)}</strong></div>
          <div class="express-addr-line" style="font-size: 0.78rem; color: var(--color-text-muted);">Phone: ${escapeHtml(addr.phone)}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        selectedAddressId = addr._id;
        expressAddressesGrid.querySelectorAll('.express-address-card').forEach(c => c.classList.remove('is-selected'));
        card.classList.add('is-selected');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });

      expressAddressesGrid.appendChild(card);
    });
  }

  async function openExpressCheckoutModal() {
    const token = getAuthToken();
    if (!token) {
      showToast('Please log in to use 1-Click Express Checkout');
      openAuthModal('login', 'Please log in to use 1-Click Express Checkout');
      return;
    }

    if (!currentProduct) {
      showToast('Product data not loaded yet.');
      return;
    }

    const availableStock = getAvailableStock();
    if (availableStock <= 0) {
      showToast('This item is currently out of stock.');
      return;
    }

    // Set initial express quantity based on product page selection
    expressQuantity = Math.max(1, Math.min(selectedQuantity || 1, availableStock));

    // Reset views and messages
    if (expressModalFormView) expressModalFormView.style.display = 'block';
    if (expressSuccessView) expressSuccessView.style.display = 'none';
    if (expressErrorAlert) expressErrorAlert.style.display = 'none';
    if (expressNewAddrBox) expressNewAddrBox.style.display = 'none';
    if (expressCouponFeedback) expressCouponFeedback.style.display = 'none';
    if (expressAppliedCouponCard) expressAppliedCouponCard.style.display = 'none';
    expressAppliedCoupon = null;
    if (expressCouponInput) expressCouponInput.value = '';

    // Render product details inside modal
    if (expressProductImg) {
      expressProductImg.src = formatProductImageUrl(currentProduct.image);
      expressProductImg.alt = currentProduct.name;
    }
    if (expressProductTitle) expressProductTitle.textContent = currentProduct.name;

    if (expressVariantTag) {
      if (selectedVariant) {
        let vText = selectedVariant.title;
        if (!vText && selectedVariant.attributes) {
          const parts = [];
          if (selectedVariant.attributes.size) parts.push(`Size: ${selectedVariant.attributes.size}`);
          if (selectedVariant.attributes.color) parts.push(`Color: ${selectedVariant.attributes.color}`);
          if (selectedVariant.attributes.storage) parts.push(`Storage: ${selectedVariant.attributes.storage}`);
          vText = parts.join(' • ');
        }
        expressVariantTag.textContent = `Variant: ${vText || selectedVariant.variantId}`;
        expressVariantTag.style.display = 'inline-block';
      } else {
        expressVariantTag.style.display = 'none';
      }
    }

    const unitPrice = getEffectiveExpressUnitPrice();
    if (expressUnitPrice) expressUnitPrice.textContent = currencyFormatter.format(unitPrice);
    if (expressQtyInput) expressQtyInput.value = expressQuantity;
    if (expressStockStatus) {
      expressStockStatus.textContent = availableStock < 5 ? `⚠️ Only ${availableStock} left in stock` : `✓ In Stock (${availableStock})`;
      expressStockStatus.style.color = availableStock < 5 ? '#ea580c' : '#10b981';
    }

    // Default payment method
    expressPaymentMethod = 'RAZORPAY';
    if (expressPayRazorpay) expressPayRazorpay.checked = true;
    updatePaymentMethodUI('RAZORPAY');

    // Show modal
    if (expressCheckoutModal) {
      expressCheckoutModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    // Fetch user addresses & wallet balance in parallel
    try {
      const [addrRes, walletRes] = await Promise.all([
        fetch(`${API_BASE_URL}/addresses`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/wallet`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (addrRes.ok) {
        const addrData = await addrRes.json();
        expressAddresses = addrData.data || [];
        renderExpressAddresses();
      }

      if (walletRes.ok) {
        const wData = await walletRes.json();
        if (wData.success && wData.data) {
          expressWalletBalance = Number(wData.data.walletBalance) || 0;
        }
      }
    } catch (fetchErr) {
      console.warn('Express checkout preflight warning:', fetchErr);
    }

    calculateExpressTotals();
  }

  function updatePaymentMethodUI(method) {
    expressPaymentMethod = method;
    [expressCardRazorpay, expressCardWallet, expressCardCod].forEach(c => c?.classList.remove('is-selected'));

    if (method === 'RAZORPAY') {
      expressCardRazorpay?.classList.add('is-selected');
      if (expressWalletToggleBox) expressWalletToggleBox.style.display = 'block';
    } else if (method === 'WALLET') {
      expressCardWallet?.classList.add('is-selected');
      if (expressWalletToggleBox) expressWalletToggleBox.style.display = 'none';
    } else if (method === 'COD') {
      expressCardCod?.classList.add('is-selected');
      if (expressWalletToggleBox) expressWalletToggleBox.style.display = 'block';
    }

    calculateExpressTotals();
  }

  // Payment radio change listeners
  if (expressPayRazorpay) {
    expressPayRazorpay.addEventListener('change', () => updatePaymentMethodUI('RAZORPAY'));
  }
  if (expressPayWallet) {
    expressPayWallet.addEventListener('change', () => updatePaymentMethodUI('WALLET'));
  }
  if (expressPayCod) {
    expressPayCod.addEventListener('change', () => updatePaymentMethodUI('COD'));
  }

  // Wallet checkbox change listener
  if (expressUseWalletCheckbox) {
    expressUseWalletCheckbox.addEventListener('change', () => calculateExpressTotals());
  }

  // Quantity control listeners in modal
  if (expressQtyMinus) {
    expressQtyMinus.addEventListener('click', () => {
      if (expressQuantity > 1) {
        expressQuantity--;
        if (expressQtyInput) expressQtyInput.value = expressQuantity;
        calculateExpressTotals();
      }
    });
  }

  if (expressQtyPlus) {
    expressQtyPlus.addEventListener('click', () => {
      const maxStock = getAvailableStock();
      if (expressQuantity < maxStock) {
        expressQuantity++;
        if (expressQtyInput) expressQtyInput.value = expressQuantity;
        calculateExpressTotals();
      } else {
        showToast(`Maximum available stock is ${maxStock}`);
      }
    });
  }

  if (expressQtyInput) {
    expressQtyInput.addEventListener('change', () => {
      const maxStock = getAvailableStock();
      let val = parseInt(expressQtyInput.value, 10) || 1;
      val = Math.max(1, Math.min(val, maxStock));
      expressQuantity = val;
      expressQtyInput.value = val;
      calculateExpressTotals();
    });
  }

  // Coupon apply
  if (expressCouponApplyBtn && expressCouponInput) {
    expressCouponApplyBtn.addEventListener('click', async () => {
      const code = expressCouponInput.value.trim().toUpperCase();
      if (!code) {
        if (expressCouponFeedback) {
          expressCouponFeedback.textContent = 'Please enter a coupon code.';
          expressCouponFeedback.className = 'promo-feedback promo-feedback-error';
          expressCouponFeedback.style.display = 'block';
        }
        return;
      }

      const token = getAuthToken();
      const unitPrice = getEffectiveExpressUnitPrice();
      const subtotal = unitPrice * expressQuantity;

      expressCouponApplyBtn.disabled = true;
      expressCouponApplyBtn.textContent = 'Validating...';

      try {
        const res = await fetch(`${API_BASE_URL}/coupons/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ code, subtotal })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          expressAppliedCoupon = {
            code: data.data.coupon?.code || code,
            discountAmount: Number(data.data.discountAmount) || 0
          };

          if (expressAppliedCouponCode) expressAppliedCouponCode.textContent = expressAppliedCoupon.code;
          if (expressAppliedCouponSaving) expressAppliedCouponSaving.textContent = `₹${expressAppliedCoupon.discountAmount.toFixed(2)} OFF applied`;
          if (expressAppliedCouponCard) expressAppliedCouponCard.style.display = 'flex';
          if (expressCouponFeedback) {
            expressCouponFeedback.textContent = `✓ Coupon "${expressAppliedCoupon.code}" applied successfully!`;
            expressCouponFeedback.className = 'promo-feedback promo-feedback-success';
            expressCouponFeedback.style.display = 'block';
          }
          if (expressCouponInput) expressCouponInput.value = '';
          calculateExpressTotals();
        } else {
          if (expressCouponFeedback) {
            expressCouponFeedback.textContent = `⚠️ ${data.message || 'Invalid or expired coupon code.'}`;
            expressCouponFeedback.className = 'promo-feedback promo-feedback-error';
            expressCouponFeedback.style.display = 'block';
          }
        }
      } catch (err) {
        if (expressCouponFeedback) {
          expressCouponFeedback.textContent = '⚠️ Network error while validating coupon.';
          expressCouponFeedback.className = 'promo-feedback promo-feedback-error';
          expressCouponFeedback.style.display = 'block';
        }
      } finally {
        expressCouponApplyBtn.disabled = false;
        expressCouponApplyBtn.textContent = 'Apply';
      }
    });
  }

  // Coupon remove
  if (expressRemoveCouponBtn) {
    expressRemoveCouponBtn.addEventListener('click', () => {
      expressAppliedCoupon = null;
      if (expressAppliedCouponCard) expressAppliedCouponCard.style.display = 'none';
      if (expressCouponFeedback) {
        expressCouponFeedback.textContent = 'Coupon removed.';
        expressCouponFeedback.className = 'promo-feedback';
        expressCouponFeedback.style.display = 'block';
        setTimeout(() => { if (expressCouponFeedback) expressCouponFeedback.style.display = 'none'; }, 2000);
      }
      calculateExpressTotals();
    });
  }

  // Toggle inline new address box
  if (expressAddAddrToggleBtn && expressNewAddrBox) {
    expressAddAddrToggleBtn.addEventListener('click', () => {
      const isVisible = expressNewAddrBox.style.display === 'block';
      expressNewAddrBox.style.display = isVisible ? 'none' : 'block';
      expressAddAddrToggleBtn.textContent = isVisible ? '+ New Address' : '✕ Cancel';
    });
  }

  if (expressCancelAddrBtn && expressNewAddrBox) {
    expressCancelAddrBtn.addEventListener('click', () => {
      expressNewAddrBox.style.display = 'none';
      if (expressAddAddrToggleBtn) expressAddAddrToggleBtn.textContent = '+ New Address';
    });
  }

  // Save New Address
  if (expressSaveAddrBtn) {
    expressSaveAddrBtn.addEventListener('click', async () => {
      const fullName = document.getElementById('express-new-fullname')?.value.trim();
      const phone = document.getElementById('express-new-phone')?.value.trim();
      const addressLine1 = document.getElementById('express-new-line1')?.value.trim();
      const addressLine2 = document.getElementById('express-new-line2')?.value.trim();
      const city = document.getElementById('express-new-city')?.value.trim();
      const state = document.getElementById('express-new-state')?.value.trim();
      const postalCode = document.getElementById('express-new-pincode')?.value.trim();
      const addressType = document.getElementById('express-new-type')?.value || 'Home';

      if (!fullName || !phone || !addressLine1 || !city || !state || !postalCode) {
        showToast('Please fill in all required address fields marked with *');
        return;
      }

      if (!/^[1-9][0-9]{5}$/.test(postalCode)) {
        showToast('Please enter a valid 6-digit Indian PIN code.');
        return;
      }

      if (!/^[6-9][0-9]{9}$/.test(phone)) {
        showToast('Please enter a valid 10-digit Indian phone number.');
        return;
      }

      const token = getAuthToken();
      expressSaveAddrBtn.disabled = true;
      expressSaveAddrBtn.textContent = 'Saving...';

      try {
        const res = await fetch(`${API_BASE_URL}/addresses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            fullName,
            phone,
            addressLine1,
            addressLine2,
            city,
            state,
            postalCode,
            addressType,
            isDefault: expressAddresses.length === 0
          })
        });

        const data = await res.json();
        if (res.ok && data.success && data.data) {
          expressAddresses.unshift(data.data);
          selectedAddressId = data.data._id;
          renderExpressAddresses();
          if (expressNewAddrBox) expressNewAddrBox.style.display = 'none';
          if (expressAddAddrToggleBtn) expressAddAddrToggleBtn.textContent = '+ New Address';
          showToast('✓ Address saved and selected!');
        } else {
          showToast(data.message || 'Failed to save address.');
        }
      } catch (err) {
        showToast('Network error while saving address.');
      } finally {
        expressSaveAddrBtn.disabled = false;
        expressSaveAddrBtn.textContent = 'Save & Use Address';
      }
    });
  }

  // Render Order Success Screen
  function renderExpressSuccessScreen(order) {
    lastPlacedExpressOrder = order;
    if (expressModalFormView) expressModalFormView.style.display = 'none';
    if (expressSuccessView) expressSuccessView.style.display = 'block';

    if (expressSuccessOrderId) expressSuccessOrderId.textContent = `#${order.orderId || order._id}`;
    if (expressSuccessTrackingId) {
      expressSuccessTrackingId.textContent = order.tracking?.trackingNumber || (order._id ? `MS-TRK-${order._id.toString().slice(-6).toUpperCase()}` : 'MS-TRK-CONFIRMED');
    }
    if (expressSuccessInvoiceId) {
      expressSuccessInvoiceId.textContent = order.invoiceNumber || 'INV-PENDING';
    }
    if (expressSuccessPayment) {
      expressSuccessPayment.textContent = `${order.paymentMethod} (${order.paymentStatus || 'Confirmed'})`;
    }
    if (expressSuccessTotal) {
      expressSuccessTotal.textContent = currencyFormatter.format(order.totalAmount || 0);
    }
    if (expressSuccessDelivery) {
      const est = order.tracking?.estimatedDeliveryDate;
      expressSuccessDelivery.textContent = est ? new Date(est).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) : '2-4 Business Days';
    }

    // Refresh wallet balance text in navbar pill
    if (userToken && navWalletBtn) {
      fetch(`${API_BASE_URL}/wallet`, { headers: { Authorization: `Bearer ${userToken}` } })
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data) {
            if (navWalletBalanceText) navWalletBalanceText.textContent = `₹${res.data.walletBalance.toFixed(0)}`;
            if (navWalletCoinsText) navWalletCoinsText.textContent = res.data.coins;
          }
        })
        .catch(() => {});
    }
  }

  // Download Invoice PDF Handler
  if (expressDownloadInvoiceBtn) {
    expressDownloadInvoiceBtn.addEventListener('click', async () => {
      if (!lastPlacedExpressOrder) return;
      const token = getAuthToken();
      expressDownloadInvoiceBtn.disabled = true;
      expressDownloadInvoiceBtn.innerHTML = '<span>⏳ Generating PDF...</span>';

      try {
        const res = await fetch(`${API_BASE_URL}/orders/${lastPlacedExpressOrder._id}/invoice`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          throw new Error('Failed to download invoice PDF');
        }

        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `Invoice-${lastPlacedExpressOrder.invoiceNumber || lastPlacedExpressOrder._id}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
        showToast('✓ Invoice downloaded successfully!');
      } catch (err) {
        console.error('Invoice error:', err);
        showToast('Could not download invoice PDF.');
      } finally {
        expressDownloadInvoiceBtn.disabled = false;
        expressDownloadInvoiceBtn.innerHTML = '<span>📄 View / Download Tax Invoice</span>';
      }
    });
  }

  if (expressSuccessContinueBtn) {
    expressSuccessContinueBtn.addEventListener('click', () => {
      closeExpressCheckoutModal();
      window.location.reload();
    });
  }

  // Place Order Now Handler
  if (expressPlaceOrderBtn) {
    expressPlaceOrderBtn.addEventListener('click', async () => {
      if (!selectedAddressId) {
        if (expressErrorAlert) {
          expressErrorAlert.textContent = 'Please select or add a delivery address to place your order.';
          expressErrorAlert.style.display = 'block';
        }
        showToast('Please select or add a delivery address.');
        return;
      }

      if (expressErrorAlert) expressErrorAlert.style.display = 'none';
      expressPlaceOrderBtn.disabled = true;
      expressPlaceOrderBtn.innerHTML = '<span>⏳ Processing Express Order...</span>';

      const token = getAuthToken();
      const payload = {
        productId: currentProduct._id,
        quantity: expressQuantity,
        addressId: selectedAddressId,
        paymentMethod: expressPaymentMethod,
        couponCode: expressAppliedCoupon ? expressAppliedCoupon.code : undefined,
        useWallet: expressPaymentMethod === 'WALLET' || (expressUseWalletCheckbox && expressUseWalletCheckbox.checked)
      };

      if (selectedVariant && selectedVariant.variantId) {
        payload.variantId = selectedVariant.variantId;
      }

      try {
        const orderRes = await fetch(`${API_BASE_URL}/orders/buy-now`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const orderData = await orderRes.json();

        if (!orderRes.ok || !orderData.success) {
          if (expressErrorAlert) {
            expressErrorAlert.textContent = orderData.message || 'Failed to place express order.';
            expressErrorAlert.style.display = 'block';
          }
          expressPlaceOrderBtn.disabled = false;
          expressPlaceOrderBtn.innerHTML = '<span>⚡ Place Order Now</span>';
          return;
        }

        const createdOrder = orderData.data;

        // If Razorpay and amount > 0, initiate Razorpay checkout flow
        if (expressPaymentMethod === 'RAZORPAY' && (createdOrder.totalAmount || 0) > 0) {
          expressPlaceOrderBtn.innerHTML = '<span>💳 Launching Razorpay Gateway...</span>';

          const rzpCreateRes = await fetch(`${API_BASE_URL}/payment/create-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              orderId: createdOrder._id,
              amount: createdOrder.totalAmount,
              currency: 'INR',
              receipt: `rcpt_${createdOrder._id.slice(-8)}`
            })
          });

          const rzpData = await rzpCreateRes.json();

          if (!rzpCreateRes.ok || !rzpData.success) {
            if (expressErrorAlert) {
              expressErrorAlert.textContent = rzpData.message || 'Failed to initialize Razorpay payment.';
              expressErrorAlert.style.display = 'block';
            }
            expressPlaceOrderBtn.disabled = false;
            expressPlaceOrderBtn.innerHTML = '<span>⚡ Place Order Now</span>';
            return;
          }

          if (typeof window.Razorpay === 'function') {
            const options = {
              key: rzpData.keyId,
              amount: rzpData.order.amount,
              currency: rzpData.order.currency || 'INR',
              name: 'MiniStore Express',
              description: `Express Order #${createdOrder.orderId || createdOrder._id}`,
              order_id: rzpData.order.id,
              handler: async function (rzpResponse) {
                expressPlaceOrderBtn.disabled = true;
                expressPlaceOrderBtn.innerHTML = '<span>🔒 Verifying Bank Signature...</span>';

                try {
                  const verifyRes = await fetch(`${API_BASE_URL}/payment/verify`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                      razorpay_order_id: rzpResponse.razorpay_order_id,
                      razorpay_payment_id: rzpResponse.razorpay_payment_id,
                      razorpay_signature: rzpResponse.razorpay_signature,
                      orderId: createdOrder._id
                    })
                  });

                  const verifyData = await verifyRes.json();
                  if (verifyRes.ok && verifyData.success) {
                    renderExpressSuccessScreen(verifyData.order || createdOrder);
                  } else {
                    if (expressErrorAlert) {
                      expressErrorAlert.textContent = verifyData.message || 'Payment signature verification failed.';
                      expressErrorAlert.style.display = 'block';
                    }
                    expressPlaceOrderBtn.disabled = false;
                    expressPlaceOrderBtn.innerHTML = '<span>⚡ Place Order Now</span>';
                  }
                } catch (vErr) {
                  console.error('Signature verification error:', vErr);
                  if (expressErrorAlert) {
                    expressErrorAlert.textContent = 'Network error while verifying payment.';
                    expressErrorAlert.style.display = 'block';
                  }
                  expressPlaceOrderBtn.disabled = false;
                  expressPlaceOrderBtn.innerHTML = '<span>⚡ Place Order Now</span>';
                }
              },
              prefill: {
                name: createdOrder.shippingAddress?.fullName || '',
                contact: createdOrder.shippingAddress?.phone || ''
              },
              theme: {
                color: '#ea580c'
              },
              modal: {
                ondismiss: function () {
                  expressPlaceOrderBtn.disabled = false;
                  expressPlaceOrderBtn.innerHTML = '<span>⚡ Place Order Now</span>';
                  showToast('Payment window closed. You can retry placing the order.');
                }
              }
            };

            const rzpInstance = new window.Razorpay(options);
            rzpInstance.open();
          } else {
            // Fallback if Razorpay SDK failed to load
            if (expressErrorAlert) {
              expressErrorAlert.textContent = 'Razorpay SDK is not loaded. Please disable ad-blockers or try COD.';
              expressErrorAlert.style.display = 'block';
            }
            expressPlaceOrderBtn.disabled = false;
            expressPlaceOrderBtn.innerHTML = '<span>⚡ Place Order Now</span>';
          }
        } else {
          // COD or 100% Wallet payment
          renderExpressSuccessScreen(createdOrder);
        }
      } catch (err) {
        console.error('Express order placement error:', err);
        if (expressErrorAlert) {
          expressErrorAlert.textContent = 'Network error while placing express order.';
          expressErrorAlert.style.display = 'block';
        }
        expressPlaceOrderBtn.disabled = false;
        expressPlaceOrderBtn.innerHTML = '<span>⚡ Place Order Now</span>';
      }
    });
  }

  // Wire up "Buy Now" button
  if (pdBuyNowBtn) {
    pdBuyNowBtn.addEventListener('click', openExpressCheckoutModal);
  }

  if (expressModalCloseBtn) {
    expressModalCloseBtn.addEventListener('click', closeExpressCheckoutModal);
  }

  if (expressModalCancelBtn) {
    expressModalCancelBtn.addEventListener('click', closeExpressCheckoutModal);
  }

  // Initialize Product Q&A Subsystem
  initProductQA();
});

