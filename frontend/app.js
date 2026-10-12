/**
 * MiniStore Frontend Application
 * Pure Vanilla JavaScript Client with Catalog, Search, Filtering, Details, Cart, Checkout & Orders
 */

// Backend API Base Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Fallback image in case an external image link fails to load
const FALLBACK_IMAGE_URL = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22300%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20400%20300%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_1%20text%20%7B%20fill%3A%2394a3b8%3Bfont-weight%3A600%3Bfont-size%3A18pt%3Bfont-family%3Asans-serif%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_1%22%3E%3Crect%20width%3D%22400%22%20height%3D%22300%22%20fill%3D%22%23e2e8f0%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%22120%22%20y%3D%22155%22%3ENo%20Image%20Available%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E';

// Curated high-res backup image mapping in case any external or local image fails to load
const PRODUCT_BACKUP_IMAGES = {
  '1080p Streaming Webcam': 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
  '10,000mAh Magnetic Power Bank': 'https://images.unsplash.com/photo-1609592807904-817887714138?w=800&auto=format&fit=crop&q=80',
  'Stainless Steel Mesh Watch': 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80',
  'Crossbody Sling Bag': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
  '14-Inch Laptop Sleeve': 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80',
  'Braided Leather Belt': 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800&auto=format&fit=crop&q=80',
  'Merino Wool Beanie': 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=800&auto=format&fit=crop&q=80',
  'Canvas Toiletry Bag': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80',
  'Titanium Key Carabiner': 'https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=800&auto=format&fit=crop&q=80',
  'Blue-Light Blocking Glasses': 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=800&auto=format&fit=crop&q=80',
  'Waxed Canvas Duffel Bag': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
  'Microfiber Sports Towel Set': 'https://images.unsplash.com/photo-1606902965551-dce093cda6e7?w=800&auto=format&fit=crop&q=80',
  'Stainless Steel Shaker Bottle 750ml': 'https://images.unsplash.com/photo-1570824104453-508955ab713e?w=800&auto=format&fit=crop&q=80'
};

function formatProductImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return FALLBACK_IMAGE_URL;
  const trimmed = imageUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const filename = trimmed.replace(/^\/?(frontend\/)?images\//, '');
  return `images/${filename}`;
}

function handleProductImageError(imgEl, originalUrl, productName) {
  if (!imgEl) return;
  const original = String(originalUrl || '').trim();
  const name = String(productName || '').trim();

  // Try 1: Curated Unsplash backup image if available
  if (name && PRODUCT_BACKUP_IMAGES[name] && imgEl.src !== PRODUCT_BACKUP_IMAGES[name]) {
    imgEl.src = PRODUCT_BACKUP_IMAGES[name];
    return;
  }

  // Try 2: Backend server URL for local image
  const serverOrigin = API_BASE_URL.replace(/\/api\/?$/, '');
  if (original && !original.startsWith('http')) {
    const filename = original.replace(/^\/?(frontend\/)?images\//, '');
    const serverUrl = `${serverOrigin}/images/${filename}`;
    if (imgEl.src !== serverUrl) {
      imgEl.src = serverUrl;
      return;
    }
  }

  // Try 3: Root-relative /images/ path
  if (original && !original.startsWith('http')) {
    const filename = original.replace(/^\/?(frontend\/)?images\//, '');
    const rootUrl = `/images/${filename}`;
    if (imgEl.src !== rootUrl) {
      imgEl.src = rootUrl;
      return;
    }
  }

  // Try 4: Final fallback SVG
  imgEl.onerror = null;
  imgEl.src = FALLBACK_IMAGE_URL;
}

window.formatProductImageUrl = formatProductImageUrl;
window.handleProductImageError = handleProductImageError;

// State Variables
let allProducts = [];
let currentSearchTerm = '';
let currentCategory = 'all';
let currentCart = null;
let isCartLoaded = false;
let currentWishlist = null;
let isWishlistLoaded = false;
let wishlistProductIds = new Set();
let userAddresses = [];
let selectedCheckoutAddressId = null;
let selectedPaymentMethod = 'COD';
let searchDebounceTimeout = null;

// Currency Formatter (Indian Rupees)
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

// DOM Elements - Catalog
const productsGrid = document.getElementById('products-grid');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');
const emptyFilterState = document.getElementById('empty-filter-state');
const productCount = document.getElementById('product-count');
const retryBtn = document.getElementById('retry-btn');
const refreshBtn = document.getElementById('refresh-btn');
const backendStatus = document.getElementById('backend-status');

// Pagination State (12 items per page)
const ITEMS_PER_PAGE = 12;
let currentPage = 1;

// DOM Elements - Pagination
const paginationContainer = document.getElementById('pagination-container');
const paginationPrevBtn = document.getElementById('pagination-prev-btn');
const paginationNextBtn = document.getElementById('pagination-next-btn');
const paginationPages = document.getElementById('pagination-pages');
const paginationRangeStart = document.getElementById('pagination-range-start');
const paginationRangeEnd = document.getElementById('pagination-range-end');
const paginationTotalItems = document.getElementById('pagination-total-items');
const currentPageNum = document.getElementById('current-page-num');
const totalPagesNum = document.getElementById('total-pages-num');

// DOM Elements - Filter & Search
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const categorySelect = document.getElementById('category-select');
const resetFiltersBtn = document.getElementById('reset-filters-btn');
const navSearchWrap = document.getElementById('nav-search-wrap');
const searchSuggestionsDropdown = document.getElementById('search-suggestions-dropdown');
const searchSubmitBtn = document.getElementById('search-submit-btn');

// DOM Elements - Flipkart-Style Category Showcases
const categorySectionsWrapper = document.getElementById('category-sections-wrapper');
const categorySectionsContainer = document.getElementById('category-sections-container');
const categoryShowcaseLoading = document.getElementById('category-showcase-loading');

// DOM Elements - Product Details Modal
const productModal = document.getElementById('product-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalLoading = document.getElementById('modal-loading');
const modalError = document.getElementById('modal-error');
const modalErrorMessage = document.getElementById('modal-error-message');
const modalErrorBackBtn = document.getElementById('modal-error-back-btn');
const modalContent = document.getElementById('modal-content');

// DOM Elements - Cart
const navCartBtn = document.getElementById('nav-cart-btn');
const cartNavBadge = document.getElementById('cart-nav-badge');
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
const cartLoginPromptBtn = document.getElementById('cart-login-prompt-btn');
const cartBrowseBtn = document.getElementById('cart-browse-btn');
const cartContinueBtn = document.getElementById('cart-continue-btn');

// DOM Elements - Wishlist Modal
const navWishlistBtn = document.getElementById('nav-wishlist-btn');
const wishlistNavBadge = document.getElementById('wishlist-nav-badge');
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

// DOM Elements - Checkout Modal
const checkoutModal = document.getElementById('checkout-modal');
const checkoutCloseBtn = document.getElementById('checkout-close-btn');
const checkoutReviewView = document.getElementById('checkout-review-view');
const checkoutSuccessView = document.getElementById('checkout-success-view');
const checkoutItemsSummary = document.getElementById('checkout-items-summary');
const checkoutTotalAmount = document.getElementById('checkout-total-amount');
const checkoutErrorAlert = document.getElementById('checkout-error-alert');
const placeOrderBtn = document.getElementById('place-order-btn');
const checkoutBackToCartBtn = document.getElementById('checkout-back-to-cart-btn');
const successOrderId = document.getElementById('success-order-id');
const successOrderStatus = document.getElementById('success-order-status');
const successOrderTotal = document.getElementById('success-order-total');
const viewMyOrdersBtn = document.getElementById('view-my-orders-btn');
const successContinueShoppingBtn = document.getElementById('success-continue-shopping-btn');
const successShippingAddress = document.getElementById('success-shipping-address');

// DOM Elements - Checkout Delivery Address
const checkoutAddressesGrid = document.getElementById('checkout-addresses-grid');
const checkoutNoAddressBox = document.getElementById('checkout-no-address-box');
const checkoutAddAddressBtn = document.getElementById('checkout-add-address-btn');
const checkoutEmptyAddBtn = document.getElementById('checkout-empty-add-btn');
const checkoutAddressAlert = document.getElementById('checkout-address-alert');

// DOM Elements - Checkout Payment
const checkoutPaymentSection = document.getElementById('checkout-payment-section');
const checkoutPaymentsGrid = document.getElementById('checkout-payments-grid');
const checkoutPaymentAlert = document.getElementById('checkout-payment-alert');
const checkoutSummaryAddress = document.getElementById('checkout-summary-address');
const checkoutSummaryPayment = document.getElementById('checkout-summary-payment');
const successPaymentMethod = document.getElementById('success-payment-method');
const successPaymentStatus = document.getElementById('success-payment-status');
const successPaymentNote = document.getElementById('success-payment-note');
const successOrderDate = document.getElementById('success-order-date');

// DOM Elements - Addresses Modal
const navAddressesBtn = document.getElementById('nav-addresses-btn');
const addressModal = document.getElementById('address-modal');
const addressCloseBtn = document.getElementById('address-close-btn');
const openAddAddressBtn = document.getElementById('open-add-address-btn');
const addressLoading = document.getElementById('address-loading');
const addressUnauthState = document.getElementById('address-unauth-state');
const addressEmptyState = document.getElementById('address-empty-state');
const addressEmptyAddBtn = document.getElementById('address-empty-add-btn');
const addressLoginPromptBtn = document.getElementById('address-login-prompt-btn');
const addressCardsList = document.getElementById('address-cards-list');
const addressFormWrap = document.getElementById('address-form-wrap');
const addressForm = document.getElementById('address-form');
const addressFormTitle = document.getElementById('address-form-title');
const cancelAddressFormBtn = document.getElementById('cancel-address-form-btn');
const cancelAddressFormBtnTop = document.getElementById('cancel-address-form-btn-top');
const addressFormError = document.getElementById('address-form-error');
const addressIdInput = document.getElementById('address-id');
const addressFullNameInput = document.getElementById('address-full-name');
const addressPhoneInput = document.getElementById('address-phone');
const addressLine1Input = document.getElementById('address-line1');
const addressLine2Input = document.getElementById('address-line2');
const addressCityInput = document.getElementById('address-city');
const addressStateInput = document.getElementById('address-state');
const addressPostalCodeInput = document.getElementById('address-postal-code');
const addressCountryInput = document.getElementById('address-country');
const addressTypeSelect = document.getElementById('address-type');
const addressIsDefaultCheckbox = document.getElementById('address-is-default');
const saveAddressBtn = document.getElementById('save-address-btn');

// DOM Elements - My Orders Modal
const navOrdersBtn = document.getElementById('nav-orders-btn');
const ordersModal = document.getElementById('orders-modal');
const ordersCloseBtn = document.getElementById('orders-close-btn');
const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
const ordersLoading = document.getElementById('orders-loading');
const ordersUnauthState = document.getElementById('orders-unauth-state');
const ordersEmptyState = document.getElementById('orders-empty-state');
const ordersListContent = document.getElementById('orders-list-content');
const ordersLoginPromptBtn = document.getElementById('orders-login-prompt-btn');
const ordersBrowseCatalogBtn = document.getElementById('orders-browse-catalog-btn');

// DOM Elements - Auth
const navLoginBtn = document.getElementById('nav-login-btn');
const navUserInfo = document.getElementById('nav-user-info');
const navUserName = document.getElementById('nav-user-name');
const navLogoutBtn = document.getElementById('nav-logout-btn');
const authModal = document.getElementById('auth-modal');
const authCloseBtn = document.getElementById('auth-close-btn');
const tabLoginBtn = document.getElementById('tab-login-btn');
const tabRegisterBtn = document.getElementById('tab-register-btn');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authErrorAlert = document.getElementById('auth-error-alert');

// DOM Elements - Seller Registration
const regIsSeller = document.getElementById('reg-is-seller');
const sellerFieldsWrap = document.getElementById('seller-fields-wrap');
const regSellerPhone = document.getElementById('reg-seller-phone');
const regBusinessName = document.getElementById('reg-business-name');
const regBusinessAddress = document.getElementById('reg-business-address');
const regBusinessPan = document.getElementById('reg-business-pan');
const regBusinessGstin = document.getElementById('reg-business-gstin');
const regSubmitBtn = document.getElementById('reg-submit-btn');

// DOM Elements - Admin Dashboard
const navAdminBtn = document.getElementById('nav-admin-btn');
const adminModal = document.getElementById('admin-modal');
const adminCloseBtn = document.getElementById('admin-close-btn');
const refreshAdminBtn = document.getElementById('refresh-admin-btn');
const adminAlertBox = document.getElementById('admin-alert-box');

// Admin Tabs & Sections
const adminTabOverview = document.getElementById('admin-tab-overview');
const adminTabProducts = document.getElementById('admin-tab-products');
const adminTabOrders = document.getElementById('admin-tab-orders');
const adminTabReviews = document.getElementById('admin-tab-reviews');
const adminOverviewSection = document.getElementById('admin-overview-section');
const adminProductsSection = document.getElementById('admin-products-section');
const adminOrdersSection = document.getElementById('admin-orders-section');
const adminReviewsSection = document.getElementById('admin-reviews-section');
const adminReviewsTbody = document.getElementById('admin-reviews-tbody');

// Admin Analytics Tab & Section
const adminTabAnalytics = document.getElementById('admin-tab-analytics');
const adminAnalyticsSection = document.getElementById('admin-analytics-section');
const analyticsLoading = document.getElementById('analytics-loading');
const analyticsError = document.getElementById('analytics-error');
const analyticsErrorText = document.getElementById('analytics-error-text');
const retryAnalyticsBtn = document.getElementById('retry-analytics-btn');
const analyticsContent = document.getElementById('analytics-content');
const refreshAnalyticsBtn = document.getElementById('refresh-analytics-btn');
const toggleTrendTableBtn = document.getElementById('toggle-trend-table-btn');
const trendTableWrap = document.getElementById('trend-table-wrap');
const trendTableTbody = document.getElementById('trend-table-tbody');
const trendChartContainer = document.getElementById('trend-chart-container');

// Analytics Metric Elements
const metricOrderValue = document.getElementById('metric-order-value');
const metricPaidRevenue = document.getElementById('metric-paid-revenue');
const metricPendingValue = document.getElementById('metric-pending-value');
const metricFailedValue = document.getElementById('metric-failed-value');
const metricTotalOrders = document.getElementById('metric-total-orders');
const metricPendingOrders = document.getElementById('metric-pending-orders');
const metricTotalCustomers = document.getElementById('metric-total-customers');
const metricProductsReviews = document.getElementById('metric-products-reviews');
const metricProductsCount = document.getElementById('metric-products-count');
const metricReviewsCount = document.getElementById('metric-reviews-count');

// Analytics Breakdown & List Elements
const statusBreakdownList = document.getElementById('status-breakdown-list');
const paymentAnalyticsList = document.getElementById('payment-analytics-list');
const topProductsList = document.getElementById('top-products-list');
const categorySalesList = document.getElementById('category-sales-list');
const analyticsRecentOrdersTbody = document.getElementById('analytics-recent-orders-tbody');

// Admin Overview Stats
const statTotalUsers = document.getElementById('stat-total-users');
const statTotalProducts = document.getElementById('stat-total-products');
const statTotalOrders = document.getElementById('stat-total-orders');
const statPendingOrders = document.getElementById('stat-pending-orders');
const statTotalReviews = document.getElementById('stat-total-reviews');

// Admin Products Management
const openAddProductBtn = document.getElementById('open-add-product-btn');
const adminProductFormWrap = document.getElementById('admin-product-form-wrap');
const adminProductFormTitle = document.getElementById('admin-product-form-title');
const cancelProductFormBtn = document.getElementById('cancel-product-form-btn');
const cancelProductBtn = document.getElementById('cancel-product-btn');
const adminProductForm = document.getElementById('admin-product-form');
const adminProductIdInput = document.getElementById('admin-product-id');
const adminProdNameInput = document.getElementById('admin-prod-name');
const adminProdCategoryInput = document.getElementById('admin-prod-category');
const adminProdPriceInput = document.getElementById('admin-prod-price');
const adminProdStockInput = document.getElementById('admin-prod-stock');
const adminProdImageInput = document.getElementById('admin-prod-image');
const adminProdDescInput = document.getElementById('admin-prod-desc');
const adminProductsTbody = document.getElementById('admin-products-tbody');

// Admin Orders Management
const adminOrdersTbody = document.getElementById('admin-orders-tbody');

// DOM Elements - Theme Toggle
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeToggleIcon = document.getElementById('theme-toggle-icon');
const themeToggleLabel = document.getElementById('theme-toggle-label');

// DOM Elements - User Profile Dropdown & Modal
const profileNavWrapper = document.getElementById('profile-nav-wrapper');
const navProfileTriggerBtn = document.getElementById('nav-profile-trigger-btn');
const profileDropdownMenu = document.getElementById('profile-dropdown-menu');
const navAvatarInitials = document.getElementById('nav-avatar-initials');
const navAvatarImg = document.getElementById('nav-avatar-img');
const dropdownAvatarInitials = document.getElementById('dropdown-avatar-initials');
const dropdownAvatarImg = document.getElementById('dropdown-avatar-img');
const dropdownUserName = document.getElementById('dropdown-user-name');
const dropdownUserEmail = document.getElementById('dropdown-user-email');
const dropdownUserRole = document.getElementById('dropdown-user-role');
const dropdownProfileBtn = document.getElementById('dropdown-profile-btn');

// DOM Elements - Profile Modal
const profileModal = document.getElementById('profile-modal');
const profileCloseBtn = document.getElementById('profile-close-btn');
const profileCancelBtn = document.getElementById('profile-cancel-btn');
const profileForm = document.getElementById('profile-form');
const profileNameInput = document.getElementById('profile-name-input');
const profileEmailInput = document.getElementById('profile-email-input');
const profilePhoneInput = document.getElementById('profile-phone-input');
const profileCreatedInput = document.getElementById('profile-created-input');
const profileRoleBadge = document.getElementById('profile-role-badge');
const profileSellerCard = document.getElementById('profile-seller-card');
const profileSellerBusinessName = document.getElementById('profile-seller-business-name');
const profileSellerContact = document.getElementById('profile-seller-contact');
const profileSellerAddress = document.getElementById('profile-seller-address');
const profileSellerPan = document.getElementById('profile-seller-pan');
const profileSellerGstin = document.getElementById('profile-seller-gstin');
const sellerVerificationStatusBadge = document.getElementById('seller-verification-status-badge');
const profileAlertError = document.getElementById('profile-alert-error');
const profileAlertSuccess = document.getElementById('profile-alert-success');
const profileSaveBtn = document.getElementById('profile-save-btn');
const profileSaveBtnText = document.getElementById('profile-save-btn-text');
const profileModalInitials = document.getElementById('profile-modal-initials');
const profileModalImg = document.getElementById('profile-modal-img');
const profileAvatarFile = document.getElementById('profile-avatar-file');
const profileAvatarUrlInput = document.getElementById('profile-avatar-url-input');
const profileAvatarUrlApplyBtn = document.getElementById('profile-avatar-url-apply-btn');
const profileAvatarRemoveBtn = document.getElementById('profile-avatar-remove-btn');
const avatarPresetsGrid = document.getElementById('avatar-presets-grid');

// DOM Elements - Profile Modal Shortcuts
const profileShortcutWishlist = document.getElementById('profile-shortcut-wishlist');
const profileShortcutOrders = document.getElementById('profile-shortcut-orders');
const profileShortcutAddresses = document.getElementById('profile-shortcut-addresses');

// Toast Notification
const toastNotification = document.getElementById('toast-notification');
let toastTimer = null;

// ============================================================
// Utilities
// ============================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderStars(rating = 0) {
  let starsHtml = '';
  const num = Number(rating) || 0;
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(num)) {
      starsHtml += '<span class="star-icon star-full" style="color: #f59e0b;" aria-hidden="true">★</span>';
    } else if (i - 0.5 <= num) {
      starsHtml += '<span class="star-icon star-half" style="color: #f59e0b;" aria-hidden="true">★</span>';
    } else {
      starsHtml += '<span class="star-icon star-empty" style="color: var(--color-border-hover);" aria-hidden="true">☆</span>';
    }
  }
  return starsHtml;
}

