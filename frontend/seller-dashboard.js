/**
 * MiniStore Merchant Portal — Frontend Application Logic
 * File: frontend/seller-dashboard.js
 */

const API_BASE_URL = 'http://localhost:5000/api';

// Authentication Verification & Route Guard
const token = localStorage.getItem('token');
let currentUser = null;

try {
  currentUser = JSON.parse(localStorage.getItem('user') || 'null');
} catch (e) {
  currentUser = null;
}

const isSeller = Boolean(currentUser && currentUser.role === 'seller');
const isPendingSeller = Boolean(
  isSeller &&
  (!currentUser.sellerDetails || currentUser.sellerDetails.verificationStatus !== 'verified')
);
const isVerifiedSeller = Boolean(
  isSeller &&
  currentUser.sellerDetails &&
  currentUser.sellerDetails.verificationStatus === 'verified'
);
const isAdmin = Boolean(currentUser && currentUser.role === 'admin');

if (!token || !currentUser || (!isSeller && !isAdmin)) {
  alert('Access denied. Merchant Dashboard is restricted to sellers and store administrators.');
  window.location.href = 'index.html';
}

// State
let currentTab = 'overview';
let cachedProducts = [];
let cachedOrders = [];
let currentSellerFilter = '';

// DOM Elements
const sellerHeaderName = document.getElementById('seller-header-name');
const sellerHeroName = document.getElementById('seller-hero-name');
const sellerBusinessNameDisplay = document.getElementById('seller-business-name-display');
const sellerAvatarInitial = document.getElementById('seller-avatar-initial');
const sellerVerifyPill = document.getElementById('seller-verify-pill');
const sellerPendingBanner = document.getElementById('seller-pending-banner');
const adminStoreFilterWrap = document.getElementById('admin-store-filter-wrap');
const adminSellerSelect = document.getElementById('admin-seller-select');
const sellerAlertBox = document.getElementById('seller-alert-box');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeToggleIcon = document.getElementById('theme-toggle-icon');
const sellerLogoutBtn = document.getElementById('seller-logout-btn');
const refreshDashboardBtn = document.getElementById('refresh-dashboard-btn');

// Tabs
const tabButtons = document.querySelectorAll('.seller-tab-btn');
const sections = {
  overview: document.getElementById('section-overview'),
  products: document.getElementById('section-products'),
  orders: document.getElementById('section-orders'),
  earnings: document.getElementById('section-earnings'),
  profile: document.getElementById('section-profile')
};

// Filter Inputs
const productSearchInput = document.getElementById('product-search-input');
const productCategorySelect = document.getElementById('product-category-select');
const productStockSelect = document.getElementById('product-stock-select');

// Modals
const quickEditModal = document.getElementById('quick-edit-modal');
const quickEditForm = document.getElementById('quick-edit-form');
const editProductId = document.getElementById('edit-product-id');
const editProductName = document.getElementById('edit-product-name');
const editProductPrice = document.getElementById('edit-product-price');
const editProductStock = document.getElementById('edit-product-stock');
const closeQuickEditBtn = document.getElementById('close-quick-edit-btn');

const addProductModal = document.getElementById('add-product-modal');
const addProductForm = document.getElementById('add-product-form');
const openAddProductBtn = document.getElementById('open-add-product-btn');
const heroAddProductBtn = document.getElementById('hero-add-product-btn');
const closeAddProductBtn = document.getElementById('close-add-product-btn');

const dispatchModal = document.getElementById('dispatch-modal');
const dispatchForm = document.getElementById('dispatch-form');
const dispatchOrderId = document.getElementById('dispatch-order-id');
const dispatchCarrier = document.getElementById('dispatch-carrier');
const dispatchTrackingNo = document.getElementById('dispatch-tracking-no');
const dispatchNotes = document.getElementById('dispatch-notes');
const closeDispatchBtn = document.getElementById('close-dispatch-btn');

