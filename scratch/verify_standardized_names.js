const http = require('http');
const mongoose = require('../backend/node_modules/mongoose');
const dotenv = require('../backend/node_modules/dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
const Product = require('../backend/models/Product');
const { renameMap } = require('../backend/scripts/standardizeProductNames');

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

async function verify() {
  console.log('=== PRODUCT NAME STANDARDIZATION VERIFICATION ===\n');
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
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mini_ecommerce');

    const products = await Product.find({}).lean();
    console.log(`1. Total products in database: ${products.length}`);
    assert(products.length === 60, 'Total products remains exactly 60');

    // 2. Category counts
    const categoryCounts = {};
    products.forEach(p => {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    });

    assert(categoryCounts['Electronics'] === 13, 'Electronics has 13 products');
    assert(categoryCounts['Kitchen'] === 12, 'Kitchen has 12 products');
    assert(categoryCounts['Accessories'] === 12, 'Accessories has 12 products');
    assert(categoryCounts['Home'] === 12, 'Home has 12 products');
    assert(categoryCounts['Sports'] === 11, 'Sports has 11 products');

    // 3. Duplicate check
    const names = products.map(p => p.name.trim());
    const uniqueNames = new Set(names);
    assert(uniqueNames.size === 60, `Zero duplicate names (${uniqueNames.size} unique / 60 total)`);

    // 4. Verify each expected standardized name exists in the database
    const expectedNames = Object.values(renameMap);
    let allExpectedExist = true;
    for (const exp of expectedNames) {
      if (!names.includes(exp)) {
        allExpectedExist = false;
        console.error(`Expected name missing from database: "${exp}"`);
      }
    }
    assert(allExpectedExist, 'All 60 expected standardized names exist in database');

    // 5. Verify no buzzwords (e.g., "Premium", "Pro", "Double-Walled", "High-Speed", "Full HD 1080p")
    const prohibitedPatterns = [
      /\bPremium\b/i,
      /\bPro\b/i,
      /\bDouble-Walled\b/i,
      /\bHigh-Speed\b/i,
      /\bFull HD 1080p\b/i,
      /\bUltra-Slim\b/i,
      /\bTrue Wireless Stereo\b/i
    ];
    let buzzwordFound = false;
    for (const name of names) {
      for (const pattern of prohibitedPatterns) {
        if (pattern.test(name)) {
          buzzwordFound = true;
          console.error(`Prohibited pattern ${pattern} found in: "${name}"`);
        }
      }
    }
    assert(!buzzwordFound, 'Zero unnecessary marketing or clumsy AI phrases found in any product name');

    // 6. Test HTTP API GET /api/products
    console.log('\n2. Testing HTTP API GET http://localhost:5000/api/products...');
    const apiRes = await fetchJson('http://localhost:5000/api/products');
    assert(apiRes.status === 200, 'GET /api/products returns HTTP 200');
    assert(apiRes.body.count === 60, `GET /api/products returns 60 products (actual: ${apiRes.body.count})`);

    // 7. Verify category filtering on API response
    console.log('\n3. Testing Category Filtering...');
    const categories = ['Electronics', 'Kitchen', 'Accessories', 'Home', 'Sports'];
    for (const cat of categories) {
      const filtered = apiRes.body.data.filter(p => p.category === cat);
      assert(filtered.length === categoryCounts[cat], `Filter for "${cat}" returns exact count (${filtered.length})`);
    }

    // 8. Test single product lookup by ID
    const sampleProduct = products[0];
    const singleRes = await fetchJson(`http://localhost:5000/api/products/${sampleProduct._id}`);
    assert(singleRes.status === 200, `GET /api/products/:id returned HTTP 200 for "${sampleProduct.name}"`);
    assert(singleRes.body.data.name === sampleProduct.name, 'Single product returned matches standardized name');

    await mongoose.disconnect();

    console.log(`\n========================================`);
    console.log(`Tests Passed: ${passed}`);
    console.log(`Tests Failed: ${failed}`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Verification failed:', err);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  }
}

verify();
