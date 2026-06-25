import CryptoJS from 'crypto-js';
import { argon2id } from '@noble/hashes/argon2.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes, hexToBytes } from '@noble/hashes/utils.js';
import type { ScriptType } from '../types/index';

export type { ScriptType };

const ENVELOPE_TAG = 'awenc';
const LEGACY_VERSION = 1;
const CURRENT_VERSION = 2;
const SALT_BYTES = 16;
const IV_BYTES = 16;
const CIPHER_KEY_BYTES = 32;
const MAC_KEY_BYTES = 32;
const DERIVED_BYTES = CIPHER_KEY_BYTES + MAC_KEY_BYTES;
const WORD_BYTES = 4;
const ARGON2_TIME = 3;
const ARGON2_MEMORY = 19456;
const ARGON2_PARALLELISM = 1;
const ARGON2_MAX_TIME = 10;
const ARGON2_MAX_MEMORY = 65536;
const ARGON2_MAX_PARALLELISM = 4;
const HKDF_INFO = 'aura/holding/hkdf/v2';
const KDF_ARGON2 = 'argon2id';
const KDF_HKDF = 'hkdf-sha256';
const LEGACY_PBKDF2_ROUNDS = 200000;
const LEGACY_PBKDF2_ROUNDS_MAX = 1000000;
const MAX_PAYLOAD_BYTES = 0x7fffffff;
const TAG_PATTERN = /^[a-z]{2,16}$/;

const textEncoder = new TextEncoder();

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class IntegrityError extends EncryptionError {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityError';
  }
}

interface StorageEnvelope {
  tag: string;
  version: number;
  kdf?: string;
  rounds?: number;
  t?: number;
  m?: number;
  p?: number;
  salt: string;
  iv: string;
  body: string;
  mac: string;
}

interface DerivedKeys {
  cipherKey: CryptoJS.lib.WordArray;
  macKey: CryptoJS.lib.WordArray;
}

const requireSecret = (secret: string): void => {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new EncryptionError('a non-empty secret is required');
  }
};

const toBase64 = (words: CryptoJS.lib.WordArray): string =>
  CryptoJS.enc.Base64.stringify(words);

const fromBase64 = (text: string): CryptoJS.lib.WordArray => {
  if (typeof text !== 'string' || text.length === 0) {
    throw new EncryptionError('expected a base64-encoded field');
  }
  return CryptoJS.enc.Base64.parse(text);
};

const bytesToWordArray = (bytes: Uint8Array): CryptoJS.lib.WordArray => {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
};

