import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type NativeSyntheticEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import dayjs from 'dayjs';

import loc from '../i18n';
import { COLORS, SPACING, TYPE } from '../theme';
import { FIAT_UNITS } from '../constants/fiat';
import type { FiatUnit } from '../types/index';
import type { RootStackParamList } from '../navigation/types';
import { useWallets } from '../wallets/context';
import { fetchBtcRate } from '../network/rates';
import {
  StorageKeys,
  getCachedRate,
  persistString,
  setCachedRate,
  type CachedRate,
} from '../utils/storage';
import { triggerSuccessHaptic } from '../utils/haptics';

type CurrencyNavigation = NativeStackNavigationProp<RootStackParamList, 'Currency'>;

const MAX_RESULTS = 50;

const directionalText = (isRTL: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: isRTL ? 'rtl' : 'ltr',
});

const formatRate = (unit: FiatUnit, value: number | null): string => {
  if (value == null || value <= 0) {
    return loc.core.notOnce;
  }
  try {
    const formatted = new Intl.NumberFormat(unit.locale, {
      maximumFractionDigits: 2,
    }).format(value);
    return `${unit.symbol}${formatted}`;
  } catch {
    return `${unit.symbol}${value.toFixed(2)}`;
  }
};

const formatUpdatedAt = (updatedAt: number | null): string => {
  if (!updatedAt) {
    return loc.core.notOnce;
  }
  return dayjs(updatedAt).format('LLL');
};

export const CurrencyScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<CurrencyNavigation>();
  const { currency, setCurrency, isRTL } = useWallets();

  const pageBg = isDark ? palette.bg : palette.cardGray;
  const cellBg = isDark ? palette.cardGray : palette.bg;

  const [selected, setSelected] = useState<FiatUnit>(currency);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [cachedRate, setCachedRateState] = useState<CachedRate | null>(null);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.prefs.fiatUnit,
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
      headerSearchBarOptions: {
        onChangeText: (event: NativeSyntheticEvent<{ text: string }>) =>
          setQuery(event.nativeEvent.text),
        onFocus: () => setSearchFocused(true),
        onBlur: () => setSearchFocused(false),
      },
    });
  }, [navigation, palette.fg, pageBg]);

  useEffect(() => {
    getCachedRate()
      .then(setCachedRateState)
      .catch(() => {});
  }, []);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? FIAT_UNITS.filter(
          unit =>
            unit.endPointKey.toLowerCase().includes(needle) ||
            unit.country.toLowerCase().includes(needle),
        )
      : FIAT_UNITS;
    return matches.slice(0, MAX_RESULTS);
  }, [query]);

  const selectedVisible = useMemo(
    () => results.some(unit => unit.endPointKey === selected.endPointKey),
    [results, selected.endPointKey],
  );

  const choose = useCallback(
    async (unit: FiatUnit) => {
      if (unit.endPointKey === selected.endPointKey || savingKey) {
        return;
      }
      Keyboard.dismiss();
      setSavingKey(unit.endPointKey);
      try {
        const rate = await fetchBtcRate(unit.endPointKey);
        if (!rate || rate <= 0) {
          throw new Error('rate unavailable');
        }
        await persistString(StorageKeys.fiatCurrency, unit.endPointKey);
        await setCachedRate(rate);
        setCurrency(unit);
        setSelected(unit);
        setCachedRateState(await getCachedRate());
        triggerSuccessHaptic();
      } catch {
        Alert.alert(loc.prefs.fiatUnit, loc.prefs.quoteRetrievalFailed);
      } finally {
        setSavingKey(null);
      }
    },
    [savingKey, selected.endPointKey, setCurrency],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: FiatUnit; index: number }) => {
      const isSelected = item.endPointKey === selected.endPointKey;
      const isFirst = index === 0;
      const isLast = index === results.length - 1;
      const isSaving = savingKey === item.endPointKey;
      return (
        <Pressable
          onPress={() => choose(item)}
          disabled={isSelected || isSaving}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: cellBg },
            isFirst && styles.rowFirst,
            isLast && styles.rowLast,
            !isLast && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: palette.fieldBorder,
            },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.body}>
            <Text style={[styles.rowTitle, { color: palette.fg }, directionalText(isRTL)]}>
              {`${item.endPointKey} (${item.symbol})`}
            </Text>
            <Text style={[styles.rowSubtitle, { color: palette.altText }, directionalText(isRTL)]}>
              {item.country}
            </Text>
          </View>
          {isSaving ? (
            <ActivityIndicator color={palette.accentBlue} />
          ) : isSelected ? (
            <MaterialIcons name="check" size={20} color={palette.accentBlue} />
          ) : null}
        </Pressable>
      );
    },
    [choose, results.length, savingKey, selected.endPointKey, cellBg, palette, isRTL],
  );

  const header =
    searchFocused || !selectedVisible ? (
      <View style={styles.headerSpacer} />
    ) : (
      <View style={styles.infoWrap}>
        <View style={[styles.infoCard, { backgroundColor: cellBg }]}>
          <Text style={[styles.infoTitle, { color: palette.fg }]}>
            {`${loc.prefs.quoteProvider} ${selected.source}`}
          </Text>
          <Text style={[styles.infoLine, { color: palette.altText }]}>
            {loc.prefs.exchangeQuoteLabel}
            {formatRate(selected, cachedRate?.value ?? null)}
          </Text>
          <Text style={[styles.infoLine, { color: palette.altText }]}>
            {loc.prefs.refreshedAtLabel}
            {formatUpdatedAt(cachedRate?.updatedAt ?? null)}
          </Text>
        </View>
      </View>
    );

  return (
    <FlatList
      style={{ backgroundColor: pageBg }}
      contentContainerStyle={styles.listBody}
      contentInsetAdjustmentBehavior="automatic"
      data={results}
      keyExtractor={item => `${item.endPointKey}-${item.locale}`}
      renderItem={renderItem}
      keyboardDismissMode="on-drag"
      removeClippedSubviews
      ListHeaderComponent={header}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  listBody: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  headerSpacer: {
    height: SPACING.sm,
  },
  infoWrap: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  infoCard: {
    borderRadius: 15,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  infoLine: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    minHeight: 56,
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
  body: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    paddingVertical: 2,
  },
  pressed: {
    opacity: 0.6,
  },
});

export default CurrencyScreen;
