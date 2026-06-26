import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
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
import type { BlockExplorer } from '../types/index';
import {
  BLOCK_EXPLORERS,
  DEFAULT_EXPLORER_URL,
  isValidExplorerUrl,
  normalizeExplorerUrl,
} from '../network/blockExplorers';
import { triggerSuccessHaptic } from '../utils/haptics';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'BlockExplorer'>;

const FOCUS_DELAY_MS = 60;

const PLACEHOLDER_TINT = '#81868e';

const matchesPreset = (url: string): boolean => {
  const target = normalizeExplorerUrl(url);
  return BLOCK_EXPLORERS.some((explorer) => normalizeExplorerUrl(explorer.url) === target);
};

export const BlockExplorerScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<Navigation>();
  const { blockExplorer, setBlockExplorer, isRTL } = useWallets();

  const pageBg = isDark ? palette.bg : palette.cardGray;
  const cellBg = isDark ? palette.cardGray : palette.bg;

  const startedAsPreset = useMemo(() => matchesPreset(blockExplorer), [blockExplorer]);

  const [customEnabled, setCustomEnabled] = useState(!startedAsPreset);
  const [customUrl, setCustomUrl] = useState(startedAsPreset ? '' : blockExplorer);

  const inputRef = useRef<TextInput>(null);

  const draftRef = useRef({ customEnabled, customUrl });
  draftRef.current = { customEnabled, customUrl };

  useEffect(
    () => () => {
      const { customEnabled: enabled, customUrl: typed } = draftRef.current;
      if (!enabled) {
        return;
      }
      const candidate = normalizeExplorerUrl(typed.trim());
      // Only persist a valid URL; an empty/invalid draft must not clobber the
      // explorer the user already had saved.
      if (isValidExplorerUrl(candidate)) {
        setBlockExplorer(candidate);
      }
    },
    [setBlockExplorer],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.prefs.chainBrowser,
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

  const choosePreset = useCallback(
    (explorer: BlockExplorer) => {
      setCustomEnabled(false);
      setBlockExplorer(explorer.url);
      triggerSuccessHaptic();
    },
    [setBlockExplorer],
  );

  const toggleCustom = useCallback(
    (value: boolean) => {
      setCustomEnabled(value);
      if (value) {
        setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY_MS);
      } else {
        setBlockExplorer(DEFAULT_EXPLORER_URL);
      }
    },
    [setBlockExplorer],
  );

  const submitCustom = useCallback(() => {
    const candidate = normalizeExplorerUrl(customUrl.trim());
    if (!isValidExplorerUrl(candidate)) {
      Alert.alert(loc.prefs.badLinkWarning);
      inputRef.current?.focus();
      return;
    }
    setBlockExplorer(candidate);
    Keyboard.dismiss();
    triggerSuccessHaptic();
  }, [customUrl, setBlockExplorer]);

  const writingDirection = isRTL ? 'rtl' : 'ltr';
  const inputDirection = customUrl ? 'ltr' : writingDirection;

  return (
    <ScrollView
      style={{ backgroundColor: pageBg }}
      contentContainerStyle={styles.body}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <Text style={[styles.sectionHeader, { writingDirection }]}>{loc.core.recommended}</Text>
      <View style={styles.section}>
        {BLOCK_EXPLORERS.map((explorer, index) => {
          const isSelected =
            !customEnabled &&
            normalizeExplorerUrl(explorer.url) === normalizeExplorerUrl(blockExplorer);
          const isFirst = index === 0;
          const isLast = index === BLOCK_EXPLORERS.length - 1;
          return (
            <Pressable
              key={explorer.key}
              onPress={() => choosePreset(explorer)}
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
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.rowTitle, styles.flex, { color: palette.fg, writingDirection }]}>
                {explorer.name}
              </Text>
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
            {loc.prefs.favorChosenBrowser}
          </Text>
          <Switch value={customEnabled} onValueChange={toggleCustom} style={styles.switch} />
        </View>
        {customEnabled ? (
          <View style={[styles.inputBox, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
            <TextInput
              ref={inputRef}
              value={customUrl}
              onChangeText={setCustomUrl}
              placeholder={loc.core.typeWebAddress}
              placeholderTextColor={PLACEHOLDER_TINT}
              style={[styles.input, { color: palette.fg, writingDirection: inputDirection }]}
              textContentType="URL"
              clearButtonMode="while-editing"
              autoCapitalize="none"
              autoCorrect={false}
              underlineColorAndroid="transparent"
              onSubmitEditing={submitCustom}
            />
          </View>
        ) : null}
      </View>
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
});

export default BlockExplorerScreen;
