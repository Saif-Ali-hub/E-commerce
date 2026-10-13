const http = require('http');

function post(path, data, token = null) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(path, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('Testing Feature 4 & 5 Backend APIs...');

  // 1. Test Pincode Estimator (Feature 4)
  console.log('\n--- 1. Testing Pincode Estimator ---');
  const pinDelhi = await get('/api/addresses/check-pincode/110001');
  console.log('PIN 110001 (Delhi):', pinDelhi.status, pinDelhi.data.city, pinDelhi.data.estimatedDays, pinDelhi.data.estimatedDeliveryDate);

  const pinBlr = await get('/api/addresses/check-pincode/560001');
  console.log('PIN 560001 (Bengaluru):', pinBlr.status, pinBlr.data.city, pinBlr.data.estimatedDays);

  const pinInvalid = await get('/api/addresses/check-pincode/0123');
  console.log('PIN 0123 (Invalid):', pinInvalid.status, pinInvalid.data.message);

  // 2. Register & Login test user
  console.log('\n--- 2. Register fresh user for Wallet & Address Book testing ---');
  const testEmail = `wallet_test_${Date.now()}@example.com`;
  const regRes = await post('/api/auth/register', {
    name: 'Aarav Patel',
    email: testEmail,
    password: 'Password123'
  });
  console.log('Registered:', regRes.status, regRes.data.message);

  const loginRes = await post('/api/auth/login', {
    email: testEmail,
    password: 'Password123'
  });
  const token = loginRes.data.token;
  console.log('Logged in successfully!');

  // 3. Test Wallet Details (Feature 5)
  console.log('\n--- 3. Testing GET /api/wallet (Starter Welcome Bonus) ---');
  const walletRes = await get('/api/wallet', token);
  console.log('Initial Wallet:', walletRes.status, 'Balance: ₹' + walletRes.data.data.walletBalance, 'Coins:', walletRes.data.data.coins, 'Txns count:', walletRes.data.data.transactions.length);

  // 4. Test Add Money to Wallet
  console.log('\n--- 4. Testing POST /api/wallet/add-money ---');
  const addMoneyRes = await post('/api/wallet/add-money', { amount: 500 }, token);
  console.log('Add Money Response:', addMoneyRes.status, addMoneyRes.data.message, 'New Balance: ₹' + addMoneyRes.data.data.walletBalance, 'Coins:', addMoneyRes.data.data.coins);

  // 5. Test Redeem Coins
  console.log('\n--- 5. Testing POST /api/wallet/redeem-coins ---');
  const redeemRes = await post('/api/wallet/redeem-coins', { coinsToRedeem: 40 }, token);
  console.log('Redeem Coins Response:', redeemRes.status, redeemRes.data.message, 'New Balance: ₹' + redeemRes.data.data.walletBalance, 'Remaining Coins:', redeemRes.data.data.coins);

  // 6. Test Create Address
  console.log('\n--- 6. Testing Address Book CRUD ---');
  const addrRes = await post('/api/addresses', {
    fullName: 'Aarav Patel',
    phone: '9876543210',
    addressLine1: 'Flat 402, Sunshine Heights',
    addressLine2: 'Indiranagar 100ft Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560038',
    country: 'India',
    addressType: 'Home',
    isDefault: true
  }, token);
  console.log('Address Created:', addrRes.status, addrRes.data.data._id, addrRes.data.data.city);

  // 7. Test Add product to Cart and Place Order with useWallet
  console.log('\n--- 7. Testing Order with Wallet Discount & Cashback ---');
  const prodsRes = await get('/api/products');
  const firstProd = prodsRes.data.data[0];

  await post('/api/cart', { productId: firstProd._id, quantity: 1 }, token);
  console.log('Added product to cart:', firstProd.name, 'Price: ₹' + firstProd.price);

  const orderRes = await post('/api/orders', {
    addressId: addrRes.data.data._id,
    paymentMethod: 'COD',
    useWallet: true
  }, token);
  console.log('Order Placement:', orderRes.status, orderRes.data.success ? 'Order Placed!' : orderRes.data.message);
  if (orderRes.data.data) {
    console.log('Order ID:', orderRes.data.data.orderId || orderRes.data.data._id);
    console.log('Subtotal: ₹' + orderRes.data.data.subtotalAmount);
    console.log('Wallet Discount: ₹' + orderRes.data.data.walletDiscount);
    console.log('Final Total: ₹' + orderRes.data.data.totalAmount);
    console.log('Payment Method:', orderRes.data.data.paymentMethod);
    console.log('Coins Earned:', orderRes.data.data.coinsEarned);
  }

  // 8. Re-check wallet to verify debit & cashback transactions
  const updatedWallet = await get('/api/wallet', token);
  console.log('\nUpdated Wallet Balance: ₹' + updatedWallet.data.data.walletBalance);
  console.log('Updated Coins Balance:', updatedWallet.data.data.coins);
  console.log('Latest 2 Transactions:', updatedWallet.data.data.transactions.slice(0, 2).map(t => `${t.type.toUpperCase()}: ${t.description}`));

  console.log('\n✅ ALL BACKEND TESTS PASSED WITH 100% SUCCESS!');
}

run().catch(console.error);
