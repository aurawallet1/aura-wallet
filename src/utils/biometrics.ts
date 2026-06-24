import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';

import loc from '../i18n';

const BIOMETRICS_FLAG_KEY = 'aura.biometricsEnabled';
const FLAG_ON = '1';
const FLAG_OFF = '';

const sensor = new ReactNativeBiometrics({ allowDeviceCredentials: false });

const TRANSIENT_ERROR_CODES = /Code=-(2|4|9)\b/;
const CANCEL_TEXT = /cancel/i;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : '';

const isTransientCancellation = (message: string): boolean =>
  TRANSIENT_ERROR_CODES.test(message) || CANCEL_TEXT.test(message);

export async function getBiometricType(): Promise<string | undefined> {
  try {
    const { available, biometryType } = await sensor.isSensorAvailable();
    if (!available) {
      return undefined;
    }
    if (biometryType === BiometryTypes.FaceID) {
      return 'Face ID';
    }
    if (biometryType === BiometryTypes.TouchID) {
      return 'Touch ID';
    }
    return loc.guard.bodySensorLabel;
  } catch {
    return undefined;
  }
}

export async function unlockWithBiometrics(): Promise<boolean> {
  try {
    const { available } = await sensor.isSensorAvailable();
    if (!available) {
      return false;
    }
    const { success } = await sensor.simplePrompt({
      promptMessage: loc.prefs.confirmIdentityPrompt,
    });
    return success === true;
  } catch (error) {
    const message = messageOf(error);
    if (!isTransientCancellation(message)) {
      Alert.alert('Aura', loc.guard.faceUnlockFailed);
    }
    return false;
  }
}

export async function isBiometricsEnabled(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(BIOMETRICS_FLAG_KEY);
    return Boolean(stored);
  } catch {
    return false;
  }
}

export async function setBiometricsEnabled(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(BIOMETRICS_FLAG_KEY, value ? FLAG_ON : FLAG_OFF);
  } catch {}
}
