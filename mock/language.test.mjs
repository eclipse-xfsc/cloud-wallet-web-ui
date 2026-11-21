import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, URLSearchParams, require: name => dependencies[name] });
  return exports;
}
test('language switch preserves current request, query and nested login destination', () => {
  const { languageLocation } = load('src/utils/languageLocation.ts');
  const uri = 'openid4vp://authorize?request_uri=https://verifier.example/request/123';
  const query = new URLSearchParams({ uri, next: '/de/demo/import?uri=' + encodeURIComponent(uri) });
  const result = new URL(languageLocation('/de/demo/login', '?' + query, '#review', 'en'), 'http://localhost:3000');
  assert.equal(result.pathname, '/en/demo/login');
  assert.equal(result.hash, '#review');
  assert.equal(result.searchParams.get('uri'), uri);
  assert.equal(result.searchParams.get('next'), '/en/demo/import?uri=' + encodeURIComponent(uri));
  assert.equal(languageLocation('/en/demo/presentation/employment', '', '', 'de'), '/de/demo/presentation/employment');
  assert.throws(() => languageLocation('/de/demo', '', '', 'invalid'));
});
test('demo consent and import labels switch to English without modifying German fixture data', () => {
  const { translateDemoText } = load('src/components/demo/demoText.ts', { 'next-intl': { useLocale: () => 'en' } });
  assert.equal(translateDemoText('Präsentation zusammenstellen', 'en'), 'Prepare presentation');
  assert.equal(
    translateDemoText('Anfrage von einer anderen Website öffnen', 'en'),
    'Open a request from another website'
  );
  assert.equal(translateDemoText('Mitarbeiterausweis empfangen', 'en'), 'Employee credential received');
  assert.equal(translateDemoText('Vorname', 'de'), 'Vorname');
});
