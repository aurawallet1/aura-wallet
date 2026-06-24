import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { ColorScheme } from '../theme';

const ROW_SPAN = 150;
const ROW_HEIGHT = 20;
const TILE_COUNT = 9;
const MAX_DELAY_MS = 420;
const FADE_MS = 400;

const computeDelays = (seed: string, count: number, ceiling: number): number[] => {
  const out: number[] = [];
  for (let slot = 0; slot < count; slot++) {
    const token = `${seed}:${slot}`;
    let acc = 0;
    for (let pos = 0; pos < token.length; pos++) {
      acc = (acc * 31 + token.charCodeAt(pos) * (pos + 1)) % 2147483647;
    }
    out.push(acc % ceiling);
  }
  return out;
};

interface MaskTileProps {
  width: number;
  height: number;
  left: number;
  top: number;
  fill: string;
  delayMs: number;
  runKey: string;
}

const MaskTile = ({ width, height, left, top, fill, delayMs, runKey }: MaskTileProps) => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(1);
    const animation = Animated.sequence([
      Animated.delay(delayMs),
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [runKey, delayMs, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.tile, { left, top, width, height, backgroundColor: fill, opacity }]}
    />
  );
};

interface AddressRevealProps {
  c: ColorScheme;
  runKey: string;
  children: React.ReactNode;
}

const AddressReveal = ({ c, runKey, children }: AddressRevealProps) => {
  const delays = useMemo(() => computeDelays(runKey, TILE_COUNT, MAX_DELAY_MS), [runKey]);
  const tileWidth = ROW_SPAN / TILE_COUNT;

  return (
    <View style={styles.host}>
      {children}
      {delays.map((delayMs, index) => (
        <MaskTile
          key={`${runKey}-${index}`}
          width={tileWidth}
          height={ROW_HEIGHT}
          left={index * tileWidth}
          top={0}
          fill={c.fieldBg}
          delayMs={delayMs}
          runKey={runKey}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  host: { alignSelf: 'flex-start', overflow: 'hidden' },
  tile: { position: 'absolute' },
});

export default AddressReveal;
