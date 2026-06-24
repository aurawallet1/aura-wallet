import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { type ColorScheme } from '../theme';

const CHECK_PATH = 'M5 13l4 4L19 7';
const CHECK_STROKE_LENGTH = 20;
const POP_DURATION_MS = 280;
const FADE_DURATION_MS = 200;
const DRAW_DURATION_MS = 380;
const DRAW_DELAY_MS = 180;

const StrokePath = Animated.createAnimatedComponent(Path);

type SuccessCheckProps = {
  c: ColorScheme;
  isDark: boolean;
};

const SuccessCheck = ({ c, isDark }: SuccessCheckProps) => {
  const grow = useRef(new Animated.Value(0.4)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const trace = useRef(new Animated.Value(CHECK_STROKE_LENGTH)).current;

  useEffect(() => {
    const pop = Animated.parallel([
      Animated.timing(grow, {
        toValue: 1,
        duration: POP_DURATION_MS,
        easing: Easing.out(Easing.back(1.7)),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: FADE_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    const draw = Animated.timing(trace, {
      toValue: 0,
      duration: DRAW_DURATION_MS,
      delay: DRAW_DELAY_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    pop.start();
    draw.start();

    return () => {
      pop.stop();
      draw.stop();
    };
  }, [grow, fade, trace]);

  const haloColor = isDark ? '#202020' : '#ccddf9';

  return (
    <Animated.View
      style={[
        styles.halo,
        { backgroundColor: haloColor, opacity: fade, transform: [{ scale: grow }] },
      ]}
    >
      <Svg width={66} height={66} viewBox="0 0 24 24">
        <StrokePath
          d={CHECK_PATH}
          stroke={c.accentBlue}
          strokeWidth={2.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_STROKE_LENGTH}
          strokeDashoffset={trace}
        />
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  halo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 53,
  },
});

export default SuccessCheck;
export { SuccessCheck };
