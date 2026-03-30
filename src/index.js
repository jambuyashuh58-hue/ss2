// src/index.js — Main orchestrator
// Runs the full pipeline: read leads → generate sites → deploy → WhatsApp

import 'dotenv/config';
import cron from 'node-cron';

import { readLeads, loadTracker, getPendingLeads, markProcessed, addToUpsellQueue, getPendingUpsells, markUpsellSent } from './data.js';
import { generateWebsite } from './agent.js';
import { deployWebsite } from './deploy.js';
import { initWhatsApp, sendMessage, sendBatch, disconnectWhatsApp } from './whatsapp.js';
import { buildInitialMessage, buildUpsellMessage } from './messages.js';

const LEADS_CSV = process.env.LEADS_CSV_PATH || './data/leads.csv';
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '50');

const AGENCY = {
  name: process.env.AGENCY_NAME || 'WebSpark India',
  phone: process.env.AGENCY_PHONE || '+919XXXXXXXXX',
  website: process.env.AGENCY_WEBSITE || 'https://webspark.in'
};

// ─── Process a single lead ──────────────────────────────────────

async function processLead(lead, tracker) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`🏢 Processing: ${lead.business_name} (${lead.owner_name})`);
  console.log(`   📍 ${lead.location} | 📞 +${lead.phone}`);

  try {
    // 1. Generate website with Claude
    const html = await generateWebsite(lead, AGENCY);

    // 2. Deploy to Vercel
    const siteUrl = await deployWebsite(lead, html);

    // 3. Build WhatsApp message
    const message = buildInitialMessage(lead, siteUrl);

    // 4. Send WhatsApp
    const sent = await sendMessage(lead.phone, message);

    // 5. Track result
    markProcessed(tracker, lead.phone, {
      business_name: lead.business_name,
      owner_name: lead.owner_name,
      site_url: siteUrl,
      status: sent ? 'sent' : 'deployed_not_sent'
    });

    // 6. Queue upsell follow-up
    if (sent) addToUpsellQueue(tracker, lead.phone, siteUrl, lead.business_name);

    console.log(`  ✅ Done: ${siteUrl}`);
    return { success: true, siteUrl };

  } catch (err) {
    console.error(`  ❌ Failed: ${err.message}`);
    markProcessed(tracker, lead.phone, {
      business_name: lead.business_name,
      status: 'failed',
      error: err.message
    });
    return { success: false, error: err.message };
  }
}

// ─── Process pending upsell follow-ups ─────────────────────────

async function processUpsells(tracker) {
  const pending = getPendingUpsells(tracker);
  if (pending.length === 0) return;

  console.log(`\n📬 Sending ${pending.length} upsell follow-up(s)...`);

  for (const item of pending) {
    // We need the lead data for the upsell message
    // Stored in tracker.processed
    const processedData = tracker.processed[item.phone];
    if (!processedData) continue;

    const lead = { owner_name: processedData.owner_name || 'ji', business_name: item.businessName, phone: item.phone };
    const message = buildUpsellMessage(lead, item.siteUrl);

    await sendMessage(item.phone, message);
    markUpsellSent(tracker, item.phone);

    // Delay between upsells too
    await new Promise(r => setTimeout(r, 60000));
  }
}

// ─── Main pipeline run ──────────────────────────────────────────

async function runPipeline() {
  console.log('\n' + '═'.repeat(50));
  console.log('🚀 WEBSITE AGENT STARTING');
  console.log(`   ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
  console.log('═'.repeat(50));

  const tracker = loadTracker();
  const allLeads = await readLeads(LEADS_CSV);
  const pending = getPendingLeads(allLeads, tracker, DAILY_LIMIT);

  if (pending.length === 0) {
    console.log('\n✅ No pending leads to process today.');
  } else {
    console.log(`\n📋 Found ${pending.length} leads to process (daily limit: ${DAILY_LIMIT})`);

    // Connect WhatsApp once for the whole batch
    await initWhatsApp();

    let success = 0, failed = 0;
    const MESSAGE_DELAY = parseInt(process.env.MESSAGE_DELAY_SECONDS || '90') * 1000;

    for (let i = 0; i < pending.length; i++) {
      const lead = pending[i];
      const result = await processLead(lead, tracker);
      if (result.success) success++; else failed++;

      // Delay between leads (except after last)
      if (i < pending.length - 1) {
        const jitter = Math.floor(Math.random() * 20000);
        const wait = MESSAGE_DELAY + jitter;
        console.log(`\n⏱  Next lead in ${Math.round(wait / 1000)}s...`);
        await new Promise(r => setTimeout(r, wait));
      }
    }

    console.log('\n' + '═'.repeat(50));
    console.log(`📊 BATCH COMPLETE`);
    console.log(`   ✅ Success: ${success} | ❌ Failed: ${failed}`);
    console.log(`   📈 Total processed all-time: ${tracker.stats.total}`);
  }

  // Process upsells for previously sent leads
  await processUpsells(tracker);

  await disconnectWhatsApp();

  console.log('\n✅ Pipeline done. See ./data/tracker.json for full log.');
  console.log('═'.repeat(50) + '\n');
}

// ─── Schedule: Run daily at 10:00 AM IST ───────────────────────

const RUN_NOW = process.argv.includes('--now');

if (RUN_NOW) {
  // Immediate run (for testing or manual trigger)
  runPipeline().catch((err) => {
    console.error('💥 Fatal error:', err.message);
    process.exit(1);
  });
} else {
  // Scheduled mode: every day at 10:00 AM IST (UTC+5:30 = 04:30 UTC)
  console.log('⏰ Scheduler active. Will run daily at 10:00 AM IST.');
  console.log('   Run with --now flag to execute immediately.\n');

  cron.schedule('30 4 * * *', () => {
    runPipeline().catch((err) => {
      console.error('💥 Pipeline error:', err.message);
    });
  }, { timezone: 'Asia/Kolkata' });

  // Also process upsells every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    const tracker = loadTracker();
    await initWhatsApp();
    await processUpsells(tracker);
    await disconnectWhatsApp();
  }, { timezone: 'Asia/Kolkata' });
}
