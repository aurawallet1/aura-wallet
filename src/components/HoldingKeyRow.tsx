import React from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import type { ColorScheme } from '../theme';
import loc from '../i18n';

const isRtl = I18nManager.isRTL;
const writingDirection: 'rtl' | 'ltr' = isRtl ? 'rtl' : 'ltr';

const CONNECTOR_OFFSET = 20;
const TOP_SEGMENT_HEIGHT = 21;
const CIRCLE_DIAMETER = 42;

export interface HoldingKeyRowProps {
  index: number;
  total: number;
  filled: boolean;
  isNext: boolean;
  c: ColorScheme;
  onCreate: () => void;
  onImport: () => void;
}

const horizontalAnchor = isRtl ? { right: CONNECTOR_OFFSET } : { left: CONNECTOR_OFFSET };

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 16,
  },
  connectorTop: {
    position: 'absolute',
    top: 0,
    height: TOP_SEGMENT_HEIGHT,
    width: 1,
    borderWidth: 0.8,
    borderStyle: 'dashed',
    ...horizontalAnchor,
  },
  connectorBottom: {
    position: 'absolute',
    top: TOP_SEGMENT_HEIGHT,
    bottom: 0,
    width: 1,
    borderWidth: 0.8,
    borderStyle: 'dashed',
    ...horizontalAnchor,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circle: {
    width: CIRCLE_DIAMETER,
    height: CIRCLE_DIAMETER,
    borderRadius: CIRCLE_DIAMETER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  keyLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginStart: 16,
    writingDirection,
  },
  actions: {
    marginStart: 40,
    marginTop: 12,
    gap: 8,
  },
  action: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    writingDirection,
  },
  actionPressed: {
    opacity: 0.6,
  },
});

export function HoldingKeyRow({ index, total, filled, isNext, c, onCreate, onImport }: HoldingKeyRowProps): React.ReactElement {
  const slotNumber = index + 1;
  const hasConnectorAbove = index > 0;
  const hasConnectorBelow = index < total - 1;

  return (
    <View style={styles.wrap}>
      {hasConnectorAbove ? <View style={[styles.connectorTop, { borderColor: c.fieldBorder }]} /> : null}
      {hasConnectorBelow ? <View style={[styles.connectorBottom, { borderColor: c.fieldBorder }]} /> : null}

      <View style={styles.row}>
        {filled ? (
          <View style={[styles.circle, { backgroundColor: c.txInFg }]}>
            <MaterialIcons name="check" size={24} color="#FFFFFF" />
          </View>
        ) : (
          <View style={[styles.circle, { backgroundColor: c.cardGray }]}>
            <Text style={[styles.circleNumber, { color: c.muted }]}>{slotNumber}</Text>
          </View>
        )}
        <Text style={[styles.keyLabel, { color: c.muted }]}>
          {loc.formatString(loc.quorum.cosignerSlot, { number: slotNumber })}
        </Text>
      </View>

      {isNext ? (
        <View style={styles.actions}>
          <Pressable
            onPress={onCreate}
            style={({ pressed }) => [styles.action, { backgroundColor: c.cardGray }, pressed && styles.actionPressed]}>
            <Text style={[styles.actionLabel, { color: c.fg }]}>{loc.quorum.generateCosigner}</Text>
          </Pressable>
          <Pressable
            onPress={onImport}
            style={({ pressed }) => [styles.action, { backgroundColor: c.cardGray }, pressed && styles.actionPressed]}>
            <Text style={[styles.actionLabel, { color: c.fg }]}>{loc.holdings.restoreAction}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default HoldingKeyRow;
