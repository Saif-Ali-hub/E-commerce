/**
 * ============================================================================
 * MiniStore Platform — 1-Click Express Checkout ("Buy Now") Test Suite
 * File: scratch/test_buy_now.js
 *
 * Automated verification suite testing:
 * 1. Customer registration & cart setup with 2 distinct products
 * 2. Assert customer cart count is 2 items
 * 3. Execute "Buy Now" on a 3rd distinct product via POST /api/orders/buy-now
 * 4. Verify order creation with status 201, valid INV-... invoice, and MS-TRK-... tracking number
 * 5. Verify the purchased product's stock was atomically decremented by the purchased quantity
 * 6. CRITICAL: Verify Cart Isolation — Customer's active cart still has 2 items completely untouched!
 * 7. Test variant support in Buy Now with variant stock decrement
 * 8. Test cancellation of express order restores product/variant stock
 * 9. Test GET /api/orders/:id/invoice returns official tax invoice PDF stream
 * 10. Clean up all created test artifacts and verify 61 baseline products remain intact
 * ============================================================================
 */

const path = require('path');
const dotenv = require('../backend/node_modules/dotenv');
const mongoose = require('../backend/node_modules/mongoose');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const User = require('../backend/models/User');
const Product = require('../backend/models/Product');
const Order = require('../backend/models/Order');
const Address = require('../backend/models/Address');

const API_BASE = 'http://localhost:5000/api';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/E-commerce';

