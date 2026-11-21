# Backend endpoints for the simplified wallet

This document separates the current mock API from the target production responsibilities. The UI exposes receive, present, history and a direct language selector. There is no settings screen in the current navigation; old settings routes redirect to the wallet home.

## Addressing and authentication

The tables below use `/api` as the canonical mock prefix. In the integrated demo the UI calls `/api/mock`; `npm run demo` also enables the canonical rewrite aliases. The separate mock backend serves `/api` directly.

Protected mock requests use `Authorization: Bearer <access_token>`. In production use the Keycloak-issued token and validate issuer, audience, expiry and authorization. Derive tenant and holder scope from verified identity/trusted gateway context, not an untrusted JSON field. The Holder API can be exposed under `/v1/{tenantId}/api/presentation/presentations` as described below. These routes are not all implemented by this repository's mock in a production-compatible way.

Auth URL, realm, client and public API addresses are injected into the initial page from runtime configuration. The browser does not need a preliminary `/api/keycloak-config` request to start sign-in.

## 1. Core wallet capabilities

| Method | Endpoint / capability | Purpose | Current mock | Production requirement |
| --- | --- | --- | --- | --- |
| POST | `/api/credentials` | List owned credentials with IDs, formats, display metadata and claims | Implemented | Required |
| GET | `/api/offers` | Offer inbox | Implemented | Required |
| GET | `/api/offers/{id}` | Issuer, credential preview and offer status | Implemented | Required |
| POST | `/api/offers/{id}/accept` | Receive/store credential and return receipt | Implemented, body `{}` | Required; actual issuance through issuer service |
| POST | `/api/offers/{id}/deny` | Reject an offer | Implemented, body `{}` | Required |
| GET | `/api/presentations` | List presentation requests | Implemented | Required; Holder alias filters pending requests |
| GET | `/api/presentations/{id}` | Request detail, recipient, purpose and status | Implemented | Required |
| GET | `/api/presentations/{id}/candidates` | DCQL, matching credentials and disclosure options | Implemented with suggestions | Required |
| POST | `/api/presentations/{id}/approve` | Submit explicit consent and credential/disclosure selection | Implemented | Required |
| POST | `/api/presentations/{id}/reject` | Reject a pending request | Implemented | Required |
| GET | `/api/history?type=...` | History and receipts | Implemented; `credential_received` / `presentation_sent` | Required |

`GET /api/presentations/{id}/response` exists in the mock for inspecting the generated demo response. A separate raw-response endpoint is optional in production; a receipt/status response may be sufficient.

### Candidate response used by the demo

```json
{
  "presentationId": "employment",
  "dcqlQuery": { "credentials": [], "credential_sets": [] },
  "candidates": [
    {
      "id": "employment",
      "format": "dc+sd-jwt",
      "credentials": {
        "employee-1": {
          "display": { "name": "Employee credential", "issuer": "Demo issuer" },
          "claims": { "Vorname": "Alex", "Organisation": "Example Ltd" },
          "selectiveDisclosure": true,
          "disclosureOptions": [
            { "id": "first", "path": ["Vorname"], "disclosure": "Vorname", "value": "Alex", "required": true }
          ]
        }
      }
    }
  ],
  "combinations": [["employment"]],
  "suggestedSelection": {
    "selections": [
      { "queryId": "employment", "credentialId": "employee-1", "disclosures": ["Vorname", "Organisation"] }
    ]
  }
}
```

This is a shortened shape example, not a complete executable DCQL request. The mock also returns raw credential data per candidate. `suggestedSelection`, `combinations`, display data and disclosure options are UI-oriented mock extensions; map them to the real Holder/storage service contract. A recommendation must never imply consent. Credential IDs and disclosure paths remain unchanged when display language changes.

### Approval body

```json
{
  "presentationId": "employment",
  "approved": true,
  "selections": [
    {
      "queryId": "employment",
      "credentialId": "employee-1",
      "disclosures": ["Vorname", "Organisation"]
    }
  ]
}
```

The backend must re-resolve candidates and enforce query membership, permitted disclosure paths, required claim sets, valid combinations, supported multiplicity and request status. It must not accept the preview as authority. Only selected SD-JWT disclosures are included; LDP VC is shared in full with a visible warning. The mock rejects non-empty `claimIds` because the locally supplied signer contract expects `disclosures`.

