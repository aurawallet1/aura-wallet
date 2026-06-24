import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { sha512 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { bech32, base58check } from "@scure/base";
import { mnemonicToSeedSync } from "@scure/bip39";
import type { ScriptType } from "../types/index";
import { HARDENED } from "../constants/bitcoin";

const CURVE_ORDER = secp256k1.Point.Fn.ORDER;

const textEncoder = new TextEncoder();

const MASTER_SEED_KEY = textEncoder.encode("Bitcoin seed");

const base58Check = base58check(sha256);

const WIF_PREFIX_MAINNET = 0x80;
const WIF_SUFFIX_COMPRESSED = 0x01;

const P2PKH_VERSION_MAINNET = 0x00;
const P2SH_VERSION_MAINNET = 0x05;

const BECH32_HRP_MAINNET = "bc";
const SEGWIT_V0 = 0;

export interface HDNode {
  privateKey: Uint8Array;
  chainCode: Uint8Array;
}

const concatBytes = (...chunks: Uint8Array[]): Uint8Array => {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

const serializeUint32BE = (value: number): Uint8Array =>
  Uint8Array.of(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  );

const bytesToBigIntBE = (bytes: Uint8Array): bigint => {
  let result = 0n;
  for (const byte of bytes) result = (result << 8n) | BigInt(byte);
  return result;
};

const bigIntToBytes32BE = (value: bigint): Uint8Array => {
  const out = new Uint8Array(32);
  let remaining = value;
  for (let i = 31; i >= 0; i -= 1) {
    out[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return out;
};

export const hash160 = (bytes: Uint8Array): Uint8Array =>
  ripemd160(sha256(bytes));

export const compressedPublicKey = (privateKey: Uint8Array): Uint8Array =>
  secp256k1.getPublicKey(privateKey, true);

export const masterNode = (seed: Uint8Array): HDNode => {
  const digest = hmac(sha512, MASTER_SEED_KEY, seed);
  return {
    privateKey: digest.slice(0, 32),
    chainCode: digest.slice(32),
  };
};

export const deriveChild = (node: HDNode, index: number): HDNode => {
  const isHardened = index >= HARDENED;
  const data = isHardened
    ? concatBytes(Uint8Array.of(0x00), node.privateKey, serializeUint32BE(index))
    : concatBytes(compressedPublicKey(node.privateKey), serializeUint32BE(index));
  const digest = hmac(sha512, node.chainCode, data);
  const leftScalar = bytesToBigIntBE(digest.slice(0, 32));
  if (leftScalar >= CURVE_ORDER) {
    throw new Error("derived scalar out of range");
  }
  const childScalar = (leftScalar + bytesToBigIntBE(node.privateKey)) % CURVE_ORDER;
  if (childScalar === 0n) {
    throw new Error("derived scalar is zero");
  }
  return {
    privateKey: bigIntToBytes32BE(childScalar),
    chainCode: digest.slice(32),
  };
};

const parsePathSegment = (segment: string): number => {
  const isHardened = /['hH]$/.test(segment);
  const numericPart = isHardened ? segment.slice(0, -1) : segment;
  const value = Number.parseInt(numericPart, 10);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`invalid path segment: ${segment}`);
  }
  return isHardened ? value + HARDENED : value;
};

export const derivePath = (seed: Uint8Array, path: string): HDNode => {
  const segments = path.split("/");
  if (segments[0] !== "m" && segments[0] !== "M") {
    throw new Error("derivation path must start with m");
  }
  let node = masterNode(seed);
  for (const segment of segments.slice(1)) {
    if (segment.length === 0) continue;
    node = deriveChild(node, parsePathSegment(segment));
  }
  return node;
};

export const encodeP2PKH = (privateKey: Uint8Array): string =>
  base58Check.encode(
    concatBytes(
      Uint8Array.of(P2PKH_VERSION_MAINNET),
      hash160(compressedPublicKey(privateKey)),
    ),
  );

export const encodeP2WPKH = (privateKey: Uint8Array): string => {
  const program = hash160(compressedPublicKey(privateKey));
  return bech32.encode(BECH32_HRP_MAINNET, [
    SEGWIT_V0,
    ...bech32.toWords(program),
  ]);
};

export const encodeP2SHP2WPKH = (privateKey: Uint8Array): string => {
  const witnessProgram = hash160(compressedPublicKey(privateKey));
  const redeemScript = concatBytes(
    Uint8Array.of(SEGWIT_V0, witnessProgram.length),
    witnessProgram,
  );
  return base58Check.encode(
    concatBytes(Uint8Array.of(P2SH_VERSION_MAINNET), hash160(redeemScript)),
  );
};

export const toWIF = (privateKey: Uint8Array): string =>
  base58Check.encode(
    concatBytes(
      Uint8Array.of(WIF_PREFIX_MAINNET),
      privateKey,
      Uint8Array.of(WIF_SUFFIX_COMPRESSED),
    ),
  );

export const fromWIF = (wif: string): Uint8Array => {
  const decoded = base58Check.decode(wif);
  if (decoded[0] !== WIF_PREFIX_MAINNET) {
    throw new Error("unsupported WIF prefix");
  }
  return decoded.slice(1, 33);
};

export type AddressEncoder = (privateKey: Uint8Array) => string;

export const PURPOSE_BY_SCRIPT_TYPE: Record<ScriptType, 44 | 49 | 84> = {
  BIP44: 44,
  BIP49: 49,
  BIP84: 84,
};

export const ADDRESS_ENCODERS: Record<ScriptType, AddressEncoder> = {
  BIP44: encodeP2PKH,
  BIP49: encodeP2SHP2WPKH,
  BIP84: encodeP2WPKH,
};

export const encodeAddress = (
  scriptType: ScriptType,
  privateKey: Uint8Array,
): string => ADDRESS_ENCODERS[scriptType](privateKey);

export const accountBasePath = (
  scriptType: ScriptType,
  account = 0,
  coinType = 0,
): string => `m/${PURPOSE_BY_SCRIPT_TYPE[scriptType]}'/${coinType}'/${account}'`;

export const addressPath = (
  scriptType: ScriptType,
  change: 0 | 1,
  index: number,
  account = 0,
  coinType = 0,
): string =>
  `${accountBasePath(scriptType, account, coinType)}/${change}/${index}`;

export const deriveAddressNode = (
  seed: Uint8Array,
  scriptType: ScriptType,
  change: 0 | 1,
  index: number,
  account = 0,
  coinType = 0,
): HDNode =>
  derivePath(seed, addressPath(scriptType, change, index, account, coinType));

export const firstReceiveAddress = (
  mnemonic: string,
  passphrase = "",
  scriptType: ScriptType = "BIP84",
): string => {
  const seed = mnemonicToSeedSync(mnemonic, passphrase);
  const node = deriveAddressNode(seed, scriptType, 0, 0);
  const address = encodeAddress(scriptType, node.privateKey);
  seed.fill(0);
  node.privateKey.fill(0);
  return address;
};

const EXTENDED_KEY_VERSION: Record<ScriptType, number> = {
  BIP44: 0x0488b21e,
  BIP49: 0x049d7cb2,
  BIP84: 0x04b24746,
};

export const accountExtendedPublicKey = (
  mnemonic: string,
  passphrase = "",
  scriptType: ScriptType = "BIP84",
  account = 0,
  coinType = 0,
): string => {
  const seed = mnemonicToSeedSync(mnemonic, passphrase);
  const purpose = PURPOSE_BY_SCRIPT_TYPE[scriptType];
  const parent = derivePath(seed, `m/${purpose}'/${coinType}'`);
  const childNumber = (account + HARDENED) >>> 0;
  const accountNode = deriveChild(parent, childNumber);
  const fingerprint = hash160(compressedPublicKey(parent.privateKey)).slice(0, 4);
  const payload = concatBytes(
    serializeUint32BE(EXTENDED_KEY_VERSION[scriptType]),
    Uint8Array.of(3),
    fingerprint,
    serializeUint32BE(childNumber),
    accountNode.chainCode,
    compressedPublicKey(accountNode.privateKey),
  );
  const extendedKey = base58Check.encode(payload);
  seed.fill(0);
  parent.privateKey.fill(0);
  accountNode.privateKey.fill(0);
  return extendedKey;
};

export interface DerivedAddress {
  index: number;
  change: 0 | 1;
  path: string;
  address: string;
}

export const listAddresses = (
  mnemonic: string,
  passphrase = "",
  scriptType: ScriptType = "BIP84",
  change: 0 | 1 = 0,
  count = 20,
  account = 0,
  coinType = 0,
): DerivedAddress[] => {
  const seed = mnemonicToSeedSync(mnemonic, passphrase);
  const result: DerivedAddress[] = [];
  for (let index = 0; index < count; index += 1) {
    const node = deriveAddressNode(seed, scriptType, change, index, account, coinType);
    result.push({
      index,
      change,
      path: addressPath(scriptType, change, index, account, coinType),
      address: encodeAddress(scriptType, node.privateKey),
    });
    node.privateKey.fill(0);
  }
  seed.fill(0);
  return result;
};
