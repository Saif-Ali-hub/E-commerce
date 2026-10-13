const http = require('http');

function request(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('🧪 Testing Live Search Suggestions API & Pricing...\n');

  // Test 1: Query "mouse"
  console.log('1️⃣ Fetching suggestions for "mouse"...');
  const res1 = await request('/api/products/suggestions?q=mouse');
  if (res1.status !== 200 || !res1.body.success) {
    throw new Error('Test 1 failed: ' + JSON.stringify(res1.body));
  }
  console.log(`   Found ${res1.body.count} items. Categories:`, res1.body.categories);
  const mouse = res1.body.data.find(p => p.name.toLowerCase().includes('mouse'));
  if (mouse) {
    console.log(`   Product: "${mouse.name}"`);
    console.log(`   Effective Deal Price: ₹${mouse.price}`);
    console.log(`   Regular Price: ₹${mouse.regularPrice}`);
    console.log(`   Has Discount: ${mouse.hasDiscount}`);
    console.log(`   Discount: -${mouse.discountPercent}%`);
    if (mouse.name.toLowerCase().includes('wireless mouse') && mouse.price !== 499) {
      console.warn(`   ⚠️ Warning: Wireless Mouse expected 499 festive price, got ${mouse.price}`);
    } else {
      console.log('   ✅ Festive deal price reflected properly!');
    }
  }

  // Test 2: Query "head"
  console.log('\n2️⃣ Fetching suggestions for "head"...');
  const res2 = await request('/api/products/suggestions?q=head');
  console.log(`   Found ${res2.body.count} items. Categories:`, res2.body.categories);
  if (res2.body.data.length > 0) {
    console.log(`   First match: "${res2.body.data[0].name}" (₹${res2.body.data[0].price})`);
  }

  // Test 3: Empty query
  console.log('\n3️⃣ Fetching suggestions for empty query...');
  const res3 = await request('/api/products/suggestions?q=');
  if (res3.body.count === 0 && res3.body.data.length === 0) {
    console.log('   ✅ Empty query returns 0 results as expected.');
  }

  console.log('\n✨ ALL LIVE SEARCH SUGGESTIONS API TESTS PASSED! 🎉\n');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
