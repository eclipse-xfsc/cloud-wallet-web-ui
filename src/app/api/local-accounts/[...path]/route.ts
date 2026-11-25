// Local UI fixtures only. No real account data or token validation.
export const dynamic = 'force-dynamic';
type Context = { params: { path: string[] } };
const lists = new Set([
  'plugin-discovery', 'credentials/list', 'credentials/offers/list',
  'presentations/list', 'presentations/selection/all', 'devices/list',
  'kms/did/list', 'credentials/backup/all', 'credentials/schemas',
]);
let settings = { language: 'de', historyLimit: 10 };
async function handle(request: Request, { params }: Context): Promise<Response> {
  if (process.env.LOCAL_ACCOUNT_MOCK !== 'true' || process.env.NODE_ENV !== 'development')
    return new Response('Not found', { status: 404 });
  const path = params.path.join('/');
  if (path === 'configurations/list' && request.method === 'GET') return Response.json(settings);
  if (path === 'configurations/save' && request.method === 'PUT') {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.language !== 'string' || typeof body.historyLimit !== 'number')
      return Response.json({ error: 'Invalid settings' }, { status: 400 });
    settings = { language: body.language, historyLimit: body.historyLimit };
    return Response.json(settings);
  }
  if (path === 'history/list' && request.method === 'GET') return Response.json({ events: [] });
  if (lists.has(path) && ['GET', 'POST'].includes(request.method)) return Response.json([]);
  return Response.json({ error: 'Not implemented in local login fixture', path }, { status: 404 });
}
export { handle as GET, handle as POST, handle as PUT };
