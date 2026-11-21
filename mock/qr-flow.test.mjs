import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { merchantLinks, merchantRequest } from './merchant.mjs';
import { fetchQrImage } from './qr-image.mjs';
import { handleMockRequest } from './backend.mjs';
const wallet = 'http://localhost:3000';
test('third-party redirect preserves deep link; generated QR can be decoded and resolved', async () => {
  for (const type of ['presentation', 'offer']) {
    const links = merchantLinks(type, wallet);
    const redirect = new URL(links.wallet);
    assert.equal(redirect.origin, wallet);
    assert.equal(redirect.pathname, '/de/demo/import');
    assert.equal(redirect.searchParams.get('uri'), links.uri);
    const qr = QRCode.create(links.uri, { errorCorrectionLevel: 'M' });
    const scale = 6,
      margin = 4,
      width = (qr.modules.size + 2 * margin) * scale;
    const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
    for (let y = 0; y < width; y++)
      for (let x = 0; x < width; x++) {
        const col = Math.floor(x / scale) - margin,
          row = Math.floor(y / scale) - margin;
        if (row >= 0 && col >= 0 && row < qr.modules.size && col < qr.modules.size && qr.modules.get(row, col)) {
          const at = (y * width + x) * 4;
          pixels[at] = pixels[at + 1] = pixels[at + 2] = 0;
        }
      }
    assert.equal(jsQR(pixels, width, width).data, links.uri);
    const png = await merchantRequest(new Request(`http://localhost:4101/qr/${type}.png`));
    assert.equal(png.headers.get('content-type'), 'image/png');
    const bytes = new Uint8Array(await png.arrayBuffer());
    assert.deepEqual(Array.from(bytes.slice(0, 4)), [137, 80, 78, 71]);
    const session = await (
      await handleMockRequest(
        new Request(wallet + '/api/mock/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: 'demo', password: 'demo' }),
        })
      )
    ).json();
    const result = await handleMockRequest(
      new Request(wallet + '/api/mock/links/resolve', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ uri: links.uri }),
      })
    );
    assert.equal(result.status, 200);
    assert((await result.json()).path.includes(`/demo/${type}/`));
    const wrapped = await handleMockRequest(
      new Request(wallet + '/api/mock/links/resolve', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ uri: links.wallet }),
      })
    );
    assert.equal(wrapped.status, 200);
    assert((await wrapped.json()).path.includes(`/demo/${type}/`));
  }
});
test('image URL proxy allows configured sources, rejects unknown sources and redirects, bounds image size', async () => {
  let calls = 0;
  const fake = async () => {
    calls++;
    return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } });
  };
  const request = url => new Request(wallet + '/api/mock/qr-image?url=' + encodeURIComponent(url));
  assert.equal((await fetchQrImage(request('http://localhost:4101/qr/presentation.png'), fake)).status, 200);
  assert.equal((await fetchQrImage(request('http://169.254.169.254/metadata'), fake)).status, 400);
  assert.equal(calls, 1);
  assert.equal(
    (
      await fetchQrImage(
        request('http://localhost:4101/a'),
        async () => new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254' } })
      )
    ).status,
    400
  );
  assert.equal(
    (
      await fetchQrImage(
        request('http://localhost:4101/a'),
        async () => new Response('not an image', { headers: { 'Content-Type': 'text/html' } })
      )
    ).status,
    400
  );
  assert.equal(
    (
      await fetchQrImage(
        request('http://localhost:4101/a'),
        async () =>
          new Response('', { headers: { 'Content-Type': 'image/png', 'Content-Length': String(6 * 1024 * 1024) } })
      )
    ).status,
    413
  );
});
