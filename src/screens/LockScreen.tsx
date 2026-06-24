import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import loc from '../i18n';
import { COLORS, RADIUS, SIZE, SPACING, TYPE } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import {
  decryptHoldingWithPassword,
  useWallets,
} from '../wallets/context';
import { getBiometricType, unlockWithBiometrics } from '../utils/biometrics';
import { triggerErrorHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { StorageKeys, loadString, removeKey } from '../utils/storage';

const BRAND_MARK = require('../../img/logo.png');

const SHAKE_FRAMES = [10, -10, 5, -5, 0];
const SHAKE_DURATION_MS = 100;
const PLACEHOLDER_COLOR = '#81868e';

const directionalText = (rightToLeft: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: rightToLeft ? 'rtl' : 'ltr',
});

export const LockScreenScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const { unlock, bioEnabled, pwdEnabled, applyDecryptedWallets, isRTL } = useWallets();

  const [prompting, setPrompting] = useState(false);
  const [sensorReady, setSensorReady] = useState(false);
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const shakeOffset = useRef(new Animated.Value(0)).current;

  const promptBiometrics = useCallback(async () => {
    if (!bioEnabled) {
      return;
    }
    setPrompting(true);
    const passed = await unlockWithBiometrics();
    setPrompting(false);
    if (passed) {
      triggerSuccessHaptic();
      unlock();
    }
  }, [bioEnabled, unlock]);

  const runShake = useCallback(() => {
    triggerErrorHaptic();
    Animated.sequence(
      SHAKE_FRAMES.map(toValue =>
        Animated.timing(shakeOffset, {
          toValue,
          duration: SHAKE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [shakeOffset]);

  const handleReset = useCallback(async () => {
    await removeKey(StorageKeys.encryptedHolding);
    await removeKey(StorageKeys.holdingEncrypted);
    unlock();
  }, [unlock]);

  const submitPassword = useCallback(async () => {
    if (!password || checking) {
      return;
    }
    Keyboard.dismiss();
    setChecking(true);

    const stored = await loadString(StorageKeys.encryptedHolding);
    if (!stored) {
      setChecking(false);
      Alert.alert('Aura Wallet', loc.guard.holdingReadFailurePrompt, [
        { text: loc.core.dismissAction, style: 'cancel' },
        { text: loc.inflow.startOver, style: 'destructive', onPress: handleReset },
      ]);
      return;
    }

    const opened = await decryptHoldingWithPassword(password);
    setChecking(false);

    if (opened) {
      triggerSuccessHaptic();
      setPassword('');
      applyDecryptedWallets(opened, password);
      unlock();
    } else {
      setPassword('');
      runShake();
    }
  }, [password, checking, handleReset, applyDecryptedWallets, unlock, runShake]);

  useEffect(() => {
    let active = true;
    (async () => {
      const detected = !!(await getBiometricType());
      if (!active) {
        return;
      }
      setSensorReady(detected);
      if (bioEnabled && !pwdEnabled && detected) {
        promptBiometrics();
      }
    })();
    return () => {
      active = false;
    };
  }, [bioEnabled, pwdEnabled, promptBiometrics]);

  void sensorReady;

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Image source={BRAND_MARK} style={styles.mark} resizeMode="contain" />
      </View>

      {pwdEnabled && (
        <View style={styles.passwordBlock}>
          <Text style={[styles.passwordLabel, { color: palette.accentGreen }]}>
            {loc.core.typeSecret}
          </Text>
          <Animated.View style={{ transform: [{ translateX: shakeOffset }] }}>
            <TextInput
              testID="LockPasswordInput"
              secureTextEntry
              placeholder={loc.prefs.passcode}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submitPassword}
              returnKeyType="go"
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              clearButtonMode="while-editing"
              autoFocus
              placeholderTextColor={PLACEHOLDER_COLOR}
              style={[
                styles.input,
                {
                  backgroundColor: palette.inputBg,
                  borderColor: palette.inputBorder,
                  color: palette.fg,
                  writingDirection: password ? 'ltr' : isRTL ? 'rtl' : 'ltr',
                },
              ]}
            />
          </Animated.View>
          <PrimaryButton
            label={loc.core.openHolding}
            color={palette.accentBlue}
            onPress={submitPassword}
            disabled={!password || checking}
            style={styles.unlockButton}
          />
        </View>
      )}

      {bioEnabled && !pwdEnabled && (
        <Pressable
          onPress={promptBiometrics}
          hitSlop={SIZE.closeHit}
          style={styles.retry}
          disabled={prompting}>
          <MaterialIcons name="lock" size={28} color={palette.fg} />
          <Text
            style={[styles.retryLabel, { color: palette.fg }, directionalText(isRTL)]}>
            {loc.lockGate.touchToReveal}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  body: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.huge,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.huge,
  },
  mark: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.card,
  },
  passwordBlock: {
    width: '100%',
    alignItems: 'stretch',
  },
  passwordLabel: {
    ...TYPE.caption,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  input: {
    height: SIZE.buttonHeight,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: SPACING.lg,
    ...TYPE.toggle,
  },
  unlockButton: {
    marginTop: SPACING.lg,
  },
  retry: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  retryLabel: {
    ...TYPE.toggle,
    marginTop: SPACING.sm,
  },
});

export default LockScreenScreen;
