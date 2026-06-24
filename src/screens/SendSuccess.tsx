import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import type { SendStackParamList } from '../navigation/types';
import { useWallets } from '../wallets/context';
import { PrimaryButton } from '../components/PrimaryButton';
import { SuccessCheck } from '../components/SuccessCheck';
import { formatBtcTrim, formatUnit } from '../utils/currency';
import loc from '../i18n';

type SendSuccessNavigation = NativeStackNavigationProp<SendStackParamList, 'SendSuccess'>;
type SendSuccessRoute = RouteProp<SendStackParamList, 'SendSuccess'>;

const HEADER_OFFSET = 19;
const MIN_BOTTOM_INSET = 16;

const SendSuccessScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<SendSuccessNavigation>();
  const { params } = useRoute<SendSuccessRoute>();
  const { amountSats, feeSats } = params;

  const { denomination } = useWallets();

  const display = useMemo(() => {
    const isSats = denomination === 'sats';
    return {
      unitLabel: isSats ? loc.denom.satoshiUnit : loc.denom.coinTicker,
      amount: isSats ? formatUnit(amountSats, 'sats') : formatBtcTrim(amountSats),
      fee: isSats ? formatUnit(feeSats, 'sats') : formatBtcTrim(feeSats),
    };
  }, [denomination, amountSats, feeSats]);

  const dismiss = (): void => {
    navigation.getParent()?.goBack();
  };

  const bottomPad = Math.max(insets.bottom, MIN_BOTTOM_INSET);

  return (
    <View style={[styles.screen, { backgroundColor: palette.elevated, paddingTop: HEADER_OFFSET }]}>
      <View style={styles.screen}>
        <View style={styles.summary}>
          <View style={styles.amountRow}>
            <Text style={[styles.amount, { color: palette.accentBlue }]}>{display.amount}</Text>
            <Text style={[styles.amountUnit, { color: palette.accentBlue }]}>{' '}{display.unitLabel}</Text>
          </View>
          {feeSats > 0 ? (
            <Text style={[styles.feeLine, { color: palette.muted }]}>
              {loc.outflow.minerCostField}: {display.fee} {display.unitLabel}
            </Text>
          ) : null}
        </View>
        <SuccessCheck c={palette} isDark={isDark} />
      </View>
      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <PrimaryButton label={loc.outflow.finishEntry} color={palette.accentBlue} onPress={dismiss} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  summary: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge,
    borderRadius: RADIUS.card,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  amount: {
    ...TYPE.totalBalance,
  },
  amountUnit: {
    ...TYPE.balance,
    fontWeight: '600',
  },
  feeLine: {
    ...TYPE.caption,
    marginTop: SPACING.sm,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
});

export default SendSuccessScreen;
export { SendSuccessScreen };
