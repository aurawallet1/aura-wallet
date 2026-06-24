import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS, SPACING } from '../theme';
import loc from '../i18n';
import SettingsRow, { type SettingsRowItem } from '../components/SettingsRow';
import { useWallets } from '../wallets/context';
import type { RootStackParamList } from '../navigation/types';

type SettingsNavigation = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

const RESET_ROUTE = 'ResetApp';

const PLACEHOLDER_ROUTE = 'Soon';

const ICON_TINT = {
  neutral: '#8E8E93',
  cash: '#34C759',
  locale: '#5E5CE6',
  guard: '#FF3B30',
  link: '#0A84FF',
  help: '#5AC8C8',
} as const;

const buildSections = (): SettingsRowItem[][] => [
  [
    { icon: 'settings', title: loc.prefs.basics, color: ICON_TINT.neutral, route: 'General' },
    { icon: 'payments', title: loc.prefs.fiatUnit, color: ICON_TINT.cash, route: 'Currency' },
    { icon: 'g-translate', title: loc.prefs.locale, color: ICON_TINT.locale, route: 'Language' },
    { icon: 'lock', title: loc.prefs.safeguard, color: ICON_TINT.guard, route: 'Security' },
    { icon: 'wifi', title: loc.prefs.connectivity, color: ICON_TINT.link, route: 'Network' },
  ],
  [{ icon: 'help', title: loc.prefs.appInfo, color: ICON_TINT.help, route: 'About' }],
  [{ icon: 'delete-sweep', title: loc.prefs.wipeEverything, color: ICON_TINT.guard, route: RESET_ROUTE }],
];

export const SettingsScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<SettingsNavigation>();
  const { resetApp } = useWallets();

  const pageBg = isDark ? palette.bg : palette.cardGray;
  const cellBg = isDark ? palette.cardGray : palette.bg;

  const sections = useMemo(() => buildSections(), []);

  const announcePlaceholder = useCallback(() => {
    Alert.alert(loc.prefs.screenTitle, loc.appGeneral.notYetAvailableAlt);
  }, []);

  const confirmReset = useCallback(() => {
    Alert.alert(loc.prefs.wipeEverything, loc.prefs.wipeWarningBody, [
      { text: loc.core.dismissAction, style: 'cancel' },
      {
        text: loc.prefs.wipeEverything,
        style: 'destructive',
        onPress: () => {
          resetApp();
          navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
        },
      },
    ]);
  }, [navigation, resetApp]);

  const handlePress = useCallback(
    (route: string) => {
      if (route === RESET_ROUTE) {
        confirmReset();
        return;
      }
      if (route === PLACEHOLDER_ROUTE) {
        announcePlaceholder();
        return;
      }
      navigation.navigate(route as never);
    },
    [announcePlaceholder, confirmReset, navigation],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.prefs.screenTitle,
      headerBackTitle: '',
      headerLargeTitle: Platform.OS === 'ios',
      headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: false,
      headerTintColor: palette.fg,
      headerLargeTitleStyle: Platform.OS === 'ios' ? { color: palette.fg } : undefined,
      headerTitleStyle: { color: palette.fg },
      headerTransparent: false,
      headerBlurEffect: undefined,
      headerStyle: { backgroundColor: pageBg },
    });
  }, [navigation, palette.fg, pageBg]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: pageBg }]} edges={['bottom', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        {sections.map((rows, sectionIndex) => (
          <View
            key={`section-${sectionIndex}`}
            style={sectionIndex === 0 ? styles.sectionLead : styles.section}>
            {rows.map((row, rowIndex) => (
              <SettingsRow
                key={row.route}
                row={row}
                isFirst={rowIndex === 0}
                isLast={rowIndex === rows.length - 1}
                onPress={() => handlePress(row.route)}
                c={palette}
                cellBg={cellBg}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollBody: {
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    marginHorizontal: SPACING.lg,
  },
  sectionLead: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.lg,
  },
});

export default SettingsScreen;
