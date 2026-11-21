import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, dependencies) {
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    URL,
    URLSearchParams,
    process: { env: { NODE_ENV: 'test' } },
    require: name => {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (!(name in dependencies)) throw Error('Unexpected dependency: ' + name);
      return dependencies[name];
    },
  });
  return exports.default;
}
for (const locale of ['de', 'en']) {
  test(`both landing sign-in links target the native demo login (${locale})`, () => {
    const AccessLink = { name: 'AccessLink' };
    const home = load('src/app/[locale]/(root)/page.tsx', {
      '@/components/wallet-ui/LanguageSwitch': { __esModule: true, default: 'language-switch' },
      '@/service/runtimeAuthConfig': { readRuntimeAuthConfig: () => ({ mock: true }) },
      '@/components/wallet-ui/AccessLink': { __esModule: true, default: AccessLink },
      'next/link': { __esModule: true, default: 'a' },
      'next/image': { __esModule: true, default: 'img' },
      '@/components/wallet-ui/Icon': { __esModule: true, default: 'icon' },
      'next-intl': { useLocale: () => locale, useTranslations: () => key => key },
    });
    const nodes = [];
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === AccessLink) nodes.push(node);
      for (const c of [node.props?.children].flat(Infinity)) walk(c);
    }
    walk(home());
    assert.equal(nodes.length, 2);
    assert(nodes.every(n => n.props.href === `/${locale}/demo/login`));
    const link = load('src/components/wallet-ui/AccessLink.tsx', {
      'next/link': { __esModule: true, default: 'next-link' },
      'next-intl': { useLocale: () => locale, useTranslations: () => key => key },
      react: { useRef: v => ({ current: v }), useState: v => [v, () => {}] },
      '@/store/AuthConfigProvider': { useAuthConfig: () => ({ mock: true }) },
    });
    for (const node of nodes) {
      const rendered = link(node.props);
      assert.equal(rendered.type, 'a');
      assert.equal(rendered.props.href, `/${locale}/demo/login`);
      assert.equal(rendered.props.onClick, undefined);
    }
  });
}
test('missing auth config keeps native wallet link instead of swallowing the click', () => {
  const link = load('src/components/wallet-ui/AccessLink.tsx', {
    'next/link': { __esModule: true, default: 'next-link' },
    'next-intl': { useLocale: () => 'de', useTranslations: () => key => key },
    react: { useRef: v => ({ current: v }), useState: v => [v, () => {}] },
    '@/store/AuthConfigProvider': { useAuthConfig: () => null },
  });
  const rendered = link({ href: '/de/wallet', children: 'Anmelden' });
  assert.equal(rendered.type, 'a');
  assert.equal(rendered.props.href, '/de/wallet');
  assert.equal(rendered.props.onClick, undefined);
});
