/**
 * Aura wallet crypto-core self-test.
 *
 * Runs against the project's OWN modules:
 *   - src/wallets/derivation.ts   (BIP32/39/44/49/84 derivation + address encoding)
 *   - src/wallets/signing.ts      (BIP143 signer)
 *   - src/wallets/transaction.ts  (coin selection / tx assembly helpers)
 *   - src/network/mempool.ts      (throttle + 429 retry/backoff)
 *
 * The i18n module (react-native bound) is stubbed via scripts/loader-hook.mjs.
 * Signature/witness cross-verification uses @scure/btc-signer (TEST ONLY).
 * NOTHING is broadcast.
 *
 * Run:  LANG=en_US.UTF-8 node --import ./scripts/register.mjs --import tsx ./scripts/aura-selftest.ts
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { ripemd160 } from '@noble/hashes/legacy.js';

// ---- Project modules under test ----
import {
  firstReceiveAddress,
  deriveAddressNode,
  toWIF,
  encodeP2WPKH,
  encodeP2SHP2WPKH,
  encodeP2PKH,
} from '../src/wallets/derivation';
import {
  buildSignedTransaction,
  sighashForInput,
  type SigningInput,
  type SigningOutput,
} from '../src/wallets/signing';
import { scriptPubKeyForAddress } from '../src/wallets/transaction';

// ---- Cross-check library (test harness only) ----
import * as btc from '@scure/btc-signer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

// ----------------------------------------------------------------------------
// tiny assertion harness
// ----------------------------------------------------------------------------
type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function assertEq(name: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  checks.push({
    name,
    pass,
    detail: pass
      ? `OK  = ${String(actual)}`
      : `actual=${String(actual)}  expected=${String(expected)}`,
  });
  return pass;
}
function assertTrue(name: string, cond: boolean, detail: string) {
  checks.push({ name, pass: cond, detail });
  return cond;
}
function line(s = '') {
  process.stdout.write(s + '\n');
}
function section(t: string) {
  line('');
  line('============================================================');
  line(t);
  line('============================================================');
}

const VECTOR_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const USER_MNEMONIC =
  'wire tone carpet wisdom gain dove thrive hungry response tip orange final';

// Independent reference derivation using @scure/bip32 (a separate, trusted
// BIP32 implementation) + @scure/btc-signer address encoding. The project rolls
// its OWN BIP32 in src/wallets/derivation.ts, so this is a genuine cross-check.
function refAddress(
  mnemonic: string,
  kind: 'BIP84' | 'BIP49' | 'BIP44',
  change: 0 | 1 = 0,
  index = 0,
): string {
  const seed = mnemonicToSeedSync(mnemonic, '');
  const purpose = kind === 'BIP84' ? 84 : kind === 'BIP49' ? 49 : 44;
  const root = HDKey.fromMasterSeed(seed);
  const k = root.derive(`m/${purpose}'/0'/0'/${change}/${index}`);
  const pub = k.publicKey!;
  if (kind === 'BIP84') return btc.p2wpkh(pub).address!;
  if (kind === 'BIP49') return btc.p2sh(btc.p2wpkh(pub)).address!;
  return btc.p2pkh(pub).address!;
}

// ============================================================================
// 1) BIP39 official test vectors
// ============================================================================
section('1) BIP39 / BIP84-49-44 official test vectors (mnemonic "abandon...about")');

const vecSeed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
line(`seed (hex, first 16 bytes): ${bytesToHex(vecSeed).slice(0, 32)}...`);

const bip84Vec = firstReceiveAddress(VECTOR_MNEMONIC, '', 'BIP84');
const bip44Vec = firstReceiveAddress(VECTOR_MNEMONIC, '', 'BIP44');
const bip49Vec = firstReceiveAddress(VECTOR_MNEMONIC, '', 'BIP49');

assertEq(
  'BIP84 m/84\'/0\'/0\'/0/0',
  bip84Vec,
  'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
);

// NOTE on BIP44: the task prompt asked to assert "1LqBGSKuTzvX3m9pAUu1KK17VrZ7TVwsdW".
// That value is INCORRECT for m/44'/0'/0'/0/0 of this mnemonic. Both the project
// AND an independent @scure/bip32 derivation produce 1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA
// (the canonical Ian-Coleman / standard test-vector address). We assert the
// VERIFIED-CORRECT value and separately record the prompt's value for honesty.
const BIP44_CORRECT = '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA';
const BIP44_PROMPT = '1LqBGSKuTzvX3m9pAUu1KK17VrZ7TVwsdW';
assertEq('BIP44 m/44\'/0\'/0\'/0/0 (verified-correct vector)', bip44Vec, BIP44_CORRECT);
assertTrue(
  'BIP44 prompt-supplied vector was incorrect (documented)',
  bip44Vec !== BIP44_PROMPT && bip44Vec === BIP44_CORRECT,
  `prompt asked ${BIP44_PROMPT}; correct value (project & @scure/bip32 agree) is ${BIP44_CORRECT}`,
);

assertEq('BIP49 m/49\'/0\'/0\'/0/0', bip49Vec, '37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf');

// Independent cross-check: project derivation must equal @scure/bip32 reference.
assertEq('BIP84 vector == @scure/bip32 ref', bip84Vec, refAddress(VECTOR_MNEMONIC, 'BIP84'));
assertEq('BIP44 vector == @scure/bip32 ref', bip44Vec, refAddress(VECTOR_MNEMONIC, 'BIP44'));
assertEq('BIP49 vector == @scure/bip32 ref', bip49Vec, refAddress(VECTOR_MNEMONIC, 'BIP49'));

// ============================================================================
// 2) Derive + print user's phrase addresses
// ============================================================================
section('2) Derive first receive addresses for USER phrase');
line(`phrase: "${USER_MNEMONIC}"`);

const userBip84 = firstReceiveAddress(USER_MNEMONIC, '', 'BIP84');
const userBip49 = firstReceiveAddress(USER_MNEMONIC, '', 'BIP49');
const userBip44 = firstReceiveAddress(USER_MNEMONIC, '', 'BIP44');

line(`BIP84 (native segwit, m/84'/0'/0'/0/0): ${userBip84}`);
line(`BIP49 (p2sh-p2wpkh,  m/49'/0'/0'/0/0): ${userBip49}`);
line(`BIP44 (legacy p2pkh, m/44'/0'/0'/0/0): ${userBip44}`);

// Validate each address by (a) round-tripping through the project's own
// scriptPubKey encoder and (b) cross-decoding with @scure/btc-signer.
function validAddress(name: string, addr: string, expectPrefix?: string) {
  let projectOk = false;
  let libOk = false;
  let spk = '';
  try {
    const s = scriptPubKeyForAddress(addr);
    spk = bytesToHex(s);
    projectOk = s.length > 0;
  } catch (e) {
    spk = `project decode threw: ${(e as Error).message}`;
  }
  try {
    // OutScript.encode(Address().decode()) must round-trip back to the address.
    const decoded = btc.Address(btc.NETWORK).decode(addr);
    const reSpk = btc.OutScript.encode(decoded);
    const reAddr = btc.Address(btc.NETWORK).encode(btc.OutScript.decode(reSpk));
    libOk = reAddr === addr;
  } catch (e) {
    libOk = false;
    spk += ` | lib decode threw: ${(e as Error).message}`;
  }
  const prefixOk = expectPrefix ? addr.startsWith(expectPrefix) : true;
  assertTrue(
    name,
    projectOk && libOk && prefixOk,
    `projectScriptPubKey=${projectOk} libRoundTrip=${libOk} prefixOk=${prefixOk} spk=${spk}`,
  );
}

validAddress('user BIP84 valid bech32 bc1', userBip84, 'bc1q');
validAddress('user BIP49 valid p2sh (3...)', userBip49, '3');
validAddress('user BIP44 valid p2pkh (1...)', userBip44, '1');

// Independent cross-check of the user's addresses against @scure/bip32.
assertEq('user BIP84 == @scure/bip32 ref', userBip84, refAddress(USER_MNEMONIC, 'BIP84'));
assertEq('user BIP49 == @scure/bip32 ref', userBip49, refAddress(USER_MNEMONIC, 'BIP49'));
assertEq('user BIP44 == @scure/bip32 ref', userBip44, refAddress(USER_MNEMONIC, 'BIP44'));

// ============================================================================
// 3) Build + sign a synthetic transaction (NO BROADCAST) and verify
// ============================================================================
section('3) Build + sign a SYNTHETIC transaction (no broadcast) and verify');

// Derive the user's first BIP84 key (owner of the synthetic UTXO).
const userSeed = mnemonicToSeedSync(USER_MNEMONIC, '');
const ownerNode = deriveAddressNode(userSeed, 'BIP84', 0, 0); // m/84'/0'/0'/0/0
const ownerWif = toWIF(ownerNode.privateKey);
const ownerPriv = Uint8Array.from(ownerNode.privateKey);
const ownerPub = secp256k1.getPublicKey(ownerPriv, true);
const ownerAddr = encodeP2WPKH(ownerPriv); // == userBip84

// Synthetic / fabricated UTXO (does NOT exist on chain).
const FAKE_TXID = 'a'.repeat(64); // 32 fake bytes
const UTXO_VALUE = 100_000; // sats
const SEND_VALUE = 50_000; // sats to recipient
const FEE = 2_000; // sats fee
const CHANGE_VALUE = UTXO_VALUE - SEND_VALUE - FEE; // 48_000 back to wallet
const RECIPIENT = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu';
const CHANGE_ADDR = ownerAddr; // change back to wallet (BIP84 receive 0)

line(`owner (BIP84 #0) address : ${ownerAddr}`);
line(`synthetic UTXO           : ${FAKE_TXID}:0  value=${UTXO_VALUE} sats`);
line(`recipient                : ${RECIPIENT}  value=${SEND_VALUE} sats`);
line(`change -> wallet         : ${CHANGE_ADDR}  value=${CHANGE_VALUE} sats`);
line(`fee                      : ${FEE} sats`);

const inputs: SigningInput[] = [
  {
    txid: FAKE_TXID,
    vout: 0,
    value: UTXO_VALUE,
    wif: ownerWif,
    scriptType: 'P2WPKH',
    sequence: 0xfffffffd, // RBF
  },
];
const outputs: SigningOutput[] = [
  { address: RECIPIENT, value: SEND_VALUE },
  { address: CHANGE_ADDR, value: CHANGE_VALUE },
];

// sighash the project computes for input 0 (BIP143) — captured BEFORE signing
// (signing zeroes the priv key buffers internally on the prepared copies).
const projectSighashHex = sighashForInput(inputs, outputs, 0, 0);

const built = buildSignedTransaction(inputs, outputs, 0);
line('');
line(`signed tx txid : ${built.txid}`);
line(`isSegwit       : ${built.isSegwit}`);
line(`vsize / weight : ${built.vsize} vB / ${built.weight} WU`);
line('');
line('RAW SIGNED TRANSACTION HEX:');
line(built.hex);

// ---- Verify the hex by fully decoding it with @scure/btc-signer ----
let decodeOk = false;
let inCount = -1;
let outCount = -1;
let recvOut = -1;
let changeOut = -1;
let witnessItems = -1;
let sigVerifies = false;
let sighashMatch = false;
let verifyDetail = '';

try {
  const parsed = btc.Transaction.fromRaw(hexToBytes(built.hex), {
    allowUnknownInputs: true,
    allowUnknownOutputs: true,
    disableScriptCheck: true,
  });
  decodeOk = true;
  inCount = parsed.inputsLength;
  outCount = parsed.outputsLength;

  // Inspect outputs by value+address.
  for (let i = 0; i < parsed.outputsLength; i++) {
    const o = parsed.getOutput(i);
    const val = Number(o.amount);
    let addr = '';
    try {
      addr = btc.Address(btc.NETWORK).encode(btc.OutScript.decode(o.script!));
    } catch {
      addr = '(undecodable)';
    }
    line(`  out[${i}] value=${val} sats addr=${addr}`);
    if (val === SEND_VALUE && addr === RECIPIENT) recvOut = i;
    if (val === CHANGE_VALUE && addr === CHANGE_ADDR) changeOut = i;
  }

  // Inspect input 0 outpoint + witness.
  const in0 = parsed.getInput(0);
  const txidLe = bytesToHex(in0.txid!); // btc-signer stores txid little-... let's just compare reversed
  line(`  in[0] prevout txid(stored)=${txidLe} vout=${in0.index}`);

  // Extract the witness from the raw hex directly to count stack items.
  // @scure exposes finalScriptWitness on a finalized input.
  const wit = (in0 as any).finalScriptWitness as Uint8Array[] | undefined;
  if (wit) {
    witnessItems = wit.length;
    line(`  in[0] witness stack items=${witnessItems}`);

    // wit[0] = signature (DER + sighash byte), wit[1] = pubkey
    const sigDerWithType = wit[0];
    const pubFromWit = wit[1];

    // (a) pubkey in witness equals owner pubkey
    const pubMatches = bytesToHex(pubFromWit) === bytesToHex(ownerPub);

    // (b) recompute BIP143 sighash INDEPENDENTLY from the parsed tx and check
    //     the signature verifies against it with secp256k1, and that it equals
    //     the sighash the project's signer produced.
    const sigType = sigDerWithType[sigDerWithType.length - 1];
    const sigDer = sigDerWithType.slice(0, sigDerWithType.length - 1);

    // Independent BIP143 preimage (re-derive from scratch, do not trust project).
    const independentSighash = bip143Sighash(
      built.hex,
      0,
      ownerPub,
      UTXO_VALUE,
    );
    sighashMatch =
      bytesToHex(independentSighash) === projectSighashHex;

    // @noble/curves v2: verify a DER signature via the `format: 'der'` option.
    sigVerifies =
      pubMatches &&
      sigType === 0x01 &&
      secp256k1.verify(sigDer, independentSighash, ownerPub, {
        prehash: false,
        format: 'der',
      });

    verifyDetail =
      `pubMatches=${pubMatches} sigHashType=0x${sigType.toString(16)} ` +
      `projectSighash=${projectSighashHex} indepSighash=${bytesToHex(independentSighash)} ` +
      `sighashMatch=${sighashMatch} ecdsaVerify=${sigVerifies}`;
  } else {
    verifyDetail = 'no finalScriptWitness found on parsed input';
  }
} catch (e) {
  verifyDetail = `decode/verify threw: ${(e as Error).message}`;
}

line('');
assertTrue('tx decodes (btc-signer)', decodeOk, decodeOk ? 'OK' : verifyDetail);
assertEq('input count', inCount, 1);
assertEq('output count', outCount, 2);
assertTrue('recipient output present (50000 -> recipient)', recvOut >= 0, `index=${recvOut}`);
assertTrue('change output present (48000 -> wallet)', changeOut >= 0, `index=${changeOut}`);
assertEq('witness stack items (sig+pubkey)', witnessItems, 2);
assertTrue('project BIP143 sighash == independent recompute', sighashMatch, verifyDetail);
assertTrue('ECDSA signature verifies against BIP143 sighash', sigVerifies, verifyDetail);

// Independent BIP143 (BIP143) sighash recomputation from the serialized tx.
// Re-parses the raw hex and rebuilds the preimage by hand (does not reuse the
// project's signing code), then double-sha256.
function bip143Sighash(
  rawHex: string,
  inputIndex: number,
  pubkey: Uint8Array,
  inputValueSats: number,
): Uint8Array {
  const tx = btc.Transaction.fromRaw(hexToBytes(rawHex), {
    allowUnknownInputs: true,
    allowUnknownOutputs: true,
    disableScriptCheck: true,
  });

  const dsha = (b: Uint8Array) => sha256(sha256(b));
  const u32le = (n: number) => {
    const o = new Uint8Array(4);
    new DataView(o.buffer).setUint32(0, n >>> 0, true);
    return o;
  };
  const u64le = (n: number) => {
    const o = new Uint8Array(8);
    let r = n;
    for (let i = 0; i < 8; i++) {
      o[i] = r & 0xff;
      r = Math.floor(r / 256);
    }
    return o;
  };
  const cat = (...a: Uint8Array[]) => {
    let len = 0;
    for (const x of a) len += x.length;
    const o = new Uint8Array(len);
    let off = 0;
    for (const x of a) {
      o.set(x, off);
      off += x.length;
    }
    return o;
  };
  const rev = (b: Uint8Array) => Uint8Array.from(b).reverse();

  const n = tx.inputsLength;
  const prevoutChunks: Uint8Array[] = [];
  const seqChunks: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    const inp = tx.getInput(i);
    // btc-signer stores txid in big-endian display order in `.txid`;
    // outpoint serialization needs little-endian (reversed).
    prevoutChunks.push(cat(rev(inp.txid!), u32le(inp.index!)));
    seqChunks.push(u32le(inp.sequence ?? 0xffffffff));
  }
  const hashPrevouts = dsha(cat(...prevoutChunks));
  const hashSequence = dsha(cat(...seqChunks));

  const outChunks: Uint8Array[] = [];
  for (let i = 0; i < tx.outputsLength; i++) {
    const out = tx.getOutput(i);
    const script = out.script!;
    outChunks.push(
      cat(u64le(Number(out.amount)), Uint8Array.of(script.length), script),
    );
  }
  const hashOutputs = dsha(cat(...outChunks));

  // scriptCode for P2WPKH = 0x1976a914{20-byte-pubkeyhash}88ac
  const pkh = ripemd160(sha256(pubkey));
  const scriptCode = cat(
    Uint8Array.of(0x19, 0x76, 0xa9, 0x14),
    pkh,
    Uint8Array.of(0x88, 0xac),
  );

  const cur = tx.getInput(inputIndex);
  const preimage = cat(
    u32le(2), // version
    hashPrevouts,
    hashSequence,
    cat(rev(cur.txid!), u32le(cur.index!)), // this outpoint
    scriptCode,
    u64le(inputValueSats),
    u32le(cur.sequence ?? 0xffffffff),
    hashOutputs,
    u32le(tx.lockTime ?? 0),
    u32le(0x01), // SIGHASH_ALL
  );
  return dsha(preimage);
}

// ============================================================================
// 4) NETWORK 429 fix
// ============================================================================
section('4) Network 429 throttle + retry/backoff');

const mempoolSrc = readFileSync(path.join(ROOT, 'src/network/mempool.ts'), 'utf8');
const hasThrottle = /async function throttle\s*\(/.test(mempoolSrc) &&
  /nextRequestAt/.test(mempoolSrc);
const handles429 =
  /RETRYABLE_STATUS\s*=\s*new Set\(\[[^\]]*429/.test(mempoolSrc) &&
  /backoffMs\s*\(/.test(mempoolSrc) &&
  /Retry-After/.test(mempoolSrc);
const hasBackoffLoop = /for\s*\(let attempt = 0; attempt <= MAX_RETRIES/.test(mempoolSrc);

assertTrue('mempool.ts has request throttle', hasThrottle,
  hasThrottle ? 'throttle() + nextRequestAt present' : 'throttle missing');
assertTrue('mempool.ts retries on HTTP 429 w/ backoff', handles429 && hasBackoffLoop,
  `429 in RETRYABLE_STATUS + backoffMs(Retry-After) + retry loop present`);

// Deterministic check: force two HTTP 429s (with Retry-After), then a 200, by
// monkeypatching global fetch, and confirm the project's fetchAddrStats RETRIES
// transparently and still returns parsed data. This proves the backoff path is
// actually exercised (not just present in source / lucky on a live call).
async function forced429Check() {
  let mod: typeof import('../src/network/mempool');
  try {
    mod = await import('../src/network/mempool');
  } catch (e) {
    assertTrue('forced-429 retry path', false, `module import failed: ${(e as Error).message}`);
    return;
  }
  const realFetch = globalThis.fetch;
  let calls = 0;
  const okBody = JSON.stringify({
    address: 'x',
    chain_stats: { funded_txo_sum: 12345, spent_txo_sum: 45, tx_count: 2 },
    mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0, tx_count: 0 },
  });
  // @ts-expect-error test shim
  globalThis.fetch = async () => {
    calls += 1;
    if (calls <= 2) {
      return new Response('rate limited', {
        status: 429,
        headers: { 'Retry-After': '0' }, // 0s -> retry effectively immediately
      });
    }
    return new Response(okBody, { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const stats = await mod.fetchAddrStats('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
    const ok = calls === 3 && stats.confirmedBalance === 12345 - 45 && stats.txCount === 2;
    assertTrue(
      'forced-429: retries twice then succeeds',
      ok,
      `fetch invoked ${calls}x (expected 3), confirmedBalance=${stats.confirmedBalance} txCount=${stats.txCount}`,
    );
  } catch (e) {
    assertTrue('forced-429: retries twice then succeeds', false,
      `threw instead of retrying: ${(e as Error).message} (fetch invoked ${calls}x)`);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// Optional live check: a few real GETs through the project's own fetchAddrStats.
// Network may be unavailable in this sandbox; treat connectivity failure as
// "skipped", but any UNHANDLED 429 surfacing as an error is a FAIL.
async function liveCheck() {
  let mod: typeof import('../src/network/mempool');
  try {
    mod = await import('../src/network/mempool');
  } catch (e) {
    line(`live check skipped (module import failed): ${(e as Error).message}`);
    return;
  }
  const addrs = [userBip84, userBip49, userBip44, RECIPIENT];
  let ok = 0;
  let unhandled429 = false;
  let netErr: string | null = null;
  for (const a of addrs) {
    try {
      const stats = await mod.fetchAddrStats(a);
      ok++;
      line(`  GET address/${a} -> txCount=${stats.txCount} balance=${stats.totalBalance} sats`);
    } catch (e) {
      const msg = (e as Error).message || String(e);
      if (/HTTP 429/.test(msg)) {
        unhandled429 = true;
        line(`  GET address/${a} -> UNHANDLED 429: ${msg}`);
      } else {
        netErr = msg;
        line(`  GET address/${a} -> network/other error (non-429): ${msg}`);
      }
    }
  }
  if (ok > 0 && !unhandled429) {
    assertTrue('live mempool GETs (no unhandled 429)', true, `${ok}/${addrs.length} succeeded`);
  } else if (unhandled429) {
    assertTrue('live mempool GETs (no unhandled 429)', false, 'an unhandled 429 surfaced');
  } else {
    line(`live check inconclusive (no successes, last err: ${netErr}); static checks above are authoritative.`);
  }
}

async function main() {
  await forced429Check();
  await liveCheck();

  // ==========================================================================
  // Report
  // ==========================================================================
  section('SELF-TEST REPORT');
  let failed = 0;
  for (const c of checks) {
    const tag = c.pass ? 'PASS' : 'FAIL';
    if (!c.pass) failed++;
    line(`[${tag}] ${c.name}  -- ${c.detail}`);
  }
  line('');
  line(`TOTAL: ${checks.length} checks, ${checks.length - failed} passed, ${failed} failed`);
  line(`SIGNED_TX_HEX=${built.hex}`);
  line(`SIGNATURE_VERIFIES=${sigVerifies}`);
  line(`OVERALL=${failed === 0 ? 'PASS' : 'FAIL'}`);

  process.exit(failed === 0 ? 0 : 1);
}

main().catch(e => {
  line(`FATAL: ${(e as Error).stack || e}`);
  process.exit(1);
});
