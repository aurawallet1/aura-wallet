import React from 'react';
import { I18nManager, StyleSheet, Text, View } from 'react-native';
import type { ColorScheme } from '../theme';

interface SeedWordsViewProps {
  c: ColorScheme;
  seed: string;
}

const splitWords = (phrase: string): string[] =>
  phrase.split(/\s+/).filter((token) => token.length > 0);

const SeedWordsView: React.FC<SeedWordsViewProps> = ({ c, seed }) => {
  const words = splitWords(seed);
  return (
    <View style={styles.row}>
      {words.map((word, index) => (
        <View key={index} style={[styles.pill, { backgroundColor: c.inputBg }]}>
          <Text
            style={[styles.pillText, { color: c.labelText }]}
            textBreakStrategy="simple"
          >
            {index + 1 + '. ' + word + '  '}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pill: {
    marginEnd: 8,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  pillText: {
    fontSize: 17,
    fontWeight: 'bold',
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
});

export default SeedWordsView;
