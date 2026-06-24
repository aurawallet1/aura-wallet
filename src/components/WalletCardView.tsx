import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clipboard,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import loc from '../i18n';
import {
  COLORS,
  RADIUS,
  SIZE,
  SPACING,
  TYPE,
  type ColorScheme,
} from '../theme';
import type {
  DisplayUnit,
  MultisigHoldingResponse,
  ScanResponse,
  ScriptType,
  WifScanResult,
} from '../types/index';
import { formatUnit, unitLabel } from '../utils/currency';
import { truncateAddress } from '../utils/format';
import { triggerHaptic } from '../utils/haptics';
import AddressReveal from './AddressReveal';
import AddressSkeleton from './AddressSkeleton';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const REVEAL_HOLD_MS = 880;
const COPY_FLASH_MS = 1500;
const MAX_KEY_GLYPHS = 3;
const KEY_GLYPH = 'vpn-key';

const RESIZE_TRANSITION = {
  duration: 200,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
} as const;

interface HoldingData {
  m: number;
  n: number;
  mnemonics: string;
  scan: MultisigHoldingResponse | null;
}

export interface WalletEntry {
  id: string;
  label: string;
  mnemonic: string;
  passphrase: string;
  wif?: string;
  scan: ScanResponse | WifScanResult | null;
  origin: 'import' | 'create';
  multisig?: HoldingData;
  pathType?: ScriptType;
  receiveAddress?: string;
}

type ScanLike = ScanResponse | WifScanResult | MultisigHoldingResponse | null;

interface ScanDigest {
  ready: boolean;
  address: string;
  sats: number;
}

const readReceiveAddress = (account: unknown): string => {
  const receive = (account as { receive?: { fresh?: { address?: string }; used?: Array<{ address?: string }> } })?.receive;
  return receive?.fresh?.address ?? receive?.used?.[0]?.address ?? '';
};

const digestScan = (entry: WalletEntry): ScanDigest => {
  if (entry.multisig) {
    const scan = entry.multisig.scan;
    if (!scan) {
      return { ready: false, address: '', sats: 0 };
    }
    const account = scan.result.data[scan.primaryType];
    return {
      ready: true,
      address: readReceiveAddress(account),
      sats: scan.result.grandTotals?.totalBalance ?? 0,
    };
  }

  const local = entry.receiveAddress ?? '';
  const scan = entry.scan;
  if (!scan) {
    return { ready: local.length > 0, address: local, sats: 0 };
  }
  const key = (entry.pathType ?? scan.primaryType) as ScriptType;
  const account = (scan.result.data as Record<string, unknown>)[key];
  return {
    ready: true,
    address: readReceiveAddress(account) || local,
    sats: scan.result.grandTotals?.totalBalance ?? 0,
  };
};

const stripBitcoinUri = (raw: string): string =>
  raw.replace(/^bitcoin:/i, '').split('?')[0].trim();

type Navigate = (route: string, params?: Record<string, unknown>) => void;

export interface WalletCardViewProps {
  entry: WalletEntry;
  navigate: Navigate;
  unit: DisplayUnit;
  isRTL: boolean;
}

const headStripColor = (entry: WalletEntry, c: ColorScheme): string => {
  if (entry.multisig) return c.accentPurple;
  if (entry.wif) return c.accentGreen;
  if (entry.origin === 'import') return c.accentOrange;
  return c.accentBlue;
};

const walletTypeLabel = (entry: WalletEntry): string => {
  if (entry.multisig) return loc.holdings.cosignedKind;
  if (entry.wif) return 'WIF';
  return loc.holdings.hierarchicalKind;
};

