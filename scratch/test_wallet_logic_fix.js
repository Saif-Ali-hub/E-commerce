const http = require('http');

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

async function runTests() {
  console.log('Testing Wallet Logic Fix...\n');

  // 1. Register a fresh user
  const email = `wallet_fix_${Date.now()}@example.com`;
  const regRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Wallet Fix Tester',
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
  console.log('User registered & logged in. Token acquired:', Boolean(token));

  // 2. Check initial wallet balance (should be 0, with 50 coins)
  const initWalletRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/wallet',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Initial wallet balance:', initWalletRes.data.data.walletBalance, 'Coins:', initWalletRes.data.data.coins);
  if (initWalletRes.data.data.walletBalance !== 0) {
    throw new Error(`Expected initial balance 0, got ${initWalletRes.data.data.walletBalance}`);
  }

  // 3. Test unauthenticated / unverified add-money (single-click free cash exploit attempt)
  const freeMoneyAttempt = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/wallet/add-money',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }, { amount: 1000 });
  console.log('Free money without payment attempt status:', freeMoneyAttempt.status, freeMoneyAttempt.data.message);
  if (freeMoneyAttempt.status !== 400) {
    throw new Error('Exploit attempt should have been blocked with 400!');
  }

  // 4. Test verified payment gateway recharge
  const verifiedRecharge = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/wallet/add-money',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }, {
    amount: 1000,
    paymentMethod: 'UPI',
    gatewayTxnId: 'TXN_GATEWAY_UPI_98234198'
  });
  console.log('Verified Gateway Recharge status:', verifiedRecharge.status, verifiedRecharge.data.message);
  console.log('New Wallet Balance:', verifiedRecharge.data.data.walletBalance, 'Coins:', verifiedRecharge.data.data.coins);
  if (verifiedRecharge.data.data.walletBalance !== 1000) {
    throw new Error(`Expected balance 1000, got ${verifiedRecharge.data.data.walletBalance}`);
  }

  // 5. Test 50% Fair Usage Policy on order placement
  // Create an address first
  const addrRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/addresses',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }, {
    fullName: 'Wallet Fix Tester',
    phone: '9876543210',
    addressLine1: '123 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    addressType: 'Home',
    isDefault: true
  });
  const addressId = addrRes.data.data._id;
  console.log('Address created:', addressId);

  // Find an in-stock product
  const prodRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/products',
    method: 'GET'
  });
  const product = prodRes.data.data.find(p => p.stock > 0);
  console.log('Found in-stock product:', product.name, 'Price: ₹' + product.price, 'Stock:', product.stock);

  // Add 1 to cart
  const cartRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/cart',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }, {
    productId: product._id,
    quantity: 1
  });
  console.log('Cart add status:', cartRes.status, cartRes.data);

  // Place order with useWallet: true
  const orderRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/orders',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }, {
    addressId: addressId,
    paymentMethod: 'COD',
    useWallet: true
  });
  console.log('Order res:', orderRes.status, orderRes.data);

  console.log('Order Placement Status:', orderRes.status);
  const order = orderRes.data.data;
  console.log('Order Subtotal: ₹' + order.subtotalAmount);
  console.log('Wallet Discount Applied: ₹' + order.walletDiscount);
  console.log('Final Amount to Pay: ₹' + order.totalAmount);

  // Check that final amount is NOT 0 and wallet discount is exactly 50% of subtotal
  const expectedMaxWallet = Math.round((order.subtotalAmount * 0.5) * 100) / 100;
  if (order.walletDiscount > expectedMaxWallet) {
    throw new Error(`Wallet discount ₹${order.walletDiscount} exceeded 50% limit of ₹${expectedMaxWallet}!`);
  }
  if (order.totalAmount <= 0) {
    throw new Error(`Final amount should never be 0 when total is positive! Got ₹${order.totalAmount}`);
  }
  if (order.paymentMethod === 'WALLET') {
    throw new Error('Payment method should NOT be WALLET when balance is not covering 100%');
  }

  console.log('\n✅ ALL WALLET FIX VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
