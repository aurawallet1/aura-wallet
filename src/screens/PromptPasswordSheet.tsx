import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  I18nManager,
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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { COLORS, SIZE, TYPE } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { useWallets, createDecoyHolding, decryptHoldingWithPassword, isPasswordInUse } from '../wallets/context';
import { triggerErrorHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { PrimaryButton } from '../components/PrimaryButton';
import loc from '../i18n';

type PromptPasswordNavigation = NativeStackNavigationProp<RootStackParamList, 'PromptPasswordSheet'>;
type PromptPasswordRoute = RouteProp<RootStackParamList, 'PromptPasswordSheet'>;

const ALERT_TITLE = 'Aura';
const PLACEHOLDER_COLOR = '#81868e';
const EXPLAIN_LIGHT_FG = '#2f5fb3';
const SHAKE_KEYFRAMES = [10, -10, 5, -5, 0];
const SHAKE_STEP_MS = 100;
const EXPLAIN_FADE_MS = 240;

const PromptPasswordSheetScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;

  const navigation = useNavigation<PromptPasswordNavigation>();
  const route = useRoute<PromptPasswordRoute>();
  const { mode, onResult } = route.params;

  const { applyDecryptedWallets } = useWallets();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(mode === 'create');

  const shake = useRef(new Animated.Value(0)).current;
  const explanationOpacity = useRef(new Animated.Value(1)).current;

  const isTwoField = mode === 'create' || mode === 'create_fake';
  const rtl = I18nManager.isRTL;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.prefs.passcode,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: palette.elevated },
      contentStyle: { backgroundColor: palette.elevated },
      headerTintColor: palette.fg,
      headerTitleStyle: {
        fontSize: TYPE.headerTitle.fontSize,
        fontWeight: TYPE.headerTitle.fontWeight,
        color: palette.fg,
      },
      headerRight: () => (
        <Pressable onPress={() => navigation.goBack()} hitSlop={SIZE.closeHit} style={styles.headerClose}>
          <MaterialIcons name="close" size={22} color={palette.fg} />
        </Pressable>
      ),
    });
  }, [navigation, palette.elevated, palette.fg]);

  const runShake = useCallback((): void => {
    triggerErrorHaptic();
    Animated.sequence(
      SHAKE_KEYFRAMES.map(value =>
        Animated.timing(shake, {
          toValue: value,
          duration: SHAKE_STEP_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [shake]);

  const acknowledgeExplanation = useCallback((): void => {
    Animated.timing(explanationOpacity, {
      toValue: 0,
      duration: EXPLAIN_FADE_MS,
      useNativeDriver: true,
    }).start(() => {
      setShowExplanation(false);
      explanationOpacity.setValue(1);
    });
  }, [explanationOpacity]);

  const goToWalletsList = useCallback((): void => {
    navigation.reset({ index: 0, routes: [{ name: 'WalletsList' }] });
  }, [navigation]);

  const submit = useCallback(async (): Promise<void> => {
    Keyboard.dismiss();
    const incomplete = isTwoField ? !password || password !== confirmPassword : !password;
    if (incomplete) {
      runShake();
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'create') {
        triggerSuccessHaptic();
        onResult(password);
        navigation.goBack();
        return;
      }

      if (mode === 'enter') {
        const opened = await decryptHoldingWithPassword(password);
        if (opened !== false) {
          triggerSuccessHaptic();
          onResult(password);
          goToWalletsList();
        } else {
          triggerErrorHaptic();
          Alert.alert(ALERT_TITLE, loc.pwPrompt.wrongSecretRetry);
        }
        return;
      }

      const alreadyTaken = await isPasswordInUse(password);
      if (alreadyTaken) {
        triggerErrorHaptic();
        Alert.alert(ALERT_TITLE, loc.stealthHolding.duplicatePassphraseWarning);
        return;
      }
      const created = await createDecoyHolding(password);
      if (created) {
        applyDecryptedWallets([], password);
        triggerSuccessHaptic();
        goToWalletsList();
      } else {
        triggerErrorHaptic();
        Alert.alert(ALERT_TITLE, loc.decoyMode.holdingSetupError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [applyDecryptedWallets, confirmPassword, goToWalletsList, isTwoField, mode, navigation, onResult, password, runShake]);

  const heading = useMemo(() => {
    if (mode === 'create') {
      return loc.prefs.passcodeHint;
    }
    if (mode === 'create_fake') {
      return loc.pwPrompt.decoyHoldingKeyGuidance;
    }
    return loc.core.typeSecret;
  }, [mode]);

  const explainFg = isDark ? palette.fg : EXPLAIN_LIGHT_FG;
  const showCreateExplanation = mode === 'create' && showExplanation;
  const submitDisabled = isLoading || !password || (mode === 'create' && !confirmPassword);

  const inputStyle = {
    backgroundColor: palette.inputBg,
    borderColor: palette.inputBorder,
    color: palette.fg,
  };

  return (
    <ScrollView
      style={{ backgroundColor: palette.elevated }}
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        {showCreateExplanation ? (
          <Animated.View style={{ opacity: explanationOpacity }}>
            <Text style={[styles.label, { color: palette.accentGreen }]}>
              {loc.prefs.enableHoldingLockHeading}
            </Text>
            <Text style={[styles.desc, { color: explainFg }]} maxFontSizeMultiplier={1.2}>
              {loc.prefs.holdingLockIntroPara}
            </Text>
            <Text style={[styles.desc, { color: explainFg }]} maxFontSizeMultiplier={1.2}>
              {loc.prefs.holdingLockCaveatPara}
            </Text>
            <View style={styles.spacer} />
          </Animated.View>
        ) : (
          <>
            <Text adjustsFontSizeToFit style={[styles.label, { color: palette.accentGreen }]}>
              {heading}
            </Text>
            <View style={styles.inputContainer}>
              <Animated.View style={{ transform: [{ translateX: shake }] }}>
                <TextInput
                  testID="PasswordInput"
                  secureTextEntry
                  placeholder={loc.prefs.passcode}
                  value={password}
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect={false}
                  onChangeText={setPassword}
                  clearTextOnFocus
                  clearButtonMode="while-editing"
                  autoFocus
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  style={[styles.input, inputStyle, { writingDirection: password ? 'ltr' : rtl ? 'rtl' : 'ltr' }]}
                />
              </Animated.View>
              {isTwoField ? (
                <Animated.View style={{ transform: [{ translateX: shake }] }}>
                  <TextInput
                    testID="ConfirmPasswordInput"
                    secureTextEntry
                    placeholder={loc.pwPrompt.reenterSecretField}
                    value={confirmPassword}
                    autoCapitalize="none"
                    autoComplete="off"
                    autoCorrect={false}
                    onChangeText={setConfirmPassword}
                    clearTextOnFocus
                    clearButtonMode="while-editing"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    style={[styles.input, inputStyle, { writingDirection: confirmPassword ? 'ltr' : rtl ? 'rtl' : 'ltr' }]}
                  />
                </Animated.View>
              ) : null}
            </View>
          </>
        )}
      </View>
      <View style={styles.footer}>
        {showCreateExplanation ? (
          <PrimaryButton
            label={loc.prefs.acknowledged}
            color={palette.accentBlue}
            onPress={acknowledgeExplanation}
            disabled={isLoading}
            style={styles.sheetButton}
          />
        ) : (
          <PrimaryButton
            label={loc.core.acknowledge}
            color={palette.accentBlue}
            onPress={submit}
            disabled={submitDisabled}
            style={styles.sheetButton}
          />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  headerClose: {
    paddingHorizontal: 4,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 120,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 24,
  },
  desc: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    marginBottom: 12,
  },
  spacer: {
    height: 8,
  },
  inputContainer: {
    gap: 12,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  footer: {
    marginTop: 24,
  },
  sheetButton: {
    alignSelf: 'stretch',
  },
});

export default PromptPasswordSheetScreen;
export { PromptPasswordSheetScreen };