### Holder service route mapping

| Mock convenience route | Holder-style route |
| --- | --- |
| `GET/POST /api/presentations` | `GET/POST /v1/{tenantId}/api/presentation/presentations` |
| `GET /api/presentations/{id}` | `GET /v1/{tenantId}/api/presentation/presentations/{id}` |
| `GET .../{id}/candidates` | `GET .../{id}/candidates` |
| `POST .../{id}/approve` | `POST .../{id}/approve` |
| `POST .../{id}/reject` | `POST .../{id}/reject` |

The local mock exposes the versioned alias only for tenant `demo`. The real local Holder source additionally requires trusted gateway context (`x-groupid`, `x-namespace`, `x-group`, and consistent tenant context) and a signing identity. The mock does not implement that gateway authorization model. It also returns JSON for rejection, whereas the real Holder may return HTTP 204; a production adapter must handle empty success responses.

## 2. Third-party intake and import

| Method | Endpoint / capability | Purpose | Current mock | Production requirement |
| --- | --- | --- | --- | --- |
| POST | Holder `.../presentations` | Intake of OID4VP URL with `consentMode: "manual"` | Holder alias accepts only locally generated request URIs | Required for real external request intake |
| POST | `/api/offers` or dedicated offer-intake service | Intake of a credential offer URI/object | Existing POST only generates fake offers using `{format}` | Real intake adapter still needed; do not treat mock creation as protocol intake |
| POST | `/api/links/resolve` | Dispatch imported URI to a local review page | Implemented for known local demo requests and wallet wrappers | Optional convenience adapter; equivalent dispatch can live in the UI/service layer |
| GET | `/api/qr-image?url=...` | Load QR image when cross-origin image access needs a proxy | Authenticated, source allowlist, no redirect following, size/time limits | Optional; image-file/clipboard QR decoding runs in the browser |

A third-party site links to `/{locale}/demo/import?uri=<encoded request>` in the mock. This is a UI entry route, not an additional backend API. Sign-in preserves the target and query. Deep-link text, image URL, upload, drag/drop and clipboard image all converge on request review. Neither parsing nor redirection is approval.

For real OID4VP intake, fetch and verify the external Request Object through the trusted Holder service, including verifier identity, request integrity, audience/nonce and expiry. The mock does not implement those production checks or submit to a real external verifier. The metadata `response_uri`/issuer endpoints belong to the verifier/issuer, not automatically to the wallet backend.

## 3. Language and configuration

| Method | Endpoint | Current usage | Required? |
| --- | --- | --- | --- |
| GET | `/api/configuration` | Public mock capability summary | Optional; deployment config is already embedded in the page |
| GET | `/api/configuration/user` | Mock user preferences | Optional; current UI no longer fetches this for a settings page |
| PUT | `/api/configuration/language` | `{ "language": "de" }` or `en`; best-effort save from header for signed-in mock user | Optional persistence; switch itself is immediate via route and locale cookie |
| GET | `/api/keycloak-config` | Compatibility route retained by the Next.js server | Not required by the sign-in flow |

The header switch is present on landing, login and wallet screens. It preserves the current route, opaque request URI and localized `next` destination. Real wallet language selection currently persists locally in `NEXT_LOCALE`; it does not call the legacy user settings save API. Production account-level synchronization can use the language endpoint above if desired. Stored credentials and raw protocol payloads are not translated.

## 4. Authentication: mock versus real Keycloak

| Method | Mock endpoint | Purpose | Production equivalent |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | demo/demo -> signed JWT | Keycloak authorization/token flow; no wallet password endpoint required |
| POST | `/api/auth/logout` | Revoke mock session | Keycloak logout/session flow |
| GET | `/api/auth/verify` | Required mock navigation guard before opening protected/redirected requests | Production equivalent: valid Keycloak session plus backend authorization; separate verification endpoint depends on architecture |

The settings page and its JWT-test button have been removed from the UI. Verification remains enforced by the backend for every protected request.

## 5. Demo-only issuer, verifier and link-generation helpers

These are not additional requirements for a production wallet backend:

