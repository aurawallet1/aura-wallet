import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hexToBytes, bytesToHex, concatBytes } from '@noble/hashes/utils.js';
import { bech32, base58check } from '@scure/base';
import { compressedPublicKey, hash160, fromWIF } from './derivation';
import loc from '../i18n';

const base58Check = base58check(sha256);

const MAINNET_HRP = 'bc';
const P2PKH_VERSION = 0x00;
const P2SH_VERSION = 0x05;
const WITNESS_V0 = 0;

const SIGHASH_ALL = 0x01;
// Transactions are built as version 2 (BIP68). The sighash preimage must commit
// to the same nVersion the final transaction uses, so this is the single source
// of truth for both. Exposed through the signing helpers so the BIP143 spec
// worked example (which uses version 1) can be verified directly in tests.
const TX_VERSION = 2;
const DEFAULT_SEQUENCE = 0xffffffff;
const RBF_SEQUENCE = 0xfffffffd;
const SEGWIT_MARKER = 0x00;
const SEGWIT_FLAG = 0x01;
const WITNESS_SCALE_FACTOR = 4;

const OP_DUP = 0x76;
const OP_HASH160 = 0xa9;
const OP_EQUAL = 0x87;
const OP_EQUALVERIFY = 0x88;
const OP_CHECKSIG = 0xac;
const PUSH_20 = 0x14;

export type SignableScript = 'P2PKH' | 'P2SH-P2WPKH' | 'P2WPKH';

export interface SigningInput {
  txid: string;
  vout: number;
  value: number;
  wif: string;
  scriptType: SignableScript;
  sequence?: number;
}

export interface SigningOutput {
  address: string;
  value: number;
}

export interface BuiltTransaction {
  hex: string;
  txid: string;
  vsize: number;
  weight: number;
  isSegwit: boolean;
}

const networkError = (key: keyof typeof loc.nodeConn, status: string | number): Error =>
  new Error(loc.formatString(loc.nodeConn[key], status) as string);

const doubleSha256 = (bytes: Uint8Array): Uint8Array => sha256(sha256(bytes));

const reverseBytes = (bytes: Uint8Array): Uint8Array => {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[bytes.length - 1 - i];
  }
  return out;
};

const uint8 = (value: number): Uint8Array => Uint8Array.of(value & 0xff);

