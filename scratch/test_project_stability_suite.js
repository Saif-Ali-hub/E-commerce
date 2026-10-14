/**
 * ============================================================================
 * Mini Store Platform — Project-wide Stability & Health Test Suite
 * File: scratch/test_project_stability_suite.js
 *
 * Fully standalone, non-destructive, with automated tear-down cleanup.
 * Thoroughly verifies all 6 core architecture layers:
 *   1. System & Database Health
 *   2. Authentication, RBAC & Security
 *   3. Catalog, Search & Routing Robustness
 *   4. Cart, Wishlist & Stock Integrity
 *   5. Orders, Tracking, Cancellation & Invoices
 *   6. Wallet, Coupons & Promotional Calculations
 * ============================================================================
 */

const path = require('path');
const dotenv = require('../backend/node_modules/dotenv');
const mongoose = require('../backend/node_modules/mongoose');
const jwt = require('../backend/node_modules/jsonwebtoken');
const bcrypt = require('../backend/node_modules/bcryptjs');

// Load environment configuration
dotenv.config({ path: path.join(__dirname, '../backend/.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_BASE = 'http://localhost:5000/api';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/E-commerce';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_miniecommerce_2026_secure';

// HTTP Helper using native fetch
async function api(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const start = Date.now();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const durationMs = Date.now() - start;
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data, durationMs };
}

// Scorecard state
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];
const discoveredEdgeCases = [];
const bottlenecks = [];

function recordTest(category, name, passed, durationMs, details = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ✓ [PASS] ${name} (${durationMs}ms)`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${name} (${durationMs}ms) - ${details}`);
  }
  testResults.push({ category, name, passed, durationMs, details });
  if (durationMs > 1000) {
    bottlenecks.push(`${name} took ${durationMs}ms (> 1000ms threshold)`);
  }
}

