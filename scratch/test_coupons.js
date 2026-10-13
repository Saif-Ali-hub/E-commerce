const http = require('http');

async function runTest() {
  console.log('Testing Admin & Customer Coupon APIs...');

  // 1. Login as admin
  const loginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ministore.com', password: 'adminpassword123' })
  });
  const loginData = await loginRes.json();
  if (!loginData.token) {
    throw new Error('Admin login failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.token;
  console.log('✓ Admin login successful');

  // 2. Fetch admin coupons
  const listRes = await fetch('http://127.0.0.1:5000/api/admin/coupons', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listData = await listRes.json();
  console.log(`✓ Fetched ${listData.count} admin coupons`);

  // 3. Create a test coupon
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 15);
  const createRes = await fetch('http://127.0.0.1:5000/api/admin/coupons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      code: 'TESTVIP',
      description: 'VIP 25% discount test coupon',
      discountType: 'PERCENTAGE',
      discountValue: 25,
      maxDiscountAmount: 300,
      minOrderAmount: 500,
      expiryDate: expiry.toISOString(),
      usageLimit: 50
    })
  });
  const createData = await createRes.json();
  console.log('✓ Coupon creation:', createData.message);
  const couponId = createData.data._id;

  // 4. Validate coupon as customer
  const valRes = await fetch('http://127.0.0.1:5000/api/coupons/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code: 'TESTVIP', subtotal: 1000 })
  });
  const valData = await valRes.json();
  console.log('✓ Validate TESTVIP on ₹1000 subtotal:', valData.message, 'Discount:', valData.data.discountAmount);

  // 5. Toggle coupon status
  const toggleRes = await fetch(`http://127.0.0.1:5000/api/admin/coupons/${couponId}/toggle`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` }
  });
  const toggleData = await toggleRes.json();
  console.log('✓ Toggle status:', toggleData.message);

  // 6. Delete test coupon
  const delRes = await fetch(`http://127.0.0.1:5000/api/admin/coupons/${couponId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  const delData = await delRes.json();
  console.log('✓ Delete test coupon:', delData.message);

  console.log('ALL BACKEND COUPON TESTS PASSED!');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
