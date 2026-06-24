import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS, RADIUS, SPACING } from '../theme';
import { useWallets } from '../wallets/context';
import { triggerSuccessHaptic } from '../utils/haptics';
import type { RootStackParamList } from '../navigation/types';

const BRAND_MARK = require('../../img/logo.png');

const HOLD_DURATION_MS = 1000;

type SplashNavigation = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

export const SplashScreen = () => {
  const palette = useColorScheme() === 'dark' ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<SplashNavigation>();
  const { wallets, loaded, pwdEnabled } = useWallets();
  const [holdElapsed, setHoldElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHoldElapsed(true), HOLD_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loaded || !holdElapsed) {
      return;
    }
    triggerSuccessHaptic();
    const hasHolding = wallets.length > 0 || pwdEnabled;
    if (hasHolding) {
      navigation.reset({ index: 0, routes: [{ name: 'WalletsList' }] });
    } else {
      navigation.replace('Welcome');
    }
  }, [loaded, holdElapsed, wallets.length, pwdEnabled, navigation]);

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <Image source={BRAND_MARK} style={styles.mark} resizeMode="contain" />
      <View style={styles.spinner}>
        <ActivityIndicator />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  mark: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.card,
  },
  spinner: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    marginTop: 78,
    alignItems: 'center',
  },
});

export default SplashScreen;
