import { createServer } from 'node:http';
import QRCode from 'qrcode';
export function merchantLinks(type = 'presentation', wallet = process.env.MOCK_WALLET_URL || 'http://localhost:3000') {
  const base = new URL(wallet).origin;
  const id = type === 'offer' ? 'welcome' : 'employment';
  const uri =
    type === 'offer'
      ? `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(`${base}/api/mock/requests/offer/${id}`)}`
      : `openid4vp://authorize?request_uri=${encodeURIComponent(`${base}/api/mock/requests/presentation/${id}`)}`;
  return { uri, wallet: `${base}/de/demo/import?uri=${encodeURIComponent(uri)}` };
}
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
export async function merchantRequest(request) {
  const url = new URL(request.url);
  if (['/qr/presentation.png', '/qr/offer.png'].includes(url.pathname))
    return new Response(
      await QRCode.toBuffer(merchantLinks(url.pathname.includes('offer') ? 'offer' : 'presentation').uri, {
        width: 420,
        margin: 4,
        errorCorrectionLevel: 'M',
      }),
      { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } }
    );
  if (url.pathname !== '/') return new Response('Not found', { status: 404 });
  const type = url.searchParams.get('type') === 'offer' ? 'offer' : 'presentation';
  const links = merchantLinks(type);
  const image = `${url.origin}/qr/${type}.png`;
  return new Response(
    `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demo-Partnerportal</title><style>body{font:18px system-ui;background:#f5f6fa;color:#17213e;max-width:900px;margin:40px auto;padding:24px}section{background:white;padding:30px;border-radius:12px}a{color:#000094}img{max-width:100%;width:300px}textarea,input{display:block;width:100%;box-sizing:border-box;font:inherit;padding:12px;margin:12px 0}button,.primary{display:inline-block;background:#000094;color:white;padding:14px;border:0;border-radius:8px;font:inherit;text-decoration:none}.label{background:#fff1bb;padding:10px}</style><header><h1>Demo-Partnerportal</h1><p class="label">Simulierte Drittwebsite · separate Website auf Port ${
      url.port
    }</p></header><section><h2>${
      type === 'offer' ? 'Nachweis erhalten' : 'Beschäftigung nachweisen'
    }</h2><p>Öffnen Sie Ihre Web-Wallet oder importieren Sie den QR-Code dort.</p><p><a class="primary" href="${escape(
      links.wallet
    )}">Mit meiner Wallet fortfahren</a></p><img src="/qr/${type}.png" alt="QR-Code mit ${
      type === 'offer' ? 'Credential-Offer' : 'OID4VP'
    } Deep Link"><p><a href="/qr/${type}.png" download="demo-${type}-qr.png">QR-Bild herunterladen</a> · <a href="/qr/${type}.png">QR-Bild öffnen / Bild kopieren</a></p><label>QR-Bild-URL<input readonly value="${escape(
      image
    )}"></label><label>Deep Link<textarea readonly rows="5">${escape(
      links.uri
    )}</textarea></label><p>In der Wallet: „Anfrage importieren“ öffnen und Bild-URL, Deep Link oder ein kopiertes QR-Bild einfügen. Die Anfrage wird geprüft; es werden noch keine Daten freigegeben.</p><p><a href="/?type=${
      type === 'offer' ? 'presentation' : 'offer'
    }">${type === 'offer' ? 'Präsentationsanfrage zeigen' : 'Nachweisangebot zeigen'}</a></p></section></html>`,
    { headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}
export function startMerchant() {
  const port = Number(process.env.MOCK_MERCHANT_PORT || 4101),
    host = process.env.MOCK_MERCHANT_HOST || 'localhost';
  const server = createServer(async (req, res) => {
    try {
      const response = await merchantRequest(new Request(new URL(req.url, `http://localhost:${port}`)));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500).end('Merchant demo error');
    }
  });
  server.listen(port, host, () =>
    console.log(
      `Drittwebsite: http://localhost:${port} (Wallet: ${process.env.MOCK_WALLET_URL || 'http://localhost:3000'})`
    )
  );
  return server;
}
