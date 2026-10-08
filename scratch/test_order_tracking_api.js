const http = require('http');

function postJson(path, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'GET',
        headers
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('--- TESTING ORDER TRACKING ENDPOINT ---');

  // Register & login customer
  const email = `trackuser_${Date.now()}@example.com`;
  await postJson('/api/auth/register', {
    name: 'Tracking Shopper',
    email,
    password: 'password123'
  });
  const loginRes = await postJson('/api/auth/login', {
    email,
    password: 'password123'
  });
  const token = loginRes.data.token;
  console.log('✓ Registered & logged in customer:', email);

  // Get products
  const productsRes = await getJson('/api/products');
  const product = productsRes.data.data[0];

  // Add to cart
  await postJson('/api/cart', { productId: product._id, quantity: 2 }, { Authorization: `Bearer ${token}` });

  // Add address
  const addrRes = await postJson('/api/addresses', {
    fullName: 'Tracking Shopper',
    phone: '9876543210',
    addressLine1: '123 Tech Park',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    country: 'India',
    addressType: 'Home'
  }, { Authorization: `Bearer ${token}` });
  const addressId = addrRes.data.data._id;

  // Place order
  const orderRes = await postJson('/api/orders', {
    addressId,
    paymentMethod: 'UPI'
  }, { Authorization: `Bearer ${token}` });
  const order = orderRes.data.data;
  console.log('✓ Order created:', order._id, 'status:', order.status, 'payment:', order.paymentMethod);

  // 1. Valid Order ID with token
  const trackValid = await getJson(`/api/orders/${order._id}`, { Authorization: `Bearer ${token}` });
  if (trackValid.status === 200 && trackValid.data.success && trackValid.data.data._id === order._id) {
    console.log('✓ GET /api/orders/:id returned 200 with complete order info');
    console.log('  Items count:', trackValid.data.data.items.length);
    console.log('  Status:', trackValid.data.data.status);
    console.log('  Total amount:', trackValid.data.data.totalAmount);
  } else {
    console.error('❌ Failed valid order lookup:', trackValid);
    process.exit(1);
  }

  // 2. Unauthenticated lookup -> 401
  const trackNoAuth = await getJson(`/api/orders/${order._id}`);
  if (trackNoAuth.status === 401) {
    console.log('✓ GET /api/orders/:id without auth correctly returned 401 (prompts login in UI)');
  } else {
    console.error('❌ Expected 401 without auth, got:', trackNoAuth.status);
    process.exit(1);
  }

  // 3. Non-existent 24-character ID -> 404
  const fakeId = '65f000000000000000000000';
  const track404 = await getJson(`/api/orders/${fakeId}`, { Authorization: `Bearer ${token}` });
  if (track404.status === 404) {
    console.log('✓ GET /api/orders/:fakeId correctly returned 404 (handled gracefully in UI)');
  } else {
    console.error('❌ Expected 404 for non-existent order, got:', track404.status);
    process.exit(1);
  }

  // 4. Invalid ObjectId format -> 400
  const trackInvalid = await getJson('/api/orders/invalid123', { Authorization: `Bearer ${token}` });
  if (trackInvalid.status === 400) {
    console.log('✓ GET /api/orders/invalid123 correctly returned 400 (validation check passed)');
  } else {
    console.error('❌ Expected 400 for invalid format, got:', trackInvalid.status);
    process.exit(1);
  }

  console.log('========================================');
  console.log('ALL ORDER TRACKING TESTS PASSED 100%!');
  console.log('========================================');
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
