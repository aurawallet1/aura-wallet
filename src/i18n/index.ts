import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import Localization, { LocalizedStrings } from './localized';
import { I18nManager, NativeModules, Platform } from 'react-native';

import { SupportedLanguages, LanguageValue } from './languages';
import english from './en.json';

export const LANGUAGE_STORAGE_KEY = 'app.language';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

type StringTable = typeof english;

type StringFormatter = (
  template: string,
  ...params: (string | number | object)[]
) => string;

type BaseStrings = LocalizedStrings<StringTable>;

interface I18nInstance extends Omit<BaseStrings, 'formatString'> {
  formatString: StringFormatter;
}

type RemoteLocale = Exclude<LanguageValue, 'en'>;

const tableFetchers: Record<RemoteLocale, () => StringTable> = {
  ar: () => require('./ar.json'),
  bg_bg: () => require('./bg_bg.json'),
  ca: () => require('./ca.json'),
  cs_cz: () => require('./cs_cz.json'),
  da_dk: () => require('./da_dk.json'),
  de_de: () => require('./de_de.json'),
  el: () => require('./el.json'),
  es: () => require('./es.json'),
  es_419: () => require('./es_419.json'),
  et: () => require('./et_EE.json'),
  fa: () => require('./fa.json'),
  fi_fi: () => require('./fi_fi.json'),
  fr_fr: () => require('./fr_fr.json'),
  he: () => require('./he.json'),
  hr_hr: () => require('./hr_hr.json'),
  hu_hu: () => require('./hu_hu.json'),
  id_id: () => require('./id_id.json'),
  it: () => require('./it.json'),
  jp_jp: () => require('./jp_jp.json'),
  ko_kr: () => require('./ko_KR.json'),
  ms: () => require('./ms.json'),
  nb_no: () => require('./nb_no.json'),
  nl_nl: () => require('./nl_nl.json'),
  pl: () => require('./pl.json'),
  pt_br: () => require('./pt_br.json'),
  pt_pt: () => require('./pt_pt.json'),
  ro: () => require('./ro.json'),
  ru: () => require('./ru.json'),
  sk_sk: () => require('./sk_sk.json'),
  sl_si: () => require('./sl_SI.json'),
  sq_AL: () => require('./sq_AL.json'),
  sr_rs: () => require('./sr_RS.json'),
  sv_se: () => require('./sv_se.json'),
  th_th: () => require('./th_th.json'),
  tr_tr: () => require('./tr_tr.json'),
  ua: () => require('./ua.json'),
  vi_vn: () => require('./vi_vn.json'),
  zh_cn: () => require('./zh_cn.json'),
  zh_tw: () => require('./zh_tw.json'),
};

export const loadedTables: Record<string, StringTable> = { en: english };

const calendarLocaleMap: Record<RemoteLocale, string> = {
  ar: 'ar',
  bg_bg: 'bg',
  ca: 'ca',
  cs_cz: 'cs',
  da_dk: 'da',
  de_de: 'de',
  el: 'el',
  es: 'es',
  es_419: 'es-do',
  et: 'et',
  fa: 'fa',
  fi_fi: 'fi',
  fr_fr: 'fr',
  he: 'he',
  hr_hr: 'hr',
  hu_hu: 'hu',
  id_id: 'id',
  it: 'it',
  jp_jp: 'ja',
  ko_kr: 'ko',
  ms: 'ms',
  nb_no: 'nb',
  nl_nl: 'nl',
  pl: 'pl',
  pt_br: 'pt-br',
  pt_pt: 'pt',
  ro: 'ro',
  ru: 'ru',
  sk_sk: 'sk',
  sl_si: 'sl',
  sq_AL: 'sq',
  sr_rs: 'sr-cyrl',
  sv_se: 'sv',
  th_th: 'th',
  tr_tr: 'tr',
  ua: 'uk',
  vi_vn: 'vi',
  zh_cn: 'zh-cn',
  zh_tw: 'zh-tw',
};

