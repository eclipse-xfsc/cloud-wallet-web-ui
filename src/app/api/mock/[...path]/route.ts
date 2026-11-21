import { handleMockRequest } from '../../../../../mock/backend.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handler(request: Request): Promise<Response> {
  if (process.env.MOCK_MODE !== 'true') return new Response('Not found', { status: 404 });
  return await handleMockRequest(request);
}
export { handler as GET, handler as POST, handler as PUT };
