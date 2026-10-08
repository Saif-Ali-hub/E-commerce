const http = require('http');
const fs = require('fs');

console.log('--- TESTING FOOTER FUNCTIONALITY ---');

// 1. Verify HTML elements
const html = fs.readFileSync('frontend/index.html', 'utf8');

const requiredIds = [
  'order-tracking-modal',
  'order-tracking-close-btn',
  'order-tracking-form',
  'track-order-id-input',
  'track-order-submit-btn',
  'track-order-loading',
  'track-order-error',
  'track-order-unauth',
  'track-order-unauth-login-btn',
  'track-order-result',
  'track-view-all-orders-btn',
  'shipping-info-modal',
  'shipping-modal-close-btn',
  'shipping-modal-ok-btn',
  'returns-info-modal',
  'returns-modal-close-btn',
  'returns-modal-ok-btn',
  'privacy-policy-modal',
  'privacy-modal-close-btn',
  'privacy-modal-ok-btn',
  'terms-of-service-modal',
  'terms-modal-close-btn',
  'terms-modal-ok-btn',
  'security-info-modal',
  'security-modal-close-btn',
  'security-modal-ok-btn',
  'footer-order-tracking-btn',
  'footer-shipping-btn',
  'footer-returns-btn',
  'footer-reviews-btn',
  'footer-privacy-btn',
  'footer-terms-btn',
  'footer-security-btn'
];

let missingIds = [];
requiredIds.forEach(id => {
  if (!html.includes(`id="${id}"`)) {
    missingIds.push(id);
  }
});

if (missingIds.length > 0) {
  console.error('❌ Missing IDs in index.html:', missingIds);
  process.exit(1);
} else {
  console.log(`✓ All ${requiredIds.length} footer IDs verified in index.html`);
}

// 2. Verify Shop Categories links in HTML
const categoryLinks = [
  'Electronics &amp; Audio',
  'Watches &amp; Wearables',
  'Footwear &amp; Apparel',
  'Productivity &amp; Tech'
];

categoryLinks.forEach(cat => {
  if (html.includes(cat)) {
    console.log(`✓ Shop category link found: "${cat}"`);
  } else {
    console.error(`❌ Category link missing: "${cat}"`);
    process.exit(1);
  }
});

// 3. Verify CSS rules in styles.css
const css = fs.readFileSync('frontend/styles.css', 'utf8');
const requiredCssSelectors = [
  '.footer-links a',
  '.footer-link-btn',
  '.footer-bottom-btn',
  '.info-modal-container',
  '.tracking-modal-container',
  '.tracking-stepper',
  '.stepper-step',
  '.stepper-dot'
];

requiredCssSelectors.forEach(sel => {
  if (css.includes(sel)) {
    console.log(`✓ CSS selector verified: ${sel}`);
  } else {
    console.error(`❌ Missing CSS selector: ${sel}`);
    process.exit(1);
  }
});

// 4. Verify JavaScript logic in app.js
const appJs = fs.readFileSync('frontend/app.js', 'utf8');
const requiredJsSnippets = [
  'initFooterFunctionality()',
  'mapFooterCategoryToExisting',
  'footer-category-link',
  'footer-order-tracking-btn',
  'footer-shipping-btn',
  'footer-returns-btn',
  'footer-reviews-btn',
  'footer-privacy-btn',
  'footer-terms-btn',
  'footer-security-btn',
  'renderTrackingResult',
  'Escape'
];

requiredJsSnippets.forEach(snip => {
  if (appJs.includes(snip)) {
    console.log(`✓ JS implementation verified: "${snip}"`);
  } else {
    console.error(`❌ Missing JS snippet: "${snip}"`);
    process.exit(1);
  }
});

console.log('========================================');
console.log('FOOTER VERIFICATION PASSED 100%!');
console.log('========================================');