// ============================================================================
// Initialization & Identity Display
// ============================================================================
function initSellerIdentity() {
  const businessName =
    currentUser.sellerDetails?.businessName ||
    currentUser.name ||
    'Merchant';

  const initial = businessName.charAt(0).toUpperCase();

  if (sellerHeaderName) sellerHeaderName.textContent = businessName;
  if (sellerHeroName) {
    if (isAdmin) {
      sellerHeroName.textContent = 'Platform Merchant Overview';
    } else {
      sellerHeroName.textContent = `${businessName} Portal`;
    }
  }
  if (sellerBusinessNameDisplay) {
    if (isAdmin) {
      sellerBusinessNameDisplay.textContent = '• Multi-Store Administration & Oversight';
    } else {
      sellerBusinessNameDisplay.textContent = `• Business PAN: ${currentUser.sellerDetails?.pan || 'Verified'}`;
    }
  }
  if (sellerAvatarInitial) sellerAvatarInitial.textContent = initial;

  if (isAdmin) {
    if (sellerVerifyPill) {
      sellerVerifyPill.textContent = '🛡️ Platform Admin';
      sellerVerifyPill.style.background = 'rgba(239, 68, 68, 0.2)';
      sellerVerifyPill.style.borderColor = '#ef4444';
      sellerVerifyPill.style.color = '#fca5a5';
    }
    if (adminStoreFilterWrap) {
      adminStoreFilterWrap.style.display = 'flex';
      initAdminStoreSelector();
    }
  } else if (isPendingSeller) {
    if (sellerPendingBanner) {
      sellerPendingBanner.style.display = 'block';
    }
    if (sellerVerifyPill) {
      sellerVerifyPill.textContent = '⏳ Verification Pending';
      sellerVerifyPill.style.background = 'rgba(245, 158, 11, 0.2)';
      sellerVerifyPill.style.borderColor = '#f59e0b';
      sellerVerifyPill.style.color = '#f59e0b';
    }
    if (heroAddProductBtn) {
      heroAddProductBtn.style.opacity = '0.6';
      heroAddProductBtn.title = 'Privileges unlock upon verification';
    }
    if (openAddProductBtn) {
      openAddProductBtn.style.opacity = '0.6';
      openAddProductBtn.title = 'Privileges unlock upon verification';
    }
  }

  renderSellerProfile();
}

function renderSellerProfile() {
  const seller = currentUser.sellerDetails || {};
  const status = (seller.verificationStatus || (isSeller ? 'pending' : (isAdmin ? 'verified' : 'pending'))).toLowerCase();

  const nameEl = document.getElementById('profile-business-name');
  const addrEl = document.getElementById('profile-business-address');
  const phoneEl = document.getElementById('profile-contact-number');
  const panEl = document.getElementById('profile-pan');
  const gstinEl = document.getElementById('profile-gstin');
  const statusEl = document.getElementById('profile-verification-status');
  const badgeEl = document.getElementById('profile-status-badge');

  if (nameEl) nameEl.textContent = seller.businessName || currentUser.name || 'Not provided';
  if (addrEl) addrEl.textContent = seller.businessAddress || 'Not provided';
  if (phoneEl) phoneEl.textContent = seller.contactNumber || currentUser.phone || 'Not provided';
  if (panEl) panEl.textContent = seller.pan || 'Not provided';
  if (gstinEl) gstinEl.textContent = seller.gstin || 'Not Applicable';
  if (statusEl) {
    statusEl.textContent = status.toUpperCase();
    statusEl.style.color = status === 'verified' ? '#10b981' : (status === 'rejected' ? '#ef4444' : '#f59e0b');
  }
  if (badgeEl) {
    if (status === 'verified') {
      badgeEl.textContent = '✓ Verified Merchant';
      badgeEl.className = 'status-badge status-delivered';
    } else if (status === 'rejected') {
      badgeEl.textContent = '✕ Application Rejected';
      badgeEl.className = 'status-badge status-cancelled';
    } else {
      badgeEl.textContent = '⏳ Application Under Review';
      badgeEl.className = 'status-badge status-pending';
    }
  }
}

