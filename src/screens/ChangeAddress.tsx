import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import loc from '../i18n';
import { COLORS, SPACING, TYPE } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { useWallets, type ChangeAddressOverride } from '../wallets/context';
import { triggerSuccessHaptic } from '../utils/haptics';

type ChangeAddressNavigation = NativeStackNavigationProp<RootStackParamList, 'ChangeAddress'>;

interface ChangeAddressOption {
  key: ChangeAddressOverride;
  label: string;
  detail: string;
}

const directionalText = (isRTL: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: isRTL ? 'rtl' : 'ltr',
});

export const ChangeAddressScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<ChangeAddressNavigation>();
  const { changeAddressType, setChangeAddressType, isRTL } = useWallets();

  const pageBg = isDark ? palette.bg : palette.cardGray;
  const cellBg = isDark ? palette.cardGray : palette.bg;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.prefs.switchDestination,
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

  const options = useMemo<ChangeAddressOption[]>(
    () => [
      { key: 'auto', label: loc.nodeConn.leftoverModeAuto, detail: loc.nodeConn.leftoverModeAutoBlurb },
      { key: 'BIP84', label: loc.holdings.nativeSegwitLabel, detail: loc.nodeConn.leftoverNativeSegwitBlurb },
      { key: 'BIP49', label: loc.holdings.nestedSegwitLabel, detail: loc.nodeConn.leftoverWrappedSegwitBlurb },
      { key: 'BIP44', label: loc.quorum.olderFormat, detail: loc.nodeConn.leftoverLegacyBlurb },
    ],
    [],
  );

  const choose = useCallback(
    (mode: ChangeAddressOverride) => {
      setChangeAddressType(mode);
      triggerSuccessHaptic();
    },
    [setChangeAddressType],
  );

  return (
    <ScrollView
      style={{ backgroundColor: pageBg }}
      contentContainerStyle={styles.scrollBody}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionHeader, { color: palette.altText }, directionalText(isRTL)]}>
        {loc.nodeConn.leftoverDestinationLabel}
      </Text>
      <View style={styles.section}>
        {options.map((option, index) => {
          const isSelected = changeAddressType === option.key;
          const isFirst = index === 0;
          const isLast = index === options.length - 1;
          return (
            <Pressable
              key={option.key}
              onPress={() => choose(option.key)}
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
              <Text
                style={[styles.rowTitle, styles.flex, { color: palette.fg }, directionalText(isRTL)]}>
                {option.label}
              </Text>
              <Text
                style={[styles.rowDetail, { color: palette.altText }, directionalText(isRTL)]}
                numberOfLines={1}>
                {option.detail}
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
      <Text style={[styles.footnote, { color: palette.altText }, directionalText(isRTL)]}>
        {loc.nodeConn.leftoverFormatNote}
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollBody: {
    paddingBottom: SPACING.xxl,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.xl,
  },
  section: {
    marginHorizontal: SPACING.lg,
    overflow: 'hidden',
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
  flex: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  rowDetail: {
    fontSize: 15,
    fontWeight: '400',
    marginLeft: SPACING.sm,
  },
  check: {
    marginLeft: SPACING.sm,
  },
  footnote: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: SPACING.md,
    marginHorizontal: SPACING.xl,
  },
  pressed: {
    opacity: 0.6,
  },
});

export default ChangeAddressScreen;
