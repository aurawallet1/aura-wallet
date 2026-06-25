/**
 * Aura Electrum server-selection checks — exercises the REAL src/network/electrumConfig.ts
 * under node by transpiling it to ESM and driving serversFromConfig directly.
 *
 * Run:  node scripts/aura-electrum-config.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(PROJECT_ROOT, 'src');
const outDir = fs.mkdtempSync(path.join(PROJECT_ROOT, '.aura-elec-'));

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

const modPath = path.join(outDir, 'electrumConfig.mjs');
fs.writeFileSync(modPath, transpile(fs.readFileSync(path.join(SRC, 'network/electrumConfig.ts'), 'utf8')));

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
}

(async () => {
  const m = await import(modPath);
  const cfg = (o) => m.serversFromConfig(JSON.stringify(o));

  ok('null config → public defaults', m.serversFromConfig(null).length === 4);
  ok('malformed JSON → public defaults', m.serversFromConfig('{not json').length === 4);
  ok('empty savedHost → public defaults', cfg({ savedHost: '', savedPort: '50002' }).length === 4);
  ok('no saved server → public defaults', cfg({ host: 'x.y', port: '1' }).length === 4);

  const own = cfg({ savedHost: 'mynode.example.com', savedPort: '50002', ssl: true });
  ok('own server is used exclusively', own.length === 1 && own[0].host === 'mynode.example.com' && own[0].port === 50002);
  ok('ssl true by default', own[0].ssl === true);

  const plain = cfg({ savedHost: '192.168.1.50', savedPort: '50001', ssl: false });
  ok('non-SSL local node → ssl:false (plain TCP)', plain[0].ssl === false && plain[0].port === 50001);

  const onion = cfg({ savedHost: 'abcd1234efgh5678.onion', savedPort: '50001', ssl: false });
  ok('.onion host is accepted', onion.length === 1 && onion[0].host.endsWith('.onion'));

  ok('port 0 rejected → defaults', cfg({ savedHost: 'h.io', savedPort: '0' }).length === 4);
  ok('port 70000 rejected → defaults', cfg({ savedHost: 'h.io', savedPort: '70000' }).length === 4);
  ok('non-numeric port rejected → defaults', cfg({ savedHost: 'h.io', savedPort: 'abc' }).length === 4);
  ok('ssl omitted defaults to true', cfg({ savedHost: 'h.io', savedPort: '50002' })[0].ssl === true);

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
