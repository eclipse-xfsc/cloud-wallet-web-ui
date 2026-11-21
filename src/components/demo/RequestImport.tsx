'use client';
import { useDemoText, translateDemoText } from './demoText';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
interface Props {
  initialUri?: string;
  onResolve: (uri: string) => Promise<void>;
}
async function decodeImage(blob: Blob, locale: string): Promise<string> {
  const tr = (text: string): string => translateDemoText(text, locale);
  if (blob.size > 5 * 1024 * 1024) throw Error(tr('Bild zu gro\u00DF (max. 5 MB).'));
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(blob.type))
    throw Error(tr('Bitte ein PNG-, JPEG-, WebP- oder GIF-Bild verwenden.'));
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width * bitmap.height > 40000000)
      throw Error(tr('Bildaufl\u00F6sung zu gro\u00DF. Bitte den QR-Code ausschneiden.'));
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw Error(tr('Bildverarbeitung nicht verf\u00FCgbar.'));
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const { default: jsQR } = await import('jsqr');
    const code = jsQR(pixels.data, pixels.width, pixels.height);
    if (!code?.data)
      throw Error(
        tr('Kein lesbarer QR-Code gefunden. Bitte einen sch\u00E4rferen Ausschnitt oder den Deep Link verwenden.')
      );
    return code.data;
  } finally {
    bitmap.close();
  }
}
export default function RequestImport({ initialUri, onResolve }: Props): JSX.Element {
  const tr = useDemoText();
  const locale = useLocale();
  const [value, setValue] = useState(initialUri ?? '');
  const [decoded, setDecoded] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const started = useRef('');
  async function run(task: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(tr(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }
  async function readImage(file: Blob): Promise<void> {
    setDecoded('');
    setDecoded(await decodeImage(file, locale));
  }
  async function readInput(input: string): Promise<void> {
    setDecoded('');
    const trimmed = input.trim();
    if (!trimmed) throw Error(tr('Bitte einen Link einf\u00FCgen.'));
    if (trimmed.startsWith('openid4vp:') || trimmed.startsWith('openid-credential-offer:')) {
      setDecoded(trimmed);
      return;
    }
    let url;
    try {
      url = new URL(trimmed);
    } catch {
      throw Error(tr('Bitte einen g\u00FCltigen Deep Link oder eine Bild-URL eingeben.'));
    }
    if (
      url.origin === window.location.origin &&
      (url.pathname.includes('/demo/import') || url.pathname.includes('/api/mock/redirect/'))
    ) {
      if (url.pathname.includes('/demo/import')) {
        const uri = url.searchParams.get('uri');
        if (!uri) throw Error(tr('Wallet-Link ohne Anfrage.'));
        setDecoded(uri);
      } else setDecoded(trimmed);
      return;
    }
    const response = await fetch(`/api/mock/qr-image?url=${encodeURIComponent(trimmed)}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('xfsc-demo-token') ?? ''}` },
    });
    if (!response.ok) {
      const result = (await response.json()) as {
        error: string;
      };
      throw Error(result.error);
    }
    await readImage(await response.blob());
  }
  useEffect(() => {
    if (initialUri && started.current !== initialUri) {
      started.current = initialUri;
      void run(async () => {
        if (initialUri.startsWith('openid4vp:') || initialUri.startsWith('openid-credential-offer:'))
          await onResolve(initialUri);
        else await readInput(initialUri);
      });
    }
  }, [initialUri]);
  return (
    <section
      tabIndex={0}
      aria-label={tr('QR-Bild hier einf\u00FCgen oder Link importieren')}
      onPaste={event => {
        const image = Array.from(event.clipboardData.items)
          .find(item => item.type.startsWith('image/'))
          ?.getAsFile();
        if (image) {
          event.preventDefault();
          void run(async () => await readImage(image));
        }
      }}
      onDragOver={event => event.preventDefault()}
      onDrop={event => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) void run(async () => await readImage(file));
      }}
    >
      <h2>{tr('Anfrage von einer anderen Website \u00F6ffnen')}</h2>
      <p>
        {tr(
          'Deep Link oder QR-Bild-URL einf\u00FCgen, eine Bilddatei hochladen oder ein kopiertes QR-Bild hier mit Strg/Cmd+V einf\u00FCgen.'
        ) + ' '}
      </p>
      <form
        onSubmit={event => {
          event.preventDefault();
          void run(async () => await readInput(value));
        }}
      >
        <label>
          {tr('Deep Link oder QR-Bild-URL') + ' '}
          <textarea
            value={value}
            onChange={event => {
              setValue(event.target.value);
              setDecoded('');
            }}
            placeholder={tr('openid4vp://\u2026 oder https://\u2026/qr.png')}
          />
        </label>
        <button
          className="wallet-button outline"
          disabled={busy}
        >
          {tr('Inhalt lesen') + ' '}
        </button>
      </form>
      <label>
        {tr('QR-Bild ausw\u00E4hlen oder hierher ziehen') + ' '}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          disabled={busy}
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) void run(async () => await readImage(file));
            event.target.value = '';
          }}
        />
      </label>
      {busy && <p role="status">{tr('Anfrage wird gelesen \u2026')}</p>}
      {error && (
        <p
          className="demo-error"
          role="alert"
        >
          {error}
        </p>
      )}
      {decoded && (
        <div className="wallet-activity">
          <h3>{tr('Erkannte Anfrage')}</h3>
          <pre>{decoded}</pre>
          <p>
            {tr(
              'Im n\u00E4chsten Schritt pr\u00FCfen Sie Empf\u00E4nger, Nachweise und offenzulegende Angaben. Hier werden noch keine Daten freigegeben.'
            ) + ' '}
          </p>
          <button
            disabled={busy}
            className="wallet-button"
            onClick={() => {
              void run(async () => await onResolve(decoded));
            }}
          >
            {tr('Anfrage pr\u00FCfen') + ' '}
          </button>
        </div>
      )}
    </section>
  );
}
