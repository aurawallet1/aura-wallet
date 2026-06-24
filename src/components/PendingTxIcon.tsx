import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { SIZE } from '../theme';

const ROTATION_PERIOD_MS = 1100;
const SPIN_GLYPH = 'autorenew';

export interface PendingTxIconProps {
  size?: number;
  color: string;
}

export const PendingTxIcon: React.FC<PendingTxIconProps> = ({ size = SIZE.iconGlyph, color }) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sweep = Animated.timing(progress, {
      toValue: 1,
      duration: ROTATION_PERIOD_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    const loop = Animated.loop(sweep);
    loop.start();
    return () => {
      loop.stop();
      progress.setValue(0);
    };
  }, [progress]);

  const rotate = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    [progress],
  );

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <MaterialIcons name={SPIN_GLYPH} size={size} color={color} />
    </Animated.View>
  );
};

export default PendingTxIcon;
