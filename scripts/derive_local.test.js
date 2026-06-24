/**
 * Local (on-device) BIP32 / BIP84 derivation — NO network, NO server, NO seed ever leaves.
 * Built only on the audited libs already in the app:
 *   @scure/bip39, @noble/hashes, @noble/curves, @scure/base
 *
 * Run:  node scripts/derive_local.test.js
 * Proves the local derivation matches the official BIP84 test vectors.
 */
'use strict';

const { mnemonicToSeedSync } = require('../node_modules/@scure/bip39');
const { hmac } = require('../node_modules/@noble/hashes/hmac.js');
const { sha512, sha256 } = require('../node_modules/@noble/hashes/sha2.js');
const { ripemd160 } = require('../node_modules/@noble/hashes/legacy.js');
const { secp256k1 } = require('../node_modules/@noble/curves/secp256k1.js');
const { bech32 } = require('../node_modules/@scure/base');

const N = secp256k1.Point.Fn.ORDER; // secp256k1 group order
const HARDENED = 0x80000000;

// ---- small byte helpers ----
const enc = new TextEncoder();
const cat = (...arrs) => {
  const len = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
};
const ser32 = (i) => Uint8Array.from([(i >>> 24) & 0xff, (i >>> 16) & 0xff, (i >>> 8) & 0xff, i & 0xff]);
const beToBig = (b) => { let n = 0n; for (const x of b) n = (n << 8n) | BigInt(x); return n; };
const bigTo32 = (n) => { const out = new Uint8Array(32); for (let i = 31; i >= 0; i--) { out[i] = Number(n & 0xffn); n >>= 8n; } return out; };

// ---- BIP32 ----
const hmac512 = (key, data) => hmac(sha512, key, data);

function masterFromSeed(seed) {
  const I = hmac512(enc.encode('Bitcoin seed'), seed);
  return { k: I.slice(0, 32), c: I.slice(32) };
}

function ckdPriv({ k, c }, index) {
  const hardened = index >= HARDENED;
  const data = hardened
    ? cat(Uint8Array.of(0), k, ser32(index))
    : cat(secp256k1.getPublicKey(k, true), ser32(index));
  const I = hmac512(c, data);
  const IL = I.slice(0, 32), IR = I.slice(32);
  const ki = (beToBig(IL) + beToBig(k)) % N;
  if (beToBig(IL) >= N || ki === 0n) throw new Error('invalid child (retry next index)');
  return { k: bigTo32(ki), c: IR };
}

function derivePath(seed, path) {
  // path like "m/84'/0'/0'/0/0"
  let node = masterFromSeed(seed);
  for (const part of path.split('/').slice(1)) {
    const hard = part.endsWith("'") || part.endsWith('h');
    const idx = parseInt(part, 10) + (hard ? HARDENED : 0);
    node = ckdPriv(node, idx);
  }
  return node;
}

// ---- BIP84 native-segwit (bc1) address from a private key node ----
function p2wpkhAddress(privKey) {
  const pub = secp256k1.getPublicKey(privKey, true);     // compressed pubkey, on-device
  const program = ripemd160(sha256(pub));                // hash160
  const words = [0, ...bech32.toWords(program)];         // witness v0
  return bech32.encode('bc', words);
}

// ======================= TESTS =======================
let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  console.log(`${ok ? 'PASS ✅' : 'FAIL ❌'}  ${name}`);
  if (!ok) { console.log(`        got : ${got}`); console.log(`        want: ${want}`); fail++; } else pass++;
};

// Official BIP84 spec test vectors (https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki)
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const seed = mnemonicToSeedSync(MNEMONIC, ''); // empty BIP39 passphrase — all local

check('BIP84 m/84\'/0\'/0\'/0/0 (first receive)',
  p2wpkhAddress(derivePath(seed, "m/84'/0'/0'/0/0").k),
  'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');

check('BIP84 m/84\'/0\'/0\'/0/1 (second receive)',
  p2wpkhAddress(derivePath(seed, "m/84'/0'/0'/0/1").k),
  'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g');

check('BIP84 m/84\'/0\'/0\'/1/0 (first change)',
  p2wpkhAddress(derivePath(seed, "m/84'/0'/0'/1/0").k),
  'bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el');

// Passphrase changes the wallet entirely (still 100% local)
const seedPass = mnemonicToSeedSync(MNEMONIC, 'TREZOR');
const addrPass = p2wpkhAddress(derivePath(seedPass, "m/84'/0'/0'/0/0").k);
check('BIP39 passphrase yields a DIFFERENT wallet (sanity)',
  addrPass !== 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu', true);

console.log(`\n${pass} passed, ${fail} failed.`);
console.log('No network calls were made. The seed was used only in-process to derive keys.');
process.exit(fail ? 1 : 0);
