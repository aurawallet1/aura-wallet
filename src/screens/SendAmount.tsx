import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Clipboard,
  FlatList,
  Image,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MenuView, type MenuAction } from '@react-native-menu/menu';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { COLORS, SIZE, TYPE } from '../theme';
import loc from '../i18n';
import { PrimaryButton } from '../components/PrimaryButton';
import SendAmountField, { amountToSats, type SendUnit } from '../components/SendAmountField';
import { SendUseAllBar } from '../components/SendUseAllBar';
import { useWallets, type WalletEntry } from '../wallets/context';
import { fetchBtcRate } from '../network/rates';
import { formatBtcTrim } from '../utils/currency';
import { isValidBitcoinAddress } from '../utils/validation';
import { parsePaymentUri } from '../utils/bip21';
import { triggerHaptic } from '../utils/haptics';
import type { RootStackParamList, SendStackParamList } from '../navigation/types';
import type { Utxo } from '../types/index';

const AMOUNT_ACCESSORY_ID = 'send-amount-keyboard-bar';
const ADDRESS_ACCESSORY_ID = 'send-address-keyboard-bar';
const MIN_SPENDABLE_SATS = 500;

const closeWhite = require('../../img/close-white.png');
const closeDark = require('../../img/close.png');

interface Recipient {
  key: string;
  address: string;
  name: string;
  amount: string;
  unit: SendUnit;
}

const makeRecipient = (overrides: Partial<Recipient> = {}): Recipient => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  address: '',
  name: '',
  amount: '',
  unit: 'BTC',
  ...overrides,
});

const utxoKey = (walletId: string, u: Utxo): string =>
  `${walletId}:${u.tx_hash ?? u.txid}:${u.tx_pos ?? u.vout}`;

const utxoValue = (u: Utxo): number => (typeof u.value === 'number' ? u.value : 0);

const walletUtxos = (entry: WalletEntry | undefined): Utxo[] => {
  if (!entry) return [];
  const source = entry.multisig ? entry.multisig.scan : entry.scan;
  const list = source?.result?.grandTotals?.utxos;
  return Array.isArray(list) ? (list as Utxo[]) : [];
};

const walletBalanceSats = (entry: WalletEntry | undefined): number => {
  if (!entry) return 0;
  const source = entry.multisig ? entry.multisig.scan : entry.scan;
  return source?.result?.grandTotals?.totalBalance ?? 0;
};

const ltrText = { writingDirection: 'ltr' } as const;
const directionalText = (rtl: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: rtl ? 'rtl' : 'ltr',
});

type SendAmountNavigation = NativeStackNavigationProp<SendStackParamList, 'SendAmount'>;
type SendAmountRoute = RouteProp<SendStackParamList, 'SendAmount'>;

