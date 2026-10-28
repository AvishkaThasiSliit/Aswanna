const fs = require('fs');

const srcPath = 'C:\\Users\\MSI\\.gemini\\antigravity-ide\\brain\\b4679f88-f9de-4c34-9b76-4d9bc2de8b58\\.system_generated\\steps\\1744\\content.md';
const raw = fs.readFileSync(srcPath, 'utf8');
console.log('Read bytes:', raw.length);
console.log('First 200 chars:', raw.slice(0, 200));

// Strip markdown wrapper if present
const jsonStart = raw.indexOf('{');
if (jsonStart !== -1) {
  const jsonStr = raw.slice(jsonStart);
  try {
    const geo = JSON.parse(jsonStr);
    console.log('GeoJSON features count:', geo.features.length);
    const names = geo.features.map(f => f.properties.shapeName || f.properties.shapeGroup || f.properties);
    console.log('District names in geojson:', names);
  } catch (e) {
    console.error('JSON parse err:', e.message);
  }
}
