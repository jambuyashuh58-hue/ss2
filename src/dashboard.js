// src/dashboard.js — CLI dashboard

import 'dotenv/config';
import { loadTracker } from './data.js';

const tracker = loadTracker();
const { processed, upsell_queue, stats } = tracker;

const entries = Object.entries(processed);
const today = new Date().toDateString();
const todayEntries = entries.filter(([, v]) => new Date(v.processed_at).toDateString() === today);
const sentToday = todayEntries.filter(([, v]) => v.status === 'sent').length;
const pendingUpsells = upsell_queue.filter(u => !u.sent).length;

console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║        WEBSITE AGENT DASHBOARD                       ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

console.log(`📊 ALL-TIME STATS`);
console.log(`   Total processed : ${stats.total}`);
console.log(`   Successfully sent: ${stats.sent}`);
console.log(`   Failed           : ${stats.failed}`);
console.log(`   Upsells pending  : ${pendingUpsells}\n`);

console.log(`📅 TODAY (${today})`);
console.log(`   Sent today       : ${sentToday}/50\n`);

console.log(`🌐 RECENT DEPLOYMENTS`);
const recent = entries
  .sort((a, b) => new Date(b[1].processed_at) - new Date(a[1].processed_at))
  .slice(0, 10);

if (recent.length === 0) {
  console.log('   No deployments yet.');
} else {
  recent.forEach(([phone, data]) => {
    const icon = data.status === 'sent' ? '✅' : data.status === 'failed' ? '❌' : '⚠️';
    const date = new Date(data.processed_at).toLocaleDateString('en-IN');
    console.log(`   ${icon} +${phone} | ${data.business_name} | ${date}`);
    if (data.site_url) console.log(`      🔗 ${data.site_url}`);
  });
}

console.log('\n📬 PENDING UPSELLS');
const pending = upsell_queue.filter(u => !u.sent);
if (pending.length === 0) {
  console.log('   No pending upsells.');
} else {
  pending.slice(0, 5).forEach(u => {
    const sendAt = new Date(u.sendAt).toLocaleString('en-IN');
    console.log(`   📤 +${u.phone} | ${u.businessName} | Send at: ${sendAt}`);
  });
}

console.log('\n');
