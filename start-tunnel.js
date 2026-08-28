#!/usr/bin/env node

import dotenv from 'dotenv';
import process from 'process';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

dotenv.config();

const port = Number(process.env.FRONTEND_PORT || 5000);
const tunnelTarget = `http://localhost:${port}`;
const cloudflaredCandidates = process.platform === 'win32'
  ? [
      'C:\\Program Files\\cloudflared\\cloudflared.exe',
      'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
      'cloudflared.exe',
    ]
  : ['cloudflared'];

function resolveCloudflared() {
  return cloudflaredCandidates.find((candidate) =>
    candidate.includes('\\') ? fs.existsSync(candidate) : true
  );
}

const cloudflared = resolveCloudflared();
if (!cloudflared) {
  console.error('cloudflared was not found. Install it with: winget install Cloudflare.cloudflared');
  process.exit(1);
}

console.log(`Starting Cloudflare Quick Tunnel for ${tunnelTarget}...`);

const command = cloudflared;
const tunnel = spawn(command, ['tunnel', '--url', tunnelTarget], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
});

let output = '';
let publicUrlPrinted = false;

function handleOutput(chunk) {
  const text = chunk.toString();
  output += text;
  process.stdout.write(text);

  if (!publicUrlPrinted) {
    const match = output.match(/https:\/\/[-a-z0-9]+\.trycloudflare\.com/i);
    if (match) {
      publicUrlPrinted = true;
      console.log(`\nPublic frontend: ${match[0]}`);
    }
  }
}

tunnel.stdout.on('data', handleOutput);
tunnel.stderr.on('data', handleOutput);
tunnel.once('error', (error) => {
  console.error(`Cloudflare Tunnel failed: ${error.message}`);
  process.exit(1);
});
tunnel.once('close', (code) => {
  if (code !== 0) {
    console.error(`Cloudflare Tunnel exited with code ${code}.`);
  }
  process.exit(code ?? 0);
});

function shutdown() {
  tunnel.kill();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
