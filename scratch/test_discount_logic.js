const fs = require('fs');

// Read festive-sale.js content
const festiveJs = fs.readFileSync('frontend/festive-sale.js', 'utf8');

// Extract the festive deal logic into a sandbox environment
const sandbox = {};
const fnCode = festiveJs.slice(
  festiveJs.indexOf('const FESTIVE_DEALS_CATALOG'),
  festiveJs.indexOf('// ============================================================', festiveJs.indexOf('function enrichProductWithFestiveDeals'))
);

eval(`
${fnCode}
sandbox.FESTIVE_DEALS_CATALOG = FESTIVE_DEALS_CATALOG;
sandbox.getFestiveDealInfo = getFestiveDealInfo;
sandbox.enrichProductWithFestiveDeals = enrichProductWithFestiveDeals;
`);

console.log('=== TEST 1: Wireless Mouse Pricing Verification ===');
const wirelessMouse = {
  _id: '6ac35824d56ff6c6d5f2396d',
  name: 'Wireless Mouse',
  price: 999,
  stock: 140,
  category: 'Electronics'
};

const enrichedMouse = sandbox.enrichProductWithFestiveDeals(wirelessMouse);
console.log('Homepage Catalog Price:', wirelessMouse.price);
console.log('Festive Original Price:', enrichedMouse?.originalPrice);
console.log('Festive Deal Price:', enrichedMouse?.festivePrice);
console.log('Festive Discount Pct:', enrichedMouse?.discountPct + '%');
console.log('Festive Savings:', enrichedMouse?.savings);

if (!enrichedMouse) {
  console.error('❌ FAIL: Wireless Mouse should have festive deals!');
  process.exit(1);
}

if (enrichedMouse.originalPrice !== 999) {
  console.error('❌ FAIL: Original price must match homepage price (999), got:', enrichedMouse.originalPrice);
  process.exit(1);
}

if (enrichedMouse.festivePrice >= 999) {
  console.error('❌ FAIL: Festive deal price must be LOWER than homepage price (999), got:', enrichedMouse.festivePrice);
  process.exit(1);
}

if (enrichedMouse.festivePrice !== 499) {
  console.error('❌ FAIL: Expected festivePrice 499 for Wireless Mouse, got:', enrichedMouse.festivePrice);
  process.exit(1);
}

console.log('✅ PASS: Wireless Mouse correctly shows 999 original price and 499 discounted price (50% OFF)!');

console.log('\n=== TEST 2: Non-Discounted Product Verification ===');
const webcam = {
  _id: '6ac7410812a80b1cf9615b9e',
  name: '1080p Streaming Webcam',
  price: 1899,
  stock: 18,
  category: 'Electronics'
};

const enrichedWebcam = sandbox.enrichProductWithFestiveDeals(webcam);
if (enrichedWebcam !== null) {
  console.error('❌ FAIL: 1080p Streaming Webcam should NOT receive festive discount! Got:', enrichedWebcam);
  process.exit(1);
}
console.log('✅ PASS: 1080p Streaming Webcam is NOT discounted and excluded from festive sale!');

console.log('\n=== TEST 3: Catalog Coverage Across Categories ===');
const mockCatalog = [
  { name: 'Wireless Mouse', price: 999, category: 'Electronics', stock: 10 },
  { name: 'Mechanical Gaming Keyboard', price: 1299, category: 'Electronics', stock: 10 },
  { name: 'Gaming Laptop', price: 85999, category: 'Computers', stock: 10 },
  { name: '4K USB-C Monitor', price: 18499, category: 'Electronics', stock: 10 },
  { name: 'Canvas Laptop Backpack', price: 1499, category: 'Accessories', stock: 10 },
  { name: 'Leather Bi-Fold Wallet', price: 1199, category: 'Accessories', stock: 10 },
  { name: 'Minimalist LED Desk Lamp', price: 999, category: 'Home', stock: 10 },
  { name: 'Soy Wax Scented Candle', price: 599, category: 'Home', stock: 10 },
  { name: 'Electric Gooseneck Kettle', price: 2699, category: 'Kitchen', stock: 10 },
  { name: 'Bamboo Cutting Board', price: 899, category: 'Kitchen', stock: 10 },
  { name: 'Insulated Sports Bottle 1L', price: 799, category: 'Sports', stock: 10 },
  { name: 'Adjustable Speed Jump Rope', price: 449, category: 'Sports', stock: 10 }
];

const festiveList = mockCatalog.map(sandbox.enrichProductWithFestiveDeals).filter(p => p !== null);
console.log(`Total sample items: ${mockCatalog.length}, Festive discounted items: ${festiveList.length}`);

festiveList.forEach(p => {
  if (p.festivePrice >= p.originalPrice) {
    console.error(`❌ FAIL: Product ${p.name} festive price ${p.festivePrice} is not lower than ${p.originalPrice}`);
    process.exit(1);
  }
  console.log(`- ${p.name}: ~~₹${p.originalPrice}~~ -> ₹${p.festivePrice} (${p.discountPct}% OFF, Save ₹${p.savings})`);
});

if (festiveList.length === mockCatalog.length) {
  console.error('❌ FAIL: Not all products should be discounted!');
  process.exit(1);
}

console.log('\n🌟 ALL DISCOUNT LOGIC TESTS PASSED PERFECTLY!');
process.exit(0);
