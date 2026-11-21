const limit = 5 * 1024 * 1024;
export async function fetchQrImage(request, fetcher = fetch) {
  const query = new URL(request.url);
  let image;
  try {
    image = new URL(query.searchParams.get('url'));
  } catch {
    return Response.json({ error: 'Ungültige Bild-URL' }, { status: 400 });
  }
  const allowed = new Set([
    query.origin,
    ...(process.env.MOCK_IMAGE_ORIGINS || 'http://localhost:4101')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  ]);
  if (!['http:', 'https:'].includes(image.protocol) || image.username || image.password || !allowed.has(image.origin))
    return Response.json(
      { error: 'Bildquelle nicht freigegeben. Bild herunterladen und in der Wallet hochladen oder einfügen.' },
      { status: 400 }
    );
  try {
    const response = await fetcher(image, {
      redirect: 'manual',
      headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif' },
      signal: AbortSignal.timeout(8000),
    });
    const type = response.headers.get('content-type')?.split(';')[0];
    if (!response.ok || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type))
      return Response.json({ error: 'Die URL liefert kein unterstütztes QR-Bild.' }, { status: 400 });
    if (Number(response.headers.get('content-length')) > limit)
      return Response.json({ error: 'Bild zu groß (max. 5 MB).' }, { status: 413 });
    const reader = response.body?.getReader();
    if (!reader) throw Error('Missing image');
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return Response.json({ error: 'Bild zu groß (max. 5 MB).' }, { status: 413 });
      }
      chunks.push(value);
    }
    return new Response(Buffer.concat(chunks), { headers: { 'Content-Type': type, 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      { error: 'Bild konnte nicht geladen werden. Bitte die Datei direkt einfügen oder hochladen.' },
      { status: 400 }
    );
  }
}
