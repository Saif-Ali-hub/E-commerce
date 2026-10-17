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
const receiptCouponRow = document.getElementById('receipt-coupon-row');
const successCouponInfo = document.getElementById('success-coupon-info');
const receiptTrackingRow = document.getElementById('receipt-tracking-row');
const successTrackingId = document.getElementById('success-tracking-id');

// DOM Elements - Promo / Coupon in Cart
const cartPromoSection = document.getElementById('cart-promo-section');
const cartPromoInputGroup = document.getElementById('cart-promo-input-group');
const cartCouponInput = document.getElementById('cart-coupon-input');
const cartCouponApplyBtn = document.getElementById('cart-coupon-apply-btn');
const cartCouponFeedback = document.getElementById('cart-coupon-feedback');
const cartAvailableCouponsWrap = document.getElementById('cart-available-coupons-wrap');
const cartAvailableCouponsChips = document.getElementById('cart-available-coupons-chips');
const cartAppliedCouponCard = document.getElementById('cart-applied-coupon-card');
const cartAppliedCouponCode = document.getElementById('cart-applied-coupon-code');
const cartAppliedCouponSaving = document.getElementById('cart-applied-coupon-saving');
const cartRemoveCouponBtn = document.getElementById('cart-remove-coupon-btn');
const cartSubtotalAmount = document.getElementById('cart-subtotal-amount');
const cartDiscountRow = document.getElementById('cart-discount-row');
const cartDiscountCodeBadge = document.getElementById('cart-discount-code-badge');
const cartDiscountAmount = document.getElementById('cart-discount-amount');

// DOM Elements - Promo / Coupon in Checkout
const checkoutPromoBox = document.getElementById('checkout-promo-box');
const checkoutPromoInputGroup = document.getElementById('checkout-promo-input-group');
const checkoutCouponInput = document.getElementById('checkout-coupon-input');
const checkoutCouponApplyBtn = document.getElementById('checkout-coupon-apply-btn');
const checkoutCouponFeedback = document.getElementById('checkout-coupon-feedback');
const checkoutAppliedCouponCard = document.getElementById('checkout-applied-coupon-card');
const checkoutAppliedCouponCode = document.getElementById('checkout-applied-coupon-code');
const checkoutAppliedCouponSaving = document.getElementById('checkout-applied-coupon-saving');
const checkoutRemoveCouponBtn = document.getElementById('checkout-remove-coupon-btn');
const checkoutSubtotalAmount = document.getElementById('checkout-subtotal-amount');
const checkoutDiscountRow = document.getElementById('checkout-discount-row');
const checkoutDiscountCodeBadge = document.getElementById('checkout-discount-code-badge');
const checkoutDiscountAmount = document.getElementById('checkout-discount-amount');

// DOM Elements - MiniStore Wallet & Loyalty Rewards (Feature 5)
const navWalletBtn = document.getElementById('nav-wallet-btn');
const navWalletBalanceText = document.getElementById('nav-wallet-balance-text');
const navWalletCoinsBadge = document.getElementById('nav-wallet-coins-badge');
const navWalletCoinsText = document.getElementById('nav-wallet-coins-text');
const navWalletDropdownBtn = document.getElementById('nav-wallet-dropdown-btn');
const dropdownWalletBalanceText = document.getElementById('dropdown-wallet-balance-text');
const dropdownCoinsText = document.getElementById('dropdown-coins-text');
const walletModal = document.getElementById('wallet-modal');
const walletCloseBtn = document.getElementById('wallet-close-btn');
const walletUnauthState = document.getElementById('wallet-unauth-state');
const walletLoginPromptBtn = document.getElementById('wallet-login-prompt-btn');
const walletContent = document.getElementById('wallet-content');
const walletModalBalanceDisplay = document.getElementById('wallet-modal-balance-display');
const walletModalCoinsDisplay = document.getElementById('wallet-modal-coins-display');
const walletCoinsWorthText = document.getElementById('wallet-coins-worth-text');
const walletTopupInput = document.getElementById('wallet-topup-input');
const walletTopupSubmitBtn = document.getElementById('wallet-topup-submit-btn');
const walletTopupAlert = document.getElementById('wallet-topup-alert');
const walletCoinsSelect = document.getElementById('wallet-coins-select');
const walletRedeemSubmitBtn = document.getElementById('wallet-redeem-submit-btn');
const walletRedeemAlert = document.getElementById('wallet-redeem-alert');
const walletTransactionsList = document.getElementById('wallet-transactions-list');
const walletTxnCountBadge = document.getElementById('wallet-txn-count-badge');

// DOM Elements - Checkout Wallet Redemption (Feature 5)
const checkoutWalletBox = document.getElementById('checkout-wallet-box');
const checkoutWalletCheckbox = document.getElementById('checkout-wallet-checkbox');
const checkoutWalletAvailableText = document.getElementById('checkout-wallet-available-text');
const checkoutWalletDeductionBadge = document.getElementById('checkout-wallet-deduction-badge');
const checkoutCoinsRewardText = document.getElementById('checkout-coins-reward-text');
const checkoutWalletDiscountRow = document.getElementById('checkout-wallet-discount-row');
const checkoutWalletDiscountAmount = document.getElementById('checkout-wallet-discount-amount');
const receiptWalletRow = document.getElementById('receipt-wallet-row');
const successWalletDeduction = document.getElementById('success-wallet-deduction');
const receiptCoinsRow = document.getElementById('receipt-coins-row');
const successCoinsEarned = document.getElementById('success-coins-earned');

let userWallet = { walletBalance: 150, coins: 50, transactions: [] };
let useCheckoutWallet = true;

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

// DOM Elements - Forgot & Reset Password
const authTabs = document.querySelector('.auth-tabs');
const forgotPasswordTriggerBtn = document.getElementById('forgot-password-trigger-btn');
const forgotPasswordView = document.getElementById('forgot-password-view');
const forgotPasswordStep1Form = document.getElementById('forgot-password-step1-form');
const forgotPasswordStep2Form = document.getElementById('forgot-password-step2-form');
const forgotEmailInput = document.getElementById('forgot-email');
const forgotEmailSentDisplay = document.getElementById('forgot-email-sent-display');
const sendOtpBtn = document.getElementById('send-otp-btn');
const resetOtpInput = document.getElementById('reset-otp-input');
const resetNewPassword = document.getElementById('reset-new-password');
const resetConfirmPassword = document.getElementById('reset-confirm-password');
const submitResetPasswordBtn = document.getElementById('submit-reset-password-btn');
const backToLoginBtn = document.getElementById('back-to-login-btn');

// DOM Elements - Seller Registration
const regIsSeller = document.getElementById('reg-is-seller');
const sellerFieldsWrap = document.getElementById('seller-fields-wrap');
const regSellerPhone = document.getElementById('reg-seller-phone');
const regBusinessName = document.getElementById('reg-business-name');
const regBusinessAddress = document.getElementById('reg-business-address');
const regBusinessPan = document.getElementById('reg-business-pan');
const regBusinessGstin = document.getElementById('reg-business-gstin');
const regSubmitBtn = document.getElementById('reg-submit-btn');

// DOM Elements - Admin & Merchant Dashboard
const navAdminBtn = document.getElementById('nav-admin-btn');
const navSellerBtn = document.getElementById('nav-seller-btn');
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

// Admin Users Tab & Elements
const adminTabUsers = document.getElementById('admin-tab-users');
const adminUsersSection = document.getElementById('admin-users-section');
const adminUsersTbody = document.getElementById('admin-users-tbody');
const adminUsersSearch = document.getElementById('admin-users-search');
const userRoleFilterPills = document.getElementById('user-role-filter-pills');
const refreshUsersBtn = document.getElementById('refresh-users-btn');
const usersPrevPageBtn = document.getElementById('users-prev-page-btn');
const usersNextPageBtn = document.getElementById('users-next-page-btn');
const adminUsersCountText = document.getElementById('admin-users-count-text');
const cardOverviewUsers = document.getElementById('card-overview-users');

// Become Seller Modal Elements
const becomeSellerModal = document.getElementById('become-seller-modal');
const becomeSellerCloseBtn = document.getElementById('become-seller-close-btn');
const becomeSellerCancelBtn = document.getElementById('become-seller-cancel-btn');
const becomeSellerForm = document.getElementById('become-seller-form');
const becomeSellerAlert = document.getElementById('become-seller-alert');
const btnOpenBecomeSeller = document.getElementById('btn-open-become-seller');
const footerBecomeSellerBtn = document.getElementById('footer-become-seller-btn');
const sellerAppBusinessName = document.getElementById('seller-app-business-name');
const sellerAppBusinessAddress = document.getElementById('seller-app-business-address');
const sellerAppContact = document.getElementById('seller-app-contact');
const sellerAppPan = document.getElementById('seller-app-pan');
const sellerAppGstin = document.getElementById('seller-app-gstin');
const sellerAppSubmitBtn = document.getElementById('seller-app-submit-btn');

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

// Admin Sellers & Merchant Verification Elements
const statPendingSellers = document.getElementById('stat-pending-sellers');
const cardPendingMerchants = document.getElementById('card-pending-merchants');
const cardOverviewProducts = document.getElementById('card-overview-products');
const cardOverviewOrders = document.getElementById('card-overview-orders');
const cardOverviewPendingOrders = document.getElementById('card-overview-pending-orders');
const cardOverviewReviews = document.getElementById('card-overview-reviews');
const adminPendingOrdersCount = document.getElementById('admin-pending-orders-count');
const adminTabSellers = document.getElementById('admin-tab-sellers');
const adminPendingSellersCount = document.getElementById('admin-pending-sellers-count');
const adminSellersSection = document.getElementById('admin-sellers-section');
const adminSellersTbody = document.getElementById('admin-sellers-tbody');
const refreshSellersBtn = document.getElementById('refresh-sellers-btn');
const adminSellersTotalNum = document.getElementById('admin-sellers-total-num');
const adminSellersPendingNum = document.getElementById('admin-sellers-pending-num');
const adminSellersVerifiedNum = document.getElementById('admin-sellers-verified-num');
const adminSellersRejectedNum = document.getElementById('admin-sellers-rejected-num');

let allAdminSellers = [];
let currentSellerFilter = 'all';

// Admin Sales & Campaigns Elements
const adminTabSales = document.getElementById('admin-tab-sales');
const adminSalesSection = document.getElementById('admin-sales-section');
const overviewSaleDot = document.getElementById('overview-sale-dot');
const overviewSaleStatusBadge = document.getElementById('overview-sale-status-badge');
const overviewSaleTitle = document.getElementById('overview-sale-title');
const overviewSaleSubtitle = document.getElementById('overview-sale-subtitle');
const overviewSaleTimer = document.getElementById('overview-sale-timer');
const overviewManageSaleBtn = document.getElementById('overview-manage-sale-btn');

const adminSaleBadge = document.getElementById('admin-sale-badge');
const adminSalePulse = document.getElementById('admin-sale-pulse');
const adminSaleBadgeText = document.getElementById('admin-sale-badge-text');
const adminSaleTypePill = document.getElementById('admin-sale-type-pill');
const adminSaleEndDisplay = document.getElementById('admin-sale-end-display');
const adminSaleName = document.getElementById('admin-sale-name');
const adminSaleTagline = document.getElementById('admin-sale-tagline');
const adminSaleDesc = document.getElementById('admin-sale-desc');

const btnExtendSale24h = document.getElementById('btn-extend-sale-24h');
const btnExtendSale48h = document.getElementById('btn-extend-sale-48h');
const btnExtendSale7d = document.getElementById('btn-extend-sale-7d');
const btnEndSaleNow = document.getElementById('btn-end-sale-now');
const btnResumeSaleNow = document.getElementById('btn-resume-sale-now');
const refreshSalesBtn = document.getElementById('refresh-sales-btn');

const adminSaleForm = document.getElementById('admin-sale-form');
const saleInputName = document.getElementById('sale-input-name');
const saleInputBadge = document.getElementById('sale-input-badge');
const saleInputTagline = document.getElementById('sale-input-tagline');
const saleInputEndDate = document.getElementById('sale-input-end-date');
const saleInputCoupon = document.getElementById('sale-input-coupon');
const saleInputDesc = document.getElementById('sale-input-desc');

const adminDealsCount = document.getElementById('admin-deals-count');
const adminDealsChipList = document.getElementById('admin-deals-chip-list');
const adminSalesHistory = document.getElementById('admin-sales-history');

// Admin Coupon Management Elements
const adminTabCoupons = document.getElementById('admin-tab-coupons');
const adminCouponsSection = document.getElementById('admin-coupons-section');
const adminNewCouponBtn = document.getElementById('admin-new-coupon-btn');
const refreshCouponsBtn = document.getElementById('refresh-coupons-btn');
const adminCouponCreator = document.getElementById('admin-coupon-creator');
const closeCouponCreatorBtn = document.getElementById('close-coupon-creator-btn');
const cancelCreateCouponBtn = document.getElementById('cancel-create-coupon-btn');
const adminCreateCouponForm = document.getElementById('admin-create-coupon-form');
const adminCouponsTbody = document.getElementById('admin-coupons-tbody');
const newCouponCodeInput = document.getElementById('new-coupon-code');
const newCouponTypeInput = document.getElementById('new-coupon-type');
const newCouponValueInput = document.getElementById('new-coupon-value');
const newCouponMinOrderInput = document.getElementById('new-coupon-min-order');
const newCouponMaxDiscountInput = document.getElementById('new-coupon-max-discount');
const newCouponUsageLimitInput = document.getElementById('new-coupon-usage-limit');
const newCouponExpiryInput = document.getElementById('new-coupon-expiry');
const newCouponDescInput = document.getElementById('new-coupon-desc');

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
    if (navWalletBtn) navWalletBtn.style.display = 'inline-flex';
    if (navAdminBtn) {
      navAdminBtn.style.display = user.role === 'admin' ? 'inline-flex' : 'none';
    }
    if (navSellerBtn) {
      const isSeller = user.role === 'seller';
      const isAdmin = user.role === 'admin';
      const isPending = user.sellerDetails && user.sellerDetails.verificationStatus === 'pending';
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

    const profileBecomeSellerCard = document.getElementById('profile-become-seller-card');
    const profileSellerCard = document.getElementById('profile-seller-card');
    if (profileBecomeSellerCard) {
      profileBecomeSellerCard.style.display = user.role === 'customer' ? 'flex' : 'none';
    }
    if (profileSellerCard) {
      profileSellerCard.style.display = user.role === 'seller' ? 'block' : 'none';
    }

    fetchUserWallet();

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

    // Deep link directly into admin panel if navigated via #admin
    if (window.location.hash === '#admin' && user.role === 'admin') {
      setTimeout(() => {
        openAdminModal();
      }, 150);
    }
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
    if (navWalletBtn) navWalletBtn.style.display = 'none';
    if (navAdminBtn) navAdminBtn.style.display = 'none';
    if (navSellerBtn) navSellerBtn.style.display = 'none';
    if (adminModal) adminModal.style.display = 'none';
    if (addressModal) addressModal.style.display = 'none';
    if (walletModal) walletModal.style.display = 'none';
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

  if (authTabs) authTabs.style.display = 'flex';
  if (forgotPasswordView) forgotPasswordView.style.display = 'none';

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
    if (authTabs) authTabs.style.display = 'flex';
    if (forgotPasswordView) forgotPasswordView.style.display = 'none';
    if (forgotPasswordStep1Form) {
      forgotPasswordStep1Form.reset();
      forgotPasswordStep1Form.style.display = 'block';
    }
    if (forgotPasswordStep2Form) {
      forgotPasswordStep2Form.reset();
      forgotPasswordStep2Form.style.display = 'none';
    }
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
    if (Array.isArray(allProducts) && allProducts.length > 0) {
      renderCategorySections(allProducts, []);
    }
  }
}

