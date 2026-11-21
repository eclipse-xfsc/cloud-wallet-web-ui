import { fetchQrImage } from './qr-image.mjs';
import { getCandidates, approveSelection, queryFor } from './presentation-selection.mjs';
import { createHmac, randomBytes, randomUUID, timingSafeEqual, createHash } from 'node:crypto';
const secret = process.env.MOCK_JWT_SECRET || randomBytes(32).toString('hex');
const issuer = 'urn:xfsc:local-mock';
const audience = 'xfsc-demo-wallet';
const users = new Map();
const revoked = new Set();
const sessions = new Map();
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const signature = value => createHmac('sha256', secret).update(value).digest('base64url');
export function issueToken(sub, ttl = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: issuer, aud: audience, sub, iat: now, exp: now + ttl, jti: randomUUID() };
  const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
  const token = `${data}.${signature(data)}`;
  sessions.set(payload.jti, payload.exp);
  return token;
}
export function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw Error('Invalid token');
  const [header, payload, sig] = parts;
  const expected = Buffer.from(signature(`${header}.${payload}`)),
    actual = Buffer.from(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw Error('Invalid signature');
  const h = JSON.parse(Buffer.from(header, 'base64url'));
  const p = JSON.parse(Buffer.from(payload, 'base64url'));
  if (
    h.alg !== 'HS256' ||
    p.iss !== issuer ||
    p.aud !== audience ||
    p.exp <= Date.now() / 1000 ||
    !sessions.has(p.jti) ||
    revoked.has(p.jti)
  )
    throw Error('Expired or revoked token');
  return p;
}
const stamp = () => new Date().toISOString();
function sdCredential(id, name, claims) {
  const disclosures = Object.entries(claims).map(([key, value]) =>
    encode([randomBytes(16).toString('hex'), key, value])
  );
  const payload = {
    iss: issuer,
    iat: Math.floor(Date.now() / 1000),
    vct: 'urn:demo:employee',
    _sd_alg: 'sha-256',
    _sd: disclosures.map(d => createHash('sha256').update(d).digest('base64url')),
  };
  const data = `${encode({ alg: 'HS256', typ: 'dc+sd-jwt' })}.${encode(payload)}`;
  return {
    id,
    name,
    format: 'dc+sd-jwt',
    issuer: 'XFSC Demo-Aussteller',
    issuedAt: stamp(),
    claims,
    raw: `${data}.${signature(data)}~${disclosures.join('~')}~`,
    demo: true,
  };
}
function ldpCredential(id) {
  const claims = { Vorname: 'Alex', Nachname: 'Muster', Qualifikation: 'Datenschutz-Grundlagen' };
  return {
    id,
    name: 'Teilnahmebestätigung',
    format: 'ldp_vc',
    issuer: 'XFSC Demo-Akademie',
    issuedAt: stamp(),
    claims,
    demo: true,
    raw: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: `urn:uuid:${id}`,
      type: ['VerifiableCredential', 'TrainingCredential'],
      issuer,
      issuanceDate: stamp(),
      credentialSubject: { id: 'did:example:alex', ...claims },
      proof: {
        type: 'Ed25519Signature2020',
        created: stamp(),
        verificationMethod: 'did:example:mock#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: 'DEMO-NOT-A-VALID-LDP-PROOF',
      },
    },
  };
}
function addEvent(state, type, name, extra = {}) {
  const event = { id: randomUUID(), type, event: name, timestamp: stamp(), ...extra };
  state.history.unshift(event);
  return event;
}
function stateFor(sub) {
  if (!users.has(sub)) {
    const state = {
      configuration: { language: 'de', historyLimit: 50 },
      credentials: [
        sdCredential('employee-1', 'Mitarbeiterausweis', {
          Vorname: 'Alex',
          Nachname: 'Muster',
          Organisation: 'Beispiel GmbH',
        }),
        sdCredential('employee-2', 'Alternativer Mitarbeiterausweis', {
          Vorname: 'Alex',
          Nachname: 'Muster',
          Organisation: 'Zweite Demo GmbH',
        }),
        sdCredential('membership-1', 'Mitgliedschaft', { Name: 'Alex Muster', Verein: 'Demo Verband' }),
        ldpCredential('training-1'),
      ],
      offers: new Map(),
      presentations: new Map(),
      history: [],
    };
    const offer = {
      id: 'welcome',
      status: 'received',
      credential: sdCredential('new-employee', 'Neuer Mitarbeiterausweis', {
        Vorname: 'Alex',
        Nachname: 'Muster',
        Organisation: 'Neue Demo GmbH',
      }),
      createdAt: stamp(),
    };
    state.offers.set(offer.id, offer);
    state.presentations.set('employment', {
      id: 'employment',
      status: 'pending',
      recipient: 'Demo-Partnerportal',
      purpose: 'Beschäftigung für den Portalzugang bestätigen',
      requestedClaims: ['Vorname', 'Organisation'],
      nonce: randomUUID(),
      profile: 'employment',
      createdAt: stamp(),
    });
    for (const c of state.credentials)
      addEvent(state, 'credential_received', `${c.name} empfangen`, { credentialId: c.id });
    users.set(sub, state);
  }
  return users.get(sub);
}
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (message, status = 400) => json({ error: message }, status);
const redirect = location =>
  new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
