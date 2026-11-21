import 'server-only';
import type { KeycloakConfig } from './types';

/** Only these public OIDC fields cross the server/client boundary. */
export function readRuntimeAuthConfig(): KeycloakConfig | null {
  if (process.env.MOCK_MODE === 'true')
    return { baseUrl: '/api/mock', auth: '/api/mock', realm: 'demo', clientId: 'wallet-demo', mock: true };
  const auth = (process.env.KEYCLOAK_AUTH_URL ?? process.env.KEYCLOAK_BASE_URL)?.trim().replace(/\/+$/, '');
  const realm = process.env.KEYCLOAK_REALM?.trim();
  const clientId = process.env.KEYCLOAK_CLIENT_ID?.trim();
  if (!auth || !realm || !clientId) return null;
  try {
    const url = new URL(auth);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
      return null;
  } catch {
    return null;
  }
  return { baseUrl: auth, auth, realm, clientId };
}
