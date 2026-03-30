// src/agent.js — Claude AI website generator

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an elite web designer who creates stunning, personalized one-page business websites.
You generate complete, self-contained HTML files with:
- Embedded CSS (no external stylesheets except Google Fonts via @import)
- Mobile-first responsive design
- Unique visual identity per business type (food = warm earthy tones, tech = clean blues, medical = calm greens, etc.)
- Business-specific sections: Hero, About, Services/Products, Contact, WhatsApp CTA button
- A floating WhatsApp contact button linking to the owner's number
- Fast loading — no JavaScript frameworks, pure CSS animations only
- SEO meta tags with business name and location

OUTPUT RULES:
- Return ONLY the complete HTML. No explanation, no markdown, no backticks.
- The HTML must start with <!DOCTYPE html> and be valid.
- Make it look like a ₹15,000 professional website.
- Use Google Fonts (1-2 fonts max, imported via CSS @import)
- Add subtle CSS animations (fade-in, slide-up on sections)
- Always include a "Get a Custom Website" CTA section at the bottom with the agency details`;

export async function generateWebsite(lead, agencyDetails) {
  const prompt = `Create a stunning one-page website for this Indian business:

BUSINESS DETAILS:
- Business Name: ${lead.business_name}
- Owner: ${lead.owner_name}
- Phone: +${lead.phone}
- Location: ${lead.location}
- Category: ${lead.category}
- Products/Services: ${lead.products_services}
- Tagline: ${lead.tagline || ''}
- Instagram: ${lead.instagram || 'Not provided'}
- Facebook: ${lead.facebook || 'Not provided'}

AGENCY DETAILS (for upsell CTA at bottom):
- Agency: ${agencyDetails.name}
- Agency Phone: ${agencyDetails.phone}
- Agency Website: ${agencyDetails.website}

REQUIREMENTS:
1. Design must match the business CATEGORY (${lead.category}) — use appropriate colors, fonts, imagery
2. Hero section with business name, tagline, and a prominent "Call Now" button linking to wa.me/${lead.phone}
3. Services/Products section listing: ${lead.products_services}
4. Location section: "${lead.location}"
5. Floating WhatsApp button (bottom-right) linking to wa.me/${lead.phone}
6. Footer with social links if provided
7. At the very bottom: "Want a fully custom website with booking, payments & more? Contact ${agencyDetails.name}: ${agencyDetails.phone}"
8. Include Open Graph meta tags for WhatsApp preview

Make it extraordinary. This is the business owner's first look at their potential online presence.`;

  console.log(`  🤖 Generating website for ${lead.business_name}...`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }]
  });

  let html = response.content[0].text.trim();

  // Strip any accidental markdown fences
  html = html.replace(/^```html\n?/i, '').replace(/\n?```$/i, '').trim();

  if (!html.startsWith('<!DOCTYPE') && !html.startsWith('<html')) {
    throw new Error(`Invalid HTML generated for ${lead.business_name}`);
  }

  console.log(`  ✅ Website generated (${Math.round(html.length / 1024)}KB)`);
  return html;
}
