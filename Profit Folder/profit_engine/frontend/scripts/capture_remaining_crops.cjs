const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const crops = ['Tomato', 'Cabbage', 'Maize'];
const outDir = 'C:\\Users\\MSI\\AppData\\Local\\Temp';

crops.forEach(crop => {
  const safeName = crop.replace(/\s+/g, '_');
  const outFile = path.join(outDir, `field_${safeName}.png`);
  const profileDir = path.join(outDir, `edge_prof_${safeName}_v2`);
  const url = `http://127.0.0.1:5173/?step=4&crop=${encodeURIComponent(crop)}`;

  const args = [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--virtual-time-budget=4000',
    `--user-data-dir=${profileDir}`,
    '--window-size=1280,850',
    `--screenshot=${outFile}`,
    url
  ];

  console.log(`Capturing ${crop}...`);
  spawnSync(edgePath, args, { timeout: 25000, encoding: 'utf8' });
  if (fs.existsSync(outFile)) {
    console.log(`✓ ${crop}: ${(fs.statSync(outFile).size / 1024).toFixed(1)} KB`);
  } else {
    console.log(`✗ ${crop} failed`);
  }
});
