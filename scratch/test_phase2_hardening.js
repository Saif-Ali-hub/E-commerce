/**
 * Phase 2 Focused Verification Test Suite:
 * - Product Role Permissions & Business Logic Hardening
 * - Review Ownership, Duplicate Prevention, and Rating Recomputation
 */

const path = require('path');
const dotenv = require('../backend/node_modules/dotenv');
const mongoose = require('../backend/node_modules/mongoose');
const jwt = require('../backend/node_modules/jsonwebtoken');
const bcrypt = require('../backend/node_modules/bcryptjs');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_miniecommerce_2026_secure';

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
  console.log(' STARTING PHASE 2 HARDENING VERIFICATION SUITE       ');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/E-commerce';
  await mongoose.connect(mongoUri);

  const User = require('../backend/models/User');
  const Product = require('../backend/models/Product');

  // Track created IDs for strict cleanup
  const createdUserIds = [];
  const createdProductIds = [];

  try {
    // 0. Verify Baseline Catalog
    const initialProductCount = await Product.countDocuments();
    console.log(`Initial total product count in DB: ${initialProductCount}`);
    assert(initialProductCount >= 61, `Database contains baseline catalog products (found ${initialProductCount})`);

    // Helper to create test user
    const createTestUser = async (email, role, sellerDetails = undefined) => {
      await User.deleteOne({ email });
      const hashedPassword = await bcrypt.hash('TestPass123!', 10);
      const user = await User.create({
        name: `Test User ${role}`,
        email,
        password: hashedPassword,
        role: role === 'admin' ? 'admin' : (role === 'seller' ? 'seller' : 'customer'),
        sellerDetails: sellerDetails || {
          businessName: '',
          verificationStatus: 'pending'
        }
      });
      createdUserIds.push(user._id);
      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
      return { user, token };
    };

    console.log('\n--- Setting Up Isolated Test Users ---');
    const adminUser = await createTestUser('test_admin_p2@ministore.com', 'admin');
    const verifiedSeller = await createTestUser('test_verified_seller_p2@ministore.com', 'seller', {
      businessName: 'Apex Electronics',
      verificationStatus: 'verified'
    });
    const pendingSeller = await createTestUser('test_pending_seller_p2@ministore.com', 'seller', {
      businessName: 'Pending Goods',
      verificationStatus: 'pending'
    });
    const rejectedSeller = await createTestUser('test_rejected_seller_p2@ministore.com', 'seller', {
      businessName: 'Rejected Shop',
      verificationStatus: 'rejected'
    });
    const customer1 = await createTestUser('test_customer1_p2@ministore.com', 'customer');
    const customer2 = await createTestUser('test_customer2_p2@ministore.com', 'customer');
    const customer3 = await createTestUser('test_customer3_p2@ministore.com', 'customer');

    console.log('  ✓ Test users created with distinct roles and seller verification statuses');

    // ============================================================
    // Task 1: Product Role Permissions (POST /api/products, PUT /api/products/:id)
    // ============================================================
    console.log('\n--- 1. Testing Product Creation Role Permissions (POST /api/products) ---');

    const testProductPayload = {
      name: 'Phase2 Test Smartphone Pro',
      title: 'Phase2 Test Smartphone Pro',
      price: 29999,
      discountPrice: 27999,
      category: 'Electronics',
      stock: 50,
      description: 'Test product for permission audit',
      image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500'
    };

    // 1.1 Unauthenticated POST
    const resNoAuthPost = await request('/products', {
      method: 'POST',
      body: JSON.stringify(testProductPayload)
    });
    assert(resNoAuthPost.status === 401, 'Unauthenticated POST /api/products is rejected with HTTP 401');

    // 1.2 Normal Customer POST
    const resCustomerPost = await request('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify(testProductPayload)
    });
    assert(resCustomerPost.status === 403, 'Normal customer POST /api/products is rejected with HTTP 403');

    // 1.3 Normal Customer POST with spoofed body fields
    const resCustomerSpoofPost = await request('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({
        ...testProductPayload,
        role: 'admin',
        sellerDetails: { verificationStatus: 'verified' }
      })
    });
    assert(resCustomerSpoofPost.status === 403, 'Normal customer with spoofed role in body is still rejected with HTTP 403');

    // 1.4 Pending/Unverified Seller POST
    const resPendingPost = await request('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pendingSeller.token}` },
      body: JSON.stringify(testProductPayload)
    });
    assert(resPendingPost.status === 403, 'Unverified seller (pending) POST /api/products is rejected with HTTP 403');

    // 1.5 Rejected Seller POST
    const resRejectedPost = await request('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rejectedSeller.token}` },
      body: JSON.stringify(testProductPayload)
    });
    assert(resRejectedPost.status === 403, 'Rejected seller POST /api/products is rejected with HTTP 403');

    // 1.6 Pending Seller with spoofed verificationStatus in body
    const resPendingSpoofPost = await request('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pendingSeller.token}` },
      body: JSON.stringify({
        ...testProductPayload,
        sellerDetails: { verificationStatus: 'verified' }
      })
    });
    assert(resPendingSpoofPost.status === 403, 'Unverified seller with spoofed body verificationStatus is rejected with HTTP 403');

    // 1.7 Verified Seller POST (Allowed)
    const resVerifiedPost = await request('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${verifiedSeller.token}` },
      body: JSON.stringify({
        ...testProductPayload,
        name: 'Phase2 Verified Seller Test Product'
      })
    });
    assert(resVerifiedPost.status === 201, 'Verified seller POST /api/products succeeds with HTTP 201');
    assert(resVerifiedPost.data && resVerifiedPost.data.success === true, 'Verified seller product creation response success is true');
    let sellerProductId = resVerifiedPost.data && resVerifiedPost.data.data ? resVerifiedPost.data.data._id : null;
    if (sellerProductId) createdProductIds.push(sellerProductId);

    // 1.8 Admin POST (Allowed)
    const resAdminPost = await request('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminUser.token}` },
      body: JSON.stringify({
        ...testProductPayload,
        name: 'Phase2 Admin Test Product'
      })
    });
    assert(resAdminPost.status === 201, 'Admin POST /api/products succeeds with HTTP 201');
    assert(resAdminPost.data && resAdminPost.data.success === true, 'Admin product creation response success is true');
    let adminProductId = resAdminPost.data && resAdminPost.data.data ? resAdminPost.data.data._id : null;
    if (adminProductId) createdProductIds.push(adminProductId);

    // ============================================================
    // Testing Product Update Role Permissions (PUT /api/products/:id)
    // ============================================================
    console.log('\n--- 2. Testing Product Update Role Permissions (PUT /api/products/:id) ---');

    const updatePayload = { price: 31999, stock: 75 };

    // 2.1 Unauthenticated PUT
    const resNoAuthPut = await request(`/products/${sellerProductId}`, {
      method: 'PUT',
      body: JSON.stringify(updatePayload)
    });
    assert(resNoAuthPut.status === 401, 'Unauthenticated PUT /api/products/:id is rejected with HTTP 401');

    // 2.2 Normal Customer PUT
    const resCustomerPut = await request(`/products/${sellerProductId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify(updatePayload)
    });
    assert(resCustomerPut.status === 403, 'Normal customer PUT /api/products/:id is rejected with HTTP 403');

    // 2.3 Unverified Seller PUT
    const resPendingPut = await request(`/products/${sellerProductId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${pendingSeller.token}` },
      body: JSON.stringify(updatePayload)
    });
    assert(resPendingPut.status === 403, 'Unverified seller PUT /api/products/:id is rejected with HTTP 403');

    // 2.4 Customer PUT with spoofed role in body
    const resCustomerSpoofPut = await request(`/products/${sellerProductId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ ...updatePayload, role: 'admin' })
    });
    assert(resCustomerSpoofPut.status === 403, 'Customer with spoofed body role on PUT is rejected with HTTP 403');

    // 2.5 Verified Seller PUT (Allowed)
    const resVerifiedPut = await request(`/products/${sellerProductId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${verifiedSeller.token}` },
      body: JSON.stringify({ price: 32500, stock: 80 })
    });
    assert(resVerifiedPut.status === 200, 'Verified seller PUT /api/products/:id succeeds with HTTP 200');
    assert(resVerifiedPut.data && resVerifiedPut.data.data && resVerifiedPut.data.data.price === 32500, 'Product price was updated to 32500');

    // 2.6 Admin PUT (Allowed)
    const resAdminPut = await request(`/products/${sellerProductId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminUser.token}` },
      body: JSON.stringify({ price: 33000, stock: 85 })
    });
    assert(resAdminPut.status === 200, 'Admin PUT /api/products/:id succeeds with HTTP 200');
    assert(resAdminPut.data && resAdminPut.data.data && resAdminPut.data.data.price === 33000, 'Product price was updated to 33000 by admin');

    // 2.7 Verify DELETE /api/products/:id remains Admin-only
    const resSellerDelete = await request(`/products/${sellerProductId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${verifiedSeller.token}` }
    });
    assert(resSellerDelete.status === 403, 'Verified seller DELETE /api/products/:id is rejected with HTTP 403 (Admin only)');

    // ============================================================
    // Task 2: Audit Review Ownership & Rating Recomputation
    // ============================================================
    console.log('\n--- 3. Testing Review Ownership, Duplicate Prevention & Rating Recomputation ---');

    // Create a dedicated isolated test product for review tests
    const reviewTestProduct = await Product.create({
      name: 'Phase2 Review Lifecycle Test Product',
      title: 'Phase2 Review Lifecycle Test Product',
      price: 999,
      category: 'Electronics',
      stock: 20,
      description: 'Used for rigorous rating recalculation verification',
      reviews: [],
      averageRating: 0,
      totalReviews: 0,
      ratings: 0
    });
    createdProductIds.push(reviewTestProduct._id);
    const revProdId = reviewTestProduct._id.toString();

    // 3.1 Unauthenticated requests to both review URL formats
    const resUnauthAddSingular = await request(`/products/${revProdId}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating: 5, comment: 'Great!' })
    });
    const resUnauthAddPlural = await request(`/products/${revProdId}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating: 5, comment: 'Great!' })
    });
    assert(resUnauthAddSingular.status === 401, 'Unauthenticated POST /:id/review returns 401');
    assert(resUnauthAddPlural.status === 401, 'Unauthenticated POST /:id/reviews returns 401');

    // 3.2 Customer 1 adds first review (Rating: 4) via singular /review
    const resC1Add = await request(`/products/${revProdId}/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ rating: 4, comment: 'Solid build quality and great display' })
    });
    assert(resC1Add.status === 201, 'Customer 1 adds review via /review (HTTP 201)');
    assert(resC1Add.data.data.totalReviews === 1, 'Product totalReviews is exactly 1');
    assert(resC1Add.data.data.averageRating === 4, 'Product averageRating is exactly 4');
    assert(resC1Add.data.data.ratings === 4, 'Product ratings legacy field is synchronized to 4');

    // 3.3 Customer 1 attempts duplicate review via plural /reviews
    const resC1Dup = await request(`/products/${revProdId}/reviews`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({ rating: 5, comment: 'Trying to review again' })
    });
    assert(resC1Dup.status === 400, 'Duplicate review attempt via /reviews is rejected with HTTP 400');
    assert(
      resC1Dup.data && resC1Dup.data.message && resC1Dup.data.message.includes('already reviewed'),
      'Duplicate error message guides user to edit existing review'
    );

    // 3.4 Customer 2 adds second review (Rating: 5) via plural /reviews
    const resC2Add = await request(`/products/${revProdId}/reviews`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer2.token}` },
      body: JSON.stringify({ rating: 5, comment: 'Outstanding performance!' })
    });
    assert(resC2Add.status === 201, 'Customer 2 adds review via /reviews (HTTP 201)');
    assert(resC2Add.data.data.totalReviews === 2, 'Product totalReviews is now 2');
    assert(resC2Add.data.data.averageRating === 4.5, 'Product averageRating recalculated to 4.5 ((4 + 5) / 2)');
    assert(resC2Add.data.data.ratings === 4.5, 'Product ratings legacy field is synchronized to 4.5');

    // 3.5 Tampering Check: Customer 1 tries to update Customer 2 review by injecting userId / reviewId in body
    const resC1Tamper = await request(`/products/${revProdId}/reviews`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customer1.token}` },
      body: JSON.stringify({
        user: customer2.user._id,
        userId: customer2.user._id,
        rating: 1,
        comment: 'Tamper attempt comment'
      })
    });
    assert(resC1Tamper.status === 200, 'Customer 1 update request succeeds for their own review');

    // Check DB state: Customer 2 review MUST NOT have changed
    const prodAfterTamper = await Product.findById(revProdId);
    const c2ReviewInDb = prodAfterTamper.reviews.find(r => r.user.toString() === customer2.user._id.toString());
    const c1ReviewInDb = prodAfterTamper.reviews.find(r => r.user.toString() === customer1.user._id.toString());
    assert(c2ReviewInDb && c2ReviewInDb.rating === 5, 'Customer 2 review rating remained 5 (tamper attempt had no effect)');
    assert(c1ReviewInDb && c1ReviewInDb.rating === 1, 'Customer 1 updated their own review rating to 1');
    assert(prodAfterTamper.averageRating === 3, 'Average rating recalculated to 3.0 ((1 + 5) / 2)');

    // 3.6 Non-reviewer (Customer 3) attempts to update review
    const resC3Update = await request(`/products/${revProdId}/reviews`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customer3.token}` },
      body: JSON.stringify({ rating: 4, comment: 'I have no review' })
    });
    assert(resC3Update.status === 404, 'Customer with no existing review on PUT gets HTTP 404');

    // 3.7 Non-reviewer (Customer 3) attempts to delete review
    const resC3Delete = await request(`/products/${revProdId}/reviews`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customer3.token}` }
    });
    assert(resC3Delete.status === 404, 'Customer with no existing review on DELETE gets HTTP 404');

    // 3.8 Customer 1 deletes their review via singular /review
    const resC1Delete = await request(`/products/${revProdId}/review`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customer1.token}` }
    });
    assert(resC1Delete.status === 200, 'Customer 1 deletes review via /review (HTTP 200)');
    assert(resC1Delete.data.data.totalReviews === 1, 'Product totalReviews decreased to 1');
    assert(resC1Delete.data.data.averageRating === 5, 'Product averageRating updated to 5.0 (Customer 2 review remaining)');
    assert(resC1Delete.data.data.ratings === 5, 'Product ratings legacy field synchronized to 5.0');

    // 3.9 Customer 2 deletes their review via plural /reviews (resulting in empty reviews array)
    const resC2Delete = await request(`/products/${revProdId}/reviews`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customer2.token}` }
    });
    assert(resC2Delete.status === 200, 'Customer 2 deletes review via /reviews (HTTP 200)');
    assert(resC2Delete.data.data.totalReviews === 0, 'Empty reviews array sets totalReviews to 0');
    assert(resC2Delete.data.data.averageRating === 0, 'Empty reviews array sets averageRating to 0');
    assert(resC2Delete.data.data.ratings === 0, 'Empty reviews array sets ratings to 0');

    // 3.10 Critical Database Verification: Reload from DB and check pre-save hook behavior
    const reloadedEmptyProduct = await Product.findById(revProdId);
    assert(reloadedEmptyProduct.totalReviews === 0, 'Persisted DB document totalReviews is 0');
    assert(reloadedEmptyProduct.averageRating === 0, 'Persisted DB document averageRating is 0 (no hook corruption)');
    assert(reloadedEmptyProduct.ratings === 0, 'Persisted DB document ratings is 0');

    // 3.11 Re-save empty product to test that pre-save hook does NOT revert averageRating
    await reloadedEmptyProduct.save();
    const savedAgainProduct = await Product.findById(revProdId);
    assert(savedAgainProduct.averageRating === 0, 'Re-saving product preserves averageRating === 0');
    assert(savedAgainProduct.totalReviews === 0, 'Re-saving product preserves totalReviews === 0');

  } finally {
    // ============================================================
    // Cleanup Isolated Test Data
    // ============================================================
    console.log('\n--- Cleaning Up Isolated Test Data ---');
    if (createdProductIds.length > 0) {
      const delProdResult = await Product.deleteMany({ _id: { $in: createdProductIds } });
      console.log(`  ✓ Cleaned up ${delProdResult.deletedCount} test product(s)`);
    }
    if (createdUserIds.length > 0) {
      const delUserResult = await User.deleteMany({ _id: { $in: createdUserIds } });
      console.log(`  ✓ Cleaned up ${delUserResult.deletedCount} test user(s)`);
    }

    const finalProductCount = await Product.countDocuments();
    console.log(`Final total product count in DB: ${finalProductCount}`);
    assert(finalProductCount >= 61, `Original 61 catalog products are intact (count: ${finalProductCount})`);

    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
