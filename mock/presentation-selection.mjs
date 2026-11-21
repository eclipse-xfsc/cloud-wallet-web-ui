import { createHash, createHmac, randomUUID } from 'node:crypto';
const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url');
export function queryFor(presentation) {
  const employment = {
    id: 'employment',
    multiple: true,
    format: 'dc+sd-jwt',
    meta: { vct_values: ['urn:demo:employee'] },
    claims: [
      { id: 'first', path: ['Vorname'] },
      { id: 'org', path: ['Organisation'] },
      { id: 'last', path: ['Nachname'] },
    ],
    claim_sets: [
      ['first', 'org'],
      ['first', 'org', 'last'],
    ],
  };
  if (presentation.profile === 'combined')
    return {
      credentials: [
        employment,
        { id: 'training', format: 'ldp_vc', claims: [{ id: 'qualification', path: ['Qualifikation'] }] },
      ],
      credential_sets: [{ options: [['employment', 'training'], ['employment']] }],
    };
  return { credentials: [employment], credential_sets: [{ options: [['employment']] }] };
}
export function getCandidates(state, presentation) {
  const dcqlQuery = queryFor(presentation);
  const candidates = dcqlQuery.credentials.map(query => {
    const minClaims = query.claim_sets?.reduce((a, b) => (a.length <= b.length ? a : b)) ?? query.claims.map(c => c.id);
    const credentials = Object.fromEntries(
      state.credentials
        .filter(
          c =>
            c.format === query.format &&
            query.claims.filter(f => minClaims.includes(f.id)).every(f => f.path[0] in c.claims)
        )
        .map(c => [
          c.id,
          {
            data: c.raw,
            type: c.format,
            display: { name: c.name, issuer: c.issuer },
            claims: c.claims,
            disclosureOptions: query.claims
              .filter(f => f.path[0] in c.claims)
              .map(f => ({
                id: f.id,
                path: f.path,
                disclosure: f.path.join('.'),
                value: c.claims[f.path[0]],
                required: minClaims.includes(f.id),
              })),
            selectiveDisclosure: c.format === 'dc+sd-jwt',
          },
        ])
    );
    return { id: query.id, format: query.format, credentials };
  });
  const combinations = dcqlQuery.credential_sets[0].options.filter(option =>
    option.every(id => Object.keys(candidates.find(c => c.id === id).credentials).length)
  );
  const recommended = [...combinations].sort((a, b) => a.length - b.length)[0] ?? [];
  const selections = recommended.map(queryId => {
    const group = candidates.find(c => c.id === queryId),
      [credentialId, c] = Object.entries(group.credentials)[0];
    return {
      queryId,
      credentialId,
      disclosures: group.format === 'ldp_vc' ? [] : c.disclosureOptions.filter(f => f.required).map(f => f.disclosure),
    };
  });
  return {
    dcqlQuery,
    candidates,
    combinations,
    suggestedSelection: { selections },
    selectionVersion: 1,
    selectionSource: 'mock-extension',
    presentationId: presentation.id,
  };
}
export function approveSelection(state, presentation, body, signingSecret) {
  if (presentation.status !== 'pending') throw Error('Request is not pending');
  if (body.approved !== true) throw Error('Explicit approval required');
  if (body.presentationId && body.presentationId !== presentation.id) throw Error('Presentation ID mismatch');
  if (!Array.isArray(body.selections) || !body.selections.length) throw Error('Empty selection');
  const result = getCandidates(state, presentation),
    seen = new Set(),
    queries = new Set();
  const vp_token = {},
    sharedClaims = {},
    normalized = [];
  for (const selection of body.selections) {
    const { queryId, credentialId, disclosures } = selection;
    if (selection.claimIds?.length) throw Error('Use disclosures, not claimIds: signer selection contract');
    const group = result.candidates.find(g => g.id === queryId),
      candidate = group?.credentials[credentialId];
    if (!candidate) throw Error('Unknown query or credential');
    if (queries.has(queryId) && !result.dcqlQuery.credentials.find(q => q.id === queryId).multiple)
      throw Error('Multiple credentials not allowed for this query');
    if (seen.has(`${queryId}/${credentialId}`)) throw Error('Duplicate credential selection');
    seen.add(`${queryId}/${credentialId}`);
    queries.add(queryId);
    if (!Array.isArray(disclosures) || new Set(disclosures).size !== disclosures.length)
      throw Error('Invalid disclosures');
    const cred = state.credentials.find(c => c.id === credentialId);
    let disclosed, presentationToken;
    if (group.format === 'ldp_vc') {
      if (disclosures.length) throw Error('LDP VC does not support selective disclosure');
      disclosed = { ...cred.claims };
      presentationToken = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: 'did:example:demo-holder',
        verifiableCredential: [cred.raw],
        proof: {
          type: 'DemoProof',
          challenge: presentation.nonce,
          domain: presentation.recipient,
          proofValue: 'DEMO-NOT-A-VALID-LDP-PROOF',
        },
      };
    } else {
      const allowed = candidate.disclosureOptions.map(f => f.disclosure);
      if (disclosures.some(d => !allowed.includes(d))) throw Error('Disclosure not requested or not available');
      const query = result.dcqlQuery.credentials.find(q => q.id === queryId);
      const selectedIds = candidate.disclosureOptions.filter(f => disclosures.includes(f.disclosure)).map(f => f.id);
      if (!(query.claim_sets ?? [query.claims.map(c => c.id)]).some(set => set.every(id => selectedIds.includes(id))))
        throw Error('Required claims missing');
      disclosed = Object.fromEntries(disclosures.map(d => [d, cred.claims[d]]));
      const [jwt, ...all] = cred.raw.split('~');
      const selectedDisclosures = all
        .filter(Boolean)
        .filter(d => disclosures.includes(JSON.parse(Buffer.from(d, 'base64url'))[1]));
      const sdjwt = `${jwt}~${selectedDisclosures.join('~')}~`;
      const kb = `${encode({ typ: 'kb+jwt', alg: 'HS256' })}.${encode({
        aud: presentation.recipient,
        nonce: presentation.nonce,
        iat: Math.floor(Date.now() / 1000),
        sd_hash: createHash('sha256').update(sdjwt).digest('base64url'),
      })}`;
      presentationToken = sdjwt + kb + '.' + createHmac('sha256', signingSecret).update(kb).digest('base64url');
    }
    (vp_token[queryId] ??= []).push(presentationToken);
    (sharedClaims[queryId] ??= {})[credentialId] = disclosed;
    normalized.push({ queryId, credentialId, disclosures: [...disclosures] });
  }
  if (!result.combinations.some(option => option.length === queries.size && option.every(id => queries.has(id))))
    throw Error('Invalid DCQL query combination');
  return {
    vp_token,
    state: presentation.id,
    nonce: presentation.nonce,
    selections: normalized,
    sharedClaims,
    demo: true,
    transactionId: randomUUID(),
  };
}
