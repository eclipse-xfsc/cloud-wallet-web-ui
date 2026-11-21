# Redirect and request-import routes

## Third-party website -> wallet

The partner button is a normal browser link to:

```text
http://localhost:3000/de/demo/import?uri=<URL-encoded OID4VP or credential-offer link>
```

The UI route `/[locale]/demo/import` reads `uri`. If no session exists, it navigates to `/[locale]/demo/login?next=<encoded original path and query>`. Successful sign-in returns to that local `next` destination. The importer then submits the decoded link to authenticated `POST /api/mock/links/resolve` and opens the returned review-page path.

No Authorization header is expected on the initial browser navigation. Tokens are never included in the `uri` or `next` URL parameters.

## Optional HTTP 302 helpers

| Public GET endpoint | Location |
| --- | --- |
| `/api/mock/redirect/presentation/{id}?lang=de` | `/de/demo/presentation/{id}` |
| `/api/mock/redirect/offer/{id}?lang=de` | `/de/demo/offer/{id}` |

`lang=en` selects `/en`. These helpers return HTTP 302. They do not receive, store or present credentials. They are optional when a third-party page already links directly to the import UI.

## Deep links, QR-image files and QR-image URLs

The browser decodes uploaded/pasted images locally. An image URL is fetched through authenticated `GET /api/mock/qr-image?url=...`; that proxy does not forward the wallet Bearer token to the image source. After decoding, the importer uses `POST /api/mock/links/resolve` with the wallet token.

The resolver returns JSON `{path:"/de/demo/presentation/..."}` or an offer path; navigation is performed by the UI, not HTTP 302. Invalid links show an error and do not trigger approval.

## Which calls carry a Bearer token?

All protected mock wallet API calls carry the current `Authorization: Bearer <access_token>`: credential listing, offers, presentation candidates/approval/rejection, history, link resolution, image proxy and signed-in language preference updates. The backend verifies the token for each protected call.

Public requests have no authentication requirement: initial pages/browser redirects, demo sign-in, public configuration, issuer metadata, nonce and request-object fixtures, and partner QR images. Sign-in explicitly omits any old token. A native link or HTTP 302 cannot attach the custom Bearer header used by fetch calls; authorization is checked when the loaded wallet page calls its protected APIs.

The normal Keycloak branch supplies its token explicitly at protected Account Service call sites. The generic fetch helper does not automatically attach a token to arbitrary URLs. In particular, no wallet token is forwarded to third-party QR-image hosts or included in browser redirect URLs.


### Authentication guard before opening redirected requests

Protected demo pages verify the stored token with authenticated `GET /api/mock/auth/verify` before loading wallet data or mounting the import/consent UI. A missing token skips the verification call and opens sign-in directly. A 401/403, expired token or revoked session clears the local token and navigates to `/{locale}/demo/login?next=<encoded original path, query and fragment>`. Successful sign-in resumes that internal destination; external targets and login loops are refused. Valid sessions proceed without another sign-in. Token expiry schedules a fresh check even while the page is idle.

Temporary backend/network failures show a retry action without destroying the session or opening request data. Later protected API calls still enforce authorization and can trigger the same reauthentication flow. The real Keycloak wallet retains its SDK-based login interceptor; the explicit JWT verification guard described here is part of the local mock UI.
