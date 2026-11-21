import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { handleMockRequest, issueToken, verifyToken } from './backend.mjs';
const origin = 'http://localhost:3000';
async function api(path, { method = 'GET', body, token } = {}) {
  return await handleMockRequest(
    new Request(origin + '/api/mock' + path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  );
}
test('JWT issuance, verification, rejection, offers, presentations, receipts and deep links', async () => {
  assert.equal((await api('/credentials', { method: 'POST', body: { filter: {} } })).status, 401);
  assert.equal((await api('/auth/login', { method: 'POST', body: { username: 'bad', password: 'demo' } })).status, 401);
  const login = await (
    await api('/auth/login', { method: 'POST', body: { username: 'demo', password: 'demo' } })
  ).json();
  const token = login.access_token;
  assert.equal(verifyToken(token).sub, 'demo');
  assert.throws(() => verifyToken(token.slice(0, -5) + 'AAAAA'));
  assert.throws(() => verifyToken(issueToken('demo', -1)));
  const call = (path, method = 'GET', body) => api(path, { token, method, body });
  assert.equal((await call('/auth/verify')).status, 200);
  assert.equal((await api('/configuration')).status, 200);
  const credentials = await (await call('/credentials', 'POST', { filter: {} })).json();
  assert(credentials.some(c => c.format === 'ldp_vc'));
  const sd = credentials.find(c => c.format === 'dc+sd-jwt');
  const [jwt, ...disclosures] = sd.raw.split('~');
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url'));
  assert(
    disclosures.filter(Boolean).every(d => payload._sd.includes(createHash('sha256').update(d).digest('base64url')))
  );
  assert.equal((await call('/configuration/language', 'PUT', { language: 'en' })).status, 200);
  assert.equal((await (await call('/configuration/user')).json()).language, 'en');
  assert.equal((await call('/configuration/language', 'PUT', { language: 'xx' })).status, 400);
  const offer = await (await call('/offers', 'POST', {})).json();
  const accepted = await (await call(`/offers/${offer.id}/accept`, 'POST', {})).json();
  assert.equal(accepted.status, 'accepted');
  assert(accepted.receipt.id);
  assert.equal((await call(`/offers/${offer.id}/accept`, 'POST', {})).status, 409);
  const list = await (await call('/credentials', 'POST', { filter: {} })).json();
  assert.equal(list.length, credentials.length + 1);
  const p = await (await call('/presentations', 'POST', {})).json();
  assert.equal(
    (
      await call(`/presentations/${p.id}/confirm`, 'POST', {
        credentialId: sd.id,
        fields: p.requestedClaims,
        confirmed: false,
      })
    ).status,
    400
  );
  assert.equal(
    (
      await call(`/presentations/${p.id}/confirm`, 'POST', {
        credentialId: sd.id,
        fields: [...p.requestedClaims, 'Geheim'],
        confirmed: true,
      })
    ).status,
    400
  );
  const sent = await (
    await call(`/presentations/${p.id}/confirm`, 'POST', {
      credentialId: sd.id,
      fields: p.requestedClaims,
      confirmed: true,
    })
  ).json();
  assert.equal(sent.status, 'sent');
  assert.deepEqual(Object.keys(sent.sharedClaims), p.requestedClaims);
  assert.equal(
    (
      await call(`/presentations/${p.id}/confirm`, 'POST', {
        credentialId: sd.id,
        fields: p.requestedClaims,
        confirmed: true,
      })
    ).status,
    409
  );
  const history = await (await call('/history')).json();
  assert(history.some(e => e.type === 'credential_received' && e.offerId === offer.id));
  assert(history.some(e => e.type === 'presentation_sent' && e.presentationId === p.id));
  const uri = `openid4vp://authorize?request_uri=${encodeURIComponent(
    origin + '/api/mock/requests/presentation/' + p.id
  )}`;
  assert.equal((await call('/links/resolve', 'POST', { uri })).status, 200);
  assert.equal((await call('/links/resolve', 'POST', { uri: uri.replace('localhost', 'evil') })).status, 400);
  const redirected = await api(`/redirect/offer/${offer.id}`);
  assert.equal(redirected.status, 302);
  assert.equal(redirected.headers.get('location'), `/de/demo/offer/${offer.id}`);
  const metadata = await (await api('/issuer-metadata')).json();
  assert(metadata.credential_configurations_supported.EmployeeCredential);
  assert.equal((await call('/auth/logout', 'POST', {})).status, 200);
  assert.equal((await call('/credentials', 'POST', { filter: {} })).status, 401);
});

test('Holder candidates, minimal preselection, disclosure controls and DCQL combinations', async () => {
  const session = await (
    await api('/auth/login', { method: 'POST', body: { username: 'demo', password: 'demo' } })
  ).json();
  const token = session.access_token;
  const call = (path, method = 'GET', body) => api(path, { token, method, body });
  const create = async profile => await (await call('/presentations', 'POST', { profile })).json();
  const p = await create('employment');
  const candidates = await (await call(`/presentation/presentations/${p.id}/candidates`)).json();
  assert(candidates.dcqlQuery.credentials.length);
  assert(Object.keys(candidates.candidates[0].credentials).length >= 2);
  const selected = candidates.suggestedSelection.selections;
  assert.deepEqual(selected[0].disclosures, ['Vorname', 'Organisation']);
  const approve = selections =>
    call(`/presentation/presentations/${p.id}/approve`, 'POST', { presentationId: p.id, approved: true, selections });
  assert.equal((await approve([{ ...selected[0], queryId: 'forged' }])).status, 422);
  assert.equal((await approve([{ ...selected[0], credentialId: 'membership-1' }])).status, 422);
  assert.equal((await approve([{ ...selected[0], disclosures: ['Vorname'] }])).status, 422);
  assert.equal((await approve([{ ...selected[0], disclosures: [...selected[0].disclosures, 'secret'] }])).status, 422);
  assert.equal((await approve([{ ...selected[0], claimIds: ['first'] }])).status, 422);
  assert.equal((await approve([...selected, ...selected])).status, 422);
  assert.equal((await call(`/presentations/${p.id}`)).status, 200);
  const alternative = Object.keys(candidates.candidates[0].credentials).find(id => id !== selected[0].credentialId);
  const changed = [{ ...selected[0], credentialId: alternative, disclosures: ['Vorname', 'Organisation', 'Nachname'] }];
  const accepted = await (await approve(changed)).json();
  assert.equal(accepted.status, 'completed');
  assert(accepted.response.sharedClaims.employment[alternative].Nachname);
  const vp = accepted.response.vp_token.employment[0];
  assert.equal(vp.split('~').length, 5); // issuer JWT + three selected disclosures + key binding JWT
  const kb = JSON.parse(Buffer.from(vp.split('~').at(-1).split('.')[1], 'base64url'));
  assert.equal(kb.nonce, p.nonce);
  assert.equal(kb.aud, p.recipient);
  assert.equal((await approve(changed)).status, 409);
  const minimal = await create('employment');
  const suggestion = (await (await call(`/presentations/${minimal.id}/candidates`)).json()).suggestedSelection;
  const response = await (
    await call(`/presentations/${minimal.id}/approve`, 'POST', { approved: true, ...suggestion })
  ).json();
  const encoded = response.response.vp_token.employment[0].split('~').slice(1, -1);
  assert.deepEqual(
    encoded.map(d => JSON.parse(Buffer.from(d, 'base64url'))[1]),
    ['Vorname', 'Organisation']
  );
  const combined = await create('combined');
  const combo = await (await call(`/presentations/${combined.id}/candidates`)).json();
  assert.equal(combo.combinations.length, 2);
  assert.equal(combo.suggestedSelection.selections.length, 1, 'minimal combination is recommended');
  const training = combo.candidates.find(g => g.id === 'training');
  const selection = [
    ...combo.suggestedSelection.selections,
    { queryId: 'training', credentialId: Object.keys(training.credentials)[0], disclosures: [] },
  ];
  const fulfilled = await (
    await call(`/presentations/${combined.id}/approve`, 'POST', { approved: true, selections: selection })
  ).json();
  assert.equal(fulfilled.response.vp_token.training[0].verifiableCredential.length, 1);
  assert(fulfilled.response.sharedClaims.training['training-1'].Nachname, 'LDP shares full credential');
  const rejected = await create('employment');
  assert.equal((await call(`/presentations/${rejected.id}/reject`, 'POST', {})).status, 200);
  assert.equal(
    (await call(`/presentations/${rejected.id}/approve`, 'POST', { approved: true, selections: selected })).status,
    409
  );
  const inbox = await (await call('/presentation/presentations')).json();
  assert(!inbox.presentations.some(x => x.presentationId === rejected.id));
  const deep = `openid4vp://authorize?request_uri=${encodeURIComponent(
    origin + '/api/mock/requests/presentation/' + p.id
  )}`;
  const intake = await call('/holder/demo/presentations', 'POST', { url: deep, consentMode: 'manual' });
  assert.equal(intake.status, 201);
  assert((await intake.json()).presentationId);
  assert.equal((await call('/holder/other/presentations')).status, 404);
});

test('credential listing uses POST and validates optional filters', async () => {
  const session = await (
    await api('/auth/login', { method: 'POST', body: { username: 'demo', password: 'demo' } })
  ).json();
  const token = session.access_token;
  const list = filter => api('/credentials', { method: 'POST', body: { filter }, token });
  const response = await api('/credentials', { token });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
  const all = await (await list({})).json();
  assert(all.length >= 4);
  const ldp = await (await list({ format: 'ldp_vc' })).json();
  assert(ldp.length > 0);
  assert(ldp.every(c => c.format === 'ldp_vc'));
  const search = await (await list({ search: 'zweite demo' })).json();
  assert(search.length > 0);
  assert(search.every(c => c.claims.Organisation === 'Zweite Demo GmbH'));
  const issuer = all[0].issuer;
  assert((await (await list({ issuer })).json()).every(c => c.issuer === issuer));
  assert.deepEqual(await (await list({ search: 'not-present-xyz' })).json(), []);
  assert.equal((await list({ unknown: 'x' })).status, 400);
  assert.equal((await list({ search: 42 })).status, 400);
  assert.equal((await list([])).status, 400);
  assert.equal((await api('/credentials', { method: 'POST', body: { filter: {} } })).status, 401);
});
