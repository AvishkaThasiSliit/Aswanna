const fs = require('fs');
const d3Geo = require('d3-geo');

const geojson = JSON.parse(fs.readFileSync('src/data/lk-districts.geo.json', 'utf8'));

const width = 500;
const height = 750;

const projection = d3Geo.geoMercator().fitSize([width, height], geojson);
const pathGenerator = d3Geo.geoPath().projection(projection);

console.log('Testing d3-geo projection:');
geojson.features.forEach(f => {
  const d = pathGenerator(f);
  const centroid = pathGenerator.centroid(f);
  console.log(`District: ${f.properties.name.padEnd(14)} path length: ${d ? d.length : 0} centroid: [${Math.round(centroid[0])}, ${Math.round(centroid[1])}]`);
});