function formatReviewDate(dateInput) {
  if (!dateInput) return 'Recently';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Recently';

  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 0) {
    if (diffHours === 0) {
      if (diffMin <= 1) return 'Just now';
      return `${diffMin} minutes ago`;
    }
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function showToast(message) {
  if (!toastNotification) return;

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  toastNotification.classList.remove('toast-out');
  toastNotification.textContent = message;
  toastNotification.style.display = 'flex';

  toastTimer = setTimeout(() => {
    toastNotification.classList.add('toast-out');
    toastTimer = setTimeout(() => {
      toastNotification.style.display = 'none';
      toastNotification.classList.remove('toast-out');
      toastTimer = null;
    }, 220);
  }, 2800);
}

function closeModalWithAnimation(modalElement, callback) {
  if (!modalElement || modalElement.style.display === 'none') {
    if (callback) callback();
    return;
  }
  modalElement.classList.add('modal-closing');
  setTimeout(() => {
    modalElement.style.display = 'none';
    modalElement.classList.remove('modal-closing');
    document.body.style.overflow = '';
    if (callback) callback();
  }, 180);
}

function getStockInfo(stock) {
  if (stock <= 0) {
    return { className: 'out-of-stock', label: 'Out of Stock' };
  }
  if (stock <= 5) {
    return { className: 'low-stock', label: `Low Stock (${stock} left)` };
  }
  return { className: 'in-stock', label: `In Stock (${stock})` };
}

// ============================================================
// Fly-to-Cart Animation
// ============================================================

function playFlyToCartAnimation(sourceImgElement) {
  // Check for reduced-motion preference
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (cartNavBadge) {
      cartNavBadge.classList.remove('badge-pop');
      void cartNavBadge.offsetWidth;
      cartNavBadge.classList.add('badge-pop');
    }
    return;
  }

  const targetElem = document.getElementById('cart-nav-badge') || document.getElementById('nav-cart-btn');
  if (!targetElem) return;

  let startRect;
  let imgSrc = FALLBACK_IMAGE_URL;

  if (sourceImgElement && typeof sourceImgElement.getBoundingClientRect === 'function') {
    startRect = sourceImgElement.getBoundingClientRect();
    imgSrc = sourceImgElement.src || FALLBACK_IMAGE_URL;
  } else {
    // Fallback coordinates if no image element found
    startRect = {
      left: window.innerWidth / 2 - 40,
      top: window.innerHeight / 2 - 40,
      width: 80,
      height: 80
    };
  }

  const targetRect = targetElem.getBoundingClientRect();
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;

  const flyer = document.createElement('img');
  flyer.src = imgSrc;
  flyer.className = 'fly-to-cart-element';
  flyer.alt = '';
  flyer.setAttribute('aria-hidden', 'true');
  flyer.onerror = () => {
    flyer.src = FALLBACK_IMAGE_URL;
  };

  const initialSize = Math.min(Math.max(startRect.width, 48), 100);
  flyer.style.width = `${initialSize}px`;
  flyer.style.height = `${initialSize}px`;
  flyer.style.left = `${startX - initialSize / 2}px`;
  flyer.style.top = `${startY - initialSize / 2}px`;

  document.body.appendChild(flyer);

  const deltaX = targetX - startX;
  const deltaY = targetY - startY;
  const arcOffsetY = Math.min(-60, deltaY * 0.3 - 40);

  if (typeof flyer.animate === 'function') {
    const animation = flyer.animate([
      {
        transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)',
        opacity: 1
      },
      {
        offset: 0.45,
        transform: `translate3d(${deltaX * 0.45}px, ${deltaY * 0.35 + arcOffsetY}px, 0) scale(0.8) rotate(-10deg)`,
        opacity: 0.95
      },
      {
        offset: 0.85,
        transform: `translate3d(${deltaX * 0.9}px, ${deltaY * 0.88}px, 0) scale(0.35) rotate(6deg)`,
        opacity: 0.75
      },
      {
        transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.1) rotate(0deg)`,
        opacity: 0.05
      }
    ], {
      duration: 650,
      easing: 'cubic-bezier(0.2, 0.7, 0.25, 1)',
      fill: 'forwards'
    });

    animation.onfinish = () => {
      flyer.remove();
      if (cartNavBadge) {
        cartNavBadge.classList.remove('badge-pop');
        void cartNavBadge.offsetWidth;
        cartNavBadge.classList.add('badge-pop');
      }
    };

    animation.onerror = () => {
      flyer.remove();
    };
  } else {
    // Graceful fallback if animate() is not supported
    setTimeout(() => {
      flyer.remove();
      if (cartNavBadge) {
        cartNavBadge.classList.remove('badge-pop');
        void cartNavBadge.offsetWidth;
        cartNavBadge.classList.add('badge-pop');
      }
    }, 650);
  }
}

// ============================================================
// Theme Management (Light / Dark Mode)
// ============================================================

function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

function updateThemeToggleUI(theme) {
  if (!themeToggleIcon) return;
  if (themeToggleLabel) {
    themeToggleLabel.textContent = '';
    themeToggleLabel.style.display = 'none';
  }
  if (theme === 'dark') {
    themeToggleIcon.textContent = '☀️';
    if (themeToggleBtn) {
      themeToggleBtn.setAttribute('aria-label', 'Switch to light mode');
      themeToggleBtn.setAttribute('title', 'Switch to light mode');
    }
  } else {
    themeToggleIcon.textContent = '🌙';
    if (themeToggleBtn) {
      themeToggleBtn.setAttribute('aria-label', 'Switch to dark mode');
      themeToggleBtn.setAttribute('title', 'Switch to dark mode');
    }
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('theme', theme);
  } catch (e) {
    // LocalStorage might be restricted
  }
  updateThemeToggleUI(theme);
}

function toggleTheme() {
  const current = getCurrentTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  showToast(next === 'dark' ? 'Dark mode enabled 🌙' : 'Light mode enabled ☀️');
}

function initTheme() {
  let savedTheme = 'light';
  try {
    savedTheme = localStorage.getItem('theme') || 'light';
  } catch (e) {
    savedTheme = 'light';
  }
  setTheme(savedTheme);
}

// ============================================================
// User Avatar & Profile Management
// ============================================================

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80'
];

let currentEditingAvatar = '';

function renderUserAvatar(avatarUrl, name, initialsEl, imgEl) {
  const initial = (name || 'U').charAt(0).toUpperCase();
  if (avatarUrl && avatarUrl.trim()) {
    if (imgEl) {
      imgEl.src = avatarUrl;
      imgEl.style.display = 'block';
    }
    if (initialsEl) initialsEl.style.display = 'none';
  } else {
    if (imgEl) {
      imgEl.removeAttribute('src');
      imgEl.style.display = 'none';
    }
    if (initialsEl) {
      initialsEl.textContent = initial;
      initialsEl.style.display = 'inline-block';
    }
  }
}

function toggleProfileDropdown() {
  if (!profileDropdownMenu) return;
  const isCurrentlyOpen = profileDropdownMenu.style.display === 'block';
  if (isCurrentlyOpen) {
    closeProfileDropdown();
  } else {
    openProfileDropdown();
  }
}

function openProfileDropdown() {
  if (!profileDropdownMenu) return;
  profileDropdownMenu.style.display = 'block';
  if (navProfileTriggerBtn) {
    navProfileTriggerBtn.classList.add('is-active');
    navProfileTriggerBtn.setAttribute('aria-expanded', 'true');
  }
}

function closeProfileDropdown() {
  if (!profileDropdownMenu) return;
  profileDropdownMenu.style.display = 'none';
  if (navProfileTriggerBtn) {
    navProfileTriggerBtn.classList.remove('is-active');
    navProfileTriggerBtn.setAttribute('aria-expanded', 'false');
  }
}

function renderAvatarPresets() {
  if (!avatarPresetsGrid) return;
  avatarPresetsGrid.innerHTML = '';
  PRESET_AVATARS.forEach((url, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-preset-btn' + (currentEditingAvatar === url ? ' is-selected' : '');
    btn.title = `Choose avatar preset ${idx + 1}`;
    btn.setAttribute('aria-label', `Choose avatar preset ${idx + 1}`);
    btn.innerHTML = `<img src="${url}" alt="Preset avatar ${idx + 1}" class="avatar-preset-thumb" />`;
    btn.addEventListener('click', () => {
      currentEditingAvatar = url;
      updateProfileModalAvatarPreview();
      renderAvatarPresets();
    });
    avatarPresetsGrid.appendChild(btn);
  });
}

function updateProfileModalAvatarPreview() {
  const user = getAuthUser() || {};
  const name = (profileNameInput && profileNameInput.value.trim()) || user.name || 'User';
  renderUserAvatar(currentEditingAvatar, name, profileModalInitials, profileModalImg);
  if (profileAvatarUrlInput) {
    profileAvatarUrlInput.value = (currentEditingAvatar && !currentEditingAvatar.startsWith('data:')) ? currentEditingAvatar : '';
  }
}

function openProfileModal() {
  closeProfileDropdown();
  const token = getAuthToken();
  const user = getAuthUser();

  if (!token || !user) {
    openAuthModal('login', 'Please log in to view and edit your profile.');
    return;
  }

  if (profileAlertError) profileAlertError.style.display = 'none';
  if (profileAlertSuccess) profileAlertSuccess.style.display = 'none';

  if (profileNameInput) profileNameInput.value = user.name || '';
  if (profileEmailInput) profileEmailInput.value = user.email || '';
  if (profilePhoneInput) profilePhoneInput.value = user.phone || '';

  if (profileRoleBadge) {
    if (user.role === 'admin') {
      profileRoleBadge.textContent = 'Administrator';
      profileRoleBadge.className = 'user-role-badge role-admin';
    } else if (user.role === 'seller') {
      profileRoleBadge.textContent = 'Seller Account';
      profileRoleBadge.className = 'user-role-badge role-seller';
    } else {
      profileRoleBadge.textContent = 'Customer';
      profileRoleBadge.className = 'user-role-badge role-customer';
    }
  }

  // Populate or hide Seller Business Details Card
  if (profileSellerCard) {
    if (user.role === 'seller') {
      profileSellerCard.style.display = 'block';
      const sd = user.sellerDetails || {};
      if (profileSellerBusinessName) profileSellerBusinessName.textContent = sd.businessName || '—';
      if (profileSellerContact) profileSellerContact.textContent = sd.contactNumber || user.phone || '—';
      if (profileSellerAddress) profileSellerAddress.textContent = sd.businessAddress || '—';
      if (profileSellerPan) profileSellerPan.textContent = sd.pan || '••••••••••';
      if (profileSellerGstin) profileSellerGstin.textContent = sd.gstin || 'Not Applicable / Exempt';
      if (sellerVerificationStatusBadge) {
        const status = (sd.verificationStatus || 'pending').toLowerCase();
        if (status === 'verified') {
          sellerVerificationStatusBadge.textContent = '✅ Verified Merchant';
          sellerVerificationStatusBadge.className = 'badge-verification badge-verified';
        } else if (status === 'rejected') {
          sellerVerificationStatusBadge.textContent = '❌ Verification Rejected';
          sellerVerificationStatusBadge.className = 'badge-verification badge-rejected';
        } else {
          sellerVerificationStatusBadge.textContent = '⏳ Pending Verification';
          sellerVerificationStatusBadge.className = 'badge-verification badge-pending';
        }
      }
    } else {
      profileSellerCard.style.display = 'none';
    }
  }

  if (profileCreatedInput) {
    if (user.createdAt) {
      try {
        const d = new Date(user.createdAt);
        profileCreatedInput.value = d.toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (e) {
        profileCreatedInput.value = 'Member';
      }
    } else {
      profileCreatedInput.value = 'Active Member';
    }
  }

  currentEditingAvatar = user.avatar || '';
  updateProfileModalAvatarPreview();
  renderAvatarPresets();

  if (profileModal) {
    profileModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeProfileModal() {
  if (profileModal) {
    closeModalWithAnimation(profileModal, () => {
      if (profileAlertError) profileAlertError.style.display = 'none';
      if (profileAlertSuccess) profileAlertSuccess.style.display = 'none';
      if (profileAvatarFile) profileAvatarFile.value = '';
    });
  }
}

async function handleProfileSave(e) {
  e.preventDefault();
  const token = getAuthToken();
  if (!token) {
    openAuthModal('login');
    return;
  }

  const name = profileNameInput.value.trim();
  const phone = profilePhoneInput ? profilePhoneInput.value.trim() : '';

  if (!name) {
    if (profileAlertError) {
      profileAlertError.textContent = 'Full name is required.';
      profileAlertError.style.display = 'block';
    }
    return;
  }

  if (profileSaveBtn) profileSaveBtn.disabled = true;
  if (profileSaveBtnText) profileSaveBtnText.textContent = 'Saving...';
  if (profileAlertError) profileAlertError.style.display = 'none';
  if (profileAlertSuccess) profileAlertSuccess.style.display = 'none';

  try {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name,
        phone,
        avatar: currentEditingAvatar
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to update profile');
    }

    // Save updated user to localStorage
    const updatedUser = result.data;
    localStorage.setItem('user', JSON.stringify(updatedUser));
    updateAuthUI();

    if (profileAlertSuccess) {
      profileAlertSuccess.textContent = 'Profile updated successfully!';
      profileAlertSuccess.style.display = 'block';
    }

    showToast('Profile updated successfully! ✨');

    setTimeout(() => {
      closeProfileModal();
    }, 800);
  } catch (err) {
    console.error('Profile update error:', err);
    if (profileAlertError) {
      profileAlertError.textContent = err.message || 'Error updating profile. Please try again.';
      profileAlertError.style.display = 'block';
    }
  } finally {
    if (profileSaveBtn) profileSaveBtn.disabled = false;
    if (profileSaveBtnText) profileSaveBtnText.textContent = 'Save Changes';
  }
}

// ============================================================
// Authentication Client State & UI
// ============================================================

function getAuthToken() {
  return localStorage.getItem('token');
}

function getAuthUser() {
  const user = localStorage.getItem('user');
  try {
    return user ? JSON.parse(user) : null;
  } catch (e) {
    return null;
  }
}

function updateAuthUI() {
  const token = getAuthToken();
  const user = getAuthUser();

  if (token && user) {
    navLoginBtn.style.display = 'none';
    navUserInfo.style.display = 'flex';
    navUserName.textContent = user.name || 'User';

    // Render user avatar in navbar trigger & dropdown header
    renderUserAvatar(user.avatar, user.name, navAvatarInitials, navAvatarImg);
    renderUserAvatar(user.avatar, user.name, dropdownAvatarInitials, dropdownAvatarImg);

    // Populate dropdown header meta
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

    if (navAddressesBtn) navAddressesBtn.style.display = 'inline-flex';
    if (navOrdersBtn) navOrdersBtn.style.display = 'inline-flex';
    if (navAdminBtn) {
      navAdminBtn.style.display = user.role === 'admin' ? 'inline-flex' : 'none';
    }

    // Restore cached lightweight badge/state from localStorage without making API calls
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
    updateAllWishlistHeartButtons();
  } else {
    closeProfileDropdown();
    navLoginBtn.style.display = 'inline-flex';
    navUserInfo.style.display = 'none';
    navUserName.textContent = '';

    renderUserAvatar('', 'U', navAvatarInitials, navAvatarImg);
    renderUserAvatar('', 'U', dropdownAvatarInitials, dropdownAvatarImg);
    if (dropdownUserName) dropdownUserName.textContent = 'User';
    if (dropdownUserEmail) dropdownUserEmail.textContent = '';

    if (navAddressesBtn) navAddressesBtn.style.display = 'none';
    if (navOrdersBtn) navOrdersBtn.style.display = 'none';
    if (navAdminBtn) navAdminBtn.style.display = 'none';
    if (adminModal) adminModal.style.display = 'none';
    if (addressModal) addressModal.style.display = 'none';
    if (profileModal) profileModal.style.display = 'none';
    userAddresses = [];
    selectedCheckoutAddressId = null;
    selectedPaymentMethod = 'COD';
    currentCart = null;
    isCartLoaded = false;
    currentWishlist = null;
    isWishlistLoaded = false;
    wishlistProductIds.clear();
    updateCartCountBadge(0);
    updateWishlistCountBadge(0);
    updateAllWishlistHeartButtons();
    localStorage.removeItem('ministore_cart_count');
    localStorage.removeItem('ministore_wishlist_ids');
  }
}

function openAuthModal(initialTab = 'login', customNotice = '') {
  authModal.style.display = 'flex';
  authErrorAlert.style.display = customNotice ? 'block' : 'none';
  authErrorAlert.textContent = customNotice || '';

  if (initialTab === 'register') {
    tabRegisterBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    registerForm.style.display = 'flex';
    loginForm.style.display = 'none';
  } else {
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
  }
}

function toggleSellerRegistration(isSeller) {
  if (regIsSeller) regIsSeller.checked = !!isSeller;
  if (sellerFieldsWrap) {
    sellerFieldsWrap.style.display = isSeller ? 'block' : 'none';
  }
  if (regSubmitBtn) {
    regSubmitBtn.textContent = isSeller ? 'Register as Seller' : 'Create Account';
  }
  if (regSellerPhone) regSellerPhone.required = !!isSeller;
  if (regBusinessName) regBusinessName.required = !!isSeller;
  if (regBusinessAddress) regBusinessAddress.required = !!isSeller;
  if (regBusinessPan) regBusinessPan.required = !!isSeller;
}

function closeAuthModal() {
  closeModalWithAnimation(authModal, () => {
    authErrorAlert.style.display = 'none';
    authErrorAlert.textContent = '';
    loginForm.reset();
    registerForm.reset();
    toggleSellerRegistration(false);
  });
}

// ============================================================
// Wishlist / Favorites Management
// ============================================================

function updateWishlistCountBadge(count = 0) {
  const countNum = Math.max(0, parseInt(count, 10) || 0);
  if (wishlistNavBadge) {
    wishlistNavBadge.textContent = countNum;
    wishlistNavBadge.classList.remove('badge-pop');
    void wishlistNavBadge.offsetWidth;
    wishlistNavBadge.classList.add('badge-pop');
  }
  if (wishlistItemsCountBadge) {
    wishlistItemsCountBadge.textContent = `${countNum} ${countNum === 1 ? 'item' : 'items'}`;
  }
}

function isProductInWishlist(productId) {
  if (!productId) return false;
  return wishlistProductIds.has(String(productId));
}

function updateAllWishlistHeartButtons() {
  // Update heart buttons across all rendered product cards
  document.querySelectorAll('.wishlist-heart-btn').forEach((btn) => {
    const prodId = btn.dataset.id;
    const inWish = isProductInWishlist(prodId);
    btn.classList.toggle('is-active', inWish);
    btn.setAttribute('aria-label', inWish ? 'Remove from wishlist' : 'Add to wishlist');
    btn.setAttribute('title', inWish ? 'In Wishlist' : 'Add to Wishlist');
    const icon = btn.querySelector('.heart-icon');
    if (icon) icon.textContent = inWish ? '♥' : '♡';
  });

  // Update wishlist toggle button in product details modal if open
  const modalWishlistBtn = document.getElementById('modal-wishlist-toggle-btn');
  if (modalWishlistBtn && currentModalProductId) {
    const inWish = isProductInWishlist(currentModalProductId);
    modalWishlistBtn.classList.toggle('is-active', inWish);
    modalWishlistBtn.setAttribute('aria-label', inWish ? 'Remove from wishlist' : 'Add to wishlist');
    modalWishlistBtn.innerHTML = `
      <span class="heart-icon">${inWish ? '♥' : '♡'}</span>
      <span class="wishlist-btn-text">${inWish ? 'In Wishlist' : 'Add to Wishlist'}</span>
    `;
  }
}

async function fetchWishlist() {
  const token = getAuthToken();
  if (!token) {
    currentWishlist = null;
    isWishlistLoaded = false;
    wishlistProductIds.clear();
    updateWishlistCountBadge(0);
    updateAllWishlistHeartButtons();
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/wishlist`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      currentWishlist = null;
      isWishlistLoaded = false;
      wishlistProductIds.clear();
      updateWishlistCountBadge(0);
      updateAllWishlistHeartButtons();
      return;
    }

    const result = await response.json();
    if (response.ok && result.success && result.data) {
      currentWishlist = result.data;
      isWishlistLoaded = true;
      const prods = currentWishlist.products || [];
      wishlistProductIds = new Set(prods.map((p) => String(p._id || p)));
      localStorage.setItem('ministore_wishlist_ids', JSON.stringify(Array.from(wishlistProductIds)));
      updateWishlistCountBadge(wishlistProductIds.size);
      updateAllWishlistHeartButtons();
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

  // Micro-interaction bounce on button
  if (triggerBtn) {
    triggerBtn.classList.remove('pop-anim');
    void triggerBtn.offsetWidth;
    triggerBtn.classList.add('pop-anim');
  }

  try {
    const url = isCurrentlyWishlisted
      ? `${API_BASE_URL}/wishlist/${productId}`
      : `${API_BASE_URL}/wishlist`;
    const method = isCurrentlyWishlisted ? 'DELETE' : 'POST';

    const requestOptions = {
      method: method,
      headers: {
        Authorization: `Bearer ${token}`
      }
    };

    if (method === 'POST') {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify({ productId });
    }

    const response = await fetch(url, requestOptions);

    let result = null;
    try {
      result = await response.json();
    } catch (parseErr) {
      result = {
        success: false,
        message: `Server returned error (${response.status})`
      };
    }

    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      updateAuthUI();
      openAuthModal('login', 'Session expired. Please log in again.');
      return false;
    }

    if (!response.ok || !result || !result.success) {
      showToast((result && result.message) || 'Could not update wishlist.');
      return false;
    }

    // Update frontend state immediately on confirmed success
    if (isCurrentlyWishlisted) {
      wishlistProductIds.delete(prodIdStr);
      if (currentWishlist && Array.isArray(currentWishlist.products)) {
        currentWishlist.products = currentWishlist.products.filter(
          (p) => String(p._id || p) !== prodIdStr
        );
      }
      showToast('Removed from wishlist');
    } else {
      wishlistProductIds.add(prodIdStr);
      if (result.data && Array.isArray(result.data.products)) {
        currentWishlist = result.data;
      }
      showToast('Added to wishlist ❤️');
    }

    localStorage.setItem('ministore_wishlist_ids', JSON.stringify(Array.from(wishlistProductIds)));
    updateWishlistCountBadge(wishlistProductIds.size);
    updateAllWishlistHeartButtons();

    // If wishlist modal is open, refresh its contents
    if (wishlistModal && wishlistModal.style.display === 'flex') {
      renderWishlistContent();
    }

    return true;
  } catch (err) {
    console.error('Wishlist toggle error:', err);
    showToast('Network error updating wishlist.');
    return false;
  }
}

async function openWishlistModal() {
  closeProfileDropdown();
  wishlistModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const token = getAuthToken();
  if (!token) {
    wishlistLoading.style.display = 'none';
    wishlistContent.style.display = 'none';
    wishlistEmptyState.style.display = 'none';
    wishlistUnauthState.style.display = 'flex';
    return;
  }

  wishlistUnauthState.style.display = 'none';

  // If wishlist is already loaded in memory, render immediately without an unnecessary fetch
  if (isWishlistLoaded && currentWishlist) {
    wishlistLoading.style.display = 'none';
    renderWishlistContent();
    return;
  }

  wishlistLoading.style.display = 'flex';
  wishlistContent.style.display = 'none';
  wishlistEmptyState.style.display = 'none';

  await fetchWishlist();

  wishlistLoading.style.display = 'none';
  renderWishlistContent();
}

function closeWishlistModal() {
  closeModalWithAnimation(wishlistModal);
}

function renderWishlistContent() {
  const products =
    currentWishlist && Array.isArray(currentWishlist.products)
      ? currentWishlist.products
      : [];

  if (products.length === 0) {
    wishlistEmptyState.style.display = 'flex';
    wishlistContent.style.display = 'none';
    updateWishlistCountBadge(0);
    return;
  }

  wishlistEmptyState.style.display = 'none';
  wishlistItemsList.innerHTML = '';

  products.forEach((product) => {
    if (!product) return;
    const stockInfo = getStockInfo(product.stock);
    const isOutOfStock = product.stock <= 0;
    const avgRating = Number(product.averageRating) || 0;
    const totalRev = Number(product.totalReviews) || 0;

    const itemCard = document.createElement('div');
    itemCard.className = 'wishlist-item-card';
    itemCard.id = `wishlist-item-${product._id}`;

    itemCard.innerHTML = `
      <img
        src="${formatProductImageUrl(product.image)}"
        alt="${escapeHtml(product.name)}"
        class="wishlist-item-thumb"
        onerror="handleProductImageError(this, '${escapeHtml(product.image || '')}', '${escapeHtml(product.name || '')}')"
      />
      <div class="wishlist-item-info">
        <span class="wishlist-item-category">${escapeHtml(product.category)}</span>
        <h4 class="wishlist-item-name">${escapeHtml(product.name)}</h4>
        <div class="wishlist-item-meta">
          <span class="wishlist-item-price">${currencyFormatter.format(product.price)}</span>
          <span class="stock-badge ${stockInfo.className}">${stockInfo.label}</span>
          ${totalRev > 0 ? `
            <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.85rem; color: #f59e0b;">
              <span>${renderStars(avgRating)}</span>
              <span style="color: var(--color-text-muted); font-size: 0.8rem;">(${avgRating.toFixed(1)})</span>
            </span>
          ` : ''}
        </div>
      </div>
      <div class="wishlist-item-actions">
        <button
          type="button"
          class="btn btn-primary btn-sm wishlist-btn-add-cart"
          data-id="${escapeHtml(product._id)}"
          ${isOutOfStock ? 'disabled' : ''}
        >
          ${isOutOfStock ? 'Out of Stock' : '+ Add to Cart'}
        </button>
        <button
          type="button"
          class="wishlist-item-remove-btn"
          data-id="${escapeHtml(product._id)}"
        >
          ✕ Remove
        </button>
      </div>
    `;

    // Clicking thumbnail or product name opens product details
    const thumb = itemCard.querySelector('.wishlist-item-thumb');
    const title = itemCard.querySelector('.wishlist-item-name');
    [thumb, title].forEach((el) => {
      if (el) {
        el.addEventListener('click', () => {
          closeWishlistModal();
          openProductDetails(product._id);
        });
      }
    });

    // Add to Cart from Wishlist (preserves existing cart API and fly animation)
    const addCartBtn = itemCard.querySelector('.wishlist-btn-add-cart');
    if (addCartBtn && !isOutOfStock) {
      addCartBtn.addEventListener('click', () => {
        addToCart(product._id, 1, thumb);
      });
    }

    // Remove from Wishlist with card removal animation
    const removeBtn = itemCard.querySelector('.wishlist-item-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        itemCard.classList.add('removing');
        setTimeout(async () => {
          await toggleWishlistProduct(product._id);
        }, 220);
      });
    }

    wishlistItemsList.appendChild(itemCard);
  });

  updateWishlistCountBadge(products.length);
  wishlistContent.style.display = 'block';
}

// ============================================================
// Catalog & Filtering
// ============================================================

function showLoading() {
  if (loadingState) loadingState.style.display = 'flex';
  if (errorState) errorState.style.display = 'none';
  if (emptyState) emptyState.style.display = 'none';
  if (emptyFilterState) emptyFilterState.style.display = 'none';
  if (productsGrid) productsGrid.style.display = 'none';
  if (paginationContainer) paginationContainer.style.display = 'none';
}

function showError(msg) {
  if (loadingState) loadingState.style.display = 'none';
  if (errorState) errorState.style.display = 'flex';
  if (emptyState) emptyState.style.display = 'none';
  if (emptyFilterState) emptyFilterState.style.display = 'none';
  if (productsGrid) productsGrid.style.display = 'none';
  if (paginationContainer) paginationContainer.style.display = 'none';
  if (errorMessage) errorMessage.textContent = msg || 'Could not connect to the backend API.';

  if (backendStatus) {
    backendStatus.innerHTML = `
      <span class="status-dot" style="background-color: var(--color-danger); box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);"></span>
      <span class="status-label">Disconnected</span>
    `;
  }
}

// ============================================================
// Flipkart-Style Dynamic Category Navigation & Metadata
// ============================================================
const CATEGORY_META = {
  all: {
    icon: '🛍️',
    label: 'All Products',
    tint: 'rgba(37, 99, 235, 0.08)',
    border: 'rgba(37, 99, 235, 0.25)',
    color: '#2563eb'
  },
  accessories: {
    icon: '🎒',
    label: 'Accessories',
    tint: 'rgba(147, 51, 234, 0.08)',
    border: 'rgba(147, 51, 234, 0.25)',
    color: '#9333ea'
  },
  computers: {
    icon: '💻',
    label: 'Computers',
    tint: 'rgba(2, 132, 199, 0.08)',
    border: 'rgba(2, 132, 199, 0.25)',
    color: '#0284c7'
  },
  electronics: {
    icon: '🎧',
    label: 'Electronics',
    tint: 'rgba(79, 70, 229, 0.08)',
    border: 'rgba(79, 70, 229, 0.25)',
    color: '#4f46e5'
  },
  home: {
    icon: '🏠',
    label: 'Home & Living',
    tint: 'rgba(217, 119, 6, 0.08)',
    border: 'rgba(217, 119, 6, 0.25)',
    color: '#d97706'
  },
  kitchen: {
    icon: '🍳',
    label: 'Kitchen & Dining',
    tint: 'rgba(225, 29, 72, 0.08)',
    border: 'rgba(225, 29, 72, 0.25)',
    color: '#e11d48'
  },
  sports: {
    icon: '⚽',
    label: 'Sports & Fitness',
    tint: 'rgba(5, 150, 105, 0.08)',
    border: 'rgba(5, 150, 105, 0.25)',
    color: '#059669'
  },
  fashion: {
    icon: '👕',
    label: 'Fashion',
    tint: 'rgba(236, 72, 153, 0.08)',
    border: 'rgba(236, 72, 153, 0.25)',
    color: '#ec4899'
  },
  footwear: {
    icon: '👟',
    label: 'Footwear',
    tint: 'rgba(249, 115, 22, 0.08)',
    border: 'rgba(249, 115, 22, 0.25)',
    color: '#f97316'
  },
  beauty: {
    icon: '💄',
    label: 'Beauty',
    tint: 'rgba(244, 63, 94, 0.08)',
    border: 'rgba(244, 63, 94, 0.25)',
    color: '#f43f5e'
  },
  books: {
    icon: '📚',
    label: 'Books',
    tint: 'rgba(13, 148, 136, 0.08)',
    border: 'rgba(13, 148, 136, 0.25)',
    color: '#0d9488'
  },
  toys: {
    icon: '🧸',
    label: 'Toys & Baby',
    tint: 'rgba(234, 179, 8, 0.08)',
    border: 'rgba(234, 179, 8, 0.25)',
    color: '#eab308'
  },
  grocery: {
    icon: '🛒',
    label: 'Grocery',
    tint: 'rgba(34, 197, 94, 0.08)',
    border: 'rgba(34, 197, 94, 0.25)',
    color: '#22c55e'
  }
};

