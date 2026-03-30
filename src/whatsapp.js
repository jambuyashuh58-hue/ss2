// src/whatsapp.js — Baileys WhatsApp sender

import {
  default as makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { existsSync, mkdirSync } from 'fs';
import qrcode from 'qrcode-terminal';

const SESSION_DIR = './sessions/whatsapp';
const DELAY_MS = parseInt(process.env.MESSAGE_DELAY_SECONDS || '90') * 1000;

// Quiet logger (Baileys is very verbose by default)
const logger = pino({ level: 'silent' });

let sock = null;
let isConnected = false;
let reconnectAttempts = 0;

// ─── Initialize WhatsApp connection ────────────────────────────

export async function initWhatsApp() {
  if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  console.log('\n📱 Initializing WhatsApp...');

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    logger,
    printQRInTerminal: false, // We handle QR manually
    generateHighQualityLinkPreview: true,
    getMessage: async () => ({ conversation: '' })
  });

  sock.ev.on('creds.update', saveCreds);

  // Wait for connection
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WhatsApp connection timeout')), 90000);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n🔲 Scan this QR code with your WhatsApp:\n');
        qrcode.generate(qr, { small: true });
        console.log('\nWaiting for scan...\n');
      }

      if (connection === 'open') {
        isConnected = true;
        reconnectAttempts = 0;
        clearTimeout(timeout);
        console.log('✅ WhatsApp connected!\n');
        resolve();
      }

      if (connection === 'close') {
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        isConnected = false;

        if (code === DisconnectReason.loggedOut) {
          clearTimeout(timeout);
          reject(new Error('WhatsApp logged out. Delete ./sessions/whatsapp and re-run.'));
        } else if (reconnectAttempts < 3) {
          reconnectAttempts++;
          console.log(`⚠️  Disconnected. Reconnecting (${reconnectAttempts}/3)...`);
          setTimeout(() => initWhatsApp().then(resolve).catch(reject), 5000);
        } else {
          clearTimeout(timeout);
          reject(new Error('WhatsApp failed to connect after 3 attempts'));
        }
      }
    });
  });

  return sock;
}

// ─── Send a single WhatsApp message ────────────────────────────

export async function sendMessage(phone, text) {
  if (!sock || !isConnected) throw new Error('WhatsApp not connected. Call initWhatsApp() first.');

  // Normalize phone number to JID format
  const cleaned = phone.replace(/\D/g, '');
  const jid = cleaned.includes('@') ? cleaned : `${cleaned}@s.whatsapp.net`;

  try {
    await sock.sendMessage(jid, { text });
    console.log(`  📨 Message sent to +${cleaned}`);
    return true;
  } catch (err) {
    console.error(`  ❌ Failed to send to +${cleaned}: ${err.message}`);
    return false;
  }
}

// ─── Send batch of messages with delays (anti-ban) ──────────────

export async function sendBatch(messages) {
  // messages = [{ phone, text }, ...]
  const results = [];

  for (let i = 0; i < messages.length; i++) {
    const { phone, text } = messages[i];

    console.log(`\n📤 Sending ${i + 1}/${messages.length} to +${phone}...`);
    const ok = await sendMessage(phone, text);
    results.push({ phone, success: ok });

    // Delay between messages to avoid WhatsApp ban (except after last message)
    if (i < messages.length - 1) {
      const jitter = Math.floor(Math.random() * 30000); // +0-30s random jitter
      const wait = DELAY_MS + jitter;
      console.log(`  ⏱  Waiting ${Math.round(wait / 1000)}s before next message...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  return results;
}

// ─── Graceful disconnect ────────────────────────────────────────

export async function disconnectWhatsApp() {
  if (sock) {
    await sock.logout().catch(() => {});
    isConnected = false;
    console.log('WhatsApp disconnected.');
  }
}

// ─── CLI: Run standalone to test connection ─────────────────────

if (process.argv.includes('--init')) {
  import('dotenv').then(({ config }) => {
    config();
    initWhatsApp()
      .then(() => {
        console.log('✅ Session saved. You can now run the main agent.');
        process.exit(0);
      })
      .catch((err) => {
        console.error('❌', err.message);
        process.exit(1);
      });
  });
}
