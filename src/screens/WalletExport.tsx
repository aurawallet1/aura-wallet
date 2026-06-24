import React, { useLayoutEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { COLORS, SIZE, SPACING, TYPE, type ColorScheme } from '../theme';
import { copyEphemeralSecret } from '../utils/clipboard';
import loc from '../i18n';
import QRCode from '../components/QRCode';
import QrStaggerReveal from '../components/QrStaggerReveal';
import SeedWordsView from '../components/SeedWordsView';
import { triggerHaptic } from '../utils/haptics';
import { useWallets, type WalletEntry } from '../wallets/context';
import type { RootStackParamList } from '../navigation/types';

type ExportNavigation = NativeStackNavigationProp<RootStackParamList, 'WalletExport'>;
type ExportRoute = RouteProp<RootStackParamList, 'WalletExport'>;

const QR_HORIZONTAL_INSET = 72;
const QR_WIDTH_RATIO = 0.92;
const QR_HEIGHT_RATIO = 0.44;
const QR_MIN_SIZE = 120;
const QR_MAX_SIZE = 500;
const QR_FRAME_PADDING = 24;
const QR_MASK_COLOR = '#FFFFFF';
const LIGHT_CARD_BG = '#F2F2F7';
const DEFAULT_HOLDING_DERIVATION = "m/48'/0'/0'/2'";

const composeHoldingDescriptor = (entry: WalletEntry): string => {
  const holding = entry.multisig;
  if (!holding) {
    return '';
  }
  const primary = holding.scan?.primaryType ?? 'BIP48';
  const account = holding.scan?.result?.data?.[primary];
  const derivation = account?.derivationPath ?? DEFAULT_HOLDING_DERIVATION;

  const lines = [
    '# Aura Wallet multisignature setup file',
    '# this file may contain private information',
    '#',
    `Name: ${entry.label}`,
    `Policy: ${holding.m} of ${holding.n}`,
    `Derivation: ${derivation}`,
    'Format: P2WSH',
    '',
  ];
  for (const seed of holding.mnemonics) {
    lines.push(`seed: ${seed}`);
    lines.push('# warning! sensitive information, do not disclose ^^^ ');
    lines.push('');
  }
  return lines.join('\n');
};

const resolveTypeLabel = (entry: WalletEntry): string => {
  if (entry.multisig) {
    return `${entry.multisig.m}-of-${entry.multisig.n} ${loc.holdings.cosignedTag}`;
  }
  if (entry.wif) {
    return loc.holdingExport.singleSecretFormat;
  }
  return loc.holdingExport.hierarchicalScheme;
};

export const WalletExportScreen = (): React.ReactElement => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const palette: ColorScheme = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<ExportNavigation>();
  const route = useRoute<ExportRoute>();
  const { wallets } = useWallets();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const entry = wallets.find(item => item.id === route.params.id);

  const qrSize = Math.max(
    QR_MIN_SIZE,
    Math.min(
      Math.floor((width - QR_HORIZONTAL_INSET) * QR_WIDTH_RATIO),
      Math.floor(height * QR_HEIGHT_RATIO),
      QR_MAX_SIZE,
    ),
  );
  const cardBg = isDark ? palette.cardGray : LIGHT_CARD_BG;
  const cardWidth = qrSize + QR_FRAME_PADDING;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.holdingExport.backupHeading,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: palette.elevated },
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
          style={styles.headerClose}
        >
          <MaterialIcons name="close" size={22} color={palette.fg} />
        </Pressable>
      ),
    });
  }, [navigation, palette.fg, palette.elevated]);

  if (!entry) {
    return <View style={[styles.placeholder, { backgroundColor: palette.elevated }]} />;
  }

  const typeLine = (
    <Text style={styles.typeText}>{`${loc.holdingExport.kindCaption}${resolveTypeLabel(entry)}.`}</Text>
  );

  const renderQrCard = (value: string): React.ReactElement => (
    <View style={[styles.qrCard, { backgroundColor: cardBg, width: cardWidth }]}>
      <View style={styles.qrFrame}>
        <QrStaggerReveal size={qrSize} maskColor={QR_MASK_COLOR} runKey={value}>
          <QRCode value={value} size={qrSize} />
        </QrStaggerReveal>
      </View>
    </View>
  );

  const copyToClipboard = (value: string): void => {
    // descriptor (contains seeds) and WIF are secrets — auto-clear them.
    copyEphemeralSecret(value);
    triggerHaptic();
  };

  if (entry.multisig) {
    const descriptor = composeHoldingDescriptor(entry);
    return (
      <ScrollView
        style={{ backgroundColor: palette.elevated }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.scanText, { color: palette.fg }]}>{loc.holdings.qrTransferHint}</Text>
        {renderQrCard(descriptor)}
        <Text style={[styles.writeText, { color: palette.fg }]}>{loc.holdings.stashForRecovery}</Text>
        <Pressable
          onPress={() => copyToClipboard(descriptor)}
          style={({ pressed }) => [
            styles.copyBox,
            styles.copyBoxStart,
            { backgroundColor: palette.cardGray },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.copyText, styles.copyTextFlex, { color: palette.fg }]} selectable>
            {descriptor}
          </Text>
          <MaterialIcons name="content-copy" size={20} color={palette.fg} style={styles.copyIcon} />
        </Pressable>
        {typeLine}
      </ScrollView>
    );
  }

  const isMnemonic = !entry.wif;
  const qrValue = entry.wif ? entry.wif : entry.mnemonic;

  return (
    <ScrollView
      style={{ backgroundColor: palette.elevated }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.scanText, { color: palette.fg }]}>{loc.holdings.qrTransferHint}</Text>
      {renderQrCard(qrValue)}
      {isMnemonic ? (
        <>
          <View>
            <Text style={[styles.manualText, { color: palette.fg }]}>
              {loc.holdings.offlineSaveHeading}
            </Text>
            <Text style={[styles.writeText, { color: palette.fg }]}>{loc.holdings.penAndPaperNote}</Text>
          </View>
          <SeedWordsView c={palette} seed={entry.mnemonic} />
          {entry.passphrase ? (
            <Text style={[styles.writeText, { color: palette.fg }]}>
              {`${loc.holdingExport.secretWordTag}${entry.passphrase}`}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={[styles.writeText, { color: palette.fg }]}>{loc.holdings.stashForRecovery}</Text>
          <Pressable
            onPress={() => copyToClipboard(entry.wif ?? '')}
            style={({ pressed }) => [
              styles.copyBox,
              { backgroundColor: palette.cardGray },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.copyText, styles.copyTextFlex, { color: palette.fg }]} selectable>
              {entry.wif}
            </Text>
            <MaterialIcons name="content-copy" size={20} color={palette.fg} style={styles.copyIcon} />
          </Pressable>
        </>
      )}
      {typeLine}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  placeholder: { flex: 1 },
  headerClose: {
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
  content: {
    justifyContent: 'center',
    flexGrow: 1,
    gap: 32,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  scanText: { textAlign: 'center', fontSize: 20 },
  writeText: { textAlign: 'center', fontSize: 17 },
  manualText: { textAlign: 'center', fontSize: 20, marginBottom: 10 },
  typeText: { textAlign: 'center', fontSize: 17, color: 'grey' },
  qrCard: {
    borderRadius: 26,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 16,
    alignItems: 'center',
    alignSelf: 'center',
  },
  qrFrame: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 6,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  copyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  copyBoxStart: { alignItems: 'flex-start' },
  copyText: { fontSize: 17 },
  copyTextFlex: { flex: 1 },
  copyIcon: { marginHorizontal: 8 },
  pressed: { opacity: 0.6 },
});

export default WalletExportScreen;
