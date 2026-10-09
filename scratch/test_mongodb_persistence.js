/**
 * Comprehensive Automated Verification Suite for:
 * Persistent MongoDB Storage for Products, Images, and Users
 */

const http = require('http');

const API_BASE = 'http://localhost:5000/api';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', err => reject(err));
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function checkImage(urlPath) {
  return new Promise((resolve) => {
    const url = new URL(urlPath.startsWith('http') ? urlPath : `http://localhost:5000${urlPath}`);
    const client = url.protocol === 'https:' ? require('https') : require('http');
    const req = client.get(url, (res) => {
      resolve({ status: res.statusCode, contentType: res.headers['content-type'] });
    });
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
  });
}

async function runTestSuite() {
  console.log('====================================================');
  console.log(' STARTING PERSISTENT MONGODB SUITE VERIFICATION     ');
  console.log('====================================================\n');

  let passes = 0;
  let fails = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passes++;
    } else {
      console.error(`[FAIL] ${message}`);
      fails++;
    }
  }

  try {
    // 1. Health check & DB connection
    console.log('--- TEST 1: Health Endpoint & MongoDB Status ---');
    const health = await request('GET', '/health');
    assert(health.status === 200, 'Health endpoint responds with 200 OK');
    assert(health.data.database === 'connected', 'Database reports "connected" status');

    // 2. Products retrieval from MongoDB
    console.log('\n--- TEST 2: Product Retrieval & Pagination from MongoDB ---');
    const productsRes = await request('GET', '/products?page=1&limit=12');
    assert(productsRes.status === 200, 'GET /api/products returns 200 OK');
    assert(productsRes.data.success === true, 'Response success is true');
    assert(productsRes.data.count === 12, 'Pagination limit returns 12 items on page 1');
    assert(productsRes.data.pagination.totalProducts === 58, `Total products in MongoDB is 58 (actual: ${productsRes.data.pagination.totalProducts})`);
    assert(Array.isArray(productsRes.data.categories) && productsRes.data.categories.length === 5, '5 Distinct categories returned');

    // 3. Verify single product detail has full persistent fields
    console.log('\n--- TEST 3: Product Document Schema & Persistence ---');
    const firstProd = productsRes.data.data[0];
    const detailRes = await request('GET', `/products/${firstProd._id}`);
    assert(detailRes.status === 200, `GET /api/products/${firstProd._id} returns 200 OK`);
    const p = detailRes.data.data;
    assert(p.name && p.title, `Product has name ("${p.name}") and title ("${p.title}")`);
    assert(p.brand === 'MiniStore', `Product has brand "${p.brand}"`);
    assert(p.sku && p.sku.startsWith('MS-'), `Product has structured SKU "${p.sku}"`);
    assert(p.inStock === true, 'Product inStock boolean is correctly set');
    assert(Array.isArray(p.images) && p.images.length > 0, `Product gallery images has ${p.images?.length} items`);
    assert(p.createdAt && p.updatedAt, 'Timestamps createdAt/updatedAt are present');

    // 4. Image accessibility check (both local and remote)
    console.log('\n--- TEST 4: Product Image Reliability & Static Serving ---');
    const localImgRes = await checkImage('/images/streaming_webcam.jpg');
    assert(localImgRes.status === 200, `Local image /images/streaming_webcam.jpg serves 200 OK (${localImgRes.contentType})`);
    const shakerImgRes = await checkImage('/images/stainless_steel_shaker.jpg');
    assert(shakerImgRes.status === 200, `Local image /images/stainless_steel_shaker.jpg serves 200 OK (${shakerImgRes.contentType})`);
    const remoteImgRes = await checkImage('https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80');
    assert(remoteImgRes.status === 200, `Remote Unsplash image serves 200 OK (${remoteImgRes.contentType})`);

    // 5. Search autocomplete from MongoDB
    console.log('\n--- TEST 5: Autocomplete & Search Filtering ---');
    const searchRes = await request('GET', '/products/suggestions?q=watch');
    assert(searchRes.status === 200, 'GET /api/products/suggestions?q=watch returns 200');
    assert(searchRes.data.data.length > 0, `Returned ${searchRes.data.data.length} matches for "watch"`);
    assert(searchRes.data.data.some(item => item.name.toLowerCase().includes('watch')), 'Contains matching product');

    // Category filter
    const catRes = await request('GET', '/products?category=Electronics&all=true');
    assert(catRes.status === 200, 'Category filter returns 200');
    assert(catRes.data.count === 13, `Electronics count is 13 (actual: ${catRes.data.count})`);

    // 6. User Registration & Persistence
    console.log('\n--- TEST 6: User Registration & Persistence in MongoDB ---');
    const testEmail = `persisted_test_${Date.now()}@example.com`;
    const regRes = await request('POST', '/auth/register', {
      name: 'Test Persistence User',
      email: testEmail,
      password: 'SecurePassword123'
    });
    assert(regRes.status === 201, `Registration returns 201 Created for ${testEmail}`);
    assert(regRes.data.success === true, 'Registration success is true');
    assert(regRes.data.data.email === testEmail, 'Email matches');
    assert(!regRes.data.data.password, 'Password hash is NOT exposed in response');

    // 7. Duplicate user prevention
    console.log('\n--- TEST 7: Duplicate Account Prevention ---');
    const dupRes = await request('POST', '/auth/register', {
      name: 'Another User',
      email: testEmail,
      password: 'SecurePassword123'
    });
    assert(dupRes.status === 400, 'Duplicate registration rejected with 400 Bad Request');
    assert(dupRes.data.message.includes('already registered'), 'Proper duplicate error message');

    // 8. User Login & Profile JWT
    console.log('\n--- TEST 8: Authentication & Profile Retrieval ---');
    const loginRes = await request('POST', '/auth/login', {
      email: testEmail,
      password: 'SecurePassword123'
    });
    assert(loginRes.status === 200, 'Login returns 200 OK');
    assert(!!loginRes.data.token, 'JWT Token provided');
    const token = loginRes.data.token;

    // Check profile
    const profileRes = await request('GET', '/auth/profile', null, { Authorization: `Bearer ${token}` });
    assert(profileRes.status === 200, 'GET /api/auth/profile returns 200 OK');
    assert(profileRes.data.data.email === testEmail, 'Profile returns correct email');
    assert(profileRes.data.data.status === 'active', 'Profile status is "active"');
    assert(!profileRes.data.data.password, 'Password never exposed in profile endpoint');

    // Clean up test user
    const mongoose = require('../backend/node_modules/mongoose');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mini_ecommerce');
    await mongoose.connection.collection('users').deleteOne({ email: testEmail });
    await mongoose.disconnect();
    console.log(`[CLEANUP] Deleted ephemeral test user ${testEmail}`);

    // Summary
    console.log('\n====================================================');
    console.log(` RESULTS: ${passes} PASSED, ${fails} FAILED`);
    console.log('====================================================');
    process.exit(fails > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test suite uncaught error:', err);
    process.exit(1);
  }
}

runTestSuite();
