import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  LayoutAnimation,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import loc from '../i18n';
import { COLORS, SPACING, TYPE } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { useWallets } from '../wallets/context';
import { triggerHaptic, triggerSuccessHaptic } from '../utils/haptics';
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
  getNotificationsToken,
  setNotificationsToken,
  loadBool,
  persistBool,
  loadString,
  persistString,
} from '../utils/storage';
import type { AlertEvents, SubscriptionPayload } from '../network/alerts';
import {
  registerSubscription,
  sendTestPing,
  purgeSubscription,
  isAcceptableRelay,
} from '../network/alerts';
import { acquireDeviceToken, currentPlatform, PushUnavailableError } from '../notifications/push';
import { buildSubscriptionWallets } from '../notifications/subscriptions';

type NotificationsNavigation = NativeStackNavigationProp<RootStackParamList, 'Notifications'>;

const INCOMING_KEY = 'walletapp.notifications.incoming';
const CONFIRMATIONS_KEY = 'walletapp.notifications.confirmations';
const RELAY_KEY = 'walletapp.notifications.relay';
const DEFAULT_RELAY = 'https://alerts.aura.app';
const TEST_REVERT_MS = 1500;

const REVEAL_ANIMATION = {
  duration: 220,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
};

const directionalText = (rtl: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: rtl ? 'rtl' : 'ltr',
});

const privacyLines = (): string[] => [
  loc.alerts.relayTokenDisclosure,
  loc.alerts.forwardOnlyScope,
  loc.alerts.serverPurgeNote,
];

const NotificationsScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<NotificationsNavigation>();
  const { isRTL, wallets } = useWallets();

  const pageBg = isDark ? palette.bg : palette.cardGray;
  const cellBg = isDark ? palette.cardGray : palette.bg;

  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);
  const [incoming, setIncoming] = useState(false);
  const [confirmations, setConfirmations] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [working, setWorking] = useState(false);
  const [relay, setRelay] = useState(DEFAULT_RELAY);

  const committedRelay = useRef(DEFAULT_RELAY);
  const relayInputRef = useRef<TextInput>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    getNotificationsEnabled()
      .then(value => {
        if (active) {
          setEnabled(value);
        }
      })
      .catch(() => {
        if (active) {
          setEnabled(false);
        }
      });
    loadBool(INCOMING_KEY, false).then(value => {
      if (active) {
        setIncoming(value);
      }
    });
    loadBool(CONFIRMATIONS_KEY, false).then(value => {
      if (active) {
        setConfirmations(value);
      }
    });
    loadString(RELAY_KEY).then(stored => {
      const resolved = stored && stored.trim() ? stored.trim() : DEFAULT_RELAY;
      if (active) {
        setRelay(resolved);
        committedRelay.current = resolved;
      }
    });
    getNotificationsToken().then(stored => {
      if (active) {
        tokenRef.current = stored;
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.prefs.alerts,
      headerLargeTitle: false,
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
      headerBackVisible: true,
      headerTransparent: false,
      headerStyle: { backgroundColor: pageBg },
      headerTintColor: palette.fg,
      headerTitleStyle: {
        fontSize: TYPE.headerTitle.fontSize,
        fontWeight: TYPE.headerTitle.fontWeight,
        color: palette.fg,
      },
    });
  }, [navigation, palette.fg, pageBg]);

  const switchMirror = { transform: [{ scaleX: isRTL ? -1 : 1 }] };
  const iconMirror = { transform: [{ scaleX: isRTL ? -1 : 1 }] };

  const describeError = useCallback(
    (error: unknown): string =>
      error instanceof PushUnavailableError ? loc.alerts.pushUnavailable : loc.alerts.relayUnreachable,
    [],
  );

  const buildPayload = useCallback(
    (token: string, events: AlertEvents): SubscriptionPayload => ({
      deviceToken: token,
      platform: currentPlatform(),
      events,
      wallets: buildSubscriptionWallets(wallets),
    }),
    [wallets],
  );

  const reRegister = useCallback(
    (events: AlertEvents) => {
      const token = tokenRef.current;
      if (!token) {
        return;
      }
      registerSubscription(committedRelay.current, buildPayload(token, events)).catch(() => {});
    },
    [buildPayload],
  );

  const onToggleMaster = useCallback(
    (value: boolean) => {
      LayoutAnimation.configureNext(REVEAL_ANIMATION);
      triggerSuccessHaptic();
      if (!value) {
        setEnabled(false);
        setNotificationsEnabled(false).catch(() => {});
        const token = tokenRef.current;
        if (token) {
          purgeSubscription(committedRelay.current, token).catch(() => {});
        }
        return;
      }
      setEnabled(true);
      setWorking(true);
      (async () => {
        try {
          const token = tokenRef.current ?? (await acquireDeviceToken());
          tokenRef.current = token;
          await setNotificationsToken(token);
          await registerSubscription(
            committedRelay.current,
            buildPayload(token, { incoming, confirmations }),
          );
          await setNotificationsEnabled(true);
        } catch (error) {
          setEnabled(false);
          setNotificationsEnabled(false).catch(() => {});
          Alert.alert(loc.alerts.relayErrorTitle, describeError(error));
        } finally {
          setWorking(false);
        }
      })();
    },
    [incoming, confirmations, buildPayload, describeError],
  );

  const onToggleIncoming = useCallback(
    (value: boolean) => {
      setIncoming(value);
      persistBool(INCOMING_KEY, value).catch(() => {});
      triggerHaptic();
      reRegister({ incoming: value, confirmations });
    },
    [confirmations, reRegister],
  );

  const onToggleConfirmations = useCallback(
    (value: boolean) => {
      setConfirmations(value);
      persistBool(CONFIRMATIONS_KEY, value).catch(() => {});
      triggerHaptic();
      reRegister({ incoming, confirmations: value });
    },
    [incoming, reRegister],
  );

  const openSystemSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  const toggleAdvanced = useCallback(() => {
    LayoutAnimation.configureNext(REVEAL_ANIMATION);
    setAdvancedOpen(open => !open);
  }, []);

  const runTest = useCallback(() => {
    const token = tokenRef.current;
    if (!token) {
      Alert.alert(loc.alerts.relayErrorTitle, loc.alerts.pushUnavailable);
      return;
    }
    triggerSuccessHaptic();
    sendTestPing(committedRelay.current, token, currentPlatform())
      .then(() => {
        setTestSent(true);
        setTimeout(() => setTestSent(false), TEST_REVERT_MS);
      })
      .catch(() => {
        Alert.alert(loc.alerts.relayErrorTitle, loc.alerts.relayUnreachable);
      });
  }, []);

  const commitRelay = useCallback(() => {
    const candidate = relay.trim();
    if (!isAcceptableRelay(candidate)) {
      setRelay(committedRelay.current);
      return;
    }
    const previous = committedRelay.current;
    setRelay(candidate);
    committedRelay.current = candidate;
    persistString(RELAY_KEY, candidate).catch(() => {});
    triggerSuccessHaptic();
    if (enabled) {
      const token = tokenRef.current;
      if (token && previous && previous !== candidate) {
        purgeSubscription(previous, token).catch(() => {});
      }
      reRegister({ incoming, confirmations });
    }
  }, [relay, enabled, incoming, confirmations, reRegister]);

  const resetRelay = useCallback(() => {
    const previous = committedRelay.current;
    setRelay(DEFAULT_RELAY);
    committedRelay.current = DEFAULT_RELAY;
    persistString(RELAY_KEY, DEFAULT_RELAY).catch(() => {});
    triggerSuccessHaptic();
    if (enabled) {
      const token = tokenRef.current;
      if (token && previous && previous !== DEFAULT_RELAY) {
        purgeSubscription(previous, token).catch(() => {});
      }
      reRegister({ incoming, confirmations });
    }
  }, [enabled, incoming, confirmations, reRegister]);

  return (
    <ScrollView
      style={{ backgroundColor: pageBg }}
      contentContainerStyle={styles.scrollBody}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionLead}>
        <View style={[styles.row, styles.rowFirst, styles.rowLast, { backgroundColor: cellBg }]}>
          <View style={styles.body}>
            <Text style={[styles.rowTitle, { color: palette.fg }, directionalText(isRTL)]}>
              {loc.prefs.alerts}
            </Text>
            <Text style={[styles.rowSubtitle, { color: palette.altText }, directionalText(isRTL)]}>
              {loc.alerts.tagline}
            </Text>
          </View>
          {enabled === undefined || working ? (
            <ActivityIndicator style={styles.control} />
          ) : (
            <Switch
              value={enabled}
              onValueChange={onToggleMaster}
              style={[styles.control, switchMirror]}
            />
          )}
        </View>
      </View>

      {enabled ? (
        <View style={styles.section}>
          <View
            style={[
              styles.row,
              styles.rowFirst,
              {
                backgroundColor: cellBg,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: palette.fieldBorder,
              },
            ]}
          >
            <View style={styles.body}>
              <Text style={[styles.rowTitle, { color: palette.fg }, directionalText(isRTL)]}>
                {loc.alerts.fundsArrivedHeading}
              </Text>
              <Text style={[styles.rowSubtitle, { color: palette.altText }, directionalText(isRTL)]}>
                {loc.alerts.fundsArrivedHint}
              </Text>
            </View>
            <Switch
              value={incoming}
              onValueChange={onToggleIncoming}
              style={[styles.control, switchMirror]}
            />
          </View>
          <View style={[styles.row, styles.rowLast, { backgroundColor: cellBg }]}>
            <View style={styles.body}>
              <Text style={[styles.rowTitle, { color: palette.fg }, directionalText(isRTL)]}>
                {loc.alerts.settlementHeading}
              </Text>
              <Text style={[styles.rowSubtitle, { color: palette.altText }, directionalText(isRTL)]}>
                {loc.alerts.settlementHint}
              </Text>
            </View>
            <Switch
              value={confirmations}
              onValueChange={onToggleConfirmations}
              style={[styles.control, switchMirror]}
            />
          </View>
        </View>
      ) : null}

      <View style={[styles.captionCard, { backgroundColor: cellBg }]}>
        <Text style={[styles.captionText, { color: palette.altText }]}>
          {loc.alerts.overviewBlurb}
        </Text>
      </View>

      <View style={styles.section}>
        <View style={[styles.advancedCard, { backgroundColor: cellBg }]}>
          <Pressable
            onPress={toggleAdvanced}
            style={({ pressed }) => [styles.advancedHeader, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={[styles.advancedHeaderText, { color: palette.fg }]}>
              {loc.ledger.expertMode}
            </Text>
            <MaterialIcons
              name={advancedOpen ? 'expand-less' : 'expand-more'}
              size={22}
              color={palette.txdMuted}
            />
          </Pressable>

          {advancedOpen ? (
            <>
              <View style={[styles.relayField, { borderTopColor: palette.fieldBorder }]}>
                <View style={styles.relayFieldHead}>
                  <Text style={[styles.fieldLabel, { color: palette.fg }]}>
                    {loc.alerts.relayEndpointLabel}
                  </Text>
                  {relay.trim() !== DEFAULT_RELAY ? (
                    <Pressable onPress={resetRelay} hitSlop={8} accessibilityRole="button">
                      <Text style={[styles.resetText, { color: palette.accentBlue }]}>
                        {loc.inflow.startOver}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.relayInputBox,
                    { backgroundColor: palette.inputBg, borderColor: palette.inputBorder },
                  ]}
                >
                  <TextInput
                    ref={relayInputRef}
                    value={relay}
                    onChangeText={setRelay}
                    onEndEditing={commitRelay}
                    onSubmitEditing={() => Keyboard.dismiss()}
                    placeholder={DEFAULT_RELAY}
                    placeholderTextColor={palette.labelText}
                    style={[styles.relayInput, { color: palette.fg }]}
                    textContentType="URL"
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                    returnKeyType="done"
                    underlineColorAndroid="transparent"
                  />
                </View>
              </View>

              <Pressable
                onPress={enabled ? runTest : undefined}
                disabled={!enabled}
                style={({ pressed }) => [
                  styles.advancedRow,
                  { borderTopColor: palette.fieldBorder },
                  !enabled && styles.advancedRowDisabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <View style={styles.body}>
                  <Text style={[styles.fieldLabel, { color: palette.fg }]}>
                    {loc.alerts.sendSamplePing}
                  </Text>
                  <Text style={[styles.advancedRowSub, { color: palette.altText }]}>
                    {enabled
                      ? loc.alerts.sampleReachableHint
                      : loc.alerts.sampleBlockedHint}
                  </Text>
                </View>
                {testSent ? (
                  <Text style={[styles.advancedRowValue, { color: palette.accentGreen }]}>
                    {loc.ledger.outgoingHeading}
                  </Text>
                ) : (
                  <MaterialIcons
                    name="send"
                    size={20}
                    color={enabled ? palette.accentBlue : palette.txdMuted}
                    style={iconMirror}
                  />
                )}
              </Pressable>

              <View style={[styles.privacyBlock, { borderTopColor: palette.fieldBorder }]}>
                {privacyLines().map((line, index) => (
                  <Text
                    key={`privacy-${index}`}
                    style={[
                      styles.privacyLine,
                      { color: palette.txdMuted },
                      index === privacyLines().length - 1 && styles.privacyLineLast,
                    ]}
                  >
                    {line}
                  </Text>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Pressable
          onPress={openSystemSettings}
          style={({ pressed }) => [
            styles.row,
            styles.rowFirst,
            styles.rowLast,
            { backgroundColor: cellBg },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.body}>
            <Text style={[styles.rowTitle, { color: palette.fg }, directionalText(isRTL)]}>
              {loc.prefs.deviceControls}
            </Text>
            <Text style={[styles.rowSubtitle, { color: palette.altText }, directionalText(isRTL)]}>
              {loc.alerts.devicePermissionsHint}
            </Text>
          </View>
          <MaterialIcons
            name="chevron-right"
            size={24}
            color={palette.altText}
            style={[styles.chevron, iconMirror]}
          />
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollBody: {
    paddingBottom: SPACING.xxl,
  },
  sectionLead: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.lg,
  },
  section: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    marginHorizontal: SPACING.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    minHeight: 44,
    overflow: 'hidden',
  },
  rowFirst: {
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  rowLast: {
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  body: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    paddingVertical: 2,
  },
  control: {
    marginLeft: SPACING.md,
  },
  chevron: {
    opacity: 0.7,
  },
  captionCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 15,
  },
  captionText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  advancedCard: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    minHeight: 48,
  },
  advancedHeaderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  relayField: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  relayFieldHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  resetText: {
    fontSize: 14,
    fontWeight: '500',
  },
  relayInputBox: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  relayInput: {
    fontSize: 15,
    paddingVertical: SPACING.sm,
  },
  advancedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  advancedRowDisabled: {
    opacity: 0.5,
  },
  advancedRowSub: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    paddingVertical: 2,
  },
  advancedRowValue: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: SPACING.md,
  },
  privacyBlock: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  privacyLine: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    marginBottom: SPACING.sm,
  },
  privacyLineLast: {
    marginBottom: 0,
  },
  pressed: {
    opacity: 0.6,
  },
});

export default NotificationsScreen;

export { NotificationsScreen };
