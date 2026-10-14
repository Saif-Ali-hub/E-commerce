/**
 * ============================================================================
 * Mini Store Platform — Dedicated Seller Dashboard (Vendor Portal) Test Suite
 * File: scratch/test_seller_portal.js
 *
 * Standalone automated test suite verifying:
 * 1. RBAC: 401 unauthenticated, 403 customers, 403 pending sellers, 200 verified sellers
 * 2. Multi-tenant Product Isolation: Product listing, cross-seller update/delete prevention (403)
 * 3. Multi-tenant Order Slicing: Multi-item order slicing ensuring Seller A never sees Seller B's items
 * 4. Dispatch Workflow: Marking orders as dispatched with courier and live tracking
 * 5. Overview Analytics: Revenue, Units sold, 10% platform fee, and 90% merchant settlement calculations
 * 6. Self-cleaning teardown
 * ============================================================================
 */

const path = require('path');
const dotenv = require('../backend/node_modules/dotenv');
const mongoose = require('../backend/node_modules/mongoose');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const User = require('../backend/models/User');
const Product = require('../backend/models/Product');
const Order = require('../backend/models/Order');

const API_BASE = 'http://localhost:5000/api';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/E-commerce';

// Native fetch helper
async function api(endpoint, options = {}, token = null) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const start = Date.now();
  const res = await fetch(url, {
    ...options,
    headers
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

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passedCount++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedCount++;
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🏪 MiniStore Seller Dashboard & Multi-Tenant Vendor Portal Test');
  console.log('================================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }

  const timestamp = Date.now();
  const customerEmail = `test_cust_${timestamp}@example.com`;
  const pendingSellerEmail = `test_pending_seller_${timestamp}@example.com`;
  const sellerAEmail = `test_seller_a_${timestamp}@example.com`;
  const sellerBEmail = `test_seller_b_${timestamp}@example.com`;
  const testPassword = 'Password123!';

  let customerToken = null;
  let pendingSellerToken = null;
  let sellerAToken = null;
  let sellerBToken = null;
  let adminToken = null;

  let sellerAUser = null;
  let sellerBUser = null;
  let createdProductA = null;
  let createdProductB = null;
  let createdOrder = null;

  const createdUserIds = [];
  const createdProductIds = [];
  const createdOrderIds = [];

  try {
    // --------------------------------------------------------------------------
    // 1. Account Setup & Token Acquisition
    // --------------------------------------------------------------------------
    console.log('👥 1. Account Provisioning & Role Verification');

    // Admin login
    const adminLoginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@ministore.com', password: 'adminpassword123' })
    });
    assert(adminLoginRes.status === 200 && adminLoginRes.data?.token, 'Admin account authenticated');
    adminToken = adminLoginRes.data.token;

    // Register Customer
    const custRegRes = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Customer', email: customerEmail, password: testPassword })
    });
    assert(custRegRes.status === 201 && custRegRes.data?.success, 'Regular customer registered');
    const custUserId = custRegRes.data.data.id;
    createdUserIds.push(custUserId);
    const custLoginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: customerEmail, password: testPassword })
    });
    customerToken = custLoginRes.data.token;

    // Register Pending Seller
    const pendingRegRes = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Pending Merchant',
        email: pendingSellerEmail,
        password: testPassword,
        isSeller: true,
        phone: '9876543210',
        businessName: 'Pending Apex Ltd',
        businessAddress: '123 Market Road',
        pan: 'ABCDE1234F'
      })
    });
    assert(pendingRegRes.status === 201 && pendingRegRes.data?.success, 'Pending merchant registered');
    const pendingUserId = pendingRegRes.data.data.id;
    createdUserIds.push(pendingUserId);
    const pendingLoginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: pendingSellerEmail, password: testPassword })
    });
    pendingSellerToken = pendingLoginRes.data.token;

    // Register & Verify Seller A
    const sellerARegRes = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Seller Alice',
        email: sellerAEmail,
        password: testPassword,
        isSeller: true,
        phone: '9876543211',
        businessName: 'Alice Audio Store',
        businessAddress: 'Plot 10 Industrial Area',
        pan: 'ALICE1234F'
      })
    });
    assert(sellerARegRes.status === 201 && sellerARegRes.data?.success, 'Seller A registered');
    const sellerAId = sellerARegRes.data.data.id;
    createdUserIds.push(sellerAId);
    // Admin verifies Seller A
    await User.findByIdAndUpdate(sellerAId, {
      'sellerDetails.verificationStatus': 'verified'
    });
    const sellerALoginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: sellerAEmail, password: testPassword })
    });
    sellerAToken = sellerALoginRes.data.token;
    sellerAUser = await User.findById(sellerAId);
    assert(sellerAUser.sellerDetails.verificationStatus === 'verified', 'Seller A verified by admin');

    // Register & Verify Seller B
    const sellerBRegRes = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Seller Bob',
        email: sellerBEmail,
        password: testPassword,
        isSeller: true,
        phone: '9876543212',
        businessName: 'Bob Gaming Depot',
        businessAddress: 'Plot 20 Tech Park',
        pan: 'BOBBY1234F'
      })
    });
    assert(sellerBRegRes.status === 201 && sellerBRegRes.data?.success, 'Seller B registered');
    const sellerBId = sellerBRegRes.data.data.id;
    createdUserIds.push(sellerBId);
    // Admin verifies Seller B
    await User.findByIdAndUpdate(sellerBId, {
      'sellerDetails.verificationStatus': 'verified'
    });
    const sellerBLoginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: sellerBEmail, password: testPassword })
    });
    sellerBToken = sellerBLoginRes.data.token;
    sellerBUser = await User.findById(sellerBId);
    assert(sellerBUser.sellerDetails.verificationStatus === 'verified', 'Seller B verified by admin');

    // --------------------------------------------------------------------------
    // 2. RBAC & Authorization Defense-in-Depth
    // --------------------------------------------------------------------------
    console.log('\n🛡️ 2. RBAC Security & Access Control');

    // 2.1 Unauthenticated request rejected (401)
    const unauthRes = await api('/seller/overview');
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with HTTP 401');

    // 2.2 Customer rejected (403)
    const custRes = await api('/seller/overview', {}, customerToken);
    assert(custRes.status === 403, 'Normal customer rejected from /api/seller/* with HTTP 403');

    // 2.3 Unverified seller rejected (403)
    const pendingRes = await api('/seller/overview', {}, pendingSellerToken);
    assert(pendingRes.status === 403, 'Unverified/Pending merchant rejected with HTTP 403');

    // 2.4 Verified seller allowed (200)
    const sellerRes = await api('/seller/overview', {}, sellerAToken);
    assert(sellerRes.status === 200 && sellerRes.data.success, 'Verified merchant access granted with HTTP 200');

    // 2.5 Admin allowed (200)
    const adminRes = await api('/seller/overview', {}, adminToken);
    assert(adminRes.status === 200 && adminRes.data.success, 'Administrator access granted with HTTP 200');

    // --------------------------------------------------------------------------
    // 3. Multi-Tenant Product Management & Catalog Isolation
    // --------------------------------------------------------------------------
    console.log('\n📦 3. Multi-Tenant Product Isolation & Catalog CRUD');

    // Seller A creates Product A
    const prodARes = await api('/seller/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Seller A Noise Cancelling Headphones',
        category: 'Electronics',
        price: 1500,
        stock: 12,
        brand: 'Alice Acoustics',
        description: 'Premium wireless headphones by Seller A'
      })
    }, sellerAToken);
    assert(prodARes.status === 201 && prodARes.data.success, 'Seller A created a new catalog product');
    createdProductA = prodARes.data.data;
    createdProductIds.push(createdProductA._id);
    assert(createdProductA.seller.toString() === sellerAUser._id.toString(), 'Product A seller explicitly mapped to Seller A ObjectId');

    // Seller B creates Product B
    const prodBRes = await api('/seller/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Seller B Mechanical RGB Keyboard',
        category: 'Electronics',
        price: 2500,
        stock: 8,
        brand: 'Bob Keyboards',
        description: 'Hot-swappable mechanical keyboard by Seller B'
      })
    }, sellerBToken);
    assert(prodBRes.status === 201 && prodBRes.data.success, 'Seller B created a new catalog product');
    createdProductB = prodBRes.data.data;
    createdProductIds.push(createdProductB._id);
    assert(createdProductB.seller.toString() === sellerBUser._id.toString(), 'Product B seller explicitly mapped to Seller B ObjectId');

    // Seller A fetches products: MUST NOT see Product B
    const sellerAProductsRes = await api('/seller/products', {}, sellerAToken);
    assert(sellerAProductsRes.status === 200, 'Seller A retrieved products list');
    const sellerAIds = sellerAProductsRes.data.data.map(p => p._id.toString());
    assert(sellerAIds.includes(createdProductA._id.toString()), 'Seller A catalog contains Product A');
    assert(!sellerAIds.includes(createdProductB._id.toString()), 'Isolation: Seller A catalog does NOT contain Seller B product');

    // Cross-Tenant Write Protection: Seller A attempts to update Seller B's product
    const crossUpdateRes = await api(`/seller/products/${createdProductB._id}`, {
      method: 'PUT',
      body: JSON.stringify({ price: 9999, name: 'Hacked by Seller A' })
    }, sellerAToken);
    assert(crossUpdateRes.status === 403, 'Cross-Tenant Protection: Seller A cannot update Seller B product (HTTP 403)');

    // Cross-Tenant Delete Protection: Seller A attempts to delete Seller B's product
    const crossDeleteRes = await api(`/seller/products/${createdProductB._id}`, {
      method: 'DELETE'
    }, sellerAToken);
    assert(crossDeleteRes.status === 403, 'Cross-Tenant Protection: Seller A cannot delete Seller B product (HTTP 403)');

    // Seller A successfully updates their own product
    const ownUpdateRes = await api(`/seller/products/${createdProductA._id}`, {
      method: 'PUT',
      body: JSON.stringify({ price: 1600, stock: 15 })
    }, sellerAToken);
    assert(ownUpdateRes.status === 200 && ownUpdateRes.data.data.price === 1600, 'Seller A successfully updated their own product price & stock');

    // --------------------------------------------------------------------------
    // 4. Multi-Tenant Order Slicing & Privacy
    // --------------------------------------------------------------------------
    console.log('\n🚚 4. Multi-Tenant Order Slicing & Privacy Preservation');

    // Create an order containing products from BOTH Seller A and Seller B
    const newOrder = new Order({
      user: custUserId,
      items: [
        {
          product: createdProductA._id,
          name: createdProductA.name,
          price: 1600,
          quantity: 2,
          subtotal: 3200,
          seller: sellerAUser._id,
          sellerName: 'Alice Audio Store'
        },
        {
          product: createdProductB._id,
          name: createdProductB.name,
          price: 2500,
          quantity: 1,
          subtotal: 2500,
          seller: sellerBUser._id,
          sellerName: 'Bob Gaming Depot'
        }
      ],
      totalAmount: 5700,
      subtotalAmount: 5700,
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      status: 'Pending',
      shippingAddress: {
        fullName: 'Priya Sharma',
        phone: '9876543210',
        addressLine1: '42 Brigade Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India'
      }
    });

    createdOrder = await newOrder.save();
    createdOrderIds.push(createdOrder._id);
    assert(createdOrder !== null, 'Created multi-merchant order (Seller A: ₹3,200, Seller B: ₹2,500, Total: ₹5,700)');

    // Seller A views orders
    const sellerAOrdersRes = await api('/seller/orders', {}, sellerAToken);
    assert(sellerAOrdersRes.status === 200, 'Seller A fetched merchant orders');
    const sellerAOrder = sellerAOrdersRes.data.data.find(o => o._id.toString() === createdOrder._id.toString());
    assert(sellerAOrder !== undefined, 'Seller A sees the multi-merchant order');
    assert(sellerAOrder.items.length === 1, 'Order Slicing: Seller A sees ONLY their 1 item');
    assert(sellerAOrder.items[0].name === createdProductA.name, 'Seller A item is Product A');
    assert(sellerAOrder.sellerTotal === 3200, 'Privacy: Seller A sees only their fulfillment subtotal (₹3,200, not ₹5,700)');

    // Seller B views orders
    const sellerBOrdersRes = await api('/seller/orders', {}, sellerBToken);
    assert(sellerBOrdersRes.status === 200, 'Seller B fetched merchant orders');
    const sellerBOrder = sellerBOrdersRes.data.data.find(o => o._id.toString() === createdOrder._id.toString());
    assert(sellerBOrder !== undefined, 'Seller B sees the multi-merchant order');
    assert(sellerBOrder.items.length === 1, 'Order Slicing: Seller B sees ONLY their 1 item');
    assert(sellerBOrder.items[0].name === createdProductB.name, 'Seller B item is Product B');
    assert(sellerBOrder.sellerTotal === 2500, 'Privacy: Seller B sees only their fulfillment subtotal (₹2,500, not ₹5,700)');

    // --------------------------------------------------------------------------
    // 5. Overview KPI Metrics & Revenue Settlement Calculations
    // --------------------------------------------------------------------------
    console.log('\n📊 5. Overview Analytics & Commission Ledger');

    const sellerAOverviewRes = await api('/seller/overview', {}, sellerAToken);
    assert(sellerAOverviewRes.status === 200, 'Seller A overview metrics retrieved');
    const metricsA = sellerAOverviewRes.data.data.metrics;
    assert(metricsA.totalRevenue === 3200, `Seller A total revenue matches sliced sales (expected 3200, got ${metricsA.totalRevenue})`);
    assert(metricsA.totalUnitsSold === 2, `Seller A units sold correctly calculated (expected 2, got ${metricsA.totalUnitsSold})`);
    assert(metricsA.activeProducts >= 1, 'Active listed products count >= 1');
    assert(metricsA.platformFee === 320, `10% Platform fee calculated correctly (expected 320, got ${metricsA.platformFee})`);
    assert(metricsA.netPayout === 2880, `90% Net Merchant Payout calculated correctly (expected 2880, got ${metricsA.netPayout})`);

    // --------------------------------------------------------------------------
    // 6. Order Dispatch Workflow & Notifications
    // --------------------------------------------------------------------------
    console.log('\n📦 6. Order Dispatch Workflow');

    // Customer cannot dispatch order (403)
    const custDispatchRes = await api(`/seller/orders/${createdOrder._id}/dispatch`, {
      method: 'PUT',
      body: JSON.stringify({ carrier: 'BlueDart', trackingNumber: 'BD-12345678' })
    }, customerToken);
    assert(custDispatchRes.status === 403, 'Customer cannot dispatch order (HTTP 403)');

    // Seller A dispatches order
    const sellerDispatchRes = await api(`/seller/orders/${createdOrder._id}/dispatch`, {
      method: 'PUT',
      body: JSON.stringify({
        carrier: 'Delhivery',
        trackingNumber: 'DL-99887766',
        notes: 'Handed to Delhivery ground crew'
      })
    }, sellerAToken);
    assert(sellerDispatchRes.status === 200 && sellerDispatchRes.data.success, 'Seller A successfully marked order as dispatched');

    // Check DB state
    const dispatchedOrderInDb = await Order.findById(createdOrder._id);
    assert(dispatchedOrderInDb.status === 'Shipped', 'Order status updated to "Shipped" in database');
    assert(dispatchedOrderInDb.tracking.carrier === 'Delhivery', 'Courier partner recorded as Delhivery');
    assert(dispatchedOrderInDb.tracking.trackingNumber === 'DL-99887766', 'Tracking number recorded');
    assert(dispatchedOrderInDb.tracking.history.length > 0, 'Tracking history milestone recorded');

  } catch (err) {
    console.error('Unexpected test error:', err);
    failedCount++;
  } finally {
    // --------------------------------------------------------------------------
    // 7. Cleanup & Teardown
    // --------------------------------------------------------------------------
    console.log('\n🧹 7. Teardown: Automated Test Data Cleanup');
    try {
      if (createdOrderIds.length > 0) {
        const delOrders = await Order.deleteMany({ _id: { $in: createdOrderIds } });
        console.log(`   Cleaned up ${delOrders.deletedCount} test order(s)`);
      }
      if (createdProductIds.length > 0) {
        const delProds = await Product.deleteMany({ _id: { $in: createdProductIds } });
        console.log(`   Cleaned up ${delProds.deletedCount} test product(s)`);
      }
      if (createdUserIds.length > 0) {
        const delUsers = await User.deleteMany({ _id: { $in: createdUserIds } });
        console.log(`   Cleaned up ${delUsers.deletedCount} test user(s)`);
      }
    } catch (cleanErr) {
      console.warn('   Teardown warning:', cleanErr.message);
    }
  }

  console.log('\n================================================================');
  console.log(`📊 Test Summary: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
