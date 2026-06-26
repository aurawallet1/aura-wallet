import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type PressableStateCallbackType,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { COLORS, RADIUS, SIZE, SPACING, type ColorScheme } from '../theme';
import loc from '../i18n';
import FeeOptionRow from '../components/FeeOptionRow';
import { fetchRecommendedFees } from '../network/mempool';
import { formatBtcTrim } from '../utils/currency';
import { useWallets } from '../wallets/context';
import type { SendStackParamList } from '../navigation/types';

type SelectFeeNavigation = NativeStackNavigationProp<SendStackParamList, 'SelectFeeSheet'>;
type SelectFeeRoute = RouteProp<SendStackParamList, 'SelectFeeSheet'>;

interface FeeTier {
  label: string;
  eta: string;
  rate: number;
}

const DEFAULT_FAST_RATE = 10;
const DEFAULT_MEDIUM_RATE = 5;
const DEFAULT_SLOW_RATE = 3;

const CLOSE_GLYPH_SIZE = 24;
const NUMERIC_GUARD = /[^\d.,]/g;
const REPEAT_SEPARATOR_GUARD = /([.,].*?)[.,]/g;
const POSITIVE_DECIMAL = /^\d+(\.\d+)?$/;

const baseTiers = (): FeeTier[] => [
  { label: loc.outflow.priorityHigh, eta: loc.outflow.etaTenMin, rate: DEFAULT_FAST_RATE },
  { label: loc.outflow.priorityMid, eta: loc.outflow.etaThreeHr, rate: DEFAULT_MEDIUM_RATE },
  { label: loc.outflow.priorityLow, eta: loc.outflow.etaOneDay, rate: DEFAULT_SLOW_RATE },
];

const matchesPresetRate = (rate: number): boolean =>
  baseTiers().some(tier => tier.rate === rate);

const sanitizeCustomFee = (raw: string): string =>
  raw.replace(NUMERIC_GUARD, '').replace(REPEAT_SEPARATOR_GUARD, '$1');

const parseCustomFee = (raw: string): number => Number(raw.replace(',', '.'));

export const SelectFeeSheetScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette: ColorScheme = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<SelectFeeNavigation>();
  const route = useRoute<SelectFeeRoute>();
  const { current, onPick, vsize } = route.params;
  const { isRTL } = useWallets();

  const customInputRef = useRef<TextInput>(null);
  const [customValue, setCustomValue] = useState('');
  const [customSelected, setCustomSelected] = useState(() => !matchesPresetRate(current));
  const [tiers, setTiers] = useState<FeeTier[]>(() => baseTiers());

  useEffect(() => {
    let active = true;
    fetchRecommendedFees()
      .then(fees => {
        if (!active) {
          return;
        }
        setTiers([
          { label: loc.outflow.priorityHigh, eta: loc.outflow.etaTenMin, rate: fees.fastestFee },
          { label: loc.outflow.priorityMid, eta: loc.outflow.etaThreeHr, rate: fees.halfHourFee },
          { label: loc.outflow.priorityLow, eta: loc.outflow.etaOneDay, rate: fees.hourFee },
        ]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const choose = useMemo(
    () => (rate: number) => {
      onPick(rate);
      navigation.goBack();
    },
    [navigation, onPick],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerShadowVisible: false,
      headerStyle: { backgroundColor: palette.elevated },
      headerRight: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={SIZE.closeHit}
          style={styles.closeButton}
        >
          <MaterialIcons name="close" size={CLOSE_GLYPH_SIZE} color={palette.fg} />
        </Pressable>
      ),
    });
  }, [navigation, palette.elevated, palette.fg]);

  const onCustomChange = (raw: string): void => setCustomValue(sanitizeCustomFee(raw));

  const onCustomSubmit = (): void => {
    const parsed = parseCustomFee(customValue);
    // Reject non-finite, non-positive, or absurd fee rates; use whole sat/vB.
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 5000) {
      choose(Math.round(parsed));
    }
  };

  const onCustomBlur = (): void => {
    if (!customValue) {
      setCustomSelected(!matchesPresetRate(current));
    }
  };

  const customDirection: TextStyle['writingDirection'] = customValue
    ? 'ltr'
    : isRTL
      ? 'rtl'
      : 'ltr';

  const showUnitSuffix =
    customValue !== '' && POSITIVE_DECIMAL.test(customValue) && Number(customValue) > 0;

  const customContainerStyle = ({ pressed }: PressableStateCallbackType): ViewStyle[] => {
    const layers: ViewStyle[] = [styles.customRow];
    if (customSelected) {
      layers.push(styles.customRowActive, { backgroundColor: palette.txInBg });
    }
    if (pressed) {
      layers.push(styles.pressed);
    }
    return layers;
  };

  return (
    <ScrollView
      style={{ backgroundColor: palette.elevated }}
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      showsVerticalScrollIndicator={false}
    >
      {tiers.map(tier => (
        <FeeOptionRow
          key={tier.label}
          c={palette}
          isDark={isDark}
          label={tier.label}
          time={tier.eta}
          fee={`${formatBtcTrim(vsize * tier.rate)} ${loc.denom.coinTicker}`}
          rate={tier.rate}
          active={!customSelected && tier.rate === current}
          onPress={() => choose(tier.rate)}
        />
      ))}
      <Pressable onPress={() => customInputRef.current?.focus()} style={customContainerStyle}>
        <View style={styles.customLine}>
          <Text style={[styles.customLabel, { color: palette.accentGreen }]}>
            {loc.outflow.manualMinerCost}
          </Text>
          <View style={styles.customField}>
            <TextInput
              ref={customInputRef}
              style={[styles.customInput, { color: palette.accentGreen, writingDirection: customDirection }]}
              keyboardType="numeric"
              placeholder={loc.outflow.enterMinerCost}
              placeholderTextColor={palette.labelText}
              value={customValue}
              onChangeText={onCustomChange}
              onSubmitEditing={onCustomSubmit}
              onFocus={() => setCustomSelected(true)}
              onBlur={onCustomBlur}
              enablesReturnKeyAutomatically
              returnKeyType="done"
              accessibilityLabel={loc.outflow.minerCostField}
            />
            {showUnitSuffix ? (
              <Text style={[styles.customUnit, { color: palette.accentGreen }]}>
                {loc.denom.feeRateMetric}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: SPACING.xs,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxl,
  },
  closeButton: {
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
  customRow: {
    paddingHorizontal: SIZE.buttonPadH,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  customRowActive: {
    borderRadius: RADIUS.chip * 2,
  },
  pressed: {
    opacity: 0.6,
  },
  customLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customLabel: {
    fontSize: 22,
    fontWeight: '600',
  },
  customField: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: SPACING.xs,
  },
  customInput: {
    minWidth: 80,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'right',
    padding: 0,
  },
  customUnit: {
    fontSize: 16,
    writingDirection: 'ltr',
  },
});

export default SelectFeeSheetScreen;
