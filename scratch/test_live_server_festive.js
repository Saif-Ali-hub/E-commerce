const assert = require('assert');

// 1. Test URL resolution in browser contexts
function resolveApiBaseUrl(mockLocation) {
  if (typeof mockLocation !== 'undefined') {
    const port = String(mockLocation.port || '');
    const protocol = mockLocation.protocol || '';
    if (port === '5000') {
      return `${mockLocation.origin}/api`;
    }
    if (protocol.startsWith('http') && !port && mockLocation.hostname !== 'localhost' && mockLocation.hostname !== '127.0.0.1') {
      return `${mockLocation.origin}/api`;
    }
  }
  return 'http://localhost:5000/api';
}

console.log('Testing URL resolution scenarios:');

// Live Server (VS Code / Antigravity)
assert.strictEqual(
  resolveApiBaseUrl({ origin: 'http://127.0.0.1:5500', port: '5500', protocol: 'http:', hostname: '127.0.0.1' }),
  'http://localhost:5000/api',
  'Failed Live Server 127.0.0.1:5500 test'
);
console.log('  ✅ PASS: Live Server (127.0.0.1:5500) routes to backend port 5000');

assert.strictEqual(
  resolveApiBaseUrl({ origin: 'http://localhost:5500', port: '5500', protocol: 'http:', hostname: 'localhost' }),
  'http://localhost:5000/api',
  'Failed Live Server localhost:5500 test'
);
console.log('  ✅ PASS: Live Server (localhost:5500) routes to backend port 5000');

// Backend direct serving
assert.strictEqual(
  resolveApiBaseUrl({ origin: 'http://localhost:5000', port: '5000', protocol: 'http:', hostname: 'localhost' }),
  'http://localhost:5000/api',
  'Failed backend direct serving test'
);
console.log('  ✅ PASS: Direct backend port 5000 uses current origin');

// Production domain
assert.strictEqual(
  resolveApiBaseUrl({ origin: 'https://ministore.com', port: '', protocol: 'https:', hostname: 'ministore.com' }),
  'https://ministore.com/api',
  'Failed production domain test'
);
console.log('  ✅ PASS: Production domain routes to same origin');

console.log('\nAll URL resolution tests passed!');
