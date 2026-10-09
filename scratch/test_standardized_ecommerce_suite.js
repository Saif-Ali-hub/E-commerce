/**
 * Comprehensive Verification Suite for:
 * Standardized Mini Store Local MongoDB Database: 'E-commerce'
 * Verifies all 12 requirements in Section 11.
 */

const http = require('http');
const https = require('https');
const mongoose = require('../backend/node_modules/mongoose');
const bcrypt = require('../backend/node_modules/bcryptjs');

const API_BASE = 'http://localhost:5000/api';
const ECOMMERCE_URI = 'mongodb://127.0.0.1:27017/E-commerce';
const MINI_ECOMMERCE_URI = 'mongodb://127.0.0.1:27017/mini_ecommerce';

function apiRequest(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + endpoint);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function checkImage(urlPath) {
  return new Promise((resolve) => {
    const isFullUrl = urlPath.startsWith('http');
    const fullUrl = isFullUrl ? urlPath : `http://localhost:5000${urlPath}`;
    const url = new URL(fullUrl);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.get(url, (res) => {
      resolve({ status: res.statusCode, headers: res.headers });
    });
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
  });
}

async function runVerification() {
  console.log('====================================================');
  console.log(' E-COMMERCE DATABASE STANDARDIZATION TEST SUITE     ');
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

  // Connect to E-commerce database directly with mongoose for ground-truth verification
  const dbConn = await mongoose.createConnection(ECOMMERCE_URI).asPromise();

  try {
    // 1. Backend connects to E-commerce
    console.log('--- TEST 1: Backend Connection to Database "E-commerce" ---');
    const healthRes = await apiRequest('GET', '/health');
    assert(healthRes.status === 200, 'Health endpoint responds with 200 OK');
    assert(healthRes.data.database === 'connected', 'Database status is "connected"');
    assert(healthRes.data.databaseName === 'E-commerce', `Database name is "E-commerce" (actual: ${healthRes.data.databaseName})`);
    assert(healthRes.data.isStandardDatabase === true, 'isStandardDatabase is True');

    // 2. Products collection & CRUD operations in E-commerce
    console.log('\n--- TEST 2: Product Storage & CRUD in E-commerce ---');
    const listRes = await apiRequest('GET', '/products?page=1&limit=5');
    assert(listRes.status === 200, 'GET /api/products returns 200 OK');
    assert(listRes.data.pagination.totalProducts >= 61, `Total products in E-commerce is ${listRes.data.pagination.totalProducts} (>= 61)`);

    // Verify existing legacy products from original E-commerce database
    const wirelessMouse = await dbConn.collection('products').findOne({ name: 'Wireless Mouse' });
    assert(wirelessMouse !== null, 'Original "Wireless Mouse" preserved in E-commerce.products');
    const mechanicalKeyboard = await dbConn.collection('products').findOne({ name: 'Mechanical Keyboard' });
    assert(mechanicalKeyboard !== null, 'Original "Mechanical Keyboard" preserved in E-commerce.products');
    const gamingLaptop = await dbConn.collection('products').findOne({ name: 'Gaming Laptop' });
    assert(gamingLaptop !== null, 'Original "Gaming Laptop" preserved in E-commerce.products');

    // 3. Product Images in MongoDB GridFS
    console.log('\n--- TEST 3: Product Image Retrieval & MongoDB GridFS Verification ---');
    const gridfsFiles = await dbConn.collection('product_images.files').find({}).toArray();
    assert(gridfsFiles.length === 13, `MongoDB GridFS bucket "product_images" contains 13 image files (actual: ${gridfsFiles.length})`);

    const webcamImg = await checkImage('/images/streaming_webcam.jpg');
    assert(webcamImg.status === 200, 'GET /images/streaming_webcam.jpg returns 200 OK');
    assert(webcamImg.headers['x-source'] === 'MongoDB-GridFS', `Served with X-Source: MongoDB-GridFS (actual: ${webcamImg.headers['x-source']})`);

    const shakerImg = await checkImage('/images/stainless_steel_shaker.jpg');
    assert(shakerImg.status === 200, 'GET /images/stainless_steel_shaker.jpg returns 200 OK');
    assert(shakerImg.headers['x-source'] === 'MongoDB-GridFS', 'Served with X-Source: MongoDB-GridFS');

    // 4. Users in users collection & password hashing
    console.log('\n--- TEST 4 & 5: Users Collection & Password Hashing in E-commerce ---');
    const userAEmail = `user_a_${Date.now()}@test.com`;
    const userBEmail = `user_b_${Date.now()}@test.com`;
    const plainPassword = 'StrongPassword99!';

    const regARes = await apiRequest('POST', '/auth/register', {
      name: 'User Alpha',
      email: userAEmail,
      password: plainPassword
    });
    assert(regARes.status === 201, `User Alpha registered in E-commerce (201 Created)`);

    const regBRes = await apiRequest('POST', '/auth/register', {
      name: 'User Beta',
      email: userBEmail,
      password: plainPassword
    });
    assert(regBRes.status === 201, `User Beta registered in E-commerce (201 Created)`);

    // Verify stored directly in E-commerce.users collection
    const storedUserA = await dbConn.collection('users').findOne({ email: userAEmail });
    assert(storedUserA !== null, 'User Alpha found in E-commerce.users collection');
    assert(storedUserA.password !== plainPassword, 'Password is NOT stored in plain text');
    assert(bcrypt.compareSync(plainPassword, storedUserA.password), 'Password hash verified with bcrypt');
    assert(Array.isArray(storedUserA.cart), 'User Alpha document contains embedded "cart" array');
    assert(Array.isArray(storedUserA.wishlist), 'User Alpha document contains embedded "wishlist" array');

    // Logins and JWTs
    const loginARes = await apiRequest('POST', '/auth/login', { email: userAEmail, password: plainPassword });
    const tokenA = loginARes.data.token;
    assert(!!tokenA, 'User Alpha received valid JWT token');

    const loginBRes = await apiRequest('POST', '/auth/login', { email: userBEmail, password: plainPassword });
    const tokenB = loginBRes.data.token;
    assert(!!tokenB, 'User Beta received valid JWT token');

    // 6. User-Specific Cart Persistence
    console.log('\n--- TEST 6: User-Specific Cart Persistence ---');
    const sampleProduct = await dbConn.collection('products').findOne({ stock: { $gt: 5 } });
    const sampleProductId = sampleProduct._id.toString();

    // User A adds to cart
    const addCartARes = await apiRequest('POST', '/cart', { productId: sampleProductId, quantity: 2 }, tokenA);
    assert(addCartARes.status === 200, 'User Alpha added product to cart (200 OK)');
    assert(addCartARes.data.data.items.length === 1, 'User Alpha cart has 1 item');
    assert(addCartARes.data.data.items[0].quantity === 2, 'User Alpha cart quantity is 2');

    // Verify persisted directly in User A's document in MongoDB E-commerce
    const updatedUserADoc = await dbConn.collection('users').findOne({ email: userAEmail });
    assert(updatedUserADoc.cart.length === 1, 'Cart persisted in User Alpha MongoDB document');
    assert(updatedUserADoc.cart[0].product.toString() === sampleProductId, 'Product ObjectId matches in User Alpha document');
    assert(updatedUserADoc.cart[0].quantity === 2, 'Quantity 2 matches in User Alpha document');

    // 7. User-Specific Wishlist Persistence
    console.log('\n--- TEST 7: User-Specific Wishlist Persistence ---');
    const addWishARes = await apiRequest('POST', '/wishlist', { productId: sampleProductId }, tokenA);
    assert(addWishARes.status === 200, 'User Alpha added product to wishlist');
    assert(addWishARes.data.data.products.length === 1, 'User Alpha wishlist has 1 item');

    // Verify duplicate prevention
    const addWishADup = await apiRequest('POST', '/wishlist', { productId: sampleProductId }, tokenA);
    assert(addWishADup.status === 200, 'Duplicate wishlist request handled gracefully');
    assert(addWishADup.data.data.products.length === 1, 'Duplicate product NOT added to wishlist (length remains 1)');

    // Verify persisted in User A document in MongoDB E-commerce
    const userAWishDoc = await dbConn.collection('users').findOne({ email: userAEmail });
    assert(userAWishDoc.wishlist.length === 1, 'Wishlist persisted in User Alpha MongoDB document');
    assert(userAWishDoc.wishlist[0].toString() === sampleProductId, 'Product ObjectId in User Alpha document matches');

    // 8. User Isolation: User B Cannot Access or Modify User A's Cart or Wishlist
    console.log('\n--- TEST 8: Strict User Cart & Wishlist Isolation ---');
    const cartBRes = await apiRequest('GET', '/cart', null, tokenB);
    assert(cartBRes.status === 200, 'GET /cart for User Beta returns 200 OK');
    assert(cartBRes.data.data.items.length === 0, 'User Beta cart is empty (cannot see User Alpha cart items)');

    const wishBRes = await apiRequest('GET', '/wishlist', null, tokenB);
    assert(wishBRes.status === 200, 'GET /wishlist for User Beta returns 200 OK');
    assert(wishBRes.data.data.products.length === 0, 'User Beta wishlist is empty (cannot see User Alpha wishlist)');

    // User B adds a different product to cart
    const secondProduct = await dbConn.collection('products').findOne({ _id: { $ne: sampleProduct._id }, stock: { $gt: 5 } });
    await apiRequest('POST', '/cart', { productId: secondProduct._id.toString(), quantity: 1 }, tokenB);
    const userBDoc = await dbConn.collection('users').findOne({ email: userBEmail });
    assert(userBDoc.cart.length === 1, 'User Beta has their own independent cart in MongoDB');
    assert(userBDoc.cart[0].product.toString() === secondProduct._id.toString(), 'User Beta cart points to their chosen product');

    // Confirm User Alpha's cart is unmodified
    const checkUserADoc = await dbConn.collection('users').findOne({ email: userAEmail });
    assert(checkUserADoc.cart.length === 1 && checkUserADoc.cart[0].product.toString() === sampleProductId, 'User Alpha cart completely isolated and unaffected');

    // 9. Orders and Contacts Verification
    console.log('\n--- TEST 9: Orders & Contacts in E-commerce Database ---');
    const contactsRes = await apiRequest('GET', '/contacts');
    assert(contactsRes.status === 200, 'GET /api/contacts returns 200 OK');
    assert(contactsRes.data.count >= 2, `Contacts count is ${contactsRes.data.count} (preserved Bob & Carol)`);

    const existingOrders = await dbConn.collection('orders').find({}).toArray();
    assert(existingOrders.length >= 2, `Orders count in E-commerce is ${existingOrders.length} (preserved ORD001 & ORD002)`);
    assert(existingOrders.some(o => o.orderId === 'ORD001'), 'Preserved ORD001 in E-commerce.orders');
    assert(existingOrders.some(o => o.orderId === 'ORD002'), 'Preserved ORD002 in E-commerce.orders');

    // 10. Check that mini_ecommerce is NOT being written to
    console.log('\n--- TEST 10: Verifying Zero Application Writes to mini_ecommerce ---');
    const miniConn = await mongoose.createConnection(MINI_ECOMMERCE_URI).asPromise();
    const miniUserA = await miniConn.collection('users').findOne({ email: userAEmail });
    assert(miniUserA === null, 'User Alpha does NOT exist in mini_ecommerce (writes directed exclusively to E-commerce)');
    await miniConn.close();

    // Clean up test users Alpha & Beta from E-commerce
    await dbConn.collection('users').deleteMany({ email: { $in: [userAEmail, userBEmail] } });
    console.log(`[CLEANUP] Deleted ephemeral test users ${userAEmail} and ${userBEmail}`);

    console.log('\n====================================================');
    console.log(` VERIFICATION RESULTS: ${passes} PASSED, ${fails} FAILED`);
    console.log('====================================================');
    await dbConn.close();
    process.exit(fails > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test error:', err);
    await dbConn.close();
    process.exit(1);
  }
}

runVerification();
