const assert = require('assert');

// 1. Test highlightMatch logic from app.js
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightMatch(text, query) {
  if (!text) return '';
  if (!query || !query.trim()) return escapeHtml(text);
  const safeText = escapeHtml(text);
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return safeText;
  const escapedTokens = tokens.map((t) => t.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&'));
  const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
  return safeText.replace(regex, '<span class="suggestion-highlight">$1</span>');
}

console.log('--- Testing Frontend Logic & Highlights ---');

// Test 1: Single letter highlight
const t1 = highlightMatch('Wireless Mouse', 's');
assert(t1.includes('<span class="suggestion-highlight">s</span>'), 'Should highlight "s"');
console.log('✅ highlightMatch single letter passed:', t1);

// Test 2: Multi-word highlight
const t2 = highlightMatch('Stainless Steel Shaker Bottle 750ml', 'stainless steel bottle');
assert(t2.includes('<span class="suggestion-highlight">Stainless</span>'), 'Should highlight Stainless');
assert(t2.includes('<span class="suggestion-highlight">Steel</span>'), 'Should highlight Steel');
assert(t2.includes('<span class="suggestion-highlight">Bottle</span>'), 'Should highlight Bottle');
console.log('✅ highlightMatch multi-word tokens passed:', t2);

// Test 3: XSS prevention
const t3 = highlightMatch('<script>alert("xss")</script>', 'alert');
assert(!t3.includes('<script>'), 'Must escape script tags');
assert(t3.includes('&lt;script&gt;'), 'Must encode HTML tags');
assert(t3.includes('<span class="suggestion-highlight">alert</span>'), 'Must highlight matching word safely');
console.log('✅ highlightMatch XSS safety passed:', t3);

// Test 4: Repeated spaces in query
const t4 = highlightMatch('Stainless Steel Chef Knife', 'stainless    knife');
assert(t4.includes('<span class="suggestion-highlight">Stainless</span>'), 'Should highlight Stainless');
assert(t4.includes('<span class="suggestion-highlight">Knife</span>'), 'Should highlight Knife');
console.log('✅ highlightMatch repeated spaces query passed:', t4);

// Test 5: Keyboard navigation index cycling
let activeIndex = -1;
const listLength = 4;

// ArrowDown
activeIndex = (activeIndex + 1) % listLength; // 0
assert.strictEqual(activeIndex, 0);
activeIndex = (activeIndex + 1) % listLength; // 1
assert.strictEqual(activeIndex, 1);
activeIndex = (activeIndex + 1) % listLength; // 2
assert.strictEqual(activeIndex, 2);
activeIndex = (activeIndex + 1) % listLength; // 3
assert.strictEqual(activeIndex, 3);
activeIndex = (activeIndex + 1) % listLength; // 0 (wrap around)
assert.strictEqual(activeIndex, 0);

// ArrowUp
if (activeIndex <= 0) activeIndex = listLength - 1; else activeIndex--;
assert.strictEqual(activeIndex, 3);
if (activeIndex <= 0) activeIndex = listLength - 1; else activeIndex--;
assert.strictEqual(activeIndex, 2);
console.log('✅ Keyboard navigation index cycling passed');

console.log('\nAll frontend simulation tests passed successfully!');
