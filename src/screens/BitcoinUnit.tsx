import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import loc from '../i18n';
import { COLORS, SIZE, SPACING, TYPE } from '../theme';
import { useWallets, type BitcoinUnit } from '../wallets/context';
import type { RootStackParamList } from '../navigation/types';
import { triggerSuccessHaptic } from '../utils/haptics';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'BitcoinUnit'>;

const UNIT_ORDER: readonly BitcoinUnit[] = ['BTC', 'sats', 'fiat'];

export const BitcoinUnitScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<Navigation>();
  const { denomination, setDenomination, currency, isRTL } = useWallets();

  const surfaceBg = palette.elevated;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.appGeneral.coinUnitChoice,
      headerShadowVisible: false,
      headerBackVisible: false,
      headerStyle: { backgroundColor: surfaceBg },
      contentStyle: { backgroundColor: surfaceBg },
      headerTintColor: palette.fg,
      headerTitleStyle: {
        fontSize: TYPE.headerTitle.fontSize,
        fontWeight: TYPE.headerTitle.fontWeight,
        color: palette.fg,
      },
      headerRight: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={SIZE.closeHit}
          style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color={palette.fg} />
        </Pressable>
      ),
    });
  }, [navigation, palette.fg, surfaceBg]);

  const choose = useCallback(
    (unit: BitcoinUnit) => {
      setDenomination(unit);
      triggerSuccessHaptic();
      navigation.goBack();
    },
    [navigation, setDenomination],
  );

  const writingDirection = isRTL ? 'rtl' : 'ltr';

  const labelFor = useMemo(
    () => (unit: BitcoinUnit): string =>
      unit === 'fiat' ? `${currency.endPointKey} (${currency.symbol})` : unit,
    [currency.endPointKey, currency.symbol],
  );

  return (
    <ScrollView
      style={{ backgroundColor: surfaceBg }}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}>
      {UNIT_ORDER.map((unit, index) => {
        const isSelected = denomination === unit;
        const isLast = index === UNIT_ORDER.length - 1;
        return (
          <Pressable
            key={unit}
            onPress={() => choose(unit)}
            style={({ pressed }) => [
              styles.row,
              !isLast && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: palette.fieldBorder,
              },
              pressed && styles.pressed,
            ]}>
            <Text
              style={[
                styles.title,
                styles.flex,
                { color: isSelected ? palette.accentBlue : palette.fg, writingDirection },
              ]}>
              {labelFor(unit)}
            </Text>
            {isSelected ? (
              <MaterialIcons name="check" size={22} color={palette.accentBlue} />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingTop: 6,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  closeButton: {
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
});

export default BitcoinUnitScreen;