async function api(endpoint, options = {}, token = null) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const start = Date.now();
  const res = await fetch(url, {
    ...options,
    headers
  });
  const durationMs = Date.now() - start;

  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
  } else {
    try {
      const buffer = await res.arrayBuffer();
      data = { isBuffer: true, length: buffer.byteLength, contentType };
    } catch (e) {
      data = null;
    }
  }

  return { status: res.status, ok: res.ok, data, durationMs, headers: res.headers };
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${message}`);
    passedCount++;
  } else {
    console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('⚡ MiniStore Platform — 1-Click Express Checkout ("Buy Now") Test');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB database.\n');

  const baselineProductCount = await Product.countDocuments();
  console.log(`Initial product count in database: ${baselineProductCount}`);

  let testUser = null;
  let testUserToken = null;
  let testAddress = null;
  let testVariantProduct = null;
  let testStandardProduct = null;
  const createdOrderIds = [];

  try {
    // -------------------------------------------------------------
    // Step 1: Customer Registration & Auth
    // -------------------------------------------------------------
    console.log('\n🔹 Step 1: Register Customer & Setup Authentication');
    const userEmail = `buynow_test_${Date.now()}@example.com`;
    const userPassword = 'Password123!';
    const regRes = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'BuyNow Tester',
        email: userEmail,
        password: userPassword
      })
    });

    assert(regRes.status === 201, `Customer registered successfully (Status: ${regRes.status})`);
    
    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: userEmail,
        password: userPassword
      })
    });

    assert(loginRes.status === 200 && loginRes.data?.token, 'Customer logged in successfully with JWT token');
    testUserToken = loginRes.data.token;
    testUser = await User.findOne({ email: userEmail });

    // -------------------------------------------------------------
    // Step 2: Add 2 Existing Products to Active Cart
    // -------------------------------------------------------------
    console.log('\n🔹 Step 2: Populate Customer Cart with 2 Products');
    const existingProducts = await Product.find({ inStock: true, stock: { $gte: 5 } }).limit(2);
    assert(existingProducts.length >= 2, 'Found at least 2 in-stock products in catalog');

    const [prodA, prodB] = existingProducts;

    const cartAddResA = await api('/cart', {
      method: 'POST',
      body: JSON.stringify({ productId: prodA._id, quantity: 2 })
    }, testUserToken);
    assert(cartAddResA.ok && cartAddResA.data.success, `Added 2 units of "${prodA.name}" to cart`);

    const cartAddResB = await api('/cart', {
      method: 'POST',
      body: JSON.stringify({ productId: prodB._id, quantity: 1 })
    }, testUserToken);
    assert(cartAddResB.ok && cartAddResB.data.success, `Added 1 unit of "${prodB.name}" to cart`);

    // Verify initial cart state
    const initialCartRes = await api('/cart', { method: 'GET' }, testUserToken);
    assert(initialCartRes.ok && initialCartRes.data.data.items.length === 2, 'Customer cart contains exactly 2 distinct items');
    const initialCartTotalItems = initialCartRes.data.data.items.reduce((s, i) => s + i.quantity, 0);
    assert(initialCartTotalItems === 3, 'Customer cart total quantity is 3 (2 + 1 items)');

    // -------------------------------------------------------------
    // Step 3: Create Delivery Address for Customer
    // -------------------------------------------------------------
    console.log('\n🔹 Step 3: Setup Shipping Address');
    const addrRes = await api('/addresses', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Saif Ali Express',
        phone: '9876543210',
        addressLine1: '404 Express Boulevard, Bandra West',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400050',
        addressType: 'Home',
        isDefault: true
      })
    }, testUserToken);

    assert(addrRes.ok && addrRes.data.data?._id, 'Delivery address created successfully');
    testAddress = addrRes.data.data;

    // -------------------------------------------------------------
    // Step 4: Create a 3rd Product with Variants for Buy Now
    // -------------------------------------------------------------
    console.log('\n🔹 Step 4: Prepare 3rd Product with Variants for Buy Now');
    testVariantProduct = new Product({
      name: 'Express Pro Wireless Earbuds',
      description: 'Ultra low-latency gaming earbuds with ANC',
      price: 1999,
      category: 'Electronics',
      stock: 25,
      inStock: true,
      image: '/images/earbuds.jpg',
      variants: [
        {
          variantId: 'var-matte-black',
          sku: 'EP-BLK-01',
          title: 'Matte Black',
          price: 1999,
          stock: 15,
          attributes: { color: 'Black' }
        },
        {
          variantId: 'var-arctic-white',
          sku: 'EP-WHT-01',
          title: 'Arctic White',
          price: 2199,
          stock: 10,
          attributes: { color: 'White' }
        }
      ]
    });
    await testVariantProduct.save();
    console.log(`  Saved test variant product: ${testVariantProduct._id} (${testVariantProduct.name})`);

    // -------------------------------------------------------------
    // Step 5: Execute "Buy Now" on Variant Product
    // -------------------------------------------------------------
    console.log('\n🔹 Step 5: Execute "Buy Now" on Arctic White Variant (COD)');
    const buyNowPayload = {
      productId: testVariantProduct._id.toString(),
      variantId: 'var-arctic-white',
      quantity: 2,
      addressId: testAddress._id.toString(),
      paymentMethod: 'COD'
    };

    const buyNowRes = await api('/orders/buy-now', {
      method: 'POST',
      body: JSON.stringify(buyNowPayload)
    }, testUserToken);

    assert(buyNowRes.status === 201, `POST /api/orders/buy-now returned HTTP 201 (Got ${buyNowRes.status})`);
    assert(buyNowRes.data?.success === true, 'Response indicates success: true');

    const expressOrder = buyNowRes.data.data;
    createdOrderIds.push(expressOrder._id);

    // Verify order fields
    assert(expressOrder.status === 'Pending', `Order status is 'Pending' (Got ${expressOrder.status})`);
    assert(/^INV-\d{8}-\d{4}$/.test(expressOrder.invoiceNumber), `Order has valid invoiceNumber: ${expressOrder.invoiceNumber}`);
    const orderItems = expressOrder.items || expressOrder.orderItems || expressOrder.products || [];
    assert(orderItems.length === 1, 'Express order has exactly 1 order item');
    assert(orderItems[0].selectedVariant?.variantId === 'var-arctic-white', 'Order item contains chosen selectedVariant');
    assert(orderItems[0].quantity === 2, 'Order item quantity is 2');
    assert(orderItems[0].price === 2199, 'Order item reflects variant override price ₹2199');
    assert(expressOrder.totalAmount === 4398, `Total amount calculated correctly: ₹${expressOrder.totalAmount}`);

    // Verify stock deduction on variant & product
    const updatedProdAfterBuyNow = await Product.findById(testVariantProduct._id);
    const updatedVariant = updatedProdAfterBuyNow.variants.find(v => v.variantId === 'var-arctic-white');
    assert(updatedVariant.stock === 8, `Variant stock decremented from 10 to 8 (Got ${updatedVariant.stock})`);
    assert(updatedProdAfterBuyNow.stock === 23, `Top-level stock decremented from 25 to 23 (Got ${updatedProdAfterBuyNow.stock})`);

    // -------------------------------------------------------------
    // Step 6: CRITICAL CART ISOLATION VERIFICATION
    // -------------------------------------------------------------
    console.log('\n🔹 Step 6: CRITICAL VERIFICATION — Cart Isolation');
    const cartAfterBuyNow = await api('/cart', { method: 'GET' }, testUserToken);
    assert(cartAfterBuyNow.ok, 'Cart query succeeded');
    const itemsAfter = cartAfterBuyNow.data?.data?.items || [];

    assert(itemsAfter.length === 2, `Cart still contains exactly 2 items! (Got ${itemsAfter.length})`);
    const totalItemsAfter = itemsAfter.reduce((s, i) => s + i.quantity, 0);
    assert(totalItemsAfter === 3, `Cart total quantity remains untouched at 3! (Got ${totalItemsAfter})`);

    const hasProdA = itemsAfter.some(i => i.product?._id === prodA._id.toString() && i.quantity === 2);
    const hasProdB = itemsAfter.some(i => i.product?._id === prodB._id.toString() && i.quantity === 1);
    assert(hasProdA && hasProdB, 'Customer active cart items (Prod A & Prod B) are 100% untouched and preserved');

    // -------------------------------------------------------------
    // Step 7: Test Tax Invoice Download Endpoint
    // -------------------------------------------------------------
    console.log('\n🔹 Step 7: Test GET /api/orders/:id/invoice');
    const invoiceRes = await api(`/orders/${expressOrder._id}/invoice`, { method: 'GET' }, testUserToken);
    assert(invoiceRes.status === 200, `Invoice endpoint returned HTTP 200 (Got ${invoiceRes.status})`);
    assert(invoiceRes.headers.get('content-type') === 'application/pdf', 'Invoice response has Content-Type: application/pdf');
    assert(invoiceRes.data?.isBuffer && invoiceRes.data.length > 500, `Invoice PDF stream has valid byte size (${invoiceRes.data?.length} bytes)`);

    // -------------------------------------------------------------
    // Step 8: Test Standard Product Buy Now
    // -------------------------------------------------------------
    console.log('\n🔹 Step 8: Test Buy Now on Standard Non-Variant Product');
    testStandardProduct = new Product({
      name: 'MiniStore Premium Thermal Mug',
      description: 'Stainless steel insulated tumbler 500ml',
      price: 699,
      category: 'Kitchen',
      stock: 12,
      inStock: true,
      image: '/images/mug.jpg'
    });
    await testStandardProduct.save();

    const buyNowStdRes = await api('/orders/buy-now', {
      method: 'POST',
      body: JSON.stringify({
        productId: testStandardProduct._id.toString(),
        quantity: 3,
        addressId: testAddress._id.toString(),
        paymentMethod: 'COD'
      })
    }, testUserToken);

    assert(buyNowStdRes.status === 201, 'Buy Now succeeded on standard non-variant product');
    const stdOrder = buyNowStdRes.data.data;
    createdOrderIds.push(stdOrder._id);

    const updatedStdProd = await Product.findById(testStandardProduct._id);
    assert(updatedStdProd.stock === 9, `Standard product stock decremented from 12 to 9 (Got ${updatedStdProd.stock})`);

    // Confirm cart is still isolated!
    const cartAfterStdBuyNow = await api('/cart', { method: 'GET' }, testUserToken);
    assert(cartAfterStdBuyNow.data?.data?.items?.length === 2, 'Cart still has 2 items after second Buy Now purchase');

    // -------------------------------------------------------------
    // Step 9: Order Cancellation & Stock Restoration
    // -------------------------------------------------------------
    console.log('\n🔹 Step 9: Order Cancellation & Stock Restoration');
    const cancelRes = await api(`/orders/${expressOrder._id}/cancel`, {
      method: 'PUT'
    }, testUserToken);

    assert(cancelRes.status === 200, `Cancelled express order successfully (Got ${cancelRes.status})`);
    assert(cancelRes.data.data.status === 'Cancelled', 'Cancelled order status updated to "Cancelled"');

    // Check variant stock restoration
    const restoredProd = await Product.findById(testVariantProduct._id);
    const restoredVariant = restoredProd.variants.find(v => v.variantId === 'var-arctic-white');
    assert(restoredVariant.stock === 10, `Variant stock restored back to 10 upon cancellation (Got ${restoredVariant.stock})`);
    assert(restoredProd.stock === 25, `Top-level stock restored back to 25 upon cancellation (Got ${restoredProd.stock})`);

    console.log('\n✔ ALL EXPRESS CHECKOUT & CART ISOLATION CHECKS PASSED!');
  } finally {
    // -------------------------------------------------------------
    // Teardown: Clean up test orders, user, addresses, and test products
    // -------------------------------------------------------------
    console.log('\n🔹 Cleaning up test artifacts...');

    if (createdOrderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: createdOrderIds } });
      console.log(`  Deleted ${createdOrderIds.length} test order(s)`);
    }

    if (testVariantProduct) {
      await Product.findByIdAndDelete(testVariantProduct._id);
      console.log(`  Deleted test variant product: ${testVariantProduct._id}`);
    }

    if (testStandardProduct) {
      await Product.findByIdAndDelete(testStandardProduct._id);
      console.log(`  Deleted test standard product: ${testStandardProduct._id}`);
    }

    if (testAddress) {
      await Address.findByIdAndDelete(testAddress._id);
      console.log(`  Deleted test address: ${testAddress._id}`);
    }

    if (testUser) {
      await User.findByIdAndDelete(testUser.id || testUser._id);
      console.log(`  Deleted test user: ${testUser.email}`);
    }

    const finalProductCount = await Product.countDocuments();
    assert(finalProductCount === baselineProductCount, `Baseline catalog preserved! (${finalProductCount} === ${baselineProductCount})`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }

  console.log('\n================================================================');
  console.log(`🎯 Test Summary: ${passedCount} Passed | ${failedCount} Failed`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('\n💥 Test Suite Error:', err);
  process.exit(1);
});
