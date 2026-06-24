import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  Clipboard,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MenuView, type MenuAction, type NativeActionEvent } from '@react-native-menu/menu';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { COLORS, SPACING, TYPE } from '../theme';
import loc from '../i18n';
import { PrimaryButton } from '../components/PrimaryButton';
import { useWallets } from '../wallets/context';
import { isMainnetWif, isValidMnemonic } from '../utils/validation';
import type { AddWalletStackParamList, RootStackParamList } from '../navigation/types';

const KEYBOARD_ACCESSORY_ID = 'import-secret-keyboard-bar';

type ImportNavigation = NativeStackNavigationProp<AddWalletStackParamList, 'ImportWallet'>;
type ImportRoute = RouteProp<AddWalletStackParamList, 'ImportWallet'>;

const normalizeMnemonic = (value: string): string =>
  value.toLowerCase().replace(/[\s,;]+/g, ' ').trim();

const stripBitcoinScheme = (value: string): string =>
  value.replace(/^bitcoin:/i, '').trim();

const writingDirection = (rtl: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: rtl ? 'rtl' : 'ltr',
});

export const ImportWalletScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const { isRTL } = useWallets();
  const navigation = useNavigation<ImportNavigation>();
  const route = useRoute<ImportRoute>();
  const proposedName = route.params?.name;

  const [secretText, setSecretText] = useState('');
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [scanAccounts, setScanAccounts] = useState(false);
  const [wipeClipboard, setWipeClipboard] = useState(true);

  const menuActions = useMemo<MenuAction[]>(
    () => [
      {
        id: 'passphrase',
        title: loc.holdings.secretWord,
        image: 'rectangle.and.pencil.and.ellipsis',
        imageColor: palette.fg,
        state: usePassphrase ? 'on' : 'off',
      },
      {
        id: 'scanAccounts',
        title: loc.holdings.findAccounts,
        image: 'magnifyingglass',
        imageColor: palette.fg,
        state: scanAccounts ? 'on' : 'off',
      },
      {
        id: 'wipeClipboard',
        title: loc.holdings.eraseClipboardAfter,
        image: 'document.on.clipboard',
        imageColor: palette.fg,
        state: wipeClipboard ? 'on' : 'off',
      },
    ],
    [palette.fg, usePassphrase, scanAccounts, wipeClipboard],
  );

  const onMenuAction = useCallback(({ nativeEvent }: NativeActionEvent) => {
    Keyboard.dismiss();
    switch (nativeEvent.event) {
      case 'passphrase':
        setUsePassphrase(previous => !previous);
        break;
      case 'scanAccounts':
        setScanAccounts(previous => !previous);
        break;
      case 'wipeClipboard':
        setWipeClipboard(previous => !previous);
        break;
      default:
        break;
    }
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <MenuView
          shouldOpenOnLongPress={false}
          onPressAction={onMenuAction}
          actions={menuActions}>
          <View style={styles.headerButton}>
            <MaterialIcons name="more-horiz" size={22} color={palette.fg} />
          </View>
        </MenuView>
      ),
    });
  }, [navigation, palette.fg, menuActions, onMenuAction]);

  const trimmed = secretText.trim();
  const canSubmit = trimmed.length > 0;

  const wipeClipboardIfEnabled = useCallback(() => {
    if (wipeClipboard) {
      Clipboard.setString('');
    }
  }, [wipeClipboard]);

  const submit = useCallback(() => {
    const raw = secretText.trim();
    if (!raw) {
      return;
    }

    const phrase = normalizeMnemonic(raw);
    if (isValidMnemonic(phrase)) {
      wipeClipboardIfEnabled();
      navigation.navigate('ImportDiscovery', {
        mnemonic: phrase,
        askPassphrase: usePassphrase,
        origin: 'import',
        name: proposedName,
      });
      return;
    }

    const wifCandidate = stripBitcoinScheme(raw);
    if (isMainnetWif(wifCandidate)) {
      wipeClipboardIfEnabled();
      navigation.navigate('ImportDiscovery', {
        wif: wifCandidate,
        origin: 'import',
        name: proposedName,
      });
      return;
    }

    Alert.alert(loc.restore.recoveryFailureHeading, loc.holdings.restoreFailure);
  }, [secretText, usePassphrase, proposedName, navigation, wipeClipboardIfEnabled]);

  const openScanner = useCallback(() => {
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.navigate('ScanQRCode', {
        onScan: (value: string) => {
          setSecretText(value);
          Keyboard.dismiss();
        },
      });
  }, [navigation]);

  const pasteFromClipboard = useCallback(async () => {
    const text = await Clipboard.getString();
    if (text) {
      setSecretText(text);
    }
    Keyboard.dismiss();
  }, []);

  const clearField = useCallback(() => setSecretText(''), []);
  const dismissKeyboard = useCallback(() => Keyboard.dismiss(), []);

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="always">
      <Text style={[TYPE.cardDesc, styles.explanation, { color: palette.fg }]}>
        {loc.holdings.restoreInstructions}
      </Text>

      <TextInput
        value={secretText}
        onChangeText={setSecretText}
        multiline
        scrollEnabled={false}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        textAlignVertical="top"
        inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_ACCESSORY_ID : undefined}
        style={[
          styles.field,
          {
            backgroundColor: palette.inputBg,
            borderColor: palette.inputBorder,
            color: palette.fg,
          },
        ]}
      />

      <View style={styles.actions}>
        <PrimaryButton
          label={loc.holdings.restoreAction}
          color={canSubmit ? palette.accentBlue : palette.cardGray}
          textColor={canSubmit ? palette.buttonText : palette.muted}
          disabled={!canSubmit}
          onPress={submit}
        />
        <Pressable onPress={openScanner} style={styles.scanLink}>
          <Text style={[TYPE.phraseIntro, { color: palette.fg }, writingDirection(isRTL)]}>
            {loc.restore.cameraCaptureLink}
          </Text>
        </Pressable>
      </View>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
          <View style={[styles.accessoryBar, { backgroundColor: palette.inputBg }]}>
            <Pressable onPress={clearField} style={styles.accessoryButton}>
              <Text style={[styles.accessoryText, { color: palette.fg }]}>
                {loc.outflow.wipeEntry}
              </Text>
            </Pressable>
            <Pressable onPress={pasteFromClipboard} style={styles.accessoryButton}>
              <Text style={[styles.accessoryText, { color: palette.fg }]}>
                {loc.outflow.dropFromClipboard}
              </Text>
            </Pressable>
            <Pressable onPress={dismissKeyboard} style={styles.accessoryButton}>
              <Text style={[styles.accessoryText, { color: palette.fg }]}>
                {loc.outflow.finishEntry}
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  body: {
    padding: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.huge,
  },
  explanation: {
    marginBottom: SPACING.lg,
  },
  field: {
    minHeight: 40,
    borderWidth: 1,
    borderBottomWidth: 0.5,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    writingDirection: 'ltr',
  },
  actions: {
    marginTop: SPACING.xl,
  },
  scanLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    marginTop: SPACING.md,
  },
  headerButton: {
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    maxHeight: 44,
  },
  accessoryButton: {
    minWidth: 100,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  accessoryText: {
    fontSize: 16,
  },
});

export default ImportWalletScreen;
