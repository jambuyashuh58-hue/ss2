// generate-qr.js — Generates a scannable QR code HTML file
 
import {
  default as makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
 
const SESSION_DIR = './sessions/whatsapp';
const logger = pino({ level: 'silent' });
 
if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true });
 
console.log('Starting WhatsApp QR generator...');
 
const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
const { version } = await fetchLatestBaileysVersion();
 
const sock = makeWASocket({
  version,
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, logger)
  },
  logger,
  printQRInTerminal: false,
  getMessage: async () => ({ conversation: '' })
});
 
sock.ev.on('creds.update', saveCreds);
 
let qrSaved = false;
 
sock.ev.on('connection.update', async (update) => {
  const { connection, qr } = update;
 
  if (qr && !qrSaved) {
    qrSaved = true;
    console.log('QR received — generating HTML file...');
 
    // Build HTML with QR using Google Charts API (no npm package needed)
    const encodedQR = encodeURIComponent(qr);
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>WhatsApp QR Code</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f0f2f5; }
    .card { background: white; border-radius: 16px; padding: 40px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 500px; }
    h1 { color: #128C7E; margin: 0 0 8px; font-size: 24px; }
    p { color: #666; margin: 0 0 24px; font-size: 14px; }
    img { width: 300px; height: 300px; border: 2px solid #eee; border-radius: 8px; }
    .steps { text-align: left; margin-top: 24px; background: #f0f2f5; border-radius: 8px; padding: 16px; }
    .step { display: flex; gap: 10px; margin-bottom: 8px; font-size: 14px; color: #444; }
    .num { background: #128C7E; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }
    .warn { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; margin-top: 16px; font-size: 13px; color: #856404; }
  </style>
</head>
<body>
  <div class="card">
    <h1>WhatsApp QR Code</h1>
    <p>Scan this with your phone to link WhatsApp</p>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedQR}" alt="WhatsApp QR Code"/>
    <div class="steps">
      <div class="step"><div class="num">1</div><span>Open WhatsApp on your phone</span></div>
      <div class="step"><div class="num">2</div><span>Tap Menu (3 dots) → Linked Devices</span></div>
      <div class="step"><div class="num">3</div><span>Tap "Link a Device"</span></div>
      <div class="step"><div class="num">4</div><span>Point camera at QR code above</span></div>
    </div>
    <div class="warn">⚠️ This QR expires in ~60 seconds. If expired, re-run the GitHub Action.</div>
  </div>
</body>
</html>`;
 
    writeFileSync('./qr-code.html', html);
    console.log('✅ qr-code.html saved — uploading as artifact...');
    console.log('Download the artifact, open qr-code.html in browser, scan the QR');
  }
 
  if (connection === 'open') {
    console.log('✅ WhatsApp connected successfully!');
    process.exit(0);
  }
});
 
// Wait up to 55 seconds for QR to be generated
await new Promise(r => setTimeout(r, 55000));
console.log('QR generation complete. Check the artifact.');
process.exit(0);
 
