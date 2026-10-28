const fs = require('fs');

const txt = fs.readFileSync('src/components/three/crops/registry.js', 'utf8');
const clean = txt
  .replace("import advisoryData from '../../../data/advisory_data.json';", "const advisoryData = JSON.parse(fs.readFileSync('src/data/advisory_data.json'));")
  .replace(/export const CROP_3D_REGISTRY =/, 'const CROP_3D_REGISTRY =')
  .replace(/export function validateCropRegistry/, 'function validateCropRegistry')
  .replace(/export function getCropConfig/, 'function getCropConfig');

eval(clean);
const res = validateCropRegistry();
console.log('Result:', JSON.stringify(res, null, 2));