function getCategoryMeta(categoryName) {
  if (!categoryName) return { icon: '🏷️', tint: 'rgba(100, 116, 139, 0.08)', border: 'rgba(100, 116, 139, 0.25)' };
  const key = String(categoryName).trim().toLowerCase();
  return CATEGORY_META[key] || {
    icon: '🏷️',
    tint: 'rgba(100, 116, 139, 0.08)',
    border: 'rgba(100, 116, 139, 0.25)'
  };
}

async function initCategorySections() {
  if (!categorySectionsContainer) return;

  try {
    const [prodRes, catRes] = await Promise.all([
      fetch(`${API_BASE_URL}/products?all=true`),
      fetch(`${API_BASE_URL}/products/categories`)
    ]);

    if (!prodRes.ok) throw new Error(`HTTP error ${prodRes.status}`);

    const prodData = await prodRes.json();
    const catData = catRes.ok ? await catRes.json() : null;

    const allProds = prodData.success && Array.isArray(prodData.data) ? prodData.data : [];
    const categories = (catData && catData.success && Array.isArray(catData.data) && catData.data.length > 0)
      ? catData.data
      : (prodData.categories || []);

    allProducts = allProds;
    if (categories.length > 0) {
      populateCategories(categories);
    }

    renderCategorySections(allProds, categories);
  } catch (err) {
    console.error('Error loading category showcases:', err);
    if (categoryShowcaseLoading) {
      categoryShowcaseLoading.style.display = 'none';
    }
  }
}

function renderCategorySections(products, categoriesList) {
  if (!categorySectionsContainer) return;

  if (categoryShowcaseLoading) {
    categoryShowcaseLoading.style.display = 'none';
  }

  const rawCategories = Array.isArray(categoriesList) ? categoriesList : [];
  const distinctCategories = Array.from(
    new Set(rawCategories.map(c => (typeof c === 'string' ? c : c?.category)?.trim()).filter(Boolean))
  ).sort();

  if (distinctCategories.length === 0) {
    if (categorySectionsWrapper) categorySectionsWrapper.style.display = 'none';
    return;
  }

  if (categorySectionsWrapper) categorySectionsWrapper.style.display = 'block';

  // Group products by category
  const categoryGroups = new Map();
  distinctCategories.forEach(cat => {
    categoryGroups.set(cat.toLowerCase(), {
      name: cat,
      products: []
    });
  });

  (Array.isArray(products) ? products : []).forEach(prod => {
    if (!prod || !prod.category) return;
    const key = prod.category.trim().toLowerCase();
    if (categoryGroups.has(key)) {
      categoryGroups.get(key).products.push(prod);
    }
  });

  categorySectionsContainer.innerHTML = '';

  distinctCategories.forEach(catName => {
    const group = categoryGroups.get(catName.toLowerCase());
    const catProducts = group ? group.products : [];

    // Show up to 4 products (exactly 4 if at least 4 available; fewer if fewer available)
    const displayProducts = catProducts.slice(0, 4);
    if (displayProducts.length === 0) return;

    const meta = getCategoryMeta(catName);
    const categoryPageUrl = `category.html?name=${encodeURIComponent(catName)}`;

    const sectionEl = document.createElement('section');
    sectionEl.className = 'category-showcase-section reveal-on-scroll is-visible';
    sectionEl.setAttribute('data-category', catName);
    sectionEl.setAttribute('aria-label', `${catName} category showcase`);

    sectionEl.innerHTML = `
      <div class="category-showcase-header">
        <div class="category-showcase-title-wrap">
          <div class="category-showcase-icon-box" style="--cat-tint: ${meta.tint}; --cat-border: ${meta.border};">
            <span aria-hidden="true">${meta.icon}</span>
          </div>
          <div class="category-showcase-text-wrap">
            <h2 class="category-showcase-title">${escapeHtml(catName)}</h2>
            <span class="category-showcase-subtitle">${catProducts.length} ${catProducts.length === 1 ? 'item' : 'items'} available in store</span>
          </div>
        </div>
        <a href="${categoryPageUrl}" class="category-showcase-view-all" aria-label="View all ${escapeHtml(catName)} products">
          <span class="view-all-text">View All</span>
          <span class="view-all-arrow" aria-hidden="true">→</span>
        </a>
      </div>
      <div class="category-showcase-grid"></div>
    `;

    const grid = sectionEl.querySelector('.category-showcase-grid');
    displayProducts.forEach((prod, index) => {
      const card = createProductCard(prod, index, `showcase-${catName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-`);
      grid.appendChild(card);
    });

    categorySectionsContainer.appendChild(sectionEl);
  });
}

function populateCategories(categorySource) {
  let categories = [];
  if (Array.isArray(categorySource) && categorySource.length > 0) {
    if (typeof categorySource[0] === 'string') {
      categories = [...categorySource].filter(Boolean).sort();
    } else {
      categories = Array.from(
        new Set(categorySource.map(p => p.category?.trim()).filter(Boolean))
      ).sort();
    }
  }

  if (categorySelect && categorySelect.options.length > 1) {
    return; // Dropdown already populated
  }

  const previousSelection = categorySelect ? categorySelect.value : 'all';
  if (categorySelect) {
    categorySelect.innerHTML = '<option value="all">All Categories</option>';

    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      categorySelect.appendChild(option);
    });

    if (categories.includes(previousSelection)) {
      categorySelect.value = previousSelection;
      currentCategory = previousSelection;
    } else {
      categorySelect.value = currentCategory || 'all';
    }
  }
}

function createProductCard(product, index = 0, idPrefix = 'product-') {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.id = `${idPrefix}${product._id}`;
  if (typeof index === 'number') {
    card.style.animationDelay = `${(index % 8) * 50}ms`;
  }

  const stockInfo = getStockInfo(product.stock);
  const formattedPrice = currencyFormatter.format(product.price);
  const isOutOfStock = product.stock <= 0;
  const isWishlisted = isProductInWishlist(product._id);
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
      <p class="card-description">${escapeHtml(product.description)}</p>
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

  // Open product details when clicking anywhere on the product card (except Add to Cart & Wishlist button)
  card.style.cursor = 'pointer';
  card.addEventListener('click', (e) => {
    if (e.target.closest('.btn-add-cart') || e.target.closest('.wishlist-heart-btn')) return;
    openProductDetails(product._id);
  });

  const addCartBtn = card.querySelector('.btn-add-cart');
  if (!isOutOfStock) {
    addCartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardImg = card.querySelector('.card-image');
      addToCart(product._id, 1, cardImg);
    });
  }

  // Wishlist heart button click handling (does NOT open product details)
  const heartBtn = card.querySelector('.wishlist-heart-btn');
  if (heartBtn) {
    heartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWishlistProduct(product._id, heartBtn);
    });
  }

  return card;
}

function applyFiltersAndRender(resetPage = true) {
  if (resetPage) {
    currentPage = 1;
  }
  return fetchProducts(currentPage);
}

function renderPaginationControls(totalItems, totalPages, startIndex, endIndex) {
  if (!paginationContainer) return;

  if (totalItems <= 0) {
    paginationContainer.style.display = 'none';
    return;
  }

  paginationContainer.style.display = 'flex';

  if (paginationRangeStart) paginationRangeStart.textContent = totalItems === 0 ? 0 : (startIndex + 1);
  if (paginationRangeEnd) paginationRangeEnd.textContent = endIndex;
  if (paginationTotalItems) paginationTotalItems.textContent = totalItems;
  if (currentPageNum) currentPageNum.textContent = currentPage;
  if (totalPagesNum) totalPagesNum.textContent = totalPages;

  // Previous page button state
  if (paginationPrevBtn) {
    const isFirstPage = currentPage <= 1;
    paginationPrevBtn.disabled = isFirstPage;
    paginationPrevBtn.setAttribute('aria-disabled', isFirstPage ? 'true' : 'false');
  }

  // Next page button state
  if (paginationNextBtn) {
    const isLastPage = currentPage >= totalPages;
    paginationNextBtn.disabled = isLastPage;
    paginationNextBtn.setAttribute('aria-disabled', isLastPage ? 'true' : 'false');
  }

  // Dynamic Page numbers list with interactive click handlers
  if (paginationPages) {
    paginationPages.innerHTML = '';
    const pagesList = getPaginationPagesList(currentPage, totalPages);

    pagesList.forEach(item => {
      if (item === '...') {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '…';
        ellipsis.setAttribute('aria-hidden', 'true');
        paginationPages.appendChild(ellipsis);
      } else {
        const pageBtn = document.createElement('button');
        pageBtn.type = 'button';
        pageBtn.className = `pagination-page-btn ${item === currentPage ? 'active' : ''}`;
        pageBtn.textContent = item;
        pageBtn.setAttribute('aria-label', `Page ${item}${item === currentPage ? ', current page' : ''}`);
        if (item === currentPage) {
          pageBtn.setAttribute('aria-current', 'page');
        }
        pageBtn.addEventListener('click', () => {
          goToPage(item);
        });
        paginationPages.appendChild(pageBtn);
      }
    });
  }
}

function getPaginationPagesList(current, total) {
  if (total <= 7) {
    const pages = [];
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  } else if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  } else {
    return [1, '...', current - 1, current, current + 1, '...', total];
  }
}

async function goToPage(pageNum) {
  if (pageNum === currentPage || pageNum < 1) return;
  currentPage = pageNum;
  await fetchProducts(currentPage);

  const targetSection = document.getElementById('category-sections-wrapper') || document.getElementById('products-section');
  if (targetSection) {
    const yOffset = -70; // offset for sticky navigation bar
    const y = targetSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
}

async function fetchProducts(page = 1) {
  if (!productsGrid) {
    return;
  }
  currentPage = page;
  showLoading();

  try {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', ITEMS_PER_PAGE);

    if (currentCategory && currentCategory !== 'all') {
      params.set('category', currentCategory);
    }
    if (currentSearchTerm && currentSearchTerm.trim() !== '') {
      params.set('search', currentSearchTerm.trim());
    }

    const response = await fetch(`${API_BASE_URL}/products?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status} (${response.statusText})`);
    }

    const result = await response.json();

    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('Unexpected response format from API');
    }

    allProducts = result.data;

    if (result.categories && Array.isArray(result.categories) && result.categories.length > 0) {
      populateCategories(result.categories);
    } else if (allProducts.length > 0) {
      populateCategories(allProducts);
    }

    loadingState.style.display = 'none';
    errorState.style.display = 'none';

    const pagination = result.pagination || {
      page: page,
      limit: ITEMS_PER_PAGE,
      totalProducts: result.count,
      totalPages: Math.max(1, Math.ceil(result.count / ITEMS_PER_PAGE)),
      hasNextPage: false,
      hasPreviousPage: false
    };

    currentPage = pagination.page;
    const totalProducts = pagination.totalProducts;
    const totalPages = pagination.totalPages;

    if (totalProducts === 0) {
      productsGrid.style.display = 'none';
      if (paginationContainer) paginationContainer.style.display = 'none';
      if (currentSearchTerm || (currentCategory && currentCategory !== 'all')) {
        emptyFilterState.style.display = 'flex';
        emptyState.style.display = 'none';
      } else {
        emptyFilterState.style.display = 'none';
        emptyState.style.display = 'flex';
      }
      productCount.textContent = '0 items';
      return;
    }

    emptyState.style.display = 'none';
    emptyFilterState.style.display = 'none';
    productsGrid.innerHTML = '';

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + allProducts.length;

    allProducts.forEach((product, index) => {
      productsGrid.appendChild(createProductCard(product, startIndex + index));
    });

    if (currentSearchTerm || (currentCategory && currentCategory !== 'all')) {
      productCount.textContent = `${totalProducts} of ${totalProducts} items`;
    } else {
      productCount.textContent = `${totalProducts} ${totalProducts === 1 ? 'item' : 'items'}`;
    }

    productsGrid.style.display = 'grid';

    // Render pagination controls (previous, next, page numbers, page indicator)
    renderPaginationControls(totalProducts, totalPages, startIndex, endIndex);

    if (backendStatus) {
      backendStatus.innerHTML = `
        <span class="status-dot"></span>
        <span class="status-label">API Connected</span>
      `;
    }
  } catch (error) {
    console.error('Failed to fetch products:', error);
    showError(error.message);
  }
}

// ============================================================
// Single Product Details Modal
// ============================================================

// State for current open product in modal
let currentModalProductId = null;

function openProductDetails(productId) {
  if (!productId) return;
  window.location.href = `product-details.html?id=${encodeURIComponent(productId)}`;
}

function renderModalContent(product) {
  if (!product) return;

  const stockInfo = getStockInfo(product.stock);
  const formattedPrice = currencyFormatter.format(product.price);
  const isOutOfStock = product.stock <= 0;
  const avgRating = Number(product.averageRating) || 0;
  const totalReviews = Number(product.totalReviews) || (product.reviews ? product.reviews.length : 0);
  const hasReviews = totalReviews > 0;
  const hasFeatures = Array.isArray(product.features) && product.features.length > 0;

  modalContent.innerHTML = `
    <div class="product-details-grid">
      <!-- 1. Large Product Image -->
      <div class="modal-media-wrap">
        <img
          src="${formatProductImageUrl(product.image)}"
          alt="${escapeHtml(product.name)}"
          class="modal-image"
          onerror="handleProductImageError(this, '${escapeHtml(product.image || '')}', '${escapeHtml(product.name || '')}')"
        />
      </div>

      <div class="modal-details">
        <!-- 3. Category -->
        <span class="modal-category-tag">${escapeHtml(product.category)}</span>

        <!-- 2. Product Name -->
        <h2 class="modal-title" id="modal-product-title">${escapeHtml(product.name)}</h2>

        <!-- 4. Price in Indian Rupees (₹) and 5. Stock Availability -->
        <div class="modal-pricing-row">
          <span class="modal-price">${formattedPrice}</span>
          <span class="stock-badge ${stockInfo.className}">${stockInfo.label}</span>
        </div>

        <!-- 6. Average Customer Rating & 7. Total Number of Reviews -->
        <div class="modal-rating-summary">
          <div class="rating-stars-inline" aria-label="${hasReviews ? `Rating: ${avgRating.toFixed(1)} out of 5 stars` : 'No reviews yet'}">
            ${renderStars(avgRating)}
          </div>
          ${hasReviews ? `
            <span class="rating-score-text">${avgRating.toFixed(1)} / 5</span>
            <span class="rating-reviews-count">(${totalReviews} ${totalReviews === 1 ? 'Review' : 'Reviews'})</span>
          ` : `
            <span class="rating-score-text">No reviews yet</span>
            <span class="rating-reviews-count">(Be the first to review this product.)</span>
          `}
        </div>

        <!-- 8. Full Description -->
        <div>
          <h4 class="modal-desc-heading">Description</h4>
          <p class="modal-description">${escapeHtml(product.description)}</p>
        </div>

        <!-- 9. Product Features (if available) -->
        ${hasFeatures ? `
          <div class="modal-features-box">
            <h4 class="modal-desc-heading">Product Features</h4>
            <ul class="features-list">
              ${product.features.map(f => `<li class="feature-item"><span class="feature-check">✓</span> <span>${escapeHtml(f)}</span></li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <!-- 10. Add to Cart, Wishlist, and Back button -->
        <div class="modal-actions">
          <button
            type="button"
            class="btn btn-primary"
            id="modal-add-cart-btn"
            ${isOutOfStock ? 'disabled' : ''}
          >
            ${isOutOfStock ? 'Out of Stock' : '+ Add to Cart'}
          </button>
          <button
            type="button"
            class="btn btn-secondary modal-wishlist-btn ${isProductInWishlist(product._id) ? 'is-active' : ''}"
            id="modal-wishlist-toggle-btn"
            data-id="${escapeHtml(product._id)}"
            aria-label="${isProductInWishlist(product._id) ? 'Remove from wishlist' : 'Add to wishlist'}"
          >
            <span class="heart-icon">${isProductInWishlist(product._id) ? '♥' : '♡'}</span>
            <span class="wishlist-btn-text">${isProductInWishlist(product._id) ? 'In Wishlist' : 'Add to Wishlist'}</span>
          </button>
          <button type="button" class="btn btn-secondary" id="modal-close-action-btn">
            Back to Catalog
          </button>
        </div>
      </div>
    </div>

    <!-- 11. Customer Reviews Section -->
    <section class="product-reviews-section" id="modal-reviews-section">
      <div class="reviews-header-wrap">
        <h3 class="reviews-header-title">
          Customer Reviews
        </h3>
        <span class="reviews-count-chip">
          ${totalReviews} ${totalReviews === 1 ? 'Review' : 'Reviews'}
        </span>
      </div>

      <div class="reviews-summary-card">
        ${hasReviews ? `
          <div class="rating-big-display">
            <span class="rating-big-value">${avgRating.toFixed(1)}</span>
            <span class="rating-big-max">/ 5</span>
          </div>
          <div>
            <div class="rating-stars-inline" style="font-size: 1.35rem; margin-bottom: 4px;">
              ${renderStars(avgRating)}
            </div>
            <div style="font-size: 0.88rem; color: var(--color-text-muted); font-weight: 600;">
              Average rating based on ${totalReviews} customer ${totalReviews === 1 ? 'review' : 'reviews'}
            </div>
          </div>
        ` : `
          <div>
            <div style="font-size: 1.1rem; font-weight: 700; color: var(--color-text-main); margin-bottom: 4px;">No reviews yet</div>
            <div style="font-size: 0.88rem; color: var(--color-text-muted);">Be the first to review this product.</div>
          </div>
          <div class="rating-stars-inline" style="font-size: 1.35rem;">
            ${renderStars(0)}
          </div>
        `}
      </div>

      <!-- Write a Review Section -->
      <div id="modal-write-review-container"></div>

      <!-- Customer Reviews List -->
      <div class="reviews-list" id="modal-reviews-list"></div>
    </section>

    <!-- 12. Related Products / You May Also Like Section -->
    <section class="modal-related-section" id="modal-related-section">
      <div class="modal-related-header">
        <div class="modal-related-title-wrap">
          <span class="modal-related-badge">Curated Recommendations</span>
          <h3 class="modal-related-title">You May Also Like</h3>
        </div>
        <p class="modal-related-subtitle">Discover complementary items from our catalog</p>
      </div>

      <div class="modal-related-loading" id="modal-related-loading" style="display: none;">
        <div class="spinner" style="width: 22px; height: 22px; border-width: 2.5px;"></div>
        <span style="font-size: 0.88rem; color: var(--color-text-muted);">Finding recommendations...</span>
      </div>

      <div class="modal-related-grid" id="modal-related-grid"></div>

      <div class="modal-related-empty" id="modal-related-empty" style="display: none;">
        <p>No related products currently available.</p>
      </div>
    </section>
  `;

  // Attach Add to Cart listener
  const addCartBtn = modalContent.querySelector('#modal-add-cart-btn');
  if (addCartBtn && !isOutOfStock) {
    addCartBtn.addEventListener('click', () => {
      const modalImg = modalContent.querySelector('.modal-image');
      addToCart(product._id, 1, modalImg);
    });
  }

  // Attach Wishlist toggle listener
  const modalWishlistBtn = modalContent.querySelector('#modal-wishlist-toggle-btn');
  if (modalWishlistBtn) {
    modalWishlistBtn.addEventListener('click', () => {
      toggleWishlistProduct(product._id, modalWishlistBtn);
    });
  }

  // Attach Back / Close button listener
  const backBtn = modalContent.querySelector('#modal-close-action-btn');
  if (backBtn) {
    backBtn.addEventListener('click', closeProductModal);
  }

  // Setup Write Review Form
  setupWriteReviewSection(product);

  // Setup Customer Reviews List
  setupReviewsListSection(product);

  // Setup Dynamic Related Products
  loadRelatedProducts(product._id);

  modalLoading.style.display = 'none';
  modalError.style.display = 'none';
  modalContent.style.display = 'flex';
}

async function loadRelatedProducts(productId) {
  const grid = document.getElementById('modal-related-grid');
  const loading = document.getElementById('modal-related-loading');
  const emptyNote = document.getElementById('modal-related-empty');

  if (!grid) return;

  grid.innerHTML = '';
  if (loading) loading.style.display = 'flex';
  if (emptyNote) emptyNote.style.display = 'none';

  try {
    const response = await fetch(`${API_BASE_URL}/products/${productId}/related?limit=4`);
    const result = await response.json();

    if (loading) loading.style.display = 'none';

    if (!response.ok || !result.success || !Array.isArray(result.data) || result.data.length === 0) {
      if (emptyNote) emptyNote.style.display = 'block';
      return;
    }

    result.data.forEach((relProduct, index) => {
      // Reuse existing createProductCard with 'related-product-' ID prefix to prevent ID collision
      const card = createProductCard(relProduct, index, 'related-product-');
      card.classList.add('related-product-card');
      grid.appendChild(card);
    });

    // Synchronize wishlist hearts on newly rendered related product cards
    updateAllWishlistHeartButtons();
  } catch (error) {
    console.error('Error fetching related products:', error);
    if (loading) loading.style.display = 'none';
    if (emptyNote) {
      emptyNote.textContent = 'Unable to load recommendations at this time.';
      emptyNote.style.display = 'block';
    }
  }
}

function setupWriteReviewSection(product) {
  const container = document.getElementById('modal-write-review-container');
  if (!container) return;

  const currentUser = getAuthUser();

  if (!currentUser) {
    // Unauthenticated user prompt
    container.innerHTML = `
      <div class="review-auth-prompt">
        <p>Please login to write a review.</p>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-review-login-prompt">
          Log In
        </button>
      </div>
    `;

    const loginPromptBtn = container.querySelector('#btn-review-login-prompt');
    if (loginPromptBtn) {
      loginPromptBtn.addEventListener('click', () => {
        openAuthModal('login', 'Please log in to write a review for this product.');
      });
    }
    return;
  }

  // Authenticated user - check if they already submitted a review
  const reviews = product.reviews || [];
  const existingReview = reviews.find(r => {
    const rUserId = typeof r.user === 'object' && r.user !== null ? (r.user._id || r.user.id) : r.user;
    return String(rUserId) === String(currentUser.id);
  });

  if (existingReview) {
    container.innerHTML = `
      <div style="padding: 12px 18px; background-color: var(--color-bg-alt); border-radius: var(--radius-md); border: 1px solid var(--color-border); font-size: 0.9rem; color: var(--color-text-muted); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <span>✓ You have already reviewed this product. You can edit or delete your review below.</span>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-jump-to-my-review">View My Review</button>
      </div>
    `;

    const jumpBtn = container.querySelector('#btn-jump-to-my-review');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', () => {
        const myCard = document.getElementById(`review-card-${existingReview._id}`);
        if (myCard) {
          myCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          myCard.style.outline = '2px solid var(--color-primary)';
          setTimeout(() => { myCard.style.outline = ''; }, 2000);
        }
      });
    }
    return;
  }

  // User has not reviewed yet: Show Write a Review Form
  container.innerHTML = `
    <div class="write-review-card" id="write-review-card">
      <div class="write-review-header">
        <h4 class="write-review-title">Write a Review</h4>
        <span style="font-size: 0.82rem; color: var(--color-text-muted);">Posting as <strong>${escapeHtml(currentUser.name)}</strong></span>
      </div>

      <div class="rating-picker-row">
        <span class="rating-picker-label">Select Rating:</span>
        <div class="interactive-star-picker" id="new-star-picker" role="radiogroup" aria-label="Select rating">
          <button type="button" class="star-pick-btn" data-value="1" title="1 Star - Poor" aria-label="1 star">★</button>
          <button type="button" class="star-pick-btn" data-value="2" title="2 Stars - Fair" aria-label="2 stars">★</button>
          <button type="button" class="star-pick-btn" data-value="3" title="3 Stars - Average" aria-label="3 stars">★</button>
          <button type="button" class="star-pick-btn" data-value="4" title="4 Stars - Good" aria-label="4 stars">★</button>
          <button type="button" class="star-pick-btn" data-value="5" title="5 Stars - Excellent" aria-label="5 stars">★</button>
        </div>
        <span class="rating-hint-text" id="new-rating-hint">Click a star to rate</span>
      </div>

      <div class="review-form-group">
        <label for="new-review-comment" class="form-label" style="margin-bottom: 2px;">Comment *</label>
        <textarea
          id="new-review-comment"
          class="review-textarea"
          rows="3"
          maxlength="500"
          placeholder="Write your review... (Required, max 500 characters)"
        ></textarea>
        <div class="review-textarea-footer">
          <span id="new-review-error" style="color: var(--color-danger); font-weight: 500; display: none;"></span>
          <span id="new-review-counter">0 / 500</span>
        </div>
      </div>

      <div class="write-review-actions">
        <button type="button" class="btn btn-primary" id="btn-submit-review">
          Submit Review
        </button>
      </div>
    </div>
  `;

  // Attach Star Picker Logic
  let selectedRating = 0;
  const ratingLabels = ['1/5 - Poor', '2/5 - Fair', '3/5 - Average', '4/5 - Good', '5/5 - Excellent'];
  const starButtons = container.querySelectorAll('.star-pick-btn');
  const ratingHint = container.querySelector('#new-rating-hint');
  const commentInput = container.querySelector('#new-review-comment');
  const counterSpan = container.querySelector('#new-review-counter');
  const errorSpan = container.querySelector('#new-review-error');
  const submitBtn = container.querySelector('#btn-submit-review');

  function updateStarDisplay(ratingToHighlight, isPermanent = false) {
    starButtons.forEach(btn => {
      const val = parseInt(btn.dataset.value, 10);
      if (isPermanent) {
        btn.classList.toggle('selected', val <= ratingToHighlight);
        btn.classList.remove('preview');
      } else {
        btn.classList.toggle('preview', val <= ratingToHighlight);
      }
    });

    if (ratingToHighlight >= 1 && ratingToHighlight <= 5) {
      ratingHint.textContent = ratingLabels[ratingToHighlight - 1];
      ratingHint.style.color = '#f59e0b';
    } else {
      ratingHint.textContent = selectedRating > 0 ? ratingLabels[selectedRating - 1] : 'Click a star to rate';
      ratingHint.style.color = selectedRating > 0 ? '#f59e0b' : 'var(--color-text-muted)';
    }
  }

  starButtons.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      const hoverVal = parseInt(btn.dataset.value, 10);
      updateStarDisplay(hoverVal, false);
    });

    btn.addEventListener('mouseleave', () => {
      updateStarDisplay(selectedRating, true);
    });

    btn.addEventListener('click', () => {
      selectedRating = parseInt(btn.dataset.value, 10);
      updateStarDisplay(selectedRating, true);
      if (errorSpan) errorSpan.style.display = 'none';
    });
  });

  // Character counter
  if (commentInput && counterSpan) {
    commentInput.addEventListener('input', () => {
      const len = commentInput.value.length;
      counterSpan.textContent = `${len} / 500`;
      if (errorSpan) errorSpan.style.display = 'none';
    });
  }

  // Handle Submission
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const commentText = commentInput.value.trim();

      // Client-side Validation
      if (!selectedRating || selectedRating < 1 || selectedRating > 5) {
        if (errorSpan) {
          errorSpan.textContent = 'Please select a rating from 1 to 5 stars.';
          errorSpan.style.display = 'inline';
        }
        return;
      }

      if (!commentText) {
        if (errorSpan) {
          errorSpan.textContent = 'Please enter a review comment.';
          errorSpan.style.display = 'inline';
        }
        commentInput.focus();
        return;
      }

      if (commentText.length > 500) {
        if (errorSpan) {
          errorSpan.textContent = 'Comment cannot exceed 500 characters.';
          errorSpan.style.display = 'inline';
        }
        return;
      }

      const token = getAuthToken();
      if (!token) {
        openAuthModal('login', 'Please log in to submit your review.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      try {
        const response = await fetch(`${API_BASE_URL}/products/${product._id}/review`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            rating: selectedRating,
            comment: commentText
          })
        });

        const result = await response.json();

        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          updateAuthUI();
          openAuthModal('login', 'Session expired. Please log in again.');
          return;
        }

        if (!response.ok || !result.success) {
          if (errorSpan) {
            errorSpan.textContent = result.message || 'Failed to submit review.';
            errorSpan.style.display = 'inline';
          }
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Review';
          return;
        }

        showToast('✓ Review submitted successfully!');

        // Update allProducts local cache
        const cacheIndex = allProducts.findIndex(p => p._id === product._id);
        if (cacheIndex !== -1) {
          allProducts[cacheIndex] = result.data;
        }

        // Re-render modal content immediately with updated data
        renderModalContent(result.data);
      } catch (err) {
        console.error('Submit review error:', err);
        if (errorSpan) {
          errorSpan.textContent = 'Network error submitting review.';
          errorSpan.style.display = 'inline';
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Review';
      }
    });
  }
}

