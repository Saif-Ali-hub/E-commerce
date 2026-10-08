const fs = require('fs');
const js = fs.readFileSync('frontend/app.js', 'utf8');
const html = fs.readFileSync('frontend/index.html', 'utf8');

const idRegex = /getElementById\(['"]([^'"]+)['"]\)/g;
const ids = new Set();
let match;
while ((match = idRegex.exec(js)) !== null) {
  ids.add(match[1]);
}

console.log(`Found ${ids.size} getElementById calls in app.js:`);
const missing = [];
for (const id of ids) {
  if (!html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)) {
    missing.push(id);
  }
}

if (missing.length > 0) {
  console.log('WARNING: The following IDs are referenced in app.js but missing in index.html:', missing);
} else {
  console.log('ALL IDs referenced in app.js exist in index.html!');
}
