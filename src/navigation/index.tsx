import React from 'react';
import {
  ActivityIndicator,
  I18nManager,
  Image,
  Platform,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';

import { COLORS, RADIUS, SPACING, TYPE, type ColorScheme } from '../theme';
import loc from '../i18n';
import { useWallets } from '../wallets/context';
import {
  AddWalletScreen,
  PleaseBackupScreen,
  ImportWalletScreen,
  ImportDiscoveryScreen,
  MultisigIntroScreen,
  MultisigAdvancedScreen,
  MultisigStep2Screen,
  MultisigKeyScreen,
  MultisigImportScreen,
  BackupWarningScreen,
  SendAmountScreen,
  SendConfirmScreen,
  SendSuccessScreen,
  ContactPickerScreen,
  SelectFeeScreen,
  SendNoteScreen,
  CoinControlScreen,
  CoinControlOutputScreen,
  SplashScreen,
  WelcomeScreen,
  WalletsListScreen,
  ReceiveSheetScreen,
  ReceiveAmountScreen,
  AddressQRScreen,
  WalletDetailScreen,
  WalletInfoScreen,
  WalletDerivationScreen,
  WalletAddressesScreen,
  WalletExportScreen,
  WalletXpubScreen,
  SignVerifyScreen,
  TransactionDetailScreen,
  SettingsScreen,
  GeneralScreen,
  BitcoinUnitScreen,
  SecurityScreen,
  CurrencyScreen,
  LanguageScreen,
  NetworkScreen,
  BlockExplorerScreen,
  NetworkFeeScreen,
  ChangeAddressScreen,
  BroadcastScreen,
  ElectrumScreen,
  NotificationsScreen,
  AboutScreen,
  OpenSourceScreen,
  StealthHoldingScreen,
  PromptPasswordScreen,
  ScanQRCodeScreen,
} from '../screens';
import type {
  RootStackParamList,
  SendStackParamList,
  AddWalletStackParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const SendStack = createNativeStackNavigator<SendStackParamList>();
const AddWalletStackNav = createNativeStackNavigator<AddWalletStackParamList>();

const BRAND_MARK = require('../../img/logo.png');

const usePalette = (): ColorScheme => {
  const isDark = useColorScheme() === 'dark';
  return isDark ? COLORS.dark : COLORS.light;
};

const headerTitleStyle = (palette: ColorScheme) => ({
  fontSize: TYPE.headerTitle.fontSize,
  fontWeight: TYPE.headerTitle.fontWeight,
  color: palette.fg,
});

const sheetOptions = (background: string): NativeStackNavigationOptions => ({
  presentation: 'formSheet',
  headerShown: true,
  sheetGrabberVisible: true,
  sheetAllowedDetents: 'fitToContents',
  headerStyle: { backgroundColor: background },
  contentStyle: { backgroundColor: background },
});

const groupedSheetOptions: NativeStackNavigationOptions = {
  presentation: 'formSheet',
  headerShown: true,
  sheetGrabberVisible: true,
  sheetAllowedDetents: 'fitToContents',
  sheetCornerRadius: 20,
};

export const SendFlowNavigator = () => {
  const palette = usePalette();
  return (
    <SendStack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: palette.fg,
        headerTitleStyle: headerTitleStyle(palette),
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: palette.bg },
        contentStyle: { backgroundColor: palette.bg },
        fullScreenGestureEnabled: false,
        statusBarStyle: 'auto',
      }}>
      <SendStack.Screen
        name="SendAmount"
        component={SendAmountScreen}
        options={{ title: loc.outflow.dispatchHeading }}
      />
      <SendStack.Screen
        name="SendConfirm"
        component={SendConfirmScreen}
        options={{ title: loc.outflow.reviewHeading }}
      />
      <SendStack.Screen
        name="SendSuccess"
        component={SendSuccessScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <SendStack.Screen
        name="ContactPicker"
        component={ContactPickerScreen}
        options={sheetOptions(palette.elevated)}
      />
      <SendStack.Screen
        name="SelectFeeSheet"
        component={SelectFeeScreen}
        options={sheetOptions(palette.elevated)}
      />
      <SendStack.Screen
        name="SendNoteSheet"
        component={SendNoteScreen}
        options={{
          ...sheetOptions(palette.elevated),
          title: loc.ledger.memoLabel,
        }}
      />
      <SendStack.Screen
        name="CoinControl"
        component={CoinControlScreen}
        options={{
          headerShown: true,
          title: loc.coinSelect.screenTitle,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: palette.elevated },
          contentStyle: { backgroundColor: palette.elevated },
        }}
      />
      <SendStack.Screen
        name="CoinControlOutput"
        component={CoinControlOutputScreen}
        options={{
          ...sheetOptions(palette.elevated),
          title: loc.outflow.modifyUtxoHeading,
        }}
      />
    </SendStack.Navigator>
  );
};

