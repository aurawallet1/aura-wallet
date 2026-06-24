import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import type { ColorScheme } from '../theme';

export interface QuorumStepperProps {
  value: number;
  c: ColorScheme;
  onUp: () => void;
  onDown: () => void;
  upDisabled: boolean;
  downDisabled: boolean;
}

const CHEVRON_SIZE = 22;
const HIT_SLOP = 6;

const styles = StyleSheet.create({
  stepper: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  chevron: {
    paddingVertical: 10,
  },
  chevronPressed: {
    opacity: 0.6,
  },
  count: {
    fontSize: 50,
    fontWeight: '700',
  },
});

export const QuorumStepper: React.FC<QuorumStepperProps> = ({
  value,
  c,
  onUp,
  onDown,
  upDisabled,
  downDisabled,
}) => {
  const tintFor = (disabled: boolean): string => (disabled ? c.muted : c.accentBlue);

  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={onUp}
        disabled={upDisabled}
        hitSlop={HIT_SLOP}
        style={({ pressed }) => [styles.chevron, pressed ? styles.chevronPressed : null]}>
        <MaterialIcons name="keyboard-arrow-up" size={CHEVRON_SIZE} color={tintFor(upDisabled)} />
      </Pressable>
      <Text style={[styles.count, { color: c.fg }]}>{value}</Text>
      <Pressable
        onPress={onDown}
        disabled={downDisabled}
        hitSlop={HIT_SLOP}
        style={({ pressed }) => [styles.chevron, pressed ? styles.chevronPressed : null]}>
        <MaterialIcons name="keyboard-arrow-down" size={CHEVRON_SIZE} color={tintFor(downDisabled)} />
      </Pressable>
    </View>
  );
};

export default QuorumStepper;