function setupReviewsListSection(product) {
  const listContainer = document.getElementById('modal-reviews-list');
  if (!listContainer) return;

  const reviews = (product.reviews || []).slice().reverse(); // Show newest first
  const currentUser = getAuthUser();

  if (reviews.length === 0) {
    listContainer.innerHTML = `
      <div class="review-empty-box">
        <div class="review-empty-icon">💬</div>
        <div class="review-empty-title">No reviews yet</div>
        <div class="review-empty-hint">Be the first to review this product and share your thoughts!</div>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = '';

  reviews.forEach(review => {
    const isOwnReview = Boolean(currentUser && (
      (typeof review.user === 'string' && review.user === currentUser.id) ||
      (typeof review.user === 'object' && review.user !== null && (review.user._id === currentUser.id || review.user.id === currentUser.id)) ||
      (String(review.user) === String(currentUser.id))
    ));

    const initial = (review.userName || 'U').charAt(0).toUpperCase();
    const formattedDate = formatReviewDate(review.createdAt);

    const card = document.createElement('div');
    card.className = 'review-item-card';
    card.id = `review-card-${review._id}`;

    // Standard review card display
    card.innerHTML = `
      <div class="review-item-header">
        <div class="review-author-cluster">
          <div class="review-author-avatar">${initial}</div>
          <div class="review-author-details">
            <div class="review-author-name-row">
              <span class="review-author-name">${escapeHtml(review.userName)}</span>
              ${isOwnReview ? '<span class="review-self-badge">Your Review</span>' : ''}
            </div>
            <span class="review-timestamp">${formattedDate}</span>
          </div>
        </div>
        <div class="rating-stars-inline" style="font-size: 1.15rem;" aria-label="${review.rating} out of 5 stars">
          ${renderStars(review.rating)}
        </div>
      </div>

      <p class="review-content-comment">${escapeHtml(review.comment)}</p>

      ${isOwnReview ? `
        <div class="review-actions-cluster">
          <button type="button" class="btn btn-secondary btn-sm btn-edit-review" data-id="${review._id}">
            ✏️ Edit
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-delete-review" data-id="${review._id}" style="color: var(--color-danger);">
            🗑️ Delete
          </button>
        </div>
      ` : ''}
    `;

    // Attach Edit and Delete listeners for own review
    if (isOwnReview) {
      const editBtn = card.querySelector('.btn-edit-review');
      const deleteBtn = card.querySelector('.btn-delete-review');

      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          if (!confirm('Are you sure you want to delete your review?')) return;

          const token = getAuthToken();
          if (!token) {
            openAuthModal('login', 'Please log in to delete your review.');
            return;
          }

          deleteBtn.disabled = true;
          deleteBtn.textContent = 'Deleting...';

          try {
            const response = await fetch(`${API_BASE_URL}/products/${product._id}/review`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            const result = await response.json();

            if (response.status === 401) {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              updateAuthUI();
              openAuthModal('login', 'Session expired. Please log in again.');
              return;
            }

            if (!response.ok || !result.success) {
              showToast(result.message || 'Failed to delete review.');
              deleteBtn.disabled = false;
              deleteBtn.textContent = '🗑️ Delete';
              return;
            }

            showToast('✓ Review deleted successfully.');

            // Update allProducts local cache
            const cacheIndex = allProducts.findIndex(p => p._id === product._id);
            if (cacheIndex !== -1) {
              allProducts[cacheIndex] = result.data;
            }

            renderModalContent(result.data);
          } catch (err) {
            console.error('Delete review error:', err);
            showToast('Network error deleting review.');
            deleteBtn.disabled = false;
            deleteBtn.textContent = '🗑️ Delete';
          }
        });
      }

      if (editBtn) {
        editBtn.addEventListener('click', () => {
          openEditReviewForm(card, product, review);
        });
      }
    }

    listContainer.appendChild(card);
  });
}

function openEditReviewForm(cardElement, product, review) {
  let editRating = Number(review.rating) || 5;
  const ratingLabels = ['1/5 - Poor', '2/5 - Fair', '3/5 - Average', '4/5 - Good', '5/5 - Excellent'];

  cardElement.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h4 style="font-size: 1rem; font-weight: 700; color: var(--color-text-main);">Edit Your Review</h4>
        <span style="font-size: 0.8rem; color: var(--color-text-muted);">Editing existing review</span>
      </div>

      <div class="rating-picker-row">
        <span class="rating-picker-label">Rating:</span>
        <div class="interactive-star-picker" id="edit-star-picker">
          <button type="button" class="star-pick-btn" data-value="1" title="1 star" aria-label="1 star">★</button>
          <button type="button" class="star-pick-btn" data-value="2" title="2 stars" aria-label="2 stars">★</button>
          <button type="button" class="star-pick-btn" data-value="3" title="3 stars" aria-label="3 stars">★</button>
          <button type="button" class="star-pick-btn" data-value="4" title="4 stars" aria-label="4 stars">★</button>
          <button type="button" class="star-pick-btn" data-value="5" title="5 stars" aria-label="5 stars">★</button>
        </div>
        <span class="rating-hint-text" id="edit-rating-hint">${ratingLabels[editRating - 1]}</span>
      </div>

      <div class="review-form-group">
        <label for="edit-comment-input" class="form-label" style="margin-bottom: 2px;">Comment *</label>
        <textarea
          id="edit-comment-input"
          class="review-textarea"
          rows="3"
          maxlength="500"
          placeholder="Write your review... (Required, max 500 characters)"
        >${escapeHtml(review.comment)}</textarea>
        <div class="review-textarea-footer">
          <span id="edit-review-error" style="color: var(--color-danger); font-weight: 500; display: none;"></span>
          <span id="edit-review-counter">${(review.comment || '').length} / 500</span>
        </div>
      </div>

      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-edit">Cancel</button>
        <button type="button" class="btn btn-primary btn-sm" id="btn-save-edit">Save Changes</button>
      </div>
    </div>
  `;

  const starButtons = cardElement.querySelectorAll('.star-pick-btn');
  const ratingHint = cardElement.querySelector('#edit-rating-hint');
  const commentInput = cardElement.querySelector('#edit-comment-input');
  const counterSpan = cardElement.querySelector('#edit-review-counter');
  const errorSpan = cardElement.querySelector('#edit-review-error');
  const cancelBtn = cardElement.querySelector('#btn-cancel-edit');
  const saveBtn = cardElement.querySelector('#btn-save-edit');

  function updateEditStarDisplay(highlightVal, isPermanent = false) {
    starButtons.forEach(btn => {
      const val = parseInt(btn.dataset.value, 10);
      if (isPermanent) {
        btn.classList.toggle('selected', val <= highlightVal);
        btn.classList.remove('preview');
      } else {
        btn.classList.toggle('preview', val <= highlightVal);
      }
    });

    if (highlightVal >= 1 && highlightVal <= 5) {
      ratingHint.textContent = ratingLabels[highlightVal - 1];
      ratingHint.style.color = '#f59e0b';
    } else {
      ratingHint.textContent = ratingLabels[editRating - 1];
      ratingHint.style.color = '#f59e0b';
    }
  }

  // Initial star selection
  updateEditStarDisplay(editRating, true);

  starButtons.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      const hoverVal = parseInt(btn.dataset.value, 10);
      updateEditStarDisplay(hoverVal, false);
    });

    btn.addEventListener('mouseleave', () => {
      updateEditStarDisplay(editRating, true);
    });

    btn.addEventListener('click', () => {
      editRating = parseInt(btn.dataset.value, 10);
      updateEditStarDisplay(editRating, true);
      if (errorSpan) errorSpan.style.display = 'none';
    });
  });

  if (commentInput && counterSpan) {
    commentInput.addEventListener('input', () => {
      counterSpan.textContent = `${commentInput.value.length} / 500`;
      if (errorSpan) errorSpan.style.display = 'none';
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      setupReviewsListSection(product);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const commentText = commentInput.value.trim();

      if (!editRating || editRating < 1 || editRating > 5) {
        if (errorSpan) {
          errorSpan.textContent = 'Please select a rating from 1 to 5 stars.';
          errorSpan.style.display = 'inline';
        }
        return;
      }

      if (!commentText) {
        if (errorSpan) {
          errorSpan.textContent = 'Please enter a review comment.';
          errorSpan.style.display = 'inline';
        }
        commentInput.focus();
        return;
      }

      if (commentText.length > 500) {
        if (errorSpan) {
          errorSpan.textContent = 'Comment cannot exceed 500 characters.';
          errorSpan.style.display = 'inline';
        }
        return;
      }

      const token = getAuthToken();
      if (!token) {
        openAuthModal('login', 'Please log in to update your review.');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        const response = await fetch(`${API_BASE_URL}/products/${product._id}/review`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            rating: editRating,
            comment: commentText
          })
        });

        const result = await response.json();

        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          updateAuthUI();
          openAuthModal('login', 'Session expired. Please log in again.');
          return;
        }

        if (!response.ok || !result.success) {
          if (errorSpan) {
            errorSpan.textContent = result.message || 'Failed to update review.';
            errorSpan.style.display = 'inline';
          }
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
          return;
        }

        showToast('✓ Review updated successfully!');

        // Update allProducts local cache
        const cacheIndex = allProducts.findIndex(p => p._id === product._id);
        if (cacheIndex !== -1) {
          allProducts[cacheIndex] = result.data;
        }

        renderModalContent(result.data);
      } catch (err) {
        console.error('Update review error:', err);
        if (errorSpan) {
          errorSpan.textContent = 'Network error updating review.';
          errorSpan.style.display = 'inline';
        }
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    });
  }
}

function closeProductModal() {
  closeModalWithAnimation(productModal);
}

// ============================================================
// Shopping Cart Operations
// ============================================================

async function fetchCart() {
  const token = getAuthToken();

  if (!token) {
    currentCart = null;
    isCartLoaded = false;
    updateCartCountBadge(0);
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/cart`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      updateAuthUI();
      currentCart = null;
      isCartLoaded = false;
      updateCartCountBadge(0);
      return;
    }

    const result = await response.json();
    if (result.success && result.data) {
      currentCart = result.data;
      isCartLoaded = true;
      const totalItems = (currentCart.items || []).reduce((sum, item) => sum + item.quantity, 0);
      updateCartCountBadge(totalItems);
    }
  } catch (error) {
    console.error('Failed to fetch cart:', error);
  }
}

function updateCartCountBadge(count) {
  if (cartNavBadge) {
    const prevCount = parseInt(cartNavBadge.textContent, 10);
    cartNavBadge.textContent = count;
    if (!isNaN(prevCount) && count !== prevCount) {
      cartNavBadge.classList.remove('badge-pop');
      void cartNavBadge.offsetWidth; // force reflow
      cartNavBadge.classList.add('badge-pop');
    }
  }
  if (cartItemsCountBadge) {
    cartItemsCountBadge.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
  }
  if (getAuthToken()) {
    localStorage.setItem('ministore_cart_count', String(count));
  } else {
    localStorage.removeItem('ministore_cart_count');
  }
}

async function openCartModal() {
  cartModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const token = getAuthToken();

  if (!token) {
    cartLoading.style.display = 'none';
    cartContent.style.display = 'none';
    cartEmptyState.style.display = 'none';
    cartUnauthState.style.display = 'flex';
    return;
  }

  cartUnauthState.style.display = 'none';

  // If cart is already cached in memory, use it without an extra network call
  if (isCartLoaded && currentCart) {
    cartLoading.style.display = 'none';
    if (!currentCart.items || currentCart.items.length === 0) {
      cartEmptyState.style.display = 'flex';
      cartContent.style.display = 'none';
    } else {
      renderCartContent();
    }
    return;
  }

  cartLoading.style.display = 'flex';
  cartContent.style.display = 'none';
  cartEmptyState.style.display = 'none';

  await fetchCart();

  cartLoading.style.display = 'none';

  if (!currentCart || !currentCart.items || currentCart.items.length === 0) {
    cartEmptyState.style.display = 'flex';
    cartContent.style.display = 'none';
  } else {
    renderCartContent();
  }
}

function closeCartModal() {
  closeModalWithAnimation(cartModal);
}

function renderCartContent() {
  if (!currentCart || !currentCart.items || currentCart.items.length === 0) {
    cartEmptyState.style.display = 'flex';
    cartContent.style.display = 'none';
    updateCartCountBadge(0);
    return;
  }

  cartEmptyState.style.display = 'none';
  cartItemsList.innerHTML = '';

  let calculatedGrandTotal = 0;
  let totalItemCount = 0;

  currentCart.items.forEach(item => {
    const product = item.product;
    if (!product) return;

    const unitPrice = product.price || 0;
    const subtotal = unitPrice * item.quantity;
    calculatedGrandTotal += subtotal;
    totalItemCount += item.quantity;

    const itemCard = document.createElement('div');
    itemCard.className = 'cart-item-card';
    itemCard.id = `cart-item-${product._id}`;

    const isAtMaxStock = item.quantity >= product.stock;

    itemCard.innerHTML = `
      <img
        src="${formatProductImageUrl(product.image)}"
        alt="${escapeHtml(product.name)}"
        class="cart-item-thumb"
        onerror="handleProductImageError(this, '${escapeHtml(product.image || '')}', '${escapeHtml(product.name || '')}')"
      />
      <div class="cart-item-info">
        <span class="cart-item-category">${escapeHtml(product.category)}</span>
        <h4 class="cart-item-name">${escapeHtml(product.name)}</h4>
        <span class="cart-item-unit-price">${currencyFormatter.format(unitPrice)} each</span>
        ${isAtMaxStock ? `<span class="cart-item-stock-warning">Max available stock reached (${product.stock})</span>` : ''}
      </div>
      <div class="cart-item-actions">
        <span class="cart-item-subtotal">${currencyFormatter.format(subtotal)}</span>
        <div class="qty-stepper">
          <button
            type="button"
            class="qty-btn btn-dec"
            data-id="${product._id}"
            aria-label="Decrease quantity"
          >−</button>
          <span class="qty-value">${item.quantity}</span>
          <button
            type="button"
            class="qty-btn btn-inc"
            data-id="${product._id}"
            ${isAtMaxStock ? 'disabled' : ''}
            aria-label="Increase quantity"
          >+</button>
        </div>
        <button
          type="button"
          class="cart-item-remove-btn"
          data-id="${product._id}"
        >
          🗑️ Remove
        </button>
      </div>
    `;

    const decBtn = itemCard.querySelector('.btn-dec');
    decBtn.addEventListener('click', () => {
      if (item.quantity > 1) {
        updateCartItemQuantity(product._id, item.quantity - 1);
      } else {
        removeCartItem(product._id);
      }
    });

    const incBtn = itemCard.querySelector('.btn-inc');
    if (!isAtMaxStock) {
      incBtn.addEventListener('click', () => {
        updateCartItemQuantity(product._id, item.quantity + 1);
      });
    }

    const removeBtn = itemCard.querySelector('.cart-item-remove-btn');
    removeBtn.addEventListener('click', () => {
      removeCartItem(product._id);
    });

    cartItemsList.appendChild(itemCard);
  });

  cartTotalAmount.textContent = currencyFormatter.format(calculatedGrandTotal);
  updateCartCountBadge(totalItemCount);
  cartContent.style.display = 'block';
}

async function addToCart(productId, quantity = 1, sourceImg = null) {
  const token = getAuthToken();

  if (!token) {
    openAuthModal('login', 'Please log in or create an account to add items to your cart.');
    return;
  }

  // Trigger fly-to-cart animation immediately on user action
  let visualElement = sourceImg;
  if (!visualElement && productId) {
    visualElement = document.getElementById(`product-${productId}`)?.querySelector('.card-image') ||
                    document.querySelector('.modal-image');
  }
  if (visualElement) {
    playFlyToCartAnimation(visualElement);
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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      updateAuthUI();
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

    showToast('✓ Added item to cart!');

    if (cartModal.style.display === 'flex') {
      renderCartContent();
    }
  } catch (error) {
    console.error('Add to cart error:', error);
    showToast('Network error adding to cart.');
  }
}

async function updateCartItemQuantity(productId, newQuantity) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/cart/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ quantity: newQuantity })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      showToast(result.message || 'Failed to update quantity.');
      return;
    }

    currentCart = result.data;
    isCartLoaded = true;
    renderCartContent();
  } catch (error) {
    console.error('Update cart item error:', error);
    showToast('Error updating cart quantity.');
  }
}

async function removeCartItem(productId) {
  const token = getAuthToken();
  if (!token) return;

  const itemElem = document.getElementById(`cart-item-${productId}`);
  if (itemElem) {
    itemElem.classList.add('cart-item-removing');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/cart/${productId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      if (itemElem) itemElem.classList.remove('cart-item-removing');
      showToast(result.message || 'Failed to remove item.');
      return;
    }

    currentCart = result.data;
    isCartLoaded = true;
    setTimeout(() => {
      renderCartContent();
      showToast('Item removed from cart.');
    }, 200);
  } catch (error) {
    if (itemElem) itemElem.classList.remove('cart-item-removing');
    console.error('Remove cart item error:', error);
    showToast('Error removing item.');
  }
}

// ============================================================
// Address Management (Customer Saved Addresses)
// ============================================================

async function openAddressModal() {
  if (!addressModal) return;
  closeProfileDropdown();
  addressModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const token = getAuthToken();
  if (!token) {
    if (addressLoading) addressLoading.style.display = 'none';
    if (addressCardsList) addressCardsList.style.display = 'none';
    if (addressEmptyState) addressEmptyState.style.display = 'none';
    if (addressFormWrap) addressFormWrap.style.display = 'none';
    if (addressUnauthState) addressUnauthState.style.display = 'flex';
    return;
  }

  if (addressUnauthState) addressUnauthState.style.display = 'none';
  closeAddressForm();
  await fetchAddresses();
}

function closeAddressModal() {
  if (!addressModal) return;
  closeModalWithAnimation(addressModal, () => {
    closeAddressForm();
  });
}

async function fetchAddresses() {
  const token = getAuthToken();
  if (!token) return;

  if (addressLoading) addressLoading.style.display = 'flex';
  if (addressCardsList) addressCardsList.style.display = 'none';
  if (addressEmptyState) addressEmptyState.style.display = 'none';

  try {
    const response = await fetch(`${API_BASE_URL}/addresses`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const result = await response.json();
    if (addressLoading) addressLoading.style.display = 'none';

    if (!response.ok || !result.success || !Array.isArray(result.data)) {
      userAddresses = [];
      if (addressEmptyState) addressEmptyState.style.display = 'flex';
      return;
    }

    userAddresses = result.data;

    if (userAddresses.length === 0) {
      if (addressEmptyState) addressEmptyState.style.display = 'flex';
      if (addressCardsList) addressCardsList.style.display = 'none';
    } else {
      if (addressEmptyState) addressEmptyState.style.display = 'none';
      renderAddressCards(userAddresses);
    }
  } catch (err) {
    console.error('Fetch addresses error:', err);
    if (addressLoading) addressLoading.style.display = 'none';
    if (addressEmptyState) addressEmptyState.style.display = 'flex';
  }
}

function renderAddressCards(addresses) {
  if (!addressCardsList) return;
  addressCardsList.innerHTML = '';

  addresses.forEach(addr => {
    const card = document.createElement('article');
    card.className = `address-card ${addr.isDefault ? 'is-default' : ''}`;
    card.id = `address-card-${addr._id}`;

    const typeClass = (addr.addressType || 'home').toLowerCase();
    const typeLabel = addr.addressType || 'Home';

    card.innerHTML = `
      <div class="address-card-header">
        <span class="address-type-pill pill-${typeClass}">${escapeHtml(typeLabel)}</span>
        ${addr.isDefault ? '<span class="address-badge-default">★ Default Address</span>' : ''}
      </div>
      <div class="address-recipient">
        <span class="address-name">${escapeHtml(addr.fullName)}</span>
        <span class="address-phone">📞 ${escapeHtml(addr.phone)}</span>
      </div>
      <div class="address-text">
        ${escapeHtml(addr.addressLine1)}${addr.addressLine2 ? ', ' + escapeHtml(addr.addressLine2) : ''}<br>
        ${escapeHtml(addr.city)}, ${escapeHtml(addr.state)} - <strong>${escapeHtml(addr.postalCode)}</strong><br>
        <span class="address-country">${escapeHtml(addr.country || 'India')}</span>
      </div>
      <div class="address-card-actions">
        <button type="button" class="btn btn-outline btn-sm edit-addr-btn" data-id="${addr._id}">✏️ Edit</button>
        <button type="button" class="btn btn-outline btn-sm delete-addr-btn" data-id="${addr._id}">🗑️ Delete</button>
        ${!addr.isDefault ? `<button type="button" class="btn btn-secondary btn-sm set-default-addr-btn" data-id="${addr._id}">Make Default</button>` : ''}
      </div>
    `;

    // Bind action listeners
    const editBtn = card.querySelector('.edit-addr-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        openAddressForm(addr);
      });
    }

    const deleteBtn = card.querySelector('.delete-addr-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        deleteAddress(addr._id, addr.fullName);
      });
    }

    const defaultBtn = card.querySelector('.set-default-addr-btn');
    if (defaultBtn) {
      defaultBtn.addEventListener('click', () => {
        setDefaultAddress(addr._id);
      });
    }

    addressCardsList.appendChild(card);
  });

  addressCardsList.style.display = 'grid';
}

function openAddressForm(addressToEdit = null) {
  if (!addressFormWrap) return;
  if (addressFormError) {
    addressFormError.style.display = 'none';
    addressFormError.textContent = '';
  }

  if (addressToEdit) {
    if (addressFormTitle) addressFormTitle.textContent = 'Edit Delivery Address';
    if (addressIdInput) addressIdInput.value = addressToEdit._id;
    if (addressFullNameInput) addressFullNameInput.value = addressToEdit.fullName || '';
    if (addressPhoneInput) addressPhoneInput.value = addressToEdit.phone || '';
    if (addressLine1Input) addressLine1Input.value = addressToEdit.addressLine1 || '';
    if (addressLine2Input) addressLine2Input.value = addressToEdit.addressLine2 || '';
    if (addressCityInput) addressCityInput.value = addressToEdit.city || '';
    if (addressStateInput) addressStateInput.value = addressToEdit.state || '';
    if (addressPostalCodeInput) addressPostalCodeInput.value = addressToEdit.postalCode || '';
    if (addressCountryInput) addressCountryInput.value = addressToEdit.country || 'India';
    if (addressTypeSelect) addressTypeSelect.value = addressToEdit.addressType || 'Home';
    if (addressIsDefaultCheckbox) addressIsDefaultCheckbox.checked = Boolean(addressToEdit.isDefault);
    if (saveAddressBtn) saveAddressBtn.textContent = 'Update Address';
  } else {
    if (addressFormTitle) addressFormTitle.textContent = 'Add New Delivery Address';
    if (addressForm) addressForm.reset();
    if (addressIdInput) addressIdInput.value = '';
    if (addressCountryInput) addressCountryInput.value = 'India';
    if (addressTypeSelect) addressTypeSelect.value = 'Home';
    // If user has no existing addresses, check default by default
    if (addressIsDefaultCheckbox) addressIsDefaultCheckbox.checked = userAddresses.length === 0;
    if (saveAddressBtn) saveAddressBtn.textContent = 'Save Address';
  }

  addressFormWrap.style.display = 'block';
  addressFormWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeAddressForm() {
  if (!addressFormWrap) return;
  addressFormWrap.style.display = 'none';
  if (addressForm) addressForm.reset();
  if (addressIdInput) addressIdInput.value = '';
  if (addressFormError) {
    addressFormError.style.display = 'none';
    addressFormError.textContent = '';
  }
}

async function handleAddressFormSubmit(e) {
  e.preventDefault();
  const token = getAuthToken();
  if (!token) return;

  if (addressFormError) {
    addressFormError.style.display = 'none';
    addressFormError.textContent = '';
  }

  const id = addressIdInput ? addressIdInput.value.trim() : '';
  const fullName = addressFullNameInput ? addressFullNameInput.value.trim() : '';
  const phone = addressPhoneInput ? addressPhoneInput.value.trim() : '';
  const addressLine1 = addressLine1Input ? addressLine1Input.value.trim() : '';
  const addressLine2 = addressLine2Input ? addressLine2Input.value.trim() : '';
  const city = addressCityInput ? addressCityInput.value.trim() : '';
  const state = addressStateInput ? addressStateInput.value.trim() : '';
  const postalCode = addressPostalCodeInput ? addressPostalCodeInput.value.trim() : '';
  const country = addressCountryInput ? addressCountryInput.value.trim() : 'India';
  const addressType = addressTypeSelect ? addressTypeSelect.value : 'Home';
  const isDefault = addressIsDefaultCheckbox ? addressIsDefaultCheckbox.checked : false;

  // Sensible client-side validations
  if (!fullName || fullName.length < 2) {
    showAddressFormError('Please enter a valid full name (minimum 2 characters).');
    return;
  }

  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  if (!cleanPhone || !/^(?:\+91|91|0)?[6-9]\d{9}$/.test(cleanPhone)) {
    showAddressFormError('Please enter a valid 10-digit mobile number (e.g. 9876543210).');
    return;
  }

  if (!addressLine1 || addressLine1.length < 3) {
    showAddressFormError('Please enter your house/flat, street, or building address.');
    return;
  }

  if (!city || city.length < 2) {
    showAddressFormError('Please enter a valid city name.');
    return;
  }

  if (!state || state.length < 2) {
    showAddressFormError('Please enter a valid state.');
    return;
  }

  const cleanPin = postalCode.replace(/\s+/g, '');
  if (!cleanPin || !/^[1-9][0-9]{5}$/.test(cleanPin)) {
    showAddressFormError('Please enter a valid 6-digit Indian PIN code (e.g. 380015).');
    return;
  }

  const payload = {
    fullName,
    phone,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
    addressType,
    isDefault
  };

  const isEditing = Boolean(id);
  const url = isEditing ? `${API_BASE_URL}/addresses/${id}` : `${API_BASE_URL}/addresses`;
  const method = isEditing ? 'PUT' : 'POST';

  if (saveAddressBtn) {
    saveAddressBtn.disabled = true;
    saveAddressBtn.textContent = 'Saving...';
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      showAddressFormError(result.message || 'Failed to save address.');
      if (saveAddressBtn) {
        saveAddressBtn.disabled = false;
        saveAddressBtn.textContent = isEditing ? 'Update Address' : 'Save Address';
      }
      return;
    }

    showToast(isEditing ? 'Address updated successfully' : 'Address added successfully');
    closeAddressForm();
    await fetchAddresses();

    // If checkout modal is open, refresh checkout addresses and select this address
    if (checkoutModal && checkoutModal.style.display === 'flex') {
      if (result.data && result.data._id) {
        selectedCheckoutAddressId = result.data._id;
      }
      await fetchCheckoutAddresses();
    }
  } catch (err) {
    console.error('Save address error:', err);
    showAddressFormError('Network error while saving address.');
  } finally {
    if (saveAddressBtn) {
      saveAddressBtn.disabled = false;
      saveAddressBtn.textContent = isEditing ? 'Update Address' : 'Save Address';
    }
  }
}

function showAddressFormError(msg) {
  if (!addressFormError) return;
  addressFormError.textContent = msg;
  addressFormError.style.display = 'block';
  addressFormError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function deleteAddress(addressId, name) {
  const token = getAuthToken();
  if (!token) return;

  const confirmed = window.confirm(`Are you sure you want to delete the delivery address for "${name || 'this recipient'}"?`);
  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE_URL}/addresses/${addressId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      showToast(result.message || 'Failed to delete address.');
      return;
    }

    showToast('Address deleted successfully');
    if (selectedCheckoutAddressId === addressId) {
      selectedCheckoutAddressId = null;
    }
    await fetchAddresses();

    if (checkoutModal && checkoutModal.style.display === 'flex') {
      await fetchCheckoutAddresses();
    }
  } catch (err) {
    console.error('Delete address error:', err);
    showToast('Network error while deleting address.');
  }
}

async function setDefaultAddress(addressId) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/addresses/${addressId}/default`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      showToast(result.message || 'Failed to update default address.');
      return;
    }

    showToast('Default address updated');
    selectedCheckoutAddressId = addressId;
    await fetchAddresses();

    if (checkoutModal && checkoutModal.style.display === 'flex') {
      await fetchCheckoutAddresses();
    }
  } catch (err) {
    console.error('Set default address error:', err);
    showToast('Network error updating default address.');
  }
}