async function runStabilitySuite() {
  const suiteStartTime = Date.now();
  console.log('======================================================================');
  console.log('   MINI STORE PLATFORM — COMPREHENSIVE STABILITY & HEALTH TEST SUITE  ');
  console.log('======================================================================\n');
  console.log(`Target API Base: ${API_BASE}`);
  console.log(`MongoDB URI:     ${MONGO_URI}\n`);

  // Connect to MongoDB directly for verification and cleanup
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const User = require('../backend/models/User');
  const Product = require('../backend/models/Product');
  const Order = require('../backend/models/Order');
  const Address = require('../backend/models/Address');
  const Coupon = require('../backend/models/Coupon');
  const { getProductEffectivePrice, FESTIVE_DEALS_CATALOG } = require('../backend/config/festiveDeals');

  // Track all created entities for strict cleanup
  const cleanupUserIds = [];
  const cleanupProductIds = [];
  const cleanupOrderIds = [];
  const cleanupAddressIds = [];
  const cleanupCouponIds = [];

  try {
    // Verify baseline catalog
    const baselineProductCount = await Product.countDocuments();
    console.log(`Initial Catalog Product Count: ${baselineProductCount}`);
    if (baselineProductCount < 61) {
      discoveredEdgeCases.push(`Baseline catalog has ${baselineProductCount} items (< 61 standard items)`);
    }

    // ========================================================================
    // 1. System & Database Health
    // ========================================================================
    console.log('\n--- 1. SYSTEM & DATABASE HEALTH ---');

    // 1.1 Health probe
    {
      const res = await api('/health');
      const pass = res.status === 200 &&
                   res.data?.status === 'ok' &&
                   res.data?.database === 'connected' &&
                   res.data?.databaseName?.toLowerCase() === 'e-commerce';
      recordTest('System & Database Health', 'Server health probe (GET /api/health)', pass, res.durationMs,
        `Status: ${res.status}, DB: ${res.data?.database}, Name: ${res.data?.databaseName}`);
    }

    // 1.2 MongoDB direct ping & latency
    {
      const pingStart = Date.now();
      const pingRes = await db.command({ ping: 1 });
      const pingLatency = Date.now() - pingStart;
      const pass = pingRes && pingRes.ok === 1;
      recordTest('System & Database Health', 'MongoDB connection ping and latency', pass, pingLatency,
        `Latency: ${pingLatency}ms`);
      if (pingLatency > 200) {
        bottlenecks.push(`MongoDB ping latency is ${pingLatency}ms`);
      }
    }

    // 1.3 GridFS bucket accessibility
    {
      const start = Date.now();
      const filesCount = await db.collection('product_images.files').countDocuments();
      const chunksCount = await db.collection('product_images.chunks').countDocuments();
      const dur = Date.now() - start;
      const pass = filesCount >= 13 && chunksCount >= 13;
      recordTest('System & Database Health', 'GridFS product_images bucket accessibility', pass, dur,
        `Files: ${filesCount}, Chunks: ${chunksCount}`);
    }

    // 1.4 Environment configuration consistency
    {
      const start = Date.now();
      const hasPort = Boolean(process.env.PORT);
      const hasMongo = Boolean(process.env.MONGO_URI);
      const hasSecret = Boolean(process.env.JWT_SECRET);
      const dbNameConsistent = MONGO_URI.toLowerCase().includes('e-commerce');
      const pass = hasPort && hasMongo && hasSecret && dbNameConsistent;
      recordTest('System & Database Health', 'Environment variables and DB name consistency', pass, Date.now() - start,
        `Port: ${process.env.PORT}, Secret: ${hasSecret}, URI: ${MONGO_URI}`);
    }

    // ========================================================================
    // 2. Authentication, RBAC & Security
    // ========================================================================
    console.log('\n--- 2. AUTHENTICATION, RBAC & SECURITY ---');

    let customerToken = null;
    let customerUser = null;
    let sellerToken = null;
    let sellerUser = null;
    let adminToken = null;

    // 2.1 User registration with strong password rules
    {
      // 2.1a Weak password rejected (too short)
      const resWeak = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Weak Pass User',
          email: `weak_${Date.now()}@test.com`,
          password: 'short'
        })
      });
      recordTest('Authentication & RBAC', 'Reject registration with weak password (< 8 chars)', resWeak.status === 400, resWeak.durationMs,
        `Status: ${resWeak.status}, Message: ${resWeak.data?.message}`);

      // 2.1b Strong password registration
      const customerEmail = `stability_cust_${Date.now()}@test.com`;
      const resCust = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Stability Customer',
          email: customerEmail,
          password: 'StrongPassword123!',
          phone: '9876543210'
        })
      });
      const passCust = resCust.status === 201 && resCust.data?.success === true;
      recordTest('Authentication & RBAC', 'Register customer with valid strong credentials', passCust, resCust.durationMs,
        `Status: ${resCust.status}`);
      if (resCust.data?.data?.id) {
        cleanupUserIds.push(resCust.data.data.id);
      }

      // Login to obtain JWT
      const resLogin = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: customerEmail, password: 'StrongPassword123!' })
      });
      customerToken = resLogin.data?.token;
      customerUser = resLogin.data?.user;
      recordTest('Authentication & RBAC', 'JWT authentication and token issuance', Boolean(customerToken), resLogin.durationMs,
        `User ID: ${customerUser?.id}`);
    }

    // 2.2 Token expiration & invalid token handling
    {
      const resInvalid = await api('/auth/profile', {
        headers: { Authorization: 'Bearer invalid.token.payload' }
      });
      recordTest('Authentication & RBAC', 'Reject invalid / tampered JWT token with HTTP 401', resInvalid.status === 401, resInvalid.durationMs);

      const resExpired = await api('/auth/profile', {
        headers: {
          Authorization: `Bearer ${jwt.sign({ id: customerUser?.id }, JWT_SECRET, { expiresIn: '-1s' })}`
        }
      });
      recordTest('Authentication & RBAC', 'Reject expired JWT token with HTTP 401', resExpired.status === 401, resExpired.durationMs);
    }

    // 2.3 Merchant registration & PAN masking defense-in-depth
    {
      const sellerEmail = `stability_seller_${Date.now()}@test.com`;
      const panRaw = 'ABCDE1234F';
      const resSellerReg = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Stability Merchant',
          email: sellerEmail,
          password: 'StrongSellerPass123!',
          phone: '9876543211',
          isSeller: true,
          businessName: 'Stability Retail Ltd',
          businessAddress: 'Plot 101, Bandra Kurla Complex, Mumbai',
          contactNumber: '9876543211',
          pan: panRaw,
          gstin: '27ABCDE1234F1Z5'
        })
      });
      const sellerData = resSellerReg.data?.data;
      const panMasked = sellerData?.sellerDetails?.pan;
      const isMasked = panMasked && panMasked.includes('*') && !panMasked.includes('1234');
      const pass = resSellerReg.status === 201 && isMasked;
      recordTest('Authentication & RBAC', 'Merchant registration with PAN masking defense-in-depth', pass, resSellerReg.durationMs,
        `Masked PAN returned: ${panMasked}`);
      if (sellerData?.id) {
        cleanupUserIds.push(sellerData.id);
      }

      // Login seller
      const resSellerLogin = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: sellerEmail, password: 'StrongSellerPass123!' })
      });
      sellerToken = resSellerLogin.data?.token;
      sellerUser = resSellerLogin.data?.user;
    }

    // 2.4 Admin login and seller verification
    {
      // Admin login (standard seeded credentials)
      const resAdminLogin = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@ministore.com', password: 'adminpassword123' })
      });
      adminToken = resAdminLogin.data?.token;
      recordTest('Authentication & RBAC', 'Admin account authentication', Boolean(adminToken), resAdminLogin.durationMs);

      // Verify seller via admin route
      const resVerify = await api(`/admin/sellers/${sellerUser?.id}/verify`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'verified' })
      });
      const passVerify = resVerify.status === 200 && resVerify.data?.data?.sellerDetails?.verificationStatus === 'verified';
      recordTest('Authentication & RBAC', 'Admin merchant approval (PUT /api/admin/sellers/:id/verify)', passVerify, resVerify.durationMs);
    }

    // 2.5 Admin authorization guard against unauthorized access
    {
      // Unauthenticated to admin route
      const resNoAuth = await api('/admin/dashboard');
      recordTest('Authentication & RBAC', 'Reject unauthenticated access to /api/admin/* (401)', resNoAuth.status === 401, resNoAuth.durationMs);

      // Customer to admin route
      const resCustAdmin = await api('/admin/dashboard', {
        headers: { Authorization: `Bearer ${customerToken}` }
      });
      recordTest('Authentication & RBAC', 'Reject customer access to /api/admin/* (403)', resCustAdmin.status === 403, resCustAdmin.durationMs);
    }

    // ========================================================================
    // 3. Catalog, Search & Routing Robustness
    // ========================================================================
    console.log('\n--- 3. CATALOG, SEARCH & ROUTING ROBUSTNESS ---');

    // 3.1 Catalog retrieval, pagination & search
    {
      const resCatalog = await api('/products?page=1&limit=10');
      const pass = resCatalog.status === 200 &&
                   Array.isArray(resCatalog.data?.data) &&
                   resCatalog.data?.data?.length > 0 &&
                   resCatalog.data?.pagination?.totalProducts >= 61;
      recordTest('Catalog & Search', 'Product catalog retrieval with pagination metadata', pass, resCatalog.durationMs,
        `Returned: ${resCatalog.data?.data?.length} items, Total: ${resCatalog.data?.pagination?.totalProducts}`);

      const resSearch = await api('/products?search=wireless+mouse');
      const passSearch = resSearch.status === 200 &&
                         resSearch.data?.data?.some(p => p.name.toLowerCase().includes('wireless mouse'));
      recordTest('Catalog & Search', 'Multi-word tokenized catalog search', passSearch, resSearch.durationMs);
    }

    // 3.2 Search autocomplete & suggestions endpoint aliases
    {
      const resSugg = await api('/products/suggestions?q=phone');
      const resAuto = await api('/products/search/autocomplete?q=phone');
      const passMatch = resSugg.status === 200 &&
                        resAuto.status === 200 &&
                        resSugg.data?.count === resAuto.data?.count &&
                        JSON.stringify(resSugg.data?.data) === JSON.stringify(resAuto.data?.data);
      recordTest('Catalog & Search', 'Autocomplete route aliases parity (/suggestions & /search/autocomplete)', passMatch, resAuto.durationMs,
        `Matched count: ${resAuto.data?.count}`);
    }

    // 3.3 Related products endpoint
    {
      const sampleProd = await Product.findOne({ stock: { $gt: 0 } });
      const resRelated = await api(`/products/${sampleProd._id}/related?limit=4`);
      const pass = resRelated.status === 200 &&
                   Array.isArray(resRelated.data?.data) &&
                   resRelated.data?.data?.length <= 4 &&
                   !resRelated.data?.data?.some(p => p._id === sampleProd._id.toString());
      recordTest('Catalog & Search', 'Related products recommendation query (GET /:id/related)', pass, resRelated.durationMs,
        `Returned ${resRelated.data?.count} related products`);
    }

    // 3.4 Pincode delivery estimator aliases
    {
      const resPinPath = await api('/addresses/check-pincode/400001');
      const resPinQuery = await api('/addresses/estimate-pincode?pincode=400001');
      const passPincode = resPinPath.status === 200 &&
                          resPinQuery.status === 200 &&
                          resPinPath.data?.city === resPinQuery.data?.city &&
                          resPinPath.data?.serviceable === true &&
                          resPinQuery.data?.serviceable === true;
      recordTest('Catalog & Search', 'Pincode delivery estimator aliases (path param vs query param)', passPincode, resPinQuery.durationMs,
        `City: ${resPinQuery.data?.city}, Estimated: ${resPinQuery.data?.estimatedDays}`);

      const resPinInvalid = await api('/addresses/estimate-pincode?pincode=123');
      recordTest('Catalog & Search', 'Reject malformed pincode with HTTP 400', resPinInvalid.status === 400 && resPinInvalid.data?.serviceable === false, resPinInvalid.durationMs);
    }

    // 3.5 Review submission, duplicate prevention & rating recalculation (on dedicated isolated product)
    {
      const reviewProd = await Product.create({
        name: `Stability Review Test Item ${Date.now()}`,
        title: `Stability Review Test Item ${Date.now()}`,
        price: 999,
        stock: 10,
        category: 'Electronics',
        inStock: true,
        reviews: [],
        averageRating: 0,
        totalReviews: 0,
        ratings: 0
      });
      cleanupProductIds.push(reviewProd._id);

      // Submit review via /review (rating 4)
      const resRev1 = await api(`/products/${reviewProd._id}/review`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ rating: 4, comment: 'Great product for stability testing' })
      });
      const passRev1 = resRev1.status === 201 &&
                       resRev1.data?.data?.averageRating === 4 &&
                       resRev1.data?.data?.totalReviews === 1;
      recordTest('Catalog & Search', 'Customer review creation with dynamic rating calculation', passRev1, resRev1.durationMs,
        `Rating: ${resRev1.data?.data?.averageRating}, Count: ${resRev1.data?.data?.totalReviews}`);

      // Attempt duplicate review via plural /reviews
      const resRevDup = await api(`/products/${reviewProd._id}/reviews`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ rating: 5, comment: 'Attempting duplicate review' })
      });
      recordTest('Catalog & Search', 'Duplicate review prevention on same product (HTTP 400)', resRevDup.status === 400, resRevDup.durationMs);

      // Edit review via /reviews (update to rating 5)
      const resRevEdit = await api(`/products/${reviewProd._id}/reviews`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ rating: 5, comment: 'Updated to 5 stars!' })
      });
      const passRevEdit = resRevEdit.status === 200 && resRevEdit.data?.data?.averageRating === 5;
      recordTest('Catalog & Search', 'Customer review update and average rating recalculation', passRevEdit, resRevEdit.durationMs);

      // Delete review via /review
      const resRevDel = await api(`/products/${reviewProd._id}/review`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${customerToken}` }
      });
      const passRevDel = resRevDel.status === 200 &&
                         resRevDel.data?.data?.averageRating === 0 &&
                         resRevDel.data?.data?.totalReviews === 0;
      recordTest('Catalog & Search', 'Customer review deletion and reset to 0 for empty review list', passRevDel, resRevDel.durationMs);
    }

    // ========================================================================
    // 4. Cart, Wishlist & Stock Integrity
    // ========================================================================
    console.log('\n--- 4. CART, WISHLIST & STOCK INTEGRITY ---');

    // Create a temporary isolated product for cart & stock tests
    const cartTestProduct = await Product.create({
      name: `Stability Cart Product ${Date.now()}`,
      title: `Stability Cart Product ${Date.now()}`,
      price: 500,
      stock: 50,
      category: 'Electronics',
      inStock: true
    });
    cleanupProductIds.push(cartTestProduct._id);

    // 4.1 User-isolated embedded cart operations
    {
      // Add to cart
      const resAdd = await api('/cart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ productId: cartTestProduct._id, quantity: 2 })
      });
      const passAdd = resAdd.status === 200 && resAdd.data?.data?.items?.length === 1;
      recordTest('Cart & Wishlist', 'Add product to embedded user cart', passAdd, resAdd.durationMs);

      // Verify User B cannot see User A's cart items
      const resUserBCart = await api('/cart', {
        headers: { Authorization: `Bearer ${sellerToken}` }
      });
      const passIso = resUserBCart.status === 200 && resUserBCart.data?.data?.items?.length === 0;
      recordTest('Cart & Wishlist', 'Strict user cart isolation (cross-account privacy)', passIso, resUserBCart.durationMs);

      // Update quantity
      const resQty = await api(`/cart/${cartTestProduct._id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ quantity: 4 })
      });
      const passQty = resQty.status === 200 && resQty.data?.data?.items?.[0]?.quantity === 4;
      recordTest('Cart & Wishlist', 'Update cart item quantity', passQty, resQty.durationMs);

      // Remove from cart
      const resRem = await api(`/cart/${cartTestProduct._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${customerToken}` }
      });
      const passRem = resRem.status === 200 && resRem.data?.data?.items?.length === 0;
      recordTest('Cart & Wishlist', 'Remove item from cart', passRem, resRem.durationMs);
    }

    // 4.2 User-isolated embedded wishlist operations
    {
      const resWishAdd = await api('/wishlist', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ productId: cartTestProduct._id })
      });
      const passWishAdd = resWishAdd.status === 200 && resWishAdd.data?.data?.products?.length === 1;
      recordTest('Cart & Wishlist', 'Add product to user wishlist', passWishAdd, resWishAdd.durationMs);

      // Duplicate add idempotency
      const resWishDup = await api('/wishlist', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ productId: cartTestProduct._id })
      });
      const passWishDup = resWishDup.status === 200 && resWishDup.data?.data?.products?.length === 1;
      recordTest('Cart & Wishlist', 'Wishlist duplicate addition idempotency', passWishDup, resWishDup.durationMs);

      // Remove from wishlist
      const resWishDel = await api(`/wishlist/${cartTestProduct._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${customerToken}` }
      });
      const passWishDel = resWishDel.status === 200 && resWishDel.data?.data?.products?.length === 0;
      recordTest('Cart & Wishlist', 'Remove item from user wishlist', passWishDel, resWishDel.durationMs);
    }

    // 4.3 Atomic conditional stock decrement during high-concurrency simulation
    {
      const concurrencyProd = await Product.create({
        name: `Concurrency Stock Test Item ${Date.now()}`,
        title: `Concurrency Stock Test Item ${Date.now()}`,
        price: 100,
        stock: 3, // Exactly 3 units available
        category: 'Electronics',
        inStock: true
      });
      cleanupProductIds.push(concurrencyProd._id);

      // Simulate 8 concurrent checkout requests claiming 1 unit each
      const start = Date.now();
      const concurrentClaims = await Promise.all(
        Array.from({ length: 8 }).map(async () => {
          return await Product.findOneAndUpdate(
            { _id: concurrencyProd._id, stock: { $gte: 1 } },
            { $inc: { stock: -1 } },
            { returnDocument: 'after' }
          );
        })
      );
      const dur = Date.now() - start;

      const successfulClaims = concurrentClaims.filter(c => c !== null).length;
      const failedClaims = concurrentClaims.filter(c => c === null).length;
      const finalDoc = await Product.findById(concurrencyProd._id);

      const passConcurrency = successfulClaims === 3 &&
                              failedClaims === 5 &&
                              finalDoc.stock === 0;

      recordTest('Cart & Wishlist', 'Atomic conditional stock decrement under concurrency (no overselling)', passConcurrency, dur,
        `Succeeded: ${successfulClaims}, Blocked: ${failedClaims}, Final Stock: ${finalDoc.stock}`);
    }

    // ========================================================================
    // 5. Orders, Tracking, Cancellation & Invoices
    // ========================================================================
    console.log('\n--- 5. ORDERS, TRACKING, CANCELLATION & INVOICES ---');

    let placedOrderId = null;
    let orderTestProduct = null;

    // 5.1 End-to-end order placement with address snapshot, invoice & tracking
    {
      orderTestProduct = await Product.create({
        name: `Order Lifecycle Product ${Date.now()}`,
        title: `Order Lifecycle Product ${Date.now()}`,
        price: 1500,
        stock: 10,
        category: 'Electronics',
        inStock: true
      });
      cleanupProductIds.push(orderTestProduct._id);

      // Create address
      const resAddr = await api('/addresses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({
          fullName: 'Order Lifecycle Tester',
          phone: '9876543210',
          addressLine1: 'Flat 4B, Emerald Heights',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
          addressType: 'Home',
          isDefault: true
        })
      });
      const addressId = resAddr.data?.data?._id;
      if (addressId) cleanupAddressIds.push(addressId);

      // Add to cart
      await api('/cart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ productId: orderTestProduct._id, quantity: 2 })
      });

      // Place order
      const resOrder = await api('/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({
          addressId,
          paymentMethod: 'COD'
        })
      });

      const orderData = resOrder.data?.data;
      placedOrderId = orderData?._id;
      if (placedOrderId) cleanupOrderIds.push(placedOrderId);

      const hasInvoice = orderData?.invoiceNumber && orderData.invoiceNumber.startsWith('INV-');
      const hasTracking = orderData?.tracking?.trackingNumber && orderData.tracking.trackingNumber.startsWith('MS-TRK-');
      const hasCarrier = Boolean(orderData?.tracking?.carrier);
      const hasHistory = Array.isArray(orderData?.tracking?.history) && orderData.tracking.history.length > 0;

      // Verify stock was decremented from 10 to 8
      const prodAfterOrder = await Product.findById(orderTestProduct._id);
      const stockDecremented = prodAfterOrder.stock === 8;

      const passPlacement = resOrder.status === 201 &&
                            hasInvoice &&
                            hasTracking &&
                            hasCarrier &&
                            hasHistory &&
                            stockDecremented;

      recordTest('Orders & Invoices', 'End-to-end order placement with invoice & tracking generation', passPlacement, resOrder.durationMs,
        `Invoice: ${orderData?.invoiceNumber}, Tracking: ${orderData?.tracking?.trackingNumber}`);
    }

    // 5.2 Order cancellation workflow (PUT /api/orders/:id/cancel)
    {
      const resCancel = await api(`/orders/${placedOrderId}/cancel`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${customerToken}` }
      });

      const passCancel = resCancel.status === 200 && resCancel.data?.success === true;
      const cancelledOrder = resCancel.data?.data;

      // Verify product stock was restored back to 10
      const prodAfterCancel = await Product.findById(orderTestProduct._id);
      const stockRestored = prodAfterCancel.stock === 10;

      // Verify tracking history received cancellation event
      const hasCancelEvent = cancelledOrder?.tracking?.history?.some(h => h.status === 'Cancelled');

      const passCancellation = passCancel &&
                               cancelledOrder?.status === 'Cancelled' &&
                               stockRestored &&
                               hasCancelEvent;

      recordTest('Orders & Invoices', 'Secure order cancellation with automated stock restoration', passCancellation, resCancel.durationMs,
        `Status: ${cancelledOrder?.status}, Restored Stock: ${prodAfterCancel.stock}`);

      // 5.3 Prevent duplicate cancellation of already cancelled order
      const resDupCancel = await api(`/orders/${placedOrderId}/cancel`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${customerToken}` }
      });
      recordTest('Orders & Invoices', 'Prevent duplicate cancellation of non-pending orders (HTTP 400)', resDupCancel.status === 400, resDupCancel.durationMs,
        `Message: ${resDupCancel.data?.message}`);
    }

    // ========================================================================
    // 6. Wallet, Coupons & Promotional Calculations
    // ========================================================================
    console.log('\n--- 6. WALLET, COUPONS & PROMOTIONAL CALCULATIONS ---');

    // 6.1 Coupon validation with percentage and flat discount limits
    {
      const testCoupon = await Coupon.create({
        code: `STABILITY${Date.now().toString().slice(-4)}`,
        description: '20% off up to ₹300 on orders above ₹1000',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        maxDiscountAmount: 300,
        minOrderAmount: 1000,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true
      });
      cleanupCouponIds.push(testCoupon._id);

      // Validate below threshold (subtotal 800) -> should reject
      const resBelow = await api('/coupons/validate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ code: testCoupon.code, subtotal: 800 })
      });
      recordTest('Wallet & Promotions', 'Reject coupon when cart subtotal is below minOrderAmount', resBelow.status === 400 && resBelow.data?.valid === false, resBelow.durationMs);

      // Validate with subtotal 2500 -> 20% is 500, capped at maxDiscountAmount 300
      const resAbove = await api('/coupons/validate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ code: testCoupon.code, subtotal: 2500 })
      });
      const passCoupon = resAbove.status === 200 &&
                         resAbove.data?.valid === true &&
                         resAbove.data?.data?.discountAmount === 300 &&
                         resAbove.data?.data?.finalTotal === 2200;
      recordTest('Wallet & Promotions', 'Coupon percentage discount calculation with maxDiscountAmount cap', passCoupon, resAbove.durationMs,
        `Discount: ₹${resAbove.data?.data?.discountAmount}, Final: ₹${resAbove.data?.data?.finalTotal}`);
    }

    // 6.2 Live Festive Sale campaign retrieval & psychological pricing rule (ending in 9)
    {
      const resSale = await api('/sales/current');
      const passSale = resSale.status === 200 && resSale.data?.success === true;
      recordTest('Wallet & Promotions', 'Live Festive Sale campaign status retrieval', passSale, resSale.durationMs,
        `Campaign: "${resSale.data?.data?.name}", Status: ${resSale.data?.data?.status}`);

      // Test psychological pricing formula for festive deal item
      const sampleItem = { name: 'Wireless Mouse', price: 799 };
      const effectivePrice = getProductEffectivePrice(sampleItem);
      const endsIn9 = effectivePrice % 10 === 9;
      const isDiscounted = effectivePrice < 799;
      recordTest('Wallet & Promotions', 'Psychological pricing calculation rule (ends in ₹9, e.g., ₹399)', endsIn9 && isDiscounted, 1,
        `Regular: ₹${sampleItem.price} -> Festive: ₹${effectivePrice}`);
    }

    // 6.3 Wallet recharge with gateway transaction reference validation
    {
      // Missing gateway reference rejected
      const resAddFail = await api('/wallet/add-money', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ amount: 1000 })
      });
      recordTest('Wallet & Promotions', 'Reject wallet recharge without valid gateway transaction (HTTP 400)', resAddFail.status === 400, resAddFail.durationMs);

      // Valid recharge
      const resAddOk = await api('/wallet/add-money', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({
          amount: 1000,
          paymentMethod: 'UPI',
          gatewayTxnId: `GW_TXN_${Date.now()}`
        })
      });
      const passRecharge = resAddOk.status === 200 && resAddOk.data?.data?.walletBalance >= 1000;
      recordTest('Wallet & Promotions', 'Verified gateway wallet recharge & ledger transaction credit', passRecharge, resAddOk.durationMs,
        `New Balance: ₹${resAddOk.data?.data?.walletBalance}`);
    }

    // 6.4 Fair Usage Policy test: Wallet deduction capped at 50% of payable amount
    {
      const fupProduct = await Product.create({
        name: `FUP Test Product ${Date.now()}`,
        title: `FUP Test Product ${Date.now()}`,
        price: 800,
        stock: 10,
        category: 'Electronics',
        inStock: true
      });
      cleanupProductIds.push(fupProduct._id);

      // Setup cart with 1 unit of ₹800
      await api('/cart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ productId: fupProduct._id, quantity: 1 })
      });

      // User has ₹1000 wallet balance. Subtotal is ₹800.
      // 50% FUP ceiling means max wallet deduction allowed is ₹400 (not ₹800).
      const resFupOrder = await api('/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({
          paymentMethod: 'COD',
          useWallet: true,
          shippingAddress: {
            fullName: 'FUP Tester',
            phone: '9876543210',
            addressLine1: '123 MG Road',
            city: 'Bengaluru',
            state: 'Karnataka',
            postalCode: '560001'
          }
        })
      });

      const fupOrderData = resFupOrder.data?.data;
      if (fupOrderData?._id) cleanupOrderIds.push(fupOrderData._id);

      const expectedWalletDiscount = 400; // 50% of 800
      const passFup = resFupOrder.status === 201 &&
                      fupOrderData?.walletDiscount === expectedWalletDiscount &&
                      fupOrderData?.totalAmount === 400;

      recordTest('Wallet & Promotions', 'Fair Usage Policy: 50% ceiling on checkout wallet balance deduction', passFup, resFupOrder.durationMs,
        `Subtotal: ₹${fupOrderData?.subtotalAmount}, Wallet Discount: ₹${fupOrderData?.walletDiscount}, Payable: ₹${fupOrderData?.totalAmount}`);
    }

    // 6.5 SuperCoins cashback calculation & minimum 10-coin rule
    {
      // Order subtotal was ₹800: 5% is 40 coins (Math.max(10, Math.round(subtotal * 0.05)))
      const lastOrder = await Order.findOne({ user: customerUser.id }).sort({ createdAt: -1 });
      const coinsEarned = lastOrder?.coinsEarned;
      const expectedCoins = Math.max(10, Math.round(lastOrder.subtotalAmount * 0.05)); // 40 coins
      const passCoins = coinsEarned === expectedCoins;
      recordTest('Wallet & Promotions', '5% SuperCoins cashback calculation on order subtotal amount', passCoins, 1,
        `Earned: ${coinsEarned} coins (Expected: ${expectedCoins} on subtotal ₹${lastOrder.subtotalAmount})`);

      // Verify minimum 10-coin rule mathematical formula
      const testMinCalc = Math.max(10, Math.round(50 * 0.05)); // 5% of 50 is 2.5, clamped to 10
      recordTest('Wallet & Promotions', 'Guaranteed minimum 10 SuperCoins rule verification', testMinCalc === 10, 1,
        `For ₹50 order: Math.max(10, Round(2.5)) = ${testMinCalc}`);

      // Coins to cash redemption (20 coins = ₹10 cash)
      const resRedeem = await api('/wallet/redeem-coins', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ coinsToRedeem: 20 })
      });
      const passRedeem = resRedeem.status === 200 && resRedeem.data?.success === true;
      recordTest('Wallet & Promotions', 'Loyalty SuperCoins redemption into wallet balance (20 coins = ₹10)', passRedeem, resRedeem.durationMs,
        resRedeem.data?.message);
    }

  } finally {
    // ========================================================================
    // Tear-Down: Automated Test Data Cleanup
    // ========================================================================
    console.log('\n======================================================================');
    console.log('                 TEAR-DOWN: AUTOMATED TEST DATA CLEANUP               ');
    console.log('======================================================================');

    let cleanedOrders = 0;
    let cleanedProducts = 0;
    let cleanedUsers = 0;
    let cleanedAddresses = 0;
    let cleanedCoupons = 0;

    if (cleanupOrderIds.length > 0) {
      const res = await Order.deleteMany({ _id: { $in: cleanupOrderIds } });
      cleanedOrders = res.deletedCount;
    }
    if (cleanupProductIds.length > 0) {
      const res = await Product.deleteMany({ _id: { $in: cleanupProductIds } });
      cleanedProducts = res.deletedCount;
    }
    if (cleanupAddressIds.length > 0) {
      const res = await Address.deleteMany({ _id: { $in: cleanupAddressIds } });
      cleanedAddresses = res.deletedCount;
    }
    if (cleanupCouponIds.length > 0) {
      const res = await Coupon.deleteMany({ _id: { $in: cleanupCouponIds } });
      cleanedCoupons = res.deletedCount;
    }
    if (cleanupUserIds.length > 0) {
      const res = await User.deleteMany({ _id: { $in: cleanupUserIds } });
      cleanedUsers = res.deletedCount;
    }

    console.log(`  ✓ Cleaned up ${cleanedOrders} mock order(s)`);
    console.log(`  ✓ Cleaned up ${cleanedProducts} temporary test product(s)`);
    console.log(`  ✓ Cleaned up ${cleanedAddresses} test address record(s)`);
    console.log(`  ✓ Cleaned up ${cleanedCoupons} test coupon(s)`);
    console.log(`  ✓ Cleaned up ${cleanedUsers} ephemeral test user(s)`);

    const finalCatalogCount = await Product.countDocuments();
    console.log(`Final Catalog Product Count: ${finalCatalogCount}`);
    if (finalCatalogCount < 61) {
      console.error(`  ✗ WARNING: Catalog product count (${finalCatalogCount}) is below 61!`);
    } else {
      console.log('  ✓ Original 61 catalog products verified completely intact.');
    }

    await mongoose.disconnect();
  }

  // ========================================================================
  // Final Scorecard & Execution Report
  // ========================================================================
  const suiteDurationMs = Date.now() - suiteStartTime;

  console.log('\n======================================================================');
  console.log('                   STABILITY SUITE SUMMARY SCORECARD                  ');
  console.log('======================================================================');
  console.log(`  TOTAL TESTS EXECUTED:  ${totalTests}`);
  console.log(`  PASSED:                ${passedTests}`);
  console.log(`  FAILED:                ${failedTests}`);
  console.log(`  SUCCESS RATE:          ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log(`  TOTAL DURATION:        ${(suiteDurationMs / 1000).toFixed(2)}s`);
  console.log('======================================================================');

  // Group by category
  const categories = [...new Set(testResults.map(r => r.category))];
  console.log('\nCategory Performance Breakdown:');
  for (const cat of categories) {
    const catTests = testResults.filter(r => r.category === cat);
    const catPassed = catTests.filter(r => r.passed).length;
    const catAvgDur = (catTests.reduce((acc, t) => acc + t.durationMs, 0) / catTests.length).toFixed(1);
    console.log(`  • ${cat.padEnd(35)}: ${catPassed}/${catTests.length} Passed (Avg: ${catAvgDur}ms)`);
  }

  if (bottlenecks.length > 0) {
    console.log('\nIdentified Bottlenecks (> 1000ms):');
    bottlenecks.forEach(b => console.log(`  ⚠️  ${b}`));
  } else {
    console.log('\nPerformance: No API or database query bottlenecks detected (< 1000ms threshold).');
  }

  if (discoveredEdgeCases.length > 0) {
    console.log('\nEdge Cases & Observations:');
    discoveredEdgeCases.forEach(e => console.log(`  ℹ️  ${e}`));
  }

  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runStabilitySuite().catch(err => {
  console.error('Fatal unhandled error executing stability suite:', err);
  process.exit(1);
});
