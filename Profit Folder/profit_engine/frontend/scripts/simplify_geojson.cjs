const fs = require('fs');

function sqDistance(p1, p2) {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return dx * dx + dy * dy;
}

function sqSegDistance(p, p1, p2) {
  let x = p1[0], y = p1[1], dx = p2[0] - x, dy = p2[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2[0];
      y = p2[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function simplifyDouglasPeucker(points, sqTolerance) {
  if (points.length <= 2) return points;
  let maxSqDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const sqDist = sqSegDistance(points[i], points[0], points[points.length - 1]);
    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }
  if (maxSqDist > sqTolerance) {
    const left = simplifyDouglasPeucker(points.slice(0, index + 1), sqTolerance);
    const right = simplifyDouglasPeucker(points.slice(index), sqTolerance);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [points[0], points[points.length - 1]];
  }
}

function simplifyCoords(coords, sqTol) {
  if (typeof coords[0][0] === 'number') {
    const sim = simplifyDouglasPeucker(coords, sqTol);
    return sim.length < 4 ? coords : sim;
  }
  return coords.map(c => simplifyCoords(c, sqTol));
}

const geo = JSON.parse(fs.readFileSync('src/data/lk-districts.geo.json', 'utf8'));
// tolerance ~ 0.003 degrees (~300m resolution, beautiful curves, very light ~80KB)
const sqTol = 0.0025 * 0.0025;

const simplifiedFeatures = geo.features.map(f => ({
  type: 'Feature',
  properties: f.properties,
  geometry: {
    type: f.geometry.type,
    coordinates: simplifyCoords(f.geometry.coordinates, sqTol)
  }
}));

const out = { type: 'FeatureCollection', features: simplifiedFeatures };
fs.writeFileSync('src/data/lk-districts.geo.json', JSON.stringify(out), 'utf8');
console.log('Simplified size KB:', Math.round(fs.statSync('src/data/lk-districts.geo.json').size / 1024));