function renderCategorySections(products, categoriesList) {
  if (!categorySectionsContainer) return;

  if (categoryShowcaseLoading) {
    categoryShowcaseLoading.style.display = 'none';
  }

  const rawCategories = (Array.isArray(categoriesList) && categoriesList.length > 0)
    ? categoriesList
    : (Array.isArray(products) ? products.map(p => p.category) : []);
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
            <span class="category-showcase-subtitle">${catProducts.length} ${catProducts.length === 1 ? 'item' : 'items'} available</span>
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

        <!-- Pincode Delivery Estimator Widget (Feature 4) -->
        <div class="pincode-estimator-widget" id="modal-pincode-widget">
          <div class="pincode-widget-header">
            <span class="pincode-widget-title">🚚 Delivery &amp; Service Availability</span>
            <span class="pincode-hub-tag">Fast Hub Dispatch</span>
          </div>
          <div class="pincode-input-wrap">
            <input
              type="text"
              id="modal-pincode-input"
              class="pincode-input"
              placeholder="Enter 6-digit Pincode (e.g. 110001)"
              maxlength="6"
              inputmode="numeric"
            />
            <button type="button" id="modal-pincode-check-btn" class="btn btn-secondary btn-sm pincode-check-btn">
              Check
            </button>
          </div>
          <div id="modal-pincode-result" class="pincode-result-box" style="display: none;"></div>
          <div class="pincode-perks-list">
            <div class="pincode-perk-item">
              <span class="perk-icon">⚡</span>
              <span>Fast Courier Dispatch (Dispatched within 24 Hours)</span>
            </div>
            <div class="pincode-perk-item">
              <span class="perk-icon">💵</span>
              <span>Cash / UPI on Delivery Available</span>
            </div>
            <div class="pincode-perk-item">
              <span class="perk-icon">🔄</span>
              <span>7 Days Replacement &amp; Return Policy</span>
            </div>
          </div>
        </div>

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

  // Setup Pincode Delivery Estimator (Feature 4)
  setupModalPincodeEstimator(modalContent);

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

  await Promise.all([fetchCart(), fetchAvailableCoupons()]);

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

// ============================================================
// Promo Code & Coupon System (Cart & Checkout)
// ============================================================
let appliedCoupon = null;
let availableCouponsList = [];

async function fetchAvailableCoupons() {
  try {
    const res = await fetch(`${API_BASE_URL}/coupons/active`);
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.data)) {
      availableCouponsList = data.data;
    }
  } catch (err) {
    console.error('Failed to load active coupons:', err.message);
  }
}

function renderAvailableCoupons(currentSubtotal = 0) {
  if (!cartAvailableCouponsChips) return;
  cartAvailableCouponsChips.innerHTML = '';

  if (!availableCouponsList || availableCouponsList.length === 0) {
    if (cartAvailableCouponsWrap) cartAvailableCouponsWrap.style.display = 'none';
    return;
  }

  if (cartAvailableCouponsWrap) cartAvailableCouponsWrap.style.display = 'block';

  availableCouponsList.forEach(coupon => {
    const chip = document.createElement('div');
    chip.className = 'coupon-chip';
    chip.title = coupon.description || `Click to apply ${coupon.code}`;

    const discountText = coupon.discountType === 'PERCENTAGE'
      ? `${coupon.discountValue}% OFF`
      : `₹${coupon.discountValue} OFF`;

    chip.innerHTML = `
      <span class="chip-code">🏷️ ${coupon.code}</span>
      <span class="chip-desc">${discountText}</span>
      <span class="chip-action">+ Apply</span>
    `;

    chip.addEventListener('click', () => {
      applyCouponCode(coupon.code, 'cart');
    });

    cartAvailableCouponsChips.appendChild(chip);
  });
}

function updateCouponTotals(calculatedSubtotal = 0) {
  if (cartSubtotalAmount) {
    cartSubtotalAmount.textContent = currencyFormatter.format(calculatedSubtotal);
  }
  if (checkoutSubtotalAmount) {
    checkoutSubtotalAmount.textContent = currencyFormatter.format(calculatedSubtotal);
  }

  if (appliedCoupon) {
    // Check if subtotal still meets minimum order requirement
    const minOrder = appliedCoupon.minOrderAmount || 0;
    if (calculatedSubtotal < minOrder) {
      const needed = Math.round(minOrder - calculatedSubtotal);
      const msg = `Add ₹${needed} more to your cart to retain coupon "${appliedCoupon.code}" (Min. order ₹${minOrder}).`;

      // Update Cart UI
      if (cartDiscountRow) cartDiscountRow.style.display = 'none';
      if (cartTotalAmount) cartTotalAmount.textContent = currencyFormatter.format(calculatedSubtotal);
      if (cartAppliedCouponCard) cartAppliedCouponCard.style.display = 'none';
      if (cartPromoInputGroup) cartPromoInputGroup.style.display = 'flex';
      if (cartCouponFeedback) {
        cartCouponFeedback.className = 'promo-feedback error';
        cartCouponFeedback.textContent = msg;
        cartCouponFeedback.style.display = 'block';
      }

      // Update Checkout UI
      if (checkoutDiscountRow) checkoutDiscountRow.style.display = 'none';
      if (checkoutTotalAmount) checkoutTotalAmount.textContent = currencyFormatter.format(calculatedSubtotal);
      if (checkoutAppliedCouponCard) checkoutAppliedCouponCard.style.display = 'none';
      if (checkoutPromoInputGroup) checkoutPromoInputGroup.style.display = 'flex';
      if (checkoutCouponFeedback) {
        checkoutCouponFeedback.className = 'promo-feedback error';
        checkoutCouponFeedback.textContent = msg;
        checkoutCouponFeedback.style.display = 'block';
      }
      return;
    }

    // Recalculate discount based on current subtotal
    let discount = 0;
    if (appliedCoupon.discountType === 'PERCENTAGE') {
      discount = Math.round((calculatedSubtotal * appliedCoupon.discountValue) / 100);
      if (appliedCoupon.maxDiscountAmount && discount > appliedCoupon.maxDiscountAmount) {
        discount = appliedCoupon.maxDiscountAmount;
      }
    } else {
      discount = Math.min(appliedCoupon.discountValue, calculatedSubtotal);
    }

    appliedCoupon.discountAmount = discount;
    appliedCoupon.finalTotal = Math.max(0, calculatedSubtotal - discount);

    // Sync Cart UI
    if (cartDiscountRow) cartDiscountRow.style.display = 'flex';
    if (cartDiscountCodeBadge) cartDiscountCodeBadge.textContent = appliedCoupon.code;
    if (cartDiscountAmount) cartDiscountAmount.textContent = `-${currencyFormatter.format(discount)}`;
    if (cartTotalAmount) cartTotalAmount.textContent = currencyFormatter.format(appliedCoupon.finalTotal);
    if (cartAppliedCouponCard) cartAppliedCouponCard.style.display = 'flex';
    if (cartAppliedCouponCode) cartAppliedCouponCode.textContent = appliedCoupon.code;
    if (cartAppliedCouponSaving) cartAppliedCouponSaving.textContent = `${currencyFormatter.format(discount)} OFF applied`;
    if (cartPromoInputGroup) cartPromoInputGroup.style.display = 'none';
    if (cartCouponFeedback) cartCouponFeedback.style.display = 'none';

    // Sync Checkout UI
    if (checkoutDiscountRow) checkoutDiscountRow.style.display = 'flex';
    if (checkoutDiscountCodeBadge) checkoutDiscountCodeBadge.textContent = appliedCoupon.code;
    if (checkoutDiscountAmount) checkoutDiscountAmount.textContent = `-${currencyFormatter.format(discount)}`;
    if (checkoutTotalAmount) checkoutTotalAmount.textContent = currencyFormatter.format(appliedCoupon.finalTotal);
    if (checkoutAppliedCouponCard) checkoutAppliedCouponCard.style.display = 'flex';
    if (checkoutAppliedCouponCode) checkoutAppliedCouponCode.textContent = appliedCoupon.code;
    if (checkoutAppliedCouponSaving) checkoutAppliedCouponSaving.textContent = `${currencyFormatter.format(discount)} OFF applied`;
    if (checkoutPromoInputGroup) checkoutPromoInputGroup.style.display = 'none';
    if (checkoutCouponFeedback) checkoutCouponFeedback.style.display = 'none';
  } else {
    // No coupon active
    if (cartDiscountRow) cartDiscountRow.style.display = 'none';
    if (cartTotalAmount) cartTotalAmount.textContent = currencyFormatter.format(calculatedSubtotal);
    if (cartAppliedCouponCard) cartAppliedCouponCard.style.display = 'none';
    if (cartPromoInputGroup) cartPromoInputGroup.style.display = 'flex';

    if (checkoutDiscountRow) checkoutDiscountRow.style.display = 'none';
    if (checkoutTotalAmount) checkoutTotalAmount.textContent = currencyFormatter.format(calculatedSubtotal);
    if (checkoutAppliedCouponCard) checkoutAppliedCouponCard.style.display = 'none';
    if (checkoutPromoInputGroup) checkoutPromoInputGroup.style.display = 'flex';
  }

  // Feature 5: Sync checkout wallet deduction & cashback preview
  updateCheckoutWalletCalculation(calculatedSubtotal, appliedCoupon ? appliedCoupon.discountAmount : 0);
}

async function applyCouponCode(code, source = 'cart') {
  const token = getAuthToken();
  if (!token) {
    openAuthModal('login', 'Please log in to apply promo coupons.');
    return;
  }

  const cleanCode = (code || '').trim().toUpperCase();
  const feedbackEl = source === 'cart' ? cartCouponFeedback : checkoutCouponFeedback;

  if (!cleanCode) {
    if (feedbackEl) {
      feedbackEl.className = 'promo-feedback error';
      feedbackEl.textContent = 'Please enter a coupon code.';
      feedbackEl.style.display = 'block';
    }
    return;
  }

  // Calculate current cart subtotal
  let subtotal = 0;
  if (currentCart && Array.isArray(currentCart.items)) {
    subtotal = currentCart.items.reduce((sum, item) => {
      const prod = item.product;
      if (!prod) return sum;
      const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (item.price !== undefined ? item.price : (prod.price || 0));
      return sum + (unitPrice * item.quantity);
    }, 0);
  }

  const applyBtn = source === 'cart' ? cartCouponApplyBtn : checkoutCouponApplyBtn;

  if (applyBtn) {
    applyBtn.disabled = true;
    applyBtn.textContent = 'Verifying...';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/coupons/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ code: cleanCode, subtotal })
    });

    const result = await res.json();

    if (res.ok && result.success && result.valid) {
      appliedCoupon = result.data;
      if (cartCouponInput) cartCouponInput.value = '';
      if (checkoutCouponInput) checkoutCouponInput.value = '';

      if (feedbackEl) {
        feedbackEl.className = 'promo-feedback success';
        feedbackEl.textContent = result.message;
        feedbackEl.style.display = 'block';
      }

      showToast(`🎉 ${result.message}`);
      updateCouponTotals(subtotal);
    } else {
      if (feedbackEl) {
        feedbackEl.className = 'promo-feedback error';
        feedbackEl.textContent = result.message || 'Invalid coupon code.';
        feedbackEl.style.display = 'block';
      }
      showToast(result.message || 'Coupon could not be applied');
    }
  } catch (err) {
    if (feedbackEl) {
      feedbackEl.className = 'promo-feedback error';
      feedbackEl.textContent = 'Network error verifying coupon code.';
      feedbackEl.style.display = 'block';
    }
  } finally {
    if (applyBtn) {
      applyBtn.disabled = false;
      applyBtn.textContent = 'Apply';
    }
  }
}

function removeAppliedCoupon() {
  appliedCoupon = null;

  if (cartCouponFeedback) {
    cartCouponFeedback.style.display = 'none';
    cartCouponFeedback.textContent = '';
  }
  if (checkoutCouponFeedback) {
    checkoutCouponFeedback.style.display = 'none';
    checkoutCouponFeedback.textContent = '';
  }

  let subtotal = 0;
  if (currentCart && Array.isArray(currentCart.items)) {
    subtotal = currentCart.items.reduce((sum, item) => {
      const prod = item.product;
      if (!prod) return sum;
      const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (item.price !== undefined ? item.price : (prod.price || 0));
      return sum + (unitPrice * item.quantity);
    }, 0);
  }

  updateCouponTotals(subtotal);
  showToast('Coupon removed.');
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

    const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (item.price !== undefined ? item.price : (product.price || 0));
    const regularPrice = item.regularPrice || product.price || unitPrice;
    const isDiscounted = item.isFestiveDiscount || (unitPrice < regularPrice);
    const discountPct = isDiscounted && regularPrice > 0 ? Math.round(((regularPrice - unitPrice) / regularPrice) * 100) : 0;
    const subtotal = item.subtotal !== undefined ? item.subtotal : (unitPrice * item.quantity);
    calculatedGrandTotal += subtotal;
    totalItemCount += item.quantity;

    const varId = item.selectedVariant?.variantId || null;
    const itemCard = document.createElement('div');
    itemCard.className = 'cart-item-card';
    itemCard.id = varId ? `cart-item-${product._id}-${varId}` : `cart-item-${product._id}`;

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
        ${item.selectedVariant && item.selectedVariant.title ? `<div class="cart-item-variant" style="font-size: 0.8rem; color: var(--color-primary, #2563eb); font-weight: 600; margin-top: 2px;">Variant: ${escapeHtml(item.selectedVariant.title)}</div>` : ''}
        <div class="cart-item-price-wrap" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 4px 0;">
          <span class="cart-item-unit-price" style="font-weight: 700; color: ${isDiscounted ? '#10b981' : 'var(--color-text-muted)'}; font-size: 0.95rem;">${currencyFormatter.format(unitPrice)} each</span>
          ${isDiscounted ? `<span style="text-decoration: line-through; color: var(--color-text-muted); font-size: 0.82rem;">${currencyFormatter.format(regularPrice)}</span>` : ''}
          ${isDiscounted ? `<span style="background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">${discountPct}% FESTIVE OFF</span>` : ''}
        </div>
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
        updateCartItemQuantity(product._id, item.quantity - 1, varId);
      } else {
        removeCartItem(product._id, varId);
      }
    });

    const incBtn = itemCard.querySelector('.btn-inc');
    if (!isAtMaxStock) {
      incBtn.addEventListener('click', () => {
        updateCartItemQuantity(product._id, item.quantity + 1, varId);
      });
    }

    const removeBtn = itemCard.querySelector('.cart-item-remove-btn');
    removeBtn.addEventListener('click', () => {
      removeCartItem(product._id, varId);
    });

    cartItemsList.appendChild(itemCard);
  });

  updateCouponTotals(calculatedGrandTotal);
  renderAvailableCoupons(calculatedGrandTotal);
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

