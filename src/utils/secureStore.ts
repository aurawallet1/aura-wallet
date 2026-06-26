import * as Keychain from 'react-native-keychain';
import { randomBytes, bytesToHex } from '@noble/hashes/utils.js';

const SERVICE = 'aura.deviceKey';
const ACCOUNT = 'aura';
const KEY_BYTES = 32;

const baseOptions = { service: SERVICE };

const setOptions = (requireBiometrics: boolean) => ({
  service: SERVICE,
  // Require a device passcode to be set — the key won't exist on an unprotected device.
  accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  ...(requireBiometrics
    ? { accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET }
    : {}),
});

const getOptions = (requireBiometrics: boolean) => ({
  service: SERVICE,
  ...(requireBiometrics
    ? { authenticationPrompt: { title: 'Authenticate to unlock your wallet' } }
    : {}),
});

export async function hasDeviceKey(): Promise<boolean> {
  try {
    const stored = await Keychain.getGenericPassword(baseOptions);
    return stored !== false;
  } catch {
    return false;
  }
}

export async function getDeviceKey(requireBiometrics = false): Promise<string | null> {
  try {
    const stored = await Keychain.getGenericPassword(getOptions(requireBiometrics));
    return stored ? stored.password : null;
  } catch {
    return null;
  }
}

export async function ensureDeviceKey(requireBiometrics = false): Promise<string | null> {
  // Read directly so we can tell "no key yet" (returns false) apart from a
  // transient read failure (throws). A failed read must NOT be treated as
  // absent — otherwise we'd overwrite the existing key and permanently lose the
  // only means of decrypting the stored wallets.
  let existing: Awaited<ReturnType<typeof Keychain.getGenericPassword>>;
  try {
    existing = await Keychain.getGenericPassword(getOptions(requireBiometrics));
  } catch {
    return null;
  }
  if (existing && existing.password) {
    return existing.password;
  }
  try {
    const keyHex = bytesToHex(randomBytes(KEY_BYTES));
    await Keychain.setGenericPassword(ACCOUNT, keyHex, setOptions(requireBiometrics));
    return keyHex;
  } catch {
    return null;
  }
}

export async function deleteDeviceKey(): Promise<void> {
  try {
    await Keychain.resetGenericPassword(baseOptions);
  } catch {}
}
