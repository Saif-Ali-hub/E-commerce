/**
 * ============================================================================
 * Mini Store Platform — Optional Product Variants Test Suite
 * File: scratch/test_product_variants.js
 *
 * Automated verification suite testing:
 * 1. Standard non-variant product: Cart addition, checkout, top-level stock decrement
 * 2. Variant product creation: Creating product with variants (e.g. Size M stock 5, Size L stock 0)
 * 3. Variant cart addition: Adding Size M snapshots variant metadata into cart
 * 4. Variant atomic stock decrement: Ordering Size M decrements variants.$.stock from 5 to 4
 * 5. Out-of-stock rejection: Ordering or cart-adding Size L (stock 0) is rejected
 * 6. Cart item uniqueness: Adding Size M and Size S of same product creates distinct line items
 * 7. Cancellation restoration: Cancelling an order restores variant stock back to 5
 * 8. Baseline preservation & self-cleaning teardown: 61 baseline products untouched
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

// Native fetch helper
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
    console.log(`  [PASS] ${testName} ${details ? `(${details})` : ''}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${testName} ${details ? `— ${details}` : ''}`);
    failedCount++;
  }
}

async function runTestSuite() {
  console.log('\n============================================================');
  console.log(' miniStore: Optional Product Variants Test Suite');
  console.log('============================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB for direct verification');

  const baselineProductsCount = await Product.countDocuments();
  console.log(`Initial Catalog Product Count: ${baselineProductsCount}`);
  assert(baselineProductsCount >= 61, 'Initial catalog has at least 61 products', `Count: ${baselineProductsCount}`);

  // Test identifiers
  const testSuffix = Date.now();
  const customerEmail = `variant_shopper_${testSuffix}@example.com`;
  const sellerEmail = `variant_seller_${testSuffix}@example.com`;
  const testPassword = 'Password123!';

  let customerToken = null;
  let customerUser = null;
  let sellerToken = null;
  let sellerUser = null;

  let standardProduct = null;
  let variantProduct = null;

  try {
    // ------------------------------------------------------------------------
    // SETUP: Register Customer & Verified Seller
    // ------------------------------------------------------------------------
    console.log('\n--- Setup: Register Users ---');

    const regCust = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Variant Shopper',
        email: customerEmail,
        password: testPassword
      })
    });
    assert(regCust.status === 201, 'Customer registered', `status: ${regCust.status}`);
    const custLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: customerEmail, password: testPassword })
    });
    customerToken = custLogin.data?.token;
    assert(Boolean(customerToken), 'Customer authenticated with JWT');
    customerUser = await User.findOne({ email: customerEmail });

    // Add delivery address to customer for checkout via API
    const addAddrRes = await api('/addresses', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Variant Shopper',
        phone: '9876543210',
        addressLine1: '404 Fashion Boulevard',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India',
        isDefault: true
      })
    }, customerToken);
    assert(addAddrRes.status === 201, 'Delivery address created for shopper', `status: ${addAddrRes.status}`);
    const addressId = addAddrRes.data?.data?._id;

    // Register merchant and set to verified
    const regSeller = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Variant Merchant',
        email: sellerEmail,
        password: testPassword,
        isSeller: true,
        phone: '9876543211',
        businessName: 'Vibe Wear Apparel',
        businessAddress: '123 Fashion Street',
        pan: 'ABCDE1234F'
      })
    });
    assert(regSeller.status === 201, 'Seller registered', `status: ${regSeller.status}`);

    const sellerLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: sellerEmail, password: testPassword })
    });
    sellerToken = sellerLogin.data?.token;
    assert(Boolean(sellerToken), 'Seller authenticated with JWT');

    sellerUser = await User.findOne({ email: sellerEmail });
    sellerUser.role = 'seller';
    if (!sellerUser.sellerDetails) sellerUser.sellerDetails = {};
    sellerUser.sellerDetails.verificationStatus = 'verified';
    await sellerUser.save();

    // ------------------------------------------------------------------------
    // TEST 1: Standard Non-Variant Product Workflow
    // ------------------------------------------------------------------------
    console.log('\n--- Test 1: Standard Non-Variant Product ---');

    standardProduct = await Product.create({
      name: `Classic Cotton Tee ${testSuffix}`,
      category: 'Fashion',
      price: 499,
      stock: 10,
      inStock: true,
      image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518',
      seller: sellerUser._id,
      sellerName: 'Vibe Wear Apparel'
    });
    assert(Boolean(standardProduct._id), 'Standard product created with stock 10', `ID: ${standardProduct._id}`);

    // Add standard product to cart
    const addStdCart = await api('/cart', {
      method: 'POST',
      body: JSON.stringify({
        productId: standardProduct._id.toString(),
        quantity: 2
      })
    }, customerToken);
    assert(addStdCart.status === 200, 'Add standard product to cart succeeds');
    assert(addStdCart.data?.data?.items?.length === 1, 'Cart has 1 line item');
    assert(addStdCart.data?.data?.items[0]?.selectedVariant === null, 'Cart item has no selectedVariant');

    // Checkout with COD
    const orderStd = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        addressId: addressId,
        paymentMethod: 'COD'
      })
    }, customerToken);
    assert(orderStd.status === 201, 'Order standard product created', `status: ${orderStd.status}`);

    const updatedStdProd = await Product.findById(standardProduct._id);
    assert(updatedStdProd.stock === 8, 'Standard product stock decremented from 10 to 8', `Current: ${updatedStdProd.stock}`);

    // ------------------------------------------------------------------------
    // TEST 2: Create Product with Optional Variants
    // ------------------------------------------------------------------------
    console.log('\n--- Test 2: Create Product with Optional Variants ---');

    const variantPayload = {
      name: `Pro Runner Sneakers ${testSuffix}`,
      category: 'Fashion',
      price: 1999, // Fallback base price
      stock: 15,   // Base stock
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
      variants: [
        {
          variantId: 'VAR-SIZE-M',
          sku: 'RUN-M-NAVY',
          title: 'Size M / Navy Blue',
          attributes: { size: 'M', color: 'Navy Blue' },
          price: 2199,
          stock: 5,
          image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff'
        },
        {
          variantId: 'VAR-SIZE-L',
          sku: 'RUN-L-NAVY',
          title: 'Size L / Navy Blue',
          attributes: { size: 'L', color: 'Navy Blue' },
          price: 2199,
          stock: 0, // Out of stock variant
          image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff'
        },
        {
          variantId: 'VAR-SIZE-S',
          sku: 'RUN-S-NAVY',
          title: 'Size S / Navy Blue',
          attributes: { size: 'S', color: 'Navy Blue' },
          price: 1999,
          stock: 10,
          image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff'
        }
      ]
    };

    const createVariantRes = await api('/seller/products', {
      method: 'POST',
      body: JSON.stringify(variantPayload)
    }, sellerToken);

    assert(createVariantRes.status === 201, 'Merchant listed product with variants', `status: ${createVariantRes.status}`);
    variantProduct = createVariantRes.data?.data;
    assert(variantProduct?.variants?.length === 3, 'Product has 3 variants defined');

    // ------------------------------------------------------------------------
    // TEST 3: Out-of-Stock Variant Rejection
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3: Out-of-Stock Variant (Size L, Stock 0) Rejection ---');

    const addOutOfStockRes = await api('/cart', {
      method: 'POST',
      body: JSON.stringify({
        productId: variantProduct._id,
        quantity: 1,
        variantId: 'VAR-SIZE-L'
      })
    }, customerToken);

    assert(addOutOfStockRes.status === 400, 'Adding out-of-stock variant is rejected (400)');
    assert(
      (addOutOfStockRes.data?.message || '').toLowerCase().includes('out of stock'),
      'Appropriate out-of-stock error message returned',
      addOutOfStockRes.data?.message
    );

    // ------------------------------------------------------------------------
    // TEST 4: Add In-Stock Variant (Size M) and Cart Line Item Uniqueness
    // ------------------------------------------------------------------------
    console.log('\n--- Test 4: Cart Uniqueness (Size M vs Size S) ---');

    // Add Size M
    const addSizeM = await api('/cart', {
      method: 'POST',
      body: JSON.stringify({
        productId: variantProduct._id,
        quantity: 1,
        variantId: 'VAR-SIZE-M'
      })
    }, customerToken);
    assert(addSizeM.status === 200, 'Size M added to cart');
    assert(addSizeM.data?.data?.items?.length === 1, 'Cart has 1 item (Size M)');
    const sizeMItem = addSizeM.data?.data?.items[0];
    assert(sizeMItem.selectedVariant?.variantId === 'VAR-SIZE-M', 'Size M variant metadata attached');
    assert(sizeMItem.unitPrice === 2199, 'Variant price override applied (₹2199 vs base ₹1999)');

    // Add Size S to the same cart
    const addSizeS = await api('/cart', {
      method: 'POST',
      body: JSON.stringify({
        productId: variantProduct._id,
        quantity: 2,
        variantId: 'VAR-SIZE-S'
      })
    }, customerToken);
    assert(addSizeS.status === 200, 'Size S added to cart');
    assert(
      addSizeS.data?.data?.items?.length === 2,
      'Distinct cart line items formed for Size M and Size S on the same product',
      `Item count: ${addSizeS.data?.data?.items?.length}`
    );

    // Verify both line items have their respective variant titles
    const items = addSizeS.data?.data?.items;
    const hasSizeM = items.some(i => i.selectedVariant?.variantId === 'VAR-SIZE-M' && i.quantity === 1);
    const hasSizeS = items.some(i => i.selectedVariant?.variantId === 'VAR-SIZE-S' && i.quantity === 2);
    assert(hasSizeM && hasSizeS, 'Both distinct variants preserved with correct quantities in cart');

    // ------------------------------------------------------------------------
    // TEST 5: Atomic Variant Stock Decrement on Order Placement
    // ------------------------------------------------------------------------
    console.log('\n--- Test 5: Atomic Variant Stock Decrement on Checkout ---');

    // Remove Size S to test single Size M checkout clearly
    await api(`/cart/${variantProduct._id}?variantId=VAR-SIZE-S`, {
      method: 'DELETE'
    }, customerToken);

    const cartBeforeOrder = await api('/cart', {}, customerToken);
    assert(cartBeforeOrder.data?.data?.items?.length === 1, 'Only Size M remains in cart');

    // Place order for Size M (qty 1)
    const orderVariantRes = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        addressId: addressId,
        paymentMethod: 'COD'
      })
    }, customerToken);

    assert(orderVariantRes.status === 201, 'Order for variant product placed successfully', `Status: ${orderVariantRes.status}`);
    const placedOrder = orderVariantRes.data?.data;
    assert(placedOrder?.items?.length === 1, 'Placed order has 1 item');
    assert(
      placedOrder?.items[0]?.selectedVariant?.variantId === 'VAR-SIZE-M',
      'Placed order item snapshots selectedVariant metadata',
      placedOrder?.items[0]?.selectedVariant?.title
    );

    // Check database directly: Size M stock should be decremented from 5 to 4
    const prodAfterOrder = await Product.findById(variantProduct._id);
    const varMAfter = prodAfterOrder.variants.find(v => v.variantId === 'VAR-SIZE-M');
    assert(varMAfter.stock === 4, 'Variant stock decremented from 5 to 4', `Current: ${varMAfter.stock}`);
    assert(prodAfterOrder.stock === 14, 'Total product stock decremented from 15 to 14', `Current: ${prodAfterOrder.stock}`);

    // ------------------------------------------------------------------------
    // TEST 6: Order Cancellation Restores Variant Stock
    // ------------------------------------------------------------------------
    console.log('\n--- Test 6: Order Cancellation Restores Variant Stock ---');

    const cancelRes = await api(`/orders/${placedOrder._id}/cancel`, {
      method: 'PUT'
    }, customerToken);

    assert(cancelRes.status === 200, 'Customer order cancelled successfully', `status: ${cancelRes.status}`);
    assert(cancelRes.data?.data?.status === 'Cancelled', 'Order status is Cancelled');

    // Verify stock restored to specific variant subdocument
    const prodAfterCancel = await Product.findById(variantProduct._id);
    const varMAfterCancel = prodAfterCancel.variants.find(v => v.variantId === 'VAR-SIZE-M');
    assert(varMAfterCancel.stock === 5, 'Variant stock restored from 4 back to 5', `Current: ${varMAfterCancel.stock}`);
    assert(prodAfterCancel.stock === 15, 'Total product stock restored from 14 back to 15', `Current: ${prodAfterCancel.stock}`);

    // ------------------------------------------------------------------------
    // TEST 7: Single Product Details API returns variants correctly
    // ------------------------------------------------------------------------
    console.log('\n--- Test 7: GET /api/products/:id includes variants array ---');

    const getProdRes = await api(`/products/${variantProduct._id}`);
    assert(getProdRes.status === 200, 'GET /api/products/:id succeeds');
    assert(Array.isArray(getProdRes.data?.data?.variants), 'Returned product includes variants array');
    assert(getProdRes.data?.data?.variants?.length === 3, 'All 3 variants returned to frontend');

  } catch (err) {
    console.error('Unexpected error during variant testing:', err);
    assert(false, 'Exception occurred during tests', err.message);
  } finally {
    // ------------------------------------------------------------------------
    // TEARDOWN: Clean up mock entities and verify baseline catalog
    // ------------------------------------------------------------------------
    console.log('\n--- Teardown: Self-Cleaning & Catalog Verification ---');

    if (customerUser?._id) {
      await Address.deleteMany({ user: customerUser._id });
      await Order.deleteMany({ user: customerUser._id });
      await User.findByIdAndDelete(customerUser._id);
    }
    if (sellerUser?._id) {
      await User.findByIdAndDelete(sellerUser._id);
    }
    if (standardProduct?._id) {
      await Product.findByIdAndDelete(standardProduct._id);
    }
    if (variantProduct?._id) {
      await Product.findByIdAndDelete(variantProduct._id);
    }

    const finalProductCount = await Product.countDocuments();
    console.log(`Final Catalog Product Count: ${finalProductCount}`);
    assert(finalProductCount === baselineProductsCount, 'Teardown preserved original catalog products count', `Baseline: ${baselineProductsCount}, Final: ${finalProductCount}`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

    console.log('\n============================================================');
    console.log(` RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('============================================================\n');

    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTestSuite();