async function updateCartItemQuantity(productId, newQuantity, variantId = null) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const url = variantId
      ? `${API_BASE_URL}/cart/${productId}?variantId=${encodeURIComponent(variantId)}`
      : `${API_BASE_URL}/cart/${productId}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ quantity: newQuantity, ...(variantId ? { variantId } : {}) })
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

async function removeCartItem(productId, variantId = null) {
  const token = getAuthToken();
  if (!token) return;

  const itemElem = document.getElementById(variantId ? `cart-item-${productId}-${variantId}` : `cart-item-${productId}`);
  if (itemElem) {
    itemElem.classList.add('cart-item-removing');
  }

  try {
    const url = variantId
      ? `${API_BASE_URL}/cart/${productId}?variantId=${encodeURIComponent(variantId)}`
      : `${API_BASE_URL}/cart/${productId}`;
    const response = await fetch(url, {
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
    case 'WALLET': return 'Nexure Wallet (1-Click Instant)';
    case 'RAZORPAY': return 'Razorpay (Cards / UPI / NetBanking)';
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
    case 'WALLET':
      return '👛 Paid in full using Nexure Wallet. Zero cash collection required on delivery.';
    case 'RAZORPAY':
      return '💳 Payment successfully verified and captured via Razorpay.';
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
  const validMethods = ['UPI', 'COD', 'NET_BANKING', 'WALLET', 'RAZORPAY'];
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

    const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (item.price !== undefined ? item.price : (product.price || 0));
    const regularPrice = item.regularPrice || product.price || unitPrice;
    const isDiscounted = item.isFestiveDiscount || (unitPrice < regularPrice);
    const subtotal = item.subtotal !== undefined ? item.subtotal : (unitPrice * item.quantity);
    grandTotal += subtotal;

    const row = document.createElement('div');
    row.className = 'checkout-item-row';
    row.innerHTML = `
      <div class="checkout-item-info">
        <span class="checkout-item-name">${escapeHtml(product.name)} ${isDiscounted ? '<span style="color: #10b981; font-size: 0.74rem; font-weight: 700; margin-left: 4px;">(Festive Deal)</span>' : ''}</span>
        ${item.selectedVariant && item.selectedVariant.title ? `<div class="checkout-item-variant" style="font-size: 0.76rem; color: var(--color-primary, #2563eb); font-weight: 600; margin-top: 1px;">Variant: ${escapeHtml(item.selectedVariant.title)}</div>` : ''}
        <span class="checkout-item-math">${currencyFormatter.format(unitPrice)} × ${item.quantity} ${isDiscounted ? `<span style="text-decoration: line-through; color: var(--color-text-muted); font-size: 0.8em; margin-left: 4px;">(${currencyFormatter.format(regularPrice)})</span>` : ''}</span>
      </div>
      <span class="checkout-item-subtotal">${currencyFormatter.format(subtotal)}</span>
    `;
    checkoutItemsSummary.appendChild(row);
  });

  if (checkoutSubtotalAmount) checkoutSubtotalAmount.textContent = currencyFormatter.format(grandTotal);
  updateCouponTotals(grandTotal);

  // Sync wallet balance & checkout deduction (Feature 5)
  if (checkoutWalletCheckbox) {
    checkoutWalletCheckbox.checked = true;
    useCheckoutWallet = true;
  }
  await fetchUserWallet();
  updateCheckoutWalletCalculation(grandTotal, appliedCoupon ? appliedCoupon.discountAmount : 0);

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
  const validMethods = ['UPI', 'COD', 'NET_BANKING', 'WALLET', 'RAZORPAY'];

  // Calculate if wallet fully covers payable amount
  const cartSub = calculateCartSubtotalAmount();
  const cDisc = appliedCoupon ? (appliedCoupon.discountAmount || 0) : 0;
  const netAfter = Math.max(0, cartSub - cDisc);
  const wAvail = userWallet.walletBalance || 0;
  const wDeduct = (useCheckoutWallet && wAvail > 0) ? Math.min(wAvail, netAfter) : 0;
  const netPayable = Math.max(0, netAfter - wDeduct);

  let finalPayment = selectedPaymentMethod;
  if (netPayable === 0 && wDeduct > 0) {
    finalPayment = 'WALLET';
  }

  if (!finalPayment || !validMethods.includes(finalPayment)) {
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
        paymentMethod: finalPayment,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        useWallet: useCheckoutWallet
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

    // Razorpay Integration Flow (Requirement 3 & 4)
    if (finalPayment === 'RAZORPAY' && (order.totalAmount || 0) > 0) {
      placeOrderBtn.textContent = 'Initiating Razorpay...';
      try {
        const rzpCreateRes = await fetch(`${API_BASE_URL}/payment/create-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            orderId: order._id,
            amount: order.totalAmount,
            currency: 'INR',
            receipt: `rcpt_${order._id.slice(-8)}`
          })
        });

        const rzpData = await rzpCreateRes.json();

        if (!rzpCreateRes.ok || !rzpData.success) {
          checkoutErrorAlert.textContent = rzpData.message || 'Failed to create Razorpay payment order.';
          checkoutErrorAlert.style.display = 'block';
          placeOrderBtn.disabled = false;
          placeOrderBtn.textContent = '✓ Place Order Now';
          return;
        }

        if (typeof window.Razorpay === 'function') {
          const options = {
            key: rzpData.keyId,
            amount: rzpData.order.amount,
            currency: rzpData.order.currency || 'INR',
            name: 'Nexure',
            description: `Order #${order.orderId || order._id}`,
            order_id: rzpData.order.id,
            handler: async function (rzpResponse) {
              placeOrderBtn.disabled = true;
              placeOrderBtn.textContent = 'Verifying Signature...';
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
                    orderId: order._id
                  })
                });

                const verifyData = await verifyRes.json();
                if (verifyRes.ok && verifyData.success) {
                  renderOrderSuccess(verifyData.order || order, rzpResponse.razorpay_payment_id);
                } else {
                  checkoutErrorAlert.textContent = verifyData.message || 'Payment signature verification failed.';
                  checkoutErrorAlert.style.display = 'block';
                  placeOrderBtn.disabled = false;
                  placeOrderBtn.textContent = '✓ Place Order Now';
                  showToast('Payment verification failed.');
                }
              } catch (vErr) {
                console.error('Payment verification failed:', vErr);
                checkoutErrorAlert.textContent = 'Network error while verifying payment.';
                checkoutErrorAlert.style.display = 'block';
                placeOrderBtn.disabled = false;
                placeOrderBtn.textContent = '✓ Place Order Now';
              }
            },
            prefill: {
              name: order.shippingAddress?.fullName || '',
              contact: order.shippingAddress?.phone || ''
            },
            theme: {
              color: '#2563eb'
            },
            modal: {
              ondismiss: function () {
                // Concurrency & Safety (Requirement 4):
                // Modal closed or cancelled - Clean recovery without stranding stock
                placeOrderBtn.disabled = false;
                placeOrderBtn.textContent = '✓ Place Order Now';
                showToast('Payment window closed. Stock remains unreserved.');
              }
            }
          };

          const rzpInstance = new window.Razorpay(options);
          rzpInstance.on('payment.failed', function (failResp) {
            placeOrderBtn.disabled = false;
            placeOrderBtn.textContent = '✓ Place Order Now';
            const reason = failResp.error?.description || 'Transaction declined';
            checkoutErrorAlert.textContent = `Payment failed: ${reason}`;
            checkoutErrorAlert.style.display = 'block';
            showToast(`Payment declined: ${reason}`);
          });
          rzpInstance.open();
          return;
        } else {
          // Razorpay SDK script not available
          checkoutErrorAlert.textContent = 'Razorpay SDK is not loaded. Please disable ad-blockers or check your connection.';
          checkoutErrorAlert.style.display = 'block';
          placeOrderBtn.disabled = false;
          placeOrderBtn.textContent = '✓ Place Order Now';
          return;
        }
      } catch (gateErr) {
        console.error('Razorpay gateway error:', gateErr);
        checkoutErrorAlert.textContent = 'Could not contact payment gateway. Please try again.';
        checkoutErrorAlert.style.display = 'block';
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = '✓ Place Order Now';
        return;
      }
    }

    // Default immediate rendering for COD, WALLET, or zero-total orders
    renderOrderSuccess(order);
  } catch (err) {
    console.error('Order creation error:', err);
    checkoutErrorAlert.textContent = 'Network error while placing order.';
    checkoutErrorAlert.style.display = 'block';
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = '✓ Place Order Now';
  }
}

