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
  const port = 9700 + Math.floor(Math.random() * 200);

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

  // Wait for canvas card to render
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 300));
    const evalRes = await send('Runtime.evaluate', {
      expression: 'Boolean(document.querySelector(".field-canvas-card"))'
    });
    if (evalRes?.result?.value) break;
  }

  // Allow 3D canvas / WebGL to render
  await new Promise(r => setTimeout(r, 2500));

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

  console.log("=== 1. Smallholder Plot (0.50 Acres, 3x3 Mounds) ===");
  await capture('http://127.0.0.1:5173/?step=4&crop=Tomato&acreage=0.5', `${dir}\\field_acreage_0_5.png`);

  console.log("=== 2. Standard Holding (1.00 Acre, 4x4 Mounds) ===");
  await capture('http://127.0.0.1:5173/?step=4&crop=Tomato&acreage=1.0', `${dir}\\field_acreage_1_0.png`);

  console.log("=== 3. Commercial Estate (5.00 Acres, 6x6 Mounds) ===");
  await capture('http://127.0.0.1:5173/?step=4&crop=Tomato&acreage=5.0', `${dir}\\field_acreage_5_0.png`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