// ============================================================
// Checkout Delivery Address Selection Logic
// ============================================================

async function fetchCheckoutAddresses() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/addresses`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const result = await response.json();
    if (!response.ok || !result.success || !Array.isArray(result.data)) {
      userAddresses = [];
    } else {
      userAddresses = result.data;
    }

    renderCheckoutAddresses();
  } catch (err) {
    console.error('Checkout fetch addresses error:', err);
    renderCheckoutAddresses();
  }
}

function renderCheckoutAddresses() {
  if (!checkoutAddressesGrid || !checkoutNoAddressBox) return;

  if (checkoutAddressAlert) {
    checkoutAddressAlert.style.display = 'none';
    checkoutAddressAlert.textContent = '';
  }

  if (userAddresses.length === 0) {
    checkoutAddressesGrid.style.display = 'none';
    checkoutNoAddressBox.style.display = 'flex';
    selectedCheckoutAddressId = null;
    if (checkoutSummaryAddress) {
      checkoutSummaryAddress.textContent = 'No delivery address selected';
    }
    return;
  }

  checkoutNoAddressBox.style.display = 'none';
  checkoutAddressesGrid.style.display = 'grid';
  checkoutAddressesGrid.innerHTML = '';

  // Determine which address should be selected:
  // 1. Keep currently selected if it exists in list
  // 2. Otherwise default address
  // 3. Otherwise first address
  let targetId = selectedCheckoutAddressId;
  const stillExists = userAddresses.some(a => a._id === targetId);
  if (!stillExists) {
    const defaultAddr = userAddresses.find(a => a.isDefault);
    targetId = defaultAddr ? defaultAddr._id : userAddresses[0]._id;
  }
  selectedCheckoutAddressId = targetId;

  if (checkoutSummaryAddress) {
    const selectedAddr = userAddresses.find(a => a._id === targetId);
    if (selectedAddr) {
      checkoutSummaryAddress.textContent = `${selectedAddr.fullName} (${selectedAddr.city}, ${selectedAddr.state})`;
    }
  }

  userAddresses.forEach(addr => {
    const isSelected = addr._id === selectedCheckoutAddressId;
    const card = document.createElement('label');
    card.className = `checkout-address-card ${isSelected ? 'is-selected' : ''}`;
    card.setAttribute('for', `checkout-addr-radio-${addr._id}`);

    const typeClass = (addr.addressType || 'home').toLowerCase();
    const typeLabel = addr.addressType || 'Home';

    card.innerHTML = `
      <div class="checkout-address-card-top">
        <input type="radio" name="checkoutDeliveryAddress" id="checkout-addr-radio-${addr._id}" value="${addr._id}" ${isSelected ? 'checked' : ''} class="checkout-address-radio">
        <div class="checkout-address-card-badges">
          <span class="address-type-pill pill-${typeClass}">${escapeHtml(typeLabel)}</span>
          ${addr.isDefault ? '<span class="address-badge-default">Default</span>' : ''}
        </div>
      </div>
      <div class="checkout-address-card-body">
        <div class="checkout-address-name">${escapeHtml(addr.fullName)}</div>
        <div class="checkout-address-phone">📞 ${escapeHtml(addr.phone)}</div>
        <div class="checkout-address-text">
          ${escapeHtml(addr.addressLine1)}${addr.addressLine2 ? ', ' + escapeHtml(addr.addressLine2) : ''}<br>
          ${escapeHtml(addr.city)}, ${escapeHtml(addr.state)} - ${escapeHtml(addr.postalCode)}
        </div>
      </div>
    `;

    const radio = card.querySelector('input[type="radio"]');
    if (radio) {
      radio.addEventListener('change', () => {
        selectCheckoutAddress(addr._id);
      });
    }

    card.addEventListener('click', (e) => {
      // Avoid double trigger if clicking radio directly
      if (e.target !== radio) {
        selectCheckoutAddress(addr._id);
      }
    });

    checkoutAddressesGrid.appendChild(card);
  });
}

function selectCheckoutAddress(addressId) {
  selectedCheckoutAddressId = addressId;
  if (checkoutAddressAlert) checkoutAddressAlert.style.display = 'none';

  if (!checkoutAddressesGrid) return;
  const cards = checkoutAddressesGrid.querySelectorAll('.checkout-address-card');
  cards.forEach(c => {
    const radio = c.querySelector('input[type="radio"]');
    if (radio && radio.value === addressId) {
      c.classList.add('is-selected');
      radio.checked = true;
    } else {
      c.classList.remove('is-selected');
      if (radio) radio.checked = false;
    }
  });

  if (checkoutSummaryAddress) {
    const addr = userAddresses.find(a => a._id === addressId);
    if (addr) {
      checkoutSummaryAddress.textContent = `${addr.fullName} (${addr.city}, ${addr.state})`;
    } else {
      checkoutSummaryAddress.textContent = 'Selected Address';
    }
  }
}

// ============================================================
// Payment Method Management & Formatting
// ============================================================

function formatPaymentMethodName(method) {
  if (!method) return 'Not Specified';
  switch (method) {
    case 'UPI': return 'UPI';
    case 'COD': return 'Cash on Delivery';
    case 'NET_BANKING': return 'Net Banking';
    default: return escapeHtml(method);
  }
}

function formatPaymentStatusBadge(status) {
  const s = status || 'Pending';
  const cls = s === 'Paid' ? 'badge-paid' : (s === 'Failed' ? 'badge-failed' : 'badge-pending');
  return `<span class="payment-status-badge ${cls}">${escapeHtml(s)}</span>`;
}

function formatPaymentNote(method) {
  switch (method) {
    case 'COD':
      return '💵 Order placed successfully. Payment will be collected on delivery.';
    case 'UPI':
      return '⚡ Order placed. Payment status: Pending. Online payment gateway integration is required to complete payment.';
    case 'NET_BANKING':
      return '🏦 Order placed. Payment status: Pending. Online payment gateway integration is required to complete payment.';
    default:
      return 'Payment status: Pending.';
  }
}

function selectPaymentMethod(method) {
  const validMethods = ['UPI', 'COD', 'NET_BANKING'];
  if (!validMethods.includes(method)) return;

  selectedPaymentMethod = method;
  if (checkoutPaymentAlert) {
    checkoutPaymentAlert.style.display = 'none';
    checkoutPaymentAlert.textContent = '';
  }

  if (checkoutSummaryPayment) {
    checkoutSummaryPayment.textContent = formatPaymentMethodName(method);
  }

  const cards = document.querySelectorAll('.checkout-payment-card');
  cards.forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    if (radio && radio.value === method) {
      card.classList.add('is-selected');
      radio.checked = true;
    } else {
      card.classList.remove('is-selected');
      if (radio) radio.checked = false;
    }
  });
}

// ============================================================
// Checkout & Order Placement
// ============================================================

async function openCheckoutModal() {
  const token = getAuthToken();

  if (!token) {
    closeCartModal();
    openAuthModal('login', 'Please log in to proceed to checkout.');
    return;
  }

  if (!currentCart || !currentCart.items || currentCart.items.length === 0) {
    showToast('Your cart is empty. Add products before checking out.');
    return;
  }

  closeCartModal();
  checkoutModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  checkoutReviewView.style.display = 'block';
  checkoutSuccessView.style.display = 'none';
  checkoutErrorAlert.style.display = 'none';
  checkoutErrorAlert.textContent = '';
  if (checkoutAddressAlert) {
    checkoutAddressAlert.style.display = 'none';
    checkoutAddressAlert.textContent = '';
  }
  if (checkoutPaymentAlert) {
    checkoutPaymentAlert.style.display = 'none';
    checkoutPaymentAlert.textContent = '';
  }
  placeOrderBtn.disabled = false;
  placeOrderBtn.textContent = '✓ Place Order Now';

  // Default payment method selection to Cash on Delivery (COD)
  selectPaymentMethod('COD');

  // Render items summary
  checkoutItemsSummary.innerHTML = '';
  let grandTotal = 0;

  currentCart.items.forEach(item => {
    const product = item.product;
    if (!product) return;

    const unitPrice = product.price || 0;
    const subtotal = unitPrice * item.quantity;
    grandTotal += subtotal;

    const row = document.createElement('div');
    row.className = 'checkout-item-row';
    row.innerHTML = `
      <div class="checkout-item-info">
        <span class="checkout-item-name">${escapeHtml(product.name)}</span>
        <span class="checkout-item-math">${currencyFormatter.format(unitPrice)} × ${item.quantity}</span>
      </div>
      <span class="checkout-item-subtotal">${currencyFormatter.format(subtotal)}</span>
    `;
    checkoutItemsSummary.appendChild(row);
  });

  checkoutTotalAmount.textContent = currencyFormatter.format(grandTotal);

  // Load and display saved delivery addresses for selection
  await fetchCheckoutAddresses();
}

function closeCheckoutModal() {
  closeModalWithAnimation(checkoutModal, () => {
    selectPaymentMethod('COD');
  });
}

async function placeOrder() {
  const token = getAuthToken();
  if (!token) return;

  // Validate delivery address is selected
  if (!selectedCheckoutAddressId) {
    if (checkoutAddressAlert) {
      checkoutAddressAlert.textContent = 'Please select or add a delivery address to place your order.';
      checkoutAddressAlert.style.display = 'block';
      checkoutAddressAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    showToast('Please select a delivery address');
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = '✓ Place Order Now';
    return;
  }

  // Validate payment method is selected
  const validMethods = ['UPI', 'COD', 'NET_BANKING'];
  if (!selectedPaymentMethod || !validMethods.includes(selectedPaymentMethod)) {
    if (checkoutPaymentAlert) {
      checkoutPaymentAlert.textContent = 'Please select a valid payment method before placing your order.';
      checkoutPaymentAlert.style.display = 'block';
      checkoutPaymentAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    showToast('Please select a payment method');
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = '✓ Place Order Now';
    return;
  }

  placeOrderBtn.disabled = true;
  placeOrderBtn.textContent = 'Processing Order...';
  checkoutErrorAlert.style.display = 'none';
  if (checkoutAddressAlert) checkoutAddressAlert.style.display = 'none';
  if (checkoutPaymentAlert) checkoutPaymentAlert.style.display = 'none';

  try {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        addressId: selectedCheckoutAddressId,
        paymentMethod: selectedPaymentMethod
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      checkoutErrorAlert.textContent = result.message || 'Failed to place order.';
      checkoutErrorAlert.style.display = 'block';
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = '✓ Place Order Now';
      return;
    }

    const order = result.data;

    // Reset local cart
    currentCart = null;
    isCartLoaded = false;
    updateCartCountBadge(0);

    // Populate success receipt
    successOrderId.textContent = `#${order._id}`;
    successOrderStatus.textContent = order.status || 'Pending';
    successOrderTotal.textContent = currencyFormatter.format(order.totalAmount);

    if (successPaymentMethod) {
      successPaymentMethod.textContent = formatPaymentMethodName(order.paymentMethod || selectedPaymentMethod);
    }
    if (successPaymentStatus) {
      successPaymentStatus.className = `payment-status-badge badge-${(order.paymentStatus || 'Pending').toLowerCase()}`;
      successPaymentStatus.textContent = order.paymentStatus || 'Pending';
    }
    if (successPaymentNote) {
      successPaymentNote.textContent = formatPaymentNote(order.paymentMethod || selectedPaymentMethod);
    }
    if (successOrderDate) {
      successOrderDate.textContent = new Date(order.createdAt || Date.now()).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // Populate shipping snapshot
    if (successShippingAddress && order.shippingAddress) {
      const snap = order.shippingAddress;
      successShippingAddress.innerHTML = `
        <strong>${escapeHtml(snap.fullName)}</strong> · 📞 ${escapeHtml(snap.phone)}<br>
        ${escapeHtml(snap.addressLine1)}${snap.addressLine2 ? ', ' + escapeHtml(snap.addressLine2) : ''}<br>
        ${escapeHtml(snap.city)}, ${escapeHtml(snap.state)} - ${escapeHtml(snap.postalCode)}, ${escapeHtml(snap.country || 'India')}
      `;
    }

    checkoutReviewView.style.display = 'none';
    checkoutSuccessView.style.display = 'flex';

    showToast('🎉 Order placed successfully!');

    // Refresh products catalog to reflect reduced stock on cards
    fetchProducts();
  } catch (err) {
    console.error('Order creation error:', err);
    checkoutErrorAlert.textContent = 'Network error while placing order.';
    checkoutErrorAlert.style.display = 'block';
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = '✓ Place Order Now';
  }
}

// ============================================================
// My Orders History
// ============================================================

async function openOrdersModal() {
  closeProfileDropdown();
  ordersModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const token = getAuthToken();

  if (!token) {
    ordersLoading.style.display = 'none';
    ordersListContent.style.display = 'none';
    ordersEmptyState.style.display = 'none';
    ordersUnauthState.style.display = 'flex';
    return;
  }

  ordersUnauthState.style.display = 'none';
  await fetchOrders();
}

function closeOrdersModal() {
  closeModalWithAnimation(ordersModal);
}

async function fetchOrders() {
  const token = getAuthToken();
  if (!token) return;

  ordersLoading.style.display = 'flex';
  ordersListContent.style.display = 'none';
  ordersEmptyState.style.display = 'none';
  ordersUnauthState.style.display = 'none';

  try {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const result = await response.json();

    ordersLoading.style.display = 'none';

    if (!response.ok || !result.success || !Array.isArray(result.data) || result.data.length === 0) {
      ordersEmptyState.style.display = 'flex';
      ordersListContent.style.display = 'none';
      return;
    }

    renderOrdersList(result.data);
  } catch (err) {
    console.error('Fetch orders error:', err);
    ordersLoading.style.display = 'none';
    ordersEmptyState.style.display = 'flex';
  }
}

function renderOrdersList(orders) {
  ordersListContent.innerHTML = '';

  orders.forEach(order => {
    const orderCard = document.createElement('article');
    orderCard.className = 'order-card';
    orderCard.id = `order-${order._id}`;

    const orderDate = new Date(order.createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const itemsRowsHtml = order.items.map(item => `
      <tr>
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td>${currencyFormatter.format(item.price)}</td>
        <td>× ${item.quantity}</td>
        <td class="text-right"><strong>${currencyFormatter.format(item.subtotal)}</strong></td>
      </tr>
    `).join('');

    orderCard.innerHTML = `
      <div class="order-card-header">
        <div class="order-id-group">
          <span class="order-id-title">Order #${escapeHtml(order._id)}</span>
          <span class="stock-badge in-stock">${escapeHtml(order.status || 'Pending')}</span>
          ${order.paymentMethod ? `<span class="payment-method-pill pill-${escapeHtml(order.paymentMethod.toLowerCase())}">💳 ${escapeHtml(formatPaymentMethodName(order.paymentMethod))}</span>` : ''}
          ${order.paymentStatus ? `<span class="payment-status-badge badge-${escapeHtml(order.paymentStatus.toLowerCase())}">${escapeHtml(order.paymentStatus)}</span>` : ''}
        </div>
        <span class="order-date-text">📅 ${orderDate}</span>
      </div>
      <table class="order-items-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Qty</th>
            <th class="text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
        </tbody>
      </table>
      ${order.shippingAddress ? `
        <div class="order-shipping-summary">
          <div class="order-shipping-title">
            <span>📍 Delivery Address</span>
            ${order.shippingAddress.addressType ? `<span class="address-type-pill pill-${order.shippingAddress.addressType.toLowerCase()}">${escapeHtml(order.shippingAddress.addressType)}</span>` : ''}
          </div>
          <div class="order-shipping-details">
            <strong>${escapeHtml(order.shippingAddress.fullName || '')}</strong> · 📞 ${escapeHtml(order.shippingAddress.phone || '')}<br>
            ${escapeHtml(order.shippingAddress.addressLine1 || '')}${order.shippingAddress.addressLine2 ? ', ' + escapeHtml(order.shippingAddress.addressLine2) : ''}<br>
            ${escapeHtml(order.shippingAddress.city || '')}, ${escapeHtml(order.shippingAddress.state || '')} - <strong>${escapeHtml(order.shippingAddress.postalCode || '')}</strong>, ${escapeHtml(order.shippingAddress.country || 'India')}
          </div>
        </div>
      ` : ''}
      <div class="order-card-footer">
        <span class="order-total-label">Total Amount:</span>
        <span class="order-total-val">${currencyFormatter.format(order.totalAmount)}</span>
      </div>
    `;

    ordersListContent.appendChild(orderCard);
  });

  ordersListContent.style.display = 'flex';
}

function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal-on-scroll');
  if (!elements || elements.length === 0) return;

  if (!('IntersectionObserver' in window)) {
    elements.forEach(el => el.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -20px 0px'
  });

  elements.forEach(el => {
    observer.observe(el);
  });
}

// ============================================================
// Event Listeners
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  updateAuthUI();
  if (getAuthToken()) {
    fetchWishlist();
    fetchCart();
  }

  // Parse URL query parameters if arriving from product-details or external links
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('search')) {
    const sTerm = urlParams.get('search');
    if (searchInput) searchInput.value = sTerm;
    currentSearchTerm = sTerm;
    if (clearSearchBtn) clearSearchBtn.style.display = 'block';
  }
  if (urlParams.has('category')) {
    const cTerm = urlParams.get('category');
    currentCategory = cTerm;
    if (categorySelect) categorySelect.value = cTerm;
  }

  if (productsGrid) {
    fetchProducts(1);
  }
  initCategorySections();
  initScrollReveal();
  initHeroInteractiveFeatures();
  initHeroBackgroundSlider();
  initFooterFunctionality();
});

// Theme Toggle Button
if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', toggleTheme);
}

// Refresh Catalog
if (refreshBtn) refreshBtn.addEventListener('click', () => fetchProducts(currentPage));
if (retryBtn) retryBtn.addEventListener('click', () => fetchProducts(currentPage));

// ============================================================
// Search Autocomplete & Suggestions
// ============================================================
let suggestionDebounceTimer = null;
let activeSuggestionIndex = -1;
let currentSuggestionsList = [];
let latestSuggestionRequestId = 0;
let suggestionAbortController = null;

// Global fallback handler for product suggestion images
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
    // Empty state: render clear "No matching products found"
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

  // Attach hover and click listeners to suggestion items
  const items = searchSuggestionsDropdown.querySelectorAll('.suggestion-item');
  items.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const productId = item.dataset.id;
      if (productId) {
        closeSuggestionsDropdown();
        openProductDetails(productId);
      }
    });

    item.addEventListener('mouseenter', () => {
      const idx = parseInt(item.dataset.index, 10);
      activeSuggestionIndex = idx;
      updateHighlightedSuggestion();
    });
  });

  // Attach listener to "View all results" button if present
  const viewAllBtn = searchSuggestionsDropdown.querySelector('#suggestions-view-all-btn');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSuggestionsDropdown();
      submitSearchQuery(query);
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

