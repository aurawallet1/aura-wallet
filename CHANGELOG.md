# Changelog

All notable changes to Aura Wallet are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-06-24

### Added
- `SECURITY.md` — responsible-disclosure policy, supported versions, and audit status.
- Project home link in the README "About us" section.

## [1.0.0] - 2026-06-24

First public release.

### Added
- Self-custody HD wallets — BIP32 / BIP39 / BIP44 / BIP49 / BIP84 (Legacy, Nested SegWit, Native SegWit).
- Multisig wallets — create and import `m-of-n` with an advanced setup flow.
- Send & receive — coin control, change-address selection, custom network fees, and QR scan / generation.
- Import & export — restore from mnemonic, address discovery, and xpub export for watch-only use.
- Message signing & verification.
- On-device security — biometric / passcode lock screen, keychain-backed key storage, and a stealth holding mode.
- Electrum networking with a mempool.space fallback; only public data ever leaves the device.
- Fully internationalized UI in 40 languages.
- Crypto-core test suite verified against official Bitcoin (BIP) test vectors.

[1.1.0]: https://github.com/aurawallet1/aura-wallet/releases/tag/v1.1.0
[1.0.0]: https://github.com/aurawallet1/aura-wallet/releases/tag/v1.0.0
