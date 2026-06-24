// Self-contained Node module hook: transpiles .ts via esbuild AND redirects the
// project's react-native-bound i18n (and RN bare deps) to a pure stub, so the
// whole import graph flows through one hook we control. Replaces tsx entirely
// for this test (tsx resolves sub-imports internally and bypasses Node hooks).
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { transformSync } from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUB = pathToFileURL(path.join(HERE, 'i18n-stub.ts')).href;

const STUBBED_BARE = new Set([
  'react-native',
  '@react-native-async-storage/async-storage',
  'react-localization',
]);

const isI18n = spec =>
  spec === '../i18n' ||
  spec === './i18n' ||
  /(^|\/)i18n(\/index(\.ts)?)?$/.test(spec);

export async function resolve(specifier, context, nextResolve) {
  if (isI18n(specifier) || STUBBED_BARE.has(specifier)) {
    return { url: STUB, shortCircuit: true, format: 'module' };
  }

  // Resolve TS sibling imports that omit extensions / .js->.ts mapping.
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    context.parentURL
  ) {
    const baseDir = path.dirname(fileURLToPath(context.parentURL));
    const candidates = [];
    if (/\.js$/.test(specifier)) {
      candidates.push(specifier.replace(/\.js$/, '.ts'));
    }
    if (!/\.[cm]?[jt]s$/.test(specifier)) {
      candidates.push(specifier + '.ts', specifier + '/index.ts');
    }
    for (const cand of candidates) {
      const abs = path.resolve(baseDir, cand);
      try {
        readFileSync(abs);
        return { url: pathToFileURL(abs).href, shortCircuit: true, format: 'module' };
      } catch {
        /* try next */
      }
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const filename = fileURLToPath(url);
    const source = readFileSync(filename, 'utf8');
    const { code } = transformSync(source, {
      loader: url.endsWith('.tsx') ? 'tsx' : 'ts',
      format: 'esm',
      target: 'node20',
      sourcefile: filename,
    });
    return { format: 'module', source: code, shortCircuit: true };
  }
  return nextLoad(url, context);
}
