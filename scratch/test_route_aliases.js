/**
 * Comprehensive Automated Verification Suite for Defensive Route Aliases:
 * 1. Product Autocomplete:
 *    - Existing: GET /api/products/suggestions?q=phone
 *    - Alias:    GET /api/products/search/autocomplete?q=phone
 * 2. Product Reviews:
 *    - Existing: POST/PUT/DELETE /api/products/:id/review
 *    - Alias:    POST/PUT/DELETE /api/products/:id/reviews
 * 3. Address Pincode Check:
 *    - Existing: GET /api/addresses/check-pincode/:pincode
 *    - Alias:    GET /api/addresses/estimate-pincode?pincode=...
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

async function run() {
  console.log('====================================================');
  console.log(' STARTING DEFENSIVE ROUTE ALIASES TEST SUITE        ');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/E-commerce';
  await mongoose.connect(mongoUri);

  const User = mongoose.model('User', require('../backend/models/User').schema);
  const Product = mongoose.model('Product', require('../backend/models/Product').schema);

  const uniqueSuffix = Date.now();

  // ==========================================================
  // Section 1: Product Autocomplete Aliases
  // ==========================================================
  console.log('--- 1. Testing Product Autocomplete Aliases ---');
  {
    const query = 'phone';
    const resSuggestions = await request(`/products/suggestions?q=${query}`);
    const resAutocomplete = await request(`/products/search/autocomplete?q=${query}`);

    assert(resSuggestions.status === 200, 'GET /api/products/suggestions returned HTTP 200');
    assert(resAutocomplete.status === 200, 'GET /api/products/search/autocomplete returned HTTP 200');

    assert(resSuggestions.data.success === true, 'resSuggestions success is true');
    assert(resAutocomplete.data.success === true, 'resAutocomplete success is true');

    assert(resSuggestions.data.count === resAutocomplete.data.count,
      `Matched count identical (${resSuggestions.data.count} === ${resAutocomplete.data.count})`);
    assert(resSuggestions.data.totalMatches === resAutocomplete.data.totalMatches,
      `totalMatches identical (${resSuggestions.data.totalMatches} === ${resAutocomplete.data.totalMatches})`);

    // Verify items in data match
    const suggNames = (resSuggestions.data.data || []).map(p => p.name);
    const autoNames = (resAutocomplete.data.data || []).map(p => p.name);
    assert(JSON.stringify(suggNames) === JSON.stringify(autoNames),
      'Returned items and ordering identical between /suggestions and /search/autocomplete');

    // Empty query test
    const emptySugg = await request('/products/suggestions?q=');
    const emptyAuto = await request('/products/search/autocomplete?q=');
    assert(emptySugg.status === 200 && emptySugg.data.data.length === 0,
      'Empty query /suggestions returns empty array');
    assert(emptyAuto.status === 200 && emptyAuto.data.data.length === 0,
      'Empty query /search/autocomplete returns empty array');

    // Limit parameter test
    const limitSugg = await request('/products/suggestions?q=a&limit=3');
    const limitAuto = await request('/products/search/autocomplete?q=a&limit=3');
    assert(limitSugg.data.data.length === limitAuto.data.data.length && limitAuto.data.data.length <= 3,
      'Limit parameter works identically on both autocomplete URLs');
  }

  // ==========================================================
  // Section 2: Product Review Aliases (/review and /reviews)
  // ==========================================================
  console.log('\n--- 2. Testing Product Review Aliases (/review and /reviews) ---');
  {
    // Create an isolated test product
    const testProduct = new Product({
      name: `Review Alias Test Product ${uniqueSuffix}`,
      price: 999,
      category: 'Electronics',
      stock: 10,
      inStock: true
    });
    await testProduct.save();

    // Register User 1
    const user1Email = `reviewer1_${uniqueSuffix}@example.com`;
    await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Reviewer One', email: user1Email, password: 'Password123' })
    });
    const login1 = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: user1Email, password: 'Password123' })
    });
    const token1 = login1.data.token;

    // Register User 2
    const user2Email = `reviewer2_${uniqueSuffix}@example.com`;
    await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Reviewer Two', email: user2Email, password: 'Password123' })
    });
    const login2 = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: user2Email, password: 'Password123' })
    });
    const token2 = login2.data.token;

    // 2a. Unauthenticated requests to both routes return 401
    const unauthPost1 = await request(`/products/${testProduct._id}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating: 5, comment: 'Great product' })
    });
    const unauthPost2 = await request(`/products/${testProduct._id}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating: 5, comment: 'Great product' })
    });
    assert(unauthPost1.status === 401, 'Unauthenticated POST /review returns HTTP 401');
    assert(unauthPost2.status === 401, 'Unauthenticated POST /reviews returns HTTP 401');

    const unauthPut1 = await request(`/products/${testProduct._id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ rating: 4, comment: 'Updated' })
    });
    const unauthPut2 = await request(`/products/${testProduct._id}/reviews`, {
      method: 'PUT',
      body: JSON.stringify({ rating: 4, comment: 'Updated' })
    });
    assert(unauthPut1.status === 401, 'Unauthenticated PUT /review returns HTTP 401');
    assert(unauthPut2.status === 401, 'Unauthenticated PUT /reviews returns HTTP 401');

    const unauthDel1 = await request(`/products/${testProduct._id}/review`, { method: 'DELETE' });
    const unauthDel2 = await request(`/products/${testProduct._id}/reviews`, { method: 'DELETE' });
    assert(unauthDel1.status === 401, 'Unauthenticated DELETE /review returns HTTP 401');
    assert(unauthDel2.status === 401, 'Unauthenticated DELETE /reviews returns HTTP 401');

    // 2b. POST via existing singular route: POST /api/products/:id/review
    const postSingularRes = await request(`/products/${testProduct._id}/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ rating: 5, comment: 'Review added via singular /review' })
    });
    assert(postSingularRes.status === 201, 'POST /review returned HTTP 201 Created');
    assert(postSingularRes.data.success === true, 'POST /review response success is true');
    assert(postSingularRes.data.data.reviews.length === 1, 'Product has 1 review');

    // Duplicate review check via plural alias (must return 400)
    const dupPluralRes = await request(`/products/${testProduct._id}/reviews`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ rating: 4, comment: 'Duplicate attempt' })
    });
    assert(dupPluralRes.status === 400, 'Duplicate review attempt via /reviews returned HTTP 400');

    // 2c. PUT via plural alias route: PUT /api/products/:id/reviews
    const putPluralRes = await request(`/products/${testProduct._id}/reviews`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ rating: 4, comment: 'Review edited via plural /reviews alias' })
    });
    assert(putPluralRes.status === 200, 'PUT /reviews returned HTTP 200 OK');
    assert(putPluralRes.data.success === true, 'PUT /reviews response success is true');
    const updatedReview = putPluralRes.data.data.reviews.find(r => r.comment.includes('edited via plural'));
    assert(updatedReview && updatedReview.rating === 4, 'Review was updated via plural /reviews');

    // 2d. PUT via singular route: PUT /api/products/:id/review
    const putSingularRes = await request(`/products/${testProduct._id}/review`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ rating: 5, comment: 'Review edited back via singular /review' })
    });
    assert(putSingularRes.status === 200, 'PUT /review returned HTTP 200 OK');
    const updatedReview2 = putSingularRes.data.data.reviews.find(r => r.comment.includes('edited back via singular'));
    assert(updatedReview2 && updatedReview2.rating === 5, 'Review was updated via singular /review');

    // 2e. DELETE via plural alias route: DELETE /api/products/:id/reviews
    const deletePluralRes = await request(`/products/${testProduct._id}/reviews`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token1}` }
    });
    assert(deletePluralRes.status === 200, 'DELETE /reviews returned HTTP 200 OK');
    assert(deletePluralRes.data.success === true, 'DELETE /reviews response success is true');
    assert(deletePluralRes.data.data.reviews.length === 0, 'Review successfully removed');

    // Delete non-existent review via singular (returns 404)
    const delete404Singular = await request(`/products/${testProduct._id}/review`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token1}` }
    });
    assert(delete404Singular.status === 404, 'DELETE /review on non-existent review returns HTTP 404');

    // 2f. POST via plural alias route: POST /api/products/:id/reviews
    const postPluralRes = await request(`/products/${testProduct._id}/reviews`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token2}` },
      body: JSON.stringify({ rating: 5, comment: 'Review added by User 2 via plural /reviews' })
    });
    assert(postPluralRes.status === 201, 'POST /reviews returned HTTP 201 Created');
    assert(postPluralRes.data.data.reviews.length === 1, 'Review added via plural route successfully');

    // 2g. DELETE via singular route: DELETE /api/products/:id/review
    const deleteSingularRes = await request(`/products/${testProduct._id}/review`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token2}` }
    });
    assert(deleteSingularRes.status === 200, 'DELETE /review returned HTTP 200 OK');
    assert(deleteSingularRes.data.data.reviews.length === 0, 'Review successfully removed via singular route');

    // Clean up test product & users
    await Product.findByIdAndDelete(testProduct._id);
    await User.deleteMany({ email: { $in: [user1Email, user2Email] } });
  }

  // ==========================================================
  // Section 3: Address Pincode Aliases
  // ==========================================================
  console.log('\n--- 3. Testing Address Pincode Check Aliases ---');
  {
    // 3a. Valid Mumbai Pincode (400001)
    const pathMumbai = await request('/addresses/check-pincode/400001');
    const queryMumbai = await request('/addresses/estimate-pincode?pincode=400001');

    assert(pathMumbai.status === 200, 'GET /check-pincode/400001 returned HTTP 200');
    assert(queryMumbai.status === 200, 'GET /estimate-pincode?pincode=400001 returned HTTP 200');

    assert(pathMumbai.data.city === queryMumbai.data.city && queryMumbai.data.city === 'Mumbai',
      `Both routes resolved city "Mumbai" (${queryMumbai.data.city})`);
    assert(pathMumbai.data.state === queryMumbai.data.state && queryMumbai.data.state === 'Maharashtra',
      `Both routes resolved state "Maharashtra" (${queryMumbai.data.state})`);
    assert(pathMumbai.data.serviceable === true && queryMumbai.data.serviceable === true,
      'Both routes report serviceable: true');
    assert(pathMumbai.data.estimatedDays === queryMumbai.data.estimatedDays,
      `Both routes report same estimatedDays (${queryMumbai.data.estimatedDays})`);
    assert(pathMumbai.data.estimatedDeliveryDate === queryMumbai.data.estimatedDeliveryDate,
      `Both routes report same estimatedDeliveryDate (${queryMumbai.data.estimatedDeliveryDate})`);

    // 3b. Valid Delhi Pincode (110001)
    const pathDelhi = await request('/addresses/check-pincode/110001');
    const queryDelhi = await request('/addresses/estimate-pincode?pincode=110001');
    assert(pathDelhi.status === 200 && queryDelhi.status === 200, 'Both routes for 110001 return HTTP 200');
    assert(pathDelhi.data.city === 'New Delhi' && queryDelhi.data.city === 'New Delhi',
      'Both routes resolved city "New Delhi"');

    // 3c. Invalid Pincode Formats
    const pathInvalid1 = await request('/addresses/check-pincode/999');
    const queryInvalid1 = await request('/addresses/estimate-pincode?pincode=999');
    assert(pathInvalid1.status === 400, 'Short pincode on /check-pincode returns HTTP 400');
    assert(queryInvalid1.status === 400, 'Short pincode on /estimate-pincode returns HTTP 400');
    assert(pathInvalid1.data.message === queryInvalid1.data.message, 'Validation message identical');

    const pathInvalid2 = await request('/addresses/check-pincode/abcdef');
    const queryInvalid2 = await request('/addresses/estimate-pincode?pincode=abcdef');
    assert(pathInvalid2.status === 400, 'Alphabetic pincode on /check-pincode returns HTTP 400');
    assert(queryInvalid2.status === 400, 'Alphabetic pincode on /estimate-pincode returns HTTP 400');

    // 3d. Missing Pincode on /estimate-pincode
    const missingQueryRes = await request('/addresses/estimate-pincode');
    assert(missingQueryRes.status === 400, 'Missing pincode query param returns HTTP 400');
    assert(missingQueryRes.data.success === false && missingQueryRes.data.serviceable === false,
      'Missing query param returns success: false, serviceable: false');
    assert(missingQueryRes.data.message === 'Please enter a valid 6-digit Indian PIN code (e.g. 110001, 560001).',
      'Missing query param returns expected validation message');

    const emptyQueryRes = await request('/addresses/estimate-pincode?pincode=');
    assert(emptyQueryRes.status === 400, 'Empty pincode query param returns HTTP 400');
  }

  await mongoose.disconnect();

  console.log('\n====================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal test suite failure:', err);
  process.exit(1);
});
