const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('================================================================');
console.log('🚀 Big Sky Rocket 3-Second Blast Engine Verification');
console.log('================================================================\n');

const code = fs.readFileSync(path.join(__dirname, '../frontend/firecrackers.js'), 'utf8');

// 1. Verify 3-Second Blast Cadence constant and timer
assert(code.includes('BLAST_INTERVAL_MS = 3000'), 'Missing 3000ms blasting interval');
console.log('  ✅ PASS: Verified continuous 3000ms (3-second) blasting interval');

// 2. Verify Big Sky Rocket Class & Physics
assert(code.includes('class SkyRocket'), 'Missing SkyRocket class definition');
assert(code.includes('Outer glow streak') || code.includes('lineWidth = 4.5') || code.includes('strokeStyle = this.theme.glow'), 'Missing radiant rocket jet plume');
assert(code.includes('generateGrandImperialPeony'), 'Missing Grand Imperial Peony detonation');
assert(code.includes('generateGoldenBrocadeCrown'), 'Missing Golden Brocade Crown weeping willow detonation');
assert(code.includes('generateDoubleRingChrysanthemum'), 'Missing Double Ring Chrysanthemum detonation');
assert(code.includes('generateCrackleGlitterShell'), 'Missing Crackle Glitter detonation');
assert(code.includes('generateRainbowStrobeCrown'), 'Missing Rainbow Strobe Crown detonation');
assert(code.includes('RadialStarburstExplosion'), 'Missing RadialStarburstExplosion class');
assert(code.includes('StarburstSpoke'), 'Missing StarburstSpoke class');
console.log('  ✅ PASS: All 5 massive radial starburst detonation styles verified');

// 4. Test in Mock Browser DOM Environment
const mockCanvas = {
  getContext: () => ({
    save: () => {},
    restore: () => {},
    clearRect: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    moveTo: () => {},
    lineTo: () => {},
    setTransform: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} })
  }),
  getBoundingClientRect: () => ({ width: 1200, height: 400, left: 0, top: 0 }),
  style: {},
  parentElement: {
    getBoundingClientRect: () => ({ width: 1200, height: 400 }),
    addEventListener: () => {}
  }
};

const sandbox = {
  window: {
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    devicePixelRatio: 2,
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: () => {}
  },
  document: {
    addEventListener: () => {},
    getElementById: (id) => (id === 'festive-firecrackers-canvas' ? mockCanvas : null)
  },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Math
};

sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

assert(typeof sandbox.window.initFestiveFirecrackers === 'function', 'initFestiveFirecrackers not exposed');
const stage = sandbox.window.initFestiveFirecrackers('festive-firecrackers-canvas');
assert(stage, 'Failed to instantiate FirecrackerStage');
assert.strictEqual(stage.BLAST_INTERVAL_MS, 3000, 'Stage interval is not 3000ms');

// Test launching big sky rocket
stage.launchBigSkyRocket();
assert(stage.rockets.length >= 1, 'Rocket was not launched into stage queue');
console.log('  ✅ PASS: Live simulation successfully launched soaring SkyRocket');

// Step simulation through detonation
let detonated = false;
let spokeCount = 0;
for (let frame = 0; frame < 120; frame++) {
  stage.loop();
  if (stage.explosions.length > 0) {
    detonated = true;
    spokeCount = stage.explosions[0].spokes.length;
    break;
  }
}

assert(detonated && spokeCount >= 50, 'Big Sky Rocket failed to explode into massive radial starburst');
console.log(`  ✅ PASS: SkyRocket detonated into ${spokeCount} dense radial starburst rays!`);

console.log('\n================================================================');
console.log('🌟 ALL BIG SKY ROCKET VERIFICATION CHECKS PASSED!');
console.log('================================================================');
process.exit(0);
