import React, { useLayoutEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS, SPACING, TYPE } from '../theme';
import loc from '../i18n';
import SettingsRow, { type SettingsRowItem } from '../components/SettingsRow';
import { useWallets } from '../wallets/context';
import type { RootStackParamList } from '../navigation/types';

type NetworkNavigation = NativeStackNavigationProp<RootStackParamList, 'Network'>;

type NetworkRoute = 'BlockExplorer' | 'NetworkFee' | 'ChangeAddress' | 'Broadcast' | 'Electrum' | 'Notifications';

interface NetworkRow extends SettingsRowItem {
  route: NetworkRoute;
}

const TINT = {
  explorer: '#0A84FF',
  fee: '#F7931A',
  change: '#5E5CE6',
  broadcast: '#34C759',
  server: '#5AC8C8',
  notifications: '#FF9500',
} as const;

const buildRows = (): NetworkRow[] => [
  { icon: 'travel-explore', title: loc.prefs.chainBrowser, color: TINT.explorer, route: 'BlockExplorer' },
  { icon: 'speed', title: loc.ledger.minerCharge, color: TINT.fee, route: 'NetworkFee' },
  { icon: 'swap-vert', title: loc.prefs.switchDestination, color: TINT.change, route: 'ChangeAddress' },
  { icon: 'outbox', title: loc.prefs.pushTransaction, color: TINT.broadcast, route: 'Broadcast' },
  { icon: 'dns', title: loc.prefs.nodeEndpoint, color: TINT.server, route: 'Electrum' },
  { icon: 'notifications', title: loc.prefs.alerts, color: TINT.notifications, route: 'Notifications' },
];

export const NetworkScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<NetworkNavigation>();
  const { isRTL } = useWallets();

  const pageBg = isDark ? palette.bg : palette.cardGray;
  const cellBg = isDark ? palette.cardGray : palette.bg;

  const rows = useMemo(() => buildRows(), [isRTL]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.prefs.connectivity,
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

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: pageBg }]} edges={['bottom', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          {rows.map((row, index) => (
            <SettingsRow
              key={row.route}
              row={row}
              isFirst={index === 0}
              isLast={index === rows.length - 1}
              onPress={() => navigation.navigate(row.route)}
              c={palette}
              cellBg={cellBg}
            />
          ))}
        </View>
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
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
    marginHorizontal: SPACING.lg,
  },
});

export default NetworkScreen;
