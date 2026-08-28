#!/usr/bin/env node

/**
 * WebSocket Price Server — Crypgo
 *
 * Standalone process that:
 *  1. Fetches supported asset prices from CoinGecko
 *  2. Broadcasts prices to all connected clients every 10 seconds
 *  3. Uses in-memory caching with 10s TTL to avoid hammering the API
 *
 * Run with:  node server/wsServer.mjs
 * Listens on: ws://localhost:5001
 */

import { WebSocketServer } from 'ws';

const PORT = 5001;
const POLL_INTERVAL_MS = 10_000; // fetch fresh prices every 10s
const BROADCAST_INTERVAL_MS = 10_000; // broadcast every 10s

// ── In-memory cache ──
let cachedPrices = null;
const apiKey = process.env.COINGECKO_API_KEY;
const COIN_IDS = [
  'bitcoin', 'ethereum', 'binancecoin', 'solana', 'litecoin', 'tether',
  'dogecoin', 'cardano', 'polkadot', 'chainlink', 'ripple',
];

async function fetchPrices() {
  if (!apiKey) {
    console.error('[ws-server] COINGECKO_API_KEY is not configured; no prices will be published');
    return false;
  }

  try {
    const ids = COIN_IDS.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=${ids}&include_24hr_change=true&x_cg_demo_api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`CoinGecko API status ${res.status}`);
    }

    const data = await res.json();
    const missing = COIN_IDS.filter((id) => !data[id] || typeof data[id].usd !== 'number');
    if (missing.length > 0) {
      throw new Error(`CoinGecko response missing: ${missing.join(', ')}`);
    }

    cachedPrices = data;
    return true;
  } catch (err) {
    console.error('[ws-server] CoinGecko fetch failed; no prices published:', err.message);
    return false;
  }
}

// ── WebSocket server ──
const wss = new WebSocketServer({ port: PORT });

console.log(`[ws-server] WebSocket server listening on ws://localhost:${PORT}`);

wss.on('connection', (ws, req) => {
  console.log(`[ws-server] Client connected (${req.socket.remoteAddress})`);

  // Send current prices immediately when live data is available.
  if (cachedPrices) {
    ws.send(JSON.stringify({ type: 'prices', data: cachedPrices }));
  }

  ws.on('close', () => {
    console.log('[ws-server] Client disconnected');
  });

  ws.on('error', (err) => {
    console.error('[ws-server] Client error:', err.message);
  });
});

// ── Periodic fetch + broadcast ──
setInterval(async () => {
  const hasLivePrices = await fetchPrices();
  if (!hasLivePrices || !cachedPrices) return;

  const message = JSON.stringify({ type: 'prices', data: cachedPrices });

  let clientCount = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
      clientCount++;
    }
  });

  if (clientCount > 0) {
    console.log(`[ws-server] Broadcast to ${clientCount} client(s): BTC=$${cachedPrices.bitcoin.usd}, ETH=$${cachedPrices.ethereum.usd}, SOL=$${cachedPrices.solana.usd}, LTC=$${cachedPrices.litecoin.usd}`);
  }
}, BROADCAST_INTERVAL_MS);

// Initial fetch
fetchPrices();

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n[ws-server] Shutting down...');
  wss.close(() => process.exit(0));
});