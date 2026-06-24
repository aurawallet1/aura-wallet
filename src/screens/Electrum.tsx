import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MenuView } from '@react-native-menu/menu';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import loc from '../i18n';
import { COLORS, SPACING, TYPE } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { useWallets } from '../wallets/context';
import { triggerHaptic, triggerSuccessHaptic, triggerErrorHaptic } from '../utils/haptics';
import { PrimaryButton } from '../components/PrimaryButton';

type ElectrumNavigation = NativeStackNavigationProp<RootStackParamList, 'Electrum'>;

interface ServerPreset {
  host: string;
  port: string;
}

interface PersistedState {
  offline: boolean;
  host: string;
  port: string;
  ssl: boolean;
  savedHost: string;
  savedPort: string;
}

const STORAGE_KEY = 'walletapp.electrumServer';

const DEFAULT_SERVER: ServerPreset = {
  host: 'electrum.blockstream.info',
  port: '50002',
};

const SUGGESTED_SERVERS: readonly ServerPreset[] = [
  { host: 'electrum.blockstream.info', port: '50002' },
  { host: 'fulcrum.sethforprivacy.com', port: '50002' },
  { host: 'bitcoin.aranguren.org', port: '50002' },
];

const CONNECT_DELAY_MS = 1400;

const DISCLOSURE_ANIM = {
  duration: 200,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
};

const HOST_PATTERN = /^[a-zA-Z0-9.-]+$/;
const PLACEHOLDER_COLOR = '#81868e';
const PILL_BG_DARK = '#8EFFE5';
const PILL_BG_LIGHT = '#d2f8d6';
const PILL_FG_DARK = '#000000';
const PILL_FG_LIGHT = '#37c0a1';

const directionalText = (isRTL: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: isRTL ? 'rtl' : 'ltr',
});

const ElectrumScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<ElectrumNavigation>();
  const { isRTL } = useWallets();

  const pageBg = isDark ? palette.bg : palette.cardGray;
  const cellBg = isDark ? palette.cardGray : palette.bg;
  const pillBg = isDark ? PILL_BG_DARK : PILL_BG_LIGHT;
  const pillFg = isDark ? PILL_FG_DARK : PILL_FG_LIGHT;

  const [offline, setOffline] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [useSsl, setUseSsl] = useState(true);
  const [saved, setSaved] = useState<ServerPreset>({ host: '', port: '' });
  const [hydrated, setHydrated] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginConnect = useCallback((onSettled?: () => void) => {
    setConnecting(true);
    if (connectTimer.current) {
      clearTimeout(connectTimer.current);
    }
    connectTimer.current = setTimeout(() => {
      setConnecting(false);
      onSettled?.();
    }, CONNECT_DELAY_MS);
  }, []);

  useEffect(
    () => () => {
      if (connectTimer.current) {
        clearTimeout(connectTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        let isOffline = false;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<PersistedState>;
            isOffline = !!parsed.offline;
            setOffline(isOffline);
            setHost(parsed.host ?? '');
            setPort(parsed.port ?? '');
            setUseSsl(parsed.ssl ?? true);
            setSaved({ host: parsed.savedHost ?? '', port: parsed.savedPort ?? '' });
          } catch {
            isOffline = false;
          }
        }
        setHydrated(true);
        if (!isOffline) {
          beginConnect();
        }
      })
      .catch(() => setHydrated(true));
  }, [beginConnect]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const snapshot: PersistedState = {
      offline,
      host,
      port,
      ssl: useSsl,
      savedHost: saved.host,
      savedPort: saved.port,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {});
  }, [hydrated, offline, host, port, useSsl, saved]);

  const restoreDefaults = useCallback(() => {
    setHost('');
    setPort('');
    setUseSsl(true);
    setSaved({ host: '', port: '' });
    triggerHaptic();
    beginConnect();
  }, [beginConnect]);

  const applyPreset = useCallback(
    (preset: ServerPreset) => {
      setHost(preset.host);
      setPort(preset.port);
      setUseSsl(true);
      setSaved({ host: preset.host, port: preset.port });
      beginConnect();
    },
    [beginConnect],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.prefs.nodeEndpoint,
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
      headerRight: offline
        ? undefined
        : () => (
            <MenuView
              shouldOpenOnLongPress={false}
              onPressAction={({ nativeEvent }) => {
                const action = nativeEvent.event;
                if (action === 'reset') {
                  restoreDefaults();
                } else if (action.startsWith('pick:')) {
                  const preset = SUGGESTED_SERVERS[Number(action.slice(5))];
                  if (preset) {
                    applyPreset(preset);
                  }
                }
              }}
              actions={[
                {
                  id: 'suggested',
                  title: loc.nodeConn.recommendedPeers,
                  image: 'server.rack',
                  imageColor: palette.fg,
                  subactions: SUGGESTED_SERVERS.map((preset, index) => ({
                    id: 'pick:' + index,
                    title: preset.host,
                    subtitle: loc.nodeConn.securePortPrefix + preset.port,
                  })),
                },
                {
                  id: 'reset',
                  title: loc.prefs.revertToFactory,
                  image: 'arrow.counterclockwise',
                  imageColor: palette.fg,
                },
              ]}
            >
              <View style={styles.headerMore}>
                <MaterialIcons name="more-horiz" size={22} color={palette.fg} />
              </View>
            </MenuView>
          ),
    });
  }, [navigation, palette.fg, pageBg, offline, restoreDefaults, applyPreset]);

  const saveDisabled =
    !host || !port || (host === saved.host && port === saved.port);

  const onSave = (): void => {
    Keyboard.dismiss();
    const trimmedHost = host.trim();
    const portNumber = Number(port);
    if (!trimmedHost) {
      triggerErrorHaptic();
      Alert.alert(loc.nodeConn.hostBlankTitle, loc.nodeConn.hostBlankDetail);
      return;
    }
    if (!HOST_PATTERN.test(trimmedHost) || !trimmedHost.includes('.')) {
      triggerErrorHaptic();
      Alert.alert(loc.nodeConn.hostMalformedTitle, loc.nodeConn.hostMalformedDetail);
      return;
    }
    if (
      !port ||
      !Number.isInteger(portNumber) ||
      portNumber < 1 ||
      portNumber > 65535
    ) {
      triggerErrorHaptic();
      Alert.alert(
        loc.nodeConn.portMalformedTitle,
        loc.nodeConn.portMalformedDetail,
      );
      return;
    }
    setHost(trimmedHost);
    beginConnect(() => {
      setSaved({ host: trimmedHost, port });
      triggerSuccessHaptic();
    });
  };

  const onToggleOffline = (value: boolean): void => {
    setOffline(value);
    if (value) {
      setConnecting(false);
      if (connectTimer.current) {
        clearTimeout(connectTimer.current);
      }
    } else {
      beginConnect();
    }
  };

  const scanHost = (): void => {
    navigation.navigate('ScanQRCode', {
      onScan: (value: string) => setHost(value.trim()),
    });
  };

  const toggleAdvanced = (): void => {
    LayoutAnimation.configureNext(DISCLOSURE_ANIM);
    setAdvancedOpen(open => !open);
  };

  const switchMirror = { transform: [{ scaleX: isRTL ? -1 : 1 }] };
  const hostDirection: 'ltr' | 'rtl' = host ? 'ltr' : isRTL ? 'rtl' : 'ltr';
  const portDirection: 'ltr' | 'rtl' = port ? 'ltr' : isRTL ? 'rtl' : 'ltr';
  const activeServer = saved.host
    ? `${saved.host}:${saved.port}`
    : `${DEFAULT_SERVER.host}:${DEFAULT_SERVER.port}`;
  const saveLabel = connecting ? loc.nodeConn.linkingProgress : loc.diceEntropy.persistEntry;

  return (
    <ScrollView
      style={{ backgroundColor: pageBg }}
      contentContainerStyle={styles.scrollBody}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="always"
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.section, styles.sectionTop]}>
        <View style={[styles.row, styles.rowFirst, styles.rowLast, { backgroundColor: cellBg }]}>
          <View style={styles.body}>
            <Text style={[styles.rowTitle, { color: palette.fg }, directionalText(isRTL)]}>
              {loc.prefs.disconnectedToggle}
            </Text>
            <Text style={[styles.rowSubtitle, { color: palette.altText }, directionalText(isRTL)]}>
              {loc.nodeConn.disconnectedBlurb}
            </Text>
          </View>
          <Switch value={offline} onValueChange={onToggleOffline} style={switchMirror} />
        </View>
      </View>

      {!offline ? (
        <>
          <Text style={[styles.sectionHeader, { color: palette.altText }]}>
            {loc.nodeConn.linkSectionTitle}
          </Text>
          <View style={styles.statusCard}>
            <View style={[styles.statusContent, { backgroundColor: cellBg }]}>
              <View style={styles.pillWrap}>
                {connecting ? (
                  <View style={[styles.pill, styles.pillConnecting, { backgroundColor: palette.lightButton }]}>
                    <ActivityIndicator size="small" color={palette.fg} style={styles.spinner} />
                    <Text style={[styles.pillText, { color: palette.fg }]}>
                      {loc.nodeConn.linkingProgress}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.pill, { backgroundColor: pillBg }]}>
                    <Text style={[styles.pillText, { color: pillFg }]}>
                      {loc.prefs.linkActive}
                    </Text>
                  </View>
                )}
              </View>
              <Text selectable style={[styles.hostname, { color: palette.fg }]}>
                {activeServer}
              </Text>
              {connecting ? null : (
                <Text style={[styles.banner, { color: palette.fg }]}>
                  {loc.nodeConn.tipReachedNotice}
                </Text>
              )}
            </View>
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
                <View style={[styles.advancedBody, { borderTopColor: palette.fieldBorder }]}>
                  <Text style={[styles.advancedDesc, { color: palette.altText }]}>
                    {loc.nodeConn.customPeerBlurb}
                  </Text>
                  <View
                    style={[
                      styles.inputWrap,
                      styles.inputGroup,
                      { borderColor: palette.inputBorder, backgroundColor: palette.inputBg },
                    ]}
                  >
                    <TextInput
                      value={host}
                      onChangeText={text => setHost(text.trim())}
                      placeholder={loc.nodeConn.hostFieldHint}
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      style={[styles.inputText, { color: palette.fg, writingDirection: hostDirection }]}
                      autoCapitalize="none"
                      autoCorrect={false}
                      underlineColorAndroid="transparent"
                      editable={!offline && !connecting}
                    />
                    <Pressable
                      onPress={scanHost}
                      hitSlop={8}
                      disabled={connecting}
                      style={styles.scanIcon}
                    >
                      <MaterialIcons name="qr-code-scanner" size={22} color={palette.fg} />
                    </Pressable>
                  </View>
                  <View style={styles.portRow}>
                    <View
                      style={[
                        styles.inputWrap,
                        styles.flex,
                        { borderColor: palette.inputBorder, backgroundColor: palette.inputBg },
                      ]}
                    >
                      <TextInput
                        value={port}
                        onChangeText={text => setPort(text.replace(/[^0-9]/g, ''))}
                        placeholder={loc.nodeConn.portFieldHint}
                        placeholderTextColor={PLACEHOLDER_COLOR}
                        style={[styles.inputText, { color: palette.fg, writingDirection: portDirection }]}
                        keyboardType="number-pad"
                        underlineColorAndroid="transparent"
                        editable={!connecting}
                      />
                    </View>
                    <Text style={[styles.portLabel, { color: palette.fg }]}>
                      {loc.nodeConn.secureTag}
                    </Text>
                    <Switch
                      value={useSsl}
                      onValueChange={setUseSsl}
                      disabled={connecting}
                      style={switchMirror}
                    />
                  </View>
                  <View style={styles.buttonWrap}>
                    <PrimaryButton
                      label={saveLabel}
                      color={saveDisabled || connecting ? palette.cardGray : palette.accentBlue}
                      onPress={onSave}
                      disabled={saveDisabled || connecting}
                      style={styles.buttonFull}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollBody: {
    paddingBottom: SPACING.xxl,
  },
  flex: {
    flex: 1,
  },
  section: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    marginHorizontal: SPACING.lg,
  },
  sectionTop: {
    marginTop: SPACING.lg,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.4,
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.sm,
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
  statusCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statusContent: {
    borderRadius: 15,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  pillWrap: {
    marginBottom: SPACING.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  pillConnecting: {
    paddingLeft: 10,
  },
  spinner: {
    marginRight: SPACING.sm,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
  },
  hostname: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: SPACING.xs,
  },
  banner: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: SPACING.sm,
    textAlign: 'center',
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
    minHeight: 44,
  },
  advancedHeaderText: {
    fontSize: 17,
    fontWeight: '600',
  },
  advancedBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  advancedDesc: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: SPACING.md,
    minHeight: 44,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    paddingVertical: SPACING.sm,
  },
  scanIcon: {
    paddingLeft: SPACING.sm,
  },
  portRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  portLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: SPACING.md,
  },
  buttonWrap: {
    marginTop: SPACING.xl,
  },
  buttonFull: {
    alignSelf: 'stretch',
  },
  headerMore: {
    paddingHorizontal: SPACING.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});

export default ElectrumScreen;
