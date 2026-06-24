import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  Clipboard,
  Easing,
  LayoutAnimation,
  Pressable,
  ScrollView,
  Share,
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
import loc from '../i18n';
import QRCode from '../components/QRCode';
import QrStaggerReveal from '../components/QrStaggerReveal';
import { triggerHaptic } from '../utils/haptics';
import { useWallets } from '../wallets/context';
import type { RootStackParamList } from '../navigation/types';

type ReceiveNavigation = NativeStackNavigationProp<RootStackParamList, 'ReceiveSheet'>;
type ReceiveRoute = RouteProp<RootStackParamList, 'ReceiveSheet'>;

const QR_HORIZONTAL_INSET = 72;
const QR_WIDTH_RATIO = 0.92;
const QR_HEIGHT_RATIO = 0.44;
const QR_MIN_SIZE = 120;
const QR_MAX_SIZE = 500;
const QR_FRAME_PADDING = 24;
const QR_MASK_COLOR = '#FFFFFF';
const LIGHT_CARD_BG = '#F2F2F7';

const PRESS_SCALE = 0.97;
const PRESS_IN_DURATION = 110;
const PRESS_OUT_DURATION = 140;
const COPIED_RESET_DELAY = 1500;
const ADDRESS_ACCENT_LEN = 6;

const NEWLINE = String.fromCharCode(10);

const RESIZE_ANIM = {
  duration: 200,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
};

const splitForTwoLines = (value: string): string => {
  const collapsed = value.split(NEWLINE).join('');
  if (collapsed.length <= 1) {
    return collapsed;
  }
  const pivot = Math.ceil(collapsed.length / 2);
  return collapsed.slice(0, pivot) + NEWLINE + collapsed.slice(pivot);
};

const rtlWriting = (rightToLeft: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: rightToLeft ? 'rtl' : 'ltr',
});

export const ReceiveSheetScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette: ColorScheme = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<ReceiveNavigation>();
  const route = useRoute<ReceiveRoute>();
  const { address, customUri, customAmount, customLabel } = route.params;
  const { isRTL } = useWallets();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const qrSize = Math.max(
    QR_MIN_SIZE,
    Math.min(
      Math.floor((width - QR_HORIZONTAL_INSET) * QR_WIDTH_RATIO),
      Math.floor(height * QR_HEIGHT_RATIO),
      QR_MAX_SIZE,
    ),
  );

  const uri = customUri || `bitcoin:${address}`;
  const copyTarget = customUri || address;
  const cardBg = isDark ? palette.cardGray : LIGHT_CARD_BG;

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

  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = (): void => {
    Animated.timing(scale, {
      toValue: PRESS_SCALE,
      duration: PRESS_IN_DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = (): void => {
    Animated.timing(scale, {
      toValue: 1,
      duration: PRESS_OUT_DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.inflow.incomingTab,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: palette.customHeader },
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
  }, [navigation, palette.fg, palette.customHeader]);

  const copyToClipboard = (): void => {
    Clipboard.setString(copyTarget);
    triggerHaptic();
    LayoutAnimation.configureNext(RESIZE_ANIM);
    setCopied(true);
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }
    resetTimer.current = setTimeout(() => {
      LayoutAnimation.configureNext(RESIZE_ANIM);
      setCopied(false);
    }, COPIED_RESET_DELAY);
  };

  const balanced = splitForTwoLines(copyTarget);
  const head = balanced.slice(0, ADDRESS_ACCENT_LEN);
  const middle = balanced.slice(ADDRESS_ACCENT_LEN, -ADDRESS_ACCENT_LEN);
  const tail = balanced.slice(-ADDRESS_ACCENT_LEN);

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={[styles.root, { paddingBottom: insets.bottom + SPACING.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={copyToClipboard}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={copied}
        accessibilityRole="button"
        style={styles.cardPressable}
      >
        <Animated.View
          collapsable={false}
          style={[
            styles.card,
            { backgroundColor: cardBg, width: qrSize + QR_FRAME_PADDING, transform: [{ scale }] },
          ]}
        >
          {customAmount ? (
            <Text style={[styles.amount, { color: palette.fg }]}>
              {customAmount} BTC{customLabel ? ` · ${customLabel}` : ''}
            </Text>
          ) : null}
          <View style={styles.qrWrapper}>
            <QrStaggerReveal size={qrSize} maskColor={QR_MASK_COLOR} runKey={uri}>
              <QRCode value={uri} size={qrSize} />
            </QrStaggerReveal>
          </View>
          <View style={styles.spacer} />
          {copied ? (
            <Text style={[styles.address, { color: palette.muted }]}>{loc.core.clipboardDone}</Text>
          ) : (
            <Text style={[styles.address, { color: palette.muted }]}>
              <Text style={[styles.addressAccent, { color: palette.accentBlue }]}>{head}</Text>
              {middle}
              <Text style={[styles.addressAccent, { color: palette.accentBlue }]}>{tail}</Text>
            </Text>
          )}
        </Animated.View>
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          onPress={() => navigation.navigate('ReceiveAmount', { address })}
          style={styles.requestLink}
        >
          <Text style={[styles.requestLinkText, { color: palette.fg }]}>{loc.inflow.solicitFunds}</Text>
        </Pressable>
        <Pressable
          onPress={() => Share.share({ message: uri })}
          style={[styles.shareButton, { backgroundColor: palette.accentBlue }]}
        >
          <Text style={[TYPE.button, rtlWriting(isRTL), { color: palette.buttonText }]}>
            {loc.appGeneral.sendToOthers}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  headerClose: {
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
  cardPressable: {
    alignSelf: 'center',
  },
  card: {
    borderRadius: 26,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 18,
    alignItems: 'center',
    alignSelf: 'center',
  },
  amount: {
    fontSize: TYPE.balance.fontSize,
    fontWeight: TYPE.balance.fontWeight,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  qrWrapper: {
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
  spacer: {
    height: SPACING.md,
  },
  address: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  addressAccent: {
    fontWeight: '700',
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    marginTop: SPACING.xxl,
    gap: SPACING.lg,
  },
  requestLink: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  requestLinkText: {
    fontSize: TYPE.button.fontSize,
    fontWeight: '600',
    textAlign: 'center',
  },
  shareButton: {
    width: '100%',
    minHeight: SIZE.buttonHeight,
    borderRadius: SIZE.buttonHeight / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZE.buttonPadH,
  },
});

export default ReceiveSheetScreen;
