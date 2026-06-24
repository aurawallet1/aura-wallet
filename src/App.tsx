import React from 'react';
import { useColorScheme } from 'react-native';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import { WalletsProvider, useWallets } from './wallets/context';
import RootNavigator from './navigation';
import { LockGate } from './components/LockGate';
import { LockScreenScreen } from './screens/LockScreen';

const ApplicationGate = (): React.ReactElement | null => {
  const { locked } = useWallets();
  const isDark = useColorScheme() === 'dark';

  return (
    <LockGate locked={locked} isDark={isDark}>
      <LockScreenScreen />
    </LockGate>
  );
};

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <WalletsProvider>
        <RootNavigator />
        <ApplicationGate />
      </WalletsProvider>
    </SafeAreaProvider>
  );
}

export default App;
