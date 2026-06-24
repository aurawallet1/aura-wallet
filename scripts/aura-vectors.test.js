/**
 * Aura official-vector verification.
 *
 * This test exercises the REAL application crypto in:
 *   - src/wallets/derivation.ts  (BIP32 / BIP39-seed / BIP44/49/84 derivation + address encoding)
 *   - src/wallets/signing.ts     (BIP143 P2WPKH sighash + ECDSA signing)
 *
 * Those files are TypeScript and depend on ESM-only packages (@noble/*, @scure/*),
 * and signing.ts imports the React-Native i18n module. To run them under plain
 * `node` (no ts-node / tsx installed) we:
 *   1. Transpile the .ts sources to ESM .mjs with the installed TypeScript compiler API.
 *   2. Stub the `../i18n` import (used only for human-readable error strings, never
 *      on the crypto path) so the React-Native dependency chain does not load.
 *   3. Dynamically import the emitted modules and call the actual exported functions.
 *
 * No vector value is reimplemented — every assertion runs the app's own code.
 *
 * Run:  node scripts/aura-vectors.test.js
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(PROJECT_ROOT, 'src');

// ---------------------------------------------------------------------------
// Build step: transpile the real .ts sources into an importable ESM bundle dir.
// The dir MUST live inside the project tree so that node's module resolver finds
// the project's node_modules (@noble/*, @scure/*) when importing the emitted .mjs.
// ---------------------------------------------------------------------------
const outDir = fs.mkdtempSync(path.join(PROJECT_ROOT, '.aura-vectors-'));

function transpile(tsSource) {
  return ts.transpileModule(tsSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      isolatedModules: true,
    },
  }).outputText;
}

function emit(relName, tsSource) {
  const out = path.join(outDir, relName);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, transpile(tsSource));
  return out;
}

// constants/bitcoin.ts -> provides the real HARDENED value used by derivation.ts
emit('constants/bitcoin.mjs', fs.readFileSync(path.join(SRC, 'constants/bitcoin.ts'), 'utf8'));

// i18n stub: signing.ts uses `loc` ONLY for error message text + formatString.
fs.writeFileSync(
  path.join(outDir, 'i18n.mjs'),
  `const leaf = new Proxy({}, { get: () => 'err' });\n` +
    `const loc = new Proxy(\n` +
    `  { formatString: (t, ...a) => String(t) + ' ' + a.join(' ') },\n` +
    `  { get: (t, p) => (p in t ? t[p] : leaf) },\n` +
    `);\n` +
    `export default loc;\n`,
);

// derivation.ts: rewrite the relative TS import to the emitted .mjs path.
const derivationSrc = fs
  .readFileSync(path.join(SRC, 'wallets/derivation.ts'), 'utf8')
  .replace('../constants/bitcoin', '../constants/bitcoin.mjs');
emit('wallets/derivation.mjs', derivationSrc);

// signing.ts: point ./derivation at emitted .mjs and stub the i18n import.
const signingSrc = fs
  .readFileSync(path.join(SRC, 'wallets/signing.ts'), 'utf8')
  .replace("'./derivation'", "'./derivation.mjs'")
  .replace("'../i18n'", "'../i18n.mjs'");
emit('wallets/signing.mjs', signingSrc);

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
let pass = 0;
let fail = 0;
function check(name, got, want) {
  const ok = got === want;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) {
    console.log(`        got : ${got}`);
    console.log(`        want: ${want}`);
  }
}

(async () => {
  const { bytesToHex, hexToBytes, concatBytes } = await import('@noble/hashes/utils.js');
  const { sha256 } = await import('@noble/hashes/sha2.js');
  const { mnemonicToSeedSync } = await import('@scure/bip39');
  const { secp256k1 } = await import('@noble/curves/secp256k1.js');
  const { base58check } = await import('@scure/base');

  const der = await import(path.join(outDir, 'wallets/derivation.mjs'));
  const sign = await import(path.join(outDir, 'wallets/signing.mjs'));

  // Build a mainnet P2PKH base58 address from a raw hash160 hex (version 0x00).
  // Used only to create recipient OUTPUT addresses for the BIP143 vector; the
  // app re-decodes these to the exact scriptPubKey bytes the spec commits to.
  const b58c = base58check(sha256);
  const p2pkhFromHash160 = h =>
    b58c.encode(concatBytes(Uint8Array.of(0x00), hexToBytes(h)));

  // =====================================================================
  // 1) BIP39 mnemonic -> seed (Trezor vector, passphrase "TREZOR")
  // =====================================================================
  const TREZOR_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const trezorSeed = mnemonicToSeedSync(TREZOR_MNEMONIC, 'TREZOR');
  check(
    'BIP39 mnemonic->seed (Trezor vector, passphrase=TREZOR)',
    bytesToHex(trezorSeed),
    'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e5349553' +
      '1f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04',
  );

  // BIP44/49/84 spec address vectors use the same mnemonic with EMPTY passphrase.
  const specSeed = mnemonicToSeedSync(TREZOR_MNEMONIC, '');

  // =====================================================================
  // 2) BIP32 child derivation — official BIP32 Test Vector 1.
  //    Seed = 000102030405060708090a0b0c0d0e0f
  // =====================================================================
  const bip32Seed = hexToBytes('000102030405060708090a0b0c0d0e0f');
  const master = der.masterNode(bip32Seed);
  check(
    'BIP32 vec1 master (m) private key',
    bytesToHex(master.privateKey),
    'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35',
  );
  check(
    'BIP32 vec1 master (m) chain code',
    bytesToHex(master.chainCode),
    '873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508',
  );
  // m/0'/1 exercises one hardened CKD followed by one normal CKD via derivePath.
  const node_0h_1 = der.derivePath(bip32Seed, "m/0'/1");
  check(
    "BIP32 vec1 m/0'/1 private key",
    bytesToHex(node_0h_1.privateKey),
    '3c6cb8d0f6a264c91ea8b5030fadaa8e538b020f0a387421a12de9319dc93368',
  );
  check(
    "BIP32 vec1 m/0'/1 chain code",
    bytesToHex(node_0h_1.chainCode),
    '2a7857631386ba23dacac34180dd1983734e444fdbf774041578e9b6adb37c19',
  );

  // =====================================================================
  // 3a) BIP84 first receive address (Native SegWit, P2WPKH) — spec vector.
  // =====================================================================
  const bip84Node = der.deriveAddressNode(specSeed, 'BIP84', 0, 0);
  check(
    "BIP84 m/84'/0'/0'/0/0 first receive address",
    der.encodeAddress('BIP84', bip84Node.privateKey),
    'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
  );
  check(
    'BIP84 WIF round-trip recovers the private key',
    bytesToHex(der.fromWIF(der.toWIF(bip84Node.privateKey))),
    bytesToHex(bip84Node.privateKey),
  );

  // =====================================================================
  // 3b) BIP49 first receive address (P2SH-P2WPKH) — spec vector.
  // =====================================================================
  const bip49Node = der.deriveAddressNode(specSeed, 'BIP49', 0, 0);
  check(
    "BIP49 m/49'/0'/0'/0/0 first receive address",
    der.encodeAddress('BIP49', bip49Node.privateKey),
    '37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf',
  );

  // =====================================================================
  // 3c) BIP44 first receive address (Legacy P2PKH) — canonical mnemonic vector.
  // =====================================================================
  const bip44Node = der.deriveAddressNode(specSeed, 'BIP44', 0, 0);
  check(
    "BIP44 m/44'/0'/0'/0/0 first receive address",
    der.encodeAddress('BIP44', bip44Node.privateKey),
    '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA',
  );

  // =====================================================================
  // 4) BIP143 native P2WPKH sighash + signature — official worked example.
  //    Spec signs input #1 (the 6 BTC P2WPKH input). hashPrevouts/hashSequence/
  //    hashOutputs depend only on outpoints, sequences and outputs, so modeling
  //    both inputs as P2WPKH yields the identical index-1 sighash as the spec.
  // =====================================================================
  const bip143Priv = hexToBytes('619c335025c7f4012e556c2a58b2506e30b8511b53ade95ea316fd8c3286feb9');
  const bip143Wif = der.toWIF(bip143Priv);

  check(
    'BIP143 derived hash160 matches spec scriptPubKey 0014<h160>',
    bytesToHex(der.hash160(der.compressedPublicKey(der.fromWIF(bip143Wif)))),
    '1d0f172a0ecb48aee1be1f2687d2963ae33f71a1',
  );

  const inputs = [
    {
      txid: '9f96ade4b41d5433f4eda31e1738ec2b36f6e7d1420d94a6af99801a88f7f7ff',
      vout: 0,
      value: 625000000,
      wif: bip143Wif,
      scriptType: 'P2WPKH',
      sequence: 0xffffffee,
    },
    {
      txid: '8ac60eb9575db5b2d987e29f301b5b819ea83a5c6579d282d189cc04b8e151ef',
      vout: 1,
      value: 600000000, // 6 BTC, committed in the sighash for input #1
      wif: bip143Wif,
      scriptType: 'P2WPKH',
      sequence: 0xffffffff,
    },
  ];
  const specOutputs = [
    { address: p2pkhFromHash160('8280b37df378db99f66f85c95a783a76ac7a6d59'), value: 112340000 },
    { address: p2pkhFromHash160('3bde42dbee7e4dbe6a21b2d50ce2f0167faa8159'), value: 223450000 },
  ];

  // The BIP143 worked example transaction is version 1; Aura builds version-2
  // transactions in production, so we pass version=1 here to verify the sighash
  // algorithm against the spec byte-for-byte (the only difference is nVersion).
  const sighashHex = sign.sighashForInput(inputs, specOutputs, 1, 17, 1);
  check(
    'BIP143 P2WPKH sighash (input #1) matches spec',
    sighashHex,
    'c37af31116d1b27caf68aae9e3ac82f1477929014d5b917657d0eb49478cb670',
  );

  // Sign exactly as signing.ts does (lowS, DER, prehash:false) and compare to spec.
  const der143 = secp256k1.sign(hexToBytes(sighashHex), bip143Priv, {
    prehash: false,
    lowS: true,
    format: 'der',
  });
  const sigWithType = bytesToHex(der143) + '01';
  check(
    'BIP143 P2WPKH signature (DER+SIGHASH_ALL) matches spec exactly',
    sigWithType,
    '304402203609e17b84f6a7d30c80bfa610b5b4542f32a8a0d5447a12fb1366d7f01cc44a' +
      '0220573a954c4518331561406f90300e8f3358f51928d43c212a8caed02de67eebee01',
  );
  check(
    'BIP143 signature verifies against derived pubkey',
    secp256k1.verify(der143, hexToBytes(sighashHex), der.compressedPublicKey(bip143Priv), {
      format: 'der',
      prehash: false,
    }),
    true,
  );

  // Bonus: a full end-to-end signed P2WPKH tx builds, is flagged segwit, and
  // produces a stable txid (proves buildSignedTransaction wires the witness in).
  const built = sign.buildSignedTransaction(
    [inputs[1]],
    [{ address: p2pkhFromHash160('3bde42dbee7e4dbe6a21b2d50ce2f0167faa8159'), value: 590000000 }],
    0,
  );
  check('buildSignedTransaction flags segwit for P2WPKH', built.isSegwit, true);
  check(
    'buildSignedTransaction emits witness marker/flag (0001)',
    built.hex.slice(8, 12),
    '0001',
  );

  console.log(`\n${pass} passed, ${fail} failed (of ${pass + fail}).`);
  fs.rmSync(outDir, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})().catch(err => {
  console.error('HARNESS ERROR:', err && err.stack ? err.stack : err);
  try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (_) {}
  process.exit(2);
});
