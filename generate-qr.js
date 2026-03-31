// generate-qr.js — WhatsApp pairing code (no QR needed!)
 
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
const PHONE = process.env.WHATSAPP_PHONE;
 
if (!PHONE) {
  console.error('ERROR: WHATSAPP_PHONE secret not set in GitHub Secrets.');
  process.exit(1);
}
 
if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true });
 
console.log('Connecting to WhatsApp...');
 
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
 
sock.ev.on('connection.update', async (update) => {
  const { connection } = update;
  if (connection === 'open') {
    console.log('');
    console.log('SUCCESS: WhatsApp connected!');
    process.exit(0);
  }
});
 
await new Promise(r => setTimeout(r, 3000));
 
if (!sock.authState.creds.registered) {
  const cleanPhone = PHONE.replace(/\D/g, '');
  try {
    const code = await sock.requestPairingCode(cleanPhone);
    const formatted = code.match(/.{1,4}/g).join('-');
    console.log('');
    console.log('==========================================');
    console.log('   YOUR WHATSAPP PAIRING CODE IS:');
    console.log('');
    console.log('   ' + formatted);
    console.log('');
    console.log('   HOW TO ENTER IT:');
    console.log('   1. Open WhatsApp on your phone');
    console.log('   2. Tap 3-dot menu -> Linked Devices');
    console.log('   3. Tap "Link with phone number"');
    console.log('   4. Enter your phone number');
    console.log('   5. Enter the code above');
    console.log('==========================================');
    console.log('');
    console.log('Waiting for you to enter the code (120 seconds)...');
  } catch (err) {
    console.error('ERROR getting pairing code:', err.message);
    process.exit(1);
  }
}
 
await new Promise(r => setTimeout(r, 120000));
process.exit(0);
 