// Render Order Confirmation with Tracking ID (Requirement 3)
function renderOrderSuccess(order, paymentId) {
  // Reset local cart
  currentCart = null;
  isCartLoaded = false;
  updateCartCountBadge(0);

  // Populate success receipt
  successOrderId.textContent = `#${order.orderId || order._id}`;
  successOrderStatus.textContent = order.status || 'Pending';
  successOrderTotal.textContent = currencyFormatter.format(order.totalAmount);

  // Populate tracking ID (Requirement 3)
  const trackingNumber = order.tracking?.trackingNumber || (order._id ? `MS-TRK-${order._id.toString().slice(-6).toUpperCase()}` : 'MS-TRK-PENDING');
  if (receiptTrackingRow && successTrackingId) {
    receiptTrackingRow.style.display = 'flex';
    successTrackingId.textContent = trackingNumber;
  }

  if (order.coupon && order.coupon.code) {
    if (receiptCouponRow) {
      receiptCouponRow.style.display = 'flex';
      successCouponInfo.textContent = `-${currencyFormatter.format(order.discountAmount || order.coupon.discountAmount)} (${order.coupon.code})`;
    }
  } else {
    if (receiptCouponRow) receiptCouponRow.style.display = 'none';
  }
  appliedCoupon = null; // reset coupon after successful order

  // Wallet deduction row on receipt (Feature 5)
  if (order.walletDiscount && order.walletDiscount > 0) {
    if (receiptWalletRow) {
      receiptWalletRow.style.display = 'flex';
      if (successWalletDeduction) {
        successWalletDeduction.textContent = `-${currencyFormatter.format(order.walletDiscount)}`;
      }
    }
  } else {
    if (receiptWalletRow) receiptWalletRow.style.display = 'none';
  }

  // SuperCoins cashback earned on receipt (Feature 5)
  if (receiptCoinsRow) {
    receiptCoinsRow.style.display = 'flex';
    if (successCoinsEarned) {
      successCoinsEarned.textContent = `+${order.coinsEarned || 25} SuperCoins (5% Cashback)`;
    }
  }

  // Refresh wallet balance
  fetchUserWallet();
  appliedCoupon = null;

  if (successPaymentMethod) {
    successPaymentMethod.textContent = formatPaymentMethodName(order.paymentMethod || selectedPaymentMethod);
  }
  if (successPaymentStatus) {
    const payStatus = order.paymentStatus || (order.paymentMethod === 'RAZORPAY' && paymentId ? 'Paid' : 'Pending');
    successPaymentStatus.className = `payment-status-badge badge-${payStatus.toLowerCase()}`;
    successPaymentStatus.textContent = payStatus;
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
      <div class="order-card-actions">
        <button type="button" class="btn track-order-btn" data-order-id="${escapeHtml(order._id)}">
          📍 Track Shipment
        </button>
        <button type="button" class="btn print-invoice-btn" data-order-id="${escapeHtml(order._id)}">
          📄 Tax Invoice
        </button>
      </div>
    `;

    ordersListContent.appendChild(orderCard);
  });

  // Action listeners for order cards
  ordersListContent.onclick = (e) => {
    const trackBtn = e.target.closest('.track-order-btn');
    if (trackBtn) {
      const orderId = trackBtn.getAttribute('data-order-id');
      if (orderId && typeof window.openTrackingForOrder === 'function') {
        closeOrdersModal();
        window.openTrackingForOrder(orderId);
      }
      return;
    }

    const invoiceBtn = e.target.closest('.print-invoice-btn');
    if (invoiceBtn) {
      const orderId = invoiceBtn.getAttribute('data-order-id');
      const order = orders.find(o => String(o._id) === String(orderId));
      if (order && typeof window.openInvoiceModal === 'function') {
        window.openInvoiceModal(order);
      }
      return;
    }
  };

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
  initFestivalSaleBanner();
  initHeroBackgroundSlider();
  initFooterFunctionality();

  // Handle open modal query params (e.g., coming from festive sale or external link)
  if (urlParams.get('open') === 'checkout') {
    setTimeout(() => {
      if (getAuthToken()) {
        openCheckoutModal();
      } else {
        openAuthModal('login', 'Please log in to proceed to checkout.');
      }
    }, 400);
  } else if (urlParams.get('open') === 'cart') {
    setTimeout(() => {
      openCartModal();
    }, 400);
  }
});

// Theme Toggle Button
if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', toggleTheme);
}

// Refresh Catalog
if (refreshBtn) refreshBtn.addEventListener('click', () => fetchProducts(currentPage));
if (retryBtn) retryBtn.addEventListener('click', () => fetchProducts(currentPage));

// ============================================================
// ============================================================
// Search Autocomplete, Recent Searches & Instant Suggestions
// ============================================================
const RECENT_SEARCHES_STORAGE_KEY = 'ministore_recent_searches';
const POPULAR_TRENDING_SEARCHES = [
  'Wireless Mouse',
  'Headphones',
  'Smart Watch',
  'Festive Sale',
  'Bluetooth Speaker',
  'Yoga Mat',
  'Backpack',
  'Gaming Keyboard'
];

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

function getRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveRecentSearch(query) {
  if (!query || typeof query !== 'string') return;
  const clean = query.trim();
  if (clean.length < 2) return;

  try {
    const existing = getRecentSearches();
    const updated = [clean, ...existing.filter(q => q.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
    localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) { }
}

function removeRecentSearch(query) {
  try {
    const existing = getRecentSearches();
    const updated = existing.filter(q => q.toLowerCase() !== query.toLowerCase());
    localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
    renderRecentSearchesDropdown();
  } catch (e) { }
}

function clearAllRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    renderRecentSearchesDropdown();
  } catch (e) { }
}

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

function renderRecentSearchesDropdown() {
  if (!searchSuggestionsDropdown) return;
  const recent = getRecentSearches();

  let html = `
    <div class="search-history-panel" id="search-history-panel">
      <div class="recent-searches-header">
        <span class="recent-header-title">🕒 Recent Searches</span>
        ${recent.length > 0 ? `<button type="button" class="recent-clear-all-btn" id="recent-clear-all-btn">Clear All</button>` : ''}
      </div>
  `;

  if (recent.length > 0) {
    html += `<div class="recent-searches-pills">`;
    recent.forEach(q => {
      html += `
        <div class="recent-search-pill" data-query="${escapeHtml(q)}">
          <span class="recent-pill-text">🕒 ${escapeHtml(q)}</span>
          <button type="button" class="recent-pill-remove" data-query="${escapeHtml(q)}" title="Remove from history" aria-label="Remove">✕</button>
        </div>
      `;
    });
    html += `</div>`;
  } else {
    html += `<div class="recent-empty-hint">Search for products, categories, or festive deals</div>`;
  }

  // Trending Searches section
  html += `
      <div class="trending-searches-section">
        <span class="trending-header-title">🔥 Trending Searches</span>
        <div class="trending-chips-wrap">
          ${POPULAR_TRENDING_SEARCHES.map(t => `
            <button type="button" class="trending-chip" data-query="${escapeHtml(t)}">
              🔥 ${escapeHtml(t)}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  searchSuggestionsDropdown.innerHTML = html;
  searchSuggestionsDropdown.style.display = 'block';
  if (searchInput) {
    searchInput.setAttribute('aria-expanded', 'true');
    searchInput.removeAttribute('aria-activedescendant');
  }

  // Attach event listeners for recent pills and trending chips
  const clearBtn = searchSuggestionsDropdown.querySelector('#recent-clear-all-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearAllRecentSearches();
    });
  }

  searchSuggestionsDropdown.querySelectorAll('.recent-pill-text').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const parent = el.closest('.recent-search-pill');
      const query = parent ? parent.dataset.query : '';
      if (query) {
        submitSearchQuery(query);
      }
    });
  });

  searchSuggestionsDropdown.querySelectorAll('.recent-pill-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const query = btn.dataset.query;
      if (query) {
        removeRecentSearch(query);
      }
    });
  });

  searchSuggestionsDropdown.querySelectorAll('.trending-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const query = chip.dataset.query;
      if (query) {
        submitSearchQuery(query);
      }
    });
  });
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

function renderSuggestionsDropdown(suggestions, query, totalMatches = 0, hasMore = false, categories = []) {
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

  let html = '';

  // Render category shortcuts bar if matching categories returned
  if (Array.isArray(categories) && categories.length > 0) {
    html += `
      <div class="suggestions-categories-bar">
        <span class="suggestions-cat-label">Categories:</span>
        <div class="suggestions-cat-chips">
          ${categories.map(cat => `
            <button type="button" class="suggestion-cat-chip" data-category="${escapeHtml(cat)}">
              📁 ${escapeHtml(cat)}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  html += '<ul class="suggestions-list" role="listbox" id="suggestions-list-box">';
  suggestions.forEach((item, index) => {
    const highlightedName = highlightMatch(item.name, query);
    const categoryLabel = item.category ? escapeHtml(item.category) : '';
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
          ${item.hasDiscount ? `
            <div class="suggestion-deal-wrap">
              <span class="suggestion-deal-price">₹${item.price.toLocaleString('en-IN')}</span>
              <del class="suggestion-regular-price">₹${item.regularPrice.toLocaleString('en-IN')}</del>
              <span class="suggestion-discount-badge">-${item.discountPercent}%</span>
            </div>
          ` : `
            <span class="suggestion-price">₹${(item.price || 0).toLocaleString('en-IN')}</span>
          `}
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

  // Attach listener to category shortcut chips
  searchSuggestionsDropdown.querySelectorAll('.suggestion-cat-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const cat = chip.dataset.category;
      closeSuggestionsDropdown();
      if (cat) {
        currentCategory = cat;
        if (categoryFilter) categoryFilter.value = cat;
        if (searchInput) searchInput.value = '';
        currentSearchTerm = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        applyFiltersAndRender(true);
      }
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

  if (normalized) {
    saveRecentSearch(normalized);
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
    renderRecentSearchesDropdown();
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

    if (currentRequestId !== latestSuggestionRequestId) {
      return;
    }

    if (!response.ok) {
      closeSuggestionsDropdown();
      return;
    }

    const result = await response.json();

    if (!searchInput || searchInput.value.trim().length < 1) {
      renderRecentSearchesDropdown();
      return;
    }

    if (result.success && Array.isArray(result.data)) {
      renderSuggestionsDropdown(result.data, trimmed, result.totalMatches, result.hasMore, result.categories);
    } else {
      closeSuggestionsDropdown();
    }
  } catch (error) {
    if (error.name === 'AbortError') {
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

    // 2. Debounced autocomplete suggestions
    clearTimeout(suggestionDebounceTimer);
    if (query.length < 1) {
      renderRecentSearchesDropdown();
    } else {
      suggestionDebounceTimer = setTimeout(() => {
        fetchSuggestions(query);
      }, 200);
    }
  });

  searchInput.addEventListener('focus', () => {
    const q = (searchInput.value || '').trim();
    if (q.length === 0) {
      renderRecentSearchesDropdown();
    } else {
      fetchSuggestions(q);
    }
  });

  searchInput.addEventListener('click', () => {
    const q = (searchInput.value || '').trim();
    if (q.length === 0) {
      renderRecentSearchesDropdown();
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

// Cart Coupon & Promo Code Event Listeners
if (cartCouponApplyBtn) {
  cartCouponApplyBtn.addEventListener('click', () => {
    applyCouponCode(cartCouponInput ? cartCouponInput.value : '', 'cart');
  });
}

if (cartCouponInput) {
  cartCouponInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyCouponCode(cartCouponInput.value, 'cart');
    }
  });
}

if (cartRemoveCouponBtn) {
  cartRemoveCouponBtn.addEventListener('click', removeAppliedCoupon);
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

// Checkout Coupon & Promo Code Event Listeners
if (checkoutCouponApplyBtn) {
  checkoutCouponApplyBtn.addEventListener('click', () => {
    applyCouponCode(checkoutCouponInput ? checkoutCouponInput.value : '', 'checkout');
  });
}

if (checkoutCouponInput) {
  checkoutCouponInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyCouponCode(checkoutCouponInput.value, 'checkout');
    }
  });
}

if (checkoutRemoveCouponBtn) {
  checkoutRemoveCouponBtn.addEventListener('click', removeAppliedCoupon);
}

// Payment method selection listeners
document.querySelectorAll('.checkout-payment-card').forEach(card => {
  card.addEventListener('click', () => {
    const method = card.dataset.method;
    if (method) selectPaymentMethod(method);
  });
});

document.querySelectorAll('input[name="payment_method"], input[name="checkoutPaymentMethod"]').forEach(radio => {
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

// Forgot & Reset Password Handlers
function showForgotPasswordView() {
  if (authTabs) authTabs.style.display = 'none';
  if (loginForm) loginForm.style.display = 'none';
  if (registerForm) registerForm.style.display = 'none';
  if (authErrorAlert) {
    authErrorAlert.style.display = 'none';
    authErrorAlert.textContent = '';
  }
  if (forgotPasswordView) forgotPasswordView.style.display = 'flex';
  if (forgotPasswordStep1Form) forgotPasswordStep1Form.style.display = 'block';
  if (forgotPasswordStep2Form) forgotPasswordStep2Form.style.display = 'none';

  const loginEmailVal = document.getElementById('login-email') ? document.getElementById('login-email').value.trim() : '';
  if (forgotEmailInput && loginEmailVal) {
    forgotEmailInput.value = loginEmailVal;
  }
  if (forgotEmailInput) {
    setTimeout(() => forgotEmailInput.focus(), 50);
  }
}

function showLoginViewFromForgot() {
  if (authTabs) authTabs.style.display = 'flex';
  if (forgotPasswordView) forgotPasswordView.style.display = 'none';
  if (loginForm) loginForm.style.display = 'flex';
  if (tabLoginBtn) tabLoginBtn.classList.add('active');
  if (tabRegisterBtn) tabRegisterBtn.classList.remove('active');
  if (authErrorAlert) {
    authErrorAlert.style.display = 'none';
    authErrorAlert.textContent = '';
  }
}

if (forgotPasswordTriggerBtn) {
  forgotPasswordTriggerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showForgotPasswordView();
  });
}

if (backToLoginBtn) {
  backToLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginViewFromForgot();
  });
}

if (forgotPasswordStep1Form) {
  forgotPasswordStep1Form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (authErrorAlert) authErrorAlert.style.display = 'none';

    const email = forgotEmailInput ? forgotEmailInput.value.trim() : '';
    if (!email) return;

    const originalBtnText = sendOtpBtn ? sendOtpBtn.textContent : 'Send Verification Code';
    try {
      if (sendOtpBtn) {
        sendOtpBtn.disabled = true;
        sendOtpBtn.textContent = 'Sending code...';
      }

      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && result.success) {
        if (forgotEmailSentDisplay) forgotEmailSentDisplay.textContent = email;
        forgotPasswordStep1Form.style.display = 'none';
        forgotPasswordStep2Form.style.display = 'block';
        if (resetOtpInput) {
          resetOtpInput.value = '';
          setTimeout(() => resetOtpInput.focus(), 50);
        }
        showToast('Verification code sent to your email!', 'success');
      } else {
        if (authErrorAlert) {
          authErrorAlert.textContent = result.message || 'Failed to send verification code. Please check the email address.';
          authErrorAlert.style.display = 'block';
        }
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      if (authErrorAlert) {
        authErrorAlert.textContent = 'Unable to reach backend server. Please try again.';
        authErrorAlert.style.display = 'block';
      }
    } finally {
      if (sendOtpBtn) {
        sendOtpBtn.disabled = false;
        sendOtpBtn.textContent = originalBtnText;
      }
    }
  });
}

if (forgotPasswordStep2Form) {
  forgotPasswordStep2Form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (authErrorAlert) authErrorAlert.style.display = 'none';

    const email = forgotEmailInput ? forgotEmailInput.value.trim() : '';
    const otp = resetOtpInput ? resetOtpInput.value.trim() : '';
    const newPassword = resetNewPassword ? resetNewPassword.value : '';
    const confirmPassword = resetConfirmPassword ? resetConfirmPassword.value : '';

    if (!otp || otp.length !== 6) {
      if (authErrorAlert) {
        authErrorAlert.textContent = 'Please enter a valid 6-digit verification code.';
        authErrorAlert.style.display = 'block';
      }
      return;
    }

    if (newPassword.length < 8 || !/(?=.*[a-zA-Z])(?=.*[0-9])/.test(newPassword)) {
      if (authErrorAlert) {
        authErrorAlert.textContent = 'Password must be at least 8 characters long and contain both letters and numbers.';
        authErrorAlert.style.display = 'block';
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      if (authErrorAlert) {
        authErrorAlert.textContent = 'Passwords do not match. Please re-enter.';
        authErrorAlert.style.display = 'block';
      }
      return;
    }

    const originalBtnText = submitResetPasswordBtn ? submitResetPasswordBtn.textContent : 'Update Password';
    try {
      if (submitResetPasswordBtn) {
        submitResetPasswordBtn.disabled = true;
        submitResetPasswordBtn.textContent = 'Updating password...';
      }

      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && result.success) {
        showToast('Password updated successfully! Please log in.', 'success');
        showLoginViewFromForgot();
        const loginEmailInput = document.getElementById('login-email');
        const loginPasswordInput = document.getElementById('login-password');
        if (loginEmailInput) loginEmailInput.value = email;
        if (loginPasswordInput) {
          loginPasswordInput.value = '';
          loginPasswordInput.focus();
        }
      } else {
        if (authErrorAlert) {
          authErrorAlert.textContent = result.message || 'Failed to update password. Code may have expired.';
          authErrorAlert.style.display = 'block';
        }
      }
    } catch (err) {
      console.error('Reset password error:', err);
      if (authErrorAlert) {
        authErrorAlert.textContent = 'Unable to reach backend server. Please try again.';
        authErrorAlert.style.display = 'block';
      }
    } finally {
      if (submitResetPasswordBtn) {
        submitResetPasswordBtn.disabled = false;
        submitResetPasswordBtn.textContent = originalBtnText;
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
  if (adminTabUsers) adminTabUsers.classList.toggle('active', tabName === 'users');
  if (adminTabSales) adminTabSales.classList.toggle('active', tabName === 'sales');
  if (adminTabCoupons) adminTabCoupons.classList.toggle('active', tabName === 'coupons');
  if (adminTabProducts) adminTabProducts.classList.toggle('active', tabName === 'products');
  if (adminTabOrders) adminTabOrders.classList.toggle('active', tabName === 'orders');
  if (adminTabReviews) adminTabReviews.classList.toggle('active', tabName === 'reviews');
  if (adminTabAnalytics) adminTabAnalytics.classList.toggle('active', tabName === 'analytics');
  if (adminTabSellers) adminTabSellers.classList.toggle('active', tabName === 'sellers');

  // Smooth scroll active tab into view in nav bar
  const activeTabBtn = document.getElementById(`admin-tab-${tabName}`);
  if (activeTabBtn && typeof activeTabBtn.scrollIntoView === 'function') {
    activeTabBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  // Toggle Section Displays consistently as flex
  if (adminOverviewSection) adminOverviewSection.style.display = tabName === 'overview' ? 'flex' : 'none';
  if (adminUsersSection) adminUsersSection.style.display = tabName === 'users' ? 'flex' : 'none';
  if (adminSalesSection) adminSalesSection.style.display = tabName === 'sales' ? 'flex' : 'none';
  if (adminCouponsSection) adminCouponsSection.style.display = tabName === 'coupons' ? 'flex' : 'none';
  if (adminSellersSection) adminSellersSection.style.display = tabName === 'sellers' ? 'flex' : 'none';
  if (adminProductsSection) adminProductsSection.style.display = tabName === 'products' ? 'flex' : 'none';
  if (adminOrdersSection) adminOrdersSection.style.display = tabName === 'orders' ? 'flex' : 'none';
  if (adminReviewsSection) adminReviewsSection.style.display = tabName === 'reviews' ? 'flex' : 'none';
  if (adminAnalyticsSection) adminAnalyticsSection.style.display = tabName === 'analytics' ? 'flex' : 'none';

  if (tabName === 'overview') fetchAdminStats();
  if (tabName === 'users') fetchAdminUsers(adminUsersPage);
  if (tabName === 'sellers') fetchAdminSellers();
  if (tabName === 'sales') fetchAdminSales();
  if (tabName === 'coupons') fetchAdminCoupons();
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
      if (statPendingSellers) statPendingSellers.textContent = data.data.pendingSellers ?? 0;
      if (adminPendingSellersCount) {
        const pCount = data.data.pendingSellers || 0;
        adminPendingSellersCount.textContent = pCount;
        adminPendingSellersCount.style.display = pCount > 0 ? 'inline-block' : 'none';
      }
      if (adminPendingOrdersCount) {
        const poCount = data.data.pendingOrders || 0;
        adminPendingOrdersCount.textContent = poCount;
        adminPendingOrdersCount.style.display = poCount > 0 ? 'inline-block' : 'none';
      }
    } else {
      if (adminAlertBox) {
        adminAlertBox.textContent = data.message || 'Failed to load dashboard metrics';
        adminAlertBox.style.display = 'block';
      }
    }

    // Also fetch live sale status to populate Overview spotlight card
    fetch(`${API_BASE_URL}/sales/current`)
      .then(r => r.json())
      .then(saleRes => {
        if (saleRes && saleRes.success && saleRes.data) {
          const sale = saleRes.data;
          if (overviewSaleTitle) overviewSaleTitle.textContent = sale.name || 'Festival Mega Sale';
          if (overviewSaleSubtitle) {
            overviewSaleSubtitle.textContent = sale.isLive
              ? `⚡ Heavy Festive Discounts Active across ${sale.discountedProductsCount || 27} Catalog Deals`
              : '🛑 Festival Sale is currently ENDED. Catalog products are at regular prices.';
          }
          if (overviewSaleDot) {
            overviewSaleDot.className = sale.isLive ? 'sale-status-dot' : 'sale-status-dot ended';
          }
          if (overviewSaleStatusBadge) {
            overviewSaleStatusBadge.textContent = sale.isLive ? 'LIVE NOW' : 'ENDED';
            overviewSaleStatusBadge.style.color = sale.isLive ? '#10b981' : '#ef4444';
          }
          if (overviewSaleTimer) {
            if (sale.isLive && sale.remainingMs > 0) {
              const d = Math.floor(sale.remainingMs / (1000 * 60 * 60 * 24));
              const h = Math.floor((sale.remainingMs / (1000 * 60 * 60)) % 24);
              const m = Math.floor((sale.remainingMs / (1000 * 60)) % 60);
              overviewSaleTimer.textContent = `${d}d ${h}h ${m}m remaining`;
            } else {
              overviewSaleTimer.textContent = 'Sale Concluded';
            }
          }
        }
      })
      .catch(() => { });
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

  const statuses = ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

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
          <div style="display: flex; align-items: center; gap: 8px;">
            <select class="admin-status-select" data-id="${escapeHtml(order._id)}" aria-label="Update order status">
              ${statusOptions}
            </select>
            <button type="button" class="btn btn-secondary btn-xs admin-view-invoice-btn" data-id="${escapeHtml(order._id)}" title="View Customer Invoice">
              📄
            </button>
          </div>
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

  adminOrdersTbody.querySelectorAll('.admin-view-invoice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.dataset.id;
      const order = orders.find(o => String(o._id) === String(orderId));
      if (order && typeof window.openInvoiceModal === 'function') {
        window.openInvoiceModal(order);
      }
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

// ============================================================
// Admin Sales & Campaigns Management
// ============================================================

let currentAdminSaleData = null;

async function fetchAdminSales() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/sales`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (res.ok && data.success && data.data) {
      currentAdminSaleData = data.data;
      renderAdminSalesUI(data.data);
    } else {
      showToast(data.message || 'Failed to load sale campaign data');
    }
  } catch (err) {
    showToast('Network error loading sale campaign data');
  }
}

function renderAdminSalesUI(sale) {
  if (!sale) return;

  const isLive = Boolean(sale.isLive);

  // Status Badge
  if (adminSaleBadge) {
    adminSaleBadge.className = isLive ? 'live-pulse-badge' : 'live-pulse-badge ended';
  }
  if (adminSaleBadgeText) {
    adminSaleBadgeText.textContent = isLive ? 'LIVE SALE ACTIVE' : 'SALE ENDED / INACTIVE';
  }
  if (adminSaleTypePill) {
    adminSaleTypePill.textContent = (sale.bannerBadge || 'FESTIVAL SPECIAL').toUpperCase();
  }

  // Heading & Details
  if (adminSaleName) adminSaleName.textContent = sale.name || 'Festival Mega Sale';
  if (adminSaleTagline) adminSaleTagline.textContent = sale.tagline || 'Festive Deals Live!';
  if (adminSaleDesc) {
    adminSaleDesc.textContent = sale.discountDescription || 'Heavy festive discounts active across top catalog items.';
  }

  // Remaining Time Display
  if (adminSaleEndDisplay) {
    if (isLive && sale.remainingMs > 0) {
      const d = Math.floor(sale.remainingMs / (1000 * 60 * 60 * 24));
      const h = Math.floor((sale.remainingMs / (1000 * 60 * 60)) % 24);
      const m = Math.floor((sale.remainingMs / (1000 * 60)) % 60);
      adminSaleEndDisplay.textContent = `⏳ Ends in: ${d}d ${h}h ${m}m (${new Date(sale.endDate).toLocaleDateString()})`;
      adminSaleEndDisplay.style.color = '#f59e0b';
    } else {
      adminSaleEndDisplay.textContent = '🛑 Sale Status: Concluded / Inactive';
      adminSaleEndDisplay.style.color = '#ef4444';
    }
  }

  // Control Buttons Toggle
  if (btnEndSaleNow) btnEndSaleNow.style.display = isLive ? 'inline-flex' : 'none';
  if (btnResumeSaleNow) btnResumeSaleNow.style.display = isLive ? 'none' : 'inline-flex';

  // Form Fields Population
  if (saleInputName) saleInputName.value = sale.name || '';
  if (saleInputBadge) saleInputBadge.value = sale.bannerBadge || '';
  if (saleInputTagline) saleInputTagline.value = sale.tagline || '';
  if (saleInputCoupon) saleInputCoupon.value = sale.couponCode || 'FESTIVE10';
  if (saleInputDesc) saleInputDesc.value = sale.discountDescription || '';

  if (saleInputEndDate && sale.endDate) {
    try {
      const endObj = new Date(sale.endDate);
      const pad = (n) => String(n).padStart(2, '0');
      const formattedDT = `${endObj.getFullYear()}-${pad(endObj.getMonth() + 1)}-${pad(endObj.getDate())}T${pad(endObj.getHours())}:${pad(endObj.getMinutes())}`;
      saleInputEndDate.value = formattedDT;
    } catch (e) {
      // fallback
    }
  }

  // Deals Chip List
  if (adminDealsCount) adminDealsCount.textContent = (sale.catalogItems && sale.catalogItems.length) || 27;
  if (adminDealsChipList && Array.isArray(sale.catalogItems)) {
    adminDealsChipList.innerHTML = sale.catalogItems.map(item => `
      <span class="deal-chip">
        <span>${escapeHtml(item.name.replace(/\b\w/g, l => l.toUpperCase()))}</span>
        <span class="deal-chip-pct">${item.discountPct}% OFF</span>
      </span>
    `).join('');
  }

  // Audit History Timeline
  if (adminSalesHistory) {
    const historyList = Array.isArray(sale.history) ? sale.history.slice(-8).reverse() : [];
    if (historyList.length === 0) {
      adminSalesHistory.innerHTML = '<div style="color:var(--color-text-muted); font-size:0.8rem;">No activity logged yet.</div>';
    } else {
      adminSalesHistory.innerHTML = historyList.map(h => {
        const timeStr = new Date(h.timestamp || Date.now()).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const actionClass = (h.action || '').toLowerCase();
        return `
          <div class="history-item ${actionClass}">
            <span class="history-action-badge">${escapeHtml(h.action || 'LOG')}</span>
            <span class="history-details">${escapeHtml(h.details || '')} (by ${escapeHtml(h.performedBy || 'Admin')})</span>
            <span class="history-time">${timeStr}</span>
          </div>
        `;
      }).join('');
    }
  }
}

async function extendAdminSale(hours = 24, customEndDate = null) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/sales/extend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ hours, customEndDate })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`🎉 ${data.message}`);
      fetchAdminSales();
      initFestivalSaleBanner();
    } else {
      showToast(data.message || 'Failed to extend sale');
    }
  } catch (err) {
    showToast('Network error extending sale');
  }
}

