/**
 * Aura security checks — exercises the REAL src/utils/encryption.ts under node by
 * transpiling it to ESM and importing the actual exported functions.
 *
 * Run:  node scripts/aura-security.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(PROJECT_ROOT, 'src');
const outDir = fs.mkdtempSync(path.join(PROJECT_ROOT, '.aura-sec-'));

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

const encPath = path.join(outDir, 'encryption.mjs');
fs.writeFileSync(encPath, transpile(fs.readFileSync(path.join(SRC, 'utils/encryption.ts'), 'utf8')));

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
}
function threw(fn) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

(async () => {
  const enc = await import(encPath);
  const SECRET = 'correct horse battery staple';
  const PLAIN = JSON.stringify({ wallets: [{ mnemonic: 'abandon about', wif: 'L1' }] });

  const blob = enc.encryptBlob(PLAIN, SECRET);
  ok('round-trip: decrypt recovers plaintext', enc.decryptBlob(blob, SECRET) === PLAIN);
  ok('wrong password is rejected', threw(() => enc.decryptBlob(blob, 'wrong')));

  // Tamper the ciphertext body -> MAC must reject it.
  const tampered = JSON.parse(blob);
  tampered.body = tampered.body.slice(0, -2) + (tampered.body.endsWith('A') ? 'B' : 'A') + '=';
  ok('tampered ciphertext is rejected', threw(() => enc.decryptBlob(JSON.stringify(tampered), SECRET)));

  // Tamper the Argon2 memory cost with an absurd value -> must be rejected fast,
  // not attempted (this is the DoS / app-hang guard).
  const bomb = JSON.parse(blob);
  bomb.m = 9_999_999;
  const t0 = process.hrtime.bigint();
  const rejected = threw(() => enc.decryptBlob(JSON.stringify(bomb), SECRET));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  ok('out-of-range Argon2 memory is rejected without running the KDF', rejected && ms < 1000);

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
