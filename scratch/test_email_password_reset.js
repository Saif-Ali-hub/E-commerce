/**
 * ============================================================================
 * Mini Store Platform — Transactional Email, PDF Invoice & Password Reset Suite
 * File: scratch/test_email_password_reset.js
 *
 * Standalone automated test suite verifying:
 * 1. PDF Invoice buffer generation with pdfkit (headers, line items, pricing)
 * 2. Nodemailer transporter configuration & safe mock fallback
 * 3. Secure password reset flow (OTP generation, 15-min expiry, hashing)
 * 4. Password validation (8+ chars, letters + numbers)
 * 5. Successful password update and authentication with new credentials
 * 6. Rejection of invalid, mismatched, and expired verification codes
 * 7. Clean test teardown
 * ============================================================================
 */

const path = require('path');
const dotenv = require('../backend/node_modules/dotenv');
const mongoose = require('../backend/node_modules/mongoose');
const crypto = require('crypto');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const { generateInvoicePDF } = require('../backend/utils/invoiceGenerator');
const { sendOrderConfirmationEmail, sendOrderStatusEmail, sendPasswordResetEmail } = require('../backend/config/mailer');
const User = require('../backend/models/User');

const API_BASE = 'http://localhost:5000/api';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/E-commerce';

// Native fetch helper
async function api(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const start = Date.now();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const durationMs = Date.now() - start;
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data, durationMs };
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    passedCount++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedCount++;
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🚀 MiniStore Email, PDF Invoice & Password Reset Verification');
  console.log('================================================================\n');

  // Connect to DB for direct schema & state checks
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }

  const testEmail = `test_pwd_reset_${Date.now()}@example.com`;
  const initialPassword = 'InitialPass123!';
  const updatedPassword = 'NewSecurePass2026!';
  let createdUserId = null;

  try {
    // --------------------------------------------------------------------------
    // Test Category 1: PDF Invoice Generator
    // --------------------------------------------------------------------------
    console.log('📄 1. PDF Invoice Generator (pdfkit in-memory buffer)');
    const mockOrder = {
      _id: new mongoose.Types.ObjectId(),
      trackingNumber: 'MS-TRK-TESTPDF01',
      createdAt: new Date(),
      status: 'Processing',
      paymentMethod: 'razorpay',
      paymentStatus: 'Paid',
      paymentDetails: {
        razorpayPaymentId: 'pay_test_inv_123456789'
      },
      shippingAddress: {
        fullName: 'Test Customer',
        phone: '9876543210',
        addressLine1: '42 MG Road, Sector 5',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India'
      },
      orderItems: [
        {
          title: 'Premium Wireless Headphones',
          quantity: 2,
          price: 2499,
          subtotal: 4998
        },
        {
          title: 'Mechanical Gaming Keyboard',
          quantity: 1,
          price: 3499,
          subtotal: 3499
        }
      ],
      itemsPrice: 8497,
      couponDiscount: 500,
      walletAmountUsed: 200,
      shippingPrice: 0,
      totalPrice: 7797
    };

    const pdfBuffer = await generateInvoicePDF(mockOrder);
    assert(Buffer.isBuffer(pdfBuffer), 'generateInvoicePDF returns a valid Buffer');
    assert(pdfBuffer.length > 2000, `Generated PDF buffer has substantial length (${pdfBuffer.length} bytes)`);
    const pdfHeader = pdfBuffer.slice(0, 5).toString('utf-8');
    assert(pdfHeader === '%PDF-', `Buffer starts with PDF magic header (%PDF-, got: ${pdfHeader})`);

    // --------------------------------------------------------------------------
    // Test Category 2: Nodemailer Transporter & Mock Fallback
    // --------------------------------------------------------------------------
    console.log('\n📧 2. Nodemailer Mailer Service');
    const orderEmailResult = await sendOrderConfirmationEmail(
      mockOrder,
      pdfBuffer,
      'customer@example.com'
    );
    assert(orderEmailResult && orderEmailResult.success, 'sendOrderConfirmationEmail completes successfully with mock/dev transporter');

    const statusEmailResult = await sendOrderStatusEmail(
      mockOrder,
      'Shipped',
      'customer@example.com'
    );
    assert(statusEmailResult && statusEmailResult.success, 'sendOrderStatusEmail completes successfully for status update');

    // --------------------------------------------------------------------------
    // Test Category 3: User Registration & Initial State
    // --------------------------------------------------------------------------
    console.log('\n👤 3. User Setup & Registration');
    const regRes = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Reset Test User',
        email: testEmail,
        password: initialPassword
      })
    });
    assert(regRes.status === 201 && regRes.data.success, 'Test user registered successfully');
    createdUserId = regRes.data?.user?.id;

    // Verify initial user state in DB
    const dbUser = await User.findOne({ email: testEmail });
    assert(dbUser !== null, 'User found in database');
    assert(!dbUser.resetPasswordToken, 'Initial resetPasswordToken is unset/null in database');
    assert(!dbUser.resetPasswordExpire, 'Initial resetPasswordExpire is unset/null in database');

    // --------------------------------------------------------------------------
    // Test Category 4: Forgot Password Flow (OTP Generation & 15-min Expiry)
    // --------------------------------------------------------------------------
    console.log('\n🔑 4. Forgot Password Flow & Expiration Validation');

    // Test nonexistent email
    const nonexistentRes = await api('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'nonexistent_user_999@unknown.xyz' })
    });
    assert(nonexistentRes.status === 404, 'forgot-password returns 404 for unregistered email');

    // Test valid forgot-password request
    const beforeRequestTime = Date.now();
    const forgotRes = await api('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail })
    });
    assert(forgotRes.status === 200 && forgotRes.data.success, 'forgot-password endpoint returns 200 and success');
    const otp = forgotRes.data.debugOtp;
    assert(typeof otp === 'string' && otp.length === 6, `Generated 6-digit OTP code (${otp})`);

    // Verify DB state for OTP hash and 15-minute expiry
    const userWithToken = await User.findOne({ email: testEmail });
    const expectedHash = crypto.createHash('sha256').update(otp).digest('hex');
    assert(userWithToken.resetPasswordToken === expectedHash, 'resetPasswordToken is correctly hashed with SHA-256 in database');

    const expireTime = new Date(userWithToken.resetPasswordExpire).getTime();
    const expectedExpireTime = beforeRequestTime + 15 * 60 * 1000;
    const diffSeconds = Math.abs(expireTime - expectedExpireTime) / 1000;
    assert(diffSeconds < 10, `resetPasswordExpire is exactly ~15 minutes from creation (diff: ${diffSeconds.toFixed(1)}s)`);

    // --------------------------------------------------------------------------
    // Test Category 5: Password Reset Validation Rejections
    // --------------------------------------------------------------------------
    console.log('\n🛡️ 5. Password Reset Validation & Edge Cases');

    // Rejection 1: Invalid OTP code
    const invalidOtpRes = await api('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        otp: '000000',
        newPassword: updatedPassword
      })
    });
    assert(invalidOtpRes.status === 400 && invalidOtpRes.data.success === false, 'Rejects invalid 6-digit OTP code');

    // Rejection 2: Weak password (< 8 characters)
    const weakPassRes1 = await api('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        otp: otp,
        newPassword: 'short'
      })
    });
    assert(weakPassRes1.status === 400, 'Rejects password shorter than 8 characters');

    // Rejection 3: Weak password (no digits)
    const weakPassRes2 = await api('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        otp: otp,
        newPassword: 'lettersandmoreletters'
      })
    });
    assert(weakPassRes2.status === 400, 'Rejects password without alphanumeric combination');

    // --------------------------------------------------------------------------
    // Test Category 6: Successful Password Reset & Re-authentication
    // --------------------------------------------------------------------------
    console.log('\n✅ 6. Successful Password Reset & Login');
    const successfulResetRes = await api('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        otp: otp,
        newPassword: updatedPassword
      })
    });
    assert(successfulResetRes.status === 200 && successfulResetRes.data.success, 'reset-password returns 200 success with valid OTP and strong password');

    // Verify token fields are cleared in DB
    const resetUserInDb = await User.findOne({ email: testEmail });
    assert(!resetUserInDb.resetPasswordToken, 'resetPasswordToken field is cleared in DB after successful reset');
    assert(!resetUserInDb.resetPasswordExpire, 'resetPasswordExpire field is cleared in DB after successful reset');

    // Verify old password no longer works
    const oldLoginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: initialPassword
      })
    });
    assert(oldLoginRes.status === 401 && !oldLoginRes.data.success, 'Old password fails authentication (401 Unauthorized)');

    // Verify new password works
    const newLoginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: updatedPassword
      })
    });
    assert(newLoginRes.status === 200 && newLoginRes.data.success, 'New password successfully authenticates and returns JWT token');

    // --------------------------------------------------------------------------
    // Test Category 7: Expired Token Rejection
    // --------------------------------------------------------------------------
    console.log('\n⏳ 7. Token Expiry Enforcement');
    // Request a fresh OTP
    const freshForgotRes = await api('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail })
    });
    assert(freshForgotRes.status === 200, 'Fresh forgot-password request succeeds');
    const freshOtp = freshForgotRes.data.debugOtp;

    // Artificially expire the token in database
    await User.updateOne(
      { email: testEmail },
      { resetPasswordExpire: new Date(Date.now() - 60 * 1000) } // 1 minute in the past
    );

    // Attempt reset with expired token
    const expiredResetRes = await api('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        otp: freshOtp,
        newPassword: 'AnotherPassword999!'
      })
    });
    assert(expiredResetRes.status === 400 && !expiredResetRes.data.success, 'Rejects reset attempt when OTP has expired');

  } catch (err) {
    console.error('Unexpected test error:', err);
    failedCount++;
  } finally {
    // --------------------------------------------------------------------------
    // Cleanup / Teardown
    // --------------------------------------------------------------------------
    console.log('\n🧹 8. Cleaning up test data...');
    try {
      if (testEmail) {
        const deleteRes = await User.deleteOne({ email: testEmail });
        console.log(`   Deleted test user (${deleteRes.deletedCount} record(s) removed).`);
      }
    } catch (cleanErr) {
      console.error('   Teardown warning:', cleanErr.message);
    }
  }

  console.log('\n================================================================');
  console.log(`📊 Test Summary: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