async function endAdminSale() {
  const token = getAuthToken();
  if (!token) return;

  const confirmed = confirm('Are you sure you want to END the Live Festival Sale now?\n\nThis will immediately conclude the sale, turn off festive deals across the storefront, and restore standard catalog prices.');
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/sales/end`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`🛑 ${data.message}`);
      fetchAdminSales();
      initFestivalSaleBanner();
    } else {
      showToast(data.message || 'Failed to end sale');
    }
  } catch (err) {
    showToast('Network error ending sale');
  }
}

async function resumeAdminSale() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/sales/resume`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`🚀 ${data.message}`);
      fetchAdminSales();
      initFestivalSaleBanner();
    } else {
      showToast(data.message || 'Failed to resume sale');
    }
  } catch (err) {
    showToast('Network error resuming sale');
  }
}

async function saveAdminSaleSettings(e) {
  if (e) e.preventDefault();
  const token = getAuthToken();
  if (!token) return;

  const payload = {
    name: saleInputName ? saleInputName.value.trim() : undefined,
    bannerBadge: saleInputBadge ? saleInputBadge.value.trim() : undefined,
    tagline: saleInputTagline ? saleInputTagline.value.trim() : undefined,
    couponCode: saleInputCoupon ? saleInputCoupon.value.trim() : undefined,
    discountDescription: saleInputDesc ? saleInputDesc.value.trim() : undefined,
    endDate: saleInputEndDate ? saleInputEndDate.value : undefined
  };

  try {
    const res = await fetch(`${API_BASE_URL}/admin/sales/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast('✓ Campaign settings updated and synced across storefront!');
      fetchAdminSales();
      initFestivalSaleBanner();
    } else {
      showToast(data.message || 'Failed to update campaign settings');
    }
  } catch (err) {
    showToast('Network error updating campaign settings');
  }
}

// ============================================================
// Admin Coupons & Discounts Management
// ============================================================
async function fetchAdminCoupons() {
  const token = getAuthToken();
  if (!token) return;

  if (adminCouponsTbody) {
    adminCouponsTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px;"><div class="spinner"></div> Loading coupons...</td></tr>`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/coupons`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.data)) {
      renderAdminCoupons(data.data);
    } else {
      if (adminCouponsTbody) {
        adminCouponsTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: #ef4444;">${data.message || 'Failed to load coupons.'}</td></tr>`;
      }
    }
  } catch (err) {
    if (adminCouponsTbody) {
      adminCouponsTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: #ef4444;">Network error loading coupons.</td></tr>`;
    }
  }
}

function renderAdminCoupons(coupons) {
  if (!adminCouponsTbody) return;

  if (!coupons || coupons.length === 0) {
    adminCouponsTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 32px; color: var(--color-text-muted);">No coupons created yet. Click "➕ New Coupon" to create your first discount offer.</td></tr>`;
    return;
  }

  const now = new Date();

  adminCouponsTbody.innerHTML = coupons.map(c => {
    const isExpired = c.expiryDate && new Date(c.expiryDate) < now;
    let statusClass = 'active';
    let statusLabel = 'Active';

    if (isExpired) {
      statusClass = 'expired';
      statusLabel = 'Expired';
    } else if (!c.isActive) {
      statusClass = 'disabled';
      statusLabel = 'Disabled';
    }

    const discountLabel = c.discountType === 'PERCENTAGE'
      ? `${c.discountValue}% OFF ${c.maxDiscountAmount ? `(Max ₹${c.maxDiscountAmount})` : ''}`
      : `₹${c.discountValue} FLAT OFF`;

    const minOrderLabel = c.minOrderAmount > 0 ? `₹${c.minOrderAmount}` : 'None (₹0)';
    const usageLabel = c.usageLimit ? `${c.usageCount || 0} / ${c.usageLimit}` : `${c.usageCount || 0} uses`;
    const expiryFormatted = c.expiryDate ? new Date(c.expiryDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never';

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="coupon-code-pill">🏷️ ${escapeHtml(c.code)}</span>
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 0.7rem;" onclick="copyCouponCodeToClipboard('${escapeHtml(c.code)}')" title="Copy Code">📋</button>
          </div>
          ${c.description ? `<div style="font-size: 0.72rem; color: var(--color-text-muted); margin-top: 4px;">${escapeHtml(c.description)}</div>` : ''}
        </td>
        <td>
          <span class="coupon-discount-badge">${discountLabel}</span>
        </td>
        <td style="font-size: 0.82rem; font-weight: 600;">${minOrderLabel}</td>
        <td>
          <span class="coupon-usage-badge">${usageLabel}</span>
        </td>
        <td style="font-size: 0.8rem; color: var(--color-text-muted);">${expiryFormatted}</td>
        <td>
          <span class="coupon-status-pill ${statusClass}">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span>
            ${statusLabel}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.74rem; padding: 4px 8px;" onclick="toggleAdminCoupon('${c._id}')">
              ${c.isActive ? 'Disable' : 'Enable'}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.74rem; padding: 4px 8px; color: #ef4444;" onclick="deleteAdminCoupon('${c._id}', '${escapeHtml(c.code)}')">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function copyCouponCodeToClipboard(code) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      showToast(`Copied coupon code "${code}" to clipboard!`);
    }).catch(() => {
      showToast(`Code: ${code}`);
    });
  } else {
    showToast(`Code: ${code}`);
  }
}

async function createAdminCoupon(e) {
  if (e) e.preventDefault();
  const token = getAuthToken();
  if (!token) return;

  const code = newCouponCodeInput ? newCouponCodeInput.value.trim().toUpperCase() : '';
  const discountType = newCouponTypeInput ? newCouponTypeInput.value : 'FLAT';
  const discountValue = newCouponValueInput ? parseFloat(newCouponValueInput.value) : 0;
  const minOrderAmount = newCouponMinOrderInput ? parseFloat(newCouponMinOrderInput.value) || 0 : 0;
  const maxDiscountAmount = newCouponMaxDiscountInput && newCouponMaxDiscountInput.value ? parseFloat(newCouponMaxDiscountInput.value) : null;
  const usageLimit = newCouponUsageLimitInput && newCouponUsageLimitInput.value ? parseInt(newCouponUsageLimitInput.value, 10) : null;
  const expiryDate = newCouponExpiryInput ? newCouponExpiryInput.value : '';
  const description = newCouponDescInput ? newCouponDescInput.value.trim() : '';

  if (!code) {
    showToast('Please enter a coupon code.');
    return;
  }
  if (!discountValue || discountValue <= 0) {
    showToast('Please enter a valid discount value.');
    return;
  }
  if (!expiryDate) {
    showToast('Please select an expiry date.');
    return;
  }

  const submitBtn = document.getElementById('submit-create-coupon-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/coupons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        code,
        discountType,
        discountValue,
        minOrderAmount,
        maxDiscountAmount,
        usageLimit,
        expiryDate,
        description
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`🎉 ${data.message}`);
      if (adminCouponCreator) adminCouponCreator.style.display = 'none';
      if (adminCreateCouponForm) adminCreateCouponForm.reset();
      fetchAdminCoupons();
      fetchAvailableCoupons();
    } else {
      showToast(data.message || 'Failed to create coupon.');
    }
  } catch (err) {
    showToast('Network error creating coupon.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save & Activate Coupon';
    }
  }
}

async function toggleAdminCoupon(id) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/coupons/${id}/toggle`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message);
      fetchAdminCoupons();
      fetchAvailableCoupons();
    } else {
      showToast(data.message || 'Failed to toggle coupon status.');
    }
  } catch (err) {
    showToast('Network error toggling coupon.');
  }
}

async function deleteAdminCoupon(id, code) {
  const token = getAuthToken();
  if (!token) return;

  const confirmed = confirm(`Are you sure you want to permanently delete coupon "${code}"?`);
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/coupons/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message);
      fetchAdminCoupons();
      fetchAvailableCoupons();
    } else {
      showToast(data.message || 'Failed to delete coupon.');
    }
  } catch (err) {
    showToast('Network error deleting coupon.');
  }
}

// ============================================================
// Admin Seller Verification & Approval Handlers
// ============================================================
async function fetchAdminSellers() {
  const token = getAuthToken();
  if (!token) return;

  if (adminSellersTbody) {
    adminSellersTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--color-text-muted);">Loading merchant profiles...</td></tr>`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/sellers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await res.json();

    if (res.ok && result.success && result.data) {
      const data = result.data;
      allAdminSellers = data.sellers || [];

      if (adminSellersTotalNum) adminSellersTotalNum.textContent = data.total || 0;
      if (adminSellersPendingNum) adminSellersPendingNum.textContent = data.pending || 0;
      if (adminSellersVerifiedNum) adminSellersVerifiedNum.textContent = data.verified || 0;
      if (adminSellersRejectedNum) adminSellersRejectedNum.textContent = data.rejected || 0;

      if (adminPendingSellersCount) {
        adminPendingSellersCount.textContent = data.pending || 0;
        adminPendingSellersCount.style.display = data.pending > 0 ? 'inline-block' : 'none';
      }

      renderAdminSellersTable(currentSellerFilter);
    } else {
      if (adminSellersTbody) {
        adminSellersTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--color-text-muted);">Failed to load sellers.</td></tr>`;
      }
    }
  } catch (err) {
    if (adminSellersTbody) {
      adminSellersTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--color-danger);">Network error fetching sellers.</td></tr>`;
    }
  }
}

function renderAdminSellersTable(filter = 'all') {
  if (!adminSellersTbody) return;

  currentSellerFilter = filter;
  let filtered = allAdminSellers;

  if (filter !== 'all') {
    filtered = allAdminSellers.filter(s => (s.sellerDetails?.verificationStatus || 'pending') === filter);
  }

  if (filtered.length === 0) {
    adminSellersTbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding: 32px; color: var(--color-text-muted);">
          No merchants found matching the "${filter}" filter.
        </td>
      </tr>
    `;
    return;
  }

  adminSellersTbody.innerHTML = filtered.map(seller => {
    const sd = seller.sellerDetails || {};
    const status = (sd.verificationStatus || 'pending').toLowerCase();
    const isVerified = status === 'verified';
    const isRejected = status === 'rejected';
    const isPending = status === 'pending';

    let badgeHtml = '';
    if (isVerified) {
      badgeHtml = `<span class="badge-verification badge-verified">✅ Verified</span>`;
    } else if (isRejected) {
      badgeHtml = `<span class="badge-verification badge-rejected">❌ Rejected</span>`;
    } else {
      badgeHtml = `<span class="badge-verification badge-pending">⏳ Pending Review</span>`;
    }

    let actionsHtml = '';
    if (isPending) {
      actionsHtml = `
        <div class="seller-action-btn-group">
          <button type="button" class="btn-approve-seller" onclick="verifyAdminSeller('${seller._id}', 'verified')">✅ Approve</button>
          <button type="button" class="btn-reject-seller" onclick="verifyAdminSeller('${seller._id}', 'rejected')">❌ Reject</button>
        </div>
      `;
    } else if (isVerified) {
      actionsHtml = `
        <div class="seller-action-btn-group">
          <button type="button" class="btn-reject-seller" onclick="verifyAdminSeller('${seller._id}', 'rejected')">Revoke</button>
        </div>
      `;
    } else {
      actionsHtml = `
        <div class="seller-action-btn-group">
          <button type="button" class="btn-approve-seller" onclick="verifyAdminSeller('${seller._id}', 'verified')">Re-Approve</button>
        </div>
      `;
    }

    return `
      <tr>
        <td>
          <strong style="color: var(--color-text-main); font-size: 0.95rem; display: block;">${escapeHtml(sd.businessName || '—')}</strong>
          <small style="color: var(--color-text-muted);">Owner: ${escapeHtml(seller.name)} (${escapeHtml(seller.email)})</small>
        </td>
        <td>
          <div>📞 <strong>${escapeHtml(sd.contactNumber || seller.phone || '—')}</strong></div>
          <div style="font-size: 0.78rem; color: var(--color-text-muted); margin-top: 2px;">📍 ${escapeHtml(sd.businessAddress || '—')}</div>
        </td>
        <td>
          <div>PAN: <span class="badge-code">${escapeHtml(sd.pan || '—')}</span></div>
          <div style="font-size: 0.78rem; color: var(--color-text-muted); margin-top: 2px;">GSTIN: ${escapeHtml(sd.gstin || 'Exempt / Not Applicable')}</div>
        </td>
        <td>${badgeHtml}</td>
        <td class="text-right">${actionsHtml}</td>
      </tr>
    `;
  }).join('');
}

async function verifyAdminSeller(id, status) {
  const token = getAuthToken();
  if (!token) return;

  const actionName = status === 'verified' ? 'approve' : (status === 'rejected' ? 'reject' : 'update');
  const confirmed = confirm(`Are you sure you want to ${actionName} this merchant application?`);
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/sellers/${id}/verify`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(`✓ ${result.message}`);
      fetchAdminSellers();
      fetchAdminStats();

      // If the currently logged-in user is this seller, update their profile badge in real time!
      const currentUser = getAuthUser();
      if (currentUser && currentUser.id === id) {
        if (!currentUser.sellerDetails) currentUser.sellerDetails = {};
        currentUser.sellerDetails.verificationStatus = status;
        localStorage.setItem('user', JSON.stringify(currentUser));
        if (sellerVerificationStatusBadge) {
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
      }
    } else {
      showToast(result.message || 'Failed to update merchant verification status.');
    }
  } catch (err) {
    showToast('Network error updating merchant status.');
  }
}

// ============================================================
// Admin User Management Logic & API Handlers
// ============================================================
let adminUsersPage = 1;
const adminUsersLimit = 10;
let adminUsersRoleFilter = 'all';
let adminUsersSearchQuery = '';
let adminUsersTotal = 0;
let adminUsersTotalPages = 1;

async function fetchAdminUsers(page = 1) {
  const token = getAuthToken();
  if (!token) return;

  adminUsersPage = page;
  if (adminUsersTbody) {
    adminUsersTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 28px; color: var(--color-text-muted);">Loading user accounts...</td></tr>`;
  }

  try {
    const queryParams = new URLSearchParams({
      page: adminUsersPage,
      limit: adminUsersLimit,
      role: adminUsersRoleFilter,
      q: adminUsersSearchQuery
    });

    const res = await fetch(`${API_BASE_URL}/admin/users?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await res.json();

    if (res.ok && result.success && Array.isArray(result.data)) {
      adminUsersTotal = result.total || 0;
      adminUsersTotalPages = result.totalPages || 1;

      if (adminUsersCountText) {
        adminUsersCountText.textContent = `Showing ${result.data.length} of ${adminUsersTotal} users (Page ${adminUsersPage} of ${adminUsersTotalPages})`;
      }
      if (usersPrevPageBtn) {
        usersPrevPageBtn.disabled = adminUsersPage <= 1;
      }
      if (usersNextPageBtn) {
        usersNextPageBtn.disabled = adminUsersPage >= adminUsersTotalPages;
      }

      renderAdminUsersTable(result.data);
    } else {
      if (adminUsersTbody) {
        adminUsersTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--color-danger);">${escapeHtml(result.message || 'Failed to load users.')}</td></tr>`;
      }
    }
  } catch (err) {
    if (adminUsersTbody) {
      adminUsersTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--color-danger);">Network error fetching user accounts.</td></tr>`;
    }
  }
}

