const fs = require('fs');
const d3 = require('d3-geo');

const raw = JSON.parse(fs.readFileSync('src/data/lk-districts.geo.json', 'utf8'));

function rewindRing(ring) {
  return ring.slice().reverse();
}

function rewindGeom(geom) {
  if (geom.type === 'Polygon') {
    return { ...geom, coordinates: geom.coordinates.map(rewindRing) };
  } else if (geom.type === 'MultiPolygon') {
    return { ...geom, coordinates: geom.coordinates.map(poly => poly.map(rewindRing)) };
  }
  return geom;
}

const correctedFeatures = raw.features.map(f => {
  const newGeom = rewindGeom(f.geometry);
  return {
    type: 'Feature',
    properties: f.properties,
    geometry: newGeom
  };
});

const output = {
  type: 'FeatureCollection',
  features: correctedFeatures
};

fs.writeFileSync('src/data/lk-districts.geo.json', JSON.stringify(output, null, 2), 'utf8');

const bounds = d3.geoBounds(output);
console.log('Successfully saved rewound lk-districts.geo.json!');
console.log('Sri Lanka Bounding Box:', bounds);

const projection = d3.geoMercator().fitSize([480, 720], output);
const pathGen = d3.geoPath().projection(projection);

output.features.forEach(f => {
  const [cx, cy] = pathGen.centroid(f);
  console.log(`${f.properties.name.padEnd(14)} Centroid: [${Math.round(cx)}, ${Math.round(cy)}]`);
});