async function initAdminStoreSelector() {
  if (!isAdmin || !adminSellerSelect) return;
  try {
    const res = await sellerFetch('/admin/users?role=seller&limit=100');
    if (!res) return;
    const result = await res.json();
    if (res.ok && result.success && Array.isArray(result.data)) {
      adminSellerSelect.innerHTML = '<option value="" style="color: #0f172a;">🌐 All Stores (Platform Overview)</option>';
      result.data.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s._id || s.id;
        opt.style.color = '#0f172a';
        const bName = s.sellerDetails?.businessName || s.name || s.email;
        const sIcon = s.sellerDetails?.verificationStatus === 'verified' ? '✓' : '⏳';
        opt.textContent = `${sIcon} ${bName} (${s.email})`;
        adminSellerSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Error populating admin store select:', err);
  }

  adminSellerSelect.addEventListener('change', () => {
    currentSellerFilter = adminSellerSelect.value;
    const selectedText = adminSellerSelect.options[adminSellerSelect.selectedIndex]?.text || '';
    if (currentSellerFilter) {
      if (sellerHeroName) sellerHeroName.textContent = `${selectedText.replace(/^[✓⏳]\s*/, '')} (Admin View)`;
    } else {
      if (sellerHeroName) sellerHeroName.textContent = 'Platform Merchant Overview';
    }
    refreshData();
  });
}

// Theme handling
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  }
}

// Alert / Toast helper
function showAlert(message, type = 'success') {
  if (!sellerAlertBox) return;
  sellerAlertBox.textContent = message;
  sellerAlertBox.style.display = 'block';

  if (type === 'error') {
    sellerAlertBox.style.background = 'rgba(239, 68, 68, 0.15)';
    sellerAlertBox.style.color = '#dc2626';
    sellerAlertBox.style.border = '1px solid #ef4444';
  } else {
    sellerAlertBox.style.background = 'rgba(16, 185, 129, 0.15)';
    sellerAlertBox.style.color = '#059669';
    sellerAlertBox.style.border = '1px solid #10b981';
  }

  setTimeout(() => {
    sellerAlertBox.style.display = 'none';
  }, 4500);
}

// Authenticated fetch wrapper
async function sellerFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  if (response.status === 401) {
    alert('Session expired. Please log in again.');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
    return null;
  }

  return response;
}

