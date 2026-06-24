import React from 'react';
import {
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableStateCallbackType,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { ColorScheme } from '../theme';
import loc from '../i18n';

const LABEL_SIZE = 22;
const ROW_PAD_H = 16;
const ROW_PAD_V = 8;
const ROW_GAP = 10;
const ACTIVE_RADIUS = 8;
const PILL_RADIUS = 5;
const PILL_PAD_H = 6;
const PILL_PAD_V = 3;
const FADE = 0.6;

const baseDir: TextStyle['writingDirection'] = I18nManager.isRTL ? 'rtl' : 'ltr';
const pinnedLtr: TextStyle['writingDirection'] = 'ltr';

export interface FeeOptionRowProps {
  c: ColorScheme;
  isDark: boolean;
  label: string;
  time: string;
  fee?: string;
  rate: number;
  active: boolean;
  onPress: () => void;
}

export function FeeOptionRow({ c, isDark, label, time, fee, rate, active, onPress }: FeeOptionRowProps): React.ReactElement {
  const restingTint = isDark ? c.muted : c.labelText;
  const figureTint = active ? c.accentGreen : restingTint;

  const containerStyle = ({ pressed }: PressableStateCallbackType): ViewStyle[] => {
    const layers: ViewStyle[] = [styles.container];
    if (active) {
      layers.push(styles.containerActive, { backgroundColor: c.txInBg });
    }
    if (pressed) {
      layers.push(styles.faded);
    }
    return layers;
  };

  return (
    <Pressable onPress={onPress} style={containerStyle}>
      <View style={styles.line}>
        <Text style={[styles.label, { color: c.accentGreen }]}>{label}</Text>
        <View style={[styles.pill, { backgroundColor: c.accentGreen }]}>
          <Text style={[styles.pillText, { color: c.bg }]}>{`~${time}`}</Text>
        </View>
      </View>
      <View style={styles.line}>
        {fee ? <Text style={[styles.figure, { color: figureTint }]}>{fee}</Text> : null}
        <Text style={[styles.figure, { color: figureTint }]}>
          {rate} {loc.denom.feeRateMetric}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: ROW_PAD_H,
    paddingVertical: ROW_PAD_V,
    marginBottom: ROW_GAP,
  },
  containerActive: {
    borderRadius: ACTIVE_RADIUS,
  },
  faded: {
    opacity: FADE,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: LABEL_SIZE,
    fontWeight: '600',
    writingDirection: baseDir,
  },
  pill: {
    borderRadius: PILL_RADIUS,
    paddingHorizontal: PILL_PAD_H,
    paddingVertical: PILL_PAD_V,
  },
  pillText: {
    writingDirection: baseDir,
  },
  figure: {
    writingDirection: pinnedLtr,
  },
});

export default FeeOptionRow;
