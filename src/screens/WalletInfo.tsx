import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  Alert,
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import loc from '../i18n';
import { COLORS, RADIUS, SIZE, SPACING, TYPE, type ColorScheme } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { useWallets, type WalletEntry } from '../wallets/context';
import type {
  ScanResponse,
  ScriptType,
  WalletAccount,
  WifAccount,
  WifScanResult,
} from '../types/index';
import { triggerHaptic } from '../utils/haptics';

type WalletInfoNavigation = NativeStackNavigationProp<RootStackParamList, 'WalletInfo'>;
type WalletInfoRoute = RouteProp<RootStackParamList, 'WalletInfo'>;

const PLACEHOLDER_COLOR = '#81868e';
const CHEVRON_COLOR = '#9aa0aa';

const writingDirection = (rightToLeft: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: rightToLeft ? 'rtl' : 'ltr',
});

const mirrorGlyph = { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] };

const isHdWallet = (entry: WalletEntry): boolean =>
  !entry.multisig && !entry.wif;

const selectedScheme = (scan: ScanResponse, entry: WalletEntry): ScriptType =>
  entry.pathType ?? scan.primaryType;

const hdAccount = (entry: WalletEntry): WalletAccount | undefined => {
  if (!isHdWallet(entry) || !entry.scan) {
    return undefined;
  }
  const scan = entry.scan as ScanResponse;
  return scan.result.data[selectedScheme(scan, entry)];
};

const wifReceiveAddress = (entry: WalletEntry): string => {
  if (!entry.wif || !entry.scan) {
    return '';
  }
  const scan = entry.scan as WifScanResult;
  const account: WifAccount | undefined = scan.result.data[scan.primaryType];
  if (!account) {
    return '';
  }
  return account.receive.fresh?.address ?? account.receive.used[0]?.address ?? '';
};

const derivationPathOf = (entry: WalletEntry): string =>
  hdAccount(entry)?.derivationPath ?? '';

const transactionCountOf = (entry: WalletEntry): number => {
  if (entry.multisig) {
    return entry.multisig.scan?.result.grandTotals.totalTxCount ?? 0;
  }
  if (entry.scan) {
    return (entry.scan as ScanResponse | WifScanResult).result.grandTotals.totalTxCount ?? 0;
  }
  return 0;
};

const walletTypeLabel = (entry: WalletEntry): string => {
  if (entry.multisig) {
    return loc.holdings.cosignedKind;
  }
  if (entry.wif) {
    return 'WIF';
  }
  return loc.holdings.hierarchicalKind;
};

