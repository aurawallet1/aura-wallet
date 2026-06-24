import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import loc from '../i18n';
import { COLORS, SIZE, SPACING, TYPE } from '../theme';
import type { ScanResponse, ScriptType, WalletAccountMap } from '../types/index';
import { useWallets } from '../wallets/context';
import type { RootStackParamList } from '../navigation/types';
import { triggerSuccessHaptic } from '../utils/haptics';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'WalletDerivation'>;
type Route = RouteProp<RootStackParamList, 'WalletDerivation'>;

interface SchemeOption {
  key: ScriptType;
  name: string;
  standard: string;
}

const useSchemeOptions = (): SchemeOption[] =>
  useMemo(
    () => [
      { key: 'BIP84', name: loc.holdings.nativeSegwitLabel, standard: 'BIP84' },
      { key: 'BIP49', name: loc.holdings.nestedSegwitLabel, standard: 'BIP49' },
      { key: 'BIP44', name: loc.quorum.olderFormat, standard: 'BIP44' },
    ],
    [],
  );

export const WalletDerivationScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { wallets, setWalletPathType, isRTL } = useWallets();

  const entry = wallets.find(wallet => wallet.id === route.params.id);
  const isSingleSig = Boolean(entry) && !entry?.multisig && !entry?.wif;
  const scan = isSingleSig ? (entry?.scan as ScanResponse | null) ?? null : null;
  const accounts: WalletAccountMap | undefined = scan?.result?.data;
  const selectedKey: ScriptType | undefined =
    entry?.pathType ?? scan?.primaryType ?? undefined;

  const surfaceBg = palette.elevated;
  const schemes = useSchemeOptions();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.holdings.scriptFormatHeading,
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
    (key: ScriptType) => {
      if (!entry) {
        return;
      }
      setWalletPathType(entry.id, key);
      triggerSuccessHaptic();
      navigation.goBack();
    },
    [entry, navigation, setWalletPathType],
  );

  const writingDirection = isRTL ? 'rtl' : 'ltr';

  return (
    <ScrollView
      style={{ backgroundColor: surfaceBg }}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}>
      {schemes.map((scheme, index) => {
        const isSelected = selectedKey === scheme.key;
        const isLast = index === schemes.length - 1;
        const derivationPath = accounts?.[scheme.key]?.derivationPath ?? '';
        return (
          <Pressable
            key={scheme.key}
            onPress={() => choose(scheme.key)}
            style={({ pressed }) => [
              styles.row,
              !isLast && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: palette.fieldBorder,
              },
              pressed && styles.pressed,
            ]}>
            <View style={styles.rowText}>
              <Text style={[styles.title, { color: palette.fg, writingDirection }]}>
                {scheme.name}{' '}
                <Text style={{ color: palette.txdMuted }}>· {scheme.standard}</Text>
              </Text>
              {derivationPath ? (
                <Text style={[styles.path, { color: palette.txdMuted }]}>
                  {derivationPath}
                </Text>
              ) : null}
            </View>
            {isSelected ? (
              <MaterialIcons name="check" size={20} color={palette.accentBlue} />
            ) : null}
          </Pressable>
        );
      })}
      <Text
        style={[styles.hint, { color: palette.txdMuted, writingDirection }]}>
        {loc.holdings.schemeSwitchNote}
      </Text>
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
  rowText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  path: {
    fontSize: 12,
    marginTop: 3,
    writingDirection: 'ltr',
    textAlign: 'left',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginHorizontal: SPACING.lg,
    marginTop: 18,
  },
  closeButton: {
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
});

export default WalletDerivationScreen;
