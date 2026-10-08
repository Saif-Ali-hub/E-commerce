const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const dotenv = require('dotenv');
const mongoose = require('../node_modules/mongoose');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
const Product = require('../models/Product');

const EXPECTED_CATEGORIES = ['Electronics', 'Kitchen', 'Accessories', 'Home', 'Sports'];

async function verifyUrl(url) {
  if (url.startsWith('/images/')) {
    const localPath = path.join(__dirname, '../../frontend', url);
    if (!fs.existsSync(localPath)) {
      return { ok: false, reason: `Local file does not exist: ${localPath}` };
    }
    const stat = fs.statSync(localPath);
    if (stat.size === 0) {
      return { ok: false, reason: `Local file is empty (0 bytes): ${localPath}` };
    }
    return { ok: true, type: 'local', size: stat.size };
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return new Promise((resolve) => {
      const client = url.startsWith('https://') ? https : http;
      const req = client.get(url, { headers: { 'User-Agent': 'CatalogAudit/1.0' } }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve({ ok: true, type: 'remote', status: res.statusCode });
        } else {
          resolve({ ok: false, reason: `HTTP status ${res.statusCode}` });
        }
      });
      req.on('error', (err) => resolve({ ok: false, reason: err.message }));
      req.setTimeout(8000, () => {
        req.destroy();
        resolve({ ok: false, reason: 'Request timeout (8s)' });
      });
    });
  }

  return { ok: false, reason: `Invalid URL format: ${url}` };
}

async function runAudit() {
  console.log('====================================================');
  console.log('       PRODUCT CATALOG QUALITY & AUDIT SUITE        ');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mini_ecommerce';
  await mongoose.connect(mongoUri);
  console.log(`Connected to MongoDB: ${mongoUri}\n`);

  const products = await Product.find({}).sort({ category: 1, name: 1 });
  console.log(`Auditing ${products.length} products...\n`);

  let errors = [];
  const nameCounts = {};
  const idCounts = {};
  const categoryCounts = {};

  for (const cat of EXPECTED_CATEGORIES) {
    categoryCounts[cat] = 0;
  }

  for (const prod of products) {
    const id = prod._id.toString();
    const name = prod.name;
    const cat = prod.category;
    const img = prod.image;
    const price = prod.price;
    const stock = prod.stock;
    const desc = prod.description;

    // Duplication checks
    nameCounts[name] = (nameCounts[name] || 0) + 1;
    idCounts[id] = (idCounts[id] || 0) + 1;

    // Category validation
    if (!EXPECTED_CATEGORIES.includes(cat)) {
      errors.push(`[${name}] Invalid category: "${cat}"`);
    } else {
      categoryCounts[cat]++;
    }

    // Required fields check
    if (!name || name.trim() === '') errors.push(`[${id}] Missing product name`);
    if (!desc || desc.trim() === '') errors.push(`[${name}] Missing product description`);
    if (typeof price !== 'number' || price <= 0) errors.push(`[${name}] Invalid price: ${price}`);
    if (typeof stock !== 'number' || stock < 0) errors.push(`[${name}] Invalid stock: ${stock}`);
    if (!img || img.trim() === '') errors.push(`[${name}] Missing image URL`);

    // Image URL verification
    if (img) {
      const urlCheck = await verifyUrl(img);
      if (!urlCheck.ok) {
        errors.push(`[${name}] Broken image URL (${urlCheck.reason}): ${img}`);
      }
    }
  }

  // Duplicate checks
  for (const [name, count] of Object.entries(nameCounts)) {
    if (count > 1) errors.push(`Duplicate product name detected: "${name}" (${count} occurrences)`);
  }
  for (const [id, count] of Object.entries(idCounts)) {
    if (count > 1) errors.push(`Duplicate product ID detected: "${id}" (${count} occurrences)`);
  }

  // Summary Report
  console.log('--- CATEGORY BREAKDOWN ---');
  for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`  ${cat.padEnd(15)}: ${count} products`);
  }
  console.log(`  ${'TOTAL'.padEnd(15)}: ${products.length} products\n`);

  console.log('--- AUDIT RESULTS ---');
  if (errors.length === 0) {
    console.log('✅ ALL CHECKS PASSED: 0 errors detected.');
    console.log('✅ Every product has a valid, reachable, non-broken image.');
    console.log('✅ Zero duplicate names, zero duplicate IDs.');
    console.log('✅ All categories and required fields valid.');
  } else {
    console.log(`❌ ${errors.length} ISSUE(S) DETECTED:`);
    errors.forEach((err, idx) => console.log(`  ${idx + 1}. ${err}`));
  }
  console.log('\n====================================================\n');

  await mongoose.disconnect();
  if (errors.length > 0) process.exit(1);
}

runAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
