import React, { useCallback, useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import loc from '../i18n';
import { COLORS, SPACING, TYPE } from '../theme';
import { useWallets } from '../wallets/context';
import { PrimaryButton } from '../components/PrimaryButton';
import type { RootStackParamList } from '../navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'StealthHolding'>;

export const StealthHoldingScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<Navigation>();
  const { isRTL } = useWallets();

  const headerBackground = isDark ? COLORS.dark.bg : COLORS.light.lightButton;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.stealthHolding.hiddenAccessHeading,
      headerLargeTitle: false,
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'default',
      headerBackVisible: true,
      headerTransparent: false,
      headerStyle: { backgroundColor: headerBackground },
      headerTintColor: palette.fg,
      headerTitleStyle: {
        fontSize: TYPE.headerTitle.fontSize,
        fontWeight: TYPE.headerTitle.fontWeight,
        color: palette.fg,
      },
    });
  }, [navigation, palette.fg, headerBackground]);

  const openDecoySetup = useCallback(() => {
    navigation.navigate('PromptPasswordSheet', {
      mode: 'create_fake',
      onResult: () => {},
    });
  }, [navigation]);

  const writingDirection: 'rtl' | 'ltr' = isRTL ? 'rtl' : 'ltr';

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.body}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      <Text style={[styles.paragraph, { color: palette.fg, writingDirection }]}>
        {loc.decoyMode.coercionExplanation}
      </Text>
      <Text style={[styles.paragraph, { color: palette.fg, writingDirection }]}>
        {loc.stealthHolding.decoyRealismTip}
      </Text>
      <PrimaryButton
        label={loc.stealthHolding.setupSecuredHoldingAction}
        color={palette.accentBlue}
        onPress={openDecoySetup}
        style={styles.button}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  body: {
    padding: SPACING.lg,
  },
  paragraph: {
    ...TYPE.cardDesc,
    marginBottom: SPACING.lg,
  },
  button: {
    marginTop: SPACING.sm,
  },
});

export default StealthHoldingScreen;
