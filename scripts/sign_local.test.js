/**
 * Local (on-device) P2WPKH transaction signing — BIP143.
 * NO network, NO server, the private key never leaves this process.
 * Built only on @noble/curves + @noble/hashes (already in the app).
 *
 * Proof: reproduce the OFFICIAL BIP143 "Native P2WPKH" worked example
 *   (https://github.com/bitcoin/bips/blob/master/bip-0143.mediawiki)
 * — same sighash and same signature bytes the spec publishes.
 *
 * Run:  node scripts/sign_local.test.js
 */
'use strict';

const { sha256 } = require('../node_modules/@noble/hashes/sha2.js');
const { secp256k1 } = require('../node_modules/@noble/curves/secp256k1.js');

const hex = {
  to: (b) => Buffer.from(b).toString('hex'),
  from: (h) => Uint8Array.from(Buffer.from(h, 'hex')),
};
const dsha256 = (b) => sha256(sha256(b));
const cat = (...a) => {
  const out = new Uint8Array(a.reduce((s, x) => s + x.length, 0));
  let o = 0; for (const x of a) { out.set(x, o); o += x.length; } return out;
};
// little-endian encoders
const u32le = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
const u64le = (n) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(n), true); return b; };

/**
 * BIP143 sighash for a single P2WPKH input (SIGHASH_ALL).
 * @param tx { version, locktime, inputs:[{txid(hex BE),vout,sequence}], outputs:[{value(sats),scriptHex}] }
 * @param i  index of the input being signed
 * @param pubkeyHash160 hex of HASH160(pubkey) for that input
 * @param amount sats of the UTXO being spent
 */
function sighashP2WPKH(tx, i, pubkeyHash160, amount) {
  const SIGHASH_ALL = 1;
  // prevouts: txid is displayed big-endian, serialized little-endian
  const prevouts = cat(...tx.inputs.map(inp => cat(hex.from(inp.txid).reverse(), u32le(inp.vout))));
  const sequences = cat(...tx.inputs.map(inp => u32le(inp.sequence)));
  const outputs = cat(...tx.outputs.map(o => {
    const spk = hex.from(o.scriptHex);
    return cat(u64le(o.value), Uint8Array.of(spk.length), spk);
  }));
  const hashPrevouts = dsha256(prevouts);
  const hashSequence = dsha256(sequences);
  const hashOutputs = dsha256(outputs);

  const inp = tx.inputs[i];
  const outpoint = cat(hex.from(inp.txid).reverse(), u32le(inp.vout));
  // scriptCode for P2WPKH = 1976a914{20-byte-hash}88ac
  const scriptCode = hex.from('1976a914' + pubkeyHash160 + '88ac');

  const preimage = cat(
    u32le(tx.version),
    hashPrevouts,
    hashSequence,
    outpoint,
    scriptCode,
    u64le(amount),
    u32le(inp.sequence),
    hashOutputs,
    u32le(tx.locktime),
    u32le(SIGHASH_ALL),
  );
  return dsha256(preimage);
}

// ======================= TEST: BIP143 native P2WPKH example =======================
let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  console.log(`${ok ? 'PASS ✅' : 'FAIL ❌'}  ${name}`);
  if (!ok) { console.log(`        got : ${got}`); console.log(`        want: ${want}`); fail++; }
};

// The exact unsigned tx from BIP143:
const tx = {
  version: 1,
  locktime: 17,
  inputs: [
    { txid: '9f96ade4b41d5433f4eda31e1738ec2b36f6e7d1420d94a6af99801a88f7f7ff', vout: 0, sequence: 0xffffffee },
    { txid: '8ac60eb9575db5b2d987e29f301b5b819ea83a5c6579d282d189cc04b8e151ef', vout: 1, sequence: 0xffffffff },
  ],
  outputs: [
    { value: 112340000, scriptHex: '76a9148280b37df378db99f66f85c95a783a76ac7a6d5988ac' },
    { value: 223450000, scriptHex: '76a9143bde42dbee7e4dbe6a21b2d50ce2f0167faa815988ac' },
  ],
};

// input index 1 is the P2WPKH (6 BTC):
const privKey = hex.from('619c335025c7f4012e556c2a58b2506e30b8511b53ade95ea316fd8c3286feb9');
const pubKey = secp256k1.getPublicKey(privKey, true);
const { ripemd160 } = require('../node_modules/@noble/hashes/legacy.js');
const h160 = hex.to(ripemd160(sha256(pubKey)));

// BIP143 input scriptPubKey is 0014<hash160>; the embedded hash160 is the authoritative anchor.
check('derived key hash160 matches BIP143 scriptPubKey',
  h160, '1d0f172a0ecb48aee1be1f2687d2963ae33f71a1');

const sighash = sighashP2WPKH(tx, 1, h160, 600000000);
check('BIP143 sighash matches spec',
  hex.to(sighash), 'c37af31116d1b27caf68aae9e3ac82f1477929014d5b917657d0eb49478cb670');

// Sign locally — deterministic RFC6979, low-S (Bitcoin policy), DER. prehash:false (we pass the 32-byte hash).
const derSig = secp256k1.sign(sighash, privKey, { lowS: true, format: 'der', prehash: false });
const sigWithHashType = hex.to(derSig) + '01'; // append SIGHASH_ALL byte
check('local signature matches BIP143 spec exactly',
  sigWithHashType,
  '304402203609e17b84f6a7d30c80bfa610b5b4542f32a8a0d5447a12fb1366d7f01cc44a0220573a954c4518331561406f90300e8f3358f51928d43c212a8caed02de67eebee01');

// And it verifies against the pubkey:
check('signature verifies locally',
  secp256k1.verify(derSig, sighash, pubKey, { format: 'der', prehash: false }), true);

console.log(`\n${fail === 0 ? 'ALL PASSED' : fail + ' FAILED'} — signing happened entirely on-device, key never left the process.`);
process.exit(fail ? 1 : 0);
