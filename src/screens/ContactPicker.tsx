import React, { useCallback, useLayoutEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { COLORS, RADIUS, SIZE, SPACING, TYPE } from '../theme';
import type { SendStackParamList } from '../navigation/types';
import { useWallets, type AddressBookEntry } from '../wallets/context';
import { truncateAddress } from '../utils/format';
import loc from '../i18n';

type ContactPickerNavigation = NativeStackNavigationProp<SendStackParamList, 'ContactPicker'>;
type ContactPickerRoute = RouteProp<SendStackParamList, 'ContactPicker'>;

const CLOSE_GLYPH = 24;

export const ContactPickerScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<ContactPickerNavigation>();
  const route = useRoute<ContactPickerRoute>();
  const { onPick } = route.params;
  const { addressBook } = useWallets();

  const dismiss = useCallback((): void => {
    navigation.goBack();
  }, [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight: () => (
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={loc.core.dismissAction}
          hitSlop={SIZE.closeHit}
          style={styles.closeButton}>
          <MaterialIcons name="close" size={CLOSE_GLYPH} color={palette.fg} />
        </Pressable>
      ),
    });
  }, [navigation, dismiss, palette.fg]);

  const choose = useCallback(
    (entry: AddressBookEntry): void => {
      onPick({ address: entry.address, name: entry.name ?? '' });
      navigation.goBack();
    },
    [onPick, navigation],
  );

  const isEmpty = addressBook.length === 0;

  return (
    <ScrollView
      style={{ backgroundColor: palette.elevated }}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}>
      <Text style={[styles.heading, { color: palette.fg }]}>{loc.routes.contactDirectory.heading}</Text>
      {isEmpty ? (
        <Text style={[styles.emptyState, { color: palette.muted }]}>
          {loc.routes.contactDirectory.vacantPlaceholder}
        </Text>
      ) : (
        addressBook.map(entry => (
          <Pressable
            key={entry.address}
            onPress={() => choose(entry)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.entryRow, pressed && styles.entryRowPressed]}>
            <Text style={[styles.entryAddress, { color: palette.fg }]} numberOfLines={1}>
              {truncateAddress(entry.address)}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    ...TYPE.cardTitle,
    marginBottom: SPACING.lg,
  },
  emptyState: {
    ...TYPE.cardDesc,
    paddingVertical: SPACING.lg,
  },
  entryRow: {
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.control,
  },
  entryRowPressed: {
    opacity: 0.55,
  },
  entryAddress: {
    ...TYPE.button,
    fontWeight: '500',
  },
});

export default ContactPickerScreen;
