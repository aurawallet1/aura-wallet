import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  Clipboard,
  Easing,
  LayoutAnimation,
  Pressable,
  ScrollView,
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
import { useWallets } from '../wallets/context';
import { triggerHaptic } from '../utils/haptics';
import type { RootStackParamList } from '../navigation/types';

type AddressQRNavigation = NativeStackNavigationProp<RootStackParamList, 'AddressQR'>;
type AddressQRRoute = RouteProp<RootStackParamList, 'AddressQR'>;

const COPIED_RESET_MS = 1500;
const ELLIPSIS_LENGTH = 6;
const MIN_QR_SIZE = 120;
const MAX_QR_SIZE = 320;
const HORIZONTAL_INSET = 96;
const QR_WIDTH_FACTOR = 0.92;
const QR_HEIGHT_FACTOR = 0.4;
const CARD_QR_GUTTER = 24;
const PRESS_SCALE = 0.97;

const RESIZE_TRANSITION = {
  duration: 200,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
};

const computeQrSize = (width: number, height: number): number => {
  const widthBound = Math.floor((width - HORIZONTAL_INSET) * QR_WIDTH_FACTOR);
  const heightBound = Math.floor(height * QR_HEIGHT_FACTOR);
  return Math.max(MIN_QR_SIZE, Math.min(widthBound, heightBound, MAX_QR_SIZE));
};

export const AddressQRScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<AddressQRNavigation>();
  const route = useRoute<AddressQRRoute>();
  const { isRTL } = useWallets();
  const { address, label } = route.params;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const qrSize = computeQrSize(width, height);
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
      toValue: PRESS_SCALE,
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
      title: label || loc.outflow.destinationField,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: palette.elevated },
      contentStyle: { backgroundColor: palette.elevated },
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
          style={headerCloseStyle}>
          <MaterialIcons name="close" size={22} color={palette.fg} />
        </Pressable>
      ),
    });
  }, [navigation, palette.fg, palette.elevated, label]);

  const handleCopy = () => {
    Clipboard.setString(address);
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

  const prefix = address.slice(0, ELLIPSIS_LENGTH);
  const middle = address.slice(ELLIPSIS_LENGTH, -ELLIPSIS_LENGTH);
  const suffix = address.slice(-ELLIPSIS_LENGTH);

  return (
    <ScrollView
      style={{ backgroundColor: palette.elevated }}
      contentContainerStyle={[rootStyle, { paddingBottom: insets.bottom + SPACING.xxl }]}
      showsVerticalScrollIndicator={false}>
      <Pressable
        onPress={handleCopy}
        onPressIn={animatePressIn}
        onPressOut={animatePressOut}
        disabled={copied}
        accessibilityRole="button"
        accessibilityState={{ disabled: copied }}
        style={cardPressableStyle}>
        <Animated.View
          collapsable={false}
          style={[
            cardStyle,
            {
              backgroundColor: cardBackground,
              width: qrSize + CARD_QR_GUTTER,
              transform: [{ scale: pressScale }],
            },
          ]}>
          <View style={qrFrameStyle}>
            <QRCode value={`bitcoin:${address}`} size={qrSize} />
          </View>
          <View style={spacerStyle} />
          {copied ? (
            <Text style={[addressTextStyle, { color: palette.muted }]}>{loc.core.clipboardDone}</Text>
          ) : (
            <Text
              style={[
                addressTextStyle,
                { color: palette.muted, writingDirection: isRTL ? 'rtl' : 'ltr' },
              ]}>
              <Text style={[emphasisStyle, { color: palette.accentBlue }]}>{prefix}</Text>
              {middle}
              <Text style={[emphasisStyle, { color: palette.accentBlue }]}>{suffix}</Text>
            </Text>
          )}
        </Animated.View>
      </Pressable>
    </ScrollView>
  );
};

const rootStyle = {
  flexGrow: 1,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  paddingHorizontal: SPACING.xxl,
  paddingTop: SPACING.xxl,
};

const cardPressableStyle = {
  alignSelf: 'center' as const,
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
  borderRadius: RADIUS.card,
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

const spacerStyle = { height: 20 };

const addressTextStyle = {
  fontSize: 15,
  lineHeight: 22,
  textAlign: 'center' as const,
  paddingHorizontal: 16,
};

const emphasisStyle = { fontWeight: '600' as const };

const headerCloseStyle = {
  minWidth: 40,
  height: 40,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginRight: -6,
};

export default AddressQRScreen;
