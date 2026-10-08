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

async function run() {
  console.log('--- TESTING ADMIN PAYMENT STATUS CONTROLS ---');

  // 1. Authenticate Admin
  let adminToken = null;
  const adminLoginRes = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@ministore.com', password: 'adminpassword123' })
  });

  if (adminLoginRes.ok && adminLoginRes.data && adminLoginRes.data.token) {
    adminToken = adminLoginRes.data.token;
  } else {
    // Try fallback
    const altAdmin = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@example.com', password: 'adminpassword123' })
    });
    if (altAdmin.ok && altAdmin.data && altAdmin.data.token) {
      adminToken = altAdmin.data.token;
    }
  }

  assert(Boolean(adminToken), 'Admin authenticated successfully');

  // 2. Register & login test customer
  const customerEmail = `admintest_cust_${Date.now()}@example.com`;
  await request(`${API_BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Admin Test Customer', email: customerEmail, password: 'password123' })
  });
  const custLogin = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: customerEmail, password: 'password123' })
  });
  const custToken = custLogin.data.token;
  const custUser = custLogin.data.user;

  // 3. Create address for customer
  const addrRes = await request(`${API_BASE}/addresses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({
      fullName: 'Admin Test Cust',
      phone: '9988776655',
      addressLine1: '404 MG Road',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
      addressType: 'Home'
    })
  });
  const addressId = addrRes.data.data._id;

  // 4. Get product and add to cart
  const prodsRes = await request(`${API_BASE}/products`);
  const product = prodsRes.data.data[0];
  await request(`${API_BASE}/cart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({ productId: product._id, quantity: 1 })
  });

  // 5. Place order with COD
  const orderRes = await request(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({ addressId, paymentMethod: 'COD' })
  });
  assert(orderRes.status === 201, 'Test order placed successfully');
  const orderId = orderRes.data.data._id;
  assert(orderRes.data.data.paymentStatus === 'Pending', 'Initial paymentStatus is Pending');

  // 6. Test Admin Updating paymentStatus to "Paid"
  console.log('\n[Admin Action] Updating paymentStatus to "Paid":');
  const payPaidRes = await request(`${API_BASE}/admin/orders/${orderId}/payment-status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ paymentStatus: 'Paid' })
  });
  assert(payPaidRes.status === 200, 'PUT /api/admin/orders/:id/payment-status returned 200 OK');
  assert(payPaidRes.data.data.paymentStatus === 'Paid', 'Order paymentStatus updated to Paid');
  assert(Boolean(payPaidRes.data.data.paymentUpdatedAt), 'Order paymentUpdatedAt was updated with timestamp');

  // 7. Verify Customer view reflects "Paid"
  console.log('\n[Customer Verification] Verifying order reflects "Paid" to customer:');
  const custOrderCheck = await request(`${API_BASE}/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${custToken}` }
  });
  assert(custOrderCheck.status === 200, 'Customer fetched order successfully');
  assert(custOrderCheck.data.data.paymentStatus === 'Paid', 'Customer sees updated paymentStatus as Paid');

  // 8. Test Admin Updating paymentStatus to "Failed"
  console.log('\n[Admin Action] Updating paymentStatus to "Failed":');
  const payFailedRes = await request(`${API_BASE}/admin/orders/${orderId}/payment-status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ paymentStatus: 'Failed' })
  });
  assert(payFailedRes.status === 200, 'PUT /api/admin/orders/:id/payment-status returned 200 OK');
  assert(payFailedRes.data.data.paymentStatus === 'Failed', 'Order paymentStatus updated to Failed');

  // 9. Test Combined Status + Payment Status update via /status route
  console.log('\n[Admin Action] Updating both fulfillment status and payment status:');
  const combinedRes = await request(`${API_BASE}/admin/orders/${orderId}/status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'Delivered', paymentStatus: 'Paid' })
  });
  assert(combinedRes.status === 200, 'PUT /api/admin/orders/:id/status with paymentStatus returned 200 OK');
  assert(combinedRes.data.data.status === 'Delivered', 'Order status is Delivered');
  assert(combinedRes.data.data.paymentStatus === 'Paid', 'Order paymentStatus is Paid');

  // 10. Security: Non-Admin Customer cannot call admin payment-status endpoint
  console.log('\n[Security] Verifying customer cannot update payment status:');
  const unauthorizedRes = await request(`${API_BASE}/admin/orders/${orderId}/payment-status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({ paymentStatus: 'Paid' })
  });
  assert(unauthorizedRes.status === 403, 'Customer blocked with 403 Forbidden on admin endpoint');

  // 11. Validation: Rejection of invalid payment status
  console.log('\n[Validation] Testing invalid payment status rejection:');
  const invalidStatusRes = await request(`${API_BASE}/admin/orders/${orderId}/payment-status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ paymentStatus: 'INVALID_STATUS' })
  });
  assert(invalidStatusRes.status === 400, 'Rejected invalid paymentStatus with 400 Bad Request');

  // 12. Validation: Non-existent order
  console.log('\n[Validation] Testing non-existent order ID:');
  const notFoundRes = await request(`${API_BASE}/admin/orders/507f1f77bcf86cd799439011/payment-status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ paymentStatus: 'Paid' })
  });
  assert(notFoundRes.status === 404, 'Non-existent order returned 404 Not Found');

  console.log(`\n========================================`);
  console.log(`ADMIN PAYMENT TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
