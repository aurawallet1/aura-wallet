import React from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { fs, type ColorScheme } from '../theme';

const isRtl = I18nManager.isRTL;

export interface OptionTileProps {
  c: ColorScheme;
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 8,
    marginBottom: 8,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
  },
  leading: {
    marginEnd: 8,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: fs(18),
    fontWeight: 'bold',
    writingDirection: isRtl ? 'rtl' : 'ltr',
  },
  subtitle: {
    fontSize: fs(13),
    fontWeight: '500',
    writingDirection: isRtl ? 'rtl' : 'ltr',
  },
  active: {
    opacity: 0.6,
  },
});

export function OptionTile({ c, icon, label, subtitle, selected, onPress }: OptionTileProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: c.tileBg }, pressed && styles.active]}>
      <View style={styles.inner}>
        <View style={styles.leading}>{icon}</View>
        <View style={styles.body}>
          <Text numberOfLines={1} style={[styles.title, { color: c.fg }]}>
            {label}
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: c.muted }]}>
            {subtitle}
          </Text>
        </View>
        {selected && <MaterialIcons name="check" size={22} color={c.fg} />}
      </View>
    </Pressable>
  );
}

export default OptionTile;