export const AddWalletNavigator = () => {
  const palette = usePalette();
  return (
    <AddWalletStackNav.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: palette.fg,
        headerTitleStyle: headerTitleStyle(palette),
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: palette.customHeader },
        contentStyle: { backgroundColor: palette.bg },
        statusBarStyle: 'auto',
      }}>
      <AddWalletStackNav.Screen
        name="AddWallet"
        component={AddWalletScreen}
        options={{ title: loc.holdings.creationHeading }}
      />
      <AddWalletStackNav.Screen
        name="PleaseBackup"
        component={PleaseBackupScreen}
        options={{
          title: loc.seedBackup.mnemonicComplete,
          gestureEnabled: false,
          headerBackVisible: false,
        }}
      />
      <AddWalletStackNav.Screen
        name="ImportWallet"
        component={ImportWalletScreen}
        options={{ title: loc.holdings.restoreAction }}
      />
      <AddWalletStackNav.Screen
        name="ImportDiscovery"
        component={ImportDiscoveryScreen}
        options={{ title: loc.holdings.scanProgressHeading }}
      />
      <AddWalletStackNav.Screen
        name="MultisigIntro"
        component={MultisigIntroScreen}
        options={{ title: '' }}
      />
      <AddWalletStackNav.Screen
        name="MultisigAdvanced"
        component={MultisigAdvancedScreen}
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: 'fitToContents',
        }}
      />
      <AddWalletStackNav.Screen
        name="MultisigStep2"
        component={MultisigStep2Screen}
        options={{ title: '' }}
      />
      <AddWalletStackNav.Screen
        name="MultisigKeySheet"
        component={MultisigKeyScreen}
        options={{
          presentation: 'formSheet',
          headerShown: true,
          sheetGrabberVisible: true,
          sheetAllowedDetents: 'fitToContents',
        }}
      />
      <AddWalletStackNav.Screen
        name="MultisigImport"
        component={MultisigImportScreen}
        options={{
          presentation: 'formSheet',
          headerShown: true,
          sheetGrabberVisible: true,
          sheetAllowedDetents: 'fitToContents',
        }}
      />
      <AddWalletStackNav.Screen
        name="BackupWarning"
        component={BackupWarningScreen}
        options={{
          presentation: 'formSheet',
          headerShown: true,
          sheetGrabberVisible: true,
          sheetAllowedDetents: 'fitToContents',
        }}
      />
    </AddWalletStackNav.Navigator>
  );
};

const buildNavigationTheme = (palette: ColorScheme, base: Theme): Theme => ({
  ...base,
  colors: {
    ...base.colors,
    primary: palette.accentBlue,
    background: palette.bg,
    card: palette.customHeader,
    text: palette.fg,
    border: 'transparent',
  },
});

const SplashFallback = ({ palette }: { palette: ColorScheme }) => (
  <View style={[splashStyles.root, { backgroundColor: palette.bg }]}>
    <Image source={BRAND_MARK} style={splashStyles.mark} resizeMode="contain" />
    <View style={splashStyles.spinner}>
      <ActivityIndicator />
    </View>
  </View>
);

