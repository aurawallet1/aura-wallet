import React from 'react';
import {
  ActivityIndicator,
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import type { ColorScheme } from '../theme';

const LABEL_TINT = '#81868e';

export interface ConfirmRowProps {
  c: ColorScheme;
  label: string;
  value: string;
  pencil?: boolean;
  onPencil?: () => void;
  loading?: boolean;
  editLabel?: string;
}

const ConfirmRow: React.FC<ConfirmRowProps> = ({
  c,
  label,
  value,
  pencil = false,
  onPencil,
  loading = false,
  editLabel,
}) => {
  const labelDirection = I18nManager.isRTL ? 'rtl' : 'ltr';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { writingDirection: labelDirection }]}>
          {label}
        </Text>
        {pencil && (
          <Pressable
            onPress={onPencil}
            hitSlop={8}
            style={styles.editButton}
            accessibilityLabel={editLabel}
          >
            <MaterialIcons name="edit" size={15} color={LABEL_TINT} />
          </Pressable>
        )}
      </View>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={c.muted}
          style={styles.spinner}
        />
      ) : (
        <Text style={[styles.value, { color: c.fg }]} selectable>
          {value}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: {
    fontSize: 17,
    fontWeight: '500',
    color: LABEL_TINT,
  },
  editButton: {
    marginStart: 6,
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
    writingDirection: 'ltr',
  },
  spinner: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
});

export default ConfirmRow;