- `POST /api/offers` with `{format: "ldp_vc"}` or `{}`: generate a sample offer.
- `POST /api/presentations` with `{profile: "combined"}` or `{}`: generate a sample presentation request.
- `GET /api/redirect/offer/{id}` and `/api/redirect/presentation/{id}`: optional HTTP 302 helpers; the partner site can link directly to the wallet import UI instead.
- `GET /api/requests/offer/{id}` and `/api/requests/presentation/{id}`: local stand-ins for external issuer/verifier request resources.
- `GET /api/issuer-metadata` / `/.well-known/openid-credential-issuer`, `POST /api/nonce`, `POST /api/credential`: illustrative issuer-side mocks.
- `GET /qr/presentation.png`, `/qr/offer.png` on the partner site: QR-image generation for testing, not wallet APIs.
- `POST /api/presentations/{id}/confirm`: legacy mock adapter; new UI uses `approve`.

## Error and receipt behavior

- 401: missing/expired/invalid token -> re-authentication, keeping the request target.
- 404: unknown or inaccessible transaction.
- 409: transaction already processed/not pending.
- 422: invalid credential/disclosure selection (the mock's legacy confirm adapter uses 400).
- 413: imported QR image too large.

Successful receipt/presentation processing should return a stable transaction/receipt ID, timestamp, status and the actual shared/received credential references. Record `credential_received` and `presentation_sent` only after successful processing. Preserve consent, issuer/verifier identity and disclosure selection for the history. Never include access tokens in redirects or disclose credentials merely because a URI was opened.

## 6. Existing Keycloak UI: legacy Account Service adapter still required

The modern contract above is implemented by the simplified **mock UI**. The existing non-mock Keycloak wallet still uses its original Account Service pages beneath the new navigation. It is not yet a drop-in client for the new Holder `candidates/approve` contract. Until those pages are migrated, its actual additional calls (relative to `WALLET_ACCOUNT_SERVICE_URL`) are:

| Method | Relative endpoint | Purpose |
| --- | --- | --- |
| GET | `/configurations/list` | Bootstrap configuration/history limit; stored language no longer overrides explicit UI locale |
| PUT | `/configurations/save` | Existing bootstrap fallback if configuration loading fails |
| GET | `/plugin-discovery` | Existing bootstrap plugin discovery |
| POST | `/credentials/list` | Credential list/search (`{search}`) |
| GET | `/credentials/offers/list` | Offers |
| PUT | `/credentials/offers/create` | Import offer (`{credential_offer}`) |
| POST | `/credentials/offers/{id}/accept` | Accept using `{keyId}` |
| POST | `/credentials/offers/{id}/deny` | Reject offer |
| GET | `/presentations/selection/all` | Legacy presentation request list |
| GET | `/presentations/selection/{id}` | Legacy matching credentials |
| POST | `/presentations/proof/{id}` | Legacy proof (`{signKeyId, filters}`), not the modern consent API |
| GET | `/presentations/list` | Legacy sent presentations |
| GET | `/history/list` | Legacy history (`{events:[...]}`) |
| GET | `/kms/did/list` | Existing DID selector used for receiving/presenting |

Do not expose the legacy proof endpoint as a substitute for the real Holder manual-consent API. Migrate the production UI to `candidates` + `approve`, or add a contract-aware adapter that preserves selection validation and consent. Backup, devices, DID administration and plugin-management pages remain in the source as legacy routes, but are not part of the simplified navigation or the core endpoint list.

## Credential listing: POST contract

Use `POST /api/credentials` (integrated UI: `/api/mock/credentials`) with a JSON body:

```json
{
  "filter": {
    "search": "Alex",
    "format": "dc+sd-jwt",
    "issuer": "XFSC Demo-Aussteller"
  }
}
```

All filter fields are optional; `{ "filter": {} }` returns all credentials belonging to the authenticated account. Filters are combined with AND. Search is case-insensitive across display name, issuer and claim values; format and issuer match exactly. Unknown filter fields or non-string filter values return 400. GET is no longer supported and returns 405 with `Allow: POST` for an authenticated request. The response remains an array of credentials. The legacy real Account Service already uses `POST /credentials/list`; it is unchanged.

See [Redirect routes and Bearer-token boundaries](redirect-routes.md) for the external website -> login -> review flow and public/authenticated endpoint distinction.
