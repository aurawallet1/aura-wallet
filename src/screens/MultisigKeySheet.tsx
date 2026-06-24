import React, { useLayoutEffect, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { COLORS, RADIUS, SIZE, SPACING, TYPE, type ColorScheme } from '../theme';
import loc from '../i18n';
import { useWallets } from '../wallets/context';
import { PrimaryButton } from '../components/PrimaryButton';
import type { AddWalletStackParamList } from '../navigation/types';

const CHECK_GLYPH_SIZE = 24;
const CLOSE_GLYPH_SIZE = 24;
const CHECK_GLYPH_COLOR = '#FFFFFF';

type MultisigKeySheetNavigation = NativeStackNavigationProp<
  AddWalletStackParamList,
  'MultisigKeySheet'
>;
type MultisigKeySheetRoute = RouteProp<AddWalletStackParamList, 'MultisigKeySheet'>;

const splitMnemonic = (phrase: string): string[] =>
  phrase.split(/\s+/).filter((token) => token.length > 0);

export const MultisigKeySheetScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette: ColorScheme = isDark ? COLORS.dark : COLORS.light;
  const { isRTL } = useWallets();
  const navigation = useNavigation<MultisigKeySheetNavigation>();
  const route = useRoute<MultisigKeySheetRoute>();

  const { index, mnemonic } = route.params;
  const words = useMemo(() => splitMnemonic(mnemonic), [mnemonic]);

  const dismiss = (): void => {
    navigation.goBack();
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerStyle: { backgroundColor: palette.elevated },
      contentStyle: { backgroundColor: palette.elevated },
      headerRight: () => (
        <Pressable onPress={dismiss} hitSlop={SIZE.closeHit} style={styles.closeButton}>
          <MaterialIcons name="close" size={CLOSE_GLYPH_SIZE} color={palette.fg} />
        </Pressable>
      ),
    });
  }, [navigation, palette.fg, palette.elevated]);

  const chipDirection = { writingDirection: isRTL ? ('rtl' as const) : ('ltr' as const) };

  return (
    <ScrollView
      style={{ backgroundColor: palette.elevated }}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}>
      <View style={[styles.badge, { backgroundColor: palette.txInFg }]}>
        <MaterialIcons name="check" size={CHECK_GLYPH_SIZE} color={CHECK_GLYPH_COLOR} />
      </View>

      <Text style={[TYPE.cardTitle, styles.centered, { color: palette.fg }]}>
        {loc.formatString(loc.quorum.cosignerSlot, { number: index + 1 })}
      </Text>
      <Text style={[TYPE.cardDesc, styles.centered, { color: palette.muted }]}>
        {loc.quorum.cosignerReadyBackup}
      </Text>

      <Text style={[TYPE.cardDesc, styles.seedLabel, { color: palette.fg }]}>{loc.core.recoveryWords}</Text>

      <View style={styles.seedGrid}>
        {words.map((word, position) => (
          <View key={position} style={[styles.seedChip, { backgroundColor: palette.inputBg }]}>
            <Text
              maxFontSizeMultiplier={1.2}
              style={[styles.seedWord, chipDirection, { color: palette.fg }]}>
              {`${position + 1}. ${word}`}
            </Text>
          </View>
        ))}
      </View>

      <PrimaryButton
        label={loc.outflow.finishEntry}
        color={palette.accentBlue}
        onPress={dismiss}
        style={styles.doneButton}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.huge,
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  centered: {
    textAlign: 'center',
  },
  seedLabel: {
    fontWeight: '700',
    marginTop: SPACING.xxl,
    marginBottom: SPACING.md,
  },
  seedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  seedChip: {
    marginEnd: SPACING.sm,
    marginBottom: SPACING.sm,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.chip,
  },
  seedWord: {
    ...TYPE.seedWord,
  },
  doneButton: {
    marginTop: SPACING.xxl,
  },
});

export default MultisigKeySheetScreen;
