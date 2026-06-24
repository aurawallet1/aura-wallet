import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { MenuView, type MenuAction } from '@react-native-menu/menu';
import { ms, type ColorScheme } from '../theme';
import type { ScriptType } from '../types';

export type AddressRow = {
  address: string;
  wif: string;
  path: string;
  explorerUrl: string;
  isInternal: boolean;
  isFresh: boolean;
  used: boolean;
  balance: number;
  index: number;
  scheme: ScriptType | 'BIP48';
  txCount?: number;
};

export type UnitFormatter = {
  fmt: (sats: number) => string;
  label: string;
};

export type AddrRowItemProps = {
  item: AddressRow;
  c: ColorScheme;
  isDark: boolean;
  actions: MenuAction[];
  onMenu: (event: string, item: AddressRow) => void;
  onOpen: (item: AddressRow) => void;
  txLoaded: boolean;
  txCount: number;
  unit: UnitFormatter;
  transactionsLabel: string;
};

const PRESS_SCALE = 0.97;
const PRESS_DURATION = 120;
const REVEAL_OPACITY_DURATION = 180;
const REVEAL_OFFSET = 6;

type BadgeLook = { label: string; bg: string; fg: string };

const resolveBadgeLook = (isInternal: boolean, used: boolean, isDark: boolean): BadgeLook => {
  if (used) {
    return { label: 'Used', bg: isDark ? '#3A3A3C' : '#eef0f4', fg: '#9aa0aa' };
  }
  if (isInternal) {
    return { label: 'Change', bg: isDark ? '#5A4E4E' : '#FDF2DA', fg: '#F38C47' };
  }
  return { label: 'Receive', bg: isDark ? 'rgba(210,248,214,0.2)' : '#D1F9D6', fg: '#2EA86F' };
};

const TypeBadge = ({ isInternal, used, isDark }: { isInternal: boolean; used: boolean; isDark: boolean }) => {
  const look = resolveBadgeLook(isInternal, used, isDark);
  return (
    <View style={[styles.badge, { backgroundColor: look.bg }]}>
      <Text style={[styles.badgeText, { color: look.fg }]}>{look.label}</Text>
    </View>
  );
};

const AddrRowItem = ({
  item,
  c,
  isDark,
  actions,
  onMenu,
  onOpen,
  txLoaded,
  txCount,
  unit,
  transactionsLabel,
}: AddrRowItemProps) => {
  const balanceLine = `${unit.fmt(item.balance)} ${unit.label}`;
  const countLine = txLoaded ? `${transactionsLabel}${txCount}` : '';
  const revealSignature = useMemo(() => `${balanceLine}|${countLine}`, [balanceLine, countLine]);

  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const lastSignature = useRef(revealSignature);

  useEffect(() => {
    if (lastSignature.current === revealSignature) {
      return;
    }
    lastSignature.current = revealSignature;
    fade.setValue(0);
    slide.setValue(REVEAL_OFFSET);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: REVEAL_OPACITY_DURATION,
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0,
        stiffness: 220,
        damping: 16,
        mass: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [revealSignature, fade, slide]);

  const scale = useRef(new Animated.Value(1)).current;
  const animateScale = (toValue: number) => {
    Animated.timing(scale, {
      toValue,
      duration: PRESS_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const revealStyle = {
    opacity: fade,
    transform: [{ translateY: slide }],
  };

  return (
    <MenuView
      title={item.address}
      shouldOpenOnLongPress
      actions={actions}
      onPressAction={({ nativeEvent }) => onMenu(nativeEvent.event, item)}
    >
      <Pressable
        onPress={() => onOpen(item)}
        onPressIn={() => animateScale(PRESS_SCALE)}
        onPressOut={() => animateScale(1)}
      >
        <Animated.View
          style={[
            styles.row,
            {
              backgroundColor: c.elevated,
              borderBottomColor: isDark ? '#313030' : '#ededed',
              transform: [{ scale }],
            },
          ]}
        >
          <View style={styles.indexColumn}>
            <Text style={[styles.indexText, { color: c.txdMuted }]}>{item.index}</Text>
          </View>

          <View style={styles.bodyColumn}>
            <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.addressText, { color: c.fg }]}>
              {item.address}
            </Text>
            <Animated.Text numberOfLines={1} style={[styles.balanceText, { color: c.txdMuted }, revealStyle]}>
              {balanceLine}
            </Animated.Text>
          </View>

          <View style={styles.metaColumn}>
            <TypeBadge isInternal={item.isInternal} used={item.used} isDark={isDark} />
            {txLoaded ? (
              <Animated.Text numberOfLines={1} style={[styles.countText, { color: c.txdMuted }, revealStyle]}>
                {countLine}
              </Animated.Text>
            ) : null}
          </View>
        </Animated.View>
      </Pressable>
    </MenuView>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  indexColumn: {
    marginRight: 12,
    minWidth: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontSize: 15,
    fontWeight: '600',
  },
  bodyColumn: {
    flex: 1,
    paddingRight: 8,
  },
  addressText: {
    fontSize: 16,
    fontWeight: '500',
    writingDirection: 'ltr',
  },
  balanceText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
    writingDirection: 'ltr',
  },
  metaColumn: {
    marginLeft: 8,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 13,
    marginTop: 6,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: ms(20),
  },
  badgeText: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default AddrRowItem;
