/**
 * @format
 */

// Secure CSPRNG polyfill — must load before any crypto use (BIP39 mnemonic gen).
import 'react-native-get-random-values';
import { TextEncoder, TextDecoder } from 'text-encoding';
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

// TextEncoder/TextDecoder polyfill for Hermes — required by the `qr` QR encoder (byte mode).
// Pure JS, no native rebuild. Polyfill shim.
if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;

AppRegistry.registerComponent(appName, () => App);
