import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { handleMockRequest, issueToken } from './backend.mjs';
const exports = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/service/demoSession.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText,
  { exports, URL, Date, fetch, AbortController, setTimeout, clearTimeout }
);
const { verifyDemoSession, demoLoginLocation, demoReturnLocation } = exports;
const backend = async (path, options) => await handleMockRequest(new Request('http://localhost:3000' + path, options));
test('redirect session check: missing, valid, expired, tampered and revoked tokens', async () => {
  let calls = 0;
  assert.equal(
    (
      await verifyDemoSession(null, undefined, async () => {
        calls++;
      })
    ).status,
    'anonymous'
  );
  assert.equal(calls, 0);
  const token = issueToken('demo');
  assert.equal((await verifyDemoSession(token, undefined, backend)).status, 'valid');
  assert.equal((await verifyDemoSession(issueToken('demo', -1), undefined, backend)).status, 'anonymous');
  assert.equal((await verifyDemoSession(token.slice(0, -7) + 'invalid', undefined, backend)).status, 'anonymous');
  await backend('/api/mock/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: '{}' });
  assert.equal((await verifyDemoSession(token, undefined, backend)).status, 'anonymous');
});
test('temporary auth-service errors do not destroy a possibly valid session', async () => {
  assert.equal(
    (await verifyDemoSession('token', undefined, async () => new Response('', { status: 503 }))).status,
    'unavailable'
  );
  assert.equal(
    (
      await verifyDemoSession('token', undefined, async () => {
        throw Error('network unavailable');
      })
    ).status,
    'unavailable'
  );
});
test('login redirect resumes full import URI and refuses external or looping targets', () => {
  const target =
    '/de/demo/import?uri=' +
    encodeURIComponent(
      'openid4vp://authorize?request_uri=http://localhost:3000/api/mock/requests/presentation/employment'
    ) +
    '#review';
  const login = new URL(demoLoginLocation('/de/demo', target), 'http://localhost:3000');
  assert.equal(login.pathname, '/de/demo/login');
  assert.equal(demoReturnLocation('/de/demo', login.searchParams.get('next')), target);
  for (const unsafe of [
    'https://evil.example/path',
    '//evil.example',
    '/de/demo/login',
    '/de/demo/login/',
    '/de/demo/../../outside',
    '/de/demo/\\evil.example',
  ])
    assert.equal(demoReturnLocation('/de/demo', unsafe), '/de/demo');
});
