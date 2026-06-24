import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Clipboard,
  Easing,
  LayoutAnimation,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { COLORS, RADIUS, SIZE, SPACING, TYPE } from '../theme';
import loc from '../i18n';
import QRCode from '../components/QRCode';
import { QrStaggerReveal } from '../components/QrStaggerReveal';
import { useWallets, type WalletEntry } from '../wallets/context';
import { accountExtendedPublicKey } from '../wallets/derivation';
import { triggerHaptic } from '../utils/haptics';
import type { RootStackParamList } from '../navigation/types';
import type { ScanResponse, ScriptType, WifScanResult } from '../types/index';

type XpubNavigation = NativeStackNavigationProp<RootStackParamList, 'WalletXpub'>;
type XpubRoute = RouteProp<RootStackParamList, 'WalletXpub'>;

const COPIED_RESET_MS = 1500;

const RESIZE_TRANSITION = {
  duration: 200,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
};

const FINGERPRINT_LENGTH = 6;

const directionFor = (rtl: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: rtl ? 'rtl' : 'ltr',
});

const resolveExtendedKey = (entry: WalletEntry): string => {
  if (entry.multisig) {
    const zpubs = entry.multisig.scan?.result?.zpubs;
    return Array.isArray(zpubs) && zpubs.length > 0 ? zpubs.join('\n') : '';
  }
  if (!entry.mnemonic) {
    return '';
  }
  const scriptType = (entry.pathType ?? entry.scan?.primaryType ?? 'BIP84') as ScriptType;
  try {
    return accountExtendedPublicKey(entry.mnemonic, entry.passphrase, scriptType);
  } catch {
    return '';
  }
};

export const WalletXpubScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<XpubNavigation>();
  const route = useRoute<XpubRoute>();
  const { wallets, isRTL } = useWallets();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const entry = wallets.find(item => item.id === route.params.id);
  const extendedKey = useMemo(() => (entry ? resolveExtendedKey(entry) : ''), [entry]);

  const qrSize = Math.max(
    120,
    Math.min(Math.floor((width - 72) * 0.92), Math.floor(height * 0.44), 500),
  );
  const cardBackground = isDark ? palette.cardGray : '#F2F2F7';

  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    },
    [],
  );

  const pressScale = useRef(new Animated.Value(1)).current;
  const animatePressIn = () =>
    Animated.timing(pressScale, {
      toValue: 0.97,
      duration: 110,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  const animatePressOut = () =>
    Animated.timing(pressScale, {
      toValue: 1,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.holdings.extendedKeyHeading,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: palette.customHeader },
      headerTintColor: palette.fg,
      headerTitleStyle: {
        fontSize: TYPE.headerTitle.fontSize,
        fontWeight: TYPE.headerTitle.fontWeight,
        color: palette.fg,
      },
      headerRight: () => (
        <Pressable onPress={() => navigation.goBack()} hitSlop={SIZE.closeHit} style={headerCloseStyle}>
          <MaterialIcons name="close" size={22} color={palette.fg} />
        </Pressable>
      ),
    });
  }, [navigation, palette.fg, palette.customHeader]);

  const handleCopy = () => {
    Clipboard.setString(extendedKey);
    triggerHaptic();
    LayoutAnimation.configureNext(RESIZE_TRANSITION);
    setCopied(true);
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }
    resetTimer.current = setTimeout(() => {
      LayoutAnimation.configureNext(RESIZE_TRANSITION);
      setCopied(false);
    }, COPIED_RESET_MS);
  };

  const handleShare = () => {
    Share.share({ message: extendedKey });
  };

  if (!entry || !extendedKey) {
    return <View style={[fillStyle, { backgroundColor: palette.bg }]} />;
  }

  const prefix = extendedKey.slice(0, FINGERPRINT_LENGTH);
  const body = extendedKey.slice(FINGERPRINT_LENGTH, -FINGERPRINT_LENGTH);
  const suffix = extendedKey.slice(-FINGERPRINT_LENGTH);

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={[rootStyle, { paddingBottom: insets.bottom + SPACING.lg }]}
      showsVerticalScrollIndicator={false}>
      <Pressable
        onPress={handleCopy}
        onPressIn={animatePressIn}
        onPressOut={animatePressOut}
        disabled={copied}
        accessibilityRole="button"
        style={cardPressableStyle}>
        <Animated.View
          collapsable={false}
          style={[
            cardStyle,
            {
              backgroundColor: cardBackground,
              width: qrSize + 24,
              transform: [{ scale: pressScale }],
            },
          ]}>
          <View style={qrFrameStyle}>
            <QrStaggerReveal size={qrSize} maskColor="#FFFFFF" runKey={extendedKey}>
              <QRCode value={extendedKey} size={qrSize} />
            </QrStaggerReveal>
          </View>
          <View style={spacerStyle} />
          {copied ? (
            <Text style={[keyTextStyle, { color: palette.muted }]}>{loc.core.clipboardDone}</Text>
          ) : (
            <Text style={[keyTextStyle, { color: palette.muted }]}>
              <Text style={[emphasisStyle, { color: palette.accentBlue }]}>{prefix}</Text>
              {body}
              <Text style={[emphasisStyle, { color: palette.accentBlue }]}>{suffix}</Text>
            </Text>
          )}
        </Animated.View>
      </Pressable>
      <View style={actionsStyle}>
        <Pressable onPress={handleShare} style={[shareButtonStyle, { backgroundColor: palette.accentBlue }]}>
          <Text style={[TYPE.button, directionFor(isRTL), { color: palette.buttonText }]}>
            {loc.appGeneral.sendToOthers}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const fillStyle = { flex: 1 };

const rootStyle = {
  flexGrow: 1,
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
  paddingBottom: SPACING.lg,
};

const cardPressableStyle = {
  alignSelf: 'center' as const,
  marginTop: 56,
  marginBottom: 8,
};

const cardStyle = {
  borderRadius: 26,
  paddingHorizontal: 6,
  paddingTop: 6,
  paddingBottom: 16,
  alignItems: 'center' as const,
};

const qrFrameStyle = {
  backgroundColor: '#FFFFFF',
  borderRadius: 20,
  padding: 6,
  alignSelf: 'center' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 12,
  elevation: 4,
};

const spacerStyle = { height: 24 };

const keyTextStyle = {
  fontSize: 15,
  lineHeight: 22,
  textAlign: 'center' as const,
  paddingHorizontal: 16,
  writingDirection: 'ltr' as const,
};

const emphasisStyle = { fontWeight: '500' as const };

const actionsStyle = {
  width: '100%' as const,
  paddingHorizontal: 32,
  marginBottom: 16,
};

const shareButtonStyle = {
  height: SIZE.buttonHeight,
  borderRadius: RADIUS.button,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const headerCloseStyle = {
  minWidth: 40,
  height: 40,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginRight: -6,
};

export default WalletXpubScreen;
