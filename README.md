<div align="center">

# Aura Wallet

**A self-custody Bitcoin wallet for iOS & Android.**
You hold your own keys — they are generated on the device and never leave it.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-blue.svg)](#)
[![React Native](https://img.shields.io/badge/React%20Native-0.85-61dafb.svg)](https://reactnative.dev)
[![Languages](https://img.shields.io/badge/i18n-40%20languages-orange.svg)](src/i18n)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

</div>

---

## Why Aura

- 🔐 **True self-custody.** Your seed, passphrases and private keys are generated and stored **on the device only** — encrypted in the system keychain. They are never transmitted to any server.
- 🌐 **The network sees only public data.** Balances and history are read from Electrum servers (with a mempool.space fallback) using scripthashes and public addresses. Only the final **signed** transaction hex is broadcast.
- ✍️ **Local signing.** Transactions are built and signed entirely on-device (BIP143). Keys never touch the wire.
- 🧪 **Open source & verifiable.** Released under the MIT license. The cryptographic core is covered by tests that run against the app's *own* code using official BIP test vectors — see [Testing](#testing).

> **Status:** early and actively developed (`v0.0.1`). Review the code, try it, and open issues — feedback is welcome.

---

## About us

Aura Wallet is built by a **small, independent team** with one belief at its core:
**you should be the only person who can touch your money.**

We started Aura because most "Bitcoin wallets" ask you to trust a server, a company,
or a black box you can't inspect. We wanted the opposite — a wallet where the keys
are generated on your phone, never leave it, and where *anyone* can read exactly how
that works.

That is why the whole project is **fully open source** under the MIT license. Every
line that derives your keys or signs your transactions is public, auditable, and
continuously checked against official Bitcoin (BIP) test vectors — no hidden servers,
no custody, no tracking on the crypto path.

We are early and building in the open. If you share these values, read the code, try
the app, open an issue, or send a pull request — you're welcome here.

---

## Features

- **HD wallets** — BIP32 / BIP39 / BIP44 / BIP49 / BIP84 (Legacy, Nested SegWit, Native SegWit).
- **Multisig** — create and import `m-of-n` multisig wallets with an advanced setup flow.
- **Send & receive** — coin control, change-address selection, custom network fees, and QR scan / generation.
- **Import & export** — restore from mnemonic, discover used addresses, and export public keys (xpub) for watch-only use.
- **Sign & verify** messages with your keys.
- **Security** — biometric / passcode lock screen, keychain-backed storage, and a stealth holding mode.
- **40 languages** — fully internationalized UI ([`src/i18n`](src/i18n)).

---

## How it works

| Layer | What happens | What leaves the device |
| --- | --- | --- |
| **Keys** | HD wallets derived locally with `@noble` / `@scure`. Mnemonics, passphrases & private keys stay on-device, encrypted in the keychain. | Nothing. |
| **Reading state** | Balances & history fetched from Electrum servers (mempool.space fallback). | Scripthashes & public addresses only. |
| **Spending** | Transactions assembled and signed on-device (BIP143 / P2WPKH). | The signed transaction hex only. |

No `Buffer` or Node polyfills are used on the crypto path.

---

## Tech stack

**React Native 0.85** · **React 19** · **TypeScript**

- **Cryptography:** [`@noble/curves`](https://github.com/paulmillr/noble-curves) · [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) · [`@scure/bip39`](https://github.com/paulmillr/scure-bip39) · [`@scure/bip32`](https://github.com/paulmillr/scure-bip32) · [`@scure/base`](https://github.com/paulmillr/scure-base)
- **Networking:** Electrum over [`react-native-tcp-socket`](https://github.com/Rapsssito/react-native-tcp-socket)
- **Secure storage:** [`react-native-keychain`](https://github.com/oblador/react-native-keychain) · [`react-native-biometrics`](https://github.com/SelfLender/react-native-biometrics)

---

## Getting started

**Requirements:** Node `>= 22.11.0`, and the [React Native environment](https://reactnative.dev/docs/set-up-your-environment) set up for iOS and/or Android.

```sh
# 1. Install dependencies
npm install

# 2. iOS only — install native pods
cd ios && pod install && cd ..

# 3. Start the Metro bundler
npm start

# 4. Run the app (in a second terminal)
npm run ios       # or
npm run android
```

---

## Testing

Aura's crypto is verifiable: the tests exercise the **real application modules** in
[`src/wallets/`](src/wallets) and [`src/network/`](src/network) — no vector value is
reimplemented inside the tests.

```sh
# Component / app tests (Jest)
npm test

# Official BIP test-vector verification against the app's own derivation & signing
node scripts/aura-vectors.test.js

# Full crypto-core self-test (derivation, signing, coin selection, throttling)
LANG=en_US.UTF-8 node --import ./scripts/register.mjs --import tsx ./scripts/aura-selftest.ts
```

---

## Project structure

```
src/
├── components/   Reusable UI components
├── constants/    App-wide constants
├── i18n/         40 language files
├── navigation/   React Navigation stacks
├── network/      Electrum, mempool, rates, block explorers
├── screens/      51 app screens
├── types/        Shared TypeScript types
├── utils/        Helpers
└── wallets/      Derivation, signing, transactions, scanning (crypto core)
```

---

## Contributing

Contributions are welcome. Please open an issue to discuss substantial changes
first, run the tests and `npm run lint` before submitting, and keep pull
requests focused.

---

## License

Released under the **MIT License** — see [LICENSE](LICENSE).
© 2026 Aura Wallet.
