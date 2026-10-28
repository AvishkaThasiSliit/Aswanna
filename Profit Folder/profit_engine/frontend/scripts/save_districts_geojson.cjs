const fs = require('fs');

const srcPath = 'C:\\Users\\MSI\\.gemini\\antigravity-ide\\brain\\b4679f88-f9de-4c34-9b76-4d9bc2de8b58\\.system_generated\\steps\\1744\\content.md';
const raw = fs.readFileSync(srcPath, 'utf8');
const jsonStr = raw.slice(raw.indexOf('{'));
const geo = JSON.parse(jsonStr);

// Round coordinate precision to 4 decimal places to keep lightweight (~70KB)
function roundCoords(coords) {
  if (typeof coords[0] === 'number') {
    return [Math.round(coords[0] * 10000) / 10000, Math.round(coords[1] * 10000) / 10000];
  }
  return coords.map(roundCoords);
}

const cleanedFeatures = geo.features.map(f => {
  const rawName = f.properties.shapeName || '';
  const cleanName = rawName.replace(/\s+District$/i, '').trim();

  return {
    type: 'Feature',
    properties: {
      id: cleanName,
      name: cleanName,
      shapeName: rawName,
      shapeGroup: f.properties.shapeGroup || 'LKA',
      shapeType: f.properties.shapeType || 'ADM2'
    },
    geometry: {
      type: f.geometry.type,
      coordinates: roundCoords(f.geometry.coordinates)
    }
  };
});

const outputGeoJSON = {
  type: 'FeatureCollection',
  features: cleanedFeatures
};

const outPath = 'src/data/lk-districts.geo.json';
fs.writeFileSync(outPath, JSON.stringify(outputGeoJSON, null, 2), 'utf8');

console.log('Saved to', outPath);
console.log('Districts count:', cleanedFeatures.length);
console.log('File size KB:', Math.round(fs.statSync(outPath).size / 1024));
console.log('Names:', cleanedFeatures.map(f => f.properties.name));
