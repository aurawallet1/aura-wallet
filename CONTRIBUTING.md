# Contributing to Aura Wallet

Thanks for your interest in improving Aura Wallet! Contributions of all kinds are
welcome — bug reports, fixes, features, docs, and translations.

## Getting started

1. Fork and clone the repository.
2. Install dependencies: `npm install` (and `cd ios && pod install` for iOS).
3. Run the app: `npm start`, then `npm run ios` or `npm run android`.

## Before you open a pull request

- Run the tests: `npm test` and `node scripts/aura-vectors.test.js`.
- Lint your changes: `npm run lint`.
- Keep each pull request focused, and describe **what** changed and **why**.
- For substantial changes, open an issue first to discuss the approach.

## Code style

- TypeScript throughout — follow the existing patterns in `src/`.
- The crypto path must stay free of `Buffer` / Node polyfills.

## Translations

Aura ships in 40 languages under [`src/i18n/`](src/i18n). To add or fix a
translation, edit the matching language file and keep the keys consistent with
[`en.json`](src/i18n/en.json).

## Security

Never commit secrets, seed phrases, or private keys. For security vulnerabilities,
follow the [Security Policy](SECURITY.md) — please do **not** open a public issue.
