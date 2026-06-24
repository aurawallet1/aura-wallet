import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS, SPACING, TYPE } from '../theme';
import loc from '../i18n';
import { useWallets } from '../wallets/context';
import { scanMnemonic, scanWif } from '../wallets/scan';
import { triggerSuccessHaptic } from '../utils/haptics';
import type {
  AddWalletStackParamList,
  RootStackParamList,
} from '../navigation/types';

const CANCELLED = 'cancelled';

const writingDirection = (rtl: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: rtl ? 'rtl' : 'ltr',
});

const requestPassphrase = (): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    if (Platform.OS !== 'ios' || !Alert.prompt) {
      resolve('');
      return;
    }
    Alert.prompt(
      loc.holdings.secretWord,
      loc.restore.optionalSecretWordHint,
      [
        {
          text: loc.core.dismissAction,
          style: 'cancel',
          onPress: () => reject(new Error(CANCELLED)),
        },
        {
          text: loc.core.acknowledge,
          onPress: (value?: string) => resolve(value ?? ''),
        },
      ],
      'secure-text',
    );
  });

type DiscoveryNavigation = NativeStackNavigationProp<
  AddWalletStackParamList,
  'ImportDiscovery'
>;
type DiscoveryRoute = RouteProp<AddWalletStackParamList, 'ImportDiscovery'>;

export const ImportDiscoveryScreen = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<DiscoveryNavigation>();
  const route = useRoute<DiscoveryRoute>();
  const { addWallet, isRTL } = useWallets();
  const { mnemonic, wif, askPassphrase, origin, name } = route.params;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const goToWalletList = () => {
      navigation
        .getParent<NativeStackNavigationProp<RootStackParamList>>()
        ?.reset({ index: 0, routes: [{ name: 'WalletsList' }] });
    };

    const run = async () => {
      if (wif) {
        const result = await scanWif(wif);
        if (!active) {
          return;
        }
        addWallet('', '', result, origin, wif, name);
      } else {
        const phrase = mnemonic ?? '';
        const passphrase = askPassphrase ? await requestPassphrase() : '';
        const result = await scanMnemonic(phrase, passphrase);
        if (!active) {
          return;
        }
        addWallet(phrase, passphrase, result, origin, '', name);
      }
      triggerSuccessHaptic();
      goToWalletList();
    };

    run().catch(issue => {
      if (!active) {
        return;
      }
      if (issue instanceof Error && issue.message === CANCELLED) {
        navigation.goBack();
        return;
      }
      setError(issue instanceof Error ? issue.message : loc.faults.captureUnsuccessful);
    });

    return () => {
      active = false;
    };
  }, [mnemonic, askPassphrase]);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {error ? (
        <Text style={[TYPE.cardDesc, { color: palette.muted }, writingDirection(isRTL)]}>
          {error}
        </Text>
      ) : (
        <>
          <View style={styles.topGap} />
          <ActivityIndicator />
          <View style={styles.midGap} />
          <Text style={[TYPE.cardDesc, { color: palette.fg }, writingDirection(isRTL)]}>
            {loc.restore.workingIndicator}
          </Text>
          <View style={styles.bottomGap} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  topGap: {
    height: SPACING.huge,
  },
  midGap: {
    height: SPACING.xl,
  },
  bottomGap: {
    height: SPACING.huge,
  },
});

export default ImportDiscoveryScreen;
