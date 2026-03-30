// src/deploy.js — Vercel auto-deployment via REST API

import crypto from 'crypto';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const BASE_URL = 'https://api.vercel.com';

// ─── Helper: Create URL-safe slug from business name ───────────

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40) + '-' + Date.now().toString(36);
}

// ─── Step 1: Upload file to Vercel blob storage ─────────────────

async function uploadFile(content) {
  const buffer = Buffer.from(content, 'utf-8');
  const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');

  const res = await fetch(`${BASE_URL}/v2/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/octet-stream',
      'x-vercel-digest': sha1,
      'Content-Length': buffer.length.toString()
    },
    body: buffer
  });

  // 200 = uploaded, 409 = already exists (both are fine)
  if (res.status !== 200 && res.status !== 409) {
    const err = await res.text();
    throw new Error(`Vercel file upload failed (${res.status}): ${err}`);
  }

  return sha1;
}

// ─── Step 2: Create deployment referencing uploaded file ────────

async function createDeployment(projectName, sha1, fileSize) {
  const res = await fetch(`${BASE_URL}/v13/deployments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: projectName,
      files: [
        {
          file: 'index.html',
          sha: sha1,
          size: fileSize
        }
      ],
      projectSettings: {
        framework: null,
        buildCommand: null,
        outputDirectory: null
      },
      target: 'production'
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel deployment failed (${res.status}): ${err}`);
  }

  return await res.json();
}

// ─── Step 3: Poll until deployment is ready ────────────────────

async function waitForDeployment(deploymentId, maxWaitMs = 60000) {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 3000));

    const res = await fetch(`${BASE_URL}/v13/deployments/${deploymentId}`, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` }
    });

    const data = await res.json();

    if (data.readyState === 'READY') return data;
    if (data.readyState === 'ERROR') throw new Error(`Deployment ${deploymentId} errored`);

    console.log(`    ⏳ Deploy state: ${data.readyState}...`);
  }

  throw new Error('Deployment timed out after 60s');
}

// ─── Main export: deploy HTML → return live URL ─────────────────

export async function deployWebsite(lead, htmlContent) {
  if (!VERCEL_TOKEN) throw new Error('VERCEL_TOKEN not set in .env');

  const projectName = slugify(lead.business_name);
  const buffer = Buffer.from(htmlContent, 'utf-8');

  console.log(`  🚀 Deploying ${projectName} to Vercel...`);

  // 1. Upload file
  const sha1 = await uploadFile(htmlContent);

  // 2. Create deployment
  const deployment = await createDeployment(projectName, sha1, buffer.length);

  // 3. Wait for it to go live
  const ready = await waitForDeployment(deployment.id);

  const url = `https://${ready.url || deployment.url}`;
  console.log(`  ✅ Live at: ${url}`);
  return url;
}
