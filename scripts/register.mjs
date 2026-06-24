// Registers our i18n-stubbing resolve hook. tsx is loaded separately via its
// own --import so that .ts files still compile; our hook short-circuits the
// i18n specifier before tsx ever sees it.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts-loader.mjs', pathToFileURL(import.meta.dirname + '/'));
