import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SIZE, SPACING, type ColorScheme } from '../theme';
import loc from '../i18n';
import { OptionTile } from '../components/OptionTile';
import { PrimaryButton } from '../components/PrimaryButton';
import { triggerSuccessHaptic } from '../utils/haptics';
import type { AddWalletStackParamList } from '../navigation/types';

type WalletKind = 'standard' | 'multisig';

type AddWalletNavigation = NativeStackNavigationProp<AddWalletStackParamList, 'AddWallet'>;

const PLACEHOLDER_COLOR = '#81868e';

const diceIcon = require('../../img/dice.png');
const keyholeIcon = require('../../img/keyhole.png');
const closeLight = require('../../img/close.png');
const closeDark = require('../../img/close-white.png');

export const AddWalletScreen = (): React.ReactElement => {
  const scheme = useColorScheme();
  const palette: ColorScheme = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<AddWalletNavigation>();
  const insets = useSafeAreaInsets();
  const dismissImage = scheme === 'dark' ? closeDark : closeLight;

  const [kind, setKind] = useState<WalletKind>('standard');
  const [walletName, setWalletName] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={SIZE.closeHit}
          style={styles.dismissButton}>
          <Image source={dismissImage} style={styles.dismissImage} />
        </Pressable>
      ),
    });
  }, [navigation, dismissImage]);

  const chooseStandard = useCallback(() => {
    Keyboard.dismiss();
    setKind('standard');
  }, []);

  const chooseMultisig = useCallback(() => {
    Keyboard.dismiss();
    setKind('multisig');
  }, []);

  const handleContinue = useCallback(() => {
    const trimmed = walletName.trim();
    if (kind === 'multisig') {
      navigation.navigate('MultisigIntro', {
        walletLabel: trimmed || loc.quorum.sharedHolding,
      });
      return;
    }
    triggerSuccessHaptic();
    navigation.navigate('PleaseBackup', { name: trimmed });
  }, [kind, navigation, walletName]);

  const openImport = useCallback(() => {
    navigation.navigate('ImportWallet', { name: walletName.trim() });
  }, [navigation, walletName]);

  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: palette.bg }]}
      contentContainerStyle={styles.scrollBody}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}>
      <View style={styles.form}>
        <Text style={[styles.sectionLabel, { color: palette.muted }]}>
          {loc.holdings.titleField}
        </Text>
        <View
          style={[
            styles.nameField,
            { backgroundColor: palette.inputBg, borderColor: palette.inputBorder },
          ]}>
          <TextInput
            style={[styles.nameInput, { color: palette.fg }]}
            value={walletName}
            onChangeText={setWalletName}
            placeholder={loc.holdings.standardLabel}
            placeholderTextColor={PLACEHOLDER_COLOR}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: palette.muted }]}>
          {loc.holdings.kindField}
        </Text>
        <OptionTile
          c={palette}
          selected={kind === 'standard'}
          icon={
            <Image
              source={diceIcon}
              style={[styles.tileIcon, { tintColor: palette.fg }]}
              resizeMode="contain"
            />
          }
          label={loc.holdings.freshMnemonic}
          subtitle={loc.holdings.loneKeyBlurb}
          onPress={chooseStandard}
        />
        <OptionTile
          c={palette}
          selected={kind === 'multisig'}
          icon={
            <Image
              source={keyholeIcon}
              style={[styles.keyholeIcon, { tintColor: palette.fg }]}
              resizeMode="contain"
            />
          }
          label={loc.holdings.cosignedAccount}
          subtitle={loc.holdings.cosignedBlurb}
          onPress={chooseMultisig}
        />
      </View>

      <View style={{ paddingBottom: insets.bottom + SPACING.lg }}>
        <PrimaryButton
          label={loc.appGeneral.beginNow}
          color={palette.accentBlue}
          onPress={handleContinue}
        />
        <Pressable onPress={openImport} style={styles.importLink}>
          <Text style={[styles.importText, { color: palette.fg }]}>
            {loc.holdings.bringInAccount}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scrollBody: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  form: {
    flexShrink: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.lg,
  },
  nameField: {
    height: SIZE.buttonHeight,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: SPACING.sm,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  nameInput: {
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 0,
  },
  tileIcon: {
    width: SIZE.iconGlyph,
    height: SIZE.iconGlyph,
  },
  keyholeIcon: {
    width: SIZE.iconGlyph,
    height: SIZE.iconGlyph,
  },
  dismissButton: {
    paddingHorizontal: SPACING.sm,
  },
  dismissImage: {
    width: 22,
    height: 22,
  },
  importLink: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  importText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AddWalletScreen;
