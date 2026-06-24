import React, { useLayoutEffect } from 'react';
import {
  I18nManager,
  Image,
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

import { COLORS, RADIUS, SPACING, TYPE, type ColorScheme } from '../theme';
import loc from '../i18n';
import { useWallets } from '../wallets/context';
import { PrimaryButton } from '../components/PrimaryButton';
import type { AddWalletStackParamList } from '../navigation/types';

const DEFAULT_THRESHOLD = 2;
const DEFAULT_PARTICIPANTS = 3;
const KEYHOLE_IMAGE = require('../../img/keyhole.png');
const CHEVRON_SIZE = 22;

type MultisigIntroNavigation = NativeStackNavigationProp<
  AddWalletStackParamList,
  'MultisigIntro'
>;
type MultisigIntroRoute = RouteProp<AddWalletStackParamList, 'MultisigIntro'>;

export const MultisigIntroScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette: ColorScheme = isDark ? COLORS.dark : COLORS.light;
  const { isRTL } = useWallets();
  const navigation = useNavigation<MultisigIntroNavigation>();
  const route = useRoute<MultisigIntroRoute>();

  const threshold = route.params?.m ?? DEFAULT_THRESHOLD;
  const participants = route.params?.n ?? DEFAULT_PARTICIPANTS;
  const walletLabel = route.params?.walletLabel ?? loc.quorum.sharedHolding;

  useLayoutEffect(() => {
    navigation.setOptions({ title: '' });
  }, [navigation]);

  const openSettings = (): void => {
    navigation.navigate('MultisigAdvanced', { m: threshold, n: participants });
  };

  const goNext = (): void => {
    navigation.navigate('MultisigStep2', {
      m: threshold,
      n: participants,
      walletLabel,
    });
  };

  const chevronStyle = { transform: [{ scaleX: isRTL ? -1 : 1 }] };

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}>
      <View style={styles.graphic}>
        <Image
          source={KEYHOLE_IMAGE}
          style={[styles.keyhole, { tintColor: palette.fg }]}
          resizeMode="contain"
        />
      </View>

      <Text style={[TYPE.phraseIntro, styles.introText, { color: palette.muted }]}>
        {loc.formatString(loc.quorum.thresholdSummary, {
          m: threshold,
          n: participants,
        })}
      </Text>
      <Text style={[TYPE.phraseIntro, styles.introText, { color: palette.muted }]}>
        {loc.formatString(loc.quorum.spendThresholdNote, {
          m: threshold,
          n: participants,
        })}
      </Text>

      <Pressable
        onPress={openSettings}
        style={[styles.settingsRow, { borderColor: palette.fieldBorder }]}>
        <View style={styles.settingsCopy}>
          <Text style={[styles.settingsTitle, { color: palette.fg }]}>
            {loc.quorum.sharedControlOptions}
          </Text>
          <Text style={[styles.settingsSub, { color: palette.muted }]}>
            {loc.formatString(loc.quorum.suggestedScheme, {
              m: threshold,
              n: participants,
            })}
          </Text>
        </View>
        <MaterialIcons
          name="chevron-right"
          size={CHEVRON_SIZE}
          color={palette.muted}
          style={chevronStyle}
        />
      </Pressable>

      <PrimaryButton
        label={loc.appGeneral.beginNowAlt}
        color={palette.accentBlue}
        onPress={goNext}
        style={styles.startButton}
      />
    </ScrollView>
  );
};

const WRITING_DIRECTION = I18nManager.isRTL ? 'rtl' : 'ltr';

const styles = StyleSheet.create({
  body: {
    padding: SPACING.xl,
    paddingBottom: SPACING.huge,
  },
  graphic: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
  keyhole: {
    width: 100,
    height: 100,
  },
  introText: {
    textAlign: 'center',
    marginBottom: SPACING.md,
    writingDirection: WRITING_DIRECTION,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  settingsCopy: {
    flex: 1,
  },
  settingsTitle: {
    ...TYPE.toggle,
    writingDirection: WRITING_DIRECTION,
  },
  settingsSub: {
    ...TYPE.caption,
    marginTop: SPACING.xs,
    writingDirection: WRITING_DIRECTION,
  },
  startButton: {
    marginTop: SPACING.xxl,
  },
});

export default MultisigIntroScreen;
