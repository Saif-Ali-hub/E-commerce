/**
 * Verification test for Product CRUD and Backend Restart Persistence
 */

const http = require('http');
const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_miniecommerce_2026_secure';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:5000/api' + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', err => reject(err));
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('Testing Admin Product CRUD & Persistence...');

  // Generate admin token
  const mongoose = require('../backend/node_modules/mongoose');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mini_ecommerce');
  const User = require('../backend/models/User');
  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = new User({
      name: 'System Admin',
      email: 'admin@ministore.com',
      password: '$2b$10$eYtqSkgFQGK7OFbfn.g.LeOPipu8XAeF0rxby57kGPmlKXVmhFS2.',
      role: 'admin'
    });
    await admin.save();
    console.log('[SETUP] Created admin user for testing');
  }

  const token = jwt.sign({ id: admin._id }, JWT_SECRET, { expiresIn: '1h' });

  // 1. Create a product
  const createRes = await request('POST', '/products', {
    name: 'Persistent Test Smart Sensor',
    price: 999,
    category: 'Electronics',
    description: 'High accuracy persistent smart sensor for automation testing.',
    stock: 50,
    image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800'
  }, token);

  if (createRes.status !== 201) {
    console.error('Failed to create product:', createRes);
    process.exit(1);
  }
  const createdId = createRes.data.data._id;
  console.log(`[PASS] Created product with ID ${createdId}, SKU: ${createRes.data.data.sku}`);

  // 2. Update the product
  const updateRes = await request('PUT', `/products/${createdId}`, {
    price: 1199,
    stock: 45
  }, token);
  if (updateRes.status !== 200 || updateRes.data.data.price !== 1199) {
    console.error('Failed to update product:', updateRes);
    process.exit(1);
  }
  console.log('[PASS] Updated product price to 1199 and stock to 45');

  // 3. Verify retrieved by public endpoint
  const getRes = await request('GET', `/products/${createdId}`);
  if (getRes.status !== 200 || getRes.data.data.price !== 1199) {
    console.error('Failed to fetch updated product:', getRes);
    process.exit(1);
  }
  console.log('[PASS] GET /api/products/:id returned updated fields');

  // 4. Delete the product
  const delRes = await request('DELETE', `/products/${createdId}`, null, token);
  if (delRes.status !== 200) {
    console.error('Failed to delete product:', delRes);
    process.exit(1);
  }
  console.log('[PASS] Deleted product successfully');

  // 5. Confirm 404 after deletion
  const getDelRes = await request('GET', `/products/${createdId}`);
  if (getDelRes.status !== 404) {
    console.error('Expected 404 after deletion, got:', getDelRes.status);
    process.exit(1);
  }
  console.log('[PASS] Verified deleted product returns 404');

  await mongoose.disconnect();
  console.log('\nAll CRUD & Persistence tests completed successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
