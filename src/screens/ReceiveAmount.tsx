import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
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

import { COLORS, RADIUS, SIZE, SPACING, TYPE } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { useWallets } from '../wallets/context';
import SendAmountField, { amountToSats, type SendUnit } from '../components/SendAmountField';
import { formatBtcTrim } from '../utils/currency';
import { fetchBtcRate } from '../network/rates';
import loc from '../i18n';

type ReceiveAmountNavigation = NativeStackNavigationProp<RootStackParamList, 'ReceiveAmount'>;
type ReceiveAmountRoute = RouteProp<RootStackParamList, 'ReceiveAmount'>;

const BECH32_PREFIX = 'bc1';
const ACCESSORY_ID = 'receiveAmountField';
const PLACEHOLDER_COLOR = '#81868e';

const writingDir = (isRTL: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: isRTL ? 'rtl' : 'ltr',
});

const encodeLabel = (raw: string): string =>
  encodeURIComponent(raw).replace(/[!*()']/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const normalizeAddress = (address: string): string =>
  address.toLowerCase().startsWith(BECH32_PREFIX) ? address.toUpperCase() : address;

const buildPaymentUri = (address: string, sats: number, label: string): string => {
  const params: string[] = [];
  if (sats > 0) {
    params.push(`amount=${formatBtcTrim(sats)}`);
  }
  const trimmed = label.trim();
  if (trimmed) {
    params.push(`label=${encodeLabel(trimmed)}`);
  }
  const query = params.join('&');
  return `bitcoin:${normalizeAddress(address)}${query ? '?' : ''}${query}`;
};

export const ReceiveAmountScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<ReceiveAmountNavigation>();
  const route = useRoute<ReceiveAmountRoute>();
  const { address } = route.params;
  const { currency, isRTL } = useWallets();

  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<SendUnit>('BTC');
  const [label, setLabel] = useState('');
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetchBtcRate(currency.endPointKey)
      .then(value => {
        if (active && value > 0) setRate(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [currency.endPointKey]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.inflow.fixedSumRequest,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: palette.elevated },
      headerTintColor: palette.fg,
      headerTitleStyle: {
        fontSize: TYPE.headerTitle.fontSize,
        fontWeight: TYPE.headerTitle.fontWeight,
        color: palette.fg,
      },
      headerRight: () => (
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            navigation.goBack();
          }}
          accessibilityRole="button"
          accessibilityLabel={loc.core.dismissAction}
          hitSlop={SIZE.closeHit}
          style={[styles.closeButton, { backgroundColor: palette.lightButton }]}>
          <MaterialIcons name="close" size={16} color={palette.fg} />
        </Pressable>
      ),
    });
  }, [navigation, palette.fg, palette.elevated, palette.lightButton]);

  const sats = useMemo(() => Math.max(0, amountToSats(amount, unit, rate)), [amount, unit, rate]);

  const handleCreate = (): void => {
    const trimmed = label.trim();
    navigation.popTo('ReceiveSheet', {
      address,
      customUri: buildPaymentUri(address, sats, trimmed),
      customAmount: sats > 0 ? formatBtcTrim(sats) : undefined,
      customLabel: trimmed || undefined,
    });
  };

  const handleReset = (): void => {
    navigation.popTo('ReceiveSheet', {
      address,
      customUri: undefined,
      customAmount: undefined,
      customLabel: undefined,
    });
  };

  return (
    <ScrollView
      style={{ backgroundColor: palette.elevated }}
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      showsVerticalScrollIndicator={false}>
      <View style={styles.amountInset}>
        <SendAmountField
          isDark={isDark}
          rate={rate}
          amount={amount}
          onChangeAmount={setAmount}
          unit={unit}
          setUnit={setUnit}
          accessoryID={ACCESSORY_ID}
          currency={currency}
          changeCurrencyLabel={loc.core.switchMoneyUnit}
        />
      </View>
      <View
        style={[
          styles.labelField,
          { backgroundColor: palette.inputBg, borderColor: palette.inputBorder },
        ]}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder={loc.inflow.memoText}
          placeholderTextColor={PLACEHOLDER_COLOR}
          numberOfLines={1}
          style={[styles.labelInput, { color: palette.fg }]}
        />
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={handleReset}
          style={[styles.actionButton, { backgroundColor: palette.modalButton }]}>
          <Text style={[TYPE.button, { color: palette.fg }, writingDir(isRTL)]}>
            {loc.inflow.startOver}
          </Text>
        </Pressable>
        <View style={styles.actionGap} />
        <Pressable
          onPress={handleCreate}
          style={[styles.actionButton, { backgroundColor: palette.modalButton }]}>
          <Text style={[TYPE.button, { color: palette.fg }, writingDir(isRTL)]}>
            {loc.inflow.generateInvoice}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  amountInset: {
    marginHorizontal: SPACING.xl,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelField: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
  },
  labelInput: {
    fontSize: 16,
    padding: 0,
  },
  actions: {
    flexDirection: 'row',
    marginTop: SPACING.xl,
  },
  actionButton: {
    flex: 1,
    minHeight: SIZE.buttonHeight,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZE.buttonPadH,
  },
  actionGap: {
    width: SPACING.md,
  },
});

export default ReceiveAmountScreen;
