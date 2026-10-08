// test_payment_system.js
// Dedicated automated test suite for Payment Method selection & Payment-Status system

const API_BASE = 'http://localhost:5000/api';

async function request(url, options = {}) {
  const combinedHeaders = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(url, {
    ...options,
    headers: combinedHeaders
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

let testUser = null;
let testToken = null;
let testProduct = null;
let testAddress = null;

let otherUser = null;
let otherToken = null;

let adminToken = null;

async function setup() {
  console.log('--- SETTING UP PAYMENT TESTS ---');

  // 1. Register & login primary test customer
  const email = `paytest_${Date.now()}@example.com`;
  const regRes = await request(`${API_BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Payment Customer', email, password: 'password123' })
  });
  if (!regRes.ok) throw new Error('Failed to register customer: ' + JSON.stringify(regRes.data));
  const loginRes = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password: 'password123' })
  });
  if (!loginRes.ok) throw new Error('Failed to login customer: ' + JSON.stringify(loginRes.data));
  testUser = loginRes.data.user;
  testToken = loginRes.data.token;

  // 2. Register & login second customer for security checks
  const email2 = `payother_${Date.now()}@example.com`;
  const regRes2 = await request(`${API_BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Other Customer', email: email2, password: 'password123' })
  });
  if (!regRes2.ok) throw new Error('Failed to register second customer: ' + JSON.stringify(regRes2.data));
  const loginRes2 = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: email2, password: 'password123' })
  });
  if (!loginRes2.ok) throw new Error('Failed to login second customer: ' + JSON.stringify(loginRes2.data));
  otherUser = loginRes2.data.user;
  otherToken = loginRes2.data.token;

  // 3. Login as Admin
  const adminRes = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@ministore.com', password: 'adminpassword123' })
  });
  if (adminRes.ok && adminRes.data && adminRes.data.token) {
    adminToken = adminRes.data.token;
  }

  // 4. Create an address for primary customer
  const addrRes = await request(`${API_BASE}/addresses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}` },
    body: JSON.stringify({
      fullName: 'Payment Tester',
      phone: '9876543210',
      addressLine1: 'Flat 101, Tech Park Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
      addressType: 'Home'
    })
  });
  if (!addrRes.ok) throw new Error('Failed to create address: ' + JSON.stringify(addrRes.data));
  testAddress = addrRes.data.data;

  // 5. Get available product
  const prodsRes = await request(`${API_BASE}/products`);
  if (!prodsRes.ok || !prodsRes.data.data.length) throw new Error('No products available for testing');
  testProduct = prodsRes.data.data.find(p => p.stock > 10) || prodsRes.data.data[0];

  console.log(`Setup complete. Customer: ${testUser.email}, Product: ${testProduct.name}`);
}