const uint32LE = (value: number): Uint8Array => {
  const out = new Uint8Array(4);
  let remaining = value >>> 0;
  for (let i = 0; i < 4; i += 1) {
    out[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  return out;
};

const uint64LE = (value: number): Uint8Array => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(loc.outflow.malformedValue);
  }
  const out = new Uint8Array(8);
  let remaining = value;
  for (let i = 0; i < 8; i += 1) {
    out[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  return out;
};

const varint = (value: number): Uint8Array => {
  if (value < 0xfd) return uint8(value);
  if (value <= 0xffff) return concatBytes(uint8(0xfd), uint32LE(value).slice(0, 2));
  if (value <= 0xffffffff) return concatBytes(uint8(0xfe), uint32LE(value));
  return concatBytes(uint8(0xff), uint64LE(value));
};

const varBytes = (bytes: Uint8Array): Uint8Array => concatBytes(varint(bytes.length), bytes);

const outpoint = (txid: string, vout: number): Uint8Array =>
  concatBytes(reverseBytes(hexToBytes(txid)), uint32LE(vout));

const p2pkhScript = (publicKeyHash: Uint8Array): Uint8Array =>
  concatBytes(
    Uint8Array.of(OP_DUP, OP_HASH160, PUSH_20),
    publicKeyHash,
    Uint8Array.of(OP_EQUALVERIFY, OP_CHECKSIG),
  );

const p2wpkhScript = (publicKeyHash: Uint8Array): Uint8Array =>
  concatBytes(Uint8Array.of(WITNESS_V0, PUSH_20), publicKeyHash);

const p2shScript = (scriptHash: Uint8Array): Uint8Array =>
  concatBytes(Uint8Array.of(OP_HASH160, PUSH_20), scriptHash, uint8(OP_EQUAL));

const witnessProgramScriptCode = (publicKeyHash: Uint8Array): Uint8Array => p2pkhScript(publicKeyHash);

export const scriptPubKeyForAddress = (address: string): Uint8Array => {
  const trimmed = (address ?? '').trim();
  if (!trimmed) throw new Error(loc.outflow.payeeDestinationMissing);

  if (trimmed.toLowerCase().startsWith(`${MAINNET_HRP}1`)) {
    const decoded = bech32.decode(trimmed as `${string}1${string}`, 90);
    if (decoded.prefix !== MAINNET_HRP) {
      throw new Error(loc.outflow.destinationFieldMalformed);
    }
    const version = decoded.words[0];
    const program = Uint8Array.from(bech32.fromWords(decoded.words.slice(1)));
    if (version !== WITNESS_V0) {
      throw new Error(loc.outflow.destinationFieldMalformed);
    }
    if (program.length !== 20 && program.length !== 32) {
      throw new Error(loc.outflow.destinationFieldMalformed);
    }
    return concatBytes(Uint8Array.of(WITNESS_V0, program.length), program);
  }

  const decoded = base58Check.decode(trimmed);
  const version = decoded[0];
  const payload = decoded.slice(1);
  if (payload.length !== 20) {
    throw new Error(loc.outflow.destinationFieldMalformed);
  }
  if (version === P2PKH_VERSION) return p2pkhScript(payload);
  if (version === P2SH_VERSION) return p2shScript(payload);
  throw new Error(loc.outflow.destinationFieldMalformed);
};

interface PreparedInput {
  input: SigningInput;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  publicKeyHash: Uint8Array;
  sequence: number;
}

const prepareInput = (input: SigningInput): PreparedInput => {
  const privateKey = fromWIF(input.wif);
  const publicKey = compressedPublicKey(privateKey);
  const publicKeyHash = hash160(publicKey);
  const sequence = input.sequence ?? DEFAULT_SEQUENCE;
  return { input, privateKey, publicKey, publicKeyHash, sequence };
};

const serializeOutputs = (outputs: SigningOutput[]): Uint8Array => {
  const chunks: Uint8Array[] = [];
  for (const output of outputs) {
    if (!Number.isFinite(output.value) || output.value < 0) {
      throw new Error(loc.outflow.malformedValue);
    }
    chunks.push(uint64LE(Math.floor(output.value)));
    chunks.push(varBytes(scriptPubKeyForAddress(output.address)));
  }
  return concatBytes(...chunks);
};

const legacySighash = (
  prepared: PreparedInput[],
  outputs: SigningOutput[],
  index: number,
  locktime: number,
  version: number,
): Uint8Array => {
  const chunks: Uint8Array[] = [];
  chunks.push(uint32LE(version));
  chunks.push(varint(prepared.length));
  for (let i = 0; i < prepared.length; i += 1) {
    const current = prepared[i];
    chunks.push(outpoint(current.input.txid, current.input.vout));
    if (i === index) {
      chunks.push(varBytes(p2pkhScript(current.publicKeyHash)));
    } else {
      chunks.push(varint(0));
    }
    chunks.push(uint32LE(current.sequence));
  }
  chunks.push(varint(outputs.length));
  chunks.push(serializeOutputs(outputs));
  chunks.push(uint32LE(locktime));
  chunks.push(uint32LE(SIGHASH_ALL));
  return doubleSha256(concatBytes(...chunks));
};

const segwitSighash = (
  prepared: PreparedInput[],
  outputs: SigningOutput[],
  index: number,
  locktime: number,
  version: number,
): Uint8Array => {
  const prevouts: Uint8Array[] = [];
  const sequences: Uint8Array[] = [];
  for (const current of prepared) {
    prevouts.push(outpoint(current.input.txid, current.input.vout));
    sequences.push(uint32LE(current.sequence));
  }
  const hashPrevouts = doubleSha256(concatBytes(...prevouts));
  const hashSequence = doubleSha256(concatBytes(...sequences));
  const hashOutputs = doubleSha256(serializeOutputs(outputs));

  const current = prepared[index];
  const scriptCode = witnessProgramScriptCode(current.publicKeyHash);

  const preimage = concatBytes(
    uint32LE(version),
    hashPrevouts,
    hashSequence,
    outpoint(current.input.txid, current.input.vout),
    varBytes(scriptCode),
    uint64LE(Math.floor(current.input.value)),
    uint32LE(current.sequence),
    hashOutputs,
    uint32LE(locktime),
    uint32LE(SIGHASH_ALL),
  );
  return doubleSha256(preimage);
};

const signHash = (hash: Uint8Array, privateKey: Uint8Array): Uint8Array => {
  const der = secp256k1.sign(hash, privateKey, {
    prehash: false,
    lowS: true,
    format: 'der',
  });
  return concatBytes(der, uint8(SIGHASH_ALL));
};

const finalScriptSigForSegwit = (prepared: PreparedInput): Uint8Array => {
  if (prepared.input.scriptType === 'P2SH-P2WPKH') {
    const redeem = p2wpkhScript(prepared.publicKeyHash);
    return varBytes(varBytes(redeem));
  }
  return varint(0);
};

export const buildSignedTransaction = (
  inputs: SigningInput[],
  outputs: SigningOutput[],
  locktime = 0,
): BuiltTransaction => {
  if (!inputs.length) throw new Error(loc.outflow.nothingSpendable);
  if (!outputs.length) throw new Error(loc.outflow.minOnePayeeNeeded);

  const prepared = inputs.map(prepareInput);
  const isSegwit = prepared.some(
    item => item.input.scriptType === 'P2WPKH' || item.input.scriptType === 'P2SH-P2WPKH',
  );

  const scriptSigs: Uint8Array[] = new Array(prepared.length);
  const witnesses: Uint8Array[] = new Array(prepared.length);

  for (let i = 0; i < prepared.length; i += 1) {
    const item = prepared[i];
    const type = item.input.scriptType;

    if (type === 'P2PKH') {
      const hash = legacySighash(prepared, outputs, i, locktime, TX_VERSION);
      const signature = signHash(hash, item.privateKey);
      scriptSigs[i] = varBytes(concatBytes(varBytes(signature), varBytes(item.publicKey)));
      witnesses[i] = varint(0);
    } else {
      const hash = segwitSighash(prepared, outputs, i, locktime, TX_VERSION);
      const signature = signHash(hash, item.privateKey);
      scriptSigs[i] = finalScriptSigForSegwit(item);
      witnesses[i] = concatBytes(varint(2), varBytes(signature), varBytes(item.publicKey));
    }
  }

  for (const item of prepared) {
    item.privateKey.fill(0);
  }

  const serializedOutputs = serializeOutputs(outputs);

  const legacyChunks: Uint8Array[] = [];
  legacyChunks.push(uint32LE(TX_VERSION));
  legacyChunks.push(varint(prepared.length));
  for (let i = 0; i < prepared.length; i += 1) {
    legacyChunks.push(outpoint(prepared[i].input.txid, prepared[i].input.vout));
    legacyChunks.push(scriptSigs[i]);
    legacyChunks.push(uint32LE(prepared[i].sequence));
  }
  legacyChunks.push(varint(outputs.length));
  legacyChunks.push(serializedOutputs);
  legacyChunks.push(uint32LE(locktime));
  const baseSerialization = concatBytes(...legacyChunks);

  const witnessChunks: Uint8Array[] = [];
  witnessChunks.push(uint32LE(TX_VERSION));
  witnessChunks.push(uint8(SEGWIT_MARKER));
  witnessChunks.push(uint8(SEGWIT_FLAG));
  witnessChunks.push(varint(prepared.length));
  for (let i = 0; i < prepared.length; i += 1) {
    witnessChunks.push(outpoint(prepared[i].input.txid, prepared[i].input.vout));
    witnessChunks.push(scriptSigs[i]);
    witnessChunks.push(uint32LE(prepared[i].sequence));
  }
  witnessChunks.push(varint(outputs.length));
  witnessChunks.push(serializedOutputs);
  for (let i = 0; i < prepared.length; i += 1) {
    witnessChunks.push(witnesses[i]);
  }
  witnessChunks.push(uint32LE(locktime));
  const witnessSerialization = concatBytes(...witnessChunks);

  const serialized = isSegwit ? witnessSerialization : baseSerialization;
  const baseSize = baseSerialization.length;
  const totalSize = serialized.length;
  const weight = baseSize * (WITNESS_SCALE_FACTOR - 1) + totalSize;
  const vsize = Math.ceil(weight / WITNESS_SCALE_FACTOR);

  const txid = bytesToHex(reverseBytes(doubleSha256(baseSerialization)));

  return {
    hex: bytesToHex(serialized),
    txid,
    vsize,
    weight,
    isSegwit,
  };
};

export const sighashForInput = (
  inputs: SigningInput[],
  outputs: SigningOutput[],
  index: number,
  locktime = 0,
  version: number = TX_VERSION,
): string => {
  if (index < 0 || index >= inputs.length) {
    throw networkError('requestStatusFault', index);
  }
  const prepared = inputs.map(prepareInput);
  const target = prepared[index];
  const hash =
    target.input.scriptType === 'P2PKH'
      ? legacySighash(prepared, outputs, index, locktime, version)
      : segwitSighash(prepared, outputs, index, locktime, version);
  for (const item of prepared) {
    item.privateKey.fill(0);
  }
  return bytesToHex(hash);
};

export { RBF_SEQUENCE, DEFAULT_SEQUENCE };
