import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import loc from '../i18n';
import { COLORS, SPACING, TYPE } from '../theme';
import { useWallets, enableEncryption, disableEncryption } from '../wallets/context';
import {
  getBiometricType,
  isBiometricsEnabled,
  setBiometricsEnabled,
  unlockWithBiometrics,
} from '../utils/biometrics';
import { triggerSuccessHaptic } from '../utils/haptics';
import type { RootStackParamList } from '../navigation/types';

type SecurityNavigation = NativeStackNavigationProp<RootStackParamList, 'Security'>;

type PendingSwitch = 'biometric' | 'storage' | null;

const TILE_ALPHA = '1F';

const TILE_TINT = {
  biometric: '#FF3B30',
  storage: '#34C759',
  decoy: '#5E5CE6',
} as const;

const withAlpha = (base: string): string => `${base}${TILE_ALPHA}`;

export const SecurityScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<SecurityNavigation>();
  const { wallets, setBioEnabled, setPwdEnabled, pwdEnabled, isRTL } = useWallets();

  const pageBg = isDark ? palette.bg : palette.cardGray;
  const cellBg = isDark ? palette.cardGray : palette.bg;
  const writingDirection: 'rtl' | 'ltr' = isRTL ? 'rtl' : 'ltr';

  const [biometricType, setBiometricType] = useState<string | undefined>(undefined);
  const [biometricOn, setBiometricOn] = useState(false);
  // Reflect the real encryption state so the toggle can't desync (and so a decoy
  // setup / already-encrypted holding isn't shown as "off").
  const [passwordOn, setPasswordOn] = useState(pwdEnabled);

  useEffect(() => {
    setPasswordOn(pwdEnabled);
  }, [pwdEnabled]);
  const [pending, setPending] = useState<PendingSwitch>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const type = await getBiometricType();
      const bioEnabled = await isBiometricsEnabled();
      if (!alive) {
        return;
      }
      setBiometricType(type);
      setBiometricOn(bioEnabled);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setPending(null);
    }, []),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.prefs.safeguard,
      headerLargeTitle: false,
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
      headerBackVisible: true,
      headerTransparent: false,
      headerStyle: { backgroundColor: pageBg },
      headerTintColor: palette.fg,
      headerTitleStyle: {
        fontSize: TYPE.headerTitle.fontSize,
        fontWeight: TYPE.headerTitle.fontWeight,
        color: palette.fg,
      },
    });
  }, [navigation, palette.fg, pageBg]);

  const onBiometricToggle = useCallback(
    async (value: boolean) => {
      if (pending !== null) {
        return;
      }
      setPending('biometric');
      try {
        if (await unlockWithBiometrics()) {
          await setBiometricsEnabled(value);
          setBiometricOn(value);
          setBioEnabled(value);
          triggerSuccessHaptic();
        }
      } finally {
        setPending(null);
      }
    },
    [pending, setBioEnabled],
  );

  const enablePassword = useCallback(() => {
    navigation.navigate('PromptPasswordSheet', {
      mode: 'create',
      onResult: async (password: string) => {
        const ok = await enableEncryption(wallets, password);
        if (ok) {
          setPasswordOn(true);
          setPwdEnabled(true);
        } else {
          Alert.alert('Aura', loc.guard.cipherActivationFailed);
        }
      },
    });
  }, [navigation, wallets, setPwdEnabled]);

  const disablePassword = useCallback(() => {
    Alert.alert(
      loc.prefs.unlockHolding,
      loc.prefs.unlockHoldingQuestion,
      [
        { text: loc.core.dismissAction, style: 'cancel', onPress: () => setPending(null) },
        {
          text: loc.core.acknowledge,
          style: 'destructive',
          onPress: () =>
            navigation.navigate('PromptPasswordSheet', {
              mode: 'enter',
              onResult: async () => {
                await disableEncryption(wallets);
                setPasswordOn(false);
                setPwdEnabled(false);
              },
            }),
        },
      ],
      { cancelable: false },
    );
  }, [navigation, wallets, setPwdEnabled]);

  const onPasswordToggle = useCallback(
    (value: boolean) => {
      if (pending !== null) {
        return;
      }
      setPending('storage');
      if (value) {
        enablePassword();
      } else {
        disablePassword();
      }
    },
    [pending, enablePassword, disablePassword],
  );

  const openDecoySetup = useCallback(() => {
    navigation.navigate('StealthHolding');
  }, [navigation]);

  const titleStyle = useMemo(
    () => [styles.rowTitle, { color: palette.fg, writingDirection }],
    [palette.fg, writingDirection],
  );
  const subtitleStyle = useMemo(
    () => [styles.rowSubtitle, { color: palette.altText, writingDirection }],
    [palette.altText, writingDirection],
  );

  return (
    <ScrollView
      style={{ backgroundColor: pageBg }}
      contentContainerStyle={styles.body}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      {biometricType ? (
        <View style={styles.section}>
          <View style={[styles.row, styles.firstRow, styles.lastRow, { backgroundColor: cellBg }]}>
            <View style={[styles.tile, { backgroundColor: withAlpha(TILE_TINT.biometric) }]}>
              <MaterialIcons
                name={biometricType === 'Face ID' ? 'face' : 'fingerprint'}
                size={20}
                color={TILE_TINT.biometric}
              />
            </View>
            <View style={styles.rowBody}>
              <Text style={titleStyle}>
                {loc.formatString(loc.prefs.applyMethod, { type: biometricType })}
              </Text>
              <Text style={subtitleStyle}>
                {loc.formatString(loc.guard.identityCheckBlurb, { type: biometricType })}
              </Text>
            </View>
            <Switch value={biometricOn} onValueChange={onBiometricToggle} disabled={pending !== null} />
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View
          style={[
            styles.row,
            styles.firstRow,
            { backgroundColor: cellBg },
            passwordOn
              ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.fieldBorder }
              : styles.lastRow,
          ]}>
          <View style={[styles.tile, { backgroundColor: withAlpha(TILE_TINT.storage) }]}>
            <MaterialIcons name="enhanced-encryption" size={20} color={TILE_TINT.storage} />
          </View>
          <View style={styles.rowBody}>
            <Text style={titleStyle}>{loc.prefs.guardedByPasscode}</Text>
            <Text style={subtitleStyle}>{loc.guard.passphraseGateBlurb}</Text>
          </View>
          {pending === 'storage' ? (
            <ActivityIndicator />
          ) : (
            <Switch value={passwordOn} onValueChange={onPasswordToggle} disabled={pending !== null} />
          )}
        </View>

        {passwordOn ? (
          <Pressable
            onPress={openDecoySetup}
            style={({ pressed }) => [
              styles.row,
              styles.lastRow,
              { backgroundColor: cellBg },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.tile, { backgroundColor: withAlpha(TILE_TINT.decoy) }]}>
              <MaterialIcons name="visibility-off" size={20} color={TILE_TINT.decoy} />
            </View>
            <View style={styles.rowBody}>
              <Text style={titleStyle}>{loc.stealthHolding.hiddenAccessHeading}</Text>
              <Text style={subtitleStyle}>{loc.guard.hiddenHoldingBlurb}</Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={palette.altText}
              style={[styles.chevron, { transform: [{ scaleX: isRTL ? -1 : 1 }] }]}
            />
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    overflow: 'hidden',
  },
  firstRow: {
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  lastRow: {
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  pressed: {
    opacity: 0.6,
  },
  tile: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: SPACING.md,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    paddingVertical: 2,
  },
  chevron: {
    opacity: 0.7,
    marginStart: SPACING.sm,
  },
});

export default SecurityScreen;
