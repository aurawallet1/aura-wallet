import React, { useLayoutEffect, useMemo } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { COLORS, RADIUS, SIZE, SPACING, TYPE } from '../theme';
import loc from '../i18n';
import { useWallets } from '../wallets/context';
import type { RootStackParamList } from '../navigation/types';

type OpenSourceNavigation = NativeStackNavigationProp<RootStackParamList, 'OpenSource'>;

type GlyphName = React.ComponentProps<typeof MaterialIcons>['name'];

type Highlight = {
  glyph: GlyphName;
  heading: string;
  detail: string;
};

const REPOSITORY_URL = 'https://github.com/aurawallet1/aura-wallet';

const buildHighlights = (): Highlight[] => [
  {
    glyph: 'key',
    heading: loc.ossInfo.keypairCreationHeading,
    detail: loc.ossInfo.keypairCreationBlurb,
  },
  {
    glyph: 'lock',
    heading: loc.ossInfo.mnemonicStretchHeading,
    detail: loc.ossInfo.mnemonicStretchBlurb,
  },
  {
    glyph: 'visibility-off',
    heading: loc.ossInfo.localKeyAssuranceHeading,
    detail: loc.ossInfo.localKeyAssuranceBlurb,
  },
];

const directionFor = (rightToLeft: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: rightToLeft ? 'rtl' : 'ltr',
});

export const OpenSourceScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const { isRTL } = useWallets();
  const navigation = useNavigation<OpenSourceNavigation>();

  const repoPillBackground = isDark ? '#FFFFFF' : '#111111';
  const repoPillForeground = isDark ? '#000000' : '#FFFFFF';

  const highlights = useMemo(() => buildHighlights(), []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.prefs.publicCode,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: palette.elevated },
      contentStyle: { backgroundColor: palette.elevated },
      headerTintColor: palette.fg,
      headerTitleStyle: {
        fontSize: TYPE.headerTitle.fontSize,
        fontWeight: TYPE.headerTitle.fontWeight,
        color: palette.fg,
      },
      headerRight: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={SIZE.closeHit}
          accessibilityRole="button"
          style={styles.headerClose}>
          <MaterialIcons name={'close' as GlyphName} size={22} color={palette.fg} />
        </Pressable>
      ),
    });
  }, [navigation, palette.fg, palette.elevated]);

  const openRepository = () => {
    Linking.openURL(REPOSITORY_URL);
  };

  return (
    <ScrollView
      style={{ backgroundColor: palette.elevated }}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}>
      <MaterialIcons
        name={'gpp-good' as GlyphName}
        size={48}
        color={palette.fg}
        style={styles.hero}
      />
      <Text style={[styles.title, directionFor(isRTL), { color: palette.fg }]}>
        {loc.ossInfo.transparentCodeHeading}
      </Text>
      <Text style={[styles.lead, directionFor(isRTL), { color: palette.muted }]}>
        {loc.ossInfo.auditableRepoBlurb}
      </Text>

      <View style={[styles.card, { backgroundColor: palette.cardGray }]}>
        {highlights.map((item, index) => (
          <View
            key={item.heading}
            style={[
              styles.row,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: palette.fieldBorder,
              },
            ]}>
            <MaterialIcons
              name={item.glyph}
              size={22}
              color={palette.fg}
              style={styles.rowGlyph}
            />
            <View style={styles.rowText}>
              <Text style={[styles.rowHeading, directionFor(isRTL), { color: palette.fg }]}>
                {item.heading}
              </Text>
              <Text style={[styles.rowDetail, directionFor(isRTL), { color: palette.muted }]}>
                {item.detail}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        onPress={openRepository}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.repoButton,
          { backgroundColor: repoPillBackground },
          pressed && styles.pressed,
        ]}>
        <MaterialIcons
          name={'open-in-new' as GlyphName}
          size={18}
          color={repoPillForeground}
          style={[styles.repoButtonGlyph, repoMirror(isRTL)]}
        />
        <Text style={[styles.repoButtonText, directionFor(isRTL), { color: repoPillForeground }]}>
          {loc.ossInfo.browseRepoAction}
        </Text>
      </Pressable>
    </ScrollView>
  );
};

const repoMirror = (rightToLeft: boolean): { transform: { scaleX: number }[] } => ({
  transform: [{ scaleX: rightToLeft ? -1 : 1 }],
});

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
    alignItems: 'center',
  },
  hero: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPE.cardTitle.fontSize,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  lead: {
    fontSize: TYPE.cardDesc.fontSize,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  card: {
    alignSelf: 'stretch',
    borderRadius: RADIUS.control,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  rowGlyph: {
    marginEnd: SPACING.md,
    marginTop: 1,
  },
  rowText: {
    flex: 1,
  },
  rowHeading: {
    fontSize: TYPE.button.fontSize,
    fontWeight: '700',
    marginBottom: 3,
  },
  rowDetail: {
    fontSize: TYPE.cardDesc.fontSize,
    lineHeight: 20,
  },
  repoButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    height: SIZE.buttonHeight,
    minHeight: SIZE.buttonMinHeight,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZE.buttonPadH,
  },
  repoButtonGlyph: {
    marginEnd: 8,
  },
  repoButtonText: {
    ...TYPE.button,
  },
  headerClose: {
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
  pressed: {
    opacity: 0.6,
  },
});

export default OpenSourceScreen;
