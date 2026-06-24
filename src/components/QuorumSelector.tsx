import React from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import loc from '../i18n';
import type { ColorScheme } from '../theme';

export const QUORUM_MIN = 2;
export const QUORUM_MAX = 7;

const IS_RTL = I18nManager.isRTL;

const clamp = (value: number): number => Math.max(QUORUM_MIN, Math.min(QUORUM_MAX, value));

type StepperProps = {
  value: number;
  scheme: ColorScheme;
  canIncrement: boolean;
  canDecrement: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
};

function Stepper({ value, scheme, canIncrement, canDecrement, onIncrement, onDecrement }: StepperProps): React.JSX.Element {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={onIncrement}
        disabled={!canIncrement}
        hitSlop={6}
        style={({ pressed }) => [styles.chevron, pressed ? styles.dimmed : null]}
      >
        <MaterialIcons
          name="keyboard-arrow-up"
          size={22}
          color={canIncrement ? scheme.accentBlue : scheme.muted}
        />
      </Pressable>
      <Text style={[styles.count, { color: scheme.fg }]}>{value}</Text>
      <Pressable
        onPress={onDecrement}
        disabled={!canDecrement}
        hitSlop={6}
        style={({ pressed }) => [styles.chevron, pressed ? styles.dimmed : null]}
      >
        <MaterialIcons
          name="keyboard-arrow-down"
          size={22}
          color={canDecrement ? scheme.accentBlue : scheme.muted}
        />
      </Pressable>
    </View>
  );
}

export type QuorumSelectorProps = {
  m: number;
  n: number;
  setM: (value: number) => void;
  setN: (value: number) => void;
  c: ColorScheme;
};

export default function QuorumSelector({ m, n, setM, setN, c }: QuorumSelectorProps): React.JSX.Element {
  const applyM = (next: number): void => setM(clamp(next));
  const applyN = (next: number): void => setN(clamp(next));

  return (
    <View>
      <Text style={[styles.title, { color: c.fg }]}>{loc.quorum.approvalsNeeded}</Text>
      <Text style={[styles.subtitle, { color: c.muted }]}>{loc.quorum.neededFromAll}</Text>
      <View style={styles.row}>
        <Stepper
          value={m}
          scheme={c}
          canIncrement={m < n && m < QUORUM_MAX}
          canDecrement={m > QUORUM_MIN}
          onIncrement={() => applyM(m + 1)}
          onDecrement={() => applyM(m - 1)}
        />
        <Text style={[styles.connector, { color: c.muted }]}>{loc.quorum.outOf}</Text>
        <Stepper
          value={n}
          scheme={c}
          canIncrement={n < QUORUM_MAX}
          canDecrement={n > m}
          onIncrement={() => applyN(n + 1)}
          onDecrement={() => applyN(n - 1)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    writingDirection: IS_RTL ? 'rtl' : 'ltr',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    writingDirection: IS_RTL ? 'rtl' : 'ltr',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
  },
  stepper: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  chevron: {
    paddingVertical: 10,
  },
  count: {
    fontSize: 50,
    fontWeight: '700',
  },
  connector: {
    fontSize: 30,
    paddingHorizontal: 20,
    writingDirection: IS_RTL ? 'rtl' : 'ltr',
  },
  dimmed: {
    opacity: 0.6,
  },
});
