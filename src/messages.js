// src/messages.js — WhatsApp message templates

const AGENCY = {
  name: process.env.AGENCY_NAME || 'WebSpark India',
  phone: process.env.AGENCY_PHONE || '+919XXXXXXXXX',
  website: process.env.AGENCY_WEBSITE || 'https://webspark.in'
};

// ─── Message 1: Initial outreach with website link ──────────────

export function buildInitialMessage(lead, siteUrl) {
  return `Hi ${lead.owner_name} ji! 🙏

Maine aapke *${lead.business_name}* ke liye ek FREE website banai hai — dekho kaisi lagi:

🌐 *${siteUrl}*

Ye website:
✅ Mobile pe bhi sahi dikti hai
✅ Google pe mil sakti hai
✅ WhatsApp se directly contact kar sakte customers

Ye ek sample hai — aapke liye *bilkul FREE* banai hai.

Koi bhi sawaal ho toh batao! 😊

— ${AGENCY.name}`;
}

// ─── Message 2: Upsell follow-up (sent after X hours) ──────────

export function buildUpsellMessage(lead, siteUrl) {
  return `${lead.owner_name} ji, namaste! 🙏

Aapki website *${siteUrl}* share ki thi — hope aapko pasand aai!

Agar aap chahte ho toh hum aapke liye *fully custom website* bana sakte hain:

🔥 *Premium Package includes:*
• Custom domain (e.g. ${lead.business_name.toLowerCase().replace(/\s+/g, '')}.com)
• Online booking / order form
• Google Maps integration
• Photo gallery
• WhatsApp chat button
• 1 year hosting FREE
• Google pe dikhna (SEO)

💰 *Starting ₹4,999 only*
(One-time payment, no monthly charges)

Interested? Reply *HAAN* ya call karo:
📞 ${AGENCY.phone}

*${AGENCY.name}* — Trusted by 200+ businesses across Gujarat`;
}

// ─── Message 3: Final nudge (optional, 72hrs later) ─────────────

export function buildFinalNudgeMessage(lead) {
  return `${lead.owner_name} ji! 👋

Last message — aapki FREE website abhi bhi available hai.

Sirf *₹4,999* mein apna online business shuru karo.

Call/WhatsApp: ${AGENCY.phone}
Website: ${AGENCY.website}

*${AGENCY.name}* 🚀`;
}
