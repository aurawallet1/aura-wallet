import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MenuView } from '@react-native-menu/menu';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

import {
  COLORS,
  RADIUS,
  SPACING,
  TYPE,
  type ColorScheme,
} from '../theme';
import loc from '../i18n';
import { useWallets } from '../wallets/context';
import { PrimaryButton } from '../components/PrimaryButton';
import WordRevealTile from '../components/WordRevealTile';
import type {
  AddWalletStackParamList,
  RootStackParamList,
} from '../navigation/types';

const SHORT_PHRASE_ENTROPY = 128;
const REVEAL_DELAY_CAP_MS = 420;
const HASH_MODULUS = 2147483647;
const HASH_MULTIPLIER = 31;
const PASSPHRASE_CANCELLED = 'cancelled';
const HEADER_ICON_SIZE = 22;

type PleaseBackupNavigation = NativeStackNavigationProp<
  AddWalletStackParamList,
  'PleaseBackup'
>;
type PleaseBackupRoute = RouteProp<AddWalletStackParamList, 'PleaseBackup'>;

const newPhrase = (): string => generateMnemonic(wordlist, SHORT_PHRASE_ENTROPY);

const revealDelayFor = (runKey: string, index: number): number => {
  const source = runKey + ':' + String(index);
  let accumulator = 0;
  for (let position = 0; position < source.length; position += 1) {
    const weighted = source.charCodeAt(position) * (position + 1);
    accumulator = (accumulator * HASH_MULTIPLIER + weighted) % HASH_MODULUS;
  }
  return accumulator % REVEAL_DELAY_CAP_MS;
};

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
          onPress: () => reject(new Error(PASSPHRASE_CANCELLED)),
        },
        {
          text: loc.core.acknowledge,
          onPress: (value?: string) => resolve(value ?? ''),
        },
      ],
      'secure-text',
    );
  });

interface PhraseBodyProps {
  c: ColorScheme;
  mnemonic: string;
  onDone: () => void;
}

const PhraseBody: React.FC<PhraseBodyProps> = ({ c, mnemonic, onDone }) => {
  const words = useMemo(
    () => (mnemonic.length ? mnemonic.split(' ') : []),
    [mnemonic],
  );
  const delays = useMemo(
    () => words.map((_, index) => revealDelayFor(mnemonic, index)),
    [mnemonic, words],
  );

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.phraseBody}
      showsVerticalScrollIndicator={false}>
      <Text style={[TYPE.phraseIntro, styles.phraseText, { color: c.fg }]}>
        {loc.formatString(loc.seedRecovery.writeWordsInOrderGuidance, { count: words.length })}
      </Text>

      <View style={styles.seedWrap}>
        {words.map((word, index) => (
          <View key={index} style={[styles.seedChip, { backgroundColor: c.cardGray }]}>
            <Text
              maxFontSizeMultiplier={1.2}
              style={[TYPE.seedWord, { color: c.labelText }]}>
              {String(index + 1) + '. ' + word + '  '}
            </Text>
            <WordRevealTile
              key={mnemonic + '-' + String(index)}
              maskColor={c.cardGray}
              delayMs={delays[index]}
              runKey={mnemonic}
              radius={RADIUS.chip}
            />
          </View>
        ))}
      </View>

      <PrimaryButton
        label={loc.backupNudge.acknowledgedRecorded}
        color={c.accentBlue}
        onPress={onDone}
        style={styles.phraseButton}
      />
    </ScrollView>
  );
};

export const PleaseBackupScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette: ColorScheme = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<PleaseBackupNavigation>();
  const route = useRoute<PleaseBackupRoute>();
  const { createWallet } = useWallets();

  const [askPassphrase, setAskPassphrase] = useState(false);
  const [mnemonic] = useState(() => newPhrase());

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <MenuView
          shouldOpenOnLongPress={false}
          onPressAction={({ nativeEvent }) => {
            if (nativeEvent.event === 'passphrase') {
              setAskPassphrase(value => !value);
            }
          }}
          actions={[
            {
              id: 'passphrase',
              title: loc.holdings.secretWord,
              image: 'rectangle.and.pencil.and.ellipsis',
              imageColor: palette.fg,
              state: askPassphrase ? 'on' : 'off',
            },
          ]}>
          <View style={styles.headerMenu}>
            <MaterialIcons name="more-horiz" size={HEADER_ICON_SIZE} color={palette.fg} />
          </View>
        </MenuView>
      ),
    });
  }, [navigation, palette.fg, askPassphrase]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: loc.seedBackup.mnemonicComplete });
  }, [navigation]);

  const finalize = useCallback(
    (passphrase: string) => {
      createWallet(mnemonic, passphrase, route.params?.name);
      navigation
        .getParent<NativeStackNavigationProp<RootStackParamList>>()
        ?.reset({ index: 0, routes: [{ name: 'WalletsList' }] });
    },
    [createWallet, mnemonic, navigation, route.params?.name],
  );

  const completeBackup = useCallback(() => {
    if (askPassphrase) {
      requestPassphrase()
        .then(finalize)
        .catch(() => {});
    } else {
      finalize('');
    }
  }, [askPassphrase, finalize]);

  return <PhraseBody c={palette} mnemonic={mnemonic} onDone={completeBackup} />;
};

const styles = StyleSheet.create({
  phraseBody: {
    padding: SPACING.xl,
    paddingBottom: SPACING.huge,
  },
  phraseText: {
    marginBottom: SPACING.xl,
  },
  seedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: SPACING.xxl,
  },
  seedChip: {
    borderRadius: RADIUS.chip,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    marginEnd: SPACING.sm,
    marginBottom: SPACING.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  phraseButton: {
    marginTop: SPACING.sm,
  },
  headerMenu: {
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
});

export default PleaseBackupScreen;
