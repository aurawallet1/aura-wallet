import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { I18nManager } from 'react-native';
import { ColorScheme, SIZE, SPACING, fs } from '../theme';
import { triggerHaptic, triggerSuccessHaptic } from '../utils/haptics';
import loc from '../i18n';

const RTL = I18nManager.isRTL;

const ROUND_COUNT = 3;
const DECOY_COUNT = 3;
const MAX_WRONG_ATTEMPTS = 2;
const FADE_DURATION_MS = 240;

const shuffled = <T,>(items: readonly T[]): T[] => {
  const out = items.slice();
  for (let i = out.length - 1; i >= 1; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
};

export interface VerifyBodyProps {
  c: ColorScheme;
  mnemonic: string;
  onVerified: () => void;
  onBack: () => void;
  onFail: () => void;
}

const VerifyBody: React.FC<VerifyBodyProps> = ({ c, mnemonic, onVerified, onBack, onFail }) => {
  const words = useMemo(() => mnemonic.split(' '), [mnemonic]);

  const quizIndexes = useMemo(() => {
    const everyIndex = words.map((_, index) => index);
    return shuffled(everyIndex)
      .slice(0, ROUND_COUNT)
      .sort((a, b) => a - b);
  }, [words]);

  const [round, setRound] = useState(0);
  const [missedWord, setMissedWord] = useState('');
  const [wrongAttempts, setWrongAttempts] = useState(0);

  const targetWord = words[quizIndexes[round]];

  const choices = useMemo(() => {
    const decoys = shuffled(words.filter(word => word !== targetWord)).slice(0, DECOY_COUNT);
    return shuffled([targetWord, ...decoys]);
  }, [words, targetWord]);

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: FADE_DURATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [round, fade]);

  const handlePick = (word: string) => {
    if (word !== targetWord) {
      setMissedWord(word);
      triggerHaptic();
      const attempts = wrongAttempts + 1;
      setWrongAttempts(attempts);
      if (attempts >= MAX_WRONG_ATTEMPTS) {
        onFail();
      }
      return;
    }

    setMissedWord('');
    const isFinalRound = round + 1 >= quizIndexes.length;
    if (isFinalRound) {
      triggerSuccessHaptic();
      onVerified();
    } else {
      setRound(current => current + 1);
    }
  };

  return (
    <View style={[styles.body, { backgroundColor: c.bg }]}>
      <Text style={[styles.heading, { color: c.fg }]}>{loc.seedBackup.verifySavedPhrase}</Text>
      <Text style={[styles.sub, { color: c.muted }]}>
        {loc.formatString(loc.seedBackup.askPositionWord, { number: quizIndexes[round] + 1 })}
      </Text>

      <Animated.View key={round} style={[styles.options, { opacity: fade }]}>
        {choices.map((word, position) => {
          const flaggedWrong = missedWord === word;
          return (
            <Pressable
              key={position}
              onPress={() => handlePick(word)}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: flaggedWrong ? c.txOutBg : c.tileBg },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.chipText, { color: flaggedWrong ? c.txOutFg : c.fg }]}>{word}</Text>
            </Pressable>
          );
        })}
      </Animated.View>

      <View style={styles.dots}>
        {quizIndexes.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, { backgroundColor: index <= round ? c.accentBlue : c.fieldBorder }]}
          />
        ))}
      </View>

      <Pressable onPress={onBack} style={styles.back} hitSlop={SIZE.closeHit}>
        <Text style={[styles.backText, { color: c.muted }]}>{loc.seedBackup.revealWordsRepeat}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: SPACING.xl, alignItems: 'center', justifyContent: 'center' },
  heading: {
    fontSize: fs(22),
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: RTL ? 'rtl' : 'ltr',
  },
  sub: {
    fontSize: fs(15),
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
    writingDirection: RTL ? 'rtl' : 'ltr',
  },
  options: { alignSelf: 'stretch', marginBottom: SPACING.xl },
  chip: { paddingVertical: 14, borderRadius: 12, marginBottom: 10, alignItems: 'center' },
  chipText: { fontSize: fs(17), fontWeight: '600', writingDirection: 'ltr' },
  dots: { flexDirection: 'row' },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 },
  back: { marginTop: SPACING.xxl, minHeight: 36, justifyContent: 'center' },
  backText: { fontSize: fs(15), fontWeight: '500', writingDirection: RTL ? 'rtl' : 'ltr' },
  pressed: { opacity: 0.6 },
});

export default VerifyBody;