export async function handleMockRequest(request) {
  try {
    const url = new URL(request.url);
    let path = url.pathname.replace(/^\/api\/mock(?=\/|$)/, '/api');
    const holderAlias = path.startsWith('/api/presentation/presentations') || path.startsWith('/api/holder/');
    if (path.startsWith('/api/holder/') && !path.startsWith('/api/holder/demo/'))
      return fail('Unknown demo tenant', 404);
    path = path
      .replace(/^\/api\/holder\/demo\/presentations/, '/api/presentations')
      .replace(/^\/api\/presentation\/presentations/, '/api/presentations');
    const method = request.method;
    let body = {};
    if (!['GET', 'HEAD'].includes(method)) {
      try {
        body = await request.json();
      } catch {
        return fail('JSON body required');
      }
    }
    const origin = process.env.MOCK_PUBLIC_URL || url.origin;
    if (path === '/api/configuration' && method === 'GET')
      return json({
        mock: true,
        auth: { login: '/api/mock/auth/login', logout: '/api/mock/auth/logout', verify: '/api/mock/auth/verify' },
        demoUser: 'demo',
        formats: ['dc+sd-jwt', 'ldp_vc'],
        issuer_metadata: `${origin}/api/mock/issuer-metadata`,
      });
    if (path === '/api/auth/login' && method === 'POST') {
      if (body.username !== 'demo' || body.password !== 'demo') return fail('Demo-Zugang: demo / demo', 401);
      return json({ access_token: issueToken('demo'), token_type: 'Bearer', expires_in: 3600 });
    }
    if (path === '/api/issuer-metadata' || path === '/.well-known/openid-credential-issuer')
      return json({
        credential_issuer: origin,
        credential_endpoint: `${origin}/api/mock/credential`,
        nonce_endpoint: `${origin}/api/mock/nonce`,
        credential_configurations_supported: {
          EmployeeCredential: {
            format: 'dc+sd-jwt',
            vct: 'urn:demo:employee',
            scope: 'employee',
            display: [{ name: 'Demo-Mitarbeiterausweis', locale: 'de' }],
          },
          LegacyTraining: {
            format: 'ldp_vc',
            credential_definition: { type: ['VerifiableCredential', 'TrainingCredential'] },
            display: [{ name: 'Legacy Demo-Teilnahmebestätigung', locale: 'de' }],
          },
        },
        demo: true,
        note: 'Illustrative OID4VCI 1.0 metadata, not a conformance implementation; ldp_vc is a legacy example.',
      });
    const publicMatch = path.match(/^\/api\/(redirect|requests)\/(offer|presentation)\/([a-zA-Z0-9-]+)$/);
    if (publicMatch && method === 'GET') {
      const [, kind, type, id] = publicMatch;
      if (kind === 'redirect')
        return redirect(`/${url.searchParams.get('lang') === 'en' ? 'en' : 'de'}/demo/${type}/${id}`);
      return json(
        type === 'offer'
          ? {
              credential_issuer: origin,
              credential_configuration_ids: ['EmployeeCredential'],
              grants: { 'urn:ietf:params:oauth:grant-type:pre-authorized_code': { 'pre-authorized_code': id } },
              demo: true,
            }
          : {
              client_id: 'demo-partnerportal',
              response_type: 'vp_token',
              response_mode: 'direct_post',
              response_uri: `${origin}/api/mock/presentations/${id}/confirm`,
              nonce: stateFor('demo').presentations.get(id)?.nonce ?? id,
              dcql_query: queryFor(stateFor('demo').presentations.get(id) ?? { profile: 'employment' }),
              demo: true,
            }
      );
    }
    if (path === '/api/nonce' && method === 'POST')
      return json({ c_nonce: randomUUID(), c_nonce_expires_in: 300, demo: true });
    const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
    let identity;
    try {
      identity = verifyToken(token);
    } catch {
      return fail('Anmeldung abgelaufen oder Token ungültig', 401);
    }
    const state = stateFor(identity.sub);
    if (path === '/api/qr-image' && method === 'GET') return await fetchQrImage(request);
    if (path === '/api/auth/verify' && method === 'GET')
      return json({ valid: true, sub: identity.sub, expiresAt: identity.exp });
    if (path === '/api/auth/logout' && method === 'POST') {
      revoked.add(identity.jti);
      sessions.delete(identity.jti);
      return json({ loggedOut: true });
    }
    if (path === '/api/configuration/user' && method === 'GET') return json(state.configuration);
    if (path === '/api/configuration/language' && method === 'PUT') {
      if (!['de', 'en'].includes(body.language)) return fail('Supported languages: de, en');
      state.configuration.language = body.language;
      return json(state.configuration);
    }
    if (path === '/api/credential' && method === 'POST') {
      const credential = state.credentials.find(c =>
        body.credential_configuration_id === 'LegacyTraining' ? c.format === 'ldp_vc' : c.format === 'dc+sd-jwt'
      );
      return json({ credentials: [{ credential: credential.raw }], demo: true });
    }
    if (path === '/api/credentials') {
      if (method !== 'POST')
        return Response.json(
          { error: 'Use POST /api/credentials with {filter:{}}' },
          { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } }
        );
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'filter'))
        return fail('Expected {filter:{}}');
      const filter = body.filter ?? {};
      if (
        typeof filter !== 'object' ||
        Array.isArray(filter) ||
        Object.keys(filter).some(key => !['search', 'format', 'issuer'].includes(key)) ||
        Object.values(filter).some(value => typeof value !== 'string')
      )
        return fail('Invalid credential filter');
      const search = filter.search?.trim().toLocaleLowerCase();
      return json(
        state.credentials.filter(
          c =>
            (!filter.format || c.format === filter.format) &&
            (!filter.issuer || c.issuer === filter.issuer) &&
            (!search || [c.name, c.issuer, ...Object.values(c.claims)].join(' ').toLocaleLowerCase().includes(search))
        )
      );
    }
    if (path === '/api/history' && method === 'GET')
      return json(state.history.filter(e => !url.searchParams.get('type') || e.type === url.searchParams.get('type')));
    if (path === '/api/offers' && method === 'GET') return json([...state.offers.values()]);
    if (path === '/api/offers' && method === 'POST') {
      const id = randomUUID();
      const offer = {
        id,
        status: 'received',
        credential:
          body.format === 'ldp_vc'
            ? ldpCredential(randomUUID())
            : sdCredential(randomUUID(), 'Angebotener Mitarbeiterausweis', {
                Vorname: 'Alex',
                Nachname: 'Muster',
                Organisation: 'Demo GmbH',
              }),
        createdAt: stamp(),
      };
      state.offers.set(id, offer);
      return json(offer, 201);
    }
    if (path === '/api/presentations' && method === 'GET')
      return holderAlias
        ? json({
            presentations: [...state.presentations.values()]
              .filter(p => p.status === 'pending')
              .map(p => ({ ...p, presentationId: p.id, clientId: p.recipient })),
          })
        : json([...state.presentations.values()]);
    if (path === '/api/presentations' && method === 'POST') {
      let source;
      if (holderAlias || body.url) {
        if (body.consentMode !== 'manual') return fail('Manual consent required');
        try {
          const incoming = new URL(body.url);
          const requestUri = new URL(incoming.searchParams.get('request_uri'));
          const match = requestUri.pathname.match(/^\/api\/(?:mock\/)?requests\/presentation\/([a-zA-Z0-9-]+)$/);
          if (incoming.protocol !== 'openid4vp:' || requestUri.origin !== origin || !match)
            return fail('Only locally generated demo requests supported');
          source = state.presentations.get(match[1]);
          if (!source) return fail('Unknown demo request', 404);
        } catch {
          return fail('Invalid authorization URL');
        }
      }
      const id = randomUUID();
      const p = {
        id,
        status: 'pending',
        recipient: 'Demo-Partnerportal',
        purpose: 'Beschäftigung für den Portalzugang bestätigen',
        requestedClaims: ['Vorname', 'Organisation'],
        nonce: randomUUID(),
        profile: source?.profile ?? (body.profile === 'combined' ? 'combined' : 'employment'),
        createdAt: stamp(),
      };
      state.presentations.set(id, p);
      return holderAlias ? json({ presentationId: id, status: 'pending' }, 201) : json(p, 201);
    }
    const item = path.match(
      /^\/api\/(offers|presentations)\/([a-zA-Z0-9-]+)(?:\/(accept|deny|confirm|candidates|approve|reject|response))?$/
    );
    if (item) {
      const [, kind, id, action] = item;
      const map = kind === 'offers' ? state.offers : state.presentations;
      const value = map.get(id);
      if (!value) return fail('Vorgang nicht gefunden', 404);
      if (method === 'GET' && !action) return json(value);
      if (kind === 'presentations' && method === 'GET' && action === 'candidates') {
        if (value.status !== 'pending') return fail('Request not pending', 409);
        return json(getCandidates(state, value));
      }
      if (kind === 'presentations' && method === 'GET' && action === 'response')
        return value.response ? json(value.response) : fail('No response yet', 404);
      if (kind === 'presentations' && method === 'POST' && action === 'reject') {
        if (value.status !== 'pending') return fail('Request not pending', 409);
        value.status = 'rejected';
        return json(value);
      }
      if (kind === 'presentations' && method === 'POST' && action === 'approve') {
        if (value.status !== 'pending') return fail('Request not pending', 409);
        let result;
        try {
          result = approveSelection(state, value, body, secret);
        } catch (error) {
          return fail(error.message, 422);
        }
        value.status = 'completed';
        value.response = result;
        value.sharedClaims = result.sharedClaims;
        value.selections = result.selections;
        value.receipt = addEvent(state, 'presentation_sent', 'Nachweis erbracht', {
          presentationId: id,
          recipient: value.recipient,
          sharedClaims: result.sharedClaims,
          selections: result.selections,
        });
        return json({ ...value, status: 'completed' });
      }

      if (method === 'POST' && action === 'deny' && kind === 'offers') {
        if (value.status !== 'received') return fail('Bereits bearbeitet', 409);
        value.status = 'denied';
        return json(value);
      }
      if (method === 'POST' && action === 'accept' && kind === 'offers') {
        if (value.status !== 'received') return fail('Bereits bearbeitet', 409);
        state.credentials.push(value.credential);
        value.status = 'accepted';
        value.receipt = addEvent(state, 'credential_received', `${value.credential.name} empfangen`, {
          credentialId: value.credential.id,
          offerId: id,
        });
        return json(value);
      }
      if (method === 'POST' && action === 'confirm' && kind === 'presentations') {
        if (value.status !== 'pending') return fail('Bereits gesendet', 409);
        let result;
        try {
          result = approveSelection(
            state,
            value,
            {
              approved: body.confirmed === true,
              selections: [{ queryId: 'employment', credentialId: body.credentialId, disclosures: body.fields }],
            },
            secret
          );
        } catch (error) {
          return fail(error.message, 400);
        }
        value.status = 'sent';
        value.response = result;
        value.sharedClaims = result.sharedClaims.employment[body.credentialId];
        value.receipt = addEvent(state, 'presentation_sent', 'Nachweis erbracht', {
          presentationId: id,
          recipient: value.recipient,
          sharedClaims: value.sharedClaims,
          selections: result.selections,
        });
        return json(value);
      }
    }
    if (path === '/api/links/resolve' && method === 'POST') {
      let uri;
      try {
        uri = new URL(body.uri);
      } catch {
        return fail('Ungültiger Link');
      }
      if (uri.origin === origin && /^\/(de|en)\/demo\/import$/.test(uri.pathname)) {
        try {
          uri = new URL(uri.searchParams.get('uri'));
        } catch {
          return fail('Wallet-Link ohne gültige Anfrage');
        }
      }
      if (uri.origin === origin) {
        const redirect = uri.pathname.match(/^\/api\/(?:mock\/)?redirect\/(offer|presentation)\/([a-zA-Z0-9-]+)$/);
        if (redirect) {
          if (!(redirect[1] === 'offer' ? state.offers : state.presentations).has(redirect[2]))
            return fail('Demo-Vorgang nicht gefunden', 404);
          return json({ path: `/de/demo/${redirect[1]}/${redirect[2]}` });
        }
      }
      const type =
        uri.protocol === 'openid4vp:' ? 'presentation' : uri.protocol === 'openid-credential-offer:' ? 'offer' : null;
      const requestUri = uri.searchParams.get(type === 'offer' ? 'credential_offer_uri' : 'request_uri');
      if (!type || !requestUri) return fail('Demo unterstützt openid4vp und openid-credential-offer Links');
      let target;
      try {
        target = new URL(requestUri);
      } catch {
        return fail('Ungültige Request-URI');
      }
      const parsed = target.pathname.match(/^\/api\/(?:mock\/)?requests\/(offer|presentation)\/([a-zA-Z0-9-]+)$/);
      if (target.origin !== origin || !parsed || parsed[1] !== type)
        return fail('Nur lokal erzeugte Demo-Links werden unterstützt');
      if (!(type === 'offer' ? state.offers : state.presentations).has(parsed[2]))
        return fail('Demo-Vorgang nicht gefunden', 404);
      return json({ path: `/de/demo/${type}/${parsed[2]}` });
    }
    return fail('Endpoint not found', 404);
  } catch {
    return fail('Mock request failed', 500);
  }
}
