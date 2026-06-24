import type { NavigatorScreenParams } from '@react-navigation/native';

import type { HistoryTx } from '../types/index';

export interface AddressBookEntry {
  address: string;
  name: string;
}

export type SendStackParamList = {
  SendAmount: { id: string; address?: string };
  SendConfirm: { id: string; address: string; amountSats: number };
  SendSuccess: { amountSats: number; feeSats: number };
  SendNoteSheet: { note: string; onSave: (text: string) => void };
  ContactPicker: { onPick: (entry: AddressBookEntry) => void };
  SelectFeeSheet: { current: number; onPick: (rate: number) => void; vsize: number };
  CoinControl: { id: string };
  CoinControlOutput: { id: string; utxoKey: string };
};

export type AddWalletStackParamList = {
  AddWallet: undefined;
  PleaseBackup: { name?: string } | undefined;
  ImportWallet: { name?: string } | undefined;
  ImportDiscovery: {
    mnemonic?: string;
    wif?: string;
    askPassphrase?: boolean;
    origin: 'import' | 'create';
    name?: string;
  };
  MultisigIntro: { walletLabel: string; m?: number; n?: number };
  MultisigAdvanced: { m: number; n: number };
  MultisigStep2: { m: number; n: number; walletLabel: string };
  MultisigKeySheet: { index: number; mnemonic: string };
  MultisigImport: { onImport: (mnemonic: string) => void };
  BackupWarning: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  OpenSource: undefined;
  WalletsList: undefined;
  Settings: undefined;
  Security: undefined;
  Currency: undefined;
  Language: undefined;
  General: undefined;
  BitcoinUnit: undefined;
  Network: undefined;
  BlockExplorer: undefined;
  NetworkFee: undefined;
  ChangeAddress: undefined;
  Broadcast: undefined;
  Electrum: undefined;
  Notifications: undefined;
  About: undefined;
  AddWalletRoot: undefined;
  ReceiveSheet: {
    address: string;
    label?: string;
    customUri?: string;
    customAmount?: string;
    customLabel?: string;
  };
  AddressQR: { address: string; label?: string };
  TransactionDetail: { tx: HistoryTx; ownAddresses?: string[] };
  ReceiveAmount: { address: string };
  WalletDetail: { id: string };
  WalletInfo: { id: string };
  WalletExport: { id: string };
  WalletXpub: { id: string };
  SignVerify: { address: string; wif: string };
  WalletDerivation: { id: string };
  WalletAddresses: { id: string };
  ScanQRCode: { onScan: (value: string) => void };
  SendRoot: NavigatorScreenParams<SendStackParamList>;
  StealthHolding: undefined;
  PromptPasswordSheet: {
    mode: 'create' | 'enter' | 'create_fake';
    onResult: (password: string) => void;
  };
};
