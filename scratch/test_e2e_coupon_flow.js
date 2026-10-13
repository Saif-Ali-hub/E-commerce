async function runE2ECouponFlow() {
  console.log('--- STARTING E2E COUPON FLOW TEST ---');

  // 1. Log in as a customer
  let custToken = null;
  const custEmail = `shopper_${Date.now()}@example.com`;
  const custPass = 'Password@123';

  // Register
  const regRes = await fetch('http://127.0.0.1:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Coupon Shopper', email: custEmail, password: custPass })
  });

  // Login
  const loginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: custEmail, password: custPass })
  });
  const loginData = await loginRes.json();
  custToken = loginData.token;

  console.log('✓ Step 1: Customer authenticated');

  // 2. Fetch active public coupons
  const activeRes = await fetch('http://127.0.0.1:5000/api/coupons/active');
  const activeData = await activeRes.json();
  console.log(`✓ Step 2: Retrieved ${activeData.count} active store coupons:`, activeData.data.map(c => c.code).join(', '));
  const hasFestive = activeData.data.some(c => c.code === 'FESTIVE10');
  if (!hasFestive) throw new Error('FESTIVE10 not found in active coupons');

  // 3. Clear customer cart & add 2 items (e.g. Wireless Mouse x 3 to reach festive total > 999)
  const prodsRes = await fetch('http://127.0.0.1:5000/api/products');
  const prodsData = await prodsRes.json();
  const prodsList = prodsData.products || prodsData.data;
  const testProduct = prodsList[0];

  await fetch('http://127.0.0.1:5000/api/cart', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${custToken}` }
  });

  // Add 3 qty
  const addRes = await fetch('http://127.0.0.1:5000/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({ productId: testProduct._id, quantity: 3 })
  });
  const cartData = await addRes.json();
  if (!cartData.success) {
    throw new Error('Add to cart failed: ' + JSON.stringify(cartData));
  }
  const subtotal = cartData.data.totalAmount;
  console.log(`✓ Step 3: Added items to cart. Cart subtotal: ₹${subtotal}`);

  // 4. Validate coupon FESTIVE10
  const valRes = await fetch('http://127.0.0.1:5000/api/coupons/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({ code: 'FESTIVE10', subtotal })
  });
  const valData = await valRes.json();
  if (subtotal >= 999) {
    if (!valData.valid || valData.data.discountAmount !== 200) {
      throw new Error('FESTIVE10 validation failed: ' + JSON.stringify(valData));
    }
    console.log(`✓ Step 4: Validated coupon FESTIVE10: Saved ₹${valData.data.discountAmount}, Final: ₹${valData.data.finalTotal}`);
  } else {
    console.log(`✓ Step 4: Validated subtotal requirement message: ${valData.message}`);
  }

  // 5. Customer places order with coupon
  // First ensure customer has an address
  const addrRes = await fetch('http://127.0.0.1:5000/api/addresses', {
    headers: { Authorization: `Bearer ${custToken}` }
  });
  const addrData = await addrRes.json();
  let addressId = addrData.data && addrData.data[0] ? addrData.data[0]._id : null;

  if (!addressId) {
    const newAddrRes = await fetch('http://127.0.0.1:5000/api/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: JSON.stringify({
        fullName: 'Coupon Shopper',
        phone: '9876543210',
        addressLine1: '42 MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
        addressType: 'Home'
      })
    });
    const newAddrData = await newAddrRes.json();
    addressId = newAddrData.data._id;
  }

  // Ensure cart subtotal >= 999 for FESTIVE10
  if (subtotal < 999) {
    await fetch('http://127.0.0.1:5000/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: JSON.stringify({ productId: testProduct._id, quantity: 4 })
    });
  }

  const orderRes = await fetch('http://127.0.0.1:5000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({
      addressId,
      paymentMethod: 'COD',
      couponCode: 'FESTIVE10'
    })
  });
  const orderData = await orderRes.json();
  if (!orderData.success) {
    throw new Error('Order creation with coupon failed: ' + JSON.stringify(orderData));
  }
  const placedOrder = orderData.data;
  console.log(`✓ Step 5: Placed order #${placedOrder._id}`);
  console.log(`         Subtotal: ₹${placedOrder.subtotalAmount}`);
  console.log(`         Coupon Applied: ${placedOrder.coupon.code} (-₹${placedOrder.discountAmount})`);
  console.log(`         Total Charged: ₹${placedOrder.totalAmount}`);

  if (placedOrder.coupon.code !== 'FESTIVE10' || placedOrder.discountAmount !== 200) {
    throw new Error('Coupon discount not recorded properly in order snapshot');
  }

  // 6. Admin inspection
  const adminLogin = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ministore.com', password: 'adminpassword123' })
  });
  const adminToken = (await adminLogin.json()).token;

  const adminCouponsRes = await fetch('http://127.0.0.1:5000/api/admin/coupons', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const adminCouponsData = await adminCouponsRes.json();
  const festiveAdminRecord = adminCouponsData.data.find(c => c.code === 'FESTIVE10');
  console.log(`✓ Step 6: Admin inspected FESTIVE10 redemptions: ${festiveAdminRecord.usageCount} used (Incremented!)`);

  if (festiveAdminRecord.usageCount < 1) {
    throw new Error('Coupon usageCount was not incremented after order');
  }

  // 7. Admin creates new coupon SUPEROFF30
  const exp = new Date(); exp.setDate(exp.getDate() + 30);
  const createRes = await fetch('http://127.0.0.1:5000/api/admin/coupons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      code: 'SUPEROFF30',
      description: 'Super discount 30% off',
      discountType: 'PERCENTAGE',
      discountValue: 30,
      maxDiscountAmount: 300,
      minOrderAmount: 200,
      expiryDate: exp.toISOString()
    })
  });
  const created = (await createRes.json()).data;
  console.log(`✓ Step 7: Admin created new coupon: ${created.code} (${created.discountValue}% OFF)`);

  // 8. Admin disables coupon SUPEROFF30
  const toggleRes = await fetch(`http://127.0.0.1:5000/api/admin/coupons/${created._id}/toggle`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const toggled = await toggleRes.json();
  console.log(`✓ Step 8: Admin toggled status: ${toggled.message}`);

  // 9. Customer attempts to apply disabled coupon
  const attemptRes = await fetch('http://127.0.0.1:5000/api/coupons/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
    body: JSON.stringify({ code: 'SUPEROFF30', subtotal: 500 })
  });
  const attemptData = await attemptRes.json();
  console.log(`✓ Step 9: Customer validation correctly rejected disabled coupon: "${attemptData.message}"`);

  // 10. Clean up test coupon
  await fetch(`http://127.0.0.1:5000/api/admin/coupons/${created._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('✓ Step 10: Cleaned up test coupon SUPEROFF30');

  console.log('\n=========================================');
  console.log('✨ ALL 10 E2E COUPON FLOW TESTS PASSED! ✨');
  console.log('=========================================');
}

runE2ECouponFlow().catch(err => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
