import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

export const QR_STAGGER_TILE_DURATION_MS = 400;

export interface QrRevealTileProps {
  width: number;
  height: number;
  left: number;
  top: number;
  maskColor: string;
  delayMs: number;
  runKey: string;
}

const QrRevealTile: React.FC<QrRevealTileProps> = ({ width, height, left, top, maskColor, delayMs, runKey }) => {
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fade.setValue(1);
    const animation = Animated.sequence([
      Animated.delay(delayMs),
      Animated.timing(fade, {
        toValue: 0,
        duration: QR_STAGGER_TILE_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => {
      animation.stop();
    };
  }, [runKey, delayMs, fade]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.tile, { left, top, width, height, backgroundColor: maskColor, opacity: fade }]}
    />
  );
};

const styles = StyleSheet.create({
  tile: { position: 'absolute' },
});

export default QrRevealTile;
