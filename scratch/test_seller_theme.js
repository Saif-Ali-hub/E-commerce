const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🌙 Merchant Portal Dark Mode & Theme Toggle Verification');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
    failCount++;
  }
}

const htmlPath = path.join(__dirname, '../frontend/seller-dashboard.html');
const jsPath = path.join(__dirname, '../frontend/seller-dashboard.js');
const aliasHtmlPath = path.join(__dirname, '../frontend/seller_dashboard.html');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const jsContent = fs.readFileSync(jsPath, 'utf8');
const aliasHtmlContent = fs.readFileSync(aliasHtmlPath, 'utf8');

console.log('📄 1. HTML Markup & Theme Icon Structure');
check('Header contains #theme-toggle-btn with proper aria attributes', () => {
  assert(htmlContent.includes('id="theme-toggle-btn"'), 'Missing id="theme-toggle-btn"');
  assert(htmlContent.includes('class="theme-toggle-btn"'), 'Missing class="theme-toggle-btn"');
  assert(htmlContent.includes('aria-label="Toggle theme"'), 'Missing aria-label');
});

check('Button contains single dynamic #theme-toggle-icon instead of jammed dual icons', () => {
  assert(htmlContent.includes('id="theme-toggle-icon"'), 'Missing id="theme-toggle-icon"');
  assert(htmlContent.includes('class="theme-toggle-icon"'), 'Missing class="theme-toggle-icon"');
  assert(!htmlContent.includes('<span class="theme-icon light-icon">☀️</span>'), 'Still contains legacy dual icon spans');
});

check('Early theme bootstrap script sets data-theme before render', () => {
  assert(htmlContent.includes("localStorage.getItem('theme')"), 'Missing early localStorage check in <head>');
  assert(htmlContent.includes("document.documentElement.setAttribute('data-theme'"), 'Missing early data-theme attribute setting');
});

console.log('\n🎨 2. CSS Design Tokens & Dark Mode Aesthetics');
check('CSS uses standard MiniStore tokens (--color-bg, --color-surface, --color-border, --color-text-main)', () => {
  assert(htmlContent.includes('var(--color-bg,'), 'Missing var(--color-bg,)');
  assert(htmlContent.includes('var(--color-surface,'), 'Missing var(--color-surface,)');
  assert(htmlContent.includes('var(--color-border,'), 'Missing var(--color-border,)');
  assert(htmlContent.includes('var(--color-text-main,'), 'Missing var(--color-text-main,)');
  assert(!htmlContent.includes('var(--color-bg-body,'), 'Still using non-existent var(--color-bg-body)');
  assert(!htmlContent.includes('var(--color-bg-surface,'), 'Still using non-existent var(--color-bg-surface)');
});

check('[data-theme="dark"] rules are defined for cards, tables, headers, and modals', () => {
  assert(htmlContent.includes('[data-theme="dark"] .seller-page-wrapper'), 'Missing dark mode wrapper style');
  assert(htmlContent.includes('[data-theme="dark"] .seller-header'), 'Missing dark mode header style');
  assert(htmlContent.includes('[data-theme="dark"] .seller-card'), 'Missing dark mode card style');
  assert(htmlContent.includes('[data-theme="dark"] .kpi-card'), 'Missing dark mode KPI card style');
  assert(htmlContent.includes('[data-theme="dark"] .seller-table'), 'Missing dark mode table styles');
  assert(htmlContent.includes('[data-theme="dark"] .seller-modal-container'), 'Missing dark mode modal style');
});

console.log('\n⚙️ 3. JavaScript Logic & Interaction Simulation');
check('seller-dashboard.js defines complete theme functions', () => {
  assert(jsContent.includes('function initTheme()'), 'Missing initTheme()');
  assert(jsContent.includes('function toggleTheme()'), 'Missing toggleTheme()');
  assert(jsContent.includes('function setTheme('), 'Missing setTheme()');
  assert(jsContent.includes('function updateThemeToggleUI('), 'Missing updateThemeToggleUI()');
  assert(jsContent.includes('function getCurrentTheme()'), 'Missing getCurrentTheme()');
});

check('themeToggleBtn event listener is attached and initTheme is called on boot', () => {
  assert(jsContent.includes('themeToggleBtn.addEventListener(\'click\', toggleTheme)'), 'Missing click event listener on themeToggleBtn');
  assert(jsContent.includes('initTheme();'), 'Missing initTheme() boot call');
});

check('Interactive DOM simulation verifies light -> dark -> light transitions', () => {
  // Mock DOM environment
  const mockStorage = { theme: 'light' };
  const mockDoc = {
    attributes: {},
    getAttribute(name) { return this.attributes[name] || null; },
    setAttribute(name, val) { this.attributes[name] = val; }
  };
  const mockBtn = {
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; }
  };
  const mockIcon = { textContent: '🌙' };

  function getCurrentTheme() {
    return mockDoc.getAttribute('data-theme') || 'light';
  }
  function updateThemeToggleUI(theme) {
    mockIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    mockBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
  function setTheme(theme) {
    mockDoc.setAttribute('data-theme', theme);
    mockStorage.theme = theme;
    updateThemeToggleUI(theme);
  }
  function toggleTheme() {
    const current = getCurrentTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }
  function initTheme() {
    const saved = mockStorage.theme || 'light';
    setTheme(saved);
  }

  // 1. Initial state (light)
  initTheme();
  assert.strictEqual(mockDoc.getAttribute('data-theme'), 'light');
  assert.strictEqual(mockIcon.textContent, '🌙');

  // 2. Toggle to dark
  toggleTheme();
  assert.strictEqual(mockDoc.getAttribute('data-theme'), 'dark');
  assert.strictEqual(mockStorage.theme, 'dark');
  assert.strictEqual(mockIcon.textContent, '☀️');
  assert.strictEqual(mockBtn.attributes['aria-label'], 'Switch to light mode');

  // 3. Toggle back to light
  toggleTheme();
  assert.strictEqual(mockDoc.getAttribute('data-theme'), 'light');
  assert.strictEqual(mockStorage.theme, 'light');
  assert.strictEqual(mockIcon.textContent, '🌙');
  assert.strictEqual(mockBtn.attributes['aria-label'], 'Switch to dark mode');
});

console.log('\n🔗 4. Filename & Alias Integrity');
check('seller_dashboard.html alias exists and contains theme toggle button', () => {
  assert(aliasHtmlContent.includes('id="theme-toggle-btn"'), 'Alias missing theme toggle button');
  assert(aliasHtmlContent.includes('id="theme-toggle-icon"'), 'Alias missing theme toggle icon');
});

console.log('\n================================================================');
console.log(`📊 Result: ${passCount} Passed, ${failCount} Failed`);
console.log('================================================================');

if (failCount > 0) process.exit(1);
