import React from 'react';
import { I18nManager, Keyboard, Pressable, StyleSheet, Text, View, type PressableStateCallbackType, type ViewStyle } from 'react-native';
import type { ColorScheme } from '../theme';
import loc from '../i18n';

const BAR_MIN_HEIGHT = 54;
const ROW_PAD_H = 4;
const LABEL_FONT = 16;
const BTN_FONT = 16;
const BTN_PAD_H = 10;
const BTN_PAD_V = 16;
const LABEL_PAD_V = 16;
const LABEL_MARGIN_START = 12;
const HIT = 8;
const MUTED_LABEL = '#9aa0aa';
const PRESSED_OPACITY = 0.6;

const direction = I18nManager.isRTL ? 'rtl' : 'ltr';

export interface SendUseAllBarProps {
  c: ColorScheme;
  balanceBtc: string;
  unitL: string;
  canUseAll: boolean;
  onUseAll: () => void;
}

export function SendUseAllBar({ c, balanceBtc, unitL, canUseAll, onUseAll }: SendUseAllBarProps): React.ReactElement {
  const withPress = (base: ViewStyle) => ({ pressed }: PressableStateCallbackType): ViewStyle[] => {
    const layers: ViewStyle[] = [base];
    if (pressed) {
      layers.push(styles.pressed);
    }
    return layers;
  };

  return (
    <View style={[styles.root, { backgroundColor: c.inputBg }]}>
      <Text style={styles.label} numberOfLines={1}>
        {loc.outflow.holdingsCaption}
        {balanceBtc} {unitL}
      </Text>
      <View style={styles.actions}>
        {canUseAll ? (
          <Pressable onPress={onUseAll} hitSlop={HIT} style={withPress(styles.action)}>
            <Text style={[styles.actionText, { color: c.accentBlue }]}>{loc.denom.ceilingLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={HIT} style={withPress(styles.action)}>
          <Text style={[styles.actionText, { color: c.fg }]}>{loc.outflow.finishEntry}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    minHeight: BAR_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ROW_PAD_H,
  },
  label: {
    flexShrink: 1,
    marginStart: LABEL_MARGIN_START,
    paddingTop: LABEL_PAD_V,
    paddingBottom: LABEL_PAD_V,
    fontSize: LABEL_FONT,
    color: MUTED_LABEL,
    writingDirection: direction,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  action: {
    paddingHorizontal: BTN_PAD_H,
    paddingVertical: BTN_PAD_V,
  },
  actionText: {
    fontSize: BTN_FONT,
    fontWeight: '600',
    writingDirection: direction,
  },
  pressed: {
    opacity: PRESSED_OPACITY,
  },
});

export default SendUseAllBar;
