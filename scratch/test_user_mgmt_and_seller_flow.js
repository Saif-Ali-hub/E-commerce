/**
 * Integration Test Suite:
 * - Customer "Become a Seller" upgrade workflow
 * - Admin User Management (GET /api/admin/users with pagination, search, role filter)
 * - Admin User Status Toggle (PUT /api/admin/users/:id/status)
 * - Order User Reference resilience (no CastError for string users)
 * - Admin Platform-Wide & Store-Filtered Seller Overview & Products
 * - Legacy User Sync verification (user@gmail.com)
 */

const path = require('path');
const dotenv = require('../backend/node_modules/dotenv');
const mongoose = require('../backend/node_modules/mongoose');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });
const User = require('../backend/models/User');
const Order = require('../backend/models/Order');
const Product = require('../backend/models/Product');

const BASE_URL = 'http://localhost:5000/api';

const runTests = async () => {
  console.log('================================================================');
  console.log('🧪 MiniStore User Management & Seller Workflow Test Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Connect to DB for direct verification
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/e-commerce';
  await mongoose.connect(mongoUri);

  const cleanupUserIds = [];

  try {
    // 1. Authenticate Admin
    console.log('🛡️ 1. Admin Authentication & RBAC Verification');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ministore.com', password: 'adminpassword123' })
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200 && adminLoginData.token, 'Admin account authenticated successfully');
    const adminToken = adminLoginData.token;
    const adminUserId = adminLoginData.user.id || adminLoginData.user._id;

    // 2. Register a New Customer
    console.log('\n👤 2. Customer Registration & Become a Seller Workflow');
    const testCustEmail = `testcust_${Date.now()}@example.com`;
    const custRegRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Prospective Seller',
        email: testCustEmail,
        password: 'Password123'
      })
    });
    const custRegData = await custRegRes.json();
    assert(custRegRes.status === 201 && custRegData.success, 'New customer registered');
    const custUserId = custRegData.data.id;
    cleanupUserIds.push(custUserId);

    const custLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustEmail, password: 'Password123' })
    });
    const custLoginData = await custLoginRes.json();
    assert(custLoginRes.status === 200 && custLoginData.token, 'Customer logged in and retrieved JWT');
    const custToken = custLoginData.token;

    // 3. Validation Tests on /api/auth/become-seller
    const failPanRes = await fetch(`${BASE_URL}/auth/become-seller`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`
      },
      body: JSON.stringify({
        businessName: 'Nova Enterprise',
        contactNumber: '9876543210',
        pan: 'SHORT'
      })
    });
    const failPanData = await failPanRes.json();
    assert(failPanRes.status === 400 && !failPanData.success, 'Invalid PAN (<10 chars) rejected with HTTP 400');

    // Successful upgrade
    const becomeSellerRes = await fetch(`${BASE_URL}/auth/become-seller`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`
      },
      body: JSON.stringify({
        businessName: 'Nova Enterprise Ltd',
        businessAddress: '100 Commercial Boulevard, Mumbai',
        contactNumber: '9876543210',
        pan: 'ABCDE1234F',
        gstin: '27ABCDE1234F1Z5'
      })
    });
    const becomeSellerData = await becomeSellerRes.json();
    assert(becomeSellerRes.status === 200 && becomeSellerData.success, 'Customer successfully upgraded to seller');
    assert(becomeSellerData.data.role === 'seller', 'User role upgraded to seller');
    assert(becomeSellerData.data.sellerDetails.verificationStatus === 'pending', 'Seller verification status initialized to pending');

    // 4. Admin Users Management API (GET /api/admin/users)
    console.log('\n👥 3. Admin Users Management API');
    // 4.1 Non-admin access rejection
    const unauthUsersRes = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${custToken}` }
    });
    assert(unauthUsersRes.status === 403, 'Non-admin forbidden from accessing /api/admin/users (HTTP 403)');

    // 4.2 Admin fetch all users
    const allUsersRes = await fetch(`${BASE_URL}/admin/users?limit=20`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const allUsersData = await allUsersRes.json();
    assert(allUsersRes.status === 200 && allUsersData.success, 'Admin successfully fetched users list');
    assert(Array.isArray(allUsersData.data) && allUsersData.total > 0, 'Users array and total count returned');
    assert(allUsersData.data.every(u => !u.password), 'Security: Password hashes are strictly omitted from response');

    // 4.3 Search users by name or email
    const searchRes = await fetch(`${BASE_URL}/admin/users?q=Prospective`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const searchData = await searchRes.json();
    assert(searchRes.status === 200 && searchData.data.some(u => u.email === testCustEmail), 'Search query matching user name returned matching record');

    // 4.4 Role filtering (role=seller)
    const sellersFilterRes = await fetch(`${BASE_URL}/admin/users?role=seller`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const sellersFilterData = await sellersFilterRes.json();
    assert(sellersFilterRes.status === 200 && sellersFilterData.data.every(u => u.role === 'seller'), 'Role filter "role=seller" returns only seller accounts');

    // 5. Admin User Status Toggle (PUT /api/admin/users/:id/status)
    console.log('\n🔒 4. Admin User Status Management');
    const suspendRes = await fetch(`${BASE_URL}/admin/users/${custUserId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'suspended' })
    });
    const suspendData = await suspendRes.json();
    assert(suspendRes.status === 200 && suspendData.success, 'Admin successfully suspended user account');

    // Check DB status
    const dbSuspendedUser = await User.findById(custUserId);
    assert(dbSuspendedUser.status === 'suspended', 'User status in MongoDB updated to "suspended"');

    // Re-activate user
    const reactivateRes = await fetch(`${BASE_URL}/admin/users/${custUserId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'active' })
    });
    const reactivateData = await reactivateRes.json();
    assert(reactivateRes.status === 200 && reactivateData.data.status === 'active', 'Admin successfully re-activated user account');

    // Self-suspension guard
    const selfSuspendRes = await fetch(`${BASE_URL}/admin/users/${adminUserId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'suspended' })
    });
    assert(selfSuspendRes.status === 400, 'Admin prevented from self-suspending with HTTP 400');

    // 6. Admin Orders Endpoint & User Reference Resilience
    console.log('\n📦 5. Admin Orders Endpoint & String User Resilience');
    const adminOrdersRes = await fetch(`${BASE_URL}/admin/orders?limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminOrdersData = await adminOrdersRes.json();
    assert(adminOrdersRes.status === 200 && adminOrdersData.success, 'GET /api/admin/orders returned successfully without CastError');
    assert(Array.isArray(adminOrdersData.data), 'Admin orders list returned as array');

    // 7. Admin Seller Overview & Store Slicing
    console.log('\n📊 6. Admin Seller Overview & Platform View');
    const adminPlatformOverview = await fetch(`${BASE_URL}/seller/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminPlatformData = await adminPlatformOverview.json();
    assert(adminPlatformOverview.status === 200 && adminPlatformData.success, 'Admin loaded platform-wide merchant overview (HTTP 200)');
    assert(adminPlatformData.data.metrics.totalRevenue !== undefined, 'Platform metrics contain total revenue');

    const adminProductsRes = await fetch(`${BASE_URL}/seller/products?limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminProductsData = await adminProductsRes.json();
    assert(adminProductsRes.status === 200 && adminProductsData.success, 'Admin retrieved platform-wide products catalog');

    // 8. Legacy Database Sync Verification
    console.log('\n💾 7. Legacy Database Sync Verification');
    const legacyUser = await User.findOne({ email: 'user@gmail.com' });
    assert(Boolean(legacyUser), 'user@gmail.com successfully exists in MongoDB e-commerce database');

  } catch (err) {
    console.error('Unhandled test suite error:', err);
    failed++;
  } finally {
    // Cleanup created test users
    if (cleanupUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: cleanupUserIds } });
      console.log(`\n🧹 Cleaned up ${cleanupUserIds.length} temporary test user(s).`);
    }
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  console.log(`📊 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
