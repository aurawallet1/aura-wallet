import React, { useCallback, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { COLORS } from '../theme';
import type { SendStackParamList } from '../navigation/types';
import { useWallets } from '../wallets/context';
import loc from '../i18n';

type SendNoteSheetRoute = RouteProp<SendStackParamList, 'SendNoteSheet'>;

const ACCESSORY_VIEW_ID = 'send-note-keyboard-bar';
const PLACEHOLDER_COLOR = '#81868e';

const SendNoteSheetScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;

  useWallets();

  const { params } = useRoute<SendNoteSheetRoute>();
  const { note, onSave } = params;

  const [draft, setDraft] = useState<string>(note);

  const handleChange = useCallback(
    (next: string): void => {
      setDraft(next);
      onSave(next);
    },
    [onSave],
  );

  const dismissKeyboard = useCallback((): void => {
    Keyboard.dismiss();
  }, []);

  const showAccessory = Platform.OS === 'ios';

  return (
    <View style={[styles.fill, { backgroundColor: palette.elevated }]}>
      <View style={styles.sheet}>
        <TextInput
          autoFocus
          multiline
          value={draft}
          onChangeText={handleChange}
          placeholder={loc.outflow.memoHint}
          placeholderTextColor={PLACEHOLDER_COLOR}
          style={[styles.input, { color: palette.fg, textAlign: 'auto', writingDirection: 'auto' }]}
          textAlignVertical="top"
          inputAccessoryViewID={showAccessory ? ACCESSORY_VIEW_ID : undefined}
        />
      </View>
      {showAccessory ? (
        <InputAccessoryView nativeID={ACCESSORY_VIEW_ID}>
          <View style={[styles.keyboardBar, { backgroundColor: palette.inputBg }]}>
            <Pressable onPress={dismissKeyboard} style={styles.keyboardButton}>
              <Text style={[styles.keyboardButtonText, { color: palette.fg }]}>
                {loc.outflow.finishEntry}
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    minHeight: 220,
  },
  input: {
    minHeight: 160,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
    paddingVertical: 0,
  },
  keyboardBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    maxHeight: 44,
  },
  keyboardButton: {
    minWidth: 100,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  keyboardButtonText: {
    fontSize: 16,
  },
});

export default SendNoteSheetScreen;
export { SendNoteSheetScreen };