const WalletCardView: React.FC<WalletCardViewProps> = ({ entry, navigate, unit, isRTL }) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const c = isDark ? COLORS.dark : COLORS.light;

  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const currentScan: ScanLike = entry.multisig ? entry.multisig.scan : entry.scan;
  const [revealing, setRevealing] = useState(false);
  const lastScan = useRef<ScanLike>(currentScan);
  useEffect(() => {
    if (lastScan.current === null && currentScan !== null) {
      setRevealing(true);
      const handle = setTimeout(() => setRevealing(false), REVEAL_HOLD_MS);
      lastScan.current = currentScan;
      return () => clearTimeout(handle);
    }
    lastScan.current = currentScan;
  }, [currentScan]);

  const digest = useMemo(() => digestScan(entry), [entry]);
  const { address, sats } = digest;
  const headColor = headStripColor(entry, c);
  const typeLabel = walletTypeLabel(entry);
  const balanceText = formatUnit(sats, unit);
  const unitText = unitLabel(unit);

  const goReceive = useCallback(() => {
    if (!address) return;
    navigate('ReceiveSheet', { address, label: entry.label });
  }, [address, entry.label, navigate]);

  const goScanToPay = useCallback(() => {
    navigate('ScanQRCode', {
      onScan: (value: string) => {
        navigate('SendRoot', {
          screen: 'SendAmount',
          params: { id: entry.id, address: stripBitcoinUri(value) },
        });
      },
    });
  }, [entry.id, navigate]);

  const goSend = useCallback(() => {
    navigate('SendRoot', { screen: 'SendAmount', params: { id: entry.id } });
  }, [entry.id, navigate]);

  const goDetail = useCallback(() => {
    navigate('WalletDetail', { id: entry.id });
  }, [entry.id, navigate]);

  const copyAddress = useCallback(() => {
    if (!address) return;
    Clipboard.setString(address);
    triggerHaptic();
    LayoutAnimation.configureNext(RESIZE_TRANSITION);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => {
      LayoutAnimation.configureNext(RESIZE_TRANSITION);
      setCopied(false);
    }, COPY_FLASH_MS);
  }, [address]);

  const writingDir = isRTL ? 'rtl' : 'ltr';

  const renderTypeGlyph = () => {
    if (entry.multisig) {
      const count = Math.min(entry.multisig.n, MAX_KEY_GLYPHS);
      return (
        <View style={styles.keyCluster}>
          {Array.from({ length: count }, (_, i) => (
            <MaterialIcons
              key={i}
              name={KEY_GLYPH as IconName}
              size={16}
              color="#FFFFFF"
              style={i > 0 ? styles.keyClusterGap : undefined}
            />
          ))}
        </View>
      );
    }
    if (entry.wif) {
      return (
        <MaterialIcons
          name={KEY_GLYPH as IconName}
          size={18}
          color="#FFFFFF"
          style={styles.typeGlyph}
        />
      );
    }
    return (
      <MaterialIcons
        name={'hd' as IconName}
        size={20}
        color="#FFFFFF"
        style={styles.typeGlyph}
      />
    );
  };

  const renderAddressLine = () => {
    if (!address) {
      return (
        <View style={[styles.fill, styles.skeletonHolder]}>
          <AddressSkeleton c={c} isDark={isDark} />
        </View>
      );
    }
    if (revealing) {
      return (
        <View style={styles.fill}>
          <AddressReveal c={c} runKey={address}>
            <Text numberOfLines={1} style={[TYPE.cardDesc, { color: c.fg }]}>
              {truncateAddress(address)}
            </Text>
          </AddressReveal>
        </View>
      );
    }
    return (
      <Text numberOfLines={1} style={[styles.fill, TYPE.cardDesc, { color: c.fg }]}>
        {truncateAddress(address)}
      </Text>
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: c.cardGray }]}>
      <View style={[styles.headStrip, { backgroundColor: headColor }]}>
        <Text numberOfLines={1} style={[styles.headText, { writingDirection: writingDir }]}>
          {typeLabel}
        </Text>
        {renderTypeGlyph()}
      </View>

      <View style={styles.body}>
        <Text
          numberOfLines={1}
          style={[styles.name, { writingDirection: writingDir, color: c.fg }]}
        >
          {entry.label}
        </Text>

        <View
          style={[
            styles.balanceRow,
            styles.forceLtr,
            { justifyContent: isRTL ? 'flex-end' : 'flex-start' },
          ]}
        >
          <Text numberOfLines={1} style={[styles.balanceNum, { color: c.fg }]}>
            {balanceText}
          </Text>
          <Text numberOfLines={1} style={[styles.balanceUnit, { color: c.muted }]}>
            {unitText}
          </Text>
        </View>

        <View
          collapsable={false}
          style={[styles.addressChip, styles.forceLtr, { backgroundColor: c.fieldBg }]}
        >
          {renderAddressLine()}
          <Pressable onPress={copyAddress} hitSlop={8}>
            <Text style={[TYPE.cardDesc, { color: c.accentBlue }]}>
              {copied ? loc.appGeneral.duplicatedToClipboard : loc.ledger.duplicateToClipboard}
            </Text>
          </Pressable>
          <View style={[styles.chipDivider, { backgroundColor: c.fieldBorder }]} />
          <Pressable onPress={goScanToPay} hitSlop={8}>
            <Text style={[TYPE.cardDesc, { color: c.accentBlue }]}>{loc.appGeneral.scannableTag}</Text>
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={goSend} style={[styles.action, { backgroundColor: c.fieldBg }]}>
            <Text style={[TYPE.button, { color: c.accentBlue }]}>{loc.outflow.dispatchHeading}</Text>
          </Pressable>
          <Pressable onPress={goReceive} style={[styles.action, { backgroundColor: c.fieldBg }]}>
            <Text style={[TYPE.button, { color: c.accentBlue }]}>{loc.inflow.incomingTab}</Text>
          </Pressable>
          <Pressable onPress={goDetail} style={[styles.actionMore, { backgroundColor: c.fieldBg }]}>
            <MaterialIcons name={'zoom-out-map' as IconName} size={22} color={c.fg} />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  headStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZE.cardPad,
    paddingVertical: 6,
  },
  headText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: TYPE.cardDesc.fontSize,
    fontWeight: '700',
  },
  typeGlyph: {
    marginStart: 8,
  },
  keyCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    marginStart: 8,
  },
  keyClusterGap: {
    marginLeft: 3,
  },
  body: {
    padding: SIZE.cardPad,
  },
  name: {
    fontSize: TYPE.cardDesc.fontSize,
    fontWeight: '600',
    marginBottom: 2,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  balanceNum: {
    fontSize: TYPE.balance.fontSize,
    fontWeight: '600',
    flexShrink: 1,
  },
  balanceUnit: {
    fontSize: TYPE.cardDesc.fontSize,
    fontWeight: '500',
    marginLeft: 4,
  },
  addressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.control,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginTop: SPACING.xl,
  },
  chipDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    marginHorizontal: SPACING.md,
  },
  skeletonHolder: {
    justifyContent: 'center',
    height: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  action: {
    flex: 1,
    height: SIZE.buttonHeight,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: SPACING.md,
  },
  actionMore: {
    width: SIZE.buttonHeight,
    height: SIZE.buttonHeight,
    borderRadius: RADIUS.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    flex: 1,
  },
  forceLtr: {
    direction: 'ltr',
  },
});

export default WalletCardView;