async function addProductToCart(token, productId, quantity = 1) {
  const cartRes = await request(`${API_BASE}/cart`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (cartRes.ok && cartRes.data.data && cartRes.data.data.items && cartRes.data.data.items.length > 0) {
    return; // Cart already has items
  }

  const res = await request(`${API_BASE}/cart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ productId, quantity })
  });
  if (!res.ok) throw new Error('Failed to add product to cart: ' + JSON.stringify(res.data));
}

let passed = 0;
let failed = 0;

function assert(cond, desc) {
  if (cond) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

async function runTests() {
  await setup();

  console.log('\n--- TEST SUITE: PAYMENT METHOD SELECTION & STATUS ---');

  // Test 1: Order creation with UPI
  console.log('\n[1] Testing Order Placement with UPI:');
  await addProductToCart(testToken, testProduct._id, 1);
  const upiOrderRes = await request(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}` },
    body: JSON.stringify({
      addressId: testAddress._id,
      paymentMethod: 'UPI'
    })
  });
  assert(upiOrderRes.status === 201, 'UPI order placed successfully with status 201');
  assert(upiOrderRes.data.data.paymentMethod === 'UPI', 'order.paymentMethod is UPI');
  assert(upiOrderRes.data.data.paymentStatus === 'Pending', 'order.paymentStatus is Pending (NOT falsely marked Paid)');
  assert(upiOrderRes.data.data.paymentReference === null, 'order.paymentReference is null (no fake tx IDs)');
  const upiOrderId = upiOrderRes.data.data._id;

  // Test 2: Order creation with COD
  console.log('\n[2] Testing Order Placement with COD (Cash on Delivery):');
  await addProductToCart(testToken, testProduct._id, 1);
  const codOrderRes = await request(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}` },
    body: JSON.stringify({
      addressId: testAddress._id,
      paymentMethod: 'COD'
    })
  });
  assert(codOrderRes.status === 201, 'COD order placed successfully with status 201');
  assert(codOrderRes.data.data.paymentMethod === 'COD', 'order.paymentMethod is COD');
  assert(codOrderRes.data.data.paymentStatus === 'Pending', 'order.paymentStatus is Pending (collected on delivery)');
  assert(codOrderRes.data.data.paymentReference === null, 'order.paymentReference is null');
  const codOrderId = codOrderRes.data.data._id;

  // Test 3: Order creation with NET_BANKING
  console.log('\n[3] Testing Order Placement with Net Banking (NET_BANKING):');
  await addProductToCart(testToken, testProduct._id, 1);
  const netOrderRes = await request(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}` },
    body: JSON.stringify({
      addressId: testAddress._id,
      paymentMethod: 'NET_BANKING'
    })
  });
  assert(netOrderRes.status === 201, 'NET_BANKING order placed successfully with status 201');
  assert(netOrderRes.data.data.paymentMethod === 'NET_BANKING', 'order.paymentMethod is NET_BANKING');
  assert(netOrderRes.data.data.paymentStatus === 'Pending', 'order.paymentStatus is Pending (NOT marked Paid without gateway)');
  assert(netOrderRes.data.data.paymentReference === null, 'order.paymentReference is null');
  const netOrderId = netOrderRes.data.data._id;

  // Test 4: Validation rejection of unsupported payment methods
  console.log('\n[4] Testing Validation & Rejection of Invalid Payment Methods:');
  const invalidMethods = ['CARD', 'PAYPAL', 'STRIPE', 'upi', 'cod', 'random_string', '', null];

  for (const invalidMethod of invalidMethods) {
    await addProductToCart(testToken, testProduct._id, 1);
    const rejRes = await request(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testToken}` },
      body: JSON.stringify({
        addressId: testAddress._id,
        paymentMethod: invalidMethod
      })
    });
    assert(rejRes.status === 400, `Rejected invalid paymentMethod "${invalidMethod}" with 400 Bad Request`);
    assert(rejRes.data.success === false, `Response success is false for "${invalidMethod}"`);
  }

  // Test 5: Missing payment method rejection
  console.log('\n[5] Testing Missing Payment Method:');
  await addProductToCart(testToken, testProduct._id, 1);
  const missingRes = await request(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}` },
    body: JSON.stringify({
      addressId: testAddress._id
    })
  });
  assert(missingRes.status === 400, 'Rejected request missing paymentMethod with 400 Bad Request');

  // Test 6: Security - Customer cannot spoof paymentStatus: "Paid"
  console.log('\n[6] Testing Security: Customer Cannot Spoof paymentStatus = "Paid":');
  await addProductToCart(testToken, testProduct._id, 1);
  const spoofRes = await request(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${testToken}` },
    body: JSON.stringify({
      addressId: testAddress._id,
      paymentMethod: 'UPI',
      paymentStatus: 'Paid',
      paymentReference: 'FAKE_GATEWAY_TXN_12345'
    })
  });
  assert(spoofRes.status === 201, 'Order created successfully');
  assert(spoofRes.data.data.paymentStatus === 'Pending', 'Server enforced paymentStatus = Pending, client spoof "Paid" was rejected/ignored');
  assert(spoofRes.data.data.paymentReference === null, 'Server enforced paymentReference = null, client spoof tx was ignored');

  // Test 7: Customer Order History contains payment fields
  console.log('\n[7] Testing My Orders (GET /api/orders):');
  const myOrdersRes = await request(`${API_BASE}/orders`, {
    headers: { Authorization: `Bearer ${testToken}` }
  });
  assert(myOrdersRes.status === 200, 'GET /api/orders succeeded');
  const foundUpi = myOrdersRes.data.data.find(o => o._id === upiOrderId);
  const foundCod = myOrdersRes.data.data.find(o => o._id === codOrderId);
  const foundNet = myOrdersRes.data.data.find(o => o._id === netOrderId);
  assert(Boolean(foundUpi && foundUpi.paymentMethod === 'UPI' && foundUpi.paymentStatus === 'Pending'), 'Order history contains UPI order with Pending status');
  assert(Boolean(foundCod && foundCod.paymentMethod === 'COD' && foundCod.paymentStatus === 'Pending'), 'Order history contains COD order with Pending status');
  assert(Boolean(foundNet && foundNet.paymentMethod === 'NET_BANKING' && foundNet.paymentStatus === 'Pending'), 'Order history contains NET_BANKING order with Pending status');

  // Test 8: Order Details (GET /api/orders/:id)
  console.log('\n[8] Testing Order Details (GET /api/orders/:id):');
  const orderDetailsRes = await request(`${API_BASE}/orders/${upiOrderId}`, {
    headers: { Authorization: `Bearer ${testToken}` }
  });
  assert(orderDetailsRes.status === 200, 'GET /api/orders/:id succeeded');
  assert(orderDetailsRes.data.data.paymentMethod === 'UPI', 'order.paymentMethod returned correctly');
  assert(orderDetailsRes.data.data.paymentStatus === 'Pending', 'order.paymentStatus returned correctly');

  // Test 9: Isolation / Authorization Security: Another customer cannot access or alter order
  console.log('\n[9] Testing User Isolation Security:');
  const otherAccessRes = await request(`${API_BASE}/orders/${upiOrderId}`, {
    headers: { Authorization: `Bearer ${otherToken}` }
  });
  assert(otherAccessRes.status === 403 || otherAccessRes.status === 404, 'Other user cannot access user 1 order (403/404)');

  // Test 10: Admin Orders view includes payment information
  if (adminToken) {
    console.log('\n[10] Testing Admin Orders Panel (GET /api/admin/orders):');
    const adminOrdersRes = await request(`${API_BASE}/admin/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminOrdersRes.status === 200, 'Admin can fetch all orders');
    const adminUpi = adminOrdersRes.data.data.find(o => o._id === upiOrderId);
    assert(Boolean(adminUpi && adminUpi.paymentMethod === 'UPI' && adminUpi.paymentStatus === 'Pending'), 'Admin order includes paymentMethod (UPI) and paymentStatus (Pending)');
  }

  // Test 11: Backward compatibility with historical orders without payment fields
  console.log('\n[11] Testing Backward Compatibility with Historical Orders:');
  const mongoose = require('../backend/node_modules/mongoose');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mini_ecommerce');
  }
  const Order = require('../backend/models/Order');
  // Create an old order directly without payment fields
  const oldOrderDoc = await Order.create({
    user: testUser.id,
    items: [{
      product: testProduct._id,
      name: testProduct.name,
      price: testProduct.price,
      quantity: 1,
      subtotal: testProduct.price
    }],
    totalAmount: testProduct.price,
    status: 'Pending',
    shippingAddress: {
      fullName: 'Old Customer',
      phone: '9999999999',
      addressLine1: 'Old Street 1',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001',
      country: 'India'
    }
  });

  // Verify GET /api/orders returns old order cleanly
  const myOrdersWithOldRes = await request(`${API_BASE}/orders`, {
    headers: { Authorization: `Bearer ${testToken}` }
  });
  assert(myOrdersWithOldRes.status === 200, 'Orders query with historical order succeeds');
  const foundOld = myOrdersWithOldRes.data.data.find(o => o._id === oldOrderDoc._id.toString());
  assert(Boolean(foundOld), 'Historical order retrieved successfully in customer orders');
  assert(foundOld.paymentStatus === 'Pending', 'Default paymentStatus for old order defaults gracefully to Pending or null');

  // Verify GET /api/orders/:id returns old order cleanly
  const oldDetailsRes = await request(`${API_BASE}/orders/${oldOrderDoc._id}`, {
    headers: { Authorization: `Bearer ${testToken}` }
  });
  assert(oldDetailsRes.status === 200, 'GET /api/orders/:id for historical order succeeds with 200');

  // Clean up the created historical test order
  await Order.findByIdAndDelete(oldOrderDoc._id);
  await mongoose.disconnect();

  // Summary
  console.log(`\n========================================`);
  console.log(`PAYMENT TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test Suite encountered error:', err);
  process.exit(1);
});
