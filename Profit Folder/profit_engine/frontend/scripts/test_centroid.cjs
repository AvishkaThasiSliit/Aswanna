const fs = require('fs');
const d3Geo = require('d3-geo');

const geojson = JSON.parse(fs.readFileSync('src/data/lk-districts.geo.json', 'utf8'));
const projection = d3Geo.geoMercator().fitSize([500, 750], geojson);
const pathGen = d3Geo.geoPath().projection(projection);

geojson.features.slice(0, 5).forEach(f => {
  const c1 = pathGen.centroid(f);
  const geoCenter = d3Geo.geoCentroid(f);
  const c2 = projection(geoCenter);
  console.log(f.properties.name, 'pathGen centroid:', c1, 'proj(geoCentroid):', c2);
});
