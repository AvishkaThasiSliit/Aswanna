const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outDir = 'C:\\Users\\MSI\\AppData\\Local\\Temp';

const runs = [
  { id: 'dimo_batta_ht2', focus: 'default', filename: 'vehicle_dimo_batta.png' },
  { id: 'mahindra_bolero', focus: 'default', filename: 'vehicle_bolero.png' },
  { id: 'bajaj_re_petrol', focus: 'default', filename: 'vehicle_tuktuk.png' },
  { id: 'bajaj_ct100', focus: 'default', filename: 'vehicle_motorbike.png' },
  { id: 'shared_lorry', focus: 'default', filename: 'vehicle_shared_lorry.png' },
  { id: 'suzuki_carry', focus: 'default', filename: 'vehicle_suzuki_carry.png' },
  { id: 'dimo_batta_ht2', focus: 'tank', filename: 'vehicle_tank_closeup.png' },
  { id: 'dimo_batta_ht2', focus: 'storage', filename: 'vehicle_cargo_closeup.png' }
];

console.log('Capturing vehicles & hotspots:');

runs.forEach(r => {
  const outFile = path.join(outDir, r.filename);
  const profileDir = path.join(outDir, `edge_v_${r.filename.replace('.png', '')}`);
  const url = `http://127.0.0.1:5173/?step=5&vehicle=${r.id}&focus=${r.focus}`;

  const args = [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--virtual-time-budget=3500',
    `--user-data-dir=${profileDir}`,
    '--window-size=1280,850',
    `--screenshot=${outFile}`,
    url
  ];

  console.log(`Capturing ${r.filename}...`);
  spawnSync(edgePath, args, { timeout: 20000, encoding: 'utf8' });
  if (fs.existsSync(outFile)) {
    console.log(`✓ ${r.filename}: ${(fs.statSync(outFile).size / 1024).toFixed(1)} KB`);
  } else {
    console.log(`✗ ${r.filename} failed`);
  }
});

console.log('Vehicles capture completed.');
