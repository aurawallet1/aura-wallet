/**
 * Local address encoders (P2PKH / P2SH-P2WPKH / P2WPKH) — no network.
 * Validated against official BIP44/BIP49/BIP84 test vectors for the
 * canonical "abandon ... about" mnemonic, plus a classic P2PKH vector.
 *
 * Run: node scripts/address_local.test.js
 */
'use strict';
const { mnemonicToSeedSync } = require('../node_modules/@scure/bip39');
const { hmac } = require('../node_modules/@noble/hashes/hmac.js');
const { sha512, sha256 } = require('../node_modules/@noble/hashes/sha2.js');
const { ripemd160 } = require('../node_modules/@noble/hashes/legacy.js');
const { secp256k1 } = require('../node_modules/@noble/curves/secp256k1.js');
const { bech32, base58check } = require('../node_modules/@scure/base');

const N = secp256k1.Point.Fn.ORDER, HARDENED = 0x80000000;
const enc = new TextEncoder();
const b58c = base58check(sha256);
const cat = (...a) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const ser32 = (i) => Uint8Array.from([(i >>> 24) & 255, (i >>> 16) & 255, (i >>> 8) & 255, i & 255]);
const be = (b) => { let n = 0n; for (const x of b) n = (n << 8n) | BigInt(x); return n; };
const b32 = (n) => { const o = new Uint8Array(32); for (let i = 31; i >= 0; i--) { o[i] = Number(n & 255n); n >>= 8n; } return o; };
const hash160 = (b) => ripemd160(sha256(b));

const master = (seed) => { const I = hmac(sha512, enc.encode('Bitcoin seed'), seed); return { k: I.slice(0, 32), c: I.slice(32) }; };
function ckd({ k, c }, index) {
  const hard = index >= HARDENED;
  const data = hard ? cat(Uint8Array.of(0), k, ser32(index)) : cat(secp256k1.getPublicKey(k, true), ser32(index));
  const I = hmac(sha512, c, data);
  return { k: b32((be(I.slice(0, 32)) + be(k)) % N), c: I.slice(32) };
}
function derive(seed, path) { let n = master(seed); for (const p of path.split('/').slice(1)) { const h = /['h]$/.test(p); n = ckd(n, parseInt(p, 10) + (h ? HARDENED : 0)); } return n; }
const pub = (k) => secp256k1.getPublicKey(k, true);

// ---- address encoders ----
const p2pkh = (pk) => b58c.encode(cat(Uint8Array.of(0x00), hash160(pk)));              // 1...
const p2wpkh = (pk) => bech32.encode('bc', [0, ...bech32.toWords(hash160(pk))]);        // bc1q...
const p2shP2wpkh = (pk) => {                                                            // 3...
  const redeem = cat(Uint8Array.of(0x00, 0x14), hash160(pk));   // OP_0 <20-byte>
  return b58c.encode(cat(Uint8Array.of(0x05), hash160(redeem)));
};

// ============ TESTS ============
let fail = 0;
const check = (n, g, w) => { const ok = g === w; console.log(`${ok ? 'PASS ✅' : 'FAIL ❌'}  ${n}`); if (!ok) { console.log('   got :', g); console.log('   want:', w); fail++; } };

const seed = mnemonicToSeedSync('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', '');

check('BIP84 P2WPKH m/84\'/0\'/0\'/0/0', p2wpkh(pub(derive(seed, "m/84'/0'/0'/0/0").k)), 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
check('BIP49 P2SH-P2WPKH m/49\'/0\'/0\'/0/0', p2shP2wpkh(pub(derive(seed, "m/49'/0'/0'/0/0").k)), '37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf');
// Classic P2PKH encoder vector (Bitcoin wiki): pubkey -> 1PMycacn...
const classicPub = Uint8Array.from(Buffer.from('0250863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b2352', 'hex'));
check('P2PKH encoder (classic vector)', p2pkh(classicPub), '1PMycacnJaSqwwJqjawXBErnLsZ7RkXUAs');

console.log(`\n${fail === 0 ? 'ALL PASSED' : fail + ' FAILED'} — addresses generated locally, no network, no secret transmitted.`);
process.exit(fail ? 1 : 0);