export const RootNavigator = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigationTheme = buildNavigationTheme(palette, isDark ? DarkTheme : DefaultTheme);
  const direction: 'rtl' | 'ltr' = I18nManager.isRTL ? 'rtl' : 'ltr';
  const { loaded, wallets, pwdEnabled } = useWallets();

  if (!loaded) {
    return (
      <View style={{ flex: 1 }}>
        <SplashFallback palette={palette} />
      </View>
    );
  }

  const hasHolding = wallets.length > 0 || pwdEnabled;
  const initialRouteName: keyof RootStackParamList = hasHolding ? 'WalletsList' : 'Welcome';

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer theme={navigationTheme} direction={direction}>
        <RootStack.Navigator
          initialRouteName={initialRouteName}
          screenOptions={{ headerShown: false, statusBarStyle: 'auto' }}>
          <RootStack.Screen name="Splash" component={SplashScreen} />
          <RootStack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{ animationTypeForReplace: 'push' }}
          />
          <RootStack.Screen
            name="WalletsList"
            component={WalletsListScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="AddWalletRoot"
            component={AddWalletNavigator}
            options={{ presentation: 'modal' }}
          />
          <RootStack.Screen
            name="ReceiveSheet"
            component={ReceiveSheetScreen}
            options={{ presentation: 'modal', headerShown: true }}
          />
          <RootStack.Screen
            name="ReceiveAmount"
            component={ReceiveAmountScreen}
            options={groupedSheetOptions}
          />
          <RootStack.Screen
            name="AddressQR"
            component={AddressQRScreen}
            options={groupedSheetOptions}
          />
          <RootStack.Screen
            name="SendRoot"
            component={SendFlowNavigator}
            options={{
              presentation: 'modal',
              fullScreenGestureEnabled: false,
              statusBarStyle: 'light',
            }}
          />
          <RootStack.Screen
            name="WalletDetail"
            component={WalletDetailScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="WalletInfo"
            component={WalletInfoScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="WalletDerivation"
            component={WalletDerivationScreen}
            options={groupedSheetOptions}
          />
          <RootStack.Screen
            name="WalletAddresses"
            component={WalletAddressesScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="WalletExport"
            component={WalletExportScreen}
            options={{ presentation: 'modal', headerShown: true }}
          />
          <RootStack.Screen
            name="WalletXpub"
            component={WalletXpubScreen}
            options={{ presentation: 'modal', headerShown: true }}
          />
          <RootStack.Screen
            name="SignVerify"
            component={SignVerifyScreen}
            options={{ presentation: 'modal', headerShown: true }}
          />
          <RootStack.Screen
            name="TransactionDetail"
            component={TransactionDetailScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ headerShown: true, headerLargeTitle: Platform.OS === 'ios' }}
          />
          <RootStack.Screen
            name="General"
            component={GeneralScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="BitcoinUnit"
            component={BitcoinUnitScreen}
            options={groupedSheetOptions}
          />
          <RootStack.Screen
            name="Security"
            component={SecurityScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="Currency"
            component={CurrencyScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="Language"
            component={LanguageScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="Network"
            component={NetworkScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="BlockExplorer"
            component={BlockExplorerScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="NetworkFee"
            component={NetworkFeeScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="ChangeAddress"
            component={ChangeAddressScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="Broadcast"
            component={BroadcastScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="Electrum"
            component={ElectrumScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="About"
            component={AboutScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="OpenSource"
            component={OpenSourceScreen}
            options={groupedSheetOptions}
          />
          <RootStack.Screen
            name="StealthHolding"
            component={StealthHoldingScreen}
            options={{ headerShown: true }}
          />
          <RootStack.Screen
            name="PromptPasswordSheet"
            component={PromptPasswordScreen}
            options={groupedSheetOptions}
          />
          <RootStack.Screen
            name="ScanQRCode"
            component={ScanQRCodeScreen}
            options={{
              presentation: 'fullScreenModal',
              headerShown: false,
              statusBarHidden: true,
              headerShadowVisible: false,
            }}
          />
        </RootStack.Navigator>
      </NavigationContainer>
    </View>
  );
};

const splashStyles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  mark: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.card,
  },
  spinner: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    marginTop: 78,
    alignItems: 'center',
  },
});

export default RootNavigator;