function submitSearchQuery(query) {
  const normalized = (query !== undefined ? query : (searchInput ? searchInput.value : '')).trim();
  closeSuggestionsDropdown();
  clearTimeout(searchDebounceTimeout);
  clearTimeout(suggestionDebounceTimer);
  if (suggestionAbortController) {
    suggestionAbortController.abort();
  }

  if (searchInput) {
    searchInput.value = normalized;
  }
  currentSearchTerm = normalized;
  if (clearSearchBtn) {
    clearSearchBtn.style.display = normalized ? 'block' : 'none';
  }
  applyFiltersAndRender(true);
}

async function fetchSuggestions(query) {
  const trimmed = (query || '').trim();
  if (!trimmed || trimmed.length < 1) {
    closeSuggestionsDropdown();
    return;
  }

  // Abort previous in-flight request if still running
  if (suggestionAbortController) {
    suggestionAbortController.abort();
  }
  suggestionAbortController = new AbortController();
  const currentRequestId = ++latestSuggestionRequestId;

  try {
    const response = await fetch(`${API_BASE_URL}/products/suggestions?q=${encodeURIComponent(trimmed)}&limit=12`, {
      signal: suggestionAbortController.signal
    });

    // Discard response if a newer request was dispatched
    if (currentRequestId !== latestSuggestionRequestId) {
      return;
    }

    if (!response.ok) {
      closeSuggestionsDropdown();
      return;
    }

    const result = await response.json();

    // Verify search input still matches query before rendering
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
    if (error.name === 'AbortError') {
      // Intentionally aborted due to newer keystroke; do not clear UI or error out
      return;
    }
    console.debug('Autocomplete fetch error:', error);
    if (currentRequestId === latestSuggestionRequestId) {
      closeSuggestionsDropdown();
    }
  }
}

// Search input handling
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value;
    const query = currentSearchTerm.trim();
    clearSearchBtn.style.display = currentSearchTerm ? 'block' : 'none';

    // 1. Debounced catalog search (300ms)
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      applyFiltersAndRender(true);
    }, 300);

    // 2. Debounced autocomplete suggestions (from 1st character, 220ms)
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
        // User highlighted a suggestion -> open product details
        const selected = currentSuggestionsList[activeSuggestionIndex];
        const selectedId = selected.id || selected._id;
        closeSuggestionsDropdown();
        if (selectedId) {
          openProductDetails(selectedId);
        }
        return;
      }
      // No suggestion highlighted -> perform catalog search
      submitSearchQuery(searchInput.value);
      return;
    } else if (e.key === 'Escape') {
      if (isDropdownVisible) {
        e.preventDefault();
        closeSuggestionsDropdown();
        return;
      }
    } else if (e.key === 'Tab') {
      // Natural Tab key navigation: close suggestions dropdown
      closeSuggestionsDropdown();
    }
  });
}

// Search button click handling
if (searchSubmitBtn) {
  searchSubmitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    submitSearchQuery(searchInput ? searchInput.value : '');
  });
}

// Clear search button handling
if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', () => {
    clearTimeout(searchDebounceTimeout);
    clearTimeout(suggestionDebounceTimer);
    if (suggestionAbortController) {
      suggestionAbortController.abort();
    }
    closeSuggestionsDropdown();
    searchInput.value = '';
    currentSearchTerm = '';
    clearSearchBtn.style.display = 'none';
    applyFiltersAndRender(true);
    searchInput.focus();
  });
}

// Close suggestions dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (navSearchWrap && !navSearchWrap.contains(e.target)) {
    closeSuggestionsDropdown();
  }
});

// Category filter
if (categorySelect) {
  categorySelect.addEventListener('change', (e) => {
    currentCategory = e.target.value;
    applyFiltersAndRender(true);
  });
}

// Reset filters
if (resetFiltersBtn) {
  resetFiltersBtn.addEventListener('click', () => {
    clearTimeout(searchDebounceTimeout);
    searchInput.value = '';
    currentSearchTerm = '';
    clearSearchBtn.style.display = 'none';
    categorySelect.value = 'all';
    currentCategory = 'all';
    applyFiltersAndRender(true);
  });
}

// Pagination Controls - Previous and Next
if (paginationPrevBtn) {
  paginationPrevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  });
}

if (paginationNextBtn) {
  paginationNextBtn.addEventListener('click', () => {
    const totalPages = parseInt(totalPagesNum?.textContent, 10) || 1;
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  });
}

// Product Details Modal Close
if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeProductModal);
if (modalErrorBackBtn) modalErrorBackBtn.addEventListener('click', closeProductModal);
if (productModal) {
  productModal.addEventListener('click', (e) => {
    if (e.target === productModal) closeProductModal();
  });
}

// Cart Modal Trigger & Close
if (navCartBtn) navCartBtn.addEventListener('click', openCartModal);
if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCartModal);
if (cartContinueBtn) cartContinueBtn.addEventListener('click', closeCartModal);
if (cartBrowseBtn) cartBrowseBtn.addEventListener('click', closeCartModal);
if (cartCheckoutBtn) cartCheckoutBtn.addEventListener('click', openCheckoutModal);

if (cartLoginPromptBtn) {
  cartLoginPromptBtn.addEventListener('click', () => {
    closeCartModal();
    openAuthModal('login');
  });
}

if (cartModal) {
  cartModal.addEventListener('click', (e) => {
    if (e.target === cartModal) closeCartModal();
  });
}

// Wishlist Modal Trigger & Close
if (navWishlistBtn) navWishlistBtn.addEventListener('click', openWishlistModal);
if (wishlistCloseBtn) wishlistCloseBtn.addEventListener('click', closeWishlistModal);
if (wishlistContinueBtn) wishlistContinueBtn.addEventListener('click', closeWishlistModal);
if (wishlistBrowseMoreBtn) wishlistBrowseMoreBtn.addEventListener('click', closeWishlistModal);

if (wishlistLoginPromptBtn) {
  wishlistLoginPromptBtn.addEventListener('click', () => {
    closeWishlistModal();
    openAuthModal('login');
  });
}

if (wishlistModal) {
  wishlistModal.addEventListener('click', (e) => {
    if (e.target === wishlistModal) closeWishlistModal();
  });
}

// Checkout Modal Actions
if (checkoutCloseBtn) checkoutCloseBtn.addEventListener('click', closeCheckoutModal);
if (checkoutBackToCartBtn) {
  checkoutBackToCartBtn.addEventListener('click', () => {
    closeCheckoutModal();
    openCartModal();
  });
}
if (placeOrderBtn) placeOrderBtn.addEventListener('click', placeOrder);

if (viewMyOrdersBtn) {
  viewMyOrdersBtn.addEventListener('click', () => {
    closeCheckoutModal();
    openOrdersModal();
  });
}

if (successContinueShoppingBtn) {
  successContinueShoppingBtn.addEventListener('click', closeCheckoutModal);
}

if (checkoutModal) {
  checkoutModal.addEventListener('click', (e) => {
    if (e.target === checkoutModal) closeCheckoutModal();
  });
}

// Payment method selection listeners
document.querySelectorAll('.checkout-payment-card').forEach(card => {
  card.addEventListener('click', () => {
    const method = card.dataset.method;
    if (method) selectPaymentMethod(method);
  });
});

document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.checked) {
      selectPaymentMethod(e.target.value);
    }
  });
});

// My Orders Modal Actions
if (navOrdersBtn) navOrdersBtn.addEventListener('click', openOrdersModal);
if (ordersCloseBtn) ordersCloseBtn.addEventListener('click', closeOrdersModal);
if (refreshOrdersBtn) refreshOrdersBtn.addEventListener('click', fetchOrders);
if (ordersBrowseCatalogBtn) ordersBrowseCatalogBtn.addEventListener('click', closeOrdersModal);

if (ordersLoginPromptBtn) {
  ordersLoginPromptBtn.addEventListener('click', () => {
    closeOrdersModal();
    openAuthModal('login');
  });
}

if (ordersModal) {
  ordersModal.addEventListener('click', (e) => {
    if (e.target === ordersModal) closeOrdersModal();
  });
}

// Auth Controls
if (navLoginBtn) navLoginBtn.addEventListener('click', () => openAuthModal('login'));
if (navLogoutBtn) {
  navLogoutBtn.addEventListener('click', () => {
    closeProfileDropdown();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateAuthUI();
    currentCart = null;
    updateCartCountBadge(0);
    currentWishlist = null;
    wishlistProductIds.clear();
    updateWishlistCountBadge(0);
    updateAllWishlistHeartButtons();
    userAddresses = [];
    selectedCheckoutAddressId = null;
    selectedPaymentMethod = 'COD';
    showToast('You have been logged out.');
  });
}

if (authCloseBtn) authCloseBtn.addEventListener('click', closeAuthModal);

// Profile Dropdown & Modal Controls
if (navProfileTriggerBtn) {
  navProfileTriggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleProfileDropdown();
  });
}

if (dropdownProfileBtn) {
  dropdownProfileBtn.addEventListener('click', () => {
    closeProfileDropdown();
    openProfileModal();
  });
}

// Close profile dropdown when clicking any dropdown item inside it
if (profileDropdownMenu) {
  profileDropdownMenu.querySelectorAll('.dropdown-item').forEach((item) => {
    item.addEventListener('click', () => {
      closeProfileDropdown();
    });
  });
}

// Profile Modal Actions
if (profileCloseBtn) profileCloseBtn.addEventListener('click', closeProfileModal);
if (profileCancelBtn) profileCancelBtn.addEventListener('click', closeProfileModal);
if (profileForm) profileForm.addEventListener('submit', handleProfileSave);

if (profileModal) {
  profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) closeProfileModal();
  });
}

// Profile Avatar File Upload
if (profileAvatarFile) {
  profileAvatarFile.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Please select an image smaller than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      currentEditingAvatar = loadEvent.target.result;
      updateProfileModalAvatarPreview();
      renderAvatarPresets();
      showToast('Photo loaded! Click Save to apply.');
    };
    reader.readAsDataURL(file);
  });
}

// Profile Avatar URL Apply & Reset
if (profileAvatarUrlApplyBtn) {
  profileAvatarUrlApplyBtn.addEventListener('click', () => {
    const url = profileAvatarUrlInput.value.trim();
    if (!url) {
      showToast('Please enter an image URL');
      return;
    }
    currentEditingAvatar = url;
    updateProfileModalAvatarPreview();
    renderAvatarPresets();
    showToast('Image URL applied! Click Save to confirm.');
  });
}

if (profileAvatarRemoveBtn) {
  profileAvatarRemoveBtn.addEventListener('click', () => {
    currentEditingAvatar = '';
    if (profileAvatarUrlInput) profileAvatarUrlInput.value = '';
    if (profileAvatarFile) profileAvatarFile.value = '';
    updateProfileModalAvatarPreview();
    renderAvatarPresets();
    showToast('Avatar reset to default initials.');
  });
}

// Profile Shortcuts to Wishlist, Orders, Addresses
if (profileShortcutWishlist) {
  profileShortcutWishlist.addEventListener('click', () => {
    closeProfileModal();
    openWishlistModal();
  });
}

if (profileShortcutOrders) {
  profileShortcutOrders.addEventListener('click', () => {
    closeProfileModal();
    openOrdersModal();
  });
}

if (profileShortcutAddresses) {
  profileShortcutAddresses.addEventListener('click', () => {
    closeProfileModal();
    openAddressModal();
  });
}

// Close profile dropdown on click outside
document.addEventListener('click', (e) => {
  if (profileNavWrapper && !profileNavWrapper.contains(e.target)) {
    closeProfileDropdown();
  }
});

// Addresses Modal Actions
if (navAddressesBtn) navAddressesBtn.addEventListener('click', openAddressModal);
if (addressCloseBtn) addressCloseBtn.addEventListener('click', closeAddressModal);
if (openAddAddressBtn) openAddAddressBtn.addEventListener('click', () => openAddressForm(null));
if (addressEmptyAddBtn) addressEmptyAddBtn.addEventListener('click', () => openAddressForm(null));
if (cancelAddressFormBtn) cancelAddressFormBtn.addEventListener('click', closeAddressForm);
if (cancelAddressFormBtnTop) cancelAddressFormBtnTop.addEventListener('click', closeAddressForm);
if (addressForm) addressForm.addEventListener('submit', handleAddressFormSubmit);

if (addressLoginPromptBtn) {
  addressLoginPromptBtn.addEventListener('click', () => {
    closeAddressModal();
    openAuthModal('login');
  });
}

if (addressModal) {
  addressModal.addEventListener('click', (e) => {
    if (e.target === addressModal) closeAddressModal();
  });
}

// Checkout Add Address Buttons
if (checkoutAddAddressBtn) {
  checkoutAddAddressBtn.addEventListener('click', () => {
    openAddressModal();
    openAddressForm(null);
  });
}

if (checkoutEmptyAddBtn) {
  checkoutEmptyAddBtn.addEventListener('click', () => {
    openAddressModal();
    openAddressForm(null);
  });
}

if (tabLoginBtn) {
  tabLoginBtn.addEventListener('click', () => {
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
    authErrorAlert.style.display = 'none';
  });
}

if (tabRegisterBtn) {
  tabRegisterBtn.addEventListener('click', () => {
    tabRegisterBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    registerForm.style.display = 'flex';
    loginForm.style.display = 'none';
    authErrorAlert.style.display = 'none';
  });
}

if (regIsSeller) {
  regIsSeller.addEventListener('change', (e) => {
    toggleSellerRegistration(e.target.checked);
  });
}

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

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : 'Log In';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
      }

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        authErrorAlert.textContent = result.message || 'Login failed';
        authErrorAlert.style.display = 'block';
        return;
      }

      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      updateAuthUI();
      closeAuthModal();
      showToast(`Welcome back, ${result.user.name}!`);
      await fetchCart();
      await fetchWishlist();
      await fetchAddresses();
    } catch (err) {
      console.error('Login error:', err);
      authErrorAlert.textContent = 'Unable to connect to backend server. Please make sure the server is running on http://localhost:5000.';
      authErrorAlert.style.display = 'block';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  });
}

// Register Form Submit
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authErrorAlert.style.display = 'none';

    const submitBtn = regSubmitBtn || registerForm.querySelector('button[type="submit"]');
    const isSeller = regIsSeller ? regIsSeller.checked : false;
    const defaultBtnText = isSeller ? 'Register as Seller' : 'Create Account';
    const originalBtnText = submitBtn ? submitBtn.textContent : defaultBtnText;

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (password.length < 8 || !hasLetter || !hasNumber) {
      authErrorAlert.textContent = 'Password must be at least 8 characters and contain both letters and numbers.';
      authErrorAlert.style.display = 'block';
      return;
    }

    let sellerPayload = {};
    if (isSeller) {
      const phone = regSellerPhone ? regSellerPhone.value.trim() : '';
      const businessName = regBusinessName ? regBusinessName.value.trim() : '';
      const businessAddress = regBusinessAddress ? regBusinessAddress.value.trim() : '';
      const pan = regBusinessPan ? regBusinessPan.value.trim().toUpperCase() : '';
      const gstin = regBusinessGstin ? regBusinessGstin.value.trim().toUpperCase() : '';

      if (!phone) {
        authErrorAlert.textContent = 'Contact / Mobile Number is required for seller registration.';
        authErrorAlert.style.display = 'block';
        if (regSellerPhone) regSellerPhone.focus();
        return;
      }
      const cleanPhone = phone.replace(/[\s\-\+]/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 15 || !/^\d+$/.test(cleanPhone)) {
        authErrorAlert.textContent = 'Please enter a valid mobile / contact number (at least 10 digits).';
        authErrorAlert.style.display = 'block';
        if (regSellerPhone) regSellerPhone.focus();
        return;
      }

      if (!businessName) {
        authErrorAlert.textContent = 'Business / Shop Name is required for seller registration.';
        authErrorAlert.style.display = 'block';
        if (regBusinessName) regBusinessName.focus();
        return;
      }

      if (!businessAddress) {
        authErrorAlert.textContent = 'Registered Business Address is required for seller registration.';
        authErrorAlert.style.display = 'block';
        if (regBusinessAddress) regBusinessAddress.focus();
        return;
      }

      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(pan)) {
        authErrorAlert.textContent = 'Valid 10-character Business PAN (e.g. ABCDE1234F) is required.';
        authErrorAlert.style.display = 'block';
        if (regBusinessPan) regBusinessPan.focus();
        return;
      }

      if (gstin && !['NA', 'N/A', 'EXEMPT', 'NOT APPLICABLE'].includes(gstin)) {
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstinRegex.test(gstin)) {
          authErrorAlert.textContent = 'Please enter a valid 15-character GSTIN or leave blank if exempt.';
          authErrorAlert.style.display = 'block';
          if (regBusinessGstin) regBusinessGstin.focus();
          return;
        }
      }

      sellerPayload = {
        isSeller: true,
        phone,
        businessName,
        businessAddress,
        pan,
        gstin: gstin || 'Not Applicable'
      };
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = isSeller ? 'Registering seller...' : 'Creating account...';
      }

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          ...sellerPayload
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        authErrorAlert.textContent = result.message || 'Registration failed';
        authErrorAlert.style.display = 'block';
        return;
      }

      // Automatically log in after successful registration
      const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const loginResult = await loginRes.json().catch(() => ({}));
      if (loginRes.ok && loginResult.success) {
        localStorage.setItem('token', loginResult.token);
        localStorage.setItem('user', JSON.stringify(loginResult.user));
        updateAuthUI();
        closeAuthModal();
        if (loginResult.user && loginResult.user.role === 'seller') {
          showToast(`Seller account registered! Welcome, ${loginResult.user.name}!`);
        } else {
          showToast(`Account created! Welcome, ${loginResult.user.name}!`);
        }
        await fetchCart();
        await fetchWishlist();
        await fetchAddresses();
      } else {
        authErrorAlert.textContent = loginResult.message || 'Account created! Please sign in with your email and password.';
        authErrorAlert.style.display = 'block';
      }
    } catch (err) {
      console.error('Registration error:', err);
      authErrorAlert.textContent = 'Unable to connect to backend server. Please make sure the server is running on http://localhost:5000.';
      authErrorAlert.style.display = 'block';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  });
}

// Global Keyboard (Escape closes active modal)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSuggestionsDropdown();
    closeProfileDropdown();
    if (profileModal && profileModal.style.display === 'flex') closeProfileModal();
    if (addressModal && addressModal.style.display === 'flex') closeAddressModal();
    if (adminModal && adminModal.style.display === 'flex') closeAdminModal();
    if (checkoutModal && checkoutModal.style.display === 'flex') closeCheckoutModal();
    if (ordersModal && ordersModal.style.display === 'flex') closeOrdersModal();
    if (cartModal && cartModal.style.display === 'flex') closeCartModal();
    if (productModal && productModal.style.display === 'flex') closeProductModal();
    if (authModal && authModal.style.display === 'flex') closeAuthModal();

    // Footer & info modals
    const activeInfoModal = document.querySelector('.modal-backdrop[id$="-modal"][style*="display: flex"]');
    if (activeInfoModal) {
      closeModalWithAnimation(activeInfoModal);
    }
  }
});

// ============================================================
// Admin Dashboard Controller & Logic
// ============================================================
let currentAdminTab = 'overview';

function setAdminTab(tabName) {
  currentAdminTab = tabName;
  if (adminAlertBox) adminAlertBox.style.display = 'none';

  // Toggle Tab Button Classes
  if (adminTabOverview) adminTabOverview.classList.toggle('active', tabName === 'overview');
  if (adminTabProducts) adminTabProducts.classList.toggle('active', tabName === 'products');
  if (adminTabOrders) adminTabOrders.classList.toggle('active', tabName === 'orders');
  if (adminTabReviews) adminTabReviews.classList.toggle('active', tabName === 'reviews');
  if (adminTabAnalytics) adminTabAnalytics.classList.toggle('active', tabName === 'analytics');

  // Toggle Section Displays
  if (adminOverviewSection) adminOverviewSection.style.display = tabName === 'overview' ? 'flex' : 'none';
  if (adminProductsSection) adminProductsSection.style.display = tabName === 'products' ? 'flex' : 'none';
  if (adminOrdersSection) adminOrdersSection.style.display = tabName === 'orders' ? 'flex' : 'none';
  if (adminReviewsSection) adminReviewsSection.style.display = tabName === 'reviews' ? 'flex' : 'none';
  if (adminAnalyticsSection) adminAnalyticsSection.style.display = tabName === 'analytics' ? 'flex' : 'none';

  if (tabName === 'overview') fetchAdminStats();
  if (tabName === 'products') fetchAdminProducts();
  if (tabName === 'orders') fetchAdminOrders();
  if (tabName === 'reviews') fetchAdminReviews();
  if (tabName === 'analytics') fetchAdminAnalytics();
}

function openAdminModal() {
  closeProfileDropdown();
  const user = getAuthUser();
  if (!user || user.role !== 'admin') {
    showToast('Admin privileges required.');
    return;
  }

  if (adminModal) {
    adminModal.style.display = 'flex';
    setAdminTab('overview');
  }
}

function closeAdminModal() {
  if (adminModal) {
    closeModalWithAnimation(adminModal, () => {
      closeProductForm();
      if (adminAlertBox) adminAlertBox.style.display = 'none';
    });
  }
}

async function fetchAdminStats() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/dashboard`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (statTotalUsers) statTotalUsers.textContent = data.data.users ?? 0;
      if (statTotalProducts) statTotalProducts.textContent = data.data.products ?? 0;
      if (statTotalOrders) statTotalOrders.textContent = data.data.orders ?? 0;
      if (statPendingOrders) statPendingOrders.textContent = data.data.pendingOrders ?? 0;
      if (statTotalReviews) statTotalReviews.textContent = data.data.reviews ?? 0;
    } else {
      if (adminAlertBox) {
        adminAlertBox.textContent = data.message || 'Failed to load dashboard metrics';
        adminAlertBox.style.display = 'block';
      }
    }
  } catch (err) {
    if (adminAlertBox) {
      adminAlertBox.textContent = 'Network error fetching dashboard metrics';
      adminAlertBox.style.display = 'block';
    }
  }
}

async function fetchAdminProducts() {
  try {
    const res = await fetch(`${API_BASE_URL}/products`);
    const result = await res.json();

    if (!adminProductsTbody) return;

    if (res.ok && result.success && Array.isArray(result.data)) {
      renderAdminProductsTable(result.data);
    } else {
      adminProductsTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--color-text-muted);">Failed to load products.</td></tr>`;
    }
  } catch (err) {
    if (adminProductsTbody) {
      adminProductsTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--color-danger);">Network error loading products.</td></tr>`;
    }
  }
}

function renderAdminProductsTable(products) {
  if (!adminProductsTbody) return;

  if (products.length === 0) {
    adminProductsTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--color-text-muted);">No products found in catalog.</td></tr>`;
    return;
  }

  adminProductsTbody.innerHTML = products.map(prod => {
    const stockInfo = getStockInfo(prod.stock);
    return `
      <tr id="admin-prod-row-${prod._id}">
        <td>
          <div class="table-product-cell">
            <img src="${formatProductImageUrl(prod.image)}" alt="${escapeHtml(prod.name)}" class="table-thumb" onerror="handleProductImageError(this, '${escapeHtml(prod.image || '')}', '${escapeHtml(prod.name || '')}')" />
            <span class="table-product-title">${escapeHtml(prod.name)}</span>
          </div>
        </td>
        <td><span class="card-category">${escapeHtml(prod.category)}</span></td>
        <td class="font-bold">${currencyFormatter.format(prod.price)}</td>
        <td><span class="stock-badge ${stockInfo.className}">${escapeHtml(stockInfo.label)}</span></td>
        <td class="text-right">
          <div class="table-actions">
            <button type="button" class="btn btn-secondary btn-sm btn-edit-product" data-id="${escapeHtml(prod._id)}">Edit</button>
            <button type="button" class="btn btn-secondary btn-sm btn-delete-product" data-id="${escapeHtml(prod._id)}" style="color: var(--color-danger);">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach Edit and Delete buttons
  adminProductsTbody.querySelectorAll('.btn-edit-product').forEach(btn => {
    btn.addEventListener('click', () => {
      const prodId = btn.dataset.id;
      const product = products.find(p => p._id === prodId);
      if (product) openProductForm(product);
    });
  });

  adminProductsTbody.querySelectorAll('.btn-delete-product').forEach(btn => {
    btn.addEventListener('click', async () => {
      const prodId = btn.dataset.id;
      const product = products.find(p => p._id === prodId);
      const prodName = product ? product.name : 'this product';
      
      if (!confirm(`Are you sure you want to delete "${prodName}"?`)) return;

      await deleteProduct(prodId);
    });
  });
}

function openProductForm(product = null) {
  if (!adminProductFormWrap) return;
  adminProductFormWrap.style.display = 'block';

  if (product) {
    if (adminProductFormTitle) adminProductFormTitle.textContent = 'Edit Product';
    if (adminProductIdInput) adminProductIdInput.value = product._id;
    if (adminProdNameInput) adminProdNameInput.value = product.name;
    if (adminProdCategoryInput) adminProdCategoryInput.value = product.category;
    if (adminProdPriceInput) adminProdPriceInput.value = product.price;
    if (adminProdStockInput) adminProdStockInput.value = product.stock;
    if (adminProdImageInput) adminProdImageInput.value = product.image;
    if (adminProdDescInput) adminProdDescInput.value = product.description;
  } else {
    if (adminProductFormTitle) adminProductFormTitle.textContent = 'Add New Product';
    if (adminProductForm) adminProductForm.reset();
    if (adminProductIdInput) adminProductIdInput.value = '';
  }

  adminProductFormWrap.scrollIntoView({ behavior: 'smooth' });
}

function closeProductForm() {
  if (!adminProductFormWrap) return;
  adminProductFormWrap.style.display = 'none';
  if (adminProductForm) adminProductForm.reset();
  if (adminProductIdInput) adminProductIdInput.value = '';
}

async function handleProductFormSubmit(e) {
  e.preventDefault();
  const token = getAuthToken();
  if (!token) return;

  const id = adminProductIdInput.value;
  const isEditing = Boolean(id);

  const productData = {
    name: adminProdNameInput.value.trim(),
    category: adminProdCategoryInput.value.trim(),
    price: parseFloat(adminProdPriceInput.value),
    stock: parseInt(adminProdStockInput.value, 10),
    image: adminProdImageInput.value.trim(),
    description: adminProdDescInput.value.trim()
  };

  const url = isEditing ? `${API_BASE_URL}/products/${id}` : `${API_BASE_URL}/products`;
  const method = isEditing ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(productData)
    });

    const result = await res.json();

    if (res.ok && result.success) {
      showToast(isEditing ? 'Product updated successfully!' : 'Product created successfully!');
      closeProductForm();
      await fetchAdminProducts();
      await fetchProducts(); // Refresh customer catalog view
    } else {
      if (adminAlertBox) {
        adminAlertBox.textContent = result.message || 'Failed to save product';
        adminAlertBox.style.display = 'block';
      }
    }
  } catch (err) {
    if (adminAlertBox) {
      adminAlertBox.textContent = 'Network error saving product';
      adminAlertBox.style.display = 'block';
    }
  }
}

async function deleteProduct(id) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await res.json();

    if (res.ok && result.success) {
      showToast('Product deleted successfully');
      await fetchAdminProducts();
      await fetchProducts(); // Refresh customer catalog view
    } else {
      showToast(result.message || 'Failed to delete product');
    }
  } catch (err) {
    showToast('Network error deleting product');
  }
}

async function fetchAdminOrders() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/orders`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await res.json();

    if (!adminOrdersTbody) return;

    if (res.ok && result.success && Array.isArray(result.data)) {
      renderAdminOrdersTable(result.data);
    } else {
      adminOrdersTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--color-text-muted);">Failed to load orders.</td></tr>`;
    }
  } catch (err) {
    if (adminOrdersTbody) {
      adminOrdersTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--color-danger);">Network error loading orders.</td></tr>`;
    }
  }
}

