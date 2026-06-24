# Changelog

All notable changes to Aura Wallet are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.6] - 2026-06-25

### Security
- Cap the Electrum receive buffer so a malicious server can't exhaust memory by streaming unbounded data.

## [1.3.5] - 2026-06-25

### Security
- The mempool.space fallback is now opt-in (off by default), so address scanning no longer silently leaks derived addresses to a third party when Electrum is unavailable. Toggle under Settings → General.

## [1.3.4] - 2026-06-25

### Security
- Auto-clear the clipboard after a wallet export — WIF private keys and multisig descriptors (which contain seeds) no longer linger.

## [1.3.3] - 2026-06-25

### Security
- Store the device key with `WhenPasscodeSetThisDeviceOnly`, so it only exists on a passcode-protected device (applies to new keys; existing keys are left in place to avoid any lockout).

## [1.3.2] - 2026-06-25

### Security
- Confirm the old wallet copy is actually removed before reporting encryption as enabled.
- Lock the moment the app leaves the foreground, so the app-switcher snapshot shows the lock screen, not wallet contents.

## [1.3.1] - 2026-06-25

### Security
- Never persist wallet secrets unencrypted — fail closed if the device key is unavailable.
- Bounded Argon2 parameters so a tampered storage file can't exhaust memory.
- Require an 8-character minimum for new encryption passwords.
- Added encryption security tests.

## [1.3.0] - 2026-06-24

### Security
- Sensitive values copied to the clipboard (WIF private keys and extended public
  keys) are now automatically cleared after 60 seconds, so a secret does not
  linger on the shared system clipboard where other apps can read it.

### Fixed
- Corrected the crypto verification suite (`scripts/aura-vectors.test.js`): it had
  two wrong expected values (the BIP39 Trezor seed and the BIP44 first address) and
  its BIP143 check did not account for the version-2 transaction format. All 15
  BIP32 / BIP39 / BIP44 / BIP49 / BIP84 / BIP143 vectors now pass, so the suite
  reliably validates the real signing and derivation code against the specs.

### Changed
- `sighashForInput` accepts an optional transaction version (default 2) so the
  BIP143 worked example can be checked byte-for-byte. Production transaction
  building is unchanged — Aura still signs and broadcasts version-2 transactions.

## [1.2.0] - 2026-06-24

### Security
- Hardened `.gitignore` to prevent accidental commits of secrets and key material
  (`.env`, `*.pem`, `*.key`, `*.p12`, `*.mnemonic`, `*.seed`, service-account files).
- Added Dependabot (`.github/dependabot.yml`) for automated dependency security updates
  across npm, CocoaPods, and GitHub Actions.

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

[1.3.6]: https://github.com/aurawallet1/aura-wallet/releases/tag/v1.3.6
[1.3.5]: https://github.com/aurawallet1/aura-wallet/releases/tag/v1.3.5
[1.3.4]: https://github.com/aurawallet1/aura-wallet/releases/tag/v1.3.4
[1.3.3]: https://github.com/aurawallet1/aura-wallet/releases/tag/v1.3.3
[1.3.2]: https://github.com/aurawallet1/aura-wallet/releases/tag/v1.3.2
[1.3.1]: https://github.com/aurawallet1/aura-wallet/releases/tag/v1.3.1
[1.3.0]: https://github.com/aurawallet1/aura-wallet/releases/tag/v1.3.0
[1.2.0]: https://github.com/aurawallet1/aura-wallet/releases/tag/v1.2.0
[1.1.0]: https://github.com/aurawallet1/aura-wallet/releases/tag/v1.1.0
[1.0.0]: https://github.com/aurawallet1/aura-wallet/releases/tag/v1.0.0
