const http = require('http');
const path = require('path');
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));

const BASE_URL = 'http://localhost:5000/api';
const MONGO_URI = 'mongodb://127.0.0.1:27017/E-commerce';

function apiRequest(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
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
        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
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

async function runSuite() {
  console.log('====================================================');
  console.log(' WISHLIST 404 / NETWORK ERROR VERIFICATION SUITE   ');
  console.log('====================================================\n');

  // 1. Backend responsiveness & DB connection
  console.log('--- 1. Backend Status & Database ---');
  const healthRes = await apiRequest('GET', '/health');
  assert(healthRes.status === 200, 'Backend is running and responds with 200 OK');
  assert(healthRes.data.databaseName === 'E-commerce', 'Connected to E-commerce database');

  // Connect to MongoDB directly to verify persistence
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // 2. Fetch an existing real product
  console.log('\n--- 2. Fetch Existing Product ---');
  const productsRes = await apiRequest('GET', '/products');
  assert(productsRes.status === 200, 'GET /api/products returns 200 OK');
  const products = productsRes.data.products || productsRes.data.data;
  assert(products && products.length > 0, `Products found: ${products.length}`);
  const targetProduct = products[0];
  const targetProductId = targetProduct._id;
  console.log(`Selected target product: "${targetProduct.name}" (${targetProductId})`);

  // 3. User Setup (Test Users A & B)
  console.log('\n--- 3. User Authentication & Isolation Setup ---');
  const timestamp = Date.now();
  const userAEmail = `wishlist_tester_a_${timestamp}@test.com`;
  const userBEmail = `wishlist_tester_b_${timestamp}@test.com`;
  const testPassword = 'TestPassword123!';

  const regARes = await apiRequest('POST', '/auth/register', {
    name: 'Wishlist Tester A',
    email: userAEmail,
    password: testPassword
  });
  assert(regARes.status === 201, 'User A registered successfully');

  const regBRes = await apiRequest('POST', '/auth/register', {
    name: 'Wishlist Tester B',
    email: userBEmail,
    password: testPassword
  });
  assert(regBRes.status === 201, 'User B registered successfully');

  const loginARes = await apiRequest('POST', '/auth/login', { email: userAEmail, password: testPassword });
  assert(loginARes.status === 200, 'User A logged in successfully');
  const tokenA = loginARes.data.token;
  const userAId = loginARes.data.user._id || loginARes.data.user.id;

  const loginBRes = await apiRequest('POST', '/auth/login', { email: userBEmail, password: testPassword });
  assert(loginBRes.status === 200, 'User B logged in successfully');
  const tokenB = loginBRes.data.token;

  // 4. Test Add to Wishlist via standard route (POST /wishlist with body { productId })
  console.log('\n--- 4. Test Wishlist Add (POST /api/wishlist with body) ---');
  const addRes1 = await apiRequest('POST', '/wishlist', { productId: targetProductId }, tokenA);
  assert(addRes1.status === 200, 'POST /api/wishlist returns 200 OK');
  assert(addRes1.data.success === true, 'Response indicates success');
  assert(addRes1.data.data.products.length === 1, 'Wishlist now contains 1 product');

  // 5. Test Add to Wishlist via URL parameter route (POST /wishlist/:productId)
  // This was the exact route causing the 404 previously
  console.log('\n--- 5. Test Wishlist Add (POST /api/wishlist/:productId alias) ---');
  const secondProduct = products[1];
  const secondProductId = secondProduct._id;
  const addRes2 = await apiRequest('POST', `/wishlist/${secondProductId}`, null, tokenA);
  assert(addRes2.status === 200, 'POST /api/wishlist/:productId returns 200 OK (no 404!)');
  assert(addRes2.data.success === true, 'Response indicates success');
  assert(addRes2.data.data.products.length === 2, 'Wishlist now contains 2 products');

  // 6. Direct MongoDB Verification
  console.log('\n--- 6. MongoDB Direct Persistence Verification ---');
  const userDocInDB = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(userAId) });
  assert(userDocInDB !== null, 'User document found in E-commerce.users');
  assert(Array.isArray(userDocInDB.wishlist), 'User document has wishlist array');
  assert(userDocInDB.wishlist.length === 2, 'MongoDB document contains exactly 2 wishlist items');
  const hasFirst = userDocInDB.wishlist.some(id => id.toString() === targetProductId.toString());
  const hasSecond = userDocInDB.wishlist.some(id => id.toString() === secondProductId.toString());
  assert(hasFirst, 'Target product 1 persisted as ObjectId in user.wishlist');
  assert(hasSecond, 'Target product 2 persisted as ObjectId in user.wishlist');

  // 7. Duplicate Prevention
  console.log('\n--- 7. Duplicate Wishlist Prevention ---');
  const dupRes = await apiRequest('POST', '/wishlist', { productId: targetProductId }, tokenA);
  assert(dupRes.status === 200, 'Duplicate add returns 200 OK');
  assert(dupRes.data.message.includes('already in your wishlist'), 'Duplicate message returned');
  const userDocAfterDup = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(userAId) });
  assert(userDocAfterDup.wishlist.length === 2, 'Wishlist length remains 2 (duplicate prevented)');

  // 8. User Wishlist Privacy & Isolation
  console.log('\n--- 8. User Isolation & Privacy ---');
  const wishBRes = await apiRequest('GET', '/wishlist', null, tokenB);
  assert(wishBRes.status === 200, 'User B GET /wishlist returns 200 OK');
  assert(wishBRes.data.data.products.length === 0, 'User B cannot see User A wishlist (empty)');

  // 9. Wishlist Removal Flow
  console.log('\n--- 9. Wishlist Remove Flow (DELETE /api/wishlist/:productId) ---');
  const delRes = await apiRequest('DELETE', `/wishlist/${secondProductId}`, null, tokenA);
  assert(delRes.status === 200, 'DELETE /api/wishlist/:productId returns 200 OK');
  assert(delRes.data.data.products.length === 1, 'Wishlist count decremented to 1');
  const userDocAfterDel = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(userAId) });
  assert(userDocAfterDel.wishlist.length === 1, 'MongoDB document reflects deletion');

  // 10. Regression Check: Cart, Products, Orders
  console.log('\n--- 10. Regression Verification: Cart, Products, Orders ---');
  // Cart
  const cartAddRes = await apiRequest('POST', '/cart', { productId: targetProductId, quantity: 1 }, tokenA);
  assert(cartAddRes.status === 200, 'Cart Add still works: 200 OK');
  const cartGetRes = await apiRequest('GET', '/cart', null, tokenA);
  assert(cartGetRes.status === 200, 'Cart Get still works: 200 OK');
  assert(cartGetRes.data.data.items.length === 1, 'Cart items length is 1');

  // Orders
  const ordersRes = await apiRequest('GET', '/orders', null, tokenA);
  assert(ordersRes.status === 200, 'Orders endpoint responds: 200 OK');

  // Cleanup ephemeral test users
  await db.collection('users').deleteMany({ email: { $in: [userAEmail, userBEmail] } });
  console.log('\n[CLEANUP] Ephemeral test users removed.');

  await mongoose.disconnect();
  console.log('\n====================================================');
  console.log(' ALL WISHLIST TESTS PASSED SUCCESSFULLY!           ');
  console.log('====================================================');
}

runSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
