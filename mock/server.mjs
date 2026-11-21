import { createServer } from 'node:http';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { handleMockRequest } = await import('./backend.mjs');
const host = process.env.MOCK_HOST || '127.0.0.1',
  port = Number(process.env.MOCK_PORT || 4100);
const server = createServer(async (req, res) => {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1048576) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const origin = `http://${host}:${port}`;
    const request = new Request(new URL(req.url, origin), {
      method: req.method,
      headers: req.headers,
      ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(chunks) } : {}),
    });
    const response = await handleMockRequest(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500).end('Mock server error');
  }
});
server.listen(port, host, () => console.log(`Demo backend: http://${host}:${port}/api/configuration (demo / demo)`));
