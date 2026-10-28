const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\MSI\\AppData\\Local\\Temp';
const destDir = 'C:\\Users\\MSI\\.gemini\\antigravity-ide\\brain\\b4679f88-f9de-4c34-9b76-4d9bc2de8b58\\screenshots';

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = [
  'step2_desktop.png',
  'step2_mobile_tall.png',
  'field_Paddy.png',
  'field_Tomato.png',
  'field_Big_Onion.png',
  'field_Cabbage.png',
  'field_Carrot.png',
  'field_Maize.png',
  'vehicle_dimo_batta.png',
  'vehicle_bolero.png',
  'vehicle_tuktuk.png',
  'vehicle_motorbike.png',
  'vehicle_shared_lorry.png',
  'vehicle_suzuki_carry.png',
  'vehicle_tank_closeup.png',
  'vehicle_cargo_closeup.png',
  'results_sales_channel.png'
];

files.forEach(f => {
  const src = path.join(srcDir, f);
  const dest = path.join(destDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${f} (${(fs.statSync(dest).size / 1024).toFixed(1)} KB)`);
  } else {
    console.log(`Missing ${f}`);
  }
});