export const WalletInfoScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette: ColorScheme = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<WalletInfoNavigation>();
  const route = useRoute<WalletInfoRoute>();
  const { wallets, renameWallet, deleteWallet, resetApp, isRTL } = useWallets();

  const entry = wallets.find(item => item.id === route.params.id);
  const [name, setName] = useState(entry?.label ?? '');

  const commitName = useCallback(() => {
    const trimmed = name.trim();
    if (entry && trimmed.length > 0 && trimmed !== entry.label) {
      renameWallet(entry.id, trimmed);
    }
  }, [entry, name, renameWallet]);

  const confirmDelete = useCallback(() => {
    if (!entry) {
      return;
    }
    triggerHaptic();
    Alert.alert(
      loc.holdings.removeAccount,
      loc.holdings.confirmPrompt,
      [
        {
          text: loc.holdings.affirmRemoval,
          style: 'destructive',
          onPress: () => {
            if (wallets.length <= 1) {
              resetApp();
              navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
            } else {
              deleteWallet(entry.id);
              navigation.popToTop();
            }
          },
        },
        { text: loc.shared.dismissAbort, style: 'cancel' },
      ],
      { cancelable: false },
    );
  }, [entry, wallets.length, resetApp, deleteWallet, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.holdings.singleHeading,
      headerStyle: { backgroundColor: palette.customHeader },
      headerTintColor: palette.fg,
      headerTitleStyle: {
        fontSize: TYPE.headerTitle.fontSize,
        fontWeight: TYPE.headerTitle.fontWeight,
        color: palette.fg,
      },
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
    });
  }, [navigation, palette.customHeader, palette.fg]);

  if (!entry) {
    return <View style={[styles.fill, { backgroundColor: palette.bg }]} />;
  }

  const wifAddress = entry.wif ? wifReceiveAddress(entry) : '';
  const derivationPath = derivationPathOf(entry);
  const txCount = transactionCountOf(entry);

  const canEditDerivation = isHdWallet(entry) && !!entry.scan;
  const canShowExtendedKey = isHdWallet(entry);
  const canShowAddresses = isHdWallet(entry) && !!entry.scan;

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      {entry.wif && wifAddress ? (
        <>
          <Text style={[styles.label, writingDirection(isRTL)]}>{loc.outflow.destinationField}</Text>
          <Text selectable style={[styles.value, styles.mono, { color: palette.fg }]}>
            {wifAddress}
          </Text>
        </>
      ) : null}

      <Text style={[styles.label, writingDirection(isRTL)]}>{loc.holdings.titleField}</Text>
      <View style={[styles.field, { borderColor: palette.inputBorder, backgroundColor: palette.inputBg }]}>
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={commitName}
          placeholder={loc.holdings.titleField}
          placeholderTextColor={PLACEHOLDER_COLOR}
          style={[styles.fieldInput, { color: palette.fg }]}
        />
      </View>

      <Text style={[styles.label, writingDirection(isRTL)]}>{loc.holdings.kindField}</Text>
      <Text style={[styles.value, writingDirection(isRTL), { color: palette.fg }]}>
        {walletTypeLabel(entry)}
      </Text>

      {entry.multisig ? (
        <>
          <Text style={[styles.label, writingDirection(isRTL)]}>{loc.holdings.cosignedTag}</Text>
          <Text selectable style={[styles.value, styles.mono, { color: palette.fg }]}>
            {`${entry.multisig.m}-of-${entry.multisig.n}`}
          </Text>
        </>
      ) : null}

      {derivationPath ? (
        <>
          <Text style={[styles.label, writingDirection(isRTL)]}>{loc.holdings.pathRoute}</Text>
          <View style={styles.pathRow}>
            <Text selectable style={[styles.value, styles.flex, { color: palette.fg }]}>
              {derivationPath}
            </Text>
            {canEditDerivation ? (
              <Pressable
                onPress={() => navigation.navigate('WalletDerivation', { id: entry.id })}
                style={({ pressed }) => [
                  styles.editPill,
                  { backgroundColor: palette.lightButton },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.editPillText, { color: palette.fg }]}>{loc.holdings.modifyLink}</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      <Text style={[styles.label, writingDirection(isRTL)]}>{loc.holdings.movementTally}</Text>
      <Text style={[styles.value, writingDirection(isRTL), { color: palette.fg }]}>{txCount}</Text>

      {canShowAddresses ? (
        <Pressable
          onPress={() => navigation.navigate('WalletAddresses', { id: entry.id })}
          style={({ pressed }) => [
            styles.linkRow,
            { backgroundColor: palette.bg, borderBottomColor: palette.inputBorder },
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.linkRowTitle, styles.flex, writingDirection(isRTL), { color: palette.fg }]}>
            {loc.holdings.listReceivers}
          </Text>
          <MaterialIcons name="chevron-right" size={20} color={CHEVRON_COLOR} style={mirrorGlyph} />
        </Pressable>
      ) : null}

      {canShowExtendedKey ? (
        <Pressable
          onPress={() => navigation.navigate('WalletXpub', { id: entry.id })}
          style={({ pressed }) => [
            styles.linkRow,
            { backgroundColor: palette.bg, borderBottomColor: palette.inputBorder },
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.linkRowTitle, styles.flex, writingDirection(isRTL), { color: palette.fg }]}>
            {loc.holdings.revealExtendedKey}
          </Text>
          <MaterialIcons name="chevron-right" size={20} color={CHEVRON_COLOR} style={mirrorGlyph} />
        </Pressable>
      ) : null}

      <View style={styles.spacer} />
      <Pressable
        onPress={() => navigation.navigate('WalletExport', { id: entry.id })}
        style={({ pressed }) => [
          styles.secondaryButton,
          { backgroundColor: palette.lightButton },
          pressed && styles.pressed,
        ]}>
        <Text style={[styles.secondaryButtonText, { color: palette.fg }]}>
          {loc.holdings.saveCopyLink}
        </Text>
      </Pressable>

      <View style={styles.spacer} />
      <Pressable onPress={confirmDelete} hitSlop={8}>
        <Text style={styles.deleteText}>{loc.holdings.removeLink}</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: SPACING.xl,
    paddingBottom: SPACING.huge,
  },
  label: {
    ...TYPE.caption,
    color: PLACEHOLDER_COLOR,
    textTransform: 'lowercase',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  value: {
    ...TYPE.phraseIntro,
  },
  mono: {
    fontFamily: 'Menlo',
  },
  field: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: SPACING.md,
  },
  fieldInput: {
    ...TYPE.phraseIntro,
    paddingVertical: SPACING.md,
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.button,
    marginStart: SPACING.md,
  },
  editPillText: {
    ...TYPE.caption,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZE.buttonHeight,
    marginHorizontal: -SPACING.xl,
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linkRowTitle: {
    ...TYPE.button,
    fontWeight: '500',
  },
  spacer: {
    height: SPACING.xxl,
  },
  secondaryButton: {
    height: SIZE.buttonHeight,
    minHeight: SIZE.buttonMinHeight,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZE.buttonPadH,
  },
  secondaryButtonText: {
    ...TYPE.button,
  },
  deleteText: {
    ...TYPE.button,
    color: '#d0021b',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});

export default WalletInfoScreen;
