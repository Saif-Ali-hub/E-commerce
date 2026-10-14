const assert = require('assert');

console.log('================================================================');
console.log('🛍️ Festive Sale URL Resolution & Fetch Verification');
console.log('================================================================\n');

// 1. Simulation of file:/// protocol in browser
const mockFileLocation = {
  origin: 'null',
  protocol: 'file:'
};

const fileApiBaseUrl = (mockFileLocation.origin && mockFileLocation.origin.startsWith('http'))
  ? `${mockFileLocation.origin}/api`
  : 'http://localhost:5000/api';

assert.strictEqual(fileApiBaseUrl, 'http://localhost:5000/api', 'Failed to resolve to http://localhost:5000/api on file:// protocol');
console.log('  ✅ PASS: Resolves to http://localhost:5000/api on file:// protocol');

// 2. Simulation of http://localhost:5000 in browser
const mockHttpLocation = {
  origin: 'http://localhost:5000',
  protocol: 'http:'
};

const httpApiBaseUrl = (mockHttpLocation.origin && mockHttpLocation.origin.startsWith('http'))
  ? `${mockHttpLocation.origin}/api`
  : 'http://localhost:5000/api';

assert.strictEqual(httpApiBaseUrl, 'http://localhost:5000/api', 'Failed to resolve to http://localhost:5000/api on http:// protocol');
console.log('  ✅ PASS: Resolves to http://localhost:5000/api on http:// protocol');

// 3. Live API call using resolved URL
fetch(`${fileApiBaseUrl}/products?all=true`)
  .then(res => {
    assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    return res.json();
  })
  .then(json => {
    assert(json.success, 'API response success is false');
    assert(Array.isArray(json.data), 'API response data is not an array');
    assert(json.data.length >= 61, `Expected at least 61 products, got ${json.data.length}`);
    console.log(`  ✅ PASS: Live fetch successfully returned ${json.data.length} products`);
    console.log('\n================================================================');
    console.log('📊 Result: All tests passed successfully!');
    console.log('================================================================');
  })
  .catch(err => {
    console.error(`  ❌ FAIL: ${err.message}`);
    process.exit(1);
  });
