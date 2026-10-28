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

async function capture(url, outputPath, width = 1280, height = 1024) {
  const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const port = 9400 + Math.floor(Math.random() * 500);

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
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log(`[BROWSER CONSOLE ${msg.params.type}]:`, msg.params.args.map(a => a.value || a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error(`[BROWSER EXCEPTION]:`, msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description);
    }
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

  // Wait for rendering
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 300));
    const evalRes = await send('Runtime.evaluate', {
      expression: 'Boolean(document.querySelector(".centres-carto-card") || document.querySelector(".centres-svg-map"))'
    });
    if (evalRes?.result?.value) {
      ready = true;
      console.log(`Found .centres-carto-card on attempt ${i + 1}`);
      break;
    }
  }

  // Extra pause for SVG animations to settle
  await new Promise(r => setTimeout(r, 800));

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outputPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Successfully saved screenshot to ${outputPath} (ready=${ready})`);

  ws.close();
  proc.kill();
}

async function main() {
  const dir = 'C:\\Users\\MSI\\.gemini\\antigravity-ide\\brain\\b4679f88-f9de-4c34-9b76-4d9bc2de8b58\\screenshots';

  console.log("=== Capturing Step 6: Badulla -> Keppetipola ===");
  await capture('http://127.0.0.1:5173/?step=6&crop=Tomato&district=Badulla', `${dir}\\step6_corridor_keppetipola.png`, 1280, 1024);

  console.log("=== Capturing Step 6: Badulla -> Dambulla ===");
  await capture('http://127.0.0.1:5173/?step=6&crop=Tomato&district=Badulla&centre=Dambulla+Dedicated+Economic+Centre', `${dir}\\step6_corridor_dambulla.png`, 1280, 1024);

  console.log("=== Capturing Step 6: Badulla -> Meegoda (Colombo) ===");
  await capture('http://127.0.0.1:5173/?step=6&crop=Tomato&district=Badulla&centre=Meegoda+Economic+Centre', `${dir}\\step6_corridor_meegoda.png`, 1280, 1024);

  console.log("=== Capturing Step 6: Mobile (390x844) ===");
  await capture('http://127.0.0.1:5173/?step=6&crop=Tomato&district=Badulla', `${dir}\\step6_mobile.png`, 390, 844);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
