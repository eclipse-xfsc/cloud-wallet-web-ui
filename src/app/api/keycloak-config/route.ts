import { readRuntimeAuthConfig } from '@/service/runtimeAuthConfig';

// Compatibility endpoint. The UI receives these values in its initial server render.
export const dynamic = 'force-dynamic';
export function GET(): Response {
  const config = readRuntimeAuthConfig();
  return Response.json(config ?? { error: 'Missing or invalid Keycloak configuration.' }, {
    status: config ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
