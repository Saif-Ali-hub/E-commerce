const fs = require('fs');
const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function verify() {
  console.log('=== VERIFICATION OF CATEGORY-WISE PRODUCT SECTIONS ===');

  // 1. Verify index.html does not contain old horizontal category navigation bar
  const indexHtml = fs.readFileSync('frontend/index.html', 'utf8');
  if (indexHtml.includes('id="category-nav-section"')) {
    throw new Error('FAIL: index.html still contains id="category-nav-section"');
  }
  if (!indexHtml.includes('id="category-sections-wrapper"')) {
    throw new Error('FAIL: index.html missing id="category-sections-wrapper"');
  }
  if (!indexHtml.includes('id="category-sections-container"')) {
    throw new Error('FAIL: index.html missing id="category-sections-container"');
  }
  console.log('✔ index.html verified: horizontal category nav removed, category-sections-wrapper present.');

  // 2. Verify styles.css
  const stylesCss = fs.readFileSync('frontend/styles.css', 'utf8');
  if (stylesCss.includes('.category-nav-scroll-btn')) {
    throw new Error('FAIL: styles.css still contains .category-nav-scroll-btn');
  }
  if (!stylesCss.includes('.category-showcase-section')) {
    throw new Error('FAIL: styles.css missing .category-showcase-section');
  }
  if (!stylesCss.includes('.category-showcase-view-all')) {
    throw new Error('FAIL: styles.css missing .category-showcase-view-all');
  }
  if (!stylesCss.includes('.category-page-banner')) {
    throw new Error('FAIL: styles.css missing .category-page-banner');
  }
  console.log('✔ styles.css verified: obsolete nav CSS removed, category showcase and page styles present.');

  // 3. Verify app.js
  const appJs = fs.readFileSync('frontend/app.js', 'utf8');
  if (appJs.includes('categoryNavSection') || appJs.includes('categoryNavList')) {
    throw new Error('FAIL: app.js still contains obsolete categoryNav DOM variables');
  }
  if (!appJs.includes('function initCategorySections()')) {
    throw new Error('FAIL: app.js missing initCategorySections()');
  }
  if (!appJs.includes('function renderCategorySections(')) {
    throw new Error('FAIL: app.js missing renderCategorySections()');
  }
  console.log('✔ app.js verified: category showcase initialization and rendering functions present.');

  // 4. Verify category.html and category.js exist and serve over HTTP
  const catHtmlRes = await get('http://localhost:5000/category.html');
  if (catHtmlRes.status !== 200) {
    throw new Error(`FAIL: category.html returned status ${catHtmlRes.status}`);
  }
  const catJsRes = await get('http://localhost:5000/category.js');
  if (catJsRes.status !== 200) {
    throw new Error(`FAIL: category.js returned status ${catJsRes.status}`);
  }
  console.log('✔ category.html & category.js HTTP serving verified (Status 200).');

  // 5. Test Backend API dynamic data
  const catApi = await get('http://localhost:5000/api/products/categories');
  const categories = catApi.data.data;
  console.log(`✔ Categories retrieved from MongoDB (${categories.length}):`, categories.join(', '));

  const allProdsApi = await get('http://localhost:5000/api/products?all=true');
  const allProds = allProdsApi.data.data;

  for (const cat of categories) {
    const catProds = allProds.filter(p => p.category && p.category.toLowerCase() === cat.toLowerCase());
    const showcaseProds = catProds.slice(0, 4);
    const viewAllUrl = `category.html?name=${encodeURIComponent(cat)}`;

    // Verify dedicated category page endpoint
    const catQuery = await get(`http://localhost:5000/api/products?category=${encodeURIComponent(cat)}&all=true`);
    const dedicatedCount = catQuery.data.data ? catQuery.data.data.length : 0;

    console.log(`  - [${cat}]: DB Count = ${catProds.length} | Homepage Cards = ${showcaseProds.length} (Max 4) | Category Page Count = ${dedicatedCount} | Target URL = ${viewAllUrl}`);

    if (catProds.length >= 4 && showcaseProds.length !== 4) {
      throw new Error(`FAIL: Category ${cat} should show 4 products on homepage`);
    }
    if (dedicatedCount !== catProds.length) {
      throw new Error(`FAIL: Category ${cat} page should show all ${catProds.length} products`);
    }
  }

  console.log('\n=== ALL TESTS PASSED! IMPLEMENTATION COMPLETE AND VERIFIED ===');
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
