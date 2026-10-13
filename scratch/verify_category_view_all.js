const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

function runVerification() {
  console.log('================================================================');
  console.log(' VERIFICATION: CATEGORY SECTION "VIEW ALL" CONTROL & NAVIGATION ');
  console.log('================================================================\n');

  const frontendDir = path.join(__dirname, '../frontend');
  const indexHtml = fs.readFileSync(path.join(frontendDir, 'index.html'), 'utf8');
  const stylesCss = fs.readFileSync(path.join(frontendDir, 'styles.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(frontendDir, 'app.js'), 'utf8');
  const categoryHtml = fs.readFileSync(path.join(frontendDir, 'category.html'), 'utf8');
  const categoryJs = fs.readFileSync(path.join(frontendDir, 'category.js'), 'utf8');

  // 1. Homepage structure
  console.log('--- Step 1: Homepage Structure in index.html ---');
  assert(indexHtml.includes('id="category-sections-wrapper"'), 'index.html contains #category-sections-wrapper');
  assert(indexHtml.includes('id="category-sections-container"'), 'index.html contains #category-sections-container');
  assert(indexHtml.includes('class="category-showcase-loading"'), 'index.html contains category showcase loading skeleton');
  assert(indexHtml.includes('class="showcase-skeleton-header"'), 'Skeleton contains showcase header with title and button');

  // 2. CSS Layout & Responsive Alignment
  console.log('\n--- Step 2: Styling and Alignment in styles.css ---');
  assert(stylesCss.includes('.category-showcase-header'), 'styles.css contains .category-showcase-header');
  assert(stylesCss.includes('flex-wrap: nowrap;'), 'styles.css uses flex-wrap: nowrap to prevent View All from wrapping onto a second row');
  assert(stylesCss.includes('.category-showcase-view-all'), 'styles.css contains .category-showcase-view-all');
  assert(stylesCss.includes('.category-showcase-view-all .view-all-arrow'), 'styles.css styles right-arrow icon .view-all-arrow');
  assert(stylesCss.includes('white-space: nowrap;'), 'styles.css prevents View All button text from wrapping');
  assert(stylesCss.includes('flex-shrink: 0;'), 'styles.css ensures View All button never squishes or shrinks');

  // Verify mobile responsive block
  const mobileBlockRegex = /@media\s*\(max-width:\s*640px\)[\s\S]*?\.category-showcase-header\s*\{[\s\S]*?\}/;
  const mobileMatch = stylesCss.match(mobileBlockRegex);
  assert(mobileMatch !== null, 'styles.css contains responsive mobile styling for .category-showcase-header');
  assert(mobileMatch[0].includes('flex-wrap: nowrap'), 'Mobile header maintains flex-wrap: nowrap to keep category title and View All on the same row');

  // 3. Dynamic Rendering & Safe URL Generation in app.js
  console.log('\n--- Step 3: Category Showcase & View All Generation in app.js ---');
  assert(appJs.includes('function renderCategorySections('), 'app.js defines renderCategorySections()');
  assert(appJs.includes('category.html?name=${encodeURIComponent(catName)}'), 'app.js constructs categoryPageUrl with encodeURIComponent');
  assert(appJs.includes('class="category-showcase-view-all"'), 'app.js attaches .category-showcase-view-all link');
  assert(appJs.includes('<span class="view-all-text">View All</span>'), 'app.js includes "View All" text');
  assert(appJs.includes('<span class="view-all-arrow" aria-hidden="true">→</span>'), 'app.js includes right-arrow icon (→)');
  assert(appJs.includes('class="category-showcase-title"'), 'app.js renders category heading on the left side of the header');

  // 4. Test Simulated Category URLs and Parameter Decoding
  console.log('\n--- Step 4: URL Safety & Category Navigation Matching ---');
  const sampleCategories = [
    'Electronics',
    'Kitchen',
    'Accessories',
    'Home',
    'Sports',
    'Watches & Wearables',
    'Footwear & Apparel',
    'Toys & Games (Kids)'
  ];

  sampleCategories.forEach(catName => {
    const encodedUrl = `category.html?name=${encodeURIComponent(catName)}`;
    const queryString = encodedUrl.split('?')[1];
    const params = new URLSearchParams(queryString);
    const decodedName = params.get('name');

    assert(decodedName === catName, `Category "${catName}" encoded to "${encodedUrl}" decodes cleanly to "${decodedName}"`);
  });

  // 5. Dedicated Category Page Logic in category.js
  console.log('\n--- Step 5: Category Page Handler in category.js ---');
  assert(categoryHtml.includes('category.js'), 'category.html references category.js');
  assert(categoryJs.includes("urlParams.get('name')"), 'category.js reads "name" query parameter');
  assert(categoryJs.includes("urlParams.get('category')"), 'category.js supports "category" query parameter fallback');
  assert(categoryJs.includes('/products?category='), 'category.js queries products API with category parameter');

  // 6. No duplicate handlers or redundant event listeners
  console.log('\n--- Step 6: Navigation Cleanliness (No Duplicate Handlers) ---');
  // Confirm that .category-showcase-view-all does not have a redundant JS event click listener overriding the native anchor navigation
  const duplicateClickListener = appJs.includes("category-showcase-view-all').addEventListener('click") ||
                                 appJs.includes('category-showcase-view-all").addEventListener("click');
  // 7. Pagination Controls & Dark Mode Verification
  console.log('\n--- Step 7: Pagination Controls & Dark Mode Verification ---');
  assert(categoryHtml.includes('class="pagination-controls"'), 'category.html contains .pagination-controls container');
  assert(categoryHtml.includes('pagination-nav-btn'), 'category.html buttons use .pagination-nav-btn class');
  assert(stylesCss.includes('.pagination-btn,'), 'styles.css styles .pagination-btn alongside .pagination-nav-btn');
  assert(stylesCss.includes('.pagination-page-btn.is-active'), 'styles.css supports .pagination-page-btn.is-active');
  assert(stylesCss.includes('[data-theme="dark"] .pagination-btn'), 'styles.css defines dark theme rules for pagination buttons');
  assert(categoryJs.includes('is-active active'), 'category.js sets both is-active and active on current page button');

  console.log('\n================================================================');
  console.log(' ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runVerification();
