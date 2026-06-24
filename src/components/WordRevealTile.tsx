import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { RADIUS } from '../theme';

const FADE_DURATION_MS = 400;

export interface WordRevealTileProps {
  maskColor: string;
  delayMs: number;
  runKey: string;
  radius?: number;
}

const WordRevealTile: React.FC<WordRevealTileProps> = ({ maskColor, delayMs, runKey, radius }) => {
  const cover = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    cover.stopAnimation();
    cover.setValue(1);

    const animation = Animated.sequence([
      Animated.delay(delayMs),
      Animated.timing(cover, {
        toValue: 0,
        duration: FADE_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [runKey, delayMs, cover]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: maskColor,
          opacity: cover,
          borderRadius: radius ?? RADIUS.chip,
        },
      ]}
    />
  );
};

export default WordRevealTile;