function renderAdminUsersTable(users) {
  if (!adminUsersTbody) return;

  if (users.length === 0) {
    adminUsersTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 36px; color: var(--color-text-muted);">
          No users found matching your search or role filter.
        </td>
      </tr>
    `;
    return;
  }

  const currentUser = getAuthUser();

  adminUsersTbody.innerHTML = users.map((u) => {
    const initials = (u.name || 'U').charAt(0).toUpperCase();
    const role = (u.role || 'customer').toLowerCase();
    const status = (u.status || 'active').toLowerCase();
    const isSelf = Boolean(currentUser && (currentUser.id === u._id || currentUser._id === u._id));

    // Role badge
    let roleBadge = '';
    if (role === 'admin') {
      roleBadge = `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3); font-weight: 700; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem;">🛡️ Admin</span>`;
    } else if (role === 'seller') {
      const vStatus = u.sellerDetails?.verificationStatus || 'pending';
      const isVerified = vStatus === 'verified';
      roleBadge = `<span class="badge" style="background: rgba(147, 51, 234, 0.12); color: #9333ea; border: 1px solid rgba(147, 51, 234, 0.3); font-weight: 700; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem;">🏪 Seller (${isVerified ? '✅' : '⏳'})</span>`;
    } else {
      roleBadge = `<span class="badge" style="background: rgba(100, 116, 139, 0.12); color: #475569; border: 1px solid rgba(100, 116, 139, 0.3); font-weight: 600; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem;">👤 Customer</span>`;
    }

    // Status badge
    let statusBadge = '';
    if (status === 'active') {
      statusBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #059669; font-weight: 700; padding: 3px 8px; border-radius: 999px; font-size: 0.75rem;">Active</span>`;
    } else if (status === 'suspended') {
      statusBadge = `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #dc2626; font-weight: 700; padding: 3px 8px; border-radius: 999px; font-size: 0.75rem;">Suspended</span>`;
    } else {
      statusBadge = `<span class="badge" style="background: rgba(100, 116, 139, 0.15); color: #64748b; font-weight: 600; padding: 3px 8px; border-radius: 999px; font-size: 0.75rem;">Inactive</span>`;
    }

    // Date joined
    const dateFormatted = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) : '—';

    // Actions
    let actionBtn = '';
    if (isSelf) {
      actionBtn = `<span style="font-size: 0.75rem; color: var(--color-text-muted); font-style: italic;">Current Session</span>`;
    } else if (status === 'active') {
      actionBtn = `<button type="button" class="btn btn-secondary btn-sm" style="color: #dc2626; border-color: rgba(239, 68, 68, 0.4); font-size: 0.75rem; padding: 3px 8px;" onclick="toggleAdminUserStatus('${u._id}', 'suspended')">Suspend</button>`;
    } else {
      actionBtn = `<button type="button" class="btn btn-secondary btn-sm" style="color: #059669; border-color: rgba(16, 185, 129, 0.4); font-size: 0.75rem; padding: 3px 8px;" onclick="toggleAdminUserStatus('${u._id}', 'active')">Activate</button>`;
    }

    // Avatar preview
    const avatarHtml = u.avatar
      ? `<img src="${escapeHtml(u.avatar)}" alt="" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover;" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';" /><div style="display:none; width: 34px; height: 34px; border-radius: 50%; background: var(--color-primary); color:#fff; align-items:center; justify-content:center; font-weight:700; font-size:0.85rem;">${initials}</div>`
      : `<div style="width: 34px; height: 34px; border-radius: 50%; background: var(--color-primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.85rem;">${initials}</div>`;

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${avatarHtml}
            <div>
              <strong style="color: var(--color-text-main); font-size: 0.92rem; display: block;">${escapeHtml(u.name || 'User')}</strong>
              ${u.sellerDetails?.businessName ? `<small style="color: var(--color-primary); font-size: 0.78rem;">🏬 ${escapeHtml(u.sellerDetails.businessName)}</small>` : ''}
            </div>
          </div>
        </td>
        <td>
          <div style="font-weight: 500;">${escapeHtml(u.email)}</div>
          <div style="font-size: 0.78rem; color: var(--color-text-muted); margin-top: 2px;">📞 ${escapeHtml(u.phone || 'No phone')}</div>
        </td>
        <td>${roleBadge}</td>
        <td>${statusBadge}</td>
        <td style="font-size: 0.82rem; color: var(--color-text-muted);">${dateFormatted}</td>
        <td class="text-right">${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

async function toggleAdminUserStatus(userId, newStatus) {
  const token = getAuthToken();
  if (!token) return;

  const actionVerb = newStatus === 'active' ? 'activate' : 'suspend';
  if (!confirm(`Are you sure you want to ${actionVerb} this user account?`)) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    const result = await res.json();

    if (res.ok && result.success) {
      showToast(result.message || `User status updated to ${newStatus}.`);
      fetchAdminUsers(adminUsersPage);
    } else {
      showToast(result.message || 'Failed to update user status.');
    }
  } catch (err) {
    showToast('Network error updating user status.');
  }
}

