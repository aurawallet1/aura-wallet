import React from 'react';
import { I18nManager, Pressable, StyleSheet, Text, type PressableStateCallbackType, type ViewStyle } from 'react-native';
import { RADIUS, SIZE, TYPE } from '../theme';

export interface PrimaryButtonProps {
  label: string;
  color: string;
  onPress: () => void;
  textColor?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

const DEFAULT_TEXT_COLOR = '#FFFFFF';
const MAX_FONT_SCALE = 1.3;

export function PrimaryButton({
  label,
  color,
  onPress,
  textColor = DEFAULT_TEXT_COLOR,
  style,
  disabled = false,
}: PrimaryButtonProps): React.ReactElement {
  const composeStyle = ({ pressed }: PressableStateCallbackType): ViewStyle[] => {
    const layers: ViewStyle[] = [styles.button, { backgroundColor: color }];
    if (pressed && !disabled) {
      layers.push(styles.pressed);
    }
    if (style) {
      layers.push(style);
    }
    return layers;
  };

  return (
    <Pressable onPress={onPress} disabled={disabled} style={composeStyle}>
      <Text numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.buttonText, { color: textColor }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: SIZE.buttonHeight,
    minHeight: SIZE.buttonMinHeight,
    paddingHorizontal: SIZE.buttonPadH,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  buttonText: {
    ...TYPE.button,
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
});

export default PrimaryButton;
