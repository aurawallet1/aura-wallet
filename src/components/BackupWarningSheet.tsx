import React, { useLayoutEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { COLORS, SIZE, SPACING, fs } from '../theme';
import loc from '../i18n';
import { PrimaryButton } from './PrimaryButton';

export type BackupWarningStackParamList = {
  BackupWarning: undefined;
};

type BackupWarningNav = NativeStackNavigationProp<BackupWarningStackParamList, 'BackupWarning'>;

export function BackupWarningSheet(): React.ReactElement {
  const dark = useColorScheme() === 'dark';
  const palette = dark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<BackupWarningNav>();

  const dismiss = (): void => navigation.goBack();

  useLayoutEffect(() => {
    const surface = palette.elevated;
    navigation.setOptions({
      title: '',
      headerStyle: { backgroundColor: surface },
      contentStyle: { backgroundColor: surface },
      headerRight: function CloseButton() {
        return (
          <Pressable onPress={dismiss} hitSlop={SIZE.closeHit} style={styles.closeAffordance}>
            <MaterialIcons name="close" size={22} color={palette.fg} />
          </Pressable>
        );
      },
    });
  }, [navigation, palette.fg, palette.elevated]);

  return (
    <View style={[styles.sheet, { backgroundColor: palette.elevated }]}>
      <View style={[styles.badge, { backgroundColor: palette.cardGray }]}>
        <MaterialIcons name="lock" size={30} color={palette.fg} />
      </View>

      <Text style={[styles.heading, { color: palette.fg }]}>{loc.seedBackup.savePhraseBeforeProceeding}</Text>

      <Text style={[styles.copy, { color: palette.muted }]}>{loc.seedBackup.mnemonicCrucialNotice}</Text>

      <PrimaryButton
        label={loc.seedBackup.displayMnemonic}
        color={palette.accentBlue}
        onPress={dismiss}
        style={styles.cta}
      />
    </View>
  );
}

const BADGE_SIZE = 56;

const styles = StyleSheet.create({
  sheet: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  heading: {
    fontSize: fs(20),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  copy: {
    fontSize: fs(15),
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  cta: {
    alignSelf: 'stretch',
  },
  closeAffordance: {
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
});

export default BackupWarningSheet;
