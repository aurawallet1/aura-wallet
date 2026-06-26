import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { COLORS, RADIUS, SIZE, SPACING, TYPE, type ColorScheme } from '../theme';
import loc from '../i18n';
import { useWallets } from '../wallets/context';
import { isValidMnemonic } from '../utils/validation';
import { PrimaryButton } from '../components/PrimaryButton';
import type { AddWalletStackParamList } from '../navigation/types';

const CLOSE_ICON_SIZE = 24;
const WHITESPACE_PATTERN = /\s+/g;

type MultisigImportNavigation = NativeStackNavigationProp<
  AddWalletStackParamList,
  'MultisigImport'
>;
type MultisigImportRoute = RouteProp<AddWalletStackParamList, 'MultisigImport'>;

const normalizeSeedInput = (raw: string): string => raw.trim().replace(WHITESPACE_PATTERN, ' ');

export const MultisigImportScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette: ColorScheme = isDark ? COLORS.dark : COLORS.light;
  const { isRTL } = useWallets();
  const navigation = useNavigation<MultisigImportNavigation>();
  const route = useRoute<MultisigImportRoute>();
  const { onImport } = route.params;

  const [draft, setDraft] = useState('');

  const dismiss = useCallback((): void => {
    navigation.goBack();
  }, [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerStyle: { backgroundColor: palette.elevated },
      contentStyle: { backgroundColor: palette.elevated },
      headerRight: () => (
        <Pressable onPress={dismiss} hitSlop={SIZE.closeHit} style={styles.closeButton}>
          <MaterialIcons name="close" size={CLOSE_ICON_SIZE} color={palette.fg} />
        </Pressable>
      ),
    });
  }, [navigation, dismiss, palette.fg, palette.elevated]);

  const submittedRef = useRef(false);
  const submit = useCallback((): void => {
    if (submittedRef.current) {
      return;
    }
    const phrase = normalizeSeedInput(draft);
    if (!isValidMnemonic(phrase)) {
      Alert.alert(loc.appGeneral.badSeedWords, loc.appGeneral.mnemonicCheckFailed);
      return;
    }
    submittedRef.current = true;
    onImport(phrase);
    navigation.goBack();
  }, [draft, onImport, navigation]);

  const headingStyle = isRTL ? styles.headingRtl : styles.heading;

  return (
    <ScrollView
      style={{ backgroundColor: palette.elevated }}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="always">
      <Text style={[headingStyle, { color: palette.fg }]}>
        {loc.quorum.restoreFromSeed}
      </Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        textAlignVertical="top"
        style={[
          styles.input,
          {
            backgroundColor: palette.inputBg,
            borderColor: palette.inputBorder,
            color: palette.fg,
          },
        ]}
      />
      <PrimaryButton
        label={loc.holdings.restoreAction}
        color={palette.accentBlue}
        onPress={submit}
        style={styles.importButton}
      />
    </ScrollView>
  );
};

const WRITING_DIRECTION = I18nManager.isRTL ? 'rtl' : 'ltr';
const INPUT_HEIGHT = 220;

const styles = StyleSheet.create({
  body: {
    padding: SPACING.xl,
    paddingBottom: SPACING.huge,
  },
  closeButton: {
    paddingHorizontal: SPACING.sm,
  },
  heading: {
    ...TYPE.phraseIntro,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    writingDirection: WRITING_DIRECTION,
  },
  headingRtl: {
    ...TYPE.phraseIntro,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    writingDirection: 'rtl',
  },
  input: {
    height: INPUT_HEIGHT,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...TYPE.cardDesc,
    writingDirection: WRITING_DIRECTION,
  },
  importButton: {
    marginTop: SPACING.xxl,
  },
});

export default MultisigImportScreen;