function renderAdminOrdersTable(orders) {
  if (!adminOrdersTbody) return;

  if (orders.length === 0) {
    adminOrdersTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--color-text-muted);">No orders placed yet.</td></tr>`;
    return;
  }

  const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

  adminOrdersTbody.innerHTML = orders.map(order => {
    const customerText = order.user ? `${escapeHtml(order.user.name)} (${escapeHtml(order.user.email)})` : 'Unknown User';
    const itemsSummary = (order.items || []).map(item => `${item.quantity}x ${escapeHtml(item.name)}`).join(', ');
    const formattedDate = new Date(order.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const statusOptions = statuses.map(s => {
      const selected = order.status === s ? 'selected' : '';
      return `<option value="${s}" ${selected}>${s}</option>`;
    }).join('');

    return `
      <tr>
        <td class="font-bold">#${escapeHtml(order._id.substring(order._id.length - 6))}</td>
        <td>${customerText}</td>
        <td>${formattedDate}</td>
        <td style="max-width: 200px; white-space: normal;">${itemsSummary}</td>
        <td class="font-bold">${currencyFormatter.format(order.totalAmount)}</td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div>
              ${order.paymentMethod ? `<span class="payment-method-pill pill-${escapeHtml(order.paymentMethod.toLowerCase())}">💳 ${escapeHtml(formatPaymentMethodName(order.paymentMethod))}</span>` : '<span style="color:var(--color-text-muted); font-size: 0.8rem;">—</span>'}
            </div>
            <div>
              <select class="admin-payment-status-select badge-${(order.paymentStatus || 'Pending').toLowerCase()}" data-id="${escapeHtml(order._id)}" aria-label="Update payment status">
                <option value="Pending" ${(order.paymentStatus || 'Pending') === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
                <option value="Paid" ${order.paymentStatus === 'Paid' ? 'selected' : ''}>✅ Paid</option>
                <option value="Failed" ${order.paymentStatus === 'Failed' ? 'selected' : ''}>❌ Failed</option>
              </select>
            </div>
          </div>
        </td>
        <td>
          <select class="admin-status-select" data-id="${escapeHtml(order._id)}" aria-label="Update order status">
            ${statusOptions}
          </select>
        </td>
      </tr>
    `;
  }).join('');

  adminOrdersTbody.querySelectorAll('.admin-status-select').forEach(select => {
    select.addEventListener('change', async () => {
      const orderId = select.dataset.id;
      const newStatus = select.value;
      await updateOrderStatus(orderId, newStatus);
    });
  });

  adminOrdersTbody.querySelectorAll('.admin-payment-status-select').forEach(select => {
    select.addEventListener('change', async () => {
      const orderId = select.dataset.id;
      const newPaymentStatus = select.value;
      await updateOrderPaymentStatus(orderId, newPaymentStatus, select);
    });
  });
}

async function updateOrderPaymentStatus(orderId, newPaymentStatus, select) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/payment-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ paymentStatus: newPaymentStatus })
    });

    const result = await res.json();

    if (res.ok && result.success) {
      showToast(`Payment status updated to "${newPaymentStatus}"`);
      if (select) {
        select.className = `admin-payment-status-select badge-${newPaymentStatus.toLowerCase()}`;
      }
    } else {
      showToast(result.message || 'Failed to update payment status');
      await fetchAdminOrders(); // Revert select on error
    }
  } catch (err) {
    showToast('Network error updating payment status');
    await fetchAdminOrders();
  }
}

async function updateOrderStatus(orderId, newStatus) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    });

    const result = await res.json();

    if (res.ok && result.success) {
      showToast(`Order status updated to "${newStatus}"`);
    } else {
      showToast(result.message || 'Failed to update order status');
      await fetchAdminOrders(); // Revert select on error
    }
  } catch (err) {
    showToast('Network error updating order status');
    await fetchAdminOrders();
  }
}

async function fetchAdminReviews() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/reviews`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await res.json();

    if (!adminReviewsTbody) return;

    if (res.ok && result.success && Array.isArray(result.data)) {
      renderAdminReviewsTable(result.data);
    } else {
      adminReviewsTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--color-text-muted);">Failed to load reviews.</td></tr>`;
    }
  } catch (err) {
    if (adminReviewsTbody) {
      adminReviewsTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--color-danger);">Network error loading reviews.</td></tr>`;
    }
  }
}

function renderAdminReviewsTable(reviews) {
  if (!adminReviewsTbody) return;

  if (reviews.length === 0) {
    adminReviewsTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--color-text-muted);">No customer reviews found.</td></tr>`;
    return;
  }

  adminReviewsTbody.innerHTML = reviews.map(r => {
    const formattedDate = new Date(r.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return `
      <tr id="admin-review-row-${r.reviewId}">
        <td>
          <div class="table-product-cell">
            <img src="${formatProductImageUrl(r.productImage)}" alt="${escapeHtml(r.productName)}" class="table-thumb" onerror="handleProductImageError(this, '${escapeHtml(r.productImage || '')}', '${escapeHtml(r.productName || '')}')" />
            <span class="table-product-title">${escapeHtml(r.productName)}</span>
          </div>
        </td>
        <td><strong>${escapeHtml(r.userName)}</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 4px; color: #f59e0b; font-weight: 700;">
            <span>${renderStars(r.rating)}</span>
            <span style="color: var(--color-text-main); font-size: 0.82rem;">(${r.rating}/5)</span>
          </div>
        </td>
        <td style="max-width: 260px; white-space: normal; line-height: 1.45; font-size: 0.88rem;">
          ${escapeHtml(r.comment)}
        </td>
        <td>${formattedDate}</td>
        <td class="text-right">
          <button type="button" class="btn btn-secondary btn-sm btn-admin-delete-review" data-product-id="${escapeHtml(r.productId)}" data-review-id="${escapeHtml(r.reviewId)}" style="color: var(--color-danger);">
            🗑️ Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');

  adminReviewsTbody.querySelectorAll('.btn-admin-delete-review').forEach(btn => {
    btn.addEventListener('click', async () => {
      const prodId = btn.dataset.productId;
      const revId = btn.dataset.reviewId;
      if (!confirm('Are you sure you want to delete this customer review?')) return;
      await deleteAdminReview(prodId, revId);
    });
  });
}

async function deleteAdminReview(productId, reviewId) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/reviews/${productId}/${reviewId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await res.json();

    if (res.ok && result.success) {
      showToast('✓ Review deleted successfully by administrator.');
      await fetchAdminReviews();
      await fetchAdminStats();
      await fetchProducts(); // Refresh catalog products
    } else {
      showToast(result.message || 'Failed to delete review');
    }
  } catch (err) {
    showToast('Network error deleting review');
  }
}

// ============================================================
// Admin Analytics Controller & Visualizations
// ============================================================
let currentAnalyticsRange = '7d';
let isTrendTableVisible = false;

function setAnalyticsRange(range) {
  if (currentAnalyticsRange === range) return;
  currentAnalyticsRange = range;

  // Update active state on range selector buttons
  document.querySelectorAll('.analytics-range-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.range === range);
  });

  fetchAdminAnalytics();
}

async function fetchAdminAnalytics() {
  const token = getAuthToken();
  if (!token) return;

  if (analyticsLoading) analyticsLoading.style.display = 'flex';
  if (analyticsContent) analyticsContent.style.display = 'none';
  if (analyticsError) analyticsError.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE_URL}/admin/analytics?range=${encodeURIComponent(currentAnalyticsRange)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await res.json();

    if (analyticsLoading) analyticsLoading.style.display = 'none';

    if (!res.ok || !result.success || !result.data) {
      if (analyticsError) {
        if (analyticsErrorText) {
          analyticsErrorText.textContent = result.message || 'Failed to calculate analytics.';
        }
        analyticsError.style.display = 'flex';
      }
      return;
    }

    renderAnalyticsDashboard(result.data);
    if (analyticsContent) analyticsContent.style.display = 'flex';
  } catch (err) {
    console.error('Fetch analytics error:', err);
    if (analyticsLoading) analyticsLoading.style.display = 'none';
    if (analyticsError) {
      if (analyticsErrorText) {
        analyticsErrorText.textContent = 'Network error fetching analytics.';
      }
      analyticsError.style.display = 'flex';
    }
  }
}

function renderAnalyticsDashboard(data) {
  const { overview, salesTrend, orderStatus, paymentAnalytics, topProducts, categorySales, recentOrders } = data;

  // 1. Overview Metric Cards
  if (overview) {
    if (metricOrderValue) metricOrderValue.textContent = currencyFormatter.format(overview.totalOrderValue || 0);
    if (metricPaidRevenue) metricPaidRevenue.textContent = currencyFormatter.format(overview.paidRevenue || 0);
    if (metricPendingValue) metricPendingValue.textContent = currencyFormatter.format(overview.pendingPaymentValue || 0);
    if (metricFailedValue) metricFailedValue.textContent = currencyFormatter.format(overview.failedPaymentValue || 0);
    if (metricTotalOrders) metricTotalOrders.textContent = (overview.totalOrders || 0).toLocaleString();
    if (metricPendingOrders) metricPendingOrders.textContent = (overview.pendingOrders || 0).toLocaleString();
    if (metricTotalCustomers) metricTotalCustomers.textContent = (overview.totalCustomers || 0).toLocaleString();
    if (metricProductsReviews) metricProductsReviews.textContent = `${overview.totalProducts || 0} / ${overview.totalReviews || 0}`;
    if (metricProductsCount) metricProductsCount.textContent = overview.totalProducts || 0;
    if (metricReviewsCount) metricReviewsCount.textContent = overview.totalReviews || 0;
  }

  // 2. Sales Trend SVG & Table
  renderSalesTrend(salesTrend || []);

  // 3. Order Status Breakdown
  renderOrderStatusBreakdown(orderStatus || { breakdown: [], total: 0 });

  // 4. Payment Method Analytics
  renderPaymentAnalytics(paymentAnalytics || { methods: [] });

  // 5. Top-Selling Products
  renderTopProducts(topProducts || []);

  // 6. Category Sales
  renderCategorySales(categorySales || []);

  // 7. Recent Orders
  renderAnalyticsRecentOrders(recentOrders || []);
}

function renderSalesTrend(trend) {
  if (!trendChartContainer) return;

  if (trend.length === 0) {
    trendChartContainer.innerHTML = `
      <div class="analytics-empty-state" style="padding: 40px 20px;">
        <span style="font-size: 1.5rem;">📊</span>
        <span>No sales trend data available for this period.</span>
      </div>
    `;
    if (trendTableTbody) {
      trendTableTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 16px; color: var(--color-text-muted);">No records found.</td></tr>`;
    }
    return;
  }

  // Calculate scaling for SVG
  const maxOrderVal = Math.max(...trend.map(t => t.orderValue || 0), 100);
  const chartHeight = 160;
  const paddingX = 40;
  const paddingY = 24;
  const barSlotWidth = Math.max(54, Math.min(84, 800 / trend.length));
  const chartWidth = Math.max(600, trend.length * barSlotWidth + paddingX * 2);

  // SVG bars and gridlines
  let barsSvg = '';
  let labelsSvg = '';
  const yTicks = [0, maxOrderVal * 0.5, maxOrderVal];

  // Gridlines
  let gridSvg = yTicks.map(val => {
    const y = chartHeight - (val / maxOrderVal) * (chartHeight - paddingY * 2) + paddingY;
    return `
      <line x1="${paddingX}" y1="${y}" x2="${chartWidth - paddingX}" y2="${y}" class="chart-axis-line" />
      <text x="${paddingX - 8}" y="${y + 3}" text-anchor="end" class="chart-axis-text">₹${Math.round(val).toLocaleString()}</text>
    `;
  }).join('');

  trend.forEach((item, index) => {
    const x = paddingX + index * barSlotWidth + (barSlotWidth / 2);
    const barW = Math.min(22, barSlotWidth * 0.4);

    // Height of order value bar
    const barH = (item.orderValue / maxOrderVal) * (chartHeight - paddingY * 2);
    const barY = chartHeight - barH;

    // Height of paid revenue bar
    const paidH = (item.paidRevenue / maxOrderVal) * (chartHeight - paddingY * 2);
    const paidY = chartHeight - paidH;

    barsSvg += `
      <g class="chart-bar-group">
        <title>${escapeHtml(item.formattedDate)}: Orders: ${item.orders}, Total: ${currencyFormatter.format(item.orderValue)}, Paid: ${currencyFormatter.format(item.paidRevenue)}</title>
        <!-- Background guide bar -->
        <rect x="${x - barW / 2}" y="${paddingY}" width="${barW}" height="${chartHeight - paddingY}" fill="transparent" />
        <!-- Order Value Bar -->
        <rect class="chart-bar chart-bar-value" x="${x - barW / 2}" y="${barY}" width="${barW}" height="${Math.max(2, barH)}" opacity="${item.orderValue > 0 ? '0.85' : '0.15'}" />
        ${item.paidRevenue > 0 ? `
          <!-- Paid Revenue Overlay Bar -->
          <rect class="chart-bar chart-bar-paid" x="${x - barW / 2 + 2}" y="${paidY}" width="${Math.max(4, barW - 4)}" height="${Math.max(2, paidH)}" />
        ` : ''}
        ${item.orders > 0 ? `
          <text x="${x}" y="${barY - 5}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--color-primary)">${item.orders}o</text>
        ` : ''}
      </g>
    `;

    labelsSvg += `
      <text x="${x}" y="${chartHeight + 16}" text-anchor="middle" class="chart-axis-text">${escapeHtml(item.formattedDate)}</text>
    `;
  });

  trendChartContainer.innerHTML = `
    <svg class="trend-svg-chart" viewBox="0 0 ${chartWidth} ${chartHeight + 28}" preserveAspectRatio="none">
      ${gridSvg}
      ${barsSvg}
      ${labelsSvg}
    </svg>
  `;

  // Render Daily Ledger Table
  if (trendTableTbody) {
    trendTableTbody.innerHTML = trend.map(item => `
      <tr>
        <td><strong>${escapeHtml(item.formattedDate)}</strong> <span style="font-size:0.75rem; color:var(--color-text-muted);">(${escapeHtml(item.date)})</span></td>
        <td><span class="stock-badge in-stock" style="font-size: 0.72rem;">${item.orders} order${item.orders === 1 ? '' : 's'}</span></td>
        <td class="font-bold">${currencyFormatter.format(item.orderValue)}</td>
        <td class="font-bold" style="color: var(--color-success);">${currencyFormatter.format(item.paidRevenue)}</td>
      </tr>
    `).join('');
  }
}

function renderOrderStatusBreakdown(orderStatus) {
  if (!statusBreakdownList) return;

  const breakdown = orderStatus.breakdown || [];
  const total = orderStatus.total || 0;

  if (breakdown.length === 0 || total === 0) {
    statusBreakdownList.innerHTML = `
      <div class="analytics-empty-state">
        <span>📦 No orders recorded in this period.</span>
      </div>
    `;
    return;
  }

  statusBreakdownList.innerHTML = breakdown.map(item => {
    const badgeClass = item.status === 'Delivered' ? 'in-stock'
      : item.status === 'Cancelled' ? 'out-of-stock'
      : item.status === 'Pending' ? 'low-stock'
      : 'in-stock';
    const fillClass = `fill-${item.status.toLowerCase()}`;

    return `
      <div class="status-breakdown-item">
        <div class="status-badge-col">
          <span class="stock-badge ${badgeClass}">${escapeHtml(item.status)}</span>
        </div>
        <div class="status-progress-wrap" title="${item.percentage}%">
          <div class="status-progress-fill ${fillClass}" style="width: ${Math.max(item.percentage, item.count > 0 ? 3 : 0)}%;"></div>
        </div>
        <div class="status-count-col">
          ${item.count} <span style="font-size:0.75rem; font-weight:500; color:var(--color-text-muted);">(${item.percentage}%)</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderPaymentAnalytics(paymentAnalytics) {
  if (!paymentAnalyticsList) return;

  const methods = paymentAnalytics.methods || [];
  if (methods.length === 0) {
    paymentAnalyticsList.innerHTML = `
      <div class="analytics-empty-state">
        <span>💳 No payment data recorded in this period.</span>
      </div>
    `;
    return;
  }

  paymentAnalyticsList.innerHTML = methods.map(m => {
    const icon = m.method === 'UPI' ? '⚡'
      : m.method === 'COD' ? '🚚'
      : m.method === 'NET_BANKING' ? '🏦'
      : '📦';

    return `
      <div class="payment-method-row">
        <div class="pm-header">
          <span class="pm-name-badge">
            <span>${icon}</span>
            <span>${escapeHtml(m.name)}</span>
          </span>
          <span class="pm-orders-count">${m.orders} order${m.orders === 1 ? '' : 's'}</span>
        </div>
        <div class="pm-metrics-grid">
          <div class="pm-metric-box">
            <span class="pm-metric-label">Total Value</span>
            <span class="pm-metric-val">${currencyFormatter.format(m.orderValue)}</span>
          </div>
          <div class="pm-metric-box">
            <span class="pm-metric-label">Paid (Settled)</span>
            <span class="pm-metric-val paid">${currencyFormatter.format(m.paidAmount)}</span>
          </div>
          <div class="pm-metric-box">
            <span class="pm-metric-label">Pending</span>
            <span class="pm-metric-val pending">${currencyFormatter.format(m.pendingAmount)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderTopProducts(products) {
  if (!topProductsList) return;

  if (products.length === 0) {
    topProductsList.innerHTML = `
      <div class="analytics-empty-state">
        <span style="font-size: 1.4rem;">🛍️</span>
        <span>No product sales recorded in this period.</span>
      </div>
    `;
    return;
  }

  topProductsList.innerHTML = `
    <div class="ranked-analytics-list">
      ${products.map((p, index) => {
        const rankClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
        return `
          <div class="ranked-analytics-item">
            <div class="ranked-item-left">
              <span class="rank-badge ${rankClass}">#${index + 1}</span>
              <span class="ranked-item-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
            </div>
            <div class="ranked-item-right">
              <span class="ranked-units">${p.unitsSold} sold</span>
              <span class="ranked-value">${currencyFormatter.format(p.salesValue)}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderCategorySales(categories) {
  if (!categorySalesList) return;

  if (categories.length === 0) {
    categorySalesList.innerHTML = `
      <div class="analytics-empty-state">
        <span style="font-size: 1.4rem;">🏷️</span>
        <span>No category sales recorded in this period.</span>
      </div>
    `;
    return;
  }

  categorySalesList.innerHTML = `
    <div class="ranked-analytics-list">
      ${categories.map((c, index) => {
        const rankClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
        return `
          <div class="ranked-analytics-item">
            <div class="ranked-item-left">
              <span class="rank-badge ${rankClass}">#${index + 1}</span>
              <span class="ranked-item-name">${escapeHtml(c.category)}</span>
            </div>
            <div class="ranked-item-right">
              <span class="ranked-units">${c.unitsSold} units</span>
              <span class="ranked-value">${currencyFormatter.format(c.salesValue)}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderAnalyticsRecentOrders(orders) {
  if (!analyticsRecentOrdersTbody) return;

  if (orders.length === 0) {
    analyticsRecentOrdersTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--color-text-muted);">No orders recorded in this period.</td></tr>`;
    return;
  }

  analyticsRecentOrdersTbody.innerHTML = orders.map(order => {
    const customerText = order.customerName ? `${escapeHtml(order.customerName)}${order.customerEmail ? ' (' + escapeHtml(order.customerEmail) + ')' : ''}` : 'Unknown';
    const formattedDate = new Date(order.date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const statusBadgeClass = order.orderStatus === 'Delivered' ? 'in-stock'
      : order.orderStatus === 'Cancelled' ? 'out-of-stock'
      : order.orderStatus === 'Pending' ? 'low-stock'
      : 'in-stock';

    return `
      <tr>
        <td class="font-bold">#${escapeHtml(String(order.orderId).substring(String(order.orderId).length - 6))}</td>
        <td>${customerText}</td>
        <td>${formattedDate}</td>
        <td>${order.itemsCount} item${order.itemsCount === 1 ? '' : 's'}</td>
        <td class="font-bold">${currencyFormatter.format(order.totalAmount)}</td>
        <td>
          ${order.paymentMethod ? `<span class="payment-method-pill pill-${escapeHtml(order.paymentMethod.toLowerCase())}">💳 ${escapeHtml(formatPaymentMethodName(order.paymentMethod))}</span>` : '<span style="color:var(--color-text-muted); font-size: 0.8rem;">—</span>'}
          <div style="margin-top: 4px;">
            <span class="payment-status-badge badge-${(order.paymentStatus || 'Pending').toLowerCase()}">${escapeHtml(order.paymentStatus || 'Pending')}</span>
          </div>
        </td>
        <td>
          <span class="stock-badge ${statusBadgeClass}">${escapeHtml(order.orderStatus)}</span>
        </td>
      </tr>
    `;
  }).join('');
}

// Event Listeners - Admin Modal Controls
if (navAdminBtn) navAdminBtn.addEventListener('click', openAdminModal);
if (adminCloseBtn) adminCloseBtn.addEventListener('click', closeAdminModal);
if (refreshAdminBtn) {
  refreshAdminBtn.addEventListener('click', () => {
    if (currentAdminTab === 'overview') fetchAdminStats();
    if (currentAdminTab === 'products') fetchAdminProducts();
    if (currentAdminTab === 'orders') fetchAdminOrders();
    if (currentAdminTab === 'reviews') fetchAdminReviews();
    if (currentAdminTab === 'analytics') fetchAdminAnalytics();
    showToast('Admin data refreshed.');
  });
}

if (adminTabOverview) adminTabOverview.addEventListener('click', () => setAdminTab('overview'));
if (adminTabProducts) adminTabProducts.addEventListener('click', () => setAdminTab('products'));
if (adminTabOrders) adminTabOrders.addEventListener('click', () => setAdminTab('orders'));
if (adminTabReviews) adminTabReviews.addEventListener('click', () => setAdminTab('reviews'));
if (adminTabAnalytics) adminTabAnalytics.addEventListener('click', () => setAdminTab('analytics'));

if (refreshAnalyticsBtn) refreshAnalyticsBtn.addEventListener('click', () => fetchAdminAnalytics());
if (retryAnalyticsBtn) retryAnalyticsBtn.addEventListener('click', () => fetchAdminAnalytics());

document.querySelectorAll('.analytics-range-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const range = btn.dataset.range;
    if (range) setAnalyticsRange(range);
  });
});

if (toggleTrendTableBtn && trendTableWrap) {
  toggleTrendTableBtn.addEventListener('click', () => {
    isTrendTableVisible = !isTrendTableVisible;
    trendTableWrap.style.display = isTrendTableVisible ? 'block' : 'none';
    toggleTrendTableBtn.innerHTML = isTrendTableVisible
      ? '<span>▲ Hide Daily Ledger</span>'
      : '<span>📋 View Daily Ledger</span>';
  });
}

if (openAddProductBtn) openAddProductBtn.addEventListener('click', () => openProductForm(null));
if (cancelProductFormBtn) cancelProductFormBtn.addEventListener('click', closeProductForm);
if (cancelProductBtn) cancelProductBtn.addEventListener('click', closeProductForm);
if (adminProductForm) adminProductForm.addEventListener('submit', handleProductFormSubmit);

if (adminModal) {
  adminModal.addEventListener('click', (e) => {
    if (e.target === adminModal) closeAdminModal();
  });
}

// ============================================================
// Hero Interactive Feature Popovers
// ============================================================

function initHeroInteractiveFeatures() {
  const interactiveElements = document.querySelectorAll('.interactive-feature');
  if (!interactiveElements.length) return;

  function closeAllHeroPopovers() {
    interactiveElements.forEach((el) => {
      el.classList.remove('is-active');
      el.setAttribute('aria-expanded', 'false');
    });
  }

  interactiveElements.forEach((element) => {
    // Click / Touch Toggle
    element.addEventListener('click', (e) => {
      // If user clicked close button inside popover
      if (e.target.closest('.popover-close-btn')) {
        e.stopPropagation();
        element.classList.remove('is-active');
        element.setAttribute('aria-expanded', 'false');
        return;
      }

      // If user clicked inside an already active popover (e.g. selecting text), don't close
      if (e.target.closest('.feature-popover')) {
        return;
      }

      const isCurrentlyActive = element.classList.contains('is-active');

      // Special handling for mobile trust buttons
      if (element.classList.contains('mobile-trust-item')) {
        const feature = element.getAttribute('data-feature');
        if (feature === 'rating') {
          showToast('⭐ We are the best rated E-commerce business with 100% satisfaction of our valuable customers!');
        } else if (feature === 'shipping') {
          showToast('🚚 Free express delivery on all orders over ₹499 across India!');
        } else if (feature === 'quality') {
          showToast('🛡️ 100% genuine products with 7-day hassle-free returns!');
        }
        return;
      }

      // Close all others first
      closeAllHeroPopovers();

      if (!isCurrentlyActive) {
        element.classList.add('is-active');
        element.setAttribute('aria-expanded', 'true');
      }
    });

    // Hover / Focus accessible state tracking
    element.addEventListener('mouseenter', () => {
      if (!element.classList.contains('is-active')) {
        element.setAttribute('aria-expanded', 'true');
      }
    });

    element.addEventListener('mouseleave', () => {
      if (!element.classList.contains('is-active')) {
        element.setAttribute('aria-expanded', 'false');
      }
    });

    // Keyboard support (Enter / Space)
    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        element.click();
      }
    });
  });

  // Global dismiss on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.interactive-feature')) {
      closeAllHeroPopovers();
    }
  });

  // Global dismiss on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllHeroPopovers();
    }
  });
}

