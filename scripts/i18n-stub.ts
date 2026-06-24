// Minimal stand-in for src/i18n used only by the self-test.
// The real i18n module imports react-native / AsyncStorage / react-localization
// which cannot load under plain Node. The project's crypto code only uses
// `loc.send.*`, `loc.network.*`, and `loc.formatString(...)` to produce error
// message strings, so a Proxy that returns the key path is sufficient.

type AnyRec = Record<string, unknown>;

const makeBranch = (prefix: string): AnyRec =>
  new Proxy(
    {},
    {
      get: (_t, key: string) => `${prefix}.${String(key)}`,
    },
  );

const loc: AnyRec = new Proxy(
  {},
  {
    get: (_t, key: string) => {
      if (key === 'formatString') {
        return (template: string, ...params: unknown[]) =>
          `${String(template)} ${params.map(p => JSON.stringify(p)).join(' ')}`.trim();
      }
      return makeBranch(String(key));
    },
  },
);

export default loc;
