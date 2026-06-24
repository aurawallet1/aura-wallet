import React, { useLayoutEffect } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import { useWallets } from '../wallets/context';
import { triggerHaptic } from '../utils/haptics';

type GeneralNavigation = NativeStackNavigationProp<RootStackParamList, 'General'>;

const directionalText = (isRTL: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: isRTL ? 'rtl' : 'ltr',
});

const GeneralScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<GeneralNavigation>();
  const {
    hapticsEnabled,
    setHapticsEnabled,
    analyticsDisabled,
    setAnalyticsDisabled,
    isRTL,
  } = useWallets();

  const pageBg = isDark ? palette.bg : palette.cardGray;
  const cellBg = isDark ? palette.cardGray : palette.bg;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.prefs.basics,
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
    });
  }, [navigation, palette.fg, pageBg]);

  const chevronMirror = { transform: [{ scaleX: isRTL ? -1 : 1 }] };
  const switchMirror = { transform: [{ scaleX: isRTL ? -1 : 1 }] };

  const openDenomination = (): void => {
    navigation.navigate('BitcoinUnit');
  };

  const openSystemSettings = (): void => {
    Linking.openSettings().catch(() => {});
  };

  const onHapticsToggle = (value: boolean): void => {
    setHapticsEnabled(value);
    triggerHaptic();
  };

  return (
    <ScrollView
      style={{ backgroundColor: pageBg }}
      contentContainerStyle={styles.scrollBody}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Pressable
          onPress={openDenomination}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: cellBg },
            styles.rowFirst,
            styles.rowLast,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.body}>
            <Text style={[styles.rowTitle, { color: palette.fg }, directionalText(isRTL)]}>
              {loc.appGeneral.coinUnitChoice}
            </Text>
            <Text style={[styles.rowSubtitle, { color: palette.altText }, directionalText(isRTL)]}>
              {loc.appGeneral.coinUnitHint}
            </Text>
          </View>
          <MaterialIcons
            name="chevron-right"
            size={24}
            color={palette.altText}
            style={[styles.chevron, chevronMirror]}
          />
        </Pressable>
      </View>

      <View style={styles.section}>
        <View
          style={[
            styles.row,
            { backgroundColor: cellBg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.fieldBorder },
            styles.rowFirst,
          ]}
        >
          <View style={styles.body}>
            <Text style={[styles.rowTitle, { color: palette.fg }, directionalText(isRTL)]}>
              {loc.appGeneral.tactileResponse}
            </Text>
            <Text style={[styles.rowSubtitle, { color: palette.altText }, directionalText(isRTL)]}>
              {loc.appGeneral.tactileResponseHint}
            </Text>
          </View>
          <Switch value={hapticsEnabled} onValueChange={onHapticsToggle} style={switchMirror} />
        </View>
        <View style={[styles.row, { backgroundColor: cellBg }, styles.rowLast]}>
          <View style={styles.body}>
            <Text style={[styles.rowTitle, { color: palette.fg }, directionalText(isRTL)]}>
              {loc.prefs.turnOffTracking}
            </Text>
            <Text style={[styles.rowSubtitle, { color: palette.altText }, directionalText(isRTL)]}>
              {loc.appGeneral.optOutTrackingHint}
            </Text>
          </View>
          <Switch value={analyticsDisabled} onValueChange={setAnalyticsDisabled} style={switchMirror} />
        </View>
      </View>

      <View style={styles.section}>
        <Pressable
          onPress={openSystemSettings}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: cellBg },
            styles.rowFirst,
            styles.rowLast,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.body}>
            <Text style={[styles.rowTitle, { color: palette.fg }, directionalText(isRTL)]}>
              {loc.prefs.deviceControls}
            </Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollBody: {
    paddingBottom: SPACING.xxl,
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
  body: {
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
  },
  pressed: {
    opacity: 0.6,
  },
});

export default GeneralScreen;