export const SendAmountScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<SendAmountNavigation>();
  const route = useRoute<SendAmountRoute>();
  const { id } = route.params;

  const {
    wallets,
    saveAddress,
    currency,
    frozenUtxos,
    selectedUtxos,
    setSelectedUtxos,
    isRTL,
  } = useWallets();

  const entry = wallets.find(item => item.id === id);
  const closeIcon = isDark ? closeWhite : closeDark;

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const fullBalanceSats = walletBalanceSats(entry);
  const coinSelection = selectedUtxos[id];

  const coins = useMemo<Utxo[]>(() => walletUtxos(entry), [entry]);

  const selectedSats = useMemo<number | null>(() => {
    if (!coinSelection || coinSelection.size === 0) return null;
    return coins
      .filter(u => coinSelection.has(utxoKey(id, u)) && !frozenUtxos.has(utxoKey(id, u)))
      .reduce((total, u) => total + utxoValue(u), 0);
  }, [coinSelection, coins, frozenUtxos, id]);

  const frozenSats = useMemo<number>(() => {
    if (coinSelection && coinSelection.size > 0) return 0;
    return coins
      .filter(u => frozenUtxos.has(utxoKey(id, u)))
      .reduce((total, u) => total + utxoValue(u), 0);
  }, [coinSelection, coins, frozenUtxos, id]);

  const balanceSats = selectedSats ?? fullBalanceSats;
  const balanceBtc = formatBtcTrim(balanceSats);
  const canUseAll = balanceSats > 0;

  const spendableSats = selectedSats ?? Math.max(0, fullBalanceSats - frozenSats);
  const spendableBtc = formatBtcTrim(spendableSats);

  const [rate, setRate] = useState<number | null>(null);
  const [allowFeeBump, setAllowFeeBump] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>(() => [
    makeRecipient({ address: route.params?.address ?? '' }),
  ]);
  const [, setVisiblePage] = useState(0);

  const listRef = useRef<FlatList<Recipient>>(null);
  const focusedIndex = useRef(0);

  useEffect(() => {
    fetchBtcRate(currency.endPointKey)
      .then(value => {
        if (value && value > 0) setRate(value);
      })
      .catch(() => {});
  }, [currency.endPointKey]);

  const patchRecipient = useCallback((index: number, patch: Partial<Recipient>) => {
    setRecipients(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const openContacts = useCallback(
    (index: number) => {
      navigation.navigate('ContactPicker', {
        onPick: contact => patchRecipient(index, { address: contact.address, name: contact.name ?? '' }),
      });
    },
    [navigation, patchRecipient],
  );

  const recipientSats = useCallback(
    (recipient: Recipient): number => amountToSats(recipient.amount, recipient.unit, rate),
    [rate],
  );

  const onUseAll = useCallback(() => {
    patchRecipient(focusedIndex.current, { unit: 'BTC', amount: spendableBtc });
    Keyboard.dismiss();
  }, [patchRecipient, spendableBtc]);

  const onClearAddress = useCallback(
    () => patchRecipient(focusedIndex.current, { address: '', name: '' }),
    [patchRecipient],
  );

  const onPasteAddress = useCallback(async () => {
    const text = await Clipboard.getString();
    if (text) patchRecipient(focusedIndex.current, { address: text.trim(), name: '' });
  }, [patchRecipient]);

  const onRecipientsScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const index = layoutMeasurement.width
      ? Math.round(contentOffset.x / layoutMeasurement.width)
      : 0;
    focusedIndex.current = index;
    setVisiblePage(index);
  }, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<Recipient> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

  const focusRecipient = useCallback((index: number) => {
    focusedIndex.current = index;
    setVisiblePage(index);
    listRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  const handleAddRecipient = useCallback(() => {
    Keyboard.dismiss();
    const incompleteIndex = recipients.findIndex(
      recipient => !recipient.address.trim() || !recipient.amount.trim(),
    );
    if (incompleteIndex !== -1) {
      triggerHaptic();
      focusRecipient(incompleteIndex);
      Alert.alert(
        loc.outflow.payeeIncompleteHeading,
        loc.formatString(loc.outflow.payeeFinishBeforeAdding, {
          number: incompleteIndex + 1,
        }) as string,
      );
      return;
    }
    setRecipients(prev => {
      const next = [...prev, makeRecipient()];
      const end = next.length - 1;
      setTimeout(() => focusRecipient(end), 0);
      return next;
    });
  }, [recipients, focusRecipient]);

  const handleRemoveRecipient = useCallback(() => {
    setRecipients(prev => {
      if (prev.length <= 1) return prev;
      const at = focusedIndex.current;
      const next = prev.filter((_, index) => index !== at);
      const target = Math.min(at, next.length - 1);
      setTimeout(() => focusRecipient(target), 0);
      return next;
    });
  }, [focusRecipient]);

  const onNext = useCallback(() => {
    Keyboard.dismiss();
    if (spendableSats <= 0) {
      triggerHaptic();
      Alert.alert(loc.faults.problemLabel, loc.outflow.fundsShortReduceAmount);
      return;
    }
    for (let index = 0; index < recipients.length; index += 1) {
      const recipient = recipients[index];
      const sats = recipientSats(recipient);
      let error = '';
      if (!recipient.amount || Number.isNaN(sats) || sats <= 0) {
        error = loc.outflow.valueFieldMalformed;
      } else if (sats <= MIN_SPENDABLE_SATS) {
        error = loc.outflow.valueUnderFloorSats;
      } else if (!isValidBitcoinAddress(recipient.address)) {
        error = loc.outflow.destinationFieldMalformed;
      } else if (sats > fullBalanceSats) {
        error =
          frozenSats > 0
            ? loc.outflow.sumOverHoldingsLockedExcluded
            : loc.outflow.sumOverHoldings;
      } else if (sats > spendableSats) {
        error = loc.outflow.fundsShortReduceAmount;
      }
      if (error) {
        focusRecipient(index);
        triggerHaptic();
        const multiple = recipients.length > 1;
        Alert.alert(
          multiple
            ? (loc.formatString(loc.outflow.payeeIndexOfCount, {
                number: index + 1,
                total: recipients.length,
              }) as string)
            : error,
          multiple ? error : undefined,
        );
        return;
      }
    }
    recipients.forEach(recipient => {
      const trimmed = recipient.address.trim();
      if (trimmed) saveAddress(trimmed);
    });
    const first = recipients[0];
    navigation.navigate('SendConfirm', {
      id,
      address: first.address,
      amountSats: recipientSats(first),
    });
  }, [
    spendableSats,
    recipients,
    recipientSats,
    fullBalanceSats,
    frozenSats,
    focusRecipient,
    saveAddress,
    navigation,
    id,
  ]);

  useLayoutEffect(() => {
    const menuActions: MenuAction[] = [
      {
        id: 'add_recipient',
        title: loc.outflow.includePayee,
        image: 'person.badge.plus',
        imageColor: palette.fg,
      },
      ...(recipients.length > 1
        ? [
            {
              id: 'remove_recipient',
              title: loc.outflow.dropPayee,
              image: 'person.badge.minus',
              imageColor: palette.fg,
            } as MenuAction,
          ]
        : []),
      {
        id: 'send_max',
        title: loc.outflow.sweepEntireHoldings,
        image: 'dial.high',
        imageColor: palette.fg,
      },
      {
        id: 'allow_fee_bump',
        title: loc.outflow.permitRbf,
        image: 'arrowshape.up.circle',
        imageColor: palette.fg,
        state: allowFeeBump ? 'on' : 'off',
      },
      {
        id: 'coin_control',
        title: loc.coinSelect.screenTitle,
        image: 'switch.2',
        imageColor: palette.fg,
      },
    ];

    navigation.setOptions({
      title: loc.outflow.dispatchHeading,
      headerStyle: { backgroundColor: palette.bg },
      headerShadowVisible: false,
      headerTintColor: palette.fg,
      headerTitleStyle: {
        fontSize: TYPE.headerTitle.fontSize,
        fontWeight: TYPE.headerTitle.fontWeight,
        color: palette.fg,
      },
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={SIZE.closeHit}
          style={styles.closeButton}>
          <Image source={closeIcon} style={styles.closeImage} />
        </Pressable>
      ),
      headerRight: () => (
        <MenuView
          shouldOpenOnLongPress={false}
          onPressAction={({ nativeEvent }) => {
            switch (nativeEvent.event) {
              case 'add_recipient':
                handleAddRecipient();
                break;
              case 'remove_recipient':
                handleRemoveRecipient();
                break;
              case 'send_max':
                onUseAll();
                break;
              case 'allow_fee_bump':
                setAllowFeeBump(prev => !prev);
                break;
              case 'coin_control':
                navigation.navigate('CoinControl', { id });
                break;
              default:
                Alert.alert(loc.appGeneral.notYetAvailable, loc.outflow.mockupOnlyNotice);
            }
          }}
          actions={menuActions}>
          <View style={styles.headerMore}>
            <MaterialIcons name="more-horiz" size={22} color={palette.fg} />
          </View>
        </MenuView>
      ),
    });
  }, [
    navigation,
    palette,
    closeIcon,
    recipients.length,
    allowFeeBump,
    onUseAll,
    handleAddRecipient,
    handleRemoveRecipient,
    id,
  ]);

  const goToCoinControl = useCallback(
    () => navigation.navigate('CoinControl', { id }),
    [navigation, id],
  );

  const openScanner = useCallback(
    (index: number) => {
      navigation
        .getParent<NativeStackNavigationProp<RootStackParamList>>()
        ?.navigate('ScanQRCode', {
          onScan: (value: string) => {
            const parsed = parsePaymentUri(value);
            const patch: Partial<Recipient> = { address: parsed.address, name: parsed.label ?? '' };
            if (parsed.amountBtc) {
              patch.amount = parsed.amountBtc;
              patch.unit = 'BTC';
            }
            patchRecipient(index, patch);
          },
        });
    },
    [navigation, patchRecipient],
  );

  const renderRecipient = ({ item, index }: { item: Recipient; index: number }) => (
    <View style={[styles.card, { width }]} collapsable={false}>
      <View style={styles.cardTop}>
        <Pressable
          onPress={() => openContacts(index)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.contactButton,
            { backgroundColor: palette.lightButton },
            pressed && styles.pressed,
          ]}
          accessibilityLabel={loc.appGeneral.savedContacts}>
          <Text style={[styles.contactText, { color: palette.fg }]}>{loc.outflow.payeeEntry}</Text>
        </Pressable>

        <SendAmountField
          isDark={isDark}
          rate={rate}
          amount={item.amount}
          onChangeAmount={text => patchRecipient(index, { amount: text })}
          unit={item.unit}
          setUnit={update =>
            patchRecipient(index, {
              unit:
                typeof update === 'function'
                  ? (update as (prev: SendUnit) => SendUnit)(item.unit)
                  : update,
            })
          }
          accessoryID={AMOUNT_ACCESSORY_ID}
          currency={currency}
          changeCurrencyLabel={loc.core.switchMoneyUnit}
        />

        {frozenSats > 0 ? (
          <Pressable
            onPress={goToCoinControl}
            style={({ pressed }) => [styles.frozenNote, pressed && styles.pressed]}
            accessibilityRole="button">
            <Text style={[{ color: palette.fg }, ltrText]}>
              {`${formatBtcTrim(frozenSats)} ${loc.outflow.lockedCoinAlert}`}
            </Text>
          </Pressable>
        ) : null}

        <View
          style={[styles.addressBox, { backgroundColor: palette.inputBg, borderColor: palette.inputBorder }]}>
          <TextInput
            style={[
              styles.addressInput,
              { color: palette.fg, writingDirection: item.address ? 'ltr' : isRTL ? 'rtl' : 'ltr' },
            ]}
            value={item.address}
            onChangeText={text => patchRecipient(index, { address: text, name: '' })}
            placeholder={loc.outflow.destinationField}
            placeholderTextColor="#81868e"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onFocus={() => {
              focusedIndex.current = index;
            }}
            inputAccessoryViewID={Platform.OS === 'ios' ? ADDRESS_ACCESSORY_ID : undefined}
          />
        </View>

        <Pressable onPress={() => openScanner(index)} style={styles.scanLink}>
          <Text style={[TYPE.phraseIntro, { color: palette.fg }, directionalText(isRTL)]}>
            {loc.restore.cameraCaptureLink}
          </Text>
        </Pressable>

        {recipients.length > 1 ? (
          <Text style={[styles.positionText, { color: palette.muted }]}>
            {loc.formatString(loc.outflow.indexOfCount, {
              current: index + 1,
              total: recipients.length,
            })}
          </Text>
        ) : null}

        <PrimaryButton
          label={loc.outflow.proceed}
          color={palette.accentBlue}
          onPress={onNext}
          style={styles.inlineNext}
        />
      </View>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: palette.bg }]}>
      <FlatList
        ref={listRef}
        data={recipients}
        extraData={recipients}
        keyExtractor={recipient => recipient.key}
        renderItem={renderRecipient}
        horizontal
        pagingEnabled
        scrollEnabled={recipients.length > 1}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        removeClippedSubviews={false}
        onMomentumScrollBegin={() => Keyboard.dismiss()}
        onScroll={onRecipientsScroll}
        scrollEventThrottle={16}
        getItemLayout={getItemLayout}
        style={styles.flex}
      />

      {coinSelection && coinSelection.size > 0 ? (
        <View style={[styles.coinsWrap, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={goToCoinControl} style={styles.coinsPill} accessibilityRole="button">
            <View style={styles.coinsLabel}>
              <Text style={styles.coinsText}>
                {loc.formatString(loc.outflow.utxosChosenCount, { count: coinSelection.size })}
              </Text>
            </View>
            <Pressable
              onPress={() => setSelectedUtxos(id, new Set())}
              style={styles.coinsClose}
              accessibilityRole="button"
              accessibilityLabel={loc.outflow.deselectChosenUtxos}>
              <View style={styles.coinsBall}>
                <MaterialIcons name="close" size={22} color="#FFFFFF" />
              </View>
            </Pressable>
          </Pressable>
        </View>
      ) : null}

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={AMOUNT_ACCESSORY_ID}>
          <SendUseAllBar
            c={palette}
            balanceBtc={balanceBtc}
            unitL="BTC"
            canUseAll={canUseAll}
            onUseAll={onUseAll}
          />
        </InputAccessoryView>
      ) : null}

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={ADDRESS_ACCESSORY_ID}>
          <View style={[styles.keyboardBar, { backgroundColor: palette.inputBg }]}>
            <Pressable onPress={onClearAddress} style={styles.keyboardButton}>
              <Text style={[styles.keyboardButtonText, { color: palette.fg }]}>
                {loc.outflow.wipeEntry}
              </Text>
            </Pressable>
            <Pressable onPress={onPasteAddress} style={styles.keyboardButton}>
              <Text style={[styles.keyboardButtonText, { color: palette.fg }]}>
                {loc.outflow.dropFromClipboard}
              </Text>
            </Pressable>
            <Pressable onPress={() => Keyboard.dismiss()} style={styles.keyboardButton}>
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
  flex: { flex: 1 },
  closeButton: { paddingHorizontal: 4, paddingVertical: 4 },
  closeImage: { width: 20, height: 20, resizeMode: 'contain' },
  headerMore: { paddingHorizontal: 6, paddingVertical: 4 },
  card: { flex: 1 },
  cardTop: { flex: 1, justifyContent: 'flex-start', paddingHorizontal: 20, paddingTop: 8 },
  contactButton: {
    alignSelf: 'flex-end',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 4,
  },
  contactText: { fontSize: 14, fontWeight: '600' },
  frozenNote: { alignItems: 'center', marginBottom: 14 },
  addressBox: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginTop: 4 },
  addressInput: { height: 48, fontSize: 16 },
  scanLink: { alignItems: 'center', paddingVertical: 16 },
  positionText: { textAlign: 'center', fontSize: 13, marginTop: 2 },
  inlineNext: { marginTop: 12 },
  coinsWrap: { paddingHorizontal: 20, paddingTop: 8 },
  coinsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A84FF',
    borderRadius: 24,
    paddingLeft: 18,
    paddingRight: 6,
    height: 48,
  },
  coinsLabel: { flex: 1 },
  coinsText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  coinsClose: { padding: 4 },
  coinsBall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  pressed: { opacity: 0.6 },
  keyboardBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: 4,
  },
  keyboardButton: { paddingHorizontal: 10, paddingVertical: 16 },
  keyboardButtonText: { fontSize: 16, fontWeight: '600' },
});

export default SendAmountScreen;
