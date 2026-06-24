import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS } from '../theme';
import type { ScriptType } from '../types';

export interface LockGateProps {
  locked: boolean;
  children: React.ReactNode;
  isDark?: boolean;
  defaultScriptType?: ScriptType;
}

const FALLBACK_SCRIPT_TYPE: ScriptType = 'BIP84';

function pickBackdrop(isDark: boolean): string {
  const palette = isDark ? COLORS.dark : COLORS.light;
  return palette.bg;
}

export function LockGate({
  locked,
  children,
  isDark = false,
  defaultScriptType = FALLBACK_SCRIPT_TYPE,
}: LockGateProps): React.ReactElement | null {
  void defaultScriptType;

  if (!locked) {
    return null;
  }

  const overlayStyle: StyleProp<ViewStyle> = [
    StyleSheet.absoluteFill,
    { backgroundColor: pickBackdrop(isDark) },
  ];

  return (
    <View pointerEvents="auto" style={overlayStyle}>
      {children}
    </View>
  );
}

export default LockGate;
