const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function runFacetedSearchTests() {
  console.log('=== STARTING FACETED SEARCH & MULTI-FILTER TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✓ PASS: ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ✗ FAIL: ${name}`);
        console.error(`    ${err.message}`);
        failed++;
      }
    })();
  }

  // 1. Baseline 61 catalog products
  await test('Baseline catalog returns all 61 products and correct global facets', async () => {
    const res = await fetch(`${BASE_URL}/products?all=true`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.total, 61);
    assert.strictEqual(data.data.length, 61);
    assert.ok(data.facets, 'Facets object must be returned');
    assert.strictEqual(data.facets.minPrice, 449);
    assert.strictEqual(data.facets.maxPrice, 85999);
    assert.strictEqual(data.facets.inStockCount, 61);
  });

  // 2. Category filtering and category-level facets
  await test('Category filter returns products within category and category facets', async () => {
    const res = await fetch(`${BASE_URL}/products?category=Electronics&all=true`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.total, 15);
    assert.strictEqual(data.data.length, 15);
    data.data.forEach(p => {
      assert.strictEqual(p.category.toLowerCase(), 'electronics');
    });
    assert.strictEqual(data.facets.minPrice, 999);
    assert.strictEqual(data.facets.maxPrice, 18499);
    assert.strictEqual(data.facets.inStockCount, 15);
  });

  // 3. Price range filtering: minPrice & maxPrice
  await test('Price range filter respects minPrice and maxPrice', async () => {
    const res = await fetch(`${BASE_URL}/products?category=Electronics&minPrice=1000&maxPrice=3000&all=true`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.total > 0, 'Should find products between 1000 and 3000');
    data.data.forEach(p => {
      assert.ok(p.price >= 1000, `Product price ${p.price} must be >= 1000`);
      assert.ok(p.price <= 3000, `Product price ${p.price} must be <= 3000`);
    });
    assert.ok(data.facets.minPrice >= 1000);
    assert.ok(data.facets.maxPrice <= 3000);
  });

  // 4. Rating filter: rating=4
  await test('Rating filter returns only products with rating >= 4', async () => {
    const res = await fetch(`${BASE_URL}/products?rating=4&all=true`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.total > 0, 'Should find products with rating >= 4');
    data.data.forEach(p => {
      const effectiveRating = p.averageRating !== undefined && p.averageRating > 0 ? p.averageRating : (p.ratings || 0);
      assert.ok(effectiveRating >= 4, `Product rating ${effectiveRating} must be >= 4`);
    });
  });

  // 5. InStock filter: inStock=true
  await test('inStock=true returns only available products with stock > 0 and inStock: true', async () => {
    const res = await fetch(`${BASE_URL}/products?inStock=true&all=true`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.total, 61);
    data.data.forEach(p => {
      assert.ok(p.stock > 0, `Product stock ${p.stock} must be > 0`);
      assert.strictEqual(p.inStock, true, 'Product inStock must be true');
    });
  });

  // 6. Sorting: price_asc
  await test('Sort price_asc sorts products from lowest to highest price', async () => {
    const res = await fetch(`${BASE_URL}/products?category=Electronics&sortBy=price_asc&all=true`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    for (let i = 1; i < data.data.length; i++) {
      assert.ok(data.data[i].price >= data.data[i - 1].price, `Price ${data.data[i].price} must be >= ${data.data[i-1].price}`);
    }
  });

  // 7. Sorting: price_desc
  await test('Sort price_desc sorts products from highest to lowest price', async () => {
    const res = await fetch(`${BASE_URL}/products?category=Electronics&sortBy=price_desc&all=true`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    for (let i = 1; i < data.data.length; i++) {
      assert.ok(data.data[i].price <= data.data[i - 1].price, `Price ${data.data[i].price} must be <= ${data.data[i-1].price}`);
    }
  });

  // 8. Sorting: rating_desc
  await test('Sort rating_desc sorts products by rating descending', async () => {
    const res = await fetch(`${BASE_URL}/products?sortBy=rating_desc&limit=10`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    for (let i = 1; i < data.data.length; i++) {
      const prev = data.data[i - 1].averageRating || 0;
      const curr = data.data[i].averageRating || 0;
      assert.ok(prev >= curr, `Rating ${prev} must be >= ${curr}`);
    }
  });

  // 9. Sorting: newest
  await test('Sort newest sorts products by createdAt descending', async () => {
    const res = await fetch(`${BASE_URL}/products?sortBy=newest&limit=5`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    for (let i = 1; i < data.data.length; i++) {
      const prev = new Date(data.data[i - 1].createdAt).getTime();
      const curr = new Date(data.data[i].createdAt).getTime();
      assert.ok(prev >= curr, `Date ${prev} must be >= ${curr}`);
    }
  });

  // 10. Multi-filter combination exact URL query sync test
  await test('Multi-filter combination (category + minPrice + maxPrice + rating + inStock + sortBy)', async () => {
    const query = 'category=Electronics&minPrice=500&maxPrice=3000&rating=4&inStock=true&sortBy=price_asc';
    const res = await fetch(`${BASE_URL}/products?${query}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.total !== undefined);
    assert.ok(data.facets !== undefined);
    assert.ok(Array.isArray(data.data));

    data.data.forEach(p => {
      assert.strictEqual(p.category.toLowerCase(), 'electronics');
      assert.ok(p.price >= 500 && p.price <= 3000);
      assert.ok((p.averageRating || p.ratings || 0) >= 4);
      assert.ok(p.stock > 0 && p.inStock === true);
    });

    for (let i = 1; i < data.data.length; i++) {
      assert.ok(data.data[i].price >= data.data[i - 1].price);
    }
  });

  // 11. Pagination with faceted filters
  await test('Server-side pagination works alongside faceted filters', async () => {
    const res1 = await fetch(`${BASE_URL}/products?category=Electronics&page=1&limit=5`);
    const data1 = await res1.json();
    assert.strictEqual(data1.success, true);
    assert.strictEqual(data1.data.length, 5);
    assert.strictEqual(data1.pagination.page, 1);
    assert.strictEqual(data1.pagination.limit, 5);
    assert.strictEqual(data1.pagination.totalProducts, 15);
    assert.strictEqual(data1.pagination.totalPages, 3);
    assert.strictEqual(data1.pagination.hasNextPage, true);

    const res2 = await fetch(`${BASE_URL}/products?category=Electronics&page=2&limit=5`);
    const data2 = await res2.json();
    assert.strictEqual(data2.success, true);
    assert.strictEqual(data2.data.length, 5);
    assert.strictEqual(data2.pagination.page, 2);
    // Ensure page 1 and page 2 products do not overlap
    const p1Ids = new Set(data1.data.map(p => p._id));
    data2.data.forEach(p => {
      assert.ok(!p1Ids.has(p._id), 'Page 2 product must not overlap with page 1');
    });
  });

  // 12. Non-matching filter returns clean empty set without throwing errors
  await test('Non-matching price range filter returns total 0 and facets gracefully', async () => {
    const res = await fetch(`${BASE_URL}/products?category=Electronics&minPrice=90000&maxPrice=100000`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.total, 0);
    assert.strictEqual(data.data.length, 0);
    assert.strictEqual(data.facets.inStockCount, 0);
  });

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runFacetedSearchTests().catch(err => {
  console.error('Test run error:', err);
  process.exit(1);
});
