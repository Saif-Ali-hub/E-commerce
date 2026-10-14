/**
 * Comprehensive Automated Verification Suite for:
 * Secure Customer Order Cancellation (PUT /api/orders/:id/cancel)
 *
 * Covers all 11 required scenarios:
 * 1. Customer successfully cancels their own Pending order.
 * 2. Customer cannot cancel another user's order (403).
 * 3. Admin can cancel another user's Pending order.
 * 4. Non-Pending orders cannot be cancelled (400).
 * 5. Missing order (404), invalid format (400), unauthenticated (401).
 * 6. Stock is restored by exact purchased quantity ($inc: { stock: quantity }, inStock: true).
 * 7. Wallet refund is correct when walletDiscount > 0 (credit transaction recorded).
 * 8. No wallet refund occurs when walletDiscount is zero.
 * 9. Tracking history contains exact event 'Order Cancelled by Customer' with timestamp.
 * 10. Repeated and concurrent requests do not duplicate stock restoration or wallet credits.
 * 11. Failures during cancellation are recoverable and do not silently corrupt state.
 */

const path = require('path');
const dotenv = require('../backend/node_modules/dotenv');
const mongoose = require('../backend/node_modules/mongoose');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const API_BASE = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const combinedHeaders = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: combinedHeaders
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

let passed = 0;
let failed = 0;

function assert(condition, description, details = '') {
  if (condition) {
    console.log(`  ✓ ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description} ${details ? `(${details})` : ''}`);
    failed++;
  }
}