const calendarPackages: Record<string, () => unknown> = {
  af: () => require('dayjs/locale/af'),
  ar: () => require('dayjs/locale/ar'),
  be: () => require('dayjs/locale/be'),
  bg: () => require('dayjs/locale/bg'),
  ca: () => require('dayjs/locale/ca'),
  cs: () => require('dayjs/locale/cs'),
  cy: () => require('dayjs/locale/cy'),
  da: () => require('dayjs/locale/da'),
  de: () => require('dayjs/locale/de'),
  el: () => require('dayjs/locale/el'),
  en: () => require('dayjs/locale/en'),
  es: () => require('dayjs/locale/es'),
  'es-do': () => require('dayjs/locale/es-do'),
  et: () => require('dayjs/locale/et'),
  fa: () => require('dayjs/locale/fa'),
  fi: () => require('dayjs/locale/fi'),
  fo: () => require('dayjs/locale/fo'),
  fr: () => require('dayjs/locale/fr'),
  he: () => require('dayjs/locale/he'),
  hr: () => require('dayjs/locale/hr'),
  hu: () => require('dayjs/locale/hu'),
  id: () => require('dayjs/locale/id'),
  it: () => require('dayjs/locale/it'),
  ja: () => require('dayjs/locale/ja'),
  kk: () => require('dayjs/locale/kk'),
  kn: () => require('dayjs/locale/kn'),
  ko: () => require('dayjs/locale/ko'),
  ms: () => require('dayjs/locale/ms'),
  nb: () => require('dayjs/locale/nb'),
  ne: () => require('dayjs/locale/ne'),
  nl: () => require('dayjs/locale/nl'),
  pl: () => require('dayjs/locale/pl'),
  pt: () => require('dayjs/locale/pt'),
  'pt-br': () => require('dayjs/locale/pt-br'),
  ro: () => require('dayjs/locale/ro'),
  ru: () => require('dayjs/locale/ru'),
  si: () => require('dayjs/locale/si'),
  sk: () => require('dayjs/locale/sk'),
  sl: () => require('dayjs/locale/sl'),
  sq: () => require('dayjs/locale/sq'),
  'sr-cyrl': () => require('dayjs/locale/sr-cyrl'),
  sv: () => require('dayjs/locale/sv'),
  th: () => require('dayjs/locale/th'),
  tr: () => require('dayjs/locale/tr'),
  uk: () => require('dayjs/locale/uk'),
  vi: () => require('dayjs/locale/vi'),
  'zh-cn': () => require('dayjs/locale/zh-cn'),
  'zh-tw': () => require('dayjs/locale/zh-tw'),
};

const instance = new Localization<StringTable>({
  en: english,
}) as LocalizedStrings<StringTable> as I18nInstance;

const hasRemoteTable = (value: string): value is RemoteLocale =>
  Object.prototype.hasOwnProperty.call(tableFetchers, value);

const resolveTable = (value: RemoteLocale): StringTable => {
  if (!loadedTables[value]) {
    loadedTables[value] = tableFetchers[value]();
  }
  return loadedTables[value];
};

const activate = (value: string) => {
  if (value === 'en' || !hasRemoteTable(value)) {
    instance.setContent({ en: english });
    instance.setLanguage('en');
    return;
  }
  instance.setContent({ en: english, [value]: resolveTable(value) });
  instance.setLanguage(value);
};

const readDeviceLocale = (): string => {
  try {
    let identifier = 'en';
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      const candidate =
        settings?.AppleLocale ||
        (Array.isArray(settings?.AppleLanguages) ? settings.AppleLanguages[0] : '');
      identifier = candidate || 'en';
    } else {
      identifier = NativeModules.I18nManager?.localeIdentifier || 'en';
    }
    return String(identifier).replace(/-/g, '_').split('_')[0].toLowerCase();
  } catch {
    return 'en';
  }
};

const syncCalendarLocale = async () => {
  const stored = (await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)) ?? 'en';
  const calendarCode = hasRemoteTable(stored) ? calendarLocaleMap[stored] : 'en';
  const target = calendarPackages[calendarCode] ? calendarCode : 'en';
  calendarPackages[target]?.();
  dayjs.locale(target);
};

const isRunningUnderJest = () =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.JEST_WORKER_ID !== undefined;

const applyLayoutDirection = (value: string) => {
  if (isRunningUnderJest()) {
    return;
  }
  const descriptor = SupportedLanguages.find(entry => entry.value === value);
  const rightToLeft = descriptor?.isRTL ?? false;
  I18nManager.allowRTL(rightToLeft);
  I18nManager.forceRTL(rightToLeft);
};

export const setLanguage = async (value: string) => {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, value);
  activate(value);
  applyLayoutDirection(value);
  await syncCalendarLocale();
};

export const getLanguage = (): string => instance.getLanguage();

export const bootstrap = async () => {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored) {
    await setLanguage(stored);
    return;
  }
  const detected = readDeviceLocale();
  const supported = SupportedLanguages.some(entry => entry.value === detected);
  await setLanguage(supported ? detected : 'en');
};

bootstrap();

export default instance;
