import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ColorScheme } from '../theme';
import type { ScriptType } from '../types/index';
import loc from '../i18n';

export interface AddressTypeBadgeProps {
  isInternal: boolean;
  used: boolean;
  isDark: boolean;
  scheme?: ScriptType;
  c?: ColorScheme;
}

type BadgeTone = {
  label: string;
  background: string;
  foreground: string;
};

const USED_TONE = {
  label: () => loc.addrBook.spentMarker,
  light: { background: '#eef0f4', foreground: '#9aa0aa' },
  dark: { background: '#3A3A3C', foreground: '#9aa0aa' },
};

const CHANGE_TONE = {
  label: () => loc.coinSelect.modify,
  light: { background: '#FDF2DA', foreground: '#F38C47' },
  dark: { background: '#5A4E4E', foreground: '#F38C47' },
};

const RECEIVE_TONE = {
  label: () => loc.inflow.incomingTab,
  light: { background: '#D1F9D6', foreground: '#2EA86F' },
  dark: { background: 'rgba(210,248,214,0.2)', foreground: '#2EA86F' },
};

function resolveTone(isInternal: boolean, used: boolean, isDark: boolean): BadgeTone {
  const source = used ? USED_TONE : isInternal ? CHANGE_TONE : RECEIVE_TONE;
  const palette = isDark ? source.dark : source.light;
  return {
    label: source.label(),
    background: palette.background,
    foreground: palette.foreground,
  };
}

export function AddressTypeBadge({ isInternal, used, isDark }: AddressTypeBadgeProps): React.ReactElement {
  const tone = resolveTone(isInternal, used, isDark);
  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <Text style={[styles.label, { color: tone.foreground }]}>{tone.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  label: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default AddressTypeBadge;
