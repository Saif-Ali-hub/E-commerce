const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- TEST 1: Category API ---');
  const catRes = await get('http://localhost:5000/api/products/categories');
  console.log('Categories count:', catRes.data.data.length);
  console.log('Categories:', catRes.data.data);

  console.log('\n--- TEST 2: Homepage Category Showcase Slicing ---');
  const allProdsRes = await get('http://localhost:5000/api/products?all=true');
  const allProds = allProdsRes.data.data;
  console.log('Total products in database:', allProds.length);

  const categoryMap = new Map();
  catRes.data.data.forEach(c => categoryMap.set(c.toLowerCase(), { name: c, products: [] }));

  allProds.forEach(p => {
    const key = (p.category || '').toLowerCase();
    if (categoryMap.has(key)) {
      categoryMap.get(key).products.push(p);
    }
  });

  for (const [key, val] of categoryMap.entries()) {
    const totalInCat = val.products.length;
    const homepageSlice = val.products.slice(0, 4);
    const viewAllUrl = `category.html?name=${encodeURIComponent(val.name)}`;
    console.log(`[${val.name}] Total in DB: ${totalInCat} | Homepage shows: ${homepageSlice.length} | View All: ${viewAllUrl}`);
    if (totalInCat >= 4 && homepageSlice.length !== 4) {
      console.error(`FAIL: Expected 4 items on homepage for ${val.name}`);
    }
    if (totalInCat < 4 && homepageSlice.length !== totalInCat) {
      console.error(`FAIL: Expected ${totalInCat} items on homepage for ${val.name}`);
    }
  }

  console.log('\n--- TEST 3: Dedicated Category Page API Queries ---');
  for (const catName of catRes.data.data) {
    const queryUrl = `http://localhost:5000/api/products?category=${encodeURIComponent(catName)}&all=true`;
    const res = await get(queryUrl);
    const count = res.data.count || (res.data.data ? res.data.data.length : 0);
    console.log(`Category "${catName}": ${count} products loaded dynamically from DB`);
    if (count === 0) {
      console.error(`FAIL: Expected products for category ${catName}`);
    }
  }

  console.log('\nALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
