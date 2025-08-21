import type { KeycloakConfig } from '@/service/types';

export function GET(req: Request, res: Response): Response {
  return new Response(
    JSON.stringify({
      baseUrl: process.env.KEYCLOAK_BASE_URL ?? 'http://localhost:8081',
      auth: process.env.KEYCLOAK_AUTH_URL ?? process.env.KEYCLOAK_BASE_URL ?? 'http://localhost:8081',
      realm: process.env.KEYCLOAK_REALM ?? 'react-keycloak',
      clientId: process.env.KEYCLOAK_CLIENT_ID ?? 'react-keycloak',
    } satisfies KeycloakConfig),
    {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    }
  );
}
