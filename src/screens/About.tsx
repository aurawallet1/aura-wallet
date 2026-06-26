import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@react-native-vector-icons/ionicons';

import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import loc from '../i18n';
import { useWallets } from '../wallets/context';
import { PrimaryButton } from '../components/PrimaryButton';
import type { RootStackParamList } from '../navigation/types';

type AboutNavigation = NativeStackNavigationProp<RootStackParamList, 'About'>;

type GlyphName = React.ComponentProps<typeof Ionicons>['name'];

type SocialLink = {
  id: 'telegram' | 'github';
  glyph: GlyphName;
  title: string;
  url: string;
};

const AURA_LOGO = require('../../img/about-logo.png');

const TELEGRAM_URL = 'https://t.me/aurabitcoinwallet';
const GITHUB_URL = 'https://github.com/aurawallet1/aura-wallet';
const REVIEW_URL = 'https://apps.apple.com/app/id6749847943?action=write-review';

const buildSocialLinks = (): SocialLink[] => [
  {
    id: 'telegram',
    glyph: 'paper-plane',
    title: loc.prefs.telegramLink,
    url: TELEGRAM_URL,
  },
  {
    id: 'github',
    glyph: 'logo-github',
    title: loc.prefs.sourceRepoLink,
    url: GITHUB_URL,
  },
];

const directionFor = (rightToLeft: boolean): TextStyle => ({
  writingDirection: rightToLeft ? 'rtl' : 'ltr',
});

export const AboutScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const { isRTL } = useWallets();
  const navigation = useNavigation<AboutNavigation>();

  const pageBg = isDark ? palette.bg : palette.cardGray;
  const cellBg = isDark ? palette.cardGray : palette.bg;

  const links = useMemo(() => buildSocialLinks(), []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.prefs.appInfo,
      headerLargeTitle: false,
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
      headerBackVisible: true,
      headerTransparent: false,
      headerStyle: { backgroundColor: pageBg },
      headerTintColor: palette.fg,
      headerTitleStyle: {
        fontSize: TYPE.headerTitle.fontSize,
        fontWeight: TYPE.headerTitle.fontWeight,
        color: palette.fg,
      },
    });
  }, [navigation, palette.fg, pageBg]);

  const openUrl = useCallback((url: string) => {
    Linking.openURL(url).catch(() => undefined);
  }, []);

  return (
    <ScrollView
      style={{ backgroundColor: pageBg }}
      contentContainerStyle={styles.body}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustContentInsets
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Image source={AURA_LOGO} style={styles.logo} />
        <Text style={[styles.headline, { color: palette.fg }]}>
          {loc.aboutApp.communityProjectStatement}
        </Text>
        <Text style={[styles.subline, { color: palette.altText }]}>
          {loc.prefs.safeguardKeysReminder}
        </Text>
        <PrimaryButton
          label={loc.prefs.rateUs}
          color={palette.lightButton}
          textColor={palette.fg}
          onPress={() => openUrl(REVIEW_URL)}
          style={styles.reviewButton}
        />
      </View>

      <View style={styles.section}>
        {links.map((link, index) => {
          const isFirst = index === 0;
          const isLast = index === links.length - 1;
          return (
            <Pressable
              key={link.id}
              onPress={() => openUrl(link.url)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: cellBg },
                isFirst && styles.rowFirst,
                isLast && styles.rowLast,
                !isLast && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: palette.fieldBorder,
                },
                pressed && styles.pressed,
              ]}>
              <View style={styles.rowIcon}>
                <Ionicons name={link.glyph} size={24} color={palette.fg} />
              </View>
              <Text
                style={[
                  styles.rowTitle,
                  directionFor(isRTL),
                  { color: palette.fg },
                ]}>
                {link.title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.creditCard, { backgroundColor: cellBg }]}>
        <Text style={[styles.creditText, directionFor(isRTL), { color: palette.fg }]}>
          {loc.aboutApp.poweredByIntro}
        </Text>
        <View style={styles.creditSpacer} />
        <Text style={[styles.creditText, { color: palette.fg }]}>
          {loc.aboutApp.frameworkCredit}
        </Text>
        <Text style={[styles.creditText, { color: palette.fg }]}>
          {loc.aboutApp.cryptoLibraryCredit}
        </Text>
        <Text style={[styles.creditText, { color: palette.fg }]}>
          {loc.prefs.nodeEndpoint}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingBottom: SPACING.xxl,
  },
  header: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
    paddingHorizontal: SPACING.xxl,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.card,
    marginBottom: SPACING.lg,
  },
  headline: {
    fontSize: TYPE.cardDesc.fontSize,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subline: {
    fontSize: TYPE.caption.fontSize,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  reviewButton: {
    alignSelf: 'stretch',
  },
  section: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    borderRadius: RADIUS.control,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  rowFirst: {
    borderTopLeftRadius: RADIUS.control,
    borderTopRightRadius: RADIUS.control,
  },
  rowLast: {
    borderBottomLeftRadius: RADIUS.control,
    borderBottomRightRadius: RADIUS.control,
  },
  rowIcon: {
    width: 32,
    alignItems: 'center',
    marginEnd: SPACING.md,
  },
  rowTitle: {
    flex: 1,
    fontSize: TYPE.button.fontSize,
    fontWeight: '500',
  },
  creditCard: {
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.control,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  creditText: {
    fontSize: TYPE.cardDesc.fontSize,
    lineHeight: 22,
    textAlign: 'center',
  },
  creditSpacer: {
    height: SPACING.xl,
  },
  pressed: {
    opacity: 0.6,
  },
});

export default AboutScreen;
