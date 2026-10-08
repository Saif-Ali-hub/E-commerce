const http = require('http');
const fs = require('fs');

async function testFrontendServer() {
  console.log('--- TESTING FRONTEND SERVER AT http://localhost:5000 ---');

  // 1. Test GET /
  const html = await new Promise((resolve, reject) => {
    http.get('http://localhost:5000/', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✓ GET / responded with status ${res.statusCode} (${res.headers['content-type']})`);
        resolve(data);
      });
    }).on('error', reject);
  });

  // Verify critical elements in HTML response
  const expectedElements = [
    'id="top-announcement-bar"',
    'id="main-header"',
    'id="brand-logo"',
    'id="search-input"',
    'id="clear-search-btn"',
    'id="nav-orders-btn"',
    'id="nav-addresses-btn"',
    'id="nav-admin-btn"',
    'id="nav-login-btn"',
    'id="nav-user-info"',
    'id="nav-wishlist-btn"',
    'id="nav-cart-btn"',
    'id="theme-toggle-btn"',
    'id="hero-banner"',
    'id="hero-slider"',
    'id="hero-interactive-panel"',
    'id="products-section"',
    'id="category-select"',
    'id="product-count"',
    'id="refresh-btn"',
    'id="products-grid"',
    'id="product-modal"',
    'id="cart-modal"',
    'id="wishlist-modal"',
    'id="checkout-modal"',
    'id="orders-modal"',
    'id="address-modal"',
    'id="admin-modal"',
    'id="auth-modal"',
    'id="toast-notification"',
    'id="main-footer"'
  ];

  for (const el of expectedElements) {
    if (!html.includes(el)) {
      console.error(`❌ Missing element in served HTML: ${el}`);
      process.exit(1);
    }
  }
  console.log(`✓ All ${expectedElements.length} critical DOM components present in served HTML`);

  // 2. Test GET /styles.css
  await new Promise((resolve, reject) => {
    http.get('http://localhost:5000/styles.css', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✓ GET /styles.css responded with status ${res.statusCode} (${data.length} bytes)`);
        if (!data.includes('--color-primary: #2563eb')) {
          console.error('❌ styles.css missing expected primary color token');
          process.exit(1);
        }
        console.log('✓ Commercial design tokens verified in styles.css');
        resolve();
      });
    }).on('error', reject);
  });

  // 3. Test GET /app.js
  await new Promise((resolve, reject) => {
    http.get('http://localhost:5000/app.js', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✓ GET /app.js responded with status ${res.statusCode} (${data.length} bytes)`);
        resolve();
      });
    }).on('error', reject);
  });

  // 4. Test GET /api/products
  await new Promise((resolve, reject) => {
    http.get('http://localhost:5000/api/products', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        console.log(`✓ GET /api/products responded with status ${res.statusCode}, returned ${json.data.length} products`);
        resolve();
      });
    }).on('error', reject);
  });

  console.log('\n========================================');
  console.log('ALL FRONTEND SERVER CHECKS PASSED 100%!');
  console.log('========================================\n');
}

testFrontendServer().catch(err => {
  console.error('Server check failed:', err);
  process.exit(1);
});
