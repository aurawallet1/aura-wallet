import React, { useMemo } from 'react';
import {
  I18nManager,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS, RADIUS, SPACING, TYPE, type ColorScheme } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { useWallets } from '../wallets/context';
import PrimaryButton from '../components/PrimaryButton';
import WordRevealTile from '../components/WordRevealTile';
import loc from '../i18n';

type RecoveryPhraseRoute = 'WalletExport';
type RecoveryPhraseNavigation = NativeStackNavigationProp<RootStackParamList, RecoveryPhraseRoute>;
type RecoveryPhraseRouteProp = RouteProp<RootStackParamList, RecoveryPhraseRoute>;

const REVEAL_DELAY_CAP_MS = 420;
const HASH_PRIME = 16777619;
const HASH_OFFSET = 2166136261;
const HASH_MASK = 0xffffffff;

const splitPhrase = (phrase: string): string[] =>
  phrase.length ? phrase.split(/\s+/).filter(token => token.length > 0) : [];

const hashSeed = (runKey: string, slot: number): number => {
  const source = runKey + '#' + String(slot);
  let value = HASH_OFFSET;
  for (let position = 0; position < source.length; position += 1) {
    value ^= source.charCodeAt(position);
    value = (value * HASH_PRIME) & HASH_MASK;
  }
  return value >>> 0;
};

const scatteredDelays = (runKey: string, count: number, cap: number): number[] => {
  const delays: number[] = [];
  for (let slot = 0; slot < count; slot += 1) {
    delays.push(hashSeed(runKey, slot) % cap);
  }
  return delays;
};

const RecoveryPhraseScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette: ColorScheme = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<RecoveryPhraseNavigation>();
  const route = useRoute<RecoveryPhraseRouteProp>();
  const { wallets } = useWallets();

  const entry = wallets.find(wallet => wallet.id === route.params.id);
  const mnemonic = entry?.mnemonic ?? '';
  const words = useMemo(() => splitPhrase(mnemonic), [mnemonic]);
  const delays = useMemo(
    () => scatteredDelays(mnemonic, words.length, REVEAL_DELAY_CAP_MS),
    [mnemonic, words.length],
  );

  if (!entry) {
    return <View style={[styles.fill, { backgroundColor: palette.bg }]} />;
  }

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}>
      <Text style={[TYPE.phraseIntro, styles.intro, { color: palette.fg }]}>
        {loc.formatString(loc.seedRecovery.writeWordsInOrderGuidance, { count: words.length })}
      </Text>
      <View style={styles.wordGrid}>
        {words.map((word, index) => (
          <View key={index} style={[styles.wordChip, { backgroundColor: palette.cardGray }]}>
            <Text
              maxFontSizeMultiplier={1.2}
              style={[TYPE.seedWord, styles.wordText, { color: palette.labelText }]}>
              {`${index + 1}. ${word}  `}
            </Text>
            <WordRevealTile
              key={`${mnemonic}-${index}`}
              maskColor={palette.cardGray}
              delayMs={delays[index]}
              runKey={mnemonic}
              radius={RADIUS.chip}
            />
          </View>
        ))}
      </View>
      <PrimaryButton
        label={loc.backupNudge.acknowledgedRecorded}
        color={palette.accentBlue}
        onPress={() => navigation.goBack()}
        style={styles.confirm}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  body: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.huge,
  },
  intro: {
    textAlign: 'center',
    marginBottom: SPACING.xl,
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  wordChip: {
    overflow: 'hidden',
    marginEnd: SPACING.sm,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.chip,
  },
  wordText: {
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  confirm: {
    marginTop: SPACING.xxl,
  },
});

export default RecoveryPhraseScreen;
export { RecoveryPhraseScreen };
