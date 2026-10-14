const http = require('http');
const crypto = require('crypto');
const path = require('path');
const dotenv = require('../backend/node_modules/dotenv');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('========================================================');
  console.log('   MINISTORE WALLET RAZORPAY VERIFICATION TEST SUITE    ');
  console.log('========================================================\n');

  // 1. Register a test user
  const email = `wallet_real_pay_${Date.now()}@example.com`;
  const regRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Real Wallet Tester',
    email,
    password: 'Password123!',
    phone: '9876543210'
  });

  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email,
    password: 'Password123!'
  });

  const token = loginRes.data.token;
  if (!token) throw new Error('Login failed, no token');
  console.log('✔ Test user registered & authenticated');

  // 2. Check initial wallet
  const initWalletRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/wallet',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✔ Initial balance:', initWalletRes.data.data.walletBalance, 'Coins:', initWalletRes.data.data.coins);

  // 3. Test invalid amounts for create-recharge-order
  const invalidAmtRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/wallet/create-recharge-order',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }, { amount: 5 });
  if (invalidAmtRes.status !== 400) throw new Error('Should reject amount < 10 with 400');
  console.log('✔ Rejected recharge amount < 10 (HTTP 400)');

  // 4. Create real Razorpay recharge order
  const rechargeAmt = 1000;
  const createOrderRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/wallet/create-recharge-order',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }, { amount: rechargeAmt });

  if (createOrderRes.status !== 200 || !createOrderRes.data.success) {
    throw new Error('create-recharge-order failed: ' + JSON.stringify(createOrderRes.data));
  }
  const rzpOrder = createOrderRes.data.order;
  console.log('✔ Created Razorpay recharge order:', rzpOrder.id, 'Amount (paise):', rzpOrder.amount);

  // 5. Test rejection of fake/tampered signature
  const fakeVerify = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/wallet/verify-recharge',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }, {
    amount: rechargeAmt,
    razorpay_order_id: rzpOrder.id,
    razorpay_payment_id: `pay_${Date.now()}`,
    razorpay_signature: 'fake_tampered_signature_99999999999999999999999999999999'
  });
  if (fakeVerify.status !== 400) throw new Error('Fake signature should have been rejected with 400');
  console.log('✔ Tampered payment signature rejected with HTTP 400 (Zero free money!)');

  // Verify wallet balance is STILL 0
  const walletCheck = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/wallet',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (walletCheck.data.data.walletBalance !== 0) {
    throw new Error('Wallet was credited despite fake payment!');
  }
  console.log('✔ Confirmed wallet balance is STILL 0 after rejected payment');

  // 6. Generate genuine HMAC-SHA256 signature
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const paymentId = `pay_${Date.now()}_genuine`;
  const signaturePayload = `${rzpOrder.id}|${paymentId}`;
  const validSignature = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');

  // 7. Verify genuine payment
  const realVerify = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/wallet/verify-recharge',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }, {
    amount: rechargeAmt,
    razorpay_order_id: rzpOrder.id,
    razorpay_payment_id: paymentId,
    razorpay_signature: validSignature
  });

  if (realVerify.status !== 200 || !realVerify.data.success) {
    throw new Error('Valid signature failed verification: ' + JSON.stringify(realVerify.data));
  }
  console.log('✔ Genuine Razorpay signature verified successfully (HTTP 200)');
  console.log('✔ Wallet balance updated to:', realVerify.data.data.walletBalance, 'Coins:', realVerify.data.data.coins);
  if (realVerify.data.data.walletBalance !== 1000) {
    throw new Error('Expected balance 1000, got ' + realVerify.data.data.walletBalance);
  }

  // 8. Test replay attack prevention (trying to verify the same payment ID again)
  const replayRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/wallet/verify-recharge',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }, {
    amount: rechargeAmt,
    razorpay_order_id: rzpOrder.id,
    razorpay_payment_id: paymentId,
    razorpay_signature: validSignature
  });
  if (replayRes.status !== 400) {
    throw new Error('Replay attack should have been rejected with 400');
  }
  console.log('✔ Duplicate replay attack rejected with HTTP 400 (Cannot credit same transaction twice)');

  console.log('\n========================================================');
  console.log('   ALL 8 TESTS PASSED: WALLET REAL PAYMENT VERIFIED!   ');
  console.log('========================================================\n');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
