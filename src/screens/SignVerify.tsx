import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Keyboard,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import loc from '../i18n';
import { COLORS, SIZE, TYPE, type ColorScheme } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { useWallets } from '../wallets/context';
import { signMessage, verifyMessage } from '../wallets/message';
import { triggerHaptic, triggerSuccessHaptic } from '../utils/haptics';

type SignVerifyNavigation = NativeStackNavigationProp<RootStackParamList, 'SignVerify'>;
type SignVerifyRoute = RouteProp<RootStackParamList, 'SignVerify'>;

const PLACEHOLDER_COLOR = '#81868e';
const SHARE_BUTTON_BG = '#3A3A3C';
const VERIFY_LINK_BASE = 'https://aura.wallet/verify-signature';

const directionStyle = (rightToLeft: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: rightToLeft ? 'rtl' : 'ltr',
});

const valueDirection = (value: string, rightToLeft: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: value ? 'ltr' : rightToLeft ? 'rtl' : 'ltr',
});

const mirrorGlyph = { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] };

const buildVerifyLink = (address: string, message: string, signature: string): string =>
  `${VERIFY_LINK_BASE}?a=${encodeURIComponent(address)}&m=${encodeURIComponent(message)}&s=${encodeURIComponent(signature)}`;

const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const yieldFrame = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 10));

export const SignVerifyScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette: ColorScheme = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<SignVerifyNavigation>();
  const route = useRoute<SignVerifyRoute>();
  const insets = useSafeAreaInsets();
  const { isRTL } = useWallets();
  const { wif } = route.params;

  const [address, setAddress] = useState(route.params.address ?? '');
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.addrBook.cryptoProofScreenHeading,
      headerBackVisible: false,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: palette.elevated },
      headerTintColor: palette.fg,
      headerTitleStyle: {
        fontSize: TYPE.headerTitle.fontSize,
        fontWeight: TYPE.headerTitle.fontWeight,
        color: palette.fg,
      },
      headerRight: () => (
        <Pressable onPress={() => navigation.goBack()} hitSlop={SIZE.closeHit} style={styles.closeButton}>
          <MaterialIcons name="close" size={22} color={palette.fg} />
        </Pressable>
      ),
    });
  }, [navigation, palette.elevated, palette.fg]);

  const handleSign = async (): Promise<void> => {
    setBusy(true);
    await yieldFrame();
    try {
      const produced = signMessage(message, wif, address);
      setSignature(produced);
      setShareVisible(true);
      triggerHaptic();
    } catch (error) {
      Alert.alert(loc.faults.problemLabel, errorMessage(error, loc.msgSigning.signatureCreationFailed));
    }
    setBusy(false);
  };

  const handleVerify = async (): Promise<void> => {
    setBusy(true);
    await yieldFrame();
    try {
      const valid = verifyMessage(message, address, signature);
      Alert.alert(
        valid ? loc.core.completedOk : loc.faults.problemLabel,
        valid ? loc.addrBook.authenticityConfirmed : loc.addrBook.authenticityRejected,
      );
      if (valid) {
        triggerSuccessHaptic();
      }
    } catch (error) {
      Alert.alert(loc.faults.problemLabel, errorMessage(error, loc.msgSigning.signatureCheckFailed));
    }
    setBusy(false);
  };

  const handleShare = (): void => {
    Share.share({ message: buildVerifyLink(address, message, signature) }).catch(() => {});
  };

  if (busy) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: palette.elevated }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const fieldStyle = [
    styles.field,
    { borderColor: palette.inputBorder, backgroundColor: palette.inputBg, color: palette.fg },
  ];

  return (
    <View style={[styles.root, { backgroundColor: palette.elevated }]}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        {!keyboardVisible ? (
          <>
            <View style={styles.gapLarge} />
            <Text style={[styles.help, directionStyle(isRTL), { color: palette.fg }]}>
              {loc.addrBook.proofToolExplainer}
            </Text>
            <View style={styles.gapLarge} />
          </>
        ) : null}

        <TextInput
          multiline
          textAlignVertical="top"
          blurOnSubmit
          placeholder={loc.outflow.destinationField}
          placeholderTextColor={PLACEHOLDER_COLOR}
          value={address}
          onChangeText={text => setAddress(text.replace('\n', ''))}
          style={[fieldStyle, valueDirection(address, isRTL)]}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
        />

        <View style={styles.gapSmall} />

        <TextInput
          multiline
          textAlignVertical="top"
          placeholder={loc.addrBook.textBodyHint}
          placeholderTextColor={PLACEHOLDER_COLOR}
          value={message}
          onChangeText={setMessage}
          style={[fieldStyle, styles.messageField, directionStyle(isRTL)]}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          scrollEnabled
        />

        <View style={styles.gapSmall} />

        <TextInput
          multiline
          textAlignVertical="top"
          blurOnSubmit
          placeholder={loc.addrBook.cryptoStampHint}
          placeholderTextColor={PLACEHOLDER_COLOR}
          value={signature}
          onChangeText={text => setSignature(text.replace('\n', ''))}
          style={[fieldStyle, valueDirection(signature, isRTL)]}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
        />

        <View style={styles.gapHuge} />

        {!keyboardVisible ? (
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={handleVerify}
              style={[styles.button, styles.verifyButton, { backgroundColor: palette.lightButton }]}>
              <Text style={[styles.buttonText, directionStyle(isRTL), { color: palette.fg }]}>
                {loc.addrBook.checkProofAction}
              </Text>
            </TouchableOpacity>
            <View style={styles.gapLarge} />
            <TouchableOpacity
              onPress={handleSign}
              style={[styles.button, styles.signButton, { backgroundColor: palette.accentBlue }]}>
              <Text style={[styles.buttonText, styles.signButtonText, directionStyle(isRTL)]}>
                {loc.addrBook.generateProofAction}
              </Text>
            </TouchableOpacity>
            <View style={styles.gapSmall} />
          </View>
        ) : null}
      </ScrollView>

      {shareVisible && !keyboardVisible ? (
        <View style={[styles.floatWrap, { bottom: insets.bottom + 16 }]}>
          <TouchableOpacity onPress={handleShare} style={styles.floatButton} activeOpacity={0.8}>
            <MaterialIcons name="open-in-new" size={18} color="#FFFFFF" style={mirrorGlyph} />
            <Text style={[styles.floatText, directionStyle(isRTL)]}>{loc.inflow.distributeQr}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  closeButton: {
    paddingHorizontal: 4,
  },
  help: {
    ...TYPE.cardDesc,
    fontWeight: '400',
    marginHorizontal: 20,
  },
  field: {
    marginHorizontal: 20,
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderBottomWidth: 0.5,
    borderRadius: 4,
    textAlignVertical: 'top',
  },
  messageField: {
    minHeight: 80,
    maxHeight: 200,
  },
  actions: {
    alignSelf: 'stretch',
    marginHorizontal: 20,
  },
  button: {
    minHeight: 45,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  verifyButton: {
    borderRadius: 7,
  },
  signButton: {
    borderRadius: 25,
  },
  buttonText: {
    marginHorizontal: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  signButtonText: {
    color: '#FFFFFF',
  },
  floatWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  floatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 100,
    paddingHorizontal: 16,
    backgroundColor: SHARE_BUTTON_BG,
  },
  floatText: {
    marginHorizontal: 8,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  gapSmall: {
    height: 10,
  },
  gapLarge: {
    height: 20,
  },
  gapHuge: {
    height: 40,
  },
});

export default SignVerifyScreen;
