/**
 * Aura notifications relay checks — exercises the REAL src/network/alerts.ts under
 * node by transpiling it to ESM and driving the actual exported functions against a
 * captured fetch.
 *
 * Run:  node scripts/aura-alerts.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(PROJECT_ROOT, 'src');
const outDir = fs.mkdtempSync(path.join(PROJECT_ROOT, '.aura-alerts-'));

function transpile(src) {
  return ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      isolatedModules: true,
    },
  }).outputText;
}

const modPath = path.join(outDir, 'alerts.mjs');
fs.writeFileSync(modPath, transpile(fs.readFileSync(path.join(SRC, 'network/alerts.ts'), 'utf8')));

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
}
async function threwAsync(fn) {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

let calls = [];
function mockFetch(status) {
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status };
  };
}

(async () => {
  const alerts = await import(modPath);

  ok('normalizeRelay strips trailing slashes', alerts.normalizeRelay('https://alerts.aura.app///') === 'https://alerts.aura.app');

  const PAYLOAD = {
    deviceToken: 'tok-123',
    platform: 'ios',
    events: { incoming: true, confirmations: false },
    wallets: [{ id: 'w1', label: 'Main', addresses: ['bc1qxyz'] }],
  };

  calls = [];
  mockFetch(200);
  await alerts.registerSubscription('https://alerts.aura.app/', PAYLOAD);
  const reg = calls[0];
  ok('register hits POST /v1/subscriptions', reg.url === 'https://alerts.aura.app/v1/subscriptions' && reg.init.method === 'POST');
  ok('register sends JSON content-type', reg.init.headers['Content-Type'] === 'application/json');
  ok('register serializes the payload', JSON.parse(reg.init.body).deviceToken === 'tok-123' && JSON.parse(reg.init.body).wallets[0].addresses[0] === 'bc1qxyz');

  calls = [];
  mockFetch(200);
  await alerts.sendTestPing('https://alerts.aura.app', 'tok-123', 'ios');
  ok('test hits POST /v1/test with token', calls[0].url === 'https://alerts.aura.app/v1/test' && JSON.parse(calls[0].init.body).deviceToken === 'tok-123');

  calls = [];
  mockFetch(200);
  await alerts.purgeSubscription('https://alerts.aura.app', 'tok/with space');
  ok('purge DELETEs /v1/subscriptions/{encoded token}', calls[0].init.method === 'DELETE' && calls[0].url === `https://alerts.aura.app/v1/subscriptions/${encodeURIComponent('tok/with space')}`);

  mockFetch(503);
  ok('non-2xx relay response rejects', await threwAsync(() => alerts.registerSubscription('https://alerts.aura.app', PAYLOAD)));

  ok('empty relay endpoint rejects', await threwAsync(() => alerts.registerSubscription('   ', PAYLOAD)));

  console.log(`${pass} passed, ${fail} failed (of ${pass + fail}).`);
  fs.rmSync(outDir, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})().catch(err => {
  console.error('HARNESS ERROR:', err && err.stack ? err.stack : err);
  try {
    fs.rmSync(outDir, { recursive: true, force: true });
  } catch (_) {}
  process.exit(2);
});