// ============================================================================
// Data Fetching: Overview & Analytics
// ============================================================================
async function fetchOverview() {
  if (isPendingSeller) {
    document.getElementById('kpi-total-sales').textContent = '₹0.00';
    document.getElementById('kpi-units-sold').textContent = '0';
    document.getElementById('kpi-active-products').textContent = '0';
    document.getElementById('kpi-low-stock').textContent = '0';
    document.getElementById('kpi-pending-orders').textContent = '0';
    document.getElementById('kpi-net-payout').textContent = '₹0.00';
    renderOverviewOrders([]);
    return;
  }

  try {
    const endpoint = currentSellerFilter
      ? `/seller/overview?sellerId=${currentSellerFilter}`
      : '/seller/overview';
    const res = await sellerFetch(endpoint);
    if (!res) return;
    const result = await res.json();

    if (res.ok && result.success) {
      const { metrics, recentOrders } = result.data;

      // Update KPI Cards
      document.getElementById('kpi-total-sales').textContent = `₹${(metrics.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      document.getElementById('kpi-units-sold').textContent = metrics.totalUnitsSold || 0;
      document.getElementById('kpi-active-products').textContent = metrics.activeProducts || 0;
      document.getElementById('kpi-low-stock').textContent = metrics.lowStockCount || 0;
      document.getElementById('kpi-pending-orders').textContent = metrics.pendingOrders || 0;
      document.getElementById('kpi-net-payout').textContent = `₹${(metrics.netPayout || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

      // Update Earnings Tab Cards
      const grossSalesEl = document.getElementById('earnings-gross-sales');
      const platformFeeEl = document.getElementById('earnings-platform-fee');
      const netSettlementEl = document.getElementById('earnings-net-settlement');
      if (grossSalesEl) grossSalesEl.textContent = `₹${(metrics.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      if (platformFeeEl) platformFeeEl.textContent = `₹${(metrics.platformFee || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      if (netSettlementEl) netSettlementEl.textContent = `₹${(metrics.netPayout || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

      // Render Recent Orders Table
      renderOverviewOrders(recentOrders || []);
    } else {
      showAlert(result.message || 'Failed to load metrics', 'error');
    }
  } catch (err) {
    console.error('Error fetching overview:', err);
    showAlert('Error connecting to backend server', 'error');
  }
}

function renderOverviewOrders(orders) {
  const tbody = document.getElementById('overview-orders-tbody');
  if (!tbody) return;

  if (orders.length === 0) {
    const emptyMsg = isPendingSeller
      ? '⏳ Your merchant application is currently under review. Customer orders will appear here once your account is verified.'
      : 'No customer orders placed for your catalog yet.';
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-text-muted); padding: 24px;">${emptyMsg}</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(ord => {
    const dateFormatted = new Date(ord.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const statusClass = `status-${(ord.status || 'pending').toLowerCase()}`;

    return `
      <tr>
        <td style="font-weight: 600; font-family: monospace; color: #2563eb;">#${ord.orderId || ord._id}</td>
        <td>${dateFormatted}</td>
        <td>${ord.customerName || 'Customer'}</td>
        <td><span class="stock-badge stock-in">${ord.sellerItemsCount} items</span></td>
        <td style="font-weight: 700;">₹${(ord.sellerTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td><span class="status-badge ${statusClass}">${ord.status}</span></td>
        <td>${ord.paymentStatus || 'Pending'}</td>
      </tr>
    `;
  }).join('');
}

// ============================================================================
// Data Fetching: My Products
// ============================================================================
async function fetchProducts() {
  if (isPendingSeller) {
    cachedProducts = [];
    renderProductsTable([]);
    return;
  }

  try {
    const query = new URLSearchParams();
    if (productCategorySelect && productCategorySelect.value !== 'All') {
      query.append('category', productCategorySelect.value);
    }
    if (productStockSelect && productStockSelect.value !== 'all') {
      query.append('stockStatus', productStockSelect.value);
    }
    if (productSearchInput && productSearchInput.value.trim()) {
      query.append('search', productSearchInput.value.trim());
    }
    if (currentSellerFilter) {
      query.append('sellerId', currentSellerFilter);
    }

    const res = await sellerFetch(`/seller/products?${query.toString()}`);
    if (!res) return;
    const result = await res.json();

    if (res.ok && result.success) {
      cachedProducts = result.data || [];
      renderProductsTable(cachedProducts);
    } else {
      showAlert(result.message || 'Failed to fetch products', 'error');
    }
  } catch (err) {
    console.error('Error fetching products:', err);
    showAlert('Error loading products catalog', 'error');
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;

  if (products.length === 0) {
    const emptyMsg = isPendingSeller
      ? '⏳ Your merchant application is currently under review by store administrators. Product listing privileges will unlock once your account is verified.'
      : 'No products matching your search filter. List your first product using the button above.';
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-text-muted); padding: 28px;">${emptyMsg}</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    let stockClass = 'stock-in';
    let stockLabel = 'In Stock';
    if (p.stock <= 0) {
      stockClass = 'stock-out';
      stockLabel = 'Out of Stock';
    } else if (p.stock < 5) {
      stockClass = 'stock-low';
      stockLabel = 'Low Stock';
    }

    const imgUrl = (p.images && p.images[0]) || p.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&auto=format&fit=crop&q=80';

    const actionsHtml = isPendingSeller
      ? `<span style="font-size: 0.78rem; color: var(--color-text-muted);">🔒 Under Review</span>`
      : `
        <button class="btn btn-secondary btn-sm" onclick="openQuickEditModal('${p._id}')" style="margin-right: 6px;">
          ✏️ Edit
        </button>
        <button class="btn btn-secondary btn-sm" onclick="deleteProduct('${p._id}', '${encodeURIComponent(p.name)}')" style="color: #ef4444;">
          🗑️
        </button>
      `;

    return `
      <tr>
        <td>
          <img src="${imgUrl}" alt="${p.name}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px; border: 1px solid var(--color-border);" />
        </td>
        <td>
          <div style="font-weight: 600; color: var(--color-text-main);">${p.name || p.title}</div>
          <div style="font-size: 0.76rem; color: var(--color-text-muted); font-family: monospace;">SKU: ${p.sku || 'N/A'}</div>
        </td>
        <td>${p.category}</td>
        <td style="font-weight: 700;">₹${(p.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td>
          <span class="stock-badge ${stockClass}">${p.stock} units (${stockLabel})</span>
        </td>
        <td>
          <span class="status-badge ${p.inStock ? 'status-delivered' : 'status-cancelled'}">
            ${p.inStock ? 'Active' : 'Archived'}
          </span>
        </td>
        <td style="text-align: right;">
          ${actionsHtml}
        </td>
      </tr>
    `;
  }).join('');
}

// Quick Edit Modal
window.openQuickEditModal = function(productId) {
  if (isPendingSeller) {
    showAlert('Product editing privileges are restricted while verification is pending.', 'error');
    return;
  }
  const prod = cachedProducts.find(p => p._id === productId);
  if (!prod) return;

  editProductId.value = prod._id;
  editProductName.value = prod.name || prod.title;
  editProductPrice.value = prod.price;
  editProductStock.value = prod.stock;

  const editVariantsEl = document.getElementById('edit-product-variants');
  if (editVariantsEl) {
    editVariantsEl.value = Array.isArray(prod.variants) && prod.variants.length > 0
      ? JSON.stringify(prod.variants, null, 2)
      : '';
  }

  quickEditModal.style.display = 'flex';
};

function closeQuickEdit() {
  quickEditModal.style.display = 'none';
  quickEditForm.reset();
}

if (closeQuickEditBtn) closeQuickEditBtn.addEventListener('click', closeQuickEdit);

if (quickEditForm) {
  quickEditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isPendingSeller) {
      showAlert('Product editing privileges are restricted while verification is pending.', 'error');
      return;
    }
    const id = editProductId.value;
    const name = editProductName.value.trim();
    const price = parseFloat(editProductPrice.value);
    const stock = parseInt(editProductStock.value, 10);

    const editVariantsEl = document.getElementById('edit-product-variants');
    let variants = undefined;
    if (editVariantsEl && editVariantsEl.value.trim()) {
      try {
        variants = JSON.parse(editVariantsEl.value.trim());
      } catch (err) {
        showAlert('Invalid JSON format for product variants', 'error');
        return;
      }
    }

    try {
      const payload = { name, price, stock };
      if (variants !== undefined) payload.variants = variants;

      const res = await sellerFetch(`/seller/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (res.ok && result.success) {
        showAlert('Product inventory updated successfully!');
        closeQuickEdit();
        fetchProducts();
        fetchOverview();
      } else {
        showAlert(result.message || 'Failed to update product', 'error');
      }
    } catch (err) {
      showAlert('Error updating product', 'error');
    }
  });
}

// Delete Product
window.deleteProduct = async function(productId, encodedName) {
  if (isPendingSeller) {
    showAlert('Product deletion is restricted while verification is pending.', 'error');
    return;
  }
  const name = decodeURIComponent(encodedName);
  if (!confirm(`Are you sure you want to remove "${name}" from your catalog?`)) {
    return;
  }

  try {
    const res = await sellerFetch(`/seller/products/${productId}`, {
      method: 'DELETE'
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showAlert('Product removed successfully from catalog');
      fetchProducts();
      fetchOverview();
    } else {
      showAlert(result.message || 'Failed to delete product', 'error');
    }
  } catch (err) {
    showAlert('Error deleting product', 'error');
  }
};

// Add New Product
function openAddProduct() {
  if (isPendingSeller) {
    showAlert('Your merchant application is currently under review by store administrators. Product listing and dispatch privileges will unlock upon verification.', 'error');
    return;
  }
  addProductForm.reset();
  addProductModal.style.display = 'flex';
}

function closeAddProduct() {
  addProductModal.style.display = 'none';
  addProductForm.reset();
}

if (openAddProductBtn) openAddProductBtn.addEventListener('click', openAddProduct);
if (heroAddProductBtn) heroAddProductBtn.addEventListener('click', openAddProduct);
if (closeAddProductBtn) closeAddProductBtn.addEventListener('click', closeAddProduct);

if (addProductForm) {
  addProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('add-product-name').value.trim();
    const category = document.getElementById('add-product-category').value;
    const brand = document.getElementById('add-product-brand').value.trim();
    const price = parseFloat(document.getElementById('add-product-price').value);
    const stock = parseInt(document.getElementById('add-product-stock').value, 10);
    const image = document.getElementById('add-product-image').value.trim();
    const description = document.getElementById('add-product-description').value.trim();
    const variantsRaw = document.getElementById('add-product-variants')?.value.trim();
    let variants = undefined;
    if (variantsRaw) {
      try {
        variants = JSON.parse(variantsRaw);
      } catch (err) {
        showAlert('Invalid JSON format for product variants', 'error');
        return;
      }
    }

    try {
      const payload = {
        name,
        category,
        brand,
        price,
        stock,
        image,
        description
      };
      if (variants !== undefined) payload.variants = variants;

      const res = await sellerFetch('/seller/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (res.ok && result.success) {
        showAlert('New product listed successfully!');
        closeAddProduct();
        fetchProducts();
        fetchOverview();
      } else {
        showAlert(result.message || 'Failed to list product', 'error');
      }
    } catch (err) {
      showAlert('Error listing product', 'error');
    }
  });
}

// ============================================================================
// Data Fetching: Order Fulfillment
// ============================================================================
async function fetchOrders() {
  if (isPendingSeller) {
    cachedOrders = [];
    renderOrdersTable([]);
    renderEarningsLedger([]);
    return;
  }

  try {
    const endpoint = currentSellerFilter
      ? `/seller/orders?sellerId=${currentSellerFilter}`
      : '/seller/orders';
    const res = await sellerFetch(endpoint);
    if (!res) return;
    const result = await res.json();

    if (res.ok && result.success) {
      cachedOrders = result.data || [];
      renderOrdersTable(cachedOrders);
      renderEarningsLedger(cachedOrders);
    } else {
      showAlert(result.message || 'Failed to load merchant orders', 'error');
    }
  } catch (err) {
    console.error('Error fetching orders:', err);
    showAlert('Error loading fulfillment orders', 'error');
  }
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;

  if (orders.length === 0) {
    const emptyMsg = isPendingSeller
      ? '⏳ Your merchant application is currently under review by store administrators. Incoming customer orders will appear here once verified.'
      : 'No customer orders placed for your products yet.';
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-text-muted); padding: 24px;">${emptyMsg}</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(ord => {
    const dateFormatted = new Date(ord.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const addr = ord.shippingAddress || {};
    const addrText = `${addr.fullName || 'Customer'}<br><span style="font-size: 0.78rem; color: var(--color-text-muted);">${addr.addressLine1 || ''}, ${addr.city || ''} ${addr.postalCode || ''}</span>`;

    const itemsSummary = (ord.items || []).map(it => `
      <div style="font-size: 0.82rem; margin-bottom: 2px;">
        <strong>${it.quantity}x</strong> ${it.name || 'Product'} (₹${((it.price || 0) * (it.quantity || 1)).toFixed(2)})
      </div>
    `).join('');

    const statusClass = `status-${(ord.status || 'pending').toLowerCase()}`;
    const canDispatch = !isPendingSeller && (ord.status === 'Pending' || ord.status === 'Processing');

    return `
      <tr>
        <td>
          <div style="font-weight: 600; font-family: monospace; color: #2563eb;">#${ord.orderId || ord._id}</div>
          <div style="font-size: 0.74rem; color: var(--color-text-muted);">${ord.paymentMethod} • ${ord.paymentStatus}</div>
        </td>
        <td style="font-size: 0.82rem;">${dateFormatted}</td>
        <td>${addrText}</td>
        <td>${itemsSummary}</td>
        <td style="font-weight: 700;">₹${(ord.sellerTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td><span class="status-badge ${statusClass}">${ord.status}</span></td>
        <td style="text-align: right;">
          ${canDispatch ? `
            <button class="btn btn-primary btn-sm" onclick="openDispatchModal('${ord._id}', '${ord.tracking?.carrier || ''}')">
              🚚 Dispatch
            </button>
          ` : `
            <span style="font-size: 0.8rem; color: var(--color-text-muted);">
              ${ord.tracking?.trackingNumber ? `AWB: ${ord.tracking.trackingNumber}` : (isPendingSeller ? '🔒 Under Review' : 'Completed')}
            </span>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

// Dispatch Modal
window.openDispatchModal = function(orderId, existingCarrier) {
  if (isPendingSeller) {
    showAlert('Order dispatching is restricted while your merchant application is under review.', 'error');
    return;
  }
  dispatchOrderId.value = orderId;
  if (existingCarrier) dispatchCarrier.value = existingCarrier;
  dispatchTrackingNo.value = `MS-TRK-${Math.floor(100000 + Math.random() * 900000)}`;
  dispatchModal.style.display = 'flex';
};

function closeDispatch() {
  dispatchModal.style.display = 'none';
  dispatchForm.reset();
}

if (closeDispatchBtn) closeDispatchBtn.addEventListener('click', closeDispatch);

if (dispatchForm) {
  dispatchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = dispatchOrderId.value;
    const carrier = dispatchCarrier.value;
    const trackingNumber = dispatchTrackingNo.value.trim();
    const notes = dispatchNotes.value.trim();

    try {
      const res = await sellerFetch(`/seller/orders/${id}/dispatch`, {
        method: 'PUT',
        body: JSON.stringify({ carrier, trackingNumber, notes })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        showAlert('Order marked as dispatched! Notification email sent to customer.');
        closeDispatch();
        fetchOrders();
        fetchOverview();
      } else {
        showAlert(result.message || 'Failed to dispatch order', 'error');
      }
    } catch (err) {
      showAlert('Error updating dispatch status', 'error');
    }
  });
}

// ============================================================================
// Data Fetching: Earnings & Settlement Ledger
// ============================================================================
function renderEarningsLedger(orders) {
  const tbody = document.getElementById('earnings-tbody');
  if (!tbody) return;

  const validOrders = orders.filter(o => o.status !== 'Cancelled');
  if (validOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-text-muted); padding: 24px;">No settled orders available in settlement ledger.</td></tr>`;
    return;
  }

  tbody.innerHTML = validOrders.map(ord => {
    const gross = ord.sellerTotal || 0;
    const fee = Math.round(gross * 0.1 * 100) / 100;
    const net = Math.round((gross - fee) * 100) / 100;
    const dateStr = new Date(ord.createdAt).toLocaleDateString('en-IN');

    return `
      <tr>
        <td style="font-family: monospace; font-weight: 600;">#${ord.orderId || ord._id}</td>
        <td>${dateStr}</td>
        <td style="font-weight: 600;">₹${gross.toFixed(2)}</td>
        <td style="color: #ef4444;">-₹${fee.toFixed(2)}</td>
        <td style="font-weight: 700; color: #10b981;">₹${net.toFixed(2)}</td>
        <td><span class="stock-badge stock-in">${ord.paymentStatus || 'Paid'}</span></td>
      </tr>
    `;
  }).join('');
}

// ============================================================================
// Tab Switcher
// ============================================================================
function switchTab(targetTab) {
  currentTab = targetTab;

  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === targetTab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  Object.keys(sections).forEach(key => {
    if (sections[key]) {
      sections[key].style.display = key === targetTab ? 'block' : 'none';
    }
  });

  if (targetTab === 'overview') fetchOverview();
  if (targetTab === 'products') fetchProducts();
  if (targetTab === 'orders') fetchOrders();
  if (targetTab === 'earnings') fetchOrders();
  if (targetTab === 'profile') renderSellerProfile();
}

function refreshData() {
  if (currentTab === 'overview') fetchOverview();
  else if (currentTab === 'products') fetchProducts();
  else if (currentTab === 'orders') fetchOrders();
  else if (currentTab === 'earnings') fetchOrders();
  else if (currentTab === 'profile') renderSellerProfile();
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.getAttribute('data-tab');
    switchTab(tab);
  });
});

const viewAllOrdersBtn = document.getElementById('view-all-orders-btn');
if (viewAllOrdersBtn) {
  viewAllOrdersBtn.addEventListener('click', () => switchTab('orders'));
}

// Search & Filter Listeners
if (productSearchInput) {
  let debounceTimer;
  productSearchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchProducts, 300);
  });
}
if (productCategorySelect) productCategorySelect.addEventListener('change', fetchProducts);
if (productStockSelect) productStockSelect.addEventListener('change', fetchProducts);

// Refresh & Logout
if (refreshDashboardBtn) {
  refreshDashboardBtn.addEventListener('click', () => {
    fetchOverview();
    fetchProducts();
    fetchOrders();
    renderSellerProfile();
    showAlert('Dashboard metrics refreshed!');
  });
}

if (sellerLogoutBtn) {
  sellerLogoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  });
}

// Global Escape closes modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeQuickEdit();
    closeAddProduct();
    closeDispatch();
  }
});

// ============================================================================
// Theme Management (Light / Dark Mode)
// ============================================================================
function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

function updateThemeToggleUI(theme) {
  if (themeToggleIcon) {
    themeToggleIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
  if (themeToggleBtn) {
    themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    themeToggleBtn.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
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

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', toggleTheme);
}

// Boot
initTheme();
initSellerIdentity();
fetchOverview();
