/**
 * Aura BIP21 parsing checks — exercises the REAL src/utils/bip21.ts under node by
 * transpiling it to ESM and driving parsePaymentUri directly.
 *
 * Run:  node scripts/aura-bip21.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(PROJECT_ROOT, 'src');
const outDir = fs.mkdtempSync(path.join(PROJECT_ROOT, '.aura-bip21-'));

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

const modPath = path.join(outDir, 'bip21.mjs');
fs.writeFileSync(modPath, transpile(fs.readFileSync(path.join(SRC, 'utils/bip21.ts'), 'utf8')));

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
}

(async () => {
  const { parsePaymentUri: p } = await import(modPath);

  let r = p('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
  ok('bare bech32 address passes through', r.address === 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' && !r.amountBtc);

  r = p('bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
  ok('bitcoin: scheme stripped', r.address === 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');

  r = p('  BITCOIN:bc1qAddr?amount=0.001  ');
  ok('uppercase scheme + whitespace handled', r.address === 'bc1qAddr'.toLowerCase());
  ok('amount parsed from BIP21', r.amountBtc === '0.001');

  r = p('bitcoin:BC1QAR0SRRR7XFKVY5L643LYDNW9RE59GTZZWF5MDQ?amount=0.5&label=Coffee%20Bar');
  ok('uppercase bech32 lowercased', r.address === 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
  ok('amount + label parsed', r.amountBtc === '0.5' && r.label === 'Coffee Bar');

  r = p('bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.1');
  ok('legacy base58 NOT lowercased', r.address === '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' && r.amountBtc === '0.1');

  r = p('bitcoin:bc1qaddr?amount=notanumber');
  ok('invalid amount ignored', r.address === 'bc1qaddr' && r.amountBtc === undefined);

  r = p('bitcoin:bc1qaddr?amount=0');
  ok('zero amount ignored', r.amountBtc === undefined);

  r = p('bitcoin:bc1qaddr?label=Donation&message=Thanks');
  ok('label falls back to message when no label first', r.label === 'Donation');

  r = p('bitcoin:bc1qaddr?message=Tip%20jar');
  ok('message used as label when label absent', r.label === 'Tip jar');

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
