import {
  default as makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { mkdirSync, existsSync } from 'fs';
 
const SESSION_DIR = './sessions/whatsapp';
const logger = pino({ level: 'silent' });
const PHONE = (process.env.WHATSAPP_PHONE || '').replace(/\D/g, '');
 
if (!PHONE) {
  console.error('ERROR: WHATSAPP_PHONE secret not set.');
  process.exit(1);
}
 
console.log(`Phone number: ${PHONE}`);
console.log(`Digits: ${PHONE.length}`);
 
if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true });
 
const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
const { version } = await fetchLatestBaileysVersion();
 
console.log(`Baileys version: ${version.join('.')}`);
console.log('Connecting...');
 
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
 
let connected = false;
 
sock.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect } = update;
  console.log('Connection status:', connection || 'updating...');
 
  if (connection === 'open') {
    connected = true;
    console.log('');
    console.log('SUCCESS: WhatsApp connected!');
    setTimeout(() => process.exit(0), 2000);
  }
 
  if (connection === 'close') {
    const code = lastDisconnect?.error?.output?.statusCode;
    console.log('Closed with code:', code);
  }
});
 
// Wait for socket to stabilize
console.log('Waiting 5 seconds for socket to stabilize...');
await new Promise(r => setTimeout(r, 5000));
 
if (!sock.authState.creds.registered && !connected) {
  console.log('Requesting pairing code for: ' + PHONE);
 
  try {
    const code = await sock.requestPairingCode(PHONE);
    const formatted = code.match(/.{1,4}/g)?.join('-') || code;
 
    console.log('');
    console.log('================================================');
    console.log('  PAIRING CODE: ' + formatted);
    console.log('================================================');
    console.log('');
    console.log('On your phone:');
    console.log('WhatsApp -> 3 dots -> Linked Devices');
    console.log('-> Link with phone number');
    console.log('-> Enter YOUR number: ' + PHONE);
    console.log('-> Then enter code: ' + formatted);
    console.log('');
    console.log('Waiting 90 seconds...');
  } catch (err) {
    console.error('');
    console.error('PAIRING CODE ERROR: ' + err.message);
    console.error('');
    console.error('This usually means WhatsApp rate-limited you.');
    console.error('Wait 10 minutes then re-run the workflow.');
    process.exit(1);
  }
}
 
await new Promise(r => setTimeout(r, 90000));
 
if (!connected) {
  console.log('Code was not entered in time. Re-run the workflow.');
}
 
process.exit(0);
 
