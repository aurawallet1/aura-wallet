import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { base58check, base64, bech32 } from '@scure/base';

const base58Check = base58check(sha256);
const textEncoder = new TextEncoder();

const WIF_PREFIX_MAINNET = 0x80;
const WIF_SUFFIX_COMPRESSED = 0x01;
const P2PKH_VERSION = 0x00;
const P2SH_VERSION = 0x05;
const WITNESS_V0 = 0;

const MESSAGE_PREFIX = '\x18Bitcoin Signed Message:\n';
const SIGNATURE_LENGTH = 65;
const HEADER_BASE = 27;
const FLAG_COMPRESSED = 4;
const FLAG_P2SH_P2WPKH = 8;
const FLAG_P2WPKH = 12;

const OP_0 = 0x00;
const PUSH_20 = 0x14;

export type MessageAddressType = 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh';

interface DecodedKey {
  privateKey: Uint8Array;
  compressed: boolean;
}

interface AddressDescriptor {
  type: MessageAddressType;
  programHash: Uint8Array;
}

const doubleSha256 = (bytes: Uint8Array): Uint8Array => sha256(sha256(bytes));

const hash160 = (bytes: Uint8Array): Uint8Array => ripemd160(sha256(bytes));

const equalBytes = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

const compactSize = (length: number): Uint8Array => {
  if (length < 0xfd) {
    return Uint8Array.of(length);
  }
  if (length <= 0xffff) {
    return Uint8Array.of(0xfd, length & 0xff, (length >> 8) & 0xff);
  }
  if (length <= 0xffffffff) {
    return Uint8Array.of(
      0xfe,
      length & 0xff,
      (length >> 8) & 0xff,
      (length >> 16) & 0xff,
      (length >> 24) & 0xff,
    );
  }
  throw new Error('Message is too long to sign');
};

const messageDigest = (message: string): Uint8Array => {
  const prefix = textEncoder.encode(MESSAGE_PREFIX);
  const body = textEncoder.encode(message);
  const size = compactSize(body.length);
  const preimage = new Uint8Array(prefix.length + size.length + body.length);
  preimage.set(prefix, 0);
  preimage.set(size, prefix.length);
  preimage.set(body, prefix.length + size.length);
  return doubleSha256(preimage);
};

const decodePrivateKey = (wif: string): DecodedKey => {
  const decoded = base58Check.decode(wif.trim());
  if (decoded[0] !== WIF_PREFIX_MAINNET) {
    decoded.fill(0);
    throw new Error('Unsupported private key prefix');
  }
  if (decoded.length === 34 && decoded[33] === WIF_SUFFIX_COMPRESSED) {
    const privateKey = decoded.slice(1, 33);
    decoded.fill(0);
    return { privateKey, compressed: true };
  }
  if (decoded.length === 33) {
    const privateKey = decoded.slice(1, 33);
    decoded.fill(0);
    return { privateKey, compressed: false };
  }
  decoded.fill(0);
  throw new Error('Invalid private key length');
};

const describeAddress = (address: string): AddressDescriptor => {
  const trimmed = address.trim();
  if (trimmed.toLowerCase().startsWith('bc1')) {
    const decoded = bech32.decode(trimmed as `${string}1${string}`, 90);
    const version = decoded.words[0];
    const program = Uint8Array.from(bech32.fromWords(decoded.words.slice(1)));
    if (version === WITNESS_V0 && program.length === 20) {
      return { type: 'p2wpkh', programHash: program };
    }
    throw new Error('Unsupported address');
  }
  const decoded = base58Check.decode(trimmed);
  if (decoded[0] === P2PKH_VERSION) {
    return { type: 'p2pkh', programHash: decoded.slice(1) };
  }
  if (decoded[0] === P2SH_VERSION) {
    return { type: 'p2sh-p2wpkh', programHash: decoded.slice(1) };
  }
  throw new Error('Unsupported address');
};

const addressTypeFromString = (address: string): MessageAddressType => {
  const trimmed = address.trim();
  if (trimmed.toLowerCase().startsWith('bc1')) {
    return 'p2wpkh';
  }
  if (trimmed.startsWith('3')) {
    return 'p2sh-p2wpkh';
  }
  return 'p2pkh';
};

const redeemScriptHash = (publicKeyHash: Uint8Array): Uint8Array => {
  const witnessProgram = new Uint8Array(22);
  witnessProgram[0] = OP_0;
  witnessProgram[1] = PUSH_20;
  witnessProgram.set(publicKeyHash, 2);
  return hash160(witnessProgram);
};

export const signMessage = (message: string, wif: string, address: string): string => {
  const addressType = addressTypeFromString(address);
  const { privateKey, compressed } = decodePrivateKey(wif);
  const digest = messageDigest(message);
  const recovered = secp256k1.sign(digest, privateKey, {
    prehash: false,
    lowS: true,
    format: 'recovered',
  });
  privateKey.fill(0);

  const recoveryId = recovered[0];
  const compact = recovered.slice(1);

  let header = HEADER_BASE + recoveryId;
  if (addressType === 'p2sh-p2wpkh') {
    header += FLAG_P2SH_P2WPKH;
  } else if (addressType === 'p2wpkh') {
    header += FLAG_P2WPKH;
  } else if (compressed) {
    header += FLAG_COMPRESSED;
  }

  const output = new Uint8Array(SIGNATURE_LENGTH);
  output[0] = header;
  output.set(compact, 1);
  return base64.encode(output);
};

export const verifyMessage = (message: string, address: string, signature: string): boolean => {
  let raw: Uint8Array;
  try {
    raw = base64.decode(signature.trim());
  } catch {
    return false;
  }
  if (raw.length !== SIGNATURE_LENGTH) {
    return false;
  }

  const flag = raw[0] - HEADER_BASE;
  if (flag < 0 || flag > 15) {
    return false;
  }

  const recoveryId = flag & 3;
  const segwitType: MessageAddressType | null = !(flag & FLAG_P2SH_P2WPKH)
    ? null
    : flag & FLAG_COMPRESSED
      ? 'p2wpkh'
      : 'p2sh-p2wpkh';
  const compressed = (flag & FLAG_P2WPKH) !== 0;

  const recovered = new Uint8Array(SIGNATURE_LENGTH);
  recovered[0] = recoveryId;
  recovered.set(raw.slice(1), 1);

  const digest = messageDigest(message);
  let publicKey: Uint8Array;
  try {
    publicKey = secp256k1.Signature.fromBytes(recovered, 'recovered')
      .recoverPublicKey(digest)
      .toBytes(compressed);
  } catch {
    return false;
  }

  const publicKeyHash = hash160(publicKey);

  let descriptor: AddressDescriptor;
  try {
    descriptor = describeAddress(address);
  } catch {
    return false;
  }

  if (segwitType === 'p2sh-p2wpkh') {
    return descriptor.type === 'p2sh-p2wpkh' && equalBytes(redeemScriptHash(publicKeyHash), descriptor.programHash);
  }
  if (segwitType === 'p2wpkh') {
    return descriptor.type === 'p2wpkh' && equalBytes(publicKeyHash, descriptor.programHash);
  }
  if (descriptor.type === 'p2pkh') {
    return equalBytes(publicKeyHash, descriptor.programHash);
  }
  if (descriptor.type === 'p2sh-p2wpkh') {
    return equalBytes(redeemScriptHash(publicKeyHash), descriptor.programHash);
  }
  if (descriptor.type === 'p2wpkh') {
    return equalBytes(publicKeyHash, descriptor.programHash);
  }
  return false;
};