// ============================================================
// Hero Background & Synchronized Information Slider (Every 2s)
// With Hover & Click Pause ("Reading Mode")
// ============================================================

function initHeroBackgroundSlider() {
  const bgSlides = document.querySelectorAll('.hero-slide');
  const infoSlides = document.querySelectorAll('.hero-info-slide');
  const dots = document.querySelectorAll('.hero-slider-dot');
  const counterEl = document.getElementById('hero-slider-counter');
  const heroPanel = document.getElementById('hero-interactive-panel');
  const heroBanner = document.getElementById('hero-banner');

  if (!bgSlides.length || bgSlides.length <= 1) return;

  const totalSlides = bgSlides.length;
  let currentIdx = 0;
  let slideTimer = null;
  let clickPauseTimeout = null;
  let isTransitioning = false;
  let isHovered = false;
  let isClickPaused = false;
  const SLIDE_INTERVAL_MS = 2000; // 2 seconds
  const CLICK_PAUSE_MS = 5000;    // Pause for 5 seconds when clicked

  function goToSlide(nextIdx, direction = 'next') {
    if (isTransitioning || nextIdx === currentIdx) return;
    isTransitioning = true;

    const currBg = bgSlides[currentIdx];
    const nextBg = bgSlides[nextIdx];
    const currInfo = infoSlides[currentIdx];
    const nextInfo = infoSlides[nextIdx];

    // Clean up all other slides
    for (let i = 0; i < totalSlides; i++) {
      if (i !== currentIdx && i !== nextIdx) {
        if (bgSlides[i]) {
          bgSlides[i].classList.remove('active', 'slide-out');
          bgSlides[i].style.transform = '';
        }
        if (infoSlides[i]) {
          infoSlides[i].classList.remove('active', 'slide-out');
          infoSlides[i].style.transform = '';
        }
      }
    }

    if (direction === 'next') {
      // 1. Current slides out to left
      if (currBg) {
        currBg.classList.remove('active');
        currBg.classList.add('slide-out');
      }
      if (currInfo) {
        currInfo.classList.remove('active');
        currInfo.classList.add('slide-out');
      }

      // 2. Next slides in from right to center
      if (nextBg) {
        nextBg.style.transform = 'translate3d(100%, 0, 0)';
        void nextBg.offsetWidth; // Force reflow
        nextBg.classList.remove('slide-out');
        nextBg.classList.add('active');
        nextBg.style.transform = '';
      }
      if (nextInfo) {
        nextInfo.style.transform = 'translate3d(100%, 0, 0)';
        void nextInfo.offsetWidth; // Force reflow
        nextInfo.classList.remove('slide-out');
        nextInfo.classList.add('active');
        nextInfo.style.transform = '';
      }
    } else {
      // Prev direction
      if (currBg) {
        currBg.classList.remove('active');
        currBg.style.transform = 'translate3d(100%, 0, 0)';
      }
      if (currInfo) {
        currInfo.classList.remove('active');
        currInfo.style.transform = 'translate3d(100%, 0, 0)';
      }

      if (nextBg) {
        nextBg.style.transform = 'translate3d(-100%, 0, 0)';
        void nextBg.offsetWidth;
        nextBg.classList.remove('slide-out');
        nextBg.classList.add('active');
        nextBg.style.transform = '';
      }
      if (nextInfo) {
        nextInfo.style.transform = 'translate3d(-100%, 0, 0)';
        void nextInfo.offsetWidth;
        nextInfo.classList.remove('slide-out');
        nextInfo.classList.add('active');
        nextInfo.style.transform = '';
      }
    }

    // Update dots & counter
    dots.forEach((dot, idx) => {
      const isActive = idx === nextIdx;
      dot.classList.toggle('active', isActive);
      dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (counterEl) {
      counterEl.textContent = `${nextIdx + 1} / ${totalSlides}`;
    }

    currentIdx = nextIdx;

    setTimeout(() => {
      if (currBg) {
        currBg.classList.remove('slide-out');
        currBg.style.transform = '';
      }
      if (currInfo) {
        currInfo.classList.remove('slide-out');
        currInfo.style.transform = '';
      }
      isTransitioning = false;
    }, 680);
  }

  function advanceSlide() {
    if (isHovered || isClickPaused) return;
    const nextIdx = (currentIdx + 1) % totalSlides;
    goToSlide(nextIdx, 'next');
  }

  function startAutoSlide() {
    stopAutoSlide();
    if (!isHovered && !isClickPaused) {
      slideTimer = setInterval(advanceSlide, SLIDE_INTERVAL_MS);
    }
  }

  function stopAutoSlide() {
    if (slideTimer) {
      clearInterval(slideTimer);
      slideTimer = null;
    }
  }

  function pauseForAWhile() {
    isClickPaused = true;
    stopAutoSlide();
    if (clickPauseTimeout) clearTimeout(clickPauseTimeout);
    clickPauseTimeout = setTimeout(() => {
      isClickPaused = false;
      if (!isHovered) {
        startAutoSlide();
      }
    }, CLICK_PAUSE_MS);
  }

  // Hover temporarily pauses rotation so users can comfortably read
  if (heroBanner) {
    heroBanner.addEventListener('mouseenter', () => {
      isHovered = true;
      stopAutoSlide();
    });

    heroBanner.addEventListener('mouseleave', () => {
      isHovered = false;
      if (!isClickPaused) {
        startAutoSlide();
      }
    });
  }

  // Click on the interactive panel pauses the slide for a while
  if (heroPanel) {
    heroPanel.addEventListener('click', (e) => {
      if (e.target.closest('.hero-slide-cta-btn')) return;
      pauseForAWhile();
    });
  }

  // Indicator dot clicks switch slide and pause for a while
  dots.forEach((dot) => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetIdx = parseInt(dot.getAttribute('data-index'), 10);
      if (!isNaN(targetIdx) && targetIdx !== currentIdx) {
        goToSlide(targetIdx, targetIdx > currentIdx ? 'next' : 'prev');
        pauseForAWhile();
      }
    });
  });

  // CTA button interactions (scroll & filter)
  document.querySelectorAll('.hero-slide-cta-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const category = btn.getAttribute('data-category') || 'all';
      if (categorySelect) {
        categorySelect.value = category;
        currentCategory = category;
      }
      if (category && category !== 'all') {
        const showcaseSection = document.querySelector(`.category-showcase-section[data-category="${category}"]`);
        if (showcaseSection) {
          showcaseSection.scrollIntoView({ behavior: 'smooth' });
          showToast(`Viewing ${category} showcase`);
          return;
        }
        window.location.href = `category.html?name=${encodeURIComponent(category)}`;
      } else {
        const catWrapper = document.getElementById('category-sections-wrapper');
        if (catWrapper) {
          catWrapper.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // Keyboard navigation when panel is focused
  if (heroPanel) {
    heroPanel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToSlide((currentIdx + 1) % totalSlides, 'next');
        pauseForAWhile();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToSlide((currentIdx - 1 + totalSlides) % totalSlides, 'prev');
        pauseForAWhile();
      }
    });
  }

  // Start initial auto slide
  startAutoSlide();

  // Handle tab visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoSlide();
    } else if (!isHovered) {
      startAutoSlide();
    }
  });
}

// ============================================================
// Footer Interactive Functionality Controller
// ============================================================

function initFooterFunctionality() {
  // Modals
  const orderTrackingModal = document.getElementById('order-tracking-modal');
  const shippingInfoModal = document.getElementById('shipping-info-modal');
  const returnsInfoModal = document.getElementById('returns-info-modal');
  const privacyPolicyModal = document.getElementById('privacy-policy-modal');
  const termsOfServiceModal = document.getElementById('terms-of-service-modal');
  const securityInfoModal = document.getElementById('security-info-modal');

  // Order Tracking Elements
  const trackingForm = document.getElementById('order-tracking-form');
  const trackingInput = document.getElementById('track-order-id-input');
  const trackingLoading = document.getElementById('track-order-loading');
  const trackingError = document.getElementById('track-order-error');
  const trackingUnauth = document.getElementById('track-order-unauth');
  const trackingResult = document.getElementById('track-order-result');
  const trackingUnauthLoginBtn = document.getElementById('track-order-unauth-login-btn');
  const trackingViewAllBtn = document.getElementById('track-view-all-orders-btn');

  function openFooterModal(modal) {
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeFooterModal(modal) {
    if (!modal) return;
    closeModalWithAnimation(modal);
  }

  // 1. SHOP CATEGORIES (Electronics & Audio, Watches & Wearables, Footwear & Apparel, Productivity & Tech)
  function mapFooterCategoryToExisting(label) {
    if (!categorySelect) return 'all';
    const available = Array.from(categorySelect.options)
      .map(o => o.value)
      .filter(v => v && v !== 'all');

    if (!available.length) return 'all';

    const normalized = (label || '').toLowerCase();

    // Direct match
    const directMatch = available.find(c => c.toLowerCase() === normalized);
    if (directMatch) return directMatch;

    // Electronics & Audio -> Electronics
    if (normalized.includes('electronic') || normalized.includes('audio')) {
      const match = available.find(c => /electronic|audio/i.test(c));
      if (match) return match;
    }

    // Watches & Wearables -> Accessories or Electronics
    if (normalized.includes('watch') || normalized.includes('wearable')) {
      const match = available.find(c => /watch|wearable/i.test(c))
        || available.find(c => /accessor/i.test(c))
        || available.find(c => /electronic/i.test(c));
      if (match) return match;
    }

    // Footwear & Apparel -> Sports or Accessories
    if (normalized.includes('footwear') || normalized.includes('apparel') || normalized.includes('cloth') || normalized.includes('shoe')) {
      const match = available.find(c => /footwear|apparel|cloth|fashion|shoe/i.test(c))
        || available.find(c => /sport/i.test(c))
        || available.find(c => /accessor/i.test(c));
      if (match) return match;
    }

    // Productivity & Tech -> Electronics or Home
    if (normalized.includes('productivity') || normalized.includes('tech')) {
      const match = available.find(c => /productivity|tech|office/i.test(c))
        || available.find(c => /electronic/i.test(c))
        || available.find(c => /home/i.test(c));
      if (match) return match;
    }

    return 'all';
  }

  document.querySelectorAll('.footer-category-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const rawCategory = link.getAttribute('data-category') || link.textContent.trim();
      const mappedCategory = mapFooterCategoryToExisting(rawCategory);

      if (categorySelect) {
        categorySelect.value = mappedCategory;
        currentCategory = mappedCategory;
      }

      if (mappedCategory && mappedCategory !== 'all') {
        const showcaseSection = document.querySelector(`.category-showcase-section[data-category="${mappedCategory}"]`);
        if (showcaseSection) {
          showcaseSection.scrollIntoView({ behavior: 'smooth' });
          showToast(`Viewing ${mappedCategory} showcase`);
          return;
        }
        window.location.href = `category.html?name=${encodeURIComponent(mappedCategory)}`;
      } else {
        const catWrapper = document.getElementById('category-sections-wrapper');
        if (catWrapper) {
          catWrapper.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // 2. ORDER TRACKING
  const footerOrderTrackingBtn = document.getElementById('footer-order-tracking-btn');
  if (footerOrderTrackingBtn) {
    footerOrderTrackingBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openFooterModal(orderTrackingModal);
      if (trackingInput) {
        trackingInput.value = '';
        setTimeout(() => trackingInput.focus(), 100);
      }
      if (trackingError) trackingError.style.display = 'none';
      if (trackingUnauth) trackingUnauth.style.display = 'none';
      if (trackingResult) trackingResult.style.display = 'none';
      if (trackingLoading) trackingLoading.style.display = 'none';
    });
  }

  // Tracking form submission
  if (trackingForm) {
    trackingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const orderId = (trackingInput ? trackingInput.value : '').trim();

      if (trackingError) trackingError.style.display = 'none';
      if (trackingUnauth) trackingUnauth.style.display = 'none';
      if (trackingResult) trackingResult.style.display = 'none';

      if (!orderId) {
        if (trackingError) {
          trackingError.textContent = 'Please enter an Order ID to track.';
          trackingError.style.display = 'block';
        }
        return;
      }

      // Check 24-character hexadecimal ObjectId format
      if (!/^[0-9a-fA-F]{24}$/.test(orderId)) {
        if (trackingError) {
          trackingError.textContent = 'Invalid Order ID format. Order IDs are 24-character codes (e.g., 65f1a2b3c4d5e6f7a8b9c0d1).';
          trackingError.style.display = 'block';
        }
        return;
      }

      const token = getAuthToken();
      if (!token) {
        if (trackingUnauth) trackingUnauth.style.display = 'block';
        return;
      }

      if (trackingLoading) trackingLoading.style.display = 'flex';

      try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const result = await response.json();
        if (trackingLoading) trackingLoading.style.display = 'none';

        if (!response.ok || !result.success || !result.data) {
          if (response.status === 404) {
            if (trackingError) {
              trackingError.textContent = `Order #${orderId} was not found. Please verify the ID and ensure you are logged into the account that placed the order.`;
              trackingError.style.display = 'block';
            }
          } else if (response.status === 401 || response.status === 403) {
            if (trackingUnauth) trackingUnauth.style.display = 'block';
          } else {
            if (trackingError) {
              trackingError.textContent = result.message || 'Unable to retrieve order tracking information.';
              trackingError.style.display = 'block';
            }
          }
          return;
        }

        renderTrackingResult(result.data);
      } catch (err) {
        console.error('Order tracking fetch error:', err);
        if (trackingLoading) trackingLoading.style.display = 'none';
        if (trackingError) {
          trackingError.textContent = 'Network error while querying order status. Please verify your connection.';
          trackingError.style.display = 'block';
        }
      }
    });
  }

  function renderTrackingResult(order) {
    if (!trackingResult) return;

    const idEl = document.getElementById('track-result-id');
    const dateEl = document.getElementById('track-result-date');
    const statusEl = document.getElementById('track-result-status');
    const paymentEl = document.getElementById('track-result-payment');
    const paymentStatusEl = document.getElementById('track-result-payment-status');
    const itemsEl = document.getElementById('track-result-items');
    const addressEl = document.getElementById('track-result-address');
    const totalEl = document.getElementById('track-result-total');

    if (idEl) idEl.textContent = `Order #${order._id}`;

    if (dateEl) {
      const orderDate = new Date(order.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      dateEl.textContent = `Placed on ${orderDate}`;
    }

    const currentStatus = (order.status || 'Pending').trim();
    if (statusEl) {
      statusEl.textContent = currentStatus;
      statusEl.className = 'status-badge in-stock';
    }

    if (paymentEl) {
      paymentEl.textContent = order.paymentMethod ? `💳 ${formatPaymentMethodName(order.paymentMethod)}` : '💳 Direct';
    }

    if (paymentStatusEl) {
      const pStatus = (order.paymentStatus || 'Pending').trim();
      paymentStatusEl.textContent = pStatus;
      paymentStatusEl.className = `payment-status-badge badge-${pStatus.toLowerCase()}`;
    }

    // Visual Stepper Stages
    const statusLower = currentStatus.toLowerCase();
    const stepPlaced = document.getElementById('step-placed');
    const stepProcessing = document.getElementById('step-processing');
    const stepShipped = document.getElementById('step-shipped');
    const stepDelivered = document.getElementById('step-delivered');
    const line1 = document.getElementById('line-1');
    const line2 = document.getElementById('line-2');
    const line3 = document.getElementById('line-3');

    [stepPlaced, stepProcessing, stepShipped, stepDelivered].forEach(s => {
      if (s) s.className = 'stepper-step';
    });
    [line1, line2, line3].forEach(l => {
      if (l) l.className = 'stepper-line';
    });

    if (statusLower === 'delivered') {
      if (stepPlaced) stepPlaced.classList.add('completed');
      if (line1) line1.classList.add('completed');
      if (stepProcessing) stepProcessing.classList.add('completed');
      if (line2) line2.classList.add('completed');
      if (stepShipped) stepShipped.classList.add('completed');
      if (line3) line3.classList.add('completed');
      if (stepDelivered) stepDelivered.classList.add('completed', 'current');
    } else if (statusLower === 'shipped') {
      if (stepPlaced) stepPlaced.classList.add('completed');
      if (line1) line1.classList.add('completed');
      if (stepProcessing) stepProcessing.classList.add('completed');
      if (line2) line2.classList.add('completed');
      if (stepShipped) stepShipped.classList.add('current');
    } else if (statusLower === 'processing') {
      if (stepPlaced) stepPlaced.classList.add('completed');
      if (line1) line1.classList.add('completed');
      if (stepProcessing) stepProcessing.classList.add('current');
    } else {
      if (stepPlaced) stepPlaced.classList.add('current');
    }

    // Items list
    if (itemsEl) {
      if (Array.isArray(order.items) && order.items.length) {
        itemsEl.innerHTML = order.items.map(it => `
          <div class="tracking-item-row">
            <span><strong>${escapeHtml(it.name)}</strong> × ${it.quantity}</span>
            <span>${currencyFormatter.format(it.subtotal || it.price * it.quantity)}</span>
          </div>
        `).join('');
      } else {
        itemsEl.innerHTML = '<div class="text-muted">1 Package Shipment</div>';
      }
    }

    // Shipping address
    if (addressEl) {
      if (order.shippingAddress) {
        const addr = order.shippingAddress;
        addressEl.innerHTML = `
          <strong>${escapeHtml(addr.fullName || '')}</strong> · 📞 ${escapeHtml(addr.phone || '')}<br>
          ${escapeHtml(addr.addressLine1 || '')}${addr.addressLine2 ? ', ' + escapeHtml(addr.addressLine2) : ''}<br>
          ${escapeHtml(addr.city || '')}, ${escapeHtml(addr.state || '')} - <strong>${escapeHtml(addr.postalCode || '')}</strong>
        `;
      } else {
        addressEl.innerHTML = '<span class="text-muted">Standard Courier Delivery Address</span>';
      }
    }

    if (totalEl) {
      totalEl.textContent = currencyFormatter.format(order.totalAmount || 0);
    }

    trackingResult.style.display = 'block';
  }

  // Tracking unauth login prompt
  if (trackingUnauthLoginBtn) {
    trackingUnauthLoginBtn.addEventListener('click', () => {
      closeFooterModal(orderTrackingModal);
      openAuthModal('login');
    });
  }

  // Tracking shortcut to all orders
  if (trackingViewAllBtn) {
    trackingViewAllBtn.addEventListener('click', () => {
      closeFooterModal(orderTrackingModal);
      openOrdersModal();
    });
  }

  // Tracking close button
  const orderTrackingCloseBtn = document.getElementById('order-tracking-close-btn');
  if (orderTrackingCloseBtn) {
    orderTrackingCloseBtn.addEventListener('click', () => closeFooterModal(orderTrackingModal));
  }

  // 3. SHIPPING & DELIVERY
  const footerShippingBtn = document.getElementById('footer-shipping-btn');
  const shippingCloseBtn = document.getElementById('shipping-modal-close-btn');
  const shippingOkBtn = document.getElementById('shipping-modal-ok-btn');

  if (footerShippingBtn) {
    footerShippingBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openFooterModal(shippingInfoModal);
    });
  }
  if (shippingCloseBtn) shippingCloseBtn.addEventListener('click', () => closeFooterModal(shippingInfoModal));
  if (shippingOkBtn) shippingOkBtn.addEventListener('click', () => closeFooterModal(shippingInfoModal));

  // 4. 7-DAY EASY RETURNS
  const footerReturnsBtn = document.getElementById('footer-returns-btn');
  const returnsCloseBtn = document.getElementById('returns-modal-close-btn');
  const returnsOkBtn = document.getElementById('returns-modal-ok-btn');

  if (footerReturnsBtn) {
    footerReturnsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openFooterModal(returnsInfoModal);
    });
  }
  if (returnsCloseBtn) returnsCloseBtn.addEventListener('click', () => closeFooterModal(returnsInfoModal));
  if (returnsOkBtn) returnsOkBtn.addEventListener('click', () => closeFooterModal(returnsInfoModal));

  // 5. VERIFIED CUSTOMER REVIEWS
  const footerReviewsBtn = document.getElementById('footer-reviews-btn');
  if (footerReviewsBtn) {
    footerReviewsBtn.addEventListener('click', (e) => {
      e.preventDefault();

      const targetWrapper = document.getElementById('category-sections-wrapper');
      if (targetWrapper) {
        targetWrapper.scrollIntoView({ behavior: 'smooth' });
      }

      // Check for product with reviews in memory
      const reviewedProduct = allProducts.find(p => (Array.isArray(p.reviews) && p.reviews.length > 0) || p.numReviews > 0);

      if (reviewedProduct) {
        openProductModal(reviewedProduct._id);
        setTimeout(() => {
          const reviewsSection = document.getElementById('modal-reviews-section');
          if (reviewsSection) {
            reviewsSection.scrollIntoView({ behavior: 'smooth' });
          }
        }, 320);
        showToast(`Viewing verified customer reviews for: ${reviewedProduct.name}`);
      } else {
        showToast('Explore verified customer ratings and reviews on any product card below!');
      }
    });
  }

  // 7. PRIVACY POLICY
  const footerPrivacyBtn = document.getElementById('footer-privacy-btn');
  const privacyCloseBtn = document.getElementById('privacy-modal-close-btn');
  const privacyOkBtn = document.getElementById('privacy-modal-ok-btn');

  if (footerPrivacyBtn) {
    footerPrivacyBtn.addEventListener('click', () => openFooterModal(privacyPolicyModal));
  }
  if (privacyCloseBtn) privacyCloseBtn.addEventListener('click', () => closeFooterModal(privacyPolicyModal));
  if (privacyOkBtn) privacyOkBtn.addEventListener('click', () => closeFooterModal(privacyPolicyModal));

  // 8. TERMS OF SERVICE
  const footerTermsBtn = document.getElementById('footer-terms-btn');
  const termsCloseBtn = document.getElementById('terms-modal-close-btn');
  const termsOkBtn = document.getElementById('terms-modal-ok-btn');

  if (footerTermsBtn) {
    footerTermsBtn.addEventListener('click', () => openFooterModal(termsOfServiceModal));
  }
  if (termsCloseBtn) termsCloseBtn.addEventListener('click', () => closeFooterModal(termsOfServiceModal));
  if (termsOkBtn) termsOkBtn.addEventListener('click', () => closeFooterModal(termsOfServiceModal));

  // 9. SECURITY VERIFIED
  const footerSecurityBtn = document.getElementById('footer-security-btn');
  const securityCloseBtn = document.getElementById('security-modal-close-btn');
  const securityOkBtn = document.getElementById('security-modal-ok-btn');

  if (footerSecurityBtn) {
    footerSecurityBtn.addEventListener('click', () => openFooterModal(securityInfoModal));
  }
  if (securityCloseBtn) securityCloseBtn.addEventListener('click', () => closeFooterModal(securityInfoModal));
  if (securityOkBtn) securityOkBtn.addEventListener('click', () => closeFooterModal(securityInfoModal));

  // 10. Backdrop click dismiss for all footer modals
  const allFooterModals = [
    orderTrackingModal,
    shippingInfoModal,
    returnsInfoModal,
    privacyPolicyModal,
    termsOfServiceModal,
    securityInfoModal
  ];

  allFooterModals.forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeFooterModal(modal);
        }
      });
    }
  });
}


