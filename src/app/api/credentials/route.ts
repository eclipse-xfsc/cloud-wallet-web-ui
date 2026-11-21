import { handleMockRequest } from '../../../../mock/backend.mjs';

// Canonical mock listing endpoint; no public GET fixture remains.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request): Promise<Response> {
  if (process.env.MOCK_MODE !== 'true') return new Response('Not found', { status: 404 });
  return await handleMockRequest(request);
}
