// src/data.js — Lead reader & progress tracker

import { createReadStream, existsSync, readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse';
import path from 'path';

const TRACKER_PATH = process.env.TRACKER_JSON_PATH || './data/tracker.json';

// ─── Tracker: persists state between runs ───────────────────────

export function loadTracker() {
  if (!existsSync(TRACKER_PATH)) {
    const empty = { processed: {}, upsell_queue: [], stats: { total: 0, sent: 0, failed: 0 } };
    writeFileSync(TRACKER_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(readFileSync(TRACKER_PATH, 'utf-8'));
}

export function saveTracker(tracker) {
  writeFileSync(TRACKER_PATH, JSON.stringify(tracker, null, 2));
}

export function markProcessed(tracker, phone, data) {
  tracker.processed[phone] = {
    ...data,
    processed_at: new Date().toISOString(),
    status: data.status || 'sent'
  };
  tracker.stats.total++;
  if (data.status === 'sent') tracker.stats.sent++;
  if (data.status === 'failed') tracker.stats.failed++;
  saveTracker(tracker);
}

export function addToUpsellQueue(tracker, phone, siteUrl, businessName) {
  const sendAt = new Date(Date.now() + (parseInt(process.env.UPSELL_DELAY_HOURS || 24) * 3600 * 1000));
  tracker.upsell_queue.push({ phone, siteUrl, businessName, sendAt: sendAt.toISOString(), sent: false });
  saveTracker(tracker);
}

export function getPendingUpsells(tracker) {
  const now = new Date();
  return tracker.upsell_queue.filter(u => !u.sent && new Date(u.sendAt) <= now);
}

export function markUpsellSent(tracker, phone) {
  const item = tracker.upsell_queue.find(u => u.phone === phone && !u.sent);
  if (item) item.sent = true;
  saveTracker(tracker);
}

// ─── CSV Reader ─────────────────────────────────────────────────

export async function readLeads(csvPath) {
  return new Promise((resolve, reject) => {
    const leads = [];
    createReadStream(csvPath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on('data', (row) => leads.push(row))
      .on('end', () => resolve(leads))
      .on('error', reject);
  });
}

// ─── Filter leads not yet processed ────────────────────────────

export function getPendingLeads(allLeads, tracker, dailyLimit) {
  const alreadyDone = new Set(Object.keys(tracker.processed));

  // Count how many sent TODAY
  const today = new Date().toDateString();
  const sentToday = Object.values(tracker.processed).filter(
    (p) => new Date(p.processed_at).toDateString() === today && p.status === 'sent'
  ).length;

  const remaining = dailyLimit - sentToday;
  if (remaining <= 0) {
    console.log(`✅ Daily limit of ${dailyLimit} already reached today.`);
    return [];
  }

  return allLeads
    .filter((lead) => !alreadyDone.has(lead.phone))
    .slice(0, remaining);
}
