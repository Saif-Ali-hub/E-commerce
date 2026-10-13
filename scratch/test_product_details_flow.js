const http = require('http');
const path = require('path');
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));

const BASE_URL = 'http://localhost:5000';
const API_URL = 'http://localhost:5000/api';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/e-commerce';

function httpRequest(urlStr, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    let dataString = null;
    if (body !== null) {
      dataString = typeof body === 'string' ? body : JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: data });
      });
    });
    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

async function runTests() {
  console.log('====================================================');
  console.log(' PRODUCT DETAILS DEDICATED PAGE VERIFICATION SUITE  ');
  console.log('====================================================\n');

  // 1. Static asset serving
  console.log('--- 1. Dedicated Page Serving & Navigation ---');
  const pageRes = await httpRequest(`${BASE_URL}/product-details.html`);
  assert(pageRes.status === 200, 'GET /product-details.html returns 200 OK');
  assert(pageRes.headers['content-type'].includes('text/html'), 'Content-type is text/html');
  assert(pageRes.raw.includes('product-page-grid'), 'HTML contains product-page-grid layout');
  assert(pageRes.raw.includes('product-details.js'), 'HTML scripts product-details.js');
  assert(pageRes.raw.includes('id="pd-error-state"'), 'HTML contains product error/not-found container');
  assert(pageRes.raw.includes('id="pd-loading-state"'), 'HTML contains loading skeleton');
  assert(pageRes.raw.includes('id="pd-add-cart-btn"'), 'HTML contains Add to Cart button');
  assert(pageRes.raw.includes('id="pd-wishlist-btn"'), 'HTML contains Wishlist button');

  const jsRes = await httpRequest(`${BASE_URL}/product-details.js`);
  assert(jsRes.status === 200, 'GET /product-details.js returns 200 OK');
  assert(jsRes.raw.includes('loadProductDetails'), 'product-details.js contains loadProductDetails logic');
  assert(jsRes.raw.includes('formatProductImageUrl'), 'product-details.js contains image formatting logic');

  // Check frontend/app.js updated navigation
  const appJsRes = await httpRequest(`${BASE_URL}/app.js`);
  assert(appJsRes.status === 200, 'GET /app.js returns 200 OK');
  assert(appJsRes.raw.includes('window.location.href = `product-details.html?id='), 'app.js openProductDetails navigates to product-details.html?id=...');

  // 2. Fetch real products from database to test navigation
  console.log('\n--- 2. Real Product Details Loading ---');
  const prodsRes = await httpRequest(`${API_URL}/products?limit=5`);
  assert(prodsRes.status === 200, 'GET /api/products returns 200 OK');
  const products = prodsRes.data.products;
  assert(products.length >= 2, 'Found at least 2 products for testing');

  const prod1 = products[0];
  const prod2 = products[1];

  // Test loading real product 1 via API endpoint used by product-details.js
  const detailRes1 = await httpRequest(`${API_URL}/products/${prod1._id}`);
  assert(detailRes1.status === 200, `GET /api/products/${prod1._id} returns 200 OK`);
  assert(detailRes1.data.success === true, 'Response indicates success');
  assert(detailRes1.data.data.name === prod1.name, `Loaded product 1 name matches: "${prod1.name}"`);
  assert(typeof detailRes1.data.data.price === 'number', 'Price is a valid number');
  assert(detailRes1.data.data.stock !== undefined, 'Stock is defined');

  // Test loading real product 2
  const detailRes2 = await httpRequest(`${API_URL}/products/${prod2._id}`);
  assert(detailRes2.status === 200, `GET /api/products/${prod2._id} returns 200 OK`);
  assert(detailRes2.data.data.name === prod2.name, `Loaded product 2 name matches: "${prod2.name}"`);

  // Test related products API
  const relRes = await httpRequest(`${API_URL}/products/${prod1._id}/related?limit=4`);
  assert(relRes.status === 200, 'GET /api/products/:id/related returns 200 OK');
  assert(Array.isArray(relRes.data.data), 'Related products is an array');

  // 3. Error and Invalid ID handling
  console.log('\n--- 3. Error & Invalid/Nonexistent ID Handling ---');
  // Invalid format (not a 24-char ObjectId)
  const invalidIdRes = await httpRequest(`${API_URL}/products/invalid-id-12345`);
  assert(invalidIdRes.status === 400, 'Invalid product ID format returns 400 Bad Request');

  // Valid 24-char hex format but nonexistent in database
  const nonExistentId = '660000000000000000000000';
  const notFoundRes = await httpRequest(`${API_URL}/products/${nonExistentId}`);
  assert(notFoundRes.status === 404, 'Non-existent product ID returns 404 Not Found');
  assert(notFoundRes.data.success === false, '404 Response indicates success: false');

  // 4. Cart Integration & Persistence
  console.log('\n--- 4. Add to Cart Persistence via Dedicated Page API ---');
  const timestamp = Date.now();
  const testEmail = `pd_tester_${timestamp}@test.com`;
  const testPassword = 'SecurePassword123!';

  const regRes = await httpRequest(`${API_URL}/auth/register`, 'POST', {
    name: 'Product Details Tester',
    email: testEmail,
    password: testPassword
  });
  assert(regRes.status === 201, 'User registered successfully');

  const loginRes = await httpRequest(`${API_URL}/auth/login`, 'POST', {
    email: testEmail,
    password: testPassword
  });
  assert(loginRes.status === 200, 'User logged in successfully');
  const token = loginRes.data.token;
  const userId = loginRes.data.user._id || loginRes.data.user.id;

  // Add 3 units of product 1 to Cart
  const cartAddRes = await httpRequest(`${API_URL}/cart`, 'POST', {
    productId: prod1._id,
    quantity: 3
  }, token);
  assert(cartAddRes.status === 200, 'Add to Cart returns 200 OK');
  assert(cartAddRes.data.data.items.length === 1, 'Cart has 1 item');
  assert(cartAddRes.data.data.items[0].quantity === 3, 'Cart quantity is 3');

  // Verify in MongoDB
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const userDocInDB = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(userId) });
  assert(userDocInDB.cart.length === 1, 'Cart persisted in MongoDB user.cart');
  assert(userDocInDB.cart[0].quantity === 3, 'Persisted quantity matches 3');

  // 5. Wishlist Integration & Persistence
  console.log('\n--- 5. Wishlist Add / Remove Persistence ---');
  const wishAddRes = await httpRequest(`${API_URL}/wishlist`, 'POST', {
    productId: prod1._id
  }, token);
  assert(wishAddRes.status === 200, 'Add to Wishlist returns 200 OK');
  assert(wishAddRes.data.data.products.length === 1, 'Wishlist now has 1 product');

  const userDocWish = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(userId) });
  assert(userDocWish.wishlist.length === 1, 'Wishlist persisted in MongoDB user.wishlist');
  assert(userDocWish.wishlist[0].toString() === prod1._id.toString(), 'Persisted wishlist ObjectId matches product');

  // Remove from Wishlist
  const wishDelRes = await httpRequest(`${API_URL}/wishlist/${prod1._id}`, 'DELETE', null, token);
  assert(wishDelRes.status === 200, 'Remove from Wishlist returns 200 OK');
  const userDocWishEmpty = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(userId) });
  assert(userDocWishEmpty.wishlist.length === 0, 'Wishlist deletion persisted in MongoDB');

  // 6. Existing Features & Regression Verification
  console.log('\n--- 6. Regression Verification ---');
  // Catalog search
  const searchRes = await httpRequest(`${API_URL}/products?search=Keyboard`);
  assert(searchRes.status === 200, 'Product search returns 200 OK');

  // Categories list
  const catRes = await httpRequest(`${API_URL}/products/categories`);
  assert(catRes.status === 200, 'Categories endpoint returns 200 OK');
  assert(Array.isArray(catRes.data.data), 'Categories data is an array');

  // Orders
  const ordersRes = await httpRequest(`${API_URL}/orders`, 'GET', null, token);
  assert(ordersRes.status === 200, 'Orders endpoint returns 200 OK');

  // Contacts
  const contactsRes = await httpRequest(`${API_URL}/contacts`, 'POST', {
    name: 'Flow Tester',
    email: 'tester@example.com',
    subject: 'Inquiry',
    message: 'Testing regression contact flow'
  });
  assert(contactsRes.status === 201, 'Contacts endpoint returns 201 Created');

  // Cleanup ephemeral test user
  await db.collection('users').deleteOne({ _id: new mongoose.Types.ObjectId(userId) });
  console.log('\n[CLEANUP] Ephemeral test user deleted.');
  await mongoose.disconnect();

  console.log('\n====================================================');
  console.log(' ALL 28 DEDICATED PAGE TESTS PASSED SUCCESSFULLY!   ');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
