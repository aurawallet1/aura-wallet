import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

import { COLORS, SPACING, type ColorScheme } from '../theme';
import loc from '../i18n';
import { HoldingKeyRow } from '../components/HoldingKeyRow';
import { PrimaryButton } from '../components/PrimaryButton';
import { useWallets } from '../wallets/context';
import { triggerSuccessHaptic } from '../utils/haptics';
import type { AddWalletStackParamList, RootStackParamList } from '../navigation/types';

const SEED_ENTROPY_BITS = 128;

type Step2Navigation = NativeStackNavigationProp<AddWalletStackParamList, 'MultisigStep2'>;
type Step2Route = RouteProp<AddWalletStackParamList, 'MultisigStep2'>;

export const MultisigStep2Screen = (): React.ReactElement => {
  const scheme = useColorScheme();
  const palette: ColorScheme = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<Step2Navigation>();
  const route = useRoute<Step2Route>();
  const { m, n, walletLabel } = route.params;
  const { createHolding } = useWallets();

  const [signers, setSigners] = useState<string[]>([]);

  const appendSigner = useCallback((mnemonic: string) => {
    setSigners(prev => [...prev, mnemonic]);
  }, []);

  const handleCreate = useCallback(() => {
    const mnemonic = generateMnemonic(wordlist, SEED_ENTROPY_BITS);
    const index = signers.length;
    appendSigner(mnemonic);
    triggerSuccessHaptic();
    navigation.navigate('MultisigKeySheet', { index, mnemonic });
  }, [appendSigner, navigation, signers.length]);

  const handleImport = useCallback(() => {
    navigation.navigate('MultisigImport', { onImport: appendSigner });
  }, [appendSigner, navigation]);

  const isComplete = signers.length === n;

  const handleFinish = useCallback(() => {
    if (!isComplete) {
      return;
    }
    createHolding(m, n, signers, walletLabel);
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.reset({ index: 0, routes: [{ name: 'WalletsList' }] });
  }, [createHolding, isComplete, m, n, navigation, signers, walletLabel]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: '' });
  }, [navigation]);

  const slots = useMemo(() => Array.from({ length: n }, (_, i) => i), [n]);

  return (
    <View style={[styles.fill, { backgroundColor: palette.bg }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}>
        {slots.map(i => (
          <HoldingKeyRow
            key={i}
            index={i}
            total={n}
            filled={i < signers.length}
            isNext={i === signers.length}
            c={palette}
            onCreate={handleCreate}
            onImport={handleImport}
          />
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton
          label={loc.inflow.generateInvoice}
          color={isComplete ? palette.accentBlue : palette.cardGray}
          textColor={isComplete ? '#FFFFFF' : palette.muted}
          disabled={!isComplete}
          onPress={handleFinish}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  list: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
});

export default MultisigStep2Screen;
