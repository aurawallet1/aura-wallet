/**
 * Notification permission + device push token.
 *
 * The actual token comes from the OS push system, so it needs a native build with
 * push configured:
 *   - iOS: @react-native-community/push-notification-ios (added as a dependency) +
 *     the Push Notifications capability and an APNs key on your Apple account.
 *   - Android: add @react-native-firebase/messaging + a google-services.json, then
 *     fill in androidToken() below. Until then Android fails with a clear error.
 *
 * Every native call is guarded so the JS bundle stays safe even before the native
 * side is linked — a missing/unlinked module surfaces as PushUnavailableError, which
 * the Alerts screen turns into a readable message rather than a crash.
 */
import { Platform } from 'react-native';
import type { PushPlatform } from '../network/alerts';

const TOKEN_TIMEOUT_MS = 15_000;

export class PushUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'PushUnavailableError';
  }
}

export function currentPlatform(): PushPlatform {
  return Platform.OS === 'android' ? 'android' : 'ios';
}

function loadIOSPush(): any {
  try {
    // Static literal so Metro bundles it; the try/catch guards an unlinked native side.
    const mod = require('@react-native-community/push-notification-ios');
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

async function iosToken(): Promise<string> {
  const PushNotificationIOS = loadIOSPush();
  if (!PushNotificationIOS || typeof PushNotificationIOS.requestPermissions !== 'function') {
    throw new PushUnavailableError('ios-push-module-missing');
  }
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      PushNotificationIOS.removeEventListener('register');
      PushNotificationIOS.removeEventListener('registrationError');
    };
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new PushUnavailableError('ios-token-timeout'));
      }
    }, TOKEN_TIMEOUT_MS);
    PushNotificationIOS.addEventListener('register', (token: string) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        cleanup();
        if (token) {
          resolve(token);
        } else {
          reject(new PushUnavailableError('ios-token-empty'));
        }
      }
    });
    PushNotificationIOS.addEventListener('registrationError', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        cleanup();
        reject(new PushUnavailableError('ios-registration-error'));
      }
    });
    // Request permission only after the listeners are attached, so the register
    // event can't fire before we're listening for it.
    PushNotificationIOS.requestPermissions().catch(() => {});
  });
}

async function androidToken(): Promise<string> {
  // Android delivery requires FCM. Add @react-native-firebase/messaging + a
  // google-services.json, then retrieve the token here, e.g.:
  //   const messaging = require('@react-native-firebase/messaging').default;
  //   await messaging().registerDeviceForRemoteMessages();
  //   return messaging().getToken();
  throw new PushUnavailableError('android-fcm-required');
}

/** Request permission and resolve the OS push token, or throw PushUnavailableError. */
export async function acquireDeviceToken(): Promise<string> {
  return currentPlatform() === 'android' ? androidToken() : iosToken();
}
