import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

type HapticPattern =
  | 'impactLight'
  | 'impactMedium'
  | 'impactHeavy'
  | 'notificationSuccess'
  | 'notificationError'
  | 'notificationWarning'
  | 'selection';

const FEEDBACK_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
} as const;

let enabled = true;

const fire = (pattern: HapticPattern): void => {
  if (!enabled) {
    return;
  }
  try {
    ReactNativeHapticFeedback.trigger(pattern, FEEDBACK_OPTIONS);
  } catch {}
};

export function setHapticsOn(value: boolean): void {
  enabled = value === true;
}

export function triggerHaptic(): void {
  fire('selection');
}

export function triggerSuccessHaptic(): void {
  fire('notificationSuccess');
}

export function triggerErrorHaptic(): void {
  fire('notificationError');
}
