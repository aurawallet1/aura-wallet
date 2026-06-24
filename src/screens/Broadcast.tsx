import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import loc from '../i18n';
import { COLORS, TYPE, type ColorScheme } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { useWallets } from '../wallets/context';
import { explorerTxUrl } from '../network/blockExplorers';
import { broadcastRawTransaction, isValidRawHex } from '../network/mempool';
import { triggerErrorHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { PrimaryButton } from '../components/PrimaryButton';

type BroadcastNavigation = NativeStackNavigationProp<RootStackParamList, 'Broadcast'>;

type SubmissionPhase = 'idle' | 'sending' | 'sent' | 'failed';

const PLACEHOLDER_COLOR = '#81868e';
const DISABLED_BG_LIGHT = '#eef0f4';
const DISABLED_BG_DARK = '#3A3A3C';
const DISABLED_FG = '#9aa0aa';
const SOLID_WHITE = '#FFFFFF';
const CHECK_DISC_BG = '#ccddf9';
const CHECK_GLYPH_LIGHT = '#0f5cc0';
const CHECK_GLYPH_DARK = '#0A84FF';

export const BroadcastScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette: ColorScheme = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<BroadcastNavigation>();
  const { blockExplorer } = useWallets();

  const surfaceBg = isDark ? palette.bg : palette.cardGray;
  const panelBg = isDark ? palette.cardGray : palette.bg;

  const [rawHex, setRawHex] = useState('');
  const [phase, setPhase] = useState<SubmissionPhase>('idle');
  const [resultTxid, setResultTxid] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.outflow.relayAction,
      headerLargeTitle: false,
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
      headerBackVisible: true,
      headerTransparent: false,
      headerStyle: { backgroundColor: surfaceBg },
      headerTintColor: palette.fg,
      headerTitleStyle: {
        fontSize: TYPE.headerTitle.fontSize,
        fontWeight: TYPE.headerTitle.fontWeight,
        color: palette.fg,
      },
    });
  }, [navigation, palette.fg, surfaceBg]);

  const openScanner = useCallback(() => {
    navigation.navigate('ScanQRCode', {
      onScan: (value: string) => {
        setRawHex(value.trim());
        setPhase('idle');
      },
    });
  }, [navigation]);

  const handleChange = useCallback(
    (text: string) => {
      setRawHex(text);
      setPhase(current => (current === 'failed' ? 'idle' : current));
    },
    [],
  );

  const submit = useCallback(async () => {
    Keyboard.dismiss();
    const candidate = rawHex.trim();
    if (!isValidRawHex(candidate)) {
      setPhase('failed');
      triggerErrorHaptic();
      Alert.alert(loc.faults.problemLabel, loc.outflow.relayUnsuccessful);
      return;
    }
    setPhase('sending');
    const outcome = await broadcastRawTransaction(candidate);
    if (outcome.success && outcome.txid) {
      setResultTxid(outcome.txid);
      setPhase('sent');
      triggerSuccessHaptic();
      return;
    }
    setPhase('failed');
    triggerErrorHaptic();
    Alert.alert(loc.faults.problemLabel, outcome.error ?? loc.faults.relayUnsuccessful);
  }, [rawHex]);

  const openInExplorer = useCallback(() => {
    Linking.openURL(explorerTxUrl(blockExplorer, resultTxid)).catch(() => {});
  }, [blockExplorer, resultTxid]);

  const isSending = phase === 'sending';
  const submitDisabled = isSending || rawHex.trim().length === 0;

  const statusLabel = useMemo(() => {
    if (phase === 'sending') return loc.outflow.awaitingRelay;
    if (phase === 'failed') return loc.faults.problemLabel;
    return loc.outflow.pasteRawTxHex;
  }, [phase]);

  const submitColor = submitDisabled
    ? isDark
      ? DISABLED_BG_DARK
      : DISABLED_BG_LIGHT
    : palette.accentBlue;
  const submitTextColor = submitDisabled ? DISABLED_FG : SOLID_WHITE;

  return (
    <ScrollView
      style={{ backgroundColor: surfaceBg }}
      contentContainerStyle={styles.body}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={[styles.panel, { backgroundColor: panelBg }]}>
        {phase === 'sent' ? (
          <View style={styles.sentBlock}>
            <View style={styles.checkDisc}>
              <MaterialIcons
                name="check"
                size={50}
                color={isDark ? CHECK_GLYPH_DARK : CHECK_GLYPH_LIGHT}
              />
            </View>
            <View style={styles.gapLarge} />
            <Text style={[styles.sentText, { color: palette.fg }]}>
              {loc.prefs.txDispatchedOk}
            </Text>
            <View style={styles.gapSmall} />
            <PrimaryButton
              label={loc.ledger.openOnChainBrowser}
              color={palette.accentBlue}
              onPress={openInExplorer}
              style={styles.fullButton}
            />
          </View>
        ) : (
          <>
            <View style={styles.statusRow}>
              <Text style={[styles.statusText, { color: palette.fg }]}>{statusLabel}</Text>
              {isSending ? <ActivityIndicator size="small" /> : null}
            </View>
            <View
              style={[
                styles.hexBox,
                {
                  backgroundColor: palette.inputBg,
                  borderColor: palette.inputBorder,
                  borderBottomColor: palette.inputBorder,
                },
              ]}>
              <TextInput
                value={rawHex}
                onChangeText={handleChange}
                placeholderTextColor={PLACEHOLDER_COLOR}
                style={[styles.hexInput, { color: palette.fg }]}
                multiline
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                editable={!isSending}
              />
            </View>
            <View style={styles.gapLarge} />
            <PrimaryButton
              label={loc.outflow.relayAction}
              color={submitColor}
              textColor={submitTextColor}
              onPress={submit}
              disabled={submitDisabled}
              style={styles.fullButton}
            />
            <View style={styles.gapSmall} />
            <PrimaryButton
              label={loc.holdings.captureQrAction}
              color={palette.accentBlue}
              onPress={openScanner}
              style={styles.fullButton}
            />
            <View style={styles.gapLarge} />
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  panel: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  hexBox: {
    borderWidth: 1,
    borderBottomWidth: 0.5,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  hexInput: {
    minHeight: 180,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  fullButton: {
    alignSelf: 'stretch',
  },
  sentBlock: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  checkDisc: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CHECK_DISC_BG,
  },
  sentText: {
    ...TYPE.cardDesc,
    textAlign: 'center',
  },
  gapSmall: {
    height: 10,
  },
  gapLarge: {
    height: 20,
  },
});

export default BroadcastScreen;
