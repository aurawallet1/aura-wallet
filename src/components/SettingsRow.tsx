import React from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { ColorScheme, SPACING } from '../theme';

type GlyphName = React.ComponentProps<typeof MaterialIcons>['name'];

export interface SettingsRowItem {
  icon: GlyphName;
  title: string;
  color: string;
  subtitle?: string;
  route: string;
}

export interface SettingsRowProps {
  row: SettingsRowItem;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
  c: ColorScheme;
  cellBg: string;
}

const TILE_ALPHA = '1F';

const withAlpha = (base: string): string => `${base}${TILE_ALPHA}`;

const SettingsRow: React.FC<SettingsRowProps> = ({ row, isFirst, isLast, onPress, c, cellBg }) => {
  const rtl = I18nManager.isRTL;
  const writing = rtl ? 'rtl' : 'ltr';
  const chevronFlip = rtl ? -1 : 1;

  const surface = ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => {
    const layers: StyleProp<ViewStyle>[] = [styles.row, { backgroundColor: cellBg }];
    if (isFirst) {
      layers.push(styles.firstRow);
    }
    if (isLast) {
      layers.push(styles.lastRow);
    } else {
      layers.push({ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.fieldBorder });
    }
    if (pressed) {
      layers.push(styles.pressed);
    }
    return layers;
  };

  return (
    <Pressable onPress={onPress} style={surface}>
      <View style={[styles.tile, { backgroundColor: withAlpha(row.color) }]}>
        <MaterialIcons name={row.icon} size={20} color={row.color} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: c.fg, writingDirection: writing }]}>{row.title}</Text>
        {row.subtitle ? (
          <Text style={[styles.subtitle, { color: c.altText, writingDirection: writing }]}>{row.subtitle}</Text>
        ) : null}
      </View>
      <MaterialIcons
        name="chevron-right"
        size={24}
        color={c.altText}
        style={[styles.chevron, { transform: [{ scaleX: chevronFlip }] }]}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    overflow: 'hidden',
  },
  firstRow: {
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  lastRow: {
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  pressed: {
    opacity: 0.6,
  },
  tile: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: SPACING.md,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    paddingVertical: 2,
  },
  chevron: {
    opacity: 0.7,
  },
});

export default SettingsRow;
