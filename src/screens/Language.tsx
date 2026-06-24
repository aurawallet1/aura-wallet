import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import loc from '../i18n';
import { SupportedLanguages, type LanguageDescriptor } from '../i18n/languages';
import { COLORS, SPACING, TYPE } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { useWallets } from '../wallets/context';
import { triggerSuccessHaptic } from '../utils/haptics';

type LanguageNavigation = NativeStackNavigationProp<RootStackParamList, 'Language'>;

const directionalText = (isRTL: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: isRTL ? 'rtl' : 'ltr',
});

const normalize = (value: string): string => value.trim().toLowerCase();

export const LanguageScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<LanguageNavigation>();
  const { language, setLanguageStorage, isRTL } = useWallets();
  const [query, setQuery] = useState('');

  const pageBg = isDark ? palette.bg : palette.cardGray;
  const cellBg = isDark ? palette.cardGray : palette.bg;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.prefs.locale,
      headerLargeTitle: false,
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
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
      },
    });
  }, [navigation, palette.fg, pageBg, language]);

  const results = useMemo(() => {
    const needle = normalize(query);
    if (needle.length === 0) {
      return SupportedLanguages;
    }
    return SupportedLanguages.filter(entry => entry.label.toLowerCase().includes(needle));
  }, [query]);

  const choose = useCallback(
    (entry: LanguageDescriptor) => {
      Keyboard.dismiss();
      const previous = SupportedLanguages.find(item => item.value === language);
      setLanguageStorage(entry.value).then(() => {
        triggerSuccessHaptic();
        const wasRTL = previous?.isRTL ?? false;
        const willBeRTL = entry.isRTL ?? false;
        if (wasRTL !== willBeRTL) {
          Alert.alert(loc.prefs.relaunchForDirection);
        }
      });
    },
    [language, setLanguageStorage],
  );

  const renderRow = useCallback(
    ({ item, index }: ListRenderItemInfo<LanguageDescriptor>) => {
      const isSelected = language === item.value;
      const isFirst = index === 0;
      const isLast = index === results.length - 1;
      return (
        <Pressable
          onPress={() => choose(item)}
          disabled={isSelected}
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
          ]}>
          <View style={styles.flex}>
            <Text style={[styles.rowTitle, { color: palette.fg }, directionalText(isRTL)]}>
              {item.label}
            </Text>
          </View>
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
    },
    [language, results.length, palette, cellBg, isRTL, choose],
  );

  return (
    <FlatList
      style={{ backgroundColor: pageBg }}
      contentContainerStyle={styles.body}
      contentInsetAdjustmentBehavior="automatic"
      data={results}
      keyExtractor={item => item.value}
      renderItem={renderRow}
      keyboardDismissMode="on-drag"
      removeClippedSubviews
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
  },
  rowFirst: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  rowLast: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  flex: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '500',
  },
  check: {
    marginLeft: SPACING.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});

export default LanguageScreen;
