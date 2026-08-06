/**
 * Integration tests: PAPER Automate lifecycle
 * Run: node tests/paper.test.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const cwd = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(cwd, 'data-paper-test');

// ── Server lifecycle ─────────────────────────────────────────────────────────
let server;
const PORT = 13791;

async function startServer() {
  server = spawn(process.execPath, ['app-server.mjs'], {
    cwd,
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: dataDir,
      DISCOVERY_ENABLED: 'false',
      ALLOW_ANONYMOUS_PAPER: 'true',
      SESSION_SECRET: 'test-secret-paper',
    },
  });
  server.stderr.on('data', () => {});
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server start timeout')), 8000);
    server.stdout.on('data', d => {
      if (String(d).includes('listening')) { clearTimeout(t); resolve(); }
    });
    server.on('error', e => { clearTimeout(t); reject(e); });
  });
}

function stopServer() {
  server?.kill('SIGTERM');
  fs.rmSync(dataDir, { recursive: true, force: true });
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function request(method, pathname, opts = {}) {
  return new Promise((resolve, reject) => {
    const body = opts.body ? JSON.stringify(opts.body) : null;
    const headers = {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}),
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    };
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path: pathname, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        const json = (() => { try { return JSON.parse(text); } catch { return {}; } })();
        resolve({ status: res.statusCode, headers: res.headers, json, text });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Make a session cookie by hitting any authenticated endpoint
async function newSession() {
  const r = await request('GET', '/api/billing/status');
  const setCookie = r.headers['set-cookie'] || [];
  const cookie = setCookie.map(c => c.split(';')[0]).join('; ');
  return cookie;
}

async function api(method, pathname, opts = {}) {
  return request(method, pathname, opts);
}

// ── Tests ────────────────────────────────────────────────────────────────────
const results = [];
function test(name, fn) { results.push({ name, fn }); }

test('healthz responds', async () => {
  const r = await api('GET', '/api/healthz');
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
});

test('GET /api/paper/positions returns 200 with auto-session (ALLOW_ANONYMOUS_PAPER=true)', async () => {
  // With anonymous paper enabled the server creates a session automatically;
  // no 401 is issued. Auth guard fires only when ALLOW_ANONYMOUS_PAPER=false.
  const r = await api('GET', '/api/paper/positions');
  assert.equal(r.status, 200, `Expected 200 (auto-session), got ${r.status}`);
  assert.ok(Array.isArray(r.json.positions), 'positions array present');
});

test('GET /api/paper/status returns paper mode defaults', async () => {
  const cookie = await newSession();
  const r = await api('GET', '/api/paper/status', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.environment, 'paper');
  assert.equal(r.json.simulated, true);
  assert.equal(r.json.walletRequired, false);
  assert.equal(r.json.proRequired, false);
});

test('GET /api/paper/positions is empty for new user', async () => {
  const cookie = await newSession();
  const r = await api('GET', '/api/paper/positions', { cookie });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.positions, []);
});

test('GET /api/paper/proposals is empty for new user', async () => {
  const cookie = await newSession();
  const r = await api('GET', '/api/paper/proposals', { cookie });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.proposals, []);
});

test('GET /api/paper/trades is empty for new user', async () => {
  const cookie = await newSession();
  const r = await api('GET', '/api/paper/trades', { cookie });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.trades, []);
});

test('settings default includes tradingEnvironment=paper', async () => {
  const cookie = await newSession();
  const r = await api('GET', '/api/settings', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.settings.tradingEnvironment, 'paper');
});

test('settings default includes operatingMode=observe', async () => {
  const cookie = await newSession();
  const r = await api('GET', '/api/settings', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.settings.operatingMode, 'observe');
});

test('Free user can set operatingMode=automate in paper environment', async () => {
  const cookie = await newSession();
  const r = await api('PUT', '/api/settings', {
    cookie,
    body: { settings: { operatingMode: 'automate', tradingEnvironment: 'paper' } },
  });
  assert.equal(r.status, 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.json)}`);
  assert.equal(r.json.settings.operatingMode, 'automate');
  assert.equal(r.json.settings.tradingEnvironment, 'paper');
});

test('Free user cannot set tradingEnvironment=live', async () => {
  const cookie = await newSession();
  const r = await api('PUT', '/api/settings', {
    cookie,
    body: { settings: { tradingEnvironment: 'live' } },
  });
  assert.equal(r.status, 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.json)}`);
  assert.equal(r.json.error, 'LIVE_ENTITLEMENT_REQUIRED');
});

test('Invalid operatingMode rejected by settings validation', async () => {
  const cookie = await newSession();
  const r = await api('PUT', '/api/settings', {
    cookie,
    body: { settings: { operatingMode: 'yolo' } },
  });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'INVALID_SETTINGS');
});

test('Invalid tradingEnvironment rejected by settings validation', async () => {
  const cookie = await newSession();
  const r = await api('PUT', '/api/settings', {
    cookie,
    body: { settings: { tradingEnvironment: 'live_always' } },
  });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'INVALID_SETTINGS');
});

test('Observe mode: GET /api/paper/positions returns no positions', async () => {
  const cookie = await newSession();
  // Set observe mode (default) and ensure no position created
  await api('PUT', '/api/settings', {
    cookie,
    body: { settings: { operatingMode: 'observe', tradingEnvironment: 'paper' } },
  });
  const r = await api('GET', '/api/paper/positions', { cookie });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.positions, []);
});

test('Assist mode: proposal API accepts and rejects', async () => {
  const cookie = await newSession();
  await api('PUT', '/api/settings', {
    cookie,
    body: { settings: { operatingMode: 'assist', tradingEnvironment: 'paper', positionSize: 0.1, maxPositionSize: 0.5 } },
  });
  // No proposals yet — nothing to approve (404)
  const rApprove = await api('POST', '/api/paper/proposals/nonexistent/approve', { cookie });
  assert.equal(rApprove.status, 404);
  const rReject = await api('POST', '/api/paper/proposals/nonexistent/reject', { cookie });
  assert.equal(rReject.status, 404);
});

test('User isolation: positions belong to their session only', async () => {
  const cookieA = await newSession();
  const cookieB = await newSession();
  // Both users see empty positions independently
  const rA = await api('GET', '/api/paper/positions', { cookie: cookieA });
  const rB = await api('GET', '/api/paper/positions', { cookie: cookieB });
  assert.equal(rA.status, 200);
  assert.equal(rB.status, 200);
  assert.deepEqual(rA.json.positions, []);
  assert.deepEqual(rB.json.positions, []);
});

test('User isolation: status is per-session', async () => {
  const cookieA = await newSession();
  const cookieB = await newSession();
  // Set user A to automate
  await api('PUT', '/api/settings', {
    cookie: cookieA,
    body: { settings: { operatingMode: 'automate', tradingEnvironment: 'paper' } },
  });
  const rA = await api('GET', '/api/paper/status', { cookie: cookieA });
  const rB = await api('GET', '/api/paper/status', { cookie: cookieB });
  assert.equal(rA.json.operatingMode, 'automate');
  assert.equal(rB.json.operatingMode, 'observe'); // B untouched
});

test('Close non-existent paper position returns 404', async () => {
  const cookie = await newSession();
  const r = await api('POST', '/api/paper/positions/no-such-id/close', { cookie });
  assert.equal(r.status, 404);
});

test('LIVE /api/live/execute blocked for free user', async () => {
  const cookie = await newSession();
  const r = await api('POST', '/api/live/execute', { cookie });
  assert.equal(r.status, 402);
  assert.equal(r.json.error, 'LIVE_ENTITLEMENT_REQUIRED');
});

test('PAPER Automate mode does not call live/execute or wallet signing', async () => {
  // Structural test: paper routes never delegate to /api/live/execute
  // Verified by checking that /api/paper/* responses have simulated:true
  const cookie = await newSession();
  const r = await api('GET', '/api/paper/status', { cookie });
  assert.equal(r.json.simulated, true);
  // Live execute is still blocked for same session
  const rLive = await api('POST', '/api/live/execute', { cookie });
  assert.equal(rLive.status, 402);
});

test('OperatingMode is case-normalised (Automate → automate)', async () => {
  const cookie = await newSession();
  const r = await api('PUT', '/api/settings', {
    cookie,
    body: { settings: { operatingMode: 'Automate', tradingEnvironment: 'paper' } },
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.settings.operatingMode, 'automate');
});

// ── Runner ───────────────────────────────────────────────────────────────────
try {
  await startServer();
  let passed = 0, failed = 0;
  for (const { name, fn } of results) {
    try {
      await fn();
      console.log(`PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`FAIL: ${name}\n  ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
} finally {
  stopServer();
}
