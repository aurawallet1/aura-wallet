import React, { useLayoutEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import loc from '../i18n';
import { COLORS, SIZE, SPACING, TYPE } from '../theme';
import { useWallets } from '../wallets/context';
import type { AddWalletStackParamList } from '../navigation/types';
import QuorumSelector from '../components/QuorumSelector';

type Navigation = NativeStackNavigationProp<AddWalletStackParamList, 'MultisigAdvanced'>;
type Route = RouteProp<AddWalletStackParamList, 'MultisigAdvanced'>;

const directionalText = (rtl: boolean): TextStyle => ({
  writingDirection: rtl ? 'rtl' : 'ltr',
  textAlign: rtl ? 'right' : 'left',
});

export const MultisigAdvancedScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const { isRTL } = useWallets();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const [requiredKeys, setRequiredKeys] = useState(route.params?.m ?? 2);
  const [totalKeys, setTotalKeys] = useState(route.params?.n ?? 3);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.quorum.sharedHolding,
      headerRight: () => (
        <Pressable
          onPress={() =>
            navigation.popTo('MultisigIntro', {
              walletLabel: loc.quorum.sharedHolding,
              m: requiredKeys,
              n: totalKeys,
            })
          }
          hitSlop={SIZE.closeHit}
          style={styles.headerAction}>
          <Text style={[TYPE.button, directionalText(isRTL), { color: palette.accentBlue }]}>
            {loc.outflow.finishEntry}
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, palette.accentBlue, requiredKeys, totalKeys, isRTL]);

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}>
      <QuorumSelector
        m={requiredKeys}
        n={totalKeys}
        setM={setRequiredKeys}
        setN={setTotalKeys}
        c={palette}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingTop: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.huge,
  },
  headerAction: {
    paddingHorizontal: SPACING.xs,
  },
});

export default MultisigAdvancedScreen;