const wordArrayToBytes = (words: CryptoJS.lib.WordArray): Uint8Array => {
  const { words: data, sigBytes } = words;
  const out = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i += 1) {
    out[i] = (data[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return out;
};

const splitDerived = (material: Uint8Array): DerivedKeys => ({
  cipherKey: bytesToWordArray(material.slice(0, CIPHER_KEY_BYTES)),
  macKey: bytesToWordArray(material.slice(CIPHER_KEY_BYTES, DERIVED_BYTES)),
});

const deriveArgon2 = (
  passphrase: string,
  salt: Uint8Array,
  t: number,
  m: number,
  p: number,
): DerivedKeys => {
  // Reject out-of-range KDF params (a tampered envelope must not be able to
  // request unbounded memory/time and hang the app).
  if (
    !Number.isInteger(t) || t < 1 || t > ARGON2_MAX_TIME ||
    !Number.isInteger(m) || m < 1 || m > ARGON2_MAX_MEMORY ||
    !Number.isInteger(p) || p < 1 || p > ARGON2_MAX_PARALLELISM
  ) {
    throw new EncryptionError('argon2 parameters out of range');
  }
  return splitDerived(
    argon2id(textEncoder.encode(passphrase), salt, { t, m, p, dkLen: DERIVED_BYTES }),
  );
};

const deriveHkdf = (keyHex: string, salt: Uint8Array): DerivedKeys =>
  splitDerived(
    hkdf(sha256, hexToBytes(keyHex), salt, textEncoder.encode(HKDF_INFO), DERIVED_BYTES),
  );

const deriveLegacyPbkdf2 = (
  passphrase: string,
  salt: CryptoJS.lib.WordArray,
  rounds: number,
): DerivedKeys => {
  const block = CryptoJS.PBKDF2(passphrase, salt, {
    keySize: DERIVED_BYTES / WORD_BYTES,
    iterations: rounds,
    hasher: CryptoJS.algo.SHA256,
  });
  return {
    cipherKey: CryptoJS.lib.WordArray.create(
      block.words.slice(0, CIPHER_KEY_BYTES / WORD_BYTES),
      CIPHER_KEY_BYTES,
    ),
    macKey: CryptoJS.lib.WordArray.create(
      block.words.slice(CIPHER_KEY_BYTES / WORD_BYTES, DERIVED_BYTES / WORD_BYTES),
      MAC_KEY_BYTES,
    ),
  };
};

const authInput = (envelope: Omit<StorageEnvelope, 'mac'>): string => {
  if (envelope.version === LEGACY_VERSION) {
    return `${ENVELOPE_TAG}:${envelope.version}:${envelope.salt}:${envelope.iv}:${envelope.body}`;
  }
  return [
    ENVELOPE_TAG,
    envelope.version,
    envelope.kdf ?? '',
    envelope.t ?? '',
    envelope.m ?? '',
    envelope.p ?? '',
    envelope.salt,
    envelope.iv,
    envelope.body,
  ].join(':');
};

const computeTag = (
  macKey: CryptoJS.lib.WordArray,
  envelope: Omit<StorageEnvelope, 'mac'>,
): string =>
  CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(authInput(envelope), macKey));

const tagsMatch = (left: string, right: string): boolean => {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  if (left.length !== right.length) return false;
  let drift = 0;
  for (let i = 0; i < left.length; i += 1) {
    drift |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return drift === 0;
};

const sealPayload = (
  plaintext: string,
  keys: DerivedKeys,
  saltBytes: Uint8Array,
  ivBytes: Uint8Array,
  header: { kdf: string; t?: number; m?: number; p?: number },
): string => {
  if (typeof plaintext !== 'string') {
    throw new EncryptionError('plaintext must be provided as a string');
  }
  if (plaintext.length > MAX_PAYLOAD_BYTES) {
    throw new EncryptionError('plaintext exceeds the supported size');
  }
  const iv = bytesToWordArray(ivBytes);
  let cipher: CryptoJS.lib.CipherParams;
  try {
    cipher = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(plaintext), keys.cipherKey, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
  } catch (cause) {
    throw new EncryptionError(`unable to seal payload: ${describeCause(cause)}`);
  }
  const base: Omit<StorageEnvelope, 'mac'> = {
    tag: ENVELOPE_TAG,
    version: CURRENT_VERSION,
    kdf: header.kdf,
    t: header.t,
    m: header.m,
    p: header.p,
    salt: toBase64(bytesToWordArray(saltBytes)),
    iv: toBase64(iv),
    body: toBase64(cipher.ciphertext),
  };
  return JSON.stringify({ ...base, mac: computeTag(keys.macKey, base) });
};

export function encryptBlob(plaintext: string, passphrase: string): string {
  requireSecret(passphrase);
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const keys = deriveArgon2(passphrase, salt, ARGON2_TIME, ARGON2_MEMORY, ARGON2_PARALLELISM);
  return sealPayload(plaintext, keys, salt, iv, {
    kdf: KDF_ARGON2,
    t: ARGON2_TIME,
    m: ARGON2_MEMORY,
    p: ARGON2_PARALLELISM,
  });
}

export function sealWithKey(plaintext: string, keyHex: string): string {
  requireSecret(keyHex);
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const keys = deriveHkdf(keyHex, salt);
  return sealPayload(plaintext, keys, salt, iv, { kdf: KDF_HKDF });
}

const deriveForEnvelope = (envelope: StorageEnvelope, secret: string): DerivedKeys => {
  const saltWords = fromBase64(envelope.salt);
  if (envelope.version === LEGACY_VERSION) {
    // Clamp the stored iteration count so a tampered envelope can't pin a huge
    // value and hang the app (no real envelope ever exceeds the default).
    const rounds = Math.min(
      LEGACY_PBKDF2_ROUNDS_MAX,
      Math.max(1, envelope.rounds ?? LEGACY_PBKDF2_ROUNDS),
    );
    return deriveLegacyPbkdf2(secret, saltWords, rounds);
  }
  const saltBytes = wordArrayToBytes(saltWords);
  if (envelope.kdf === KDF_HKDF) {
    return deriveHkdf(secret, saltBytes);
  }
  if (envelope.kdf === KDF_ARGON2) {
    return deriveArgon2(
      secret,
      saltBytes,
      envelope.t ?? ARGON2_TIME,
      envelope.m ?? ARGON2_MEMORY,
      envelope.p ?? ARGON2_PARALLELISM,
    );
  }
  throw new EncryptionError('unsupported key derivation');
};

export function decryptBlob(payload: string, secret: string): string {
  requireSecret(secret);
  const envelope = parseEnvelope(payload);
  const keys = deriveForEnvelope(envelope, secret);
  const { mac, ...unsigned } = envelope;
  if (!tagsMatch(computeTag(keys.macKey, unsigned), mac)) {
    throw new IntegrityError(
      'authentication tag mismatch — wrong secret or altered data',
    );
  }

  let recovered: CryptoJS.lib.WordArray;
  try {
    recovered = CryptoJS.AES.decrypt(
      CryptoJS.lib.CipherParams.create({ ciphertext: fromBase64(envelope.body) }),
      keys.cipherKey,
      { iv: fromBase64(envelope.iv), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 },
    );
  } catch (cause) {
    throw new IntegrityError(`payload could not be opened: ${describeCause(cause)}`);
  }

  let text: string;
  try {
    text = CryptoJS.enc.Utf8.stringify(recovered);
  } catch {
    throw new IntegrityError('recovered bytes are not valid text');
  }
  if (text.length === 0 && recovered.sigBytes > 0) {
    throw new IntegrityError('recovered bytes are not valid text');
  }
  return text;
}

export function storageIsEncrypted(stored: unknown): boolean {
  if (typeof stored !== 'string' || stored.length === 0) return false;
  const trimmed = stored.trim();
  if (trimmed.charCodeAt(0) !== 0x7b) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return false;
  }
  if (parsed === null || typeof parsed !== 'object') return false;

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.tag !== 'string' || !TAG_PATTERN.test(candidate.tag)) return false;
  if (candidate.tag !== ENVELOPE_TAG) return false;
  if (typeof candidate.version !== 'number' || candidate.version < 1) return false;

  const fieldsPresent =
    typeof candidate.salt === 'string' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.body === 'string' &&
    typeof candidate.mac === 'string' &&
    candidate.salt.length > 0 &&
    candidate.iv.length > 0 &&
    candidate.body.length > 0 &&
    candidate.mac.length > 0;
  if (!fieldsPresent) return false;

  if (candidate.version === LEGACY_VERSION) {
    return typeof candidate.rounds === 'number' && candidate.rounds >= 1;
  }
  return candidate.kdf === KDF_ARGON2 || candidate.kdf === KDF_HKDF;
}

function parseEnvelope(payload: string): StorageEnvelope {
  if (typeof payload !== 'string' || payload.length === 0) {
    throw new EncryptionError('nothing to decrypt');
  }
  if (!storageIsEncrypted(payload)) {
    throw new EncryptionError('input is not a recognized encrypted envelope');
  }
  return JSON.parse(payload) as StorageEnvelope;
}

function describeCause(cause: unknown): string {
  if (cause instanceof Error && cause.message) return cause.message;
  if (typeof cause === 'string' && cause) return cause;
  return 'unknown failure';
}