// ============================================================
// Become a Seller Modal Handlers
// ============================================================
function openBecomeSellerModal() {
  closeProfileDropdown();
  const user = getAuthUser();
  if (!user) {
    openAuthModal('login', 'Please sign in or create an account to sell on Nexure.');
    return;
  }

  if (user.role === 'seller' || user.role === 'admin') {
    showToast('You already have access to the Merchant Portal.');
    window.location.href = 'seller-dashboard.html';
    return;
  }

  if (becomeSellerAlert) becomeSellerAlert.style.display = 'none';
  if (sellerAppContact && user.phone) sellerAppContact.value = user.phone;

  if (becomeSellerModal) {
    becomeSellerModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeBecomeSellerModal() {
  if (becomeSellerModal) {
    closeModalWithAnimation(becomeSellerModal, () => {
      if (becomeSellerForm) becomeSellerForm.reset();
      if (becomeSellerAlert) becomeSellerAlert.style.display = 'none';
    });
  }
}

async function handleBecomeSellerSubmit(e) {
  e.preventDefault();
  const token = getAuthToken();
  if (!token) {
    openAuthModal('login');
    return;
  }

  const businessName = sellerAppBusinessName ? sellerAppBusinessName.value.trim() : '';
  const businessAddress = sellerAppBusinessAddress ? sellerAppBusinessAddress.value.trim() : '';
  const contact = sellerAppContact ? sellerAppContact.value.trim() : '';
  const pan = sellerAppPan ? sellerAppPan.value.trim().toUpperCase() : '';
  const gstin = sellerAppGstin ? sellerAppGstin.value.trim().toUpperCase() : '';

  if (!businessName) {
    showBecomeSellerAlert('Please enter your registered Business / Brand Name.');
    return;
  }
  if (!businessAddress) {
    showBecomeSellerAlert('Please enter your business operating address.');
    return;
  }
  if (!contact || contact.length < 10) {
    showBecomeSellerAlert('Please enter a valid 10-digit business phone number.');
    return;
  }
  if (!pan || pan.length !== 10) {
    showBecomeSellerAlert('Permanent Account Number (PAN) must be exactly 10 characters.');
    return;
  }

  if (sellerAppSubmitBtn) {
    sellerAppSubmitBtn.disabled = true;
    sellerAppSubmitBtn.textContent = 'Submitting Application...';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/become-seller`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        businessName,
        businessAddress,
        contactNumber: contact,
        pan,
        gstin
      })
    });
    const result = await res.json();

    if (res.ok && result.success && (result.data || result.user)) {
      const updatedUser = result.data || result.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      updateAuthUI();
      closeBecomeSellerModal();
      showToast('🎉 Application submitted! Your merchant profile is now under review. You can visit your Merchant Dashboard.');
    } else {
      showBecomeSellerAlert(result.message || 'Failed to submit seller application.');
    }
  } catch (err) {
    showBecomeSellerAlert('Network error submitting application. Please try again.');
  } finally {
    if (sellerAppSubmitBtn) {
      sellerAppSubmitBtn.disabled = false;
      sellerAppSubmitBtn.textContent = 'Submit Application';
    }
  }
}

function showBecomeSellerAlert(msg) {
  if (becomeSellerAlert) {
    becomeSellerAlert.textContent = msg;
    becomeSellerAlert.style.display = 'block';
  }
}

// Expose handlers to global window for inline onclick handlers
window.copyCouponCodeToClipboard = copyCouponCodeToClipboard;
window.toggleAdminCoupon = toggleAdminCoupon;
window.deleteAdminCoupon = deleteAdminCoupon;
window.verifyAdminSeller = verifyAdminSeller;
window.toggleAdminUserStatus = toggleAdminUserStatus;

// Event Listeners - Admin Modal Controls
if (navAdminBtn) navAdminBtn.addEventListener('click', openAdminModal);
if (adminCloseBtn) adminCloseBtn.addEventListener('click', closeAdminModal);
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#admin') {
    const user = getAuthUser();
    if (user && user.role === 'admin') {
      openAdminModal();
    }
  }
});
if (refreshAdminBtn) {
  refreshAdminBtn.addEventListener('click', () => {
    if (currentAdminTab === 'overview') fetchAdminStats();
    if (currentAdminTab === 'users') fetchAdminUsers(adminUsersPage);
    if (currentAdminTab === 'sellers') fetchAdminSellers();
    if (currentAdminTab === 'sales') fetchAdminSales();
    if (currentAdminTab === 'products') fetchAdminProducts();
    if (currentAdminTab === 'orders') fetchAdminOrders();
    if (currentAdminTab === 'reviews') fetchAdminReviews();
    if (currentAdminTab === 'analytics') fetchAdminAnalytics();
    if (currentAdminTab === 'coupons') fetchAdminCoupons();
    showToast('Admin data refreshed.');
  });
}

if (adminTabOverview) adminTabOverview.addEventListener('click', () => setAdminTab('overview'));
if (adminTabUsers) adminTabUsers.addEventListener('click', () => setAdminTab('users'));
if (cardOverviewUsers) cardOverviewUsers.addEventListener('click', () => setAdminTab('users'));
if (refreshUsersBtn) refreshUsersBtn.addEventListener('click', () => fetchAdminUsers(adminUsersPage));

if (usersPrevPageBtn) {
  usersPrevPageBtn.addEventListener('click', () => {
    if (adminUsersPage > 1) fetchAdminUsers(adminUsersPage - 1);
  });
}
if (usersNextPageBtn) {
  usersNextPageBtn.addEventListener('click', () => {
    if (adminUsersPage < adminUsersTotalPages) fetchAdminUsers(adminUsersPage + 1);
  });
}

// Role filter pills listener for users
document.querySelectorAll('#user-role-filter-pills .filter-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#user-role-filter-pills .filter-pill').forEach(p => p.classList.remove('is-active'));
    pill.classList.add('is-active');
    adminUsersRoleFilter = pill.getAttribute('data-user-role') || 'all';
    fetchAdminUsers(1);
  });
});

// Search input listener for admin users
let adminUsersSearchDebounce = null;
if (adminUsersSearch) {
  adminUsersSearch.addEventListener('input', (e) => {
    clearTimeout(adminUsersSearchDebounce);
    adminUsersSearchDebounce = setTimeout(() => {
      adminUsersSearchQuery = e.target.value.trim();
      fetchAdminUsers(1);
    }, 300);
  });
}

// Become Seller Event Listeners
if (btnOpenBecomeSeller) btnOpenBecomeSeller.addEventListener('click', openBecomeSellerModal);
if (footerBecomeSellerBtn) footerBecomeSellerBtn.addEventListener('click', openBecomeSellerModal);
if (becomeSellerCloseBtn) becomeSellerCloseBtn.addEventListener('click', closeBecomeSellerModal);
if (becomeSellerCancelBtn) becomeSellerCancelBtn.addEventListener('click', closeBecomeSellerModal);
if (becomeSellerForm) becomeSellerForm.addEventListener('submit', handleBecomeSellerSubmit);
if (becomeSellerModal) {
  becomeSellerModal.addEventListener('click', (e) => {
    if (e.target === becomeSellerModal) closeBecomeSellerModal();
  });
}
if (adminTabSellers) adminTabSellers.addEventListener('click', () => setAdminTab('sellers'));
if (cardPendingMerchants) cardPendingMerchants.addEventListener('click', () => setAdminTab('sellers'));
if (cardOverviewProducts) cardOverviewProducts.addEventListener('click', () => setAdminTab('products'));
if (cardOverviewOrders) cardOverviewOrders.addEventListener('click', () => setAdminTab('orders'));
if (cardOverviewPendingOrders) cardOverviewPendingOrders.addEventListener('click', () => setAdminTab('orders'));
if (cardOverviewReviews) cardOverviewReviews.addEventListener('click', () => setAdminTab('reviews'));
if (refreshSellersBtn) refreshSellersBtn.addEventListener('click', fetchAdminSellers);
if (adminTabSales) adminTabSales.addEventListener('click', () => setAdminTab('sales'));
if (adminTabCoupons) adminTabCoupons.addEventListener('click', () => setAdminTab('coupons'));
if (adminTabProducts) adminTabProducts.addEventListener('click', () => setAdminTab('products'));
if (adminTabOrders) adminTabOrders.addEventListener('click', () => setAdminTab('orders'));
if (adminTabReviews) adminTabReviews.addEventListener('click', () => setAdminTab('reviews'));
if (adminTabAnalytics) adminTabAnalytics.addEventListener('click', () => setAdminTab('analytics'));

// Seller filter pills listener
document.querySelectorAll('#seller-filter-pills .filter-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#seller-filter-pills .filter-pill').forEach(p => p.classList.remove('is-active'));
    pill.classList.add('is-active');
    const filter = pill.getAttribute('data-seller-filter') || 'all';
    renderAdminSellersTable(filter);
  });
});

if (overviewManageSaleBtn) {
  overviewManageSaleBtn.addEventListener('click', () => setAdminTab('sales'));
}

// Admin Coupon Action Listeners
if (refreshCouponsBtn) refreshCouponsBtn.addEventListener('click', fetchAdminCoupons);
if (adminNewCouponBtn) {
  adminNewCouponBtn.addEventListener('click', () => {
    if (adminCouponCreator) {
      adminCouponCreator.style.display = adminCouponCreator.style.display === 'none' ? 'block' : 'none';
      if (adminCouponCreator.style.display === 'block') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 30);
        if (newCouponExpiryInput && !newCouponExpiryInput.value) {
          newCouponExpiryInput.value = tomorrow.toISOString().split('T')[0];
        }
        if (newCouponCodeInput) newCouponCodeInput.focus();
      }
    }
  });
}
if (closeCouponCreatorBtn) {
  closeCouponCreatorBtn.addEventListener('click', () => {
    if (adminCouponCreator) adminCouponCreator.style.display = 'none';
  });
}
if (cancelCreateCouponBtn) {
  cancelCreateCouponBtn.addEventListener('click', () => {
    if (adminCouponCreator) adminCouponCreator.style.display = 'none';
  });
}
if (adminCreateCouponForm) {
  adminCreateCouponForm.addEventListener('submit', createAdminCoupon);
}

// Sales Action Button Listeners
if (btnExtendSale24h) btnExtendSale24h.addEventListener('click', () => extendAdminSale(24));
if (btnExtendSale48h) btnExtendSale48h.addEventListener('click', () => extendAdminSale(48));
if (btnExtendSale7d) btnExtendSale7d.addEventListener('click', () => extendAdminSale(168));
if (btnEndSaleNow) btnEndSaleNow.addEventListener('click', endAdminSale);
if (btnResumeSaleNow) btnResumeSaleNow.addEventListener('click', resumeAdminSale);
if (refreshSalesBtn) refreshSalesBtn.addEventListener('click', fetchAdminSales);
if (adminSaleForm) adminSaleForm.addEventListener('submit', saveAdminSaleSettings);

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
// Festival Mega Sale Banner (Live Countdown & Coupon Copy)
// ============================================================

function initFestivalSaleBanner() {
  const daysEl = document.getElementById('festive-days');
  const hoursEl = document.getElementById('festive-hours');
  const minsEl = document.getElementById('festive-minutes');
  const secsEl = document.getElementById('festive-seconds');
  const copyBtn = document.getElementById('btn-copy-festive-coupon');
  const bannerBadge = document.querySelector('.festive-badge');
  const bannerTitle = document.querySelector('.festive-title');

  let targetTime = Date.now() + (48 * 60 * 60 * 1000);
  let isSaleLive = true;

  // Sync with live server campaign
  fetch(`${API_BASE_URL}/sales/current`)
    .then(r => r.json())
    .then(res => {
      if (res && res.success && res.data) {
        const sale = res.data;
        isSaleLive = Boolean(sale.isLive);
        if (sale.endDate) {
          targetTime = new Date(sale.endDate).getTime();
        }
        if (bannerBadge && sale.bannerBadge) {
          bannerBadge.textContent = sale.bannerBadge;
        }
        if (!isSaleLive && bannerTitle) {
          bannerTitle.innerHTML = 'Festive Sale Has Concluded <span class="badge-ended" style="background:#ef4444; color:#fff; font-size:0.5em; padding:2px 8px; border-radius:4px; vertical-align:middle;">ENDED</span>';
        }
      }
    })
    .catch(() => { });

  function updateCountdown() {
    const now = Date.now();
    let diff = Math.max(0, targetTime - now);

    if (!isSaleLive || diff <= 0) {
      if (daysEl) daysEl.textContent = '00';
      if (hoursEl) hoursEl.textContent = '00';
      if (minsEl) minsEl.textContent = '00';
      if (secsEl) secsEl.textContent = '00';
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    if (daysEl) daysEl.textContent = String(d).padStart(2, '0');
    if (hoursEl) hoursEl.textContent = String(h).padStart(2, '0');
    if (minsEl) minsEl.textContent = String(m).padStart(2, '0');
    if (secsEl) secsEl.textContent = String(s).padStart(2, '0');
  }

  updateCountdown();
  if (!window._festiveCountdownInterval) {
    window._festiveCountdownInterval = setInterval(updateCountdown, 1000);
  }

  // 2. Interactive Coupon Copying with Feedback
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
        const copyText = copyBtn.querySelector('.copy-text');
        if (copyText) copyText.textContent = '✓ Copied!';
        showToast('🎉 Coupon code FESTIVE10 copied! Apply at checkout for ₹200 off.');
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          if (copyText) copyText.textContent = 'Copy Code';
        }, 3000);
      } catch (err) {
        showToast('Code: FESTIVE10 (Flat ₹200 off)');
      }
    });
  }

  // 3. Initialize Festive Blasting Firecrackers Background
  if (typeof window.initFestiveFirecrackers === 'function') {
    window.initFestiveFirecrackers('festive-firecrackers-canvas', 'festival-sale-banner');
  }
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

  let currentTrackedOrder = null;

  // Global helper to open tracking for a specific order
  window.openTrackingForOrder = async function (orderId) {
    if (!orderTrackingModal) return;
    openFooterModal(orderTrackingModal);
    if (trackingInput) {
      trackingInput.value = orderId;
    }
    if (trackingError) trackingError.style.display = 'none';
    if (trackingUnauth) trackingUnauth.style.display = 'none';
    if (trackingResult) trackingResult.style.display = 'none';
    if (trackingLoading) trackingLoading.style.display = 'flex';

    const token = getAuthToken();
    if (!token) {
      if (trackingLoading) trackingLoading.style.display = 'none';
      if (trackingUnauth) trackingUnauth.style.display = 'block';
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (trackingLoading) trackingLoading.style.display = 'none';

      if (!response.ok || !result.success || !result.data) {
        if (trackingError) {
          trackingError.textContent = result.message || `Order #${orderId} could not be retrieved.`;
          trackingError.style.display = 'block';
        }
        return;
      }

      renderTrackingResult(result.data);
    } catch (err) {
      console.error('Track order direct fetch error:', err);
      if (trackingLoading) trackingLoading.style.display = 'none';
      if (trackingError) {
        trackingError.textContent = 'Network error while querying order status.';
        trackingError.style.display = 'block';
      }
    }
  };

  function renderTrackingResult(order) {
    if (!trackingResult) return;
    currentTrackedOrder = order;

    const idEl = document.getElementById('track-result-id');
    const dateEl = document.getElementById('track-result-date');
    const statusEl = document.getElementById('track-result-status');
    const paymentEl = document.getElementById('track-result-payment');
    const paymentStatusEl = document.getElementById('track-result-payment-status');
    const carrierEl = document.getElementById('track-result-carrier');
    const awbEl = document.getElementById('track-result-awb');
    const etaEl = document.getElementById('track-result-eta');
    const timelineEl = document.getElementById('track-result-timeline');
    const itemsEl = document.getElementById('track-result-items');
    const addressEl = document.getElementById('track-result-address');
    const totalEl = document.getElementById('track-result-total');
    const copyAwbBtn = document.getElementById('track-copy-awb-btn');
    const viewInvoiceBtn = document.getElementById('track-view-invoice-btn');

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
      statusEl.className = `status-badge ${currentStatus.toLowerCase() === 'cancelled' ? 'badge-danger' : 'in-stock'}`;
    }

    if (paymentEl) {
      paymentEl.textContent = order.paymentMethod ? `💳 ${formatPaymentMethodName(order.paymentMethod)}` : '💳 Direct';
    }

    if (paymentStatusEl) {
      const pStatus = (order.paymentStatus || 'Pending').trim();
      paymentStatusEl.textContent = pStatus;
      paymentStatusEl.className = `payment-status-badge badge-${pStatus.toLowerCase()}`;
    }

    // Carrier & AWB details
    const carrierName = (order.tracking && order.tracking.carrier) ? order.tracking.carrier : 'Nexure Express';
    const awbNumber = (order.tracking && order.tracking.trackingNumber) ? order.tracking.trackingNumber : `NX-TRK-${order._id.slice(-6).toUpperCase()}`;

    if (carrierEl) carrierEl.textContent = carrierName;
    if (awbEl) awbEl.textContent = awbNumber;

    if (etaEl) {
      if (currentStatus.toLowerCase() === 'delivered') {
        etaEl.textContent = 'Package Delivered';
        etaEl.className = 'courier-banner-val text-success';
      } else if (currentStatus.toLowerCase() === 'cancelled') {
        etaEl.textContent = 'Order Cancelled';
        etaEl.className = 'courier-banner-val text-danger';
      } else if (order.tracking && order.tracking.estimatedDeliveryDate) {
        const etaDate = new Date(order.tracking.estimatedDeliveryDate).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        etaEl.textContent = etaDate;
        etaEl.className = 'courier-banner-val text-success';
      } else {
        etaEl.textContent = '3 to 4 Business Days';
        etaEl.className = 'courier-banner-val text-success';
      }
    }

    // Copy AWB action
    if (copyAwbBtn) {
      copyAwbBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(awbNumber);
          copyAwbBtn.textContent = '✓';
          showToast(`Tracking code ${awbNumber} copied to clipboard!`);
          setTimeout(() => { copyAwbBtn.textContent = '📋'; }, 2000);
        } catch (e) {
          showToast(`Tracking code: ${awbNumber}`);
        }
      };
    }

    // View Invoice button action
    if (viewInvoiceBtn) {
      viewInvoiceBtn.onclick = () => {
        if (currentTrackedOrder && typeof window.openInvoiceModal === 'function') {
          window.openInvoiceModal(currentTrackedOrder);
        }
      };
    }

    // Visual 5-Stage Stepper
    const statusLower = currentStatus.toLowerCase();
    const stepPlaced = document.getElementById('step-placed');
    const stepProcessing = document.getElementById('step-processing');
    const stepShipped = document.getElementById('step-shipped');
    const stepOutForDelivery = document.getElementById('step-out-for-delivery');
    const stepDelivered = document.getElementById('step-delivered');
    const line1 = document.getElementById('line-1');
    const line2 = document.getElementById('line-2');
    const line3 = document.getElementById('line-3');
    const line4 = document.getElementById('line-4');

    [stepPlaced, stepProcessing, stepShipped, stepOutForDelivery, stepDelivered].forEach(s => {
      if (s) s.className = 'stepper-step';
    });
    [line1, line2, line3, line4].forEach(l => {
      if (l) l.className = 'stepper-line';
    });

    if (statusLower === 'delivered') {
      if (stepPlaced) stepPlaced.classList.add('completed');
      if (line1) line1.classList.add('completed');
      if (stepProcessing) stepProcessing.classList.add('completed');
      if (line2) line2.classList.add('completed');
      if (stepShipped) stepShipped.classList.add('completed');
      if (line3) line3.classList.add('completed');
      if (stepOutForDelivery) stepOutForDelivery.classList.add('completed');
      if (line4) line4.classList.add('completed');
      if (stepDelivered) stepDelivered.classList.add('completed', 'current');
    } else if (statusLower === 'out for delivery') {
      if (stepPlaced) stepPlaced.classList.add('completed');
      if (line1) line1.classList.add('completed');
      if (stepProcessing) stepProcessing.classList.add('completed');
      if (line2) line2.classList.add('completed');
      if (stepShipped) stepShipped.classList.add('completed');
      if (line3) line3.classList.add('completed');
      if (stepOutForDelivery) stepOutForDelivery.classList.add('current');
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

    // Real-Time Activity Log Timeline
    if (timelineEl) {
      let historyEvents = (order.tracking && Array.isArray(order.tracking.history) && order.tracking.history.length > 0)
        ? order.tracking.history
        : [
          {
            status: 'Placed',
            title: 'Order Placed & Confirmed',
            description: 'Order details verified and sent to fulfillment center.',
            location: 'Central Fulfillment Hub, Mumbai',
            timestamp: order.createdAt
          }
        ];

      // Sort newest first
      const sortedEvents = [...historyEvents].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      timelineEl.innerHTML = sortedEvents.map((ev, idx) => {
        const isLatest = idx === 0;
        const timeFormatted = new Date(ev.timestamp).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        return `
          <div class="timeline-node ${isLatest ? 'current' : 'active'}">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-title-row">
                <span class="timeline-title">${escapeHtml(ev.title)}</span>
                <span class="timeline-time">🕒 ${timeFormatted}</span>
              </div>
              <div class="timeline-desc">${escapeHtml(ev.description || '')}</div>
              ${ev.location ? `<div class="timeline-location">📍 ${escapeHtml(ev.location)}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
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

  // ============================================================
  // BRANDED INVOICE MODAL SYSTEM
  // ============================================================
  const invoiceModal = document.getElementById('invoice-modal');
  const invoicePrintBtn = document.getElementById('invoice-print-btn');
  const invoiceCloseBtn = document.getElementById('invoice-close-btn');

  window.openInvoiceModal = function (order) {
    if (!invoiceModal || !order) return;

    const invNumEl = document.getElementById('inv-num');
    const invDateEl = document.getElementById('inv-date');
    const invOrderIdEl = document.getElementById('inv-order-id');
    const invOrderDateEl = document.getElementById('inv-order-date');
    const invPayModeEl = document.getElementById('inv-pay-mode');
    const invPayStatusEl = document.getElementById('inv-pay-status');
    const invShipAddressEl = document.getElementById('inv-ship-address');
    const invCarrierEl = document.getElementById('inv-carrier');
    const invAwbEl = document.getElementById('inv-awb');
    const invItemsBody = document.getElementById('inv-items-body');
    const invSubtotalEl = document.getElementById('inv-subtotal');
    const invDiscountRow = document.getElementById('inv-discount-row');
    const invDiscountEl = document.getElementById('inv-discount');
    const invGrandTotalEl = document.getElementById('inv-grand-total');

    const createdDate = new Date(order.createdAt || Date.now());
    const formattedCreated = createdDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const invoiceNum = order.invoiceNumber || `INV-${createdDate.toISOString().slice(0, 10).replace(/-/g, '')}-${order._id.slice(-4).toUpperCase()}`;

    if (invNumEl) invNumEl.textContent = invoiceNum;
    if (invDateEl) invDateEl.textContent = formattedCreated;
    if (invOrderIdEl) invOrderIdEl.textContent = `#${order._id}`;
    if (invOrderDateEl) invOrderDateEl.textContent = formattedCreated;
    if (invPayModeEl) invPayModeEl.textContent = formatPaymentMethodName(order.paymentMethod) || 'UPI';

    if (invPayStatusEl) {
      const pStatus = (order.paymentStatus || 'Pending').trim();
      invPayStatusEl.textContent = pStatus;
      invPayStatusEl.className = `inv-meta-val ${pStatus.toLowerCase() === 'paid' ? 'text-success' : 'text-warning'}`;
    }

    if (invCarrierEl) {
      invCarrierEl.textContent = (order.tracking && order.tracking.carrier) ? order.tracking.carrier : 'Nexure Express';
    }
    if (invAwbEl) {
      invAwbEl.textContent = (order.tracking && order.tracking.trackingNumber) ? order.tracking.trackingNumber : `NX-TRK-${order._id.slice(-6).toUpperCase()}`;
    }

    if (invShipAddressEl) {
      if (order.shippingAddress) {
        const a = order.shippingAddress;
        invShipAddressEl.innerHTML = `
          <strong>${escapeHtml(a.fullName || 'Valued Customer')}</strong><br>
          Phone: ${escapeHtml(a.phone || 'N/A')}<br>
          ${escapeHtml(a.addressLine1 || '')}${a.addressLine2 ? ', ' + escapeHtml(a.addressLine2) : ''}<br>
          ${escapeHtml(a.city || '')}, ${escapeHtml(a.state || '')} - <strong>${escapeHtml(a.postalCode || '')}</strong>, ${escapeHtml(a.country || 'India')}
        `;
      } else {
        invShipAddressEl.innerHTML = `<strong>Valued Customer</strong><br>Pan-India Direct Express Delivery`;
      }
    }

    // Items Table Rows
    if (invItemsBody) {
      const items = Array.isArray(order.items) && order.items.length > 0
        ? order.items
        : (Array.isArray(order.products) ? order.products : []);

      invItemsBody.innerHTML = items.map((it, idx) => {
        const itemPrice = Number(it.price) || 0;
        const itemQty = Number(it.quantity) || 1;
        const lineTotal = Number(it.subtotal) || (itemPrice * itemQty);

        return `
          <tr>
            <td style="text-align: center; color: #64748b;">${idx + 1}</td>
            <td>
              <strong>${escapeHtml(it.name || 'Product')}</strong>
            </td>
            <td style="text-align: right;">${currencyFormatter.format(itemPrice)}</td>
            <td style="text-align: center;">${itemQty}</td>
            <td style="text-align: right; font-weight: 700;">${currencyFormatter.format(lineTotal)}</td>
          </tr>
        `;
      }).join('');
    }

    // Pricing Breakdown
    const subtotal = Number(order.subtotalAmount) || Number(order.totalAmount) || 0;
    const discount = Number(order.discountAmount) || (order.coupon ? Number(order.coupon.discountAmount) : 0);
    const grandTotal = Number(order.totalAmount) || 0;

    if (invSubtotalEl) invSubtotalEl.textContent = currencyFormatter.format(subtotal);

    if (invDiscountRow && invDiscountEl) {
      if (discount > 0) {
        const couponSuffix = order.coupon && order.coupon.code ? ` (${escapeHtml(order.coupon.code)})` : '';
        invDiscountEl.textContent = `- ${currencyFormatter.format(discount)}${couponSuffix}`;
        invDiscountRow.style.display = 'flex';
      } else {
        invDiscountRow.style.display = 'none';
      }
    }

    if (invGrandTotalEl) invGrandTotalEl.textContent = currencyFormatter.format(grandTotal);

    openFooterModal(invoiceModal);
  };

  window.closeInvoiceModal = function () {
    if (invoiceModal) closeFooterModal(invoiceModal);
  };

  if (invoiceCloseBtn) {
    invoiceCloseBtn.addEventListener('click', window.closeInvoiceModal);
  }

  if (invoicePrintBtn) {
    invoicePrintBtn.addEventListener('click', () => {
      window.print();
    });
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

// ============================================================
// Feature 4: Pincode Delivery Estimator & Delivery Services
// ============================================================

async function checkPincodeServiceability(pincode, resultElement) {
  if (!resultElement) return;

  const cleanPin = String(pincode || '').trim();
  const pinRegex = /^[1-9][0-9]{5}$/;

  if (!pinRegex.test(cleanPin)) {
    resultElement.className = 'pincode-result-box pincode-result-error';
    resultElement.innerHTML = '⚠️ Please enter a valid 6-digit Indian PIN code (e.g. 110001, 560001).';
    resultElement.style.display = 'block';
    return;
  }

  resultElement.className = 'pincode-result-box';
  resultElement.innerHTML = 'Checking courier serviceability & dispatch hubs...';
  resultElement.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE_URL}/addresses/check-pincode/${cleanPin}`);
    const data = await res.json();

    if (!res.ok || !data.serviceable) {
      resultElement.className = 'pincode-result-box pincode-result-error';
      resultElement.innerHTML = `⚠️ ${data.message || 'Courier delivery currently unavailable for this PIN.'}`;
      return;
    }

    localStorage.setItem('ministore_checked_pincode', cleanPin);
    resultElement.className = 'pincode-result-box pincode-result-success';
    resultElement.innerHTML = `
      <div class="pincode-delivery-line">
        <span>🚚 Delivery by ${data.estimatedDeliveryDate} (${data.estimatedDays})</span>
      </div>
      <div class="pincode-location-line">
        📍 Delivering to <strong>${escapeHtml(data.city)}, ${escapeHtml(data.state)}</strong> (${cleanPin})
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
  } catch (err) {
    resultElement.className = 'pincode-result-box pincode-result-error';
    resultElement.innerHTML = '⚠️ Could not connect to courier estimator service.';
  }
}

function setupModalPincodeEstimator(container) {
  if (!container) return;
  const pinInput = container.querySelector('#modal-pincode-input');
  const pinBtn = container.querySelector('#modal-pincode-check-btn');
  const pinResult = container.querySelector('#modal-pincode-result');

  if (!pinInput || !pinBtn || !pinResult) return;

  const defaultAddr = userAddresses.find(a => a.isDefault);
  const preferredPin = (defaultAddr && defaultAddr.postalCode) || localStorage.getItem('ministore_checked_pincode') || '110001';
  pinInput.value = preferredPin;
  checkPincodeServiceability(preferredPin, pinResult);

  pinBtn.addEventListener('click', () => {
    checkPincodeServiceability(pinInput.value, pinResult);
  });

  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkPincodeServiceability(pinInput.value, pinResult);
    }
  });
}

// ============================================================
// Feature 5: MiniStore Wallet & Loyalty Rewards System
// ============================================================

function calculateCartSubtotalAmount() {
  let subtotal = 0;
  if (currentCart && Array.isArray(currentCart.items)) {
    currentCart.items.forEach(item => {
      const product = item.product;
      if (!product) return;
      const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (item.price !== undefined ? item.price : (product.price || 0));
      subtotal += unitPrice * item.quantity;
    });
  }
  return subtotal;
}

