import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import { COLORS } from '../theme';

const DEFAULT_MASK_COLOR = COLORS.light.bg;

const GRID_SIDE = 5;
const TILE_FADE_DELAY_CAP_MS = 420;
const TILE_FADE_DURATION_MS = 400;
const HASH_MODULUS = 2147483647;
const HASH_MULTIPLIER = 31;

type TileSpec = {
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
  delayMs: number;
};

const computeDelay = (runKey: string, index: number, cap: number): number => {
  const source = runKey + ':' + String(index);
  let accumulator = 0;
  for (let pos = 0; pos < source.length; pos += 1) {
    const weighted = source.charCodeAt(pos) * (pos + 1);
    accumulator = (accumulator * HASH_MULTIPLIER + weighted) % HASH_MODULUS;
  }
  return accumulator % cap;
};

const buildTileGrid = (runKey: string, side: number, edge: number): TileSpec[] => {
  const baseCell = Math.floor(edge / side);
  const remainder = edge - baseCell * side;
  const tiles: TileSpec[] = [];
  for (let index = 0; index < side * side; index += 1) {
    const row = Math.floor(index / side);
    const column = index % side;
    const isLastColumn = column === side - 1;
    const isLastRow = row === side - 1;
    tiles.push({
      index,
      left: column * baseCell,
      top: row * baseCell,
      width: isLastColumn ? baseCell + remainder : baseCell,
      height: isLastRow ? baseCell + remainder : baseCell,
      delayMs: computeDelay(runKey, index, TILE_FADE_DELAY_CAP_MS),
    });
  }
  return tiles;
};

type RevealTileProps = {
  spec: TileSpec;
  maskColor: string;
  runKey: string;
};

const RevealTile = ({ spec, maskColor, runKey }: RevealTileProps) => {
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fade.setValue(1);
    const animation = Animated.sequence([
      Animated.delay(spec.delayMs),
      Animated.timing(fade, {
        toValue: 0,
        duration: TILE_FADE_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [runKey, spec.delayMs, fade]);

  const tileStyle: Animated.WithAnimatedObject<ViewStyle> = {
    left: spec.left,
    top: spec.top,
    width: spec.width,
    height: spec.height,
    backgroundColor: maskColor,
    opacity: fade,
  };

  return <Animated.View pointerEvents="none" style={[styles.maskTile, tileStyle]} />;
};

type QrStaggerRevealProps = {
  size: number;
  maskColor: string;
  runKey: string;
  children: React.ReactNode;
};

const QrStaggerReveal = ({ size, maskColor, runKey, children }: QrStaggerRevealProps) => {
  const tiles = useMemo(() => buildTileGrid(runKey, GRID_SIDE, size), [runKey, size]);
  const fill = maskColor || DEFAULT_MASK_COLOR;

  return (
    <View style={[styles.host, { width: size, height: size }]}>
      {children}
      {tiles.map(tile => (
        <RevealTile key={runKey + '-' + String(tile.index)} spec={tile} maskColor={fill} runKey={runKey} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  host: { overflow: 'hidden' },
  maskTile: { position: 'absolute' },
});

export default QrStaggerReveal;
export { QrStaggerReveal };
