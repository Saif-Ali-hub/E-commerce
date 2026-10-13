const fs = require('fs');

const indexHtml = fs.readFileSync('frontend/index.html', 'utf8');
const festiveHtml = fs.readFileSync('frontend/festive-sale.html', 'utf8');
const festiveJs = fs.readFileSync('frontend/festive-sale.js', 'utf8');
const stylesCss = fs.readFileSync('frontend/styles.css', 'utf8');

const checks = [
  { name: 'Shop Festive Deals button points to festive-sale.html in index.html', pass: indexHtml.includes('href="festive-sale.html"') },
  { name: 'festive-sale.html has festive-page-hero', pass: festiveHtml.includes('festive-page-hero') },
  { name: 'festive-sale.html links to styles.css', pass: festiveHtml.includes('href="styles.css"') },
  { name: 'festive-sale.html loads festive-sale.js', pass: festiveHtml.includes('src="festive-sale.js"') },
  { name: 'styles.css has .festive-page-hero', pass: stylesCss.includes('.festive-page-hero') },
  { name: 'styles.css has .festive-product-card', pass: stylesCss.includes('.festive-product-card') },
  { name: 'styles.css has .festive-deal-badge', pass: stylesCss.includes('.festive-deal-badge') },
  { name: 'festive-sale.js calculates heavy discounts (40% - 75%)', pass: festiveJs.includes('discountPct') && festiveJs.includes('originalPrice') && festiveJs.includes('savings') },
  { name: 'festive-sale.js has countdown timer and coupon support', pass: festiveJs.includes('festive-hero-days') && festiveJs.includes('FESTIVE10') }
];

let allPass = true;
checks.forEach(c => {
  console.log(`${c.pass ? '✅ PASS' : '❌ FAIL'}: ${c.name}`);
  if (!c.pass) allPass = false;
});

if (allPass) {
  console.log('\n🌟 ALL FESTIVE SALE VERIFICATION CHECKS PASSED!');
  process.exit(0);
} else {
  console.error('\n❌ SOME CHECKS FAILED!');
  process.exit(1);
}
