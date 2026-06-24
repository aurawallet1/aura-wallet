import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import loc from '../i18n';
import { COLORS, SPACING, TYPE } from '../theme';
import { useWallets } from '../wallets/context';
import type { RootStackParamList } from '../navigation/types';
import { fetchRecommendedFees, type RecommendedFees } from '../network/mempool';
import { triggerSuccessHaptic } from '../utils/haptics';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'NetworkFee'>;

interface FeeTier {
  key: string;
  label: string;
  rate?: number;
}

const PRESET_KEYS = ['fast', 'medium', 'slow'] as const;

const DEFAULT_PREFERENCE = 'fast';

const FOCUS_DELAY_MS = 60;

const PLACEHOLDER_TINT = '#81868e';

const DIGITS_ONLY = /[^\d]/g;

const isPresetPreference = (preference: string): boolean =>
  (PRESET_KEYS as readonly string[]).includes(preference);

const parseRate = (raw: string): number => {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};

const normalizeCustom = (raw: string): string => {
  const value = parseRate(raw);
  return value > 0 ? String(Math.round(value)) : DEFAULT_PREFERENCE;
};

export const NetworkFeeScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<Navigation>();
  const { feePreference, setFeePreference, isRTL } = useWallets();

  const pageBg = isDark ? palette.bg : palette.cardGray;
  const cellBg = isDark ? palette.cardGray : palette.bg;

  const startedAsPreset = useMemo(() => isPresetPreference(feePreference), [feePreference]);

  const [customEnabled, setCustomEnabled] = useState(!startedAsPreset);
  const [customRate, setCustomRate] = useState(startedAsPreset ? '' : feePreference);
  const [fees, setFees] = useState<RecommendedFees | null>(null);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    let active = true;
    fetchRecommendedFees()
      .then((result) => {
        if (active) {
          setFees(result);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const draftRef = useRef({ customEnabled, customRate });
  draftRef.current = { customEnabled, customRate };

  useEffect(
    () => () => {
      const { customEnabled: enabled, customRate: typed } = draftRef.current;
      if (!enabled) {
        return;
      }
      setFeePreference(normalizeCustom(typed));
    },
    [setFeePreference],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.ledger.minerCharge,
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

  const tiers: FeeTier[] = useMemo(
    () => [
      { key: 'fast', label: loc.outflow.priorityHigh, rate: fees?.fastestFee },
      { key: 'medium', label: loc.outflow.priorityMid, rate: fees?.halfHourFee },
      { key: 'slow', label: loc.outflow.priorityLow, rate: fees?.hourFee },
    ],
    [fees],
  );

  const choosePreset = useCallback(
    (key: string) => {
      setCustomEnabled(false);
      setFeePreference(key);
      triggerSuccessHaptic();
    },
    [setFeePreference],
  );

  const toggleCustom = useCallback(
    (value: boolean) => {
      setCustomEnabled(value);
      if (value) {
        setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY_MS);
      } else {
        setFeePreference(DEFAULT_PREFERENCE);
      }
    },
    [setFeePreference],
  );

  const submitCustom = useCallback(() => {
    if (parseRate(customRate) <= 0) {
      Alert.alert(loc.nodeConn.chargeBelowZeroWarning);
      inputRef.current?.focus();
      return;
    }
    setFeePreference(normalizeCustom(customRate));
    Keyboard.dismiss();
    triggerSuccessHaptic();
  }, [customRate, setFeePreference]);

  const onChangeRate = useCallback((value: string) => {
    setCustomRate(value.replace(DIGITS_ONLY, ''));
  }, []);

  const writingDirection = isRTL ? 'rtl' : 'ltr';
  const inputDirection = customRate ? 'ltr' : writingDirection;

  return (
    <ScrollView
      style={{ backgroundColor: pageBg }}
      contentContainerStyle={styles.body}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionHeader, { writingDirection }]}>
        {loc.nodeConn.settlementPaceTitle}
      </Text>
      <View style={styles.section}>
        {tiers.map((tier, index) => {
          const isSelected = !customEnabled && feePreference === tier.key;
          const isFirst = index === 0;
          const isLast = index === tiers.length - 1;
          return (
            <Pressable
              key={tier.key}
              onPress={() => choosePreset(tier.key)}
              disabled={customEnabled}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: cellBg },
                isFirst && styles.rowFirst,
                isLast && styles.rowLast,
                !isLast && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: palette.fieldBorder,
                },
                (pressed || customEnabled) && styles.pressed,
              ]}>
              <Text style={[styles.rowTitle, styles.flex, { color: palette.fg, writingDirection }]}>
                {tier.label}
              </Text>
              {tier.rate != null ? (
                <Text style={[styles.rowValue, { color: palette.altText }]} numberOfLines={1}>
                  {tier.rate} {loc.nodeConn.satPerVbyteUnit}
                </Text>
              ) : null}
              {isSelected ? (
                <MaterialIcons
                  name="check"
                  size={20}
                  color={palette.accentBlue}
                  style={styles.check}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionHeader, { writingDirection }]}>
        {loc.ledger.expertMode}
      </Text>
      <View style={styles.section}>
        <View style={[styles.row, styles.rowFirst, styles.rowLast, { backgroundColor: cellBg }]}>
          <Text style={[styles.rowTitle, styles.flex, { color: palette.fg, writingDirection }]}>
            {loc.nodeConn.manualChargeToggle}
          </Text>
          <Switch value={customEnabled} onValueChange={toggleCustom} style={styles.switch} />
        </View>
        {customEnabled ? (
          <View style={[styles.inputBox, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
            <TextInput
              ref={inputRef}
              value={customRate}
              onChangeText={onChangeRate}
              placeholder={loc.nodeConn.chargeRateHint}
              placeholderTextColor={PLACEHOLDER_TINT}
              style={[styles.input, { color: palette.fg, writingDirection: inputDirection }]}
              keyboardType="number-pad"
              returnKeyType="done"
              underlineColorAndroid="transparent"
              onSubmitEditing={submitCustom}
            />
          </View>
        ) : null}
      </View>

      <Text style={[styles.footnote, { writingDirection }]}>{loc.nodeConn.chargeGuidanceNote}</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingBottom: SPACING.xxl,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '400',
    color: '#9aa0aa',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  section: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    marginHorizontal: SPACING.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    minHeight: 44,
    overflow: 'hidden',
  },
  rowFirst: {
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  rowLast: {
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '400',
    marginStart: SPACING.sm,
  },
  check: {
    marginStart: SPACING.sm,
  },
  switch: {
    marginStart: 16,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    marginVertical: 10,
    marginHorizontal: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  input: {
    flex: 1,
    minHeight: 36,
  },
  footnote: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    color: '#9aa0aa',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
  },
});

export default NetworkFeeScreen;
