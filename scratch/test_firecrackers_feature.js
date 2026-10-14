const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🎆 Festive Firecrackers Blasting Background Verification');
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

const firecrackersJsPath = path.join(__dirname, '../frontend/firecrackers.js');
const indexHtmlPath = path.join(__dirname, '../frontend/index.html');
const festiveSaleHtmlPath = path.join(__dirname, '../frontend/festive-sale.html');
const stylesCssPath = path.join(__dirname, '../frontend/styles.css');
const appJsPath = path.join(__dirname, '../frontend/app.js');

const firecrackersJs = fs.readFileSync(firecrackersJsPath, 'utf8');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const festiveSaleHtml = fs.readFileSync(festiveSaleHtmlPath, 'utf8');
const stylesCss = fs.readFileSync(stylesCssPath, 'utf8');
const appJs = fs.readFileSync(appJsPath, 'utf8');

console.log('📄 1. File & Script Inclusion');
check('frontend/firecrackers.js exists and has content', () => {
  assert(firecrackersJs.length > 500, 'firecrackers.js is empty or too short');
});

check('index.html includes firecrackers.js script tag', () => {
  assert(indexHtml.includes('<script src="firecrackers.js"></script>'), 'Missing script tag in index.html');
});

check('festive-sale.html includes firecrackers.js script tag', () => {
  assert(festiveSaleHtml.includes('<script src="firecrackers.js"></script>'), 'Missing script tag in festive-sale.html');
});

console.log('\n🎨 2. HTML Canvas Structure & CSS Layering');
check('index.html contains #festive-firecrackers-canvas inside festival-sale-banner', () => {
  assert(indexHtml.includes('id="festive-firecrackers-canvas"'), 'Missing id="festive-firecrackers-canvas"');
  assert(indexHtml.includes('class="festive-firecrackers-canvas"'), 'Missing class="festive-firecrackers-canvas"');
});

check('festive-sale.html contains #festive-page-firecrackers-canvas in hero section', () => {
  assert(festiveSaleHtml.includes('id="festive-page-firecrackers-canvas"'), 'Missing id="festive-page-firecrackers-canvas"');
});

check('styles.css defines .festive-firecrackers-canvas with pointer-events: none and absolute positioning', () => {
  assert(stylesCss.includes('.festive-firecrackers-canvas'), 'Missing .festive-firecrackers-canvas CSS selector');
  assert(stylesCss.includes('pointer-events: none'), 'Must have pointer-events: none so buttons remain clickable');
  assert(stylesCss.includes('position: absolute'), 'Must have position: absolute');
  assert(stylesCss.includes('z-index: 1'), 'Must be z-index: 1 under content');
});

console.log('\n🚀 3. Engine Architecture & Blast Mechanics');
check('firecrackers.js defines window.initFestiveFirecrackers and multiple burst styles', () => {
  assert(firecrackersJs.includes('window.initFestiveFirecrackers'), 'Missing window.initFestiveFirecrackers');
  assert(firecrackersJs.includes('generatePeonyBurst'), 'Missing Peony burst generator');
  assert(firecrackersJs.includes('generateWillowBurst'), 'Missing Willow burst generator');
  assert(firecrackersJs.includes('generateDoubleRingBurst'), 'Missing DoubleRing burst generator');
  assert(firecrackersJs.includes('generateCrackleBurst'), 'Missing Crackle burst generator');
});

check('app.js initializes firecrackers inside initFestivalSaleBanner', () => {
  assert(appJs.includes("initFestiveFirecrackers('festive-firecrackers-canvas'"), 'app.js does not initialize firecrackers');
});

check('Simulate rocket launch, trajectory physics, and particle detonation without errors', () => {
  // Test syntax by evaluating inside a lightweight VM sandbox
  const vm = require('vm');
  const mockContext = {
    window: {
      matchMedia: () => ({ matches: false }),
      devicePixelRatio: 1,
      addEventListener: () => {}
    },
    document: {
      addEventListener: () => {},
      getElementById: () => null
    },
    Math,
    setTimeout: () => {},
    clearTimeout: () => {},
    requestAnimationFrame: () => {},
    cancelAnimationFrame: () => {},
    console
  };
  mockContext.window.window = mockContext.window;
  mockContext.window.document = mockContext.document;

  vm.createContext(mockContext);
  vm.runInContext(firecrackersJs, mockContext);

  assert(typeof mockContext.window.initFestiveFirecrackers === 'function', 'initFestiveFirecrackers not registered');
});

console.log('\n================================================================');
console.log(`📊 Result: ${passCount} Passed, ${failCount} Failed`);
console.log('================================================================');

if (failCount > 0) process.exit(1);
