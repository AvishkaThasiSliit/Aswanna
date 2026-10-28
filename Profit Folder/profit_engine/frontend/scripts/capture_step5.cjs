const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function capture(url, outputPath, width = 1280, height = 1024, clickSelector = null) {
  const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const port = 9600 + Math.floor(Math.random() * 300);

  const proc = spawn(edge, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  const tabs = await getJson(`http://127.0.0.1:${port}/json`);
  const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
  const ws = new globalThis.WebSocket(pageTab.webSocketDebuggerUrl);

  let msgId = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) cb.reject(msg.error);
      else cb.resolve(msg.result);
    }
  };

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = msgId++;
    callbacks.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await new Promise(r => ws.onopen = r);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600
  });

  console.log(`Navigating to ${url}...`);
  await send('Page.navigate', { url });

  // Wait for vehicle scene to load
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 300));
    const evalRes = await send('Runtime.evaluate', {
      expression: 'Boolean(document.querySelector(".vehicle-viewport-container"))'
    });
    if (evalRes?.result?.value) break;
  }

  // Wait 3.5s for Sketchfab embed iframe or initial rendering
  await new Promise(r => setTimeout(r, 3500));

  if (clickSelector) {
    console.log(`Clicking selector ${clickSelector}...`);
    await send('Runtime.evaluate', {
      expression: `const el = document.querySelector('${clickSelector}'); if (el) el.click();`
    });
    await new Promise(r => setTimeout(r, 800));
  }

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outputPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Saved screenshot to ${outputPath}`);

  ws.close();
  proc.kill();
}

async function main() {
  const dir = 'C:\\Users\\MSI\\.gemini\\antigravity-ide\\brain\\b4679f88-f9de-4c34-9b76-4d9bc2de8b58\\screenshots';

  console.log("=== 1. Dimo Batta HT2 (3D Orbit View) ===");
  await capture('http://127.0.0.1:5173/?step=5&vehicle=dimo_batta_ht2', `${dir}\\step5_dimo_batta_3d.png`);

  console.log("=== 2. Dimo Batta HT2 (Blueprint Schematic View) ===");
  await capture('http://127.0.0.1:5173/?step=5&vehicle=dimo_batta_ht2', `${dir}\\step5_dimo_batta_blueprint.png`, 1280, 1024, '.view-toggle-btn');

  console.log("=== 3. Tuk Tuk (Bajaj RE 3D View) ===");
  await capture('http://127.0.0.1:5173/?step=5&vehicle=bajaj_re_petrol', `${dir}\\step5_tuktuk_3d.png`);

  console.log("=== 4. Motorbike (Bajaj CT100 3D View) ===");
  await capture('http://127.0.0.1:5173/?step=5&vehicle=bajaj_ct100', `${dir}\\step5_motorbike_3d.png`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
