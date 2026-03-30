# 🚀 WhatsApp Website Agent (Koyeb Edition)

AI agent — always-on, free, no credit card required.

## 🏗️ Architecture

```
GitHub repo
    ↓  (auto-deploy)
Koyeb Worker  ← always-on, free forever, never sleeps
    ↓  (generates + deploys each site via REST API)
Vercel  ← static HTML sites, one per business
    ↓  (sends link)
WhatsApp  ← Baileys on your number
```

## ⚡ Setup (browser only, no terminal)

### Step 1 — Push to GitHub
- github.com → + → New repository → "whatsapp-website-agent"
- Click "uploading an existing file"
- Drag all files from the unzipped folder → Commit

### Step 2 — Deploy on Koyeb
- app.koyeb.com → Sign up free (no credit card)
- Create App → GitHub → select your repo
- Service type: **Worker** (not Web Service)
- Build: Buildpack → Node.js (auto-detected)
- Run command: `node src/index.js`
- Instance: **Free**
- Click Deploy

### Step 3 — Add environment variables in Koyeb
In your service → Settings → Environment Variables → add:

```
ANTHROPIC_API_KEY     = sk-ant-xxxxxx
VERCEL_TOKEN          = your_vercel_token
AGENCY_NAME           = Your Agency Name
AGENCY_PHONE          = +919XXXXXXXXX
AGENCY_WEBSITE        = https://yoursite.com
DAILY_LIMIT           = 50
MESSAGE_DELAY_SECONDS = 90
UPSELL_DELAY_HOURS    = 24
LEADS_CSV_PATH        = ./data/leads.csv
TRACKER_JSON_PATH     = ./data/tracker.json
```

Get Vercel token: vercel.com/account/tokens → Create

### Step 4 — Connect WhatsApp (one-time QR scan)
- Koyeb → your service → Runtime Logs
- QR code appears in logs on first boot
- Open WhatsApp on your phone → Linked Devices → scan QR
- Session saved — never need to scan again

### Step 5 — Add your leads
Edit data/leads.csv and push to GitHub → Koyeb auto-redeploys

## 🔄 Flow
```
leads.csv → Claude generates HTML → Vercel deploy → WhatsApp sent
                                                         ↓
                                            [24hrs later: upsell]
```

## 💰 Cost: ₹0/month
- Koyeb free tier: 1 worker, always-on, no sleep
- Vercel free tier: 100 deployments/month
- WhatsApp: your existing number

## 📁 Files
```
├── src/
│   ├── index.js      ← Orchestrator + daily scheduler
│   ├── agent.js      ← Claude website generator
│   ├── deploy.js     ← Vercel REST API
│   ├── whatsapp.js   ← Baileys sender
│   ├── data.js       ← CSV + tracker
│   ├── messages.js   ← WhatsApp templates
│   └── dashboard.js  ← CLI stats
├── data/leads.csv    ← Your scraped leads
├── koyeb.yaml        ← Koyeb config
├── Procfile          ← Process definition
├── .env.example      ← Copy to .env for local testing
└── .gitignore
```