async function runSuite() {
  console.log('====================================================');
  console.log(' STARTING SECURE ORDER CANCELLATION TEST SUITE     ');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/E-commerce';
  await mongoose.connect(mongoUri);

  const User = mongoose.model('User', require('../backend/models/User').schema);
  const Product = mongoose.model('Product', require('../backend/models/Product').schema);
  const Order = mongoose.model('Order', require('../backend/models/Order').schema);
  const Address = mongoose.model('Address', require('../backend/models/Address').schema);

  const uniqueSuffix = Date.now();

  // 1. Setup isolated test users
  const custAEmail = `cust_a_${uniqueSuffix}@example.com`;
  const custBEmail = `cust_b_${uniqueSuffix}@example.com`;
  const adminEmail = `admin_cancel_${uniqueSuffix}@example.com`;
  const testPassword = 'Password123';

  // Register Customer A
  const regARes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Customer A', email: custAEmail, password: testPassword, phone: '9876543211' })
  });
  assert(regARes.status === 201, 'Registered Customer A');
  const loginARes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: custAEmail, password: testPassword })
  });
  const tokenA = loginARes.data.token;
  const userAId = loginARes.data.user.id;

  // Register Customer B
  const regBRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Customer B', email: custBEmail, password: testPassword, phone: '9876543212' })
  });
  assert(regBRes.status === 201, 'Registered Customer B');
  const loginBRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: custBEmail, password: testPassword })
  });
  const tokenB = loginBRes.data.token;
  const userBId = loginBRes.data.user.id;

  // Register Admin user and promote role
  const regAdminRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Admin User', email: adminEmail, password: testPassword, phone: '9876543213' })
  });
  assert(regAdminRes.status === 201, 'Registered Admin user');
  await User.updateOne({ email: adminEmail }, { role: 'admin' });
  const loginAdminRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: testPassword })
  });
  const tokenAdmin = loginAdminRes.data.token;

  // Create isolated test products
  const testProduct1 = new Product({
    name: `Cancellation Test Product 1 ${uniqueSuffix}`,
    price: 500,
    category: 'Electronics',
    stock: 20,
    inStock: true
  });
  await testProduct1.save();

  const testProduct2 = new Product({
    name: `Cancellation Test Product 2 ${uniqueSuffix}`,
    price: 300,
    category: 'Home',
    stock: 15,
    inStock: true
  });
  await testProduct2.save();

  // Add delivery address for Customer A
  const addrARes = await request('/addresses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      fullName: 'Customer A',
      phone: '9876543211',
      addressLine1: '123 Market Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'India',
      addressType: 'Home'
    })
  });
  const addressAId = addrARes.data.data._id;

  // Add delivery address for Customer B
  const addrBRes = await request('/addresses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({
      fullName: 'Customer B',
      phone: '9876543212',
      addressLine1: '456 Commercial Road',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001',
      country: 'India',
      addressType: 'Work'
    })
  });
  const addressBId = addrBRes.data.data._id;

  // Helper to place an order for Customer A
  async function placeOrderA(quantity = 2, useWallet = false) {
    // Set cart
    await request('/cart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ productId: testProduct1._id.toString(), quantity })
    });

    const res = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        addressId: addressAId,
        paymentMethod: 'COD',
        useWallet
      })
    });
    return res.data.data;
  }

  console.log('\n--- Test Scenario 1: Customer cancels their own Pending order ---');
  {
    const order = await placeOrderA(2, false);
    assert(order && order.status === 'Pending', 'Order created with Pending status');

    const cancelRes = await request(`/orders/${order._id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert(cancelRes.status === 200, 'Customer cancellation returned HTTP 200', cancelRes.status);
    assert(cancelRes.data.success === true, 'Response success is true');
    assert(cancelRes.data.data.status === 'Cancelled', 'Returned order status is Cancelled');

    const fetchedOrder = await Order.findById(order._id);
    assert(fetchedOrder.status === 'Cancelled', 'Database order status updated to Cancelled');
  }

  console.log('\n--- Test Scenario 2: Customer cannot cancel another user\'s order (403) ---');
  {
    const orderA = await placeOrderA(1, false);

    // Customer B attempts to cancel Customer A's order
    const cancelRes = await request(`/orders/${orderA._id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenB}` }
    });

    assert(cancelRes.status === 403, 'Unauthorized cancellation returns HTTP 403', cancelRes.status);
    assert(cancelRes.data.success === false, 'Response success is false');

    const orderStillPending = await Order.findById(orderA._id);
    assert(orderStillPending.status === 'Pending', 'Order status remains Pending in database');
  }

  console.log('\n--- Test Scenario 3: Admin can cancel another user\'s Pending order ---');
  {
    const orderA = await placeOrderA(1, false);

    // Admin cancels Customer A's order
    const cancelRes = await request(`/orders/${orderA._id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });

    assert(cancelRes.status === 200, 'Admin cancellation returned HTTP 200', cancelRes.status);
    assert(cancelRes.data.success === true, 'Response success is true');
    assert(cancelRes.data.data.status === 'Cancelled', 'Order status is Cancelled');
  }

  console.log('\n--- Test Scenario 4: Non-Pending orders cannot be cancelled (400) ---');
  {
    const orderA = await placeOrderA(1, false);

    // Simulate order advanced to 'Processing'
    await Order.findByIdAndUpdate(orderA._id, { status: 'Processing' });

    const cancelRes = await request(`/orders/${orderA._id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert(cancelRes.status === 400, 'Cancelling Processing order returns HTTP 400', cancelRes.status);
    assert(cancelRes.data.success === false, 'Response success is false');

    // Simulate order advanced to 'Delivered'
    await Order.findByIdAndUpdate(orderA._id, { status: 'Delivered' });
    const cancelDeliveredRes = await request(`/orders/${orderA._id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(cancelDeliveredRes.status === 400, 'Cancelling Delivered order returns HTTP 400', cancelDeliveredRes.status);

    // Admin also cannot cancel a non-pending order
    const adminCancelDeliveredRes = await request(`/orders/${orderA._id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    assert(adminCancelDeliveredRes.status === 400, 'Admin cannot cancel non-Pending order (HTTP 400)', adminCancelDeliveredRes.status);
  }

  console.log('\n--- Test Scenario 5: Missing order (404), invalid format (400), unauthenticated (401) ---');
  {
    // Non-existent 24-character ID
    const fakeId = new mongoose.Types.ObjectId().toString();
    const missingRes = await request(`/orders/${fakeId}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(missingRes.status === 404, 'Missing order returns HTTP 404', missingRes.status);
    assert(missingRes.data.message === 'Order not found', 'Correct error message for missing order');

    // Invalid format ID
    const invalidIdRes = await request(`/orders/invalid_id_123/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(invalidIdRes.status === 400, 'Invalid ID format returns HTTP 400', invalidIdRes.status);

    // Unauthenticated request
    const noAuthRes = await request(`/orders/${fakeId}/cancel`, {
      method: 'PUT'
    });
    assert(noAuthRes.status === 401, 'Unauthenticated request returns HTTP 401', noAuthRes.status);
  }

  console.log('\n--- Test Scenario 6: Stock is restored by exact purchased quantity ---');
  {
    const productBefore = await Product.findById(testProduct1._id);
    const initialStock = productBefore.stock;
    const purchasedQty = 3;

    // Place order
    const order = await placeOrderA(purchasedQty, false);

    const productAfterPurchase = await Product.findById(testProduct1._id);
    assert(productAfterPurchase.stock === initialStock - purchasedQty, `Stock decremented on order placement (from ${initialStock} to ${productAfterPurchase.stock})`);

    // Cancel order
    const cancelRes = await request(`/orders/${order._id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(cancelRes.status === 200, 'Cancellation succeeded (HTTP 200)');

    const productAfterCancel = await Product.findById(testProduct1._id);
    assert(productAfterCancel.stock === initialStock, `Stock restored to exact original quantity (${productAfterCancel.stock} === ${initialStock})`);
    assert(productAfterCancel.inStock === true, 'Product inStock is true');
  }

  console.log('\n--- Test Scenario 7: Wallet refund is correct when walletDiscount > 0 ---');
  {
    // Give Customer A wallet balance of ₹200
    await User.findByIdAndUpdate(userAId, {
      $set: { walletBalance: 200 },
      $push: {
        walletTransactions: {
          type: 'credit',
          amount: 200,
          coins: 0,
          description: 'Test Wallet Balance Setup',
          referenceId: 'TEST_INIT',
          date: new Date()
        }
      }
    });

    // Place order with useWallet: true (item: ₹500, max wallet allowed = 50% = ₹200)
    const order = await placeOrderA(1, true);
    assert(order.walletDiscount > 0, `Wallet discount applied: ₹${order.walletDiscount}`);

    const userAfterOrder = await User.findById(userAId);
    const expectedBalanceAfterOrder = 200 - order.walletDiscount;
    assert(Math.abs(userAfterOrder.walletBalance - expectedBalanceAfterOrder) < 0.01, `Wallet deducted during order: ₹${userAfterOrder.walletBalance}`);

    // Cancel order
    const cancelRes = await request(`/orders/${order._id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(cancelRes.status === 200, 'Order cancelled successfully (HTTP 200)');

    const userAfterCancel = await User.findById(userAId);
    assert(Math.abs(userAfterCancel.walletBalance - 200) < 0.01, `Wallet balance restored to ₹200 (actual: ${userAfterCancel.walletBalance})`);

    // Verify transaction ledger
    const refundTxn = userAfterCancel.walletTransactions.find(
      t => t.type === 'credit' && String(t.referenceId) === `REFUND_${order._id}`
    );
    assert(refundTxn !== undefined, 'Credit refund transaction exists in walletTransactions');
    assert(refundTxn && refundTxn.amount === order.walletDiscount, `Refund transaction amount matches walletDiscount (₹${refundTxn?.amount})`);
    assert(refundTxn && refundTxn.description.includes(String(order._id)), 'Refund description references order ID');
  }

  console.log('\n--- Test Scenario 8: No wallet refund occurs when walletDiscount is zero ---');
  {
    const userBefore = await User.findById(userAId);
    const initialWallet = userBefore.walletBalance;

    // Place order with useWallet: false
    const order = await placeOrderA(1, false);
    assert(order.walletDiscount === 0, 'Order has walletDiscount: 0');

    // Cancel order
    const cancelRes = await request(`/orders/${order._id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(cancelRes.status === 200, 'Order cancelled successfully');

    const userAfter = await User.findById(userAId);
    assert(userAfter.walletBalance === initialWallet, `Wallet balance unchanged (${userAfter.walletBalance} === ${initialWallet})`);
    const newRefundTxns = userAfter.walletTransactions.filter(
      t => t.type === 'credit' && String(t.referenceId) === `REFUND_${order._id}`
    );
    assert(newRefundTxns.length === 0, 'No wallet refund transaction was created');
  }

  console.log('\n--- Test Scenario 9: Tracking history contains exact cancellation event ---');
  {
    const order = await placeOrderA(1, false);
    const cancelRes = await request(`/orders/${order._id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(cancelRes.status === 200, 'Order cancelled');

    const history = cancelRes.data.data.tracking.history;
    assert(Array.isArray(history) && history.length > 0, 'Tracking history is an array with events');

    const cancelEvent = history.find(e =>
      e.title === 'Order Cancelled by Customer' || e.description === 'Order Cancelled by Customer'
    );
    assert(cancelEvent !== undefined, 'Exact event text "Order Cancelled by Customer" found in history');
    assert(cancelEvent && cancelEvent.status === 'Cancelled', 'Cancellation event has status "Cancelled"');
    assert(cancelEvent && cancelEvent.timestamp, 'Cancellation event contains valid timestamp');
  }

  console.log('\n--- Test Scenario 10: Repeated and concurrent requests do not duplicate stock or wallet credits ---');
  {
    // Setup initial stock and wallet
    await Product.findByIdAndUpdate(testProduct2._id, { $set: { stock: 10, inStock: true } });
    await User.findByIdAndUpdate(userAId, { $set: { walletBalance: 150 } });

    // Place order with 2 units and wallet usage
    await request('/cart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ productId: testProduct2._id.toString(), quantity: 2 })
    });
    const orderRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        addressId: addressAId,
        paymentMethod: 'COD',
        useWallet: true
      })
    });
    const order = orderRes.data.data;
    assert(order && order.walletDiscount > 0, `Order placed with wallet discount: ₹${order?.walletDiscount}`);

    const stockAfterOrder = (await Product.findById(testProduct2._id)).stock;
    assert(stockAfterOrder === 8, 'Stock was decremented by 2 to 8');
    const walletAfterOrder = (await User.findById(userAId)).walletBalance;

    // Fire 6 concurrent cancellation requests simultaneously
    const concurrentRequests = Array(6).fill(null).map(() =>
      request(`/orders/${order._id}/cancel`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}` }
      })
    );

    const results = await Promise.all(concurrentRequests);
    const successCount = results.filter(r => r.status === 200).length;
    const failureCount = results.filter(r => r.status === 400).length;

    assert(successCount === 1, `Exactly 1 concurrent request succeeded (HTTP 200: ${successCount})`);
    assert(failureCount === 5, `Remaining 5 concurrent requests returned HTTP 400 (Count: ${failureCount})`);

    // Verify stock was restored ONLY ONCE (8 + 2 = 10, NOT 8 + 12)
    const stockAfterConcurrent = (await Product.findById(testProduct2._id)).stock;
    assert(stockAfterConcurrent === 10, `Stock restored exactly once (actual: ${stockAfterConcurrent}, expected: 10)`);

    // Verify wallet was credited ONLY ONCE
    const userAfterConcurrent = await User.findById(userAId);
    const expectedFinalWallet = walletAfterOrder + order.walletDiscount;
    assert(Math.abs(userAfterConcurrent.walletBalance - expectedFinalWallet) < 0.01, `Wallet credited exactly once (actual: ₹${userAfterConcurrent.walletBalance}, expected: ₹${expectedFinalWallet})`);

    const refundTxns = userAfterConcurrent.walletTransactions.filter(
      t => t.type === 'credit' && String(t.referenceId) === `REFUND_${order._id}`
    );
    assert(refundTxns.length === 1, `Exactly 1 credit transaction exists for this order (actual: ${refundTxns.length})`);

    // Sequential retry: another cancellation request after completion
    const repeatedRes = await request(`/orders/${order._id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(repeatedRes.status === 400, 'Repeated sequential cancellation returned HTTP 400');

    // Confirm state remains untouched after repeated call
    const stockAfterRepeat = (await Product.findById(testProduct2._id)).stock;
    assert(stockAfterRepeat === 10, 'Stock still exactly 10 after repeated call');
  }

  console.log('\n--- Test Scenario 11: Missing product and failure recovery handling ---');
  {
    // Test: Missing product in order items (e.g. deleted from catalog)
    // Create temporary product, order it, then delete product from catalog
    const tempProduct = new Product({
      name: `Temp Product ${uniqueSuffix}`,
      price: 250,
      category: 'Sports',
      stock: 5,
      inStock: true
    });
    await tempProduct.save();

    await request('/cart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ productId: tempProduct._id.toString(), quantity: 1 })
    });
    const tempOrderRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        addressId: addressAId,
        paymentMethod: 'COD'
      })
    });
    const tempOrder = tempOrderRes.data.data;

    // Delete product from catalog to simulate missing product
    await Product.findByIdAndDelete(tempProduct._id);

    // Cancel order containing missing product
    const cancelMissingProdRes = await request(`/orders/${tempOrder._id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert(cancelMissingProdRes.status === 200, 'Cancellation succeeds gracefully despite missing catalog product (HTTP 200)');
    // Compensating rollback verification:
    // Create an order with Item 1 (valid product) and Item 2 (invalid product ID that triggers CastError)
    const stockBeforeFailureTest = (await Product.findById(testProduct1._id)).stock;
    const failureOrder = new Order({
      user: userAId,
      items: [
        {
          product: testProduct1._id,
          name: 'Valid Product',
          price: 100,
          quantity: 2,
          subtotal: 200
        },
        {
          product: 'TRIGGER_CAST_ERROR_FAIL',
          name: 'Faulty Product',
          price: 50,
          quantity: 1,
          subtotal: 50
        }
      ],
      totalAmount: 250,
      walletDiscount: 50,
      status: 'Pending',
      shippingAddress: {
        fullName: 'Test User',
        phone: '9876543210',
        addressLine1: 'Test Address',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001'
      }
    });
    await failureOrder.save();

    // Attempt cancellation on the failureOrder
    const failureCancelRes = await request(`/orders/${failureOrder._id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert(failureCancelRes.status === 500, 'Partial failure returns HTTP 500', failureCancelRes.status);
    assert(failureCancelRes.data.success === false, 'Partial failure response success is false');

    // Verify compensating rollback: Item 1 stock must NOT remain incremented
    const stockAfterRollback = (await Product.findById(testProduct1._id)).stock;
    assert(stockAfterRollback === stockBeforeFailureTest, `Compensating rollback restored Product 1 stock (${stockAfterRollback} === ${stockBeforeFailureTest})`);

    // Verify order status was safely reverted to 'Pending'
    const orderAfterRollback = await Order.findById(failureOrder._id);
    assert(orderAfterRollback.status === 'Pending', 'Order status was safely reverted to Pending');

    // Clean up failure order
    await Order.findByIdAndDelete(failureOrder._id);
  }

  // Clean up isolated test data
  console.log('\n--- Cleaning up isolated test data ---');
  try {
    await Product.deleteMany({ _id: { $in: [testProduct1._id, testProduct2._id] } });
    await User.deleteMany({ email: { $in: [custAEmail, custBEmail, adminEmail] } });
    await Address.deleteMany({ _id: { $in: [addressAId, addressBId] } });
    await Order.deleteMany({ user: { $in: [userAId, userBId] } });
    console.log('✓ Isolated test data successfully cleaned up');
  } catch (cleanErr) {
    console.warn('Non-fatal cleanup warning:', cleanErr.message);
  }

  await mongoose.disconnect();

  console.log('\n====================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal error during test suite execution:', err);
  process.exit(1);
});
