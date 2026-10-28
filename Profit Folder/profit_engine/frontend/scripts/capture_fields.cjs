const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const crops = ['Paddy', 'Tomato', 'Big Onion', 'Cabbage', 'Carrot', 'Maize'];
const outDir = 'C:\\Users\\MSI\\AppData\\Local\\Temp';

console.log('Starting capture for 6 crops:');

crops.forEach(crop => {
  const safeName = crop.replace(/\s+/g, '_');
  const outFile = path.join(outDir, `field_${safeName}.png`);
  const profileDir = path.join(outDir, `edge_prof_${safeName}`);
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
  const res = spawnSync(edgePath, args, { timeout: 15000, encoding: 'utf8' });
  if (fs.existsSync(outFile)) {
    console.log(`✓ ${crop}: ${(fs.statSync(outFile).size / 1024).toFixed(1)} KB`);
  } else {
    console.log(`✗ ${crop} failed`, res.stderr || res.stdout);
  }
});

console.log('Capture finished.');