function updateCheckoutWalletCalculation(subtotal = 0, couponDiscount = 0) {
  if (!checkoutWalletBox) return;

  const afterCoupon = Math.max(0, subtotal - couponDiscount);
  const availBalance = userWallet.walletBalance || 0;

  if (checkoutWalletAvailableText) {
    checkoutWalletAvailableText.textContent = currencyFormatter.format(availBalance);
  }

  // Calculate cashback coins preview (5% of order subtotal, min 10 coins)
  const coinsReward = Math.max(10, Math.round(subtotal * 0.05));
  if (checkoutCoinsRewardText) {
    checkoutCoinsRewardText.textContent = `+${coinsReward} SuperCoins`;
  }

  const isChecked = checkoutWalletCheckbox ? checkoutWalletCheckbox.checked : false;
  useCheckoutWallet = isChecked;

  // Fair Usage Policy: A user can use wallet balance to pay up to 50% of the payable cart total
  const maxAllowedWallet = Math.round((afterCoupon * 0.5) * 100) / 100;
  let walletDeduction = 0;
  if (isChecked && availBalance > 0 && afterCoupon > 0) {
    walletDeduction = Math.min(availBalance, maxAllowedWallet);
  }

  const finalGrandTotal = Math.max(0, Math.round((afterCoupon - walletDeduction) * 100) / 100);

  if (checkoutTotalAmount) {
    checkoutTotalAmount.textContent = currencyFormatter.format(finalGrandTotal);
  }

  if (walletDeduction > 0) {
    checkoutWalletBox.classList.add('is-active');
    if (checkoutWalletDiscountRow) {
      checkoutWalletDiscountRow.style.display = 'flex';
      if (checkoutWalletDiscountAmount) {
        checkoutWalletDiscountAmount.textContent = `-${currencyFormatter.format(walletDeduction)}`;
      }
    }
    if (checkoutWalletDeductionBadge) {
      checkoutWalletDeductionBadge.textContent = `-${currencyFormatter.format(walletDeduction)}`;
      checkoutWalletDeductionBadge.style.display = 'inline-block';
    }
  } else {
    checkoutWalletBox.classList.remove('is-active');
    if (checkoutWalletDiscountRow) {
      checkoutWalletDiscountRow.style.display = 'none';
    }
    if (checkoutWalletDeductionBadge) {
      checkoutWalletDeductionBadge.textContent = '₹0.00';
    }
  }
}

async function fetchUserWallet() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/wallet`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await res.json();
    if (res.ok && result.success && result.data) {
      userWallet = result.data;
      updateWalletUI();
    }
  } catch (err) {
    console.error('Fetch wallet error:', err);
  }
}

function updateWalletUI() {
  const balance = userWallet.walletBalance || 0;
  const coins = userWallet.coins || 0;

  if (navWalletBalanceText) navWalletBalanceText.textContent = `₹${Math.round(balance)}`;
  if (navWalletCoinsText) navWalletCoinsText.textContent = coins;
  if (dropdownWalletBalanceText) dropdownWalletBalanceText.textContent = `₹${balance.toFixed(2)}`;
  if (dropdownCoinsText) dropdownCoinsText.textContent = coins;

  if (walletModalBalanceDisplay) walletModalBalanceDisplay.textContent = currencyFormatter.format(balance);
  if (walletModalCoinsDisplay) walletModalCoinsDisplay.textContent = `🪙 ${coins}`;
  if (walletCoinsWorthText) walletCoinsWorthText.textContent = `Worth ₹${(coins * 0.5).toFixed(2)} (Redeemable anytime)`;

  if (checkoutWalletAvailableText) checkoutWalletAvailableText.textContent = currencyFormatter.format(balance);
}

function openWalletModal() {
  if (!walletModal) return;
  closeProfileDropdown();
  walletModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const token = getAuthToken();
  if (!token) {
    if (walletContent) walletContent.style.display = 'none';
    if (walletUnauthState) walletUnauthState.style.display = 'flex';
    return;
  }

  if (walletUnauthState) walletUnauthState.style.display = 'none';
  if (walletContent) walletContent.style.display = 'block';

  fetchUserWallet().then(() => {
    renderWalletTransactions(userWallet.transactions || []);
  });
}

function closeWalletModal() {
  if (!walletModal) return;
  closeModalWithAnimation(walletModal, () => {
    if (walletTopupAlert) walletTopupAlert.style.display = 'none';
    if (walletRedeemAlert) walletRedeemAlert.style.display = 'none';
  });
}

function renderWalletTransactions(txns = []) {
  if (!walletTransactionsList) return;
  walletTransactionsList.innerHTML = '';

  if (walletTxnCountBadge) {
    walletTxnCountBadge.textContent = `${txns.length} ${txns.length === 1 ? 'Activity' : 'Activities'}`;
  }

  if (txns.length === 0) {
    walletTransactionsList.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--color-text-muted); font-size: 0.86rem;">
        No transaction history found yet.
      </div>
    `;
    return;
  }

  txns.forEach(tx => {
    const isCredit = tx.type === 'credit';
    const row = document.createElement('div');
    row.className = 'wallet-txn-item';

    const dateStr = new Date(tx.date || Date.now()).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    row.innerHTML = `
      <div class="wallet-txn-left">
        <span class="wallet-txn-desc">${escapeHtml(tx.description || 'Wallet Activity')}</span>
        <span class="wallet-txn-date">${dateStr}</span>
      </div>
      <div class="wallet-txn-right">
        ${tx.amount > 0 ? `<span class="wallet-txn-amount ${isCredit ? 'credit' : 'debit'}">${isCredit ? '+' : '-'}${currencyFormatter.format(tx.amount)}</span>` : ''}
        ${tx.coins ? `<span class="wallet-txn-coins">${tx.coins > 0 ? '+' : ''}${tx.coins} SuperCoins</span>` : ''}
      </div>
    `;

    walletTransactionsList.appendChild(row);
  });
}

// ============================================================
// Secure Payment Gateway Simulation for Wallet Top-up
// ============================================================
let pendingGatewayTopupAmount = 1000;
let currentGatewayPaymentMethod = 'UPI';

function openWalletGatewayModal(amount) {
  const token = getAuthToken();
  if (!token) {
    showToast('Please log in to recharge your wallet.');
    return;
  }
  const num = Number(amount);
  if (isNaN(num) || num < 10 || num > 50000) {
    if (walletTopupAlert) {
      walletTopupAlert.className = 'wallet-alert alert-error';
      walletTopupAlert.textContent = 'Please enter an amount between ₹10 and ₹50,000.';
      walletTopupAlert.style.display = 'block';
    }
    return;
  }

  if (walletTopupAlert) walletTopupAlert.style.display = 'none';
  pendingGatewayTopupAmount = num;

  const modal = document.getElementById('wallet-gateway-modal');
  const amountDisp = document.getElementById('gateway-amount-display');
  const payLabel = document.getElementById('gateway-pay-amount-label');
  const procView = document.getElementById('gateway-processing-view');
  const errAlert = document.getElementById('gateway-error-alert');

  if (amountDisp) amountDisp.textContent = currencyFormatter.format(num);
  if (payLabel) payLabel.textContent = currencyFormatter.format(num);
  if (procView) procView.style.display = 'none';
  if (errAlert) errAlert.style.display = 'none';

  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeWalletGatewayModal() {
  const modal = document.getElementById('wallet-gateway-modal');
  if (modal) modal.style.display = 'none';
}

async function executeGatewayRecharge() {
  const token = getAuthToken();
  if (!token) {
    showToast('Please log in to recharge your wallet.');
    return;
  }

  const procView = document.getElementById('gateway-processing-view');
  const procStatus = document.getElementById('gateway-processing-status');
  const errAlert = document.getElementById('gateway-error-alert');
  const payBtn = document.getElementById('gateway-confirm-pay-btn');
  const topupBtn = document.getElementById('wallet-topup-submit-btn');

  if (errAlert) errAlert.style.display = 'none';

  // Show processing animation
  if (procView) procView.style.display = 'flex';
  if (payBtn) payBtn.disabled = true;
  if (topupBtn) topupBtn.disabled = true;

  if (procStatus) procStatus.textContent = 'Connecting to Secure Razorpay Gateway...';

  try {
    const res = await fetch(`${API_BASE_URL}/wallet/create-recharge-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: pendingGatewayTopupAmount
      })
    });
    const rzpData = await res.json();

    if (!res.ok || !rzpData.success) {
      if (procView) procView.style.display = 'none';
      if (payBtn) payBtn.disabled = false;
      if (topupBtn) topupBtn.disabled = false;
      if (errAlert) {
        errAlert.textContent = rzpData.message || 'Failed to initialize payment gateway.';
        errAlert.style.display = 'block';
      }
      return;
    }

    // Hide intermediate gateway modal so Razorpay modal takes the screen cleanly
    closeWalletGatewayModal();
    if (procView) procView.style.display = 'none';

    if (typeof window.Razorpay === 'function') {
      const upiPrefillInput = document.getElementById('gateway-upi-id');
      const vpa = upiPrefillInput ? upiPrefillInput.value.trim() : '';

      const options = {
        key: rzpData.keyId,
        amount: rzpData.order.amount,
        currency: rzpData.order.currency || 'INR',
        name: 'Nexure Wallet',
        description: `Wallet Recharge of ₹${pendingGatewayTopupAmount.toFixed(2)} (+10% Bonus Coins)`,
        order_id: rzpData.order.id,
        prefill: {
          name: (currentUser && currentUser.name) || '',
          email: (currentUser && currentUser.email) || '',
          contact: (currentUser && currentUser.phone) || '',
          vpa: vpa || undefined
        },
        theme: {
          color: '#10b981'
        },
        handler: async function (rzpResponse) {
          showToast('Payment received! Verifying bank signature...');
          try {
            const verifyRes = await fetch(`${API_BASE_URL}/wallet/verify-recharge`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                amount: pendingGatewayTopupAmount,
                razorpay_order_id: rzpResponse.razorpay_order_id,
                razorpay_payment_id: rzpResponse.razorpay_payment_id,
                razorpay_signature: rzpResponse.razorpay_signature
              })
            });

            const verifyResult = await verifyRes.json();
            if (verifyRes.ok && verifyResult.success) {
              userWallet = verifyResult.data;
              updateWalletUI();
              renderWalletTransactions(userWallet.transactions || []);
              if (walletTopupInput) walletTopupInput.value = '';
              showToast(`✓ Payment of ₹${pendingGatewayTopupAmount.toFixed(2)} verified! Funds added to your wallet.`);
            } else {
              showToast(verifyResult.message || 'Payment signature verification failed.');
            }
          } catch (vErr) {
            console.error('Wallet recharge verification error:', vErr);
            showToast('Network error while verifying payment.');
          } finally {
            if (payBtn) payBtn.disabled = false;
            if (topupBtn) topupBtn.disabled = false;
          }
        },
        modal: {
          ondismiss: function () {
            // Security: Modal closed without paying -> ZERO money added to wallet!
            if (payBtn) payBtn.disabled = false;
            if (topupBtn) topupBtn.disabled = false;
            showToast('Recharge cancelled. No money was deducted or added to your wallet.');
          }
        }
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
    } else {
      showToast('Razorpay SDK not loaded. Please refresh the page.');
      if (payBtn) payBtn.disabled = false;
      if (topupBtn) topupBtn.disabled = false;
    }
  } catch (err) {
    if (procView) procView.style.display = 'none';
    if (payBtn) payBtn.disabled = false;
    if (topupBtn) topupBtn.disabled = false;
    if (errAlert) {
      errAlert.textContent = 'Network error communicating with payment gateway.';
      errAlert.style.display = 'block';
    }
  }
}

async function handleWalletRedeemCoins(coinsToRedeem) {
  const token = getAuthToken();
  if (!token) return;

  const num = parseInt(coinsToRedeem, 10);
  if (isNaN(num) || num < 20) {
    if (walletRedeemAlert) {
      walletRedeemAlert.className = 'wallet-alert alert-error';
      walletRedeemAlert.textContent = 'Minimum 20 SuperCoins required to convert.';
      walletRedeemAlert.style.display = 'block';
    }
    return;
  }

  if (walletRedeemSubmitBtn) {
    walletRedeemSubmitBtn.disabled = true;
    walletRedeemSubmitBtn.textContent = 'Converting...';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/wallet/redeem-coins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ coinsToRedeem: num })
    });
    const result = await res.json();

    if (walletRedeemSubmitBtn) {
      walletRedeemSubmitBtn.disabled = false;
      walletRedeemSubmitBtn.textContent = 'Convert Now';
    }

    if (!res.ok || !result.success) {
      if (walletRedeemAlert) {
        walletRedeemAlert.className = 'wallet-alert alert-error';
        walletRedeemAlert.textContent = result.message || 'Failed to convert coins.';
        walletRedeemAlert.style.display = 'block';
      }
      return;
    }

    userWallet = result.data;
    updateWalletUI();
    renderWalletTransactions(userWallet.transactions || []);

    if (walletRedeemAlert) {
      walletRedeemAlert.className = 'wallet-alert alert-success';
      walletRedeemAlert.textContent = `✓ ${result.message}`;
      walletRedeemAlert.style.display = 'block';
    }
    showToast(`✓ Converted ${num} SuperCoins into Wallet Cash!`);
  } catch (err) {
    if (walletRedeemSubmitBtn) {
      walletRedeemSubmitBtn.disabled = false;
      walletRedeemSubmitBtn.textContent = 'Convert Now';
    }
    if (walletRedeemAlert) {
      walletRedeemAlert.className = 'wallet-alert alert-error';
      walletRedeemAlert.textContent = 'Network error while converting coins.';
      walletRedeemAlert.style.display = 'block';
    }
  }
}

// Attach Wallet Event Listeners
if (navWalletBtn) {
  navWalletBtn.addEventListener('click', openWalletModal);
}
if (navWalletDropdownBtn) {
  navWalletDropdownBtn.addEventListener('click', openWalletModal);
}
if (walletCloseBtn) {
  walletCloseBtn.addEventListener('click', closeWalletModal);
}
if (walletModal) {
  walletModal.addEventListener('click', (e) => {
    if (e.target === walletModal) closeWalletModal();
  });
}
if (walletLoginPromptBtn) {
  walletLoginPromptBtn.addEventListener('click', () => {
    closeWalletModal();
    openAuthModal('login', 'Please log in to access your Nexure Wallet.');
  });
}

// Quick amount buttons open payment gateway
document.querySelectorAll('.btn-wallet-quick').forEach(btn => {
  btn.addEventListener('click', () => {
    const amt = btn.getAttribute('data-amount');
    if (walletTopupInput) walletTopupInput.value = amt;
    openWalletGatewayModal(amt);
  });
});

if (walletTopupSubmitBtn && walletTopupInput) {
  walletTopupSubmitBtn.addEventListener('click', () => {
    openWalletGatewayModal(walletTopupInput.value);
  });
  walletTopupInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      openWalletGatewayModal(walletTopupInput.value);
    }
  });
}

if (walletRedeemSubmitBtn && walletCoinsSelect) {
  walletRedeemSubmitBtn.addEventListener('click', () => {
    handleWalletRedeemCoins(walletCoinsSelect.value);
  });
}

if (checkoutWalletCheckbox) {
  checkoutWalletCheckbox.addEventListener('change', () => {
    const sub = calculateCartSubtotalAmount();
    updateCheckoutWalletCalculation(sub, appliedCoupon ? (appliedCoupon.discountAmount || 0) : 0);
  });
}

// Gateway Modal Listeners
const walletGatewayModal = document.getElementById('wallet-gateway-modal');
const walletGatewayCloseBtn = document.getElementById('wallet-gateway-close-btn');
const gatewayConfirmPayBtn = document.getElementById('gateway-confirm-pay-btn');

if (walletGatewayCloseBtn) {
  walletGatewayCloseBtn.addEventListener('click', closeWalletGatewayModal);
}
if (walletGatewayModal) {
  walletGatewayModal.addEventListener('click', (e) => {
    if (e.target === walletGatewayModal) closeWalletGatewayModal();
  });
}

document.querySelectorAll('.gateway-method-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.gateway-method-tab').forEach(t => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    const method = tab.getAttribute('data-method');
    currentGatewayPaymentMethod = method;

    const pUpi = document.getElementById('gateway-panel-upi');
    const pCard = document.getElementById('gateway-panel-card');
    const pNb = document.getElementById('gateway-panel-netbanking');

    if (pUpi) pUpi.style.display = method === 'UPI' ? 'flex' : 'none';
    if (pCard) pCard.style.display = method === 'CARD' ? 'flex' : 'none';
    if (pNb) pNb.style.display = method === 'NETBANKING' ? 'flex' : 'none';
  });
});

document.querySelectorAll('.upi-app-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.upi-app-btn').forEach(b => b.classList.remove('is-selected'));
    btn.classList.add('is-selected');
    const vpa = btn.getAttribute('data-vpa');
    const upiInput = document.getElementById('gateway-upi-id');
    if (upiInput && vpa) upiInput.value = vpa;
  });
});

if (gatewayConfirmPayBtn) {
  gatewayConfirmPayBtn.addEventListener('click', executeGatewayRecharge);
}


