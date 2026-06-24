import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import loc from '../i18n';
import { PrimaryButton } from '../components/PrimaryButton';
import { useWallets } from '../wallets/context';
import type { RootStackParamList } from '../navigation/types';

const brandMark = require('../../img/logo.png');

const HERO_FONT_SCALE = 1.2;

type WelcomeNavigation = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

export function WelcomeScreen(): React.ReactElement {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<WelcomeNavigation>();
  useWallets();

  const beginOnboarding = () => navigation.navigate('AddWalletRoot');
  const openLicensing = () => navigation.navigate('OpenSource');

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View style={styles.hero}>
          <Image source={brandMark} style={styles.mark} resizeMode="contain" />
          <Text
            maxFontSizeMultiplier={HERO_FONT_SCALE}
            style={[styles.heading, TYPE.welcomeTitle, { color: palette.fg }]}>
            {loc.onboarding.heroHeadline}
          </Text>
          <Text style={[TYPE.welcomeSub, styles.tagline, { color: palette.muted }]}>
            {loc.onboarding.valueProposition}
          </Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label={loc.onboarding.beginButton}
            color={palette.accentBlue}
            textColor={palette.buttonText}
            onPress={beginOnboarding}
          />
          <Text style={[TYPE.caption, styles.disclosure, { color: palette.muted }]}>
            {loc.onboarding.transparencyNote}
            {'\n'}
            <Text style={styles.anchor} onPress={openLicensing}>
              {loc.onboarding.discoverLink}
            </Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollBody: {
    flexGrow: 1,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.huge,
  },
  mark: {
    width: 120,
    height: 120,
    borderRadius: RADIUS.card + SPACING.xs + 3,
    alignSelf: 'center',
    marginBottom: SPACING.xxxl,
  },
  heading: {
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  tagline: {
    textAlign: 'center',
    alignSelf: 'center',
    marginTop: SPACING.lg,
    maxWidth: 360,
  },
  actions: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  disclosure: {
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  anchor: {
    textDecorationLine: 'underline',
  },
});

export default WelcomeScreen;
