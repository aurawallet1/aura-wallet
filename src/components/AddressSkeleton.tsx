import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { ColorScheme } from '../theme';

export interface AddressSkeletonProps {
  c: ColorScheme;
  isDark: boolean;
}

const TRACK_WIDTH = 130;
const TRACK_HEIGHT = 13;
const SWEEP_WIDTH = 82;
const SWEEP_DURATION = 1050;
const SWEEP_PAUSE = 450;

let bandIdCounter = 0;

const nextBandId = (): string => {
  bandIdCounter += 1;
  return `addrShim${bandIdCounter}`;
};

export function AddressSkeleton({ c, isDark }: AddressSkeletonProps): React.ReactElement {
  const gradientId = useMemo(nextBandId, []);
  const offset = useRef(new Animated.Value(-SWEEP_WIDTH)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(offset, {
          toValue: TRACK_WIDTH,
          duration: SWEEP_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(SWEEP_PAUSE),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [offset]);

  const sweepColor = isDark ? '#6E6E73' : '#FFFFFF';
  const peakOpacity = isDark ? 0.5 : 0.85;

  return (
    <View style={[styles.track, { backgroundColor: c.skeleton }]}>
      <Animated.View style={[styles.sweep, { transform: [{ translateX: offset }] }]}>
        <Svg width={SWEEP_WIDTH} height={TRACK_HEIGHT}>
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0" stopColor={sweepColor} stopOpacity={0} />
              <Stop offset="0.5" stopColor={sweepColor} stopOpacity={peakOpacity} />
              <Stop offset="1" stopColor={sweepColor} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={SWEEP_WIDTH} height={TRACK_HEIGHT} fill={`url(#${gradientId})`} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SWEEP_WIDTH,
  },
});

export default AddressSkeleton;
