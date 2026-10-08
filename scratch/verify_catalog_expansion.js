const http = require('http');
const mongoose = require('../backend/node_modules/mongoose');
const dotenv = require('../backend/node_modules/dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
const Product = require('../backend/models/Product');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runVerification() {
  console.log('=== PRODUCT CATALOG EXPANSION VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mini_ecommerce');

    // 2. Direct DB verification
    const allDbProducts = await Product.find({}).lean();
    console.log(`Step 1: Total products in MongoDB: ${allDbProducts.length}`);
    assert(allDbProducts.length === 60, 'Total products is exactly 60 (10 original + 50 new)');

    // 3. Category count verification
    const expectedBreakdown = {
      Electronics: 13, // 3 + 10
      Kitchen: 12,     // 2 + 10
      Accessories: 12, // 2 + 10
      Home: 12,        // 2 + 10
      Sports: 11       // 1 + 10
    };

    const actualBreakdown = {};
    allDbProducts.forEach(p => {
      actualBreakdown[p.category] = (actualBreakdown[p.category] || 0) + 1;
    });

    console.log('Step 2: Category breakdown:');
    for (const [cat, expected] of Object.entries(expectedBreakdown)) {
      const actual = actualBreakdown[cat] || 0;
      assert(actual === expected, `Category "${cat}" has exactly ${expected} products (actual: ${actual})`);
    }

    // 4. Duplicate name and ID check
    const names = allDbProducts.map(p => p.name.trim().toLowerCase());
    const uniqueNames = new Set(names);
    assert(names.length === uniqueNames.size, `No duplicate product names (${uniqueNames.size} unique / ${names.length} total)`);

    const ids = allDbProducts.map(p => p._id.toString());
    const uniqueIds = new Set(ids);
    assert(ids.length === uniqueIds.size, `No duplicate product IDs (${uniqueIds.size} unique / ${ids.length} total)`);

    // 5. Schema field integrity
    let allValid = true;
    for (const p of allDbProducts) {
      if (!p.name || typeof p.price !== 'number' || p.price <= 0 || !p.category || !p.description || typeof p.stock !== 'number' || p.stock < 0 || !p.image) {
        allValid = false;
        console.error('Invalid product schema fields:', p);
        break;
      }
    }
    assert(allValid, 'All 60 products conform strictly to the Product schema with valid fields');

    // 6. Test GET /api/products via HTTP
    console.log('\nStep 3: Testing HTTP API GET http://localhost:5000/api/products...');
    const apiRes = await fetchJson('http://localhost:5000/api/products');
    assert(apiRes.status === 200, 'GET /api/products returned HTTP 200');
    assert(apiRes.body.success === true, 'GET /api/products returned success: true');
    assert(apiRes.body.count === 60, `GET /api/products returned count: 60 (actual: ${apiRes.body.count})`);
    assert(Array.isArray(apiRes.body.data) && apiRes.body.data.length === 60, 'GET /api/products data array length is 60');

    // 7. Verify category filtering logic on catalog
    console.log('\nStep 4: Testing category filtering capability...');
    const categoriesFound = Array.from(new Set(apiRes.body.data.map(p => p.category))).sort();
    assert(categoriesFound.length === 5, `5 categories available for frontend filter: ${categoriesFound.join(', ')}`);

    for (const cat of categoriesFound) {
      const filtered = apiRes.body.data.filter(p => p.category === cat);
      assert(filtered.length === expectedBreakdown[cat], `Filter for "${cat}" yields ${filtered.length} products`);
    }

    // 8. Verify specific newly added products are accessible by ID
    const sampleNew = allDbProducts.find(p => p.name === '4K USB-C Monitor');
    assert(Boolean(sampleNew), 'Sample new product "4K USB-C Monitor" found');
    if (sampleNew) {
      const sampleRes = await fetchJson(`http://localhost:5000/api/products/${sampleNew._id}`);
      assert(sampleRes.status === 200, 'GET /api/products/:id for new product returned 200');
      assert(sampleRes.body.data.price === 18499, 'Sample new product price matches ₹18499');
    }

    // 9. Verify original product data was untouched (e.g., Aromatherapy Diffuser reviews)
    const diffuser = allDbProducts.find(p => p.name === 'Aromatherapy Essential Oil Diffuser');
    assert(Boolean(diffuser), 'Original product "Aromatherapy Essential Oil Diffuser" exists');
    assert(diffuser.reviews && diffuser.reviews.length === 2, 'Original product reviews are completely preserved (2 reviews)');

    await mongoose.disconnect();

    console.log(`\n========================================`);
    console.log(`Tests Passed: ${passed}`);
    console.log(`Tests Failed: ${failed}`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Verification failed with error:', err);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  }
}

runVerification();
