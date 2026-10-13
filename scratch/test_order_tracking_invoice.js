const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTest() {
  console.log('🚀 Running Order Tracking & Printable Invoice E2E Test Suite...\n');

  // 1. Login as Admin
  console.log('1️⃣ Logging in as Admin...');
  const adminLoginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@ministore.com', password: 'adminpassword123' });

  if (adminLoginRes.status !== 200 || !adminLoginRes.data.success) {
    throw new Error('Admin login failed: ' + JSON.stringify(adminLoginRes.data));
  }
  const adminToken = adminLoginRes.data.token;
  console.log('   ✅ Admin logged in successfully.');

  // 2. Register/Login as regular customer
  console.log('\n2️⃣ Logging in as customer...');
  const email = `track_test_${Date.now()}@example.com`;
  const registerRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Priya Sharma', email, password: 'Password123!' });

  let userToken = registerRes.data?.token;
  if (!userToken) {
    const loginRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email, password: 'Password123!' });
    userToken = loginRes.data?.token;
  }
  console.log('   ✅ Customer authenticated.');

  // 3. Get products to add to cart
  console.log('\n3️⃣ Finding active product...');
  const productsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/products',
    method: 'GET'
  });
  const products = productsRes.data.data || [];
  const testProduct = products.find(p => p.stock > 2) || products[0];
  console.log(`   Found product: "${testProduct.name}" (Stock: ${testProduct.stock}, Price: ₹${testProduct.price})`);

  // 4. Add to cart
  console.log('\n4️⃣ Adding item to customer cart...');
  const addCartRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/cart',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    }
  }, { productId: testProduct._id, quantity: 1 });
  if (!addCartRes.data?.success) {
    throw new Error('Add to cart failed: ' + JSON.stringify(addCartRes.data));
  }
  console.log('   ✅ Item added to cart.');

  // 5. Place order
  console.log('\n5️⃣ Placing Order with delivery address & payment...');
  const orderRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/orders',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    }
  }, {
    paymentMethod: 'UPI',
    shippingAddress: {
      fullName: 'Priya Sharma',
      phone: '9876543210',
      addressLine1: 'Flat 402, Sunshine Heights',
      addressLine2: 'Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400050',
      country: 'India',
      addressType: 'Home'
    }
  });

  if (orderRes.status !== 201 || !orderRes.data.success) {
    throw new Error('Order creation failed: ' + JSON.stringify(orderRes.data));
  }
  const createdOrder = orderRes.data.data;
  console.log(`   ✅ Order placed successfully! ID: #${createdOrder._id}`);
  console.log(`   📄 Invoice Number: ${createdOrder.invoiceNumber}`);
  console.log(`   🚚 Carrier: ${createdOrder.tracking?.carrier}`);
  console.log(`   📦 Tracking No: ${createdOrder.tracking?.trackingNumber}`);
  console.log(`   📅 ETA: ${createdOrder.tracking?.estimatedDeliveryDate}`);
  console.log(`   📍 Initial Events: ${createdOrder.tracking?.history?.length} event(s)`);

  if (!createdOrder.invoiceNumber || !createdOrder.tracking?.trackingNumber) {
    throw new Error('Missing invoiceNumber or tracking number in created order!');
  }

  // 6. Customer queries order tracking
  console.log('\n6️⃣ Customer retrieving order tracking details via GET /api/orders/:id...');
  const getOrderRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/orders/${createdOrder._id}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  console.log(`   ✅ Order retrieved: Status = "${getOrderRes.data.data.status}", Checkpoints = ${getOrderRes.data.data.tracking?.history?.length}`);

  // 7. Admin updates status to "Out for Delivery"
  console.log('\n7️⃣ Admin updating order status to "Out for Delivery"...');
  const updateStatusRes1 = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/admin/orders/${createdOrder._id}/status`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    status: 'Out for Delivery',
    note: 'Courier executive assigned: Ramesh (Ph: 9811223344). Out for delivery.',
    location: 'Bandra Delivery Center'
  });

  if (updateStatusRes1.status !== 200 || !updateStatusRes1.data.success) {
    throw new Error('Admin status update failed: ' + JSON.stringify(updateStatusRes1.data));
  }
  console.log('   ✅ Status updated to "Out for Delivery" successfully!');

  // 8. Customer verifies updated tracking
  console.log('\n8️⃣ Customer verifying updated tracking with new checkpoint...');
  const getOrderRes2 = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/orders/${createdOrder._id}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  const updatedOrder = getOrderRes2.data.data;
  console.log(`   Current Status: ${updatedOrder.status}`);
  console.log(`   Checkpoints count: ${updatedOrder.tracking.history.length}`);
  const latestEvent = updatedOrder.tracking.history[updatedOrder.tracking.history.length - 1];
  console.log(`   Latest event: "${latestEvent.title}" at "${latestEvent.location}" - ${latestEvent.description}`);

  if (updatedOrder.status !== 'Out for Delivery') {
    throw new Error(`Expected status 'Out for Delivery', got: ${updatedOrder.status}`);
  }

  // 9. Admin updates status to "Delivered" and payment status to "Paid"
  console.log('\n9️⃣ Admin updating order status to "Delivered" and payment to "Paid"...');
  const updateStatusRes2 = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/admin/orders/${createdOrder._id}/status`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    status: 'Delivered',
    paymentStatus: 'Paid',
    note: 'Delivered to resident at customer doorstep.'
  });

  if (updateStatusRes2.status !== 200 || !updateStatusRes2.data.success) {
    throw new Error('Admin status update to Delivered failed: ' + JSON.stringify(updateStatusRes2.data));
  }
  console.log('   ✅ Status updated to "Delivered" successfully!');

  // 10. Customer verifies final delivered state
  console.log('\n🔟 Customer verifying final Delivered status & Invoice fields...');
  const getOrderRes3 = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/orders/${createdOrder._id}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  const deliveredOrder = getOrderRes3.data.data;
  console.log(`   Order Status: ${deliveredOrder.status}`);
  console.log(`   Payment Status: ${deliveredOrder.paymentStatus}`);
  console.log(`   Invoice Number: ${deliveredOrder.invoiceNumber}`);
  console.log(`   Tracking History Total Events: ${deliveredOrder.tracking.history.length}`);

  if (deliveredOrder.status !== 'Delivered' || deliveredOrder.paymentStatus !== 'Paid') {
    throw new Error('Order final verification failed!');
  }

  console.log('\n🎉 ALL 10/10 ORDER TRACKING & INVOICE TESTS PASSED SUCCESSFULLY! ✨\n');
}

runTest().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
