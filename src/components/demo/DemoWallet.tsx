'use client';
import { useDemoText } from './demoText';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { verifyDemoSession, demoLoginLocation, demoReturnLocation, type DemoSessionCheck } from '@/service/demoSession';
import QRCode from 'react-qr-code';
import Icon from '@/components/wallet-ui/Icon';
import PresentationConsent from './PresentationConsent';
import RequestImport from './RequestImport';
import LanguageSwitch from '@/components/wallet-ui/LanguageSwitch';
interface Credential {
  id: string;
  name: string;
  format: string;
  issuer: string;
  issuedAt: string;
  claims: Record<string, string>;
  raw: string | object;
}
interface Receipt {
  id: string;
  timestamp: string;
}
interface Offer {
  id: string;
  status: string;
  credential: Credential;
  receipt?: Receipt;
}
interface Presentation {
  id: string;
  status: string;
  recipient: string;
  purpose: string;
  requestedClaims: string[];
  sharedClaims?: Record<string, string>;
  receipt?: Receipt;
}
interface HistoryEvent {
  id: string;
  timestamp: string;
  type: string;
  event: string;
  recipient?: string;
}
interface Session {
  access_token: string;
}
interface LinkResult {
  path: string;
}
const tokenKey = 'xfsc-demo-token';
function CredentialCard({ credential }: { credential: Credential }): JSX.Element {
  const tr = useDemoText();
  return (
    <article className="demo-card">
      <span className="demo-tag">
        {tr('TESTDATEN \u00B7') + ' '}
        {credential.format}
      </span>
      <h2>{tr(credential.name)}</h2>
      <p>{credential.issuer}</p>
      <dl>
        {Object.entries(credential.claims).map(([key, value]) => (
          <div key={key}>
            <dt>{tr(key)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary>{tr('Rohdaten ansehen')}</summary>
        <pre>{typeof credential.raw === 'string' ? credential.raw : JSON.stringify(credential.raw, null, 2)}</pre>
      </details>
    </article>
  );
}
export default function DemoWallet({ path }: { path: string[] }): JSX.Element {
  const tr = useDemoText();
  const locale = useLocale();
  const t = useTranslations('SimpleWallet');
  const router = useRouter();
  const leaving = useRef(false);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const target = `${pathname}${search ? `?${search}` : ''}`;
  const base = `/${locale}/demo`;
  const view = path[0] ?? 'home';
  const id = path[1];
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState<{ token: string | null; target: string; result: DemoSessionCheck } | null>(
    null
  );
  const [checkAttempt, setCheckAttempt] = useState(0);
  const sessionValid = checked?.token === token && checked?.target === target && checked.result.status === 'valid';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [uri, setUri] = useState('');
  const [filter, setFilter] = useState('');
  const [origin, setOrigin] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [links, setLinks] = useState<{
    type: string;
    id: string;
  } | null>(null);
  async function api<T>(endpoint: string, method = 'GET', body?: object): Promise<T> {
    const currentToken = endpoint === '/auth/login' ? null : sessionStorage.getItem(tokenKey);
    const response = await fetch(`/api/mock${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });
    const data = (await response.json()) as T & {
      error?: string;
    };
    if (!response.ok) {
      if (response.status === 401 && endpoint !== '/auth/login' && sessionStorage.getItem(tokenKey) === currentToken) {
        sessionStorage.removeItem(tokenKey);
        setToken(null);
        setChecked(null);
        router.replace(
          demoLoginLocation(base, window.location.pathname + window.location.search + window.location.hash)
        );
      }
      throw new Error(data.error ?? tr('Anfrage fehlgeschlagen'));
    }
    return data;
  }
  useEffect(() => {
    setOrigin(window.location.origin);
    setToken(sessionStorage.getItem(tokenKey));
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || view === 'login' || leaving.current) return;
    let active = true;
    const controller = new AbortController();
    let expiry: ReturnType<typeof setTimeout> | undefined;
    void verifyDemoSession(token, controller.signal).then(result => {
      if (!active) return;
      setChecked({ token, target, result });
      if (result.status === 'anonymous') {
        sessionStorage.removeItem(tokenKey);
        setToken(null);
        router.replace(demoLoginLocation(base, target + window.location.hash));
      } else if (result.status === 'valid') {
        expiry = setTimeout(
          () => {
            setChecked(null);
            setCheckAttempt(n => n + 1);
          },
          Math.min(2147483647, Math.max(0, result.expiresAt * 1000 - Date.now()))
        );
      }
    });
    return () => {
      active = false;
      controller.abort();
      if (expiry) clearTimeout(expiry);
    };
  }, [ready, token, target, view, checkAttempt]);
  useEffect(() => {
    if (!ready) return;
    if (view === 'settings') {
      router.replace(base);
      return;
    }
    if (view === 'login' || !sessionValid) return;
    let active = true;
    setError('');
    setBusy(true);
    Promise.all([
      api<Credential[]>('/credentials', 'POST', { filter: {} }),
      api<Offer[]>('/offers'),
      api<Presentation[]>('/presentations'),
      api<HistoryEvent[]>('/history'),
    ])
      .then(([c, o, p, h]) => {
        if (active) {
          setCredentials(c);
          setOffers(o);
          setPresentations(p);
          setHistory(h);
        }
      })
      .catch(e => {
        if (active) setError(tr(e instanceof Error ? e.message : String(e)));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [ready, token, view, id, refresh, sessionValid, target]);
  useEffect(() => {
    setError('');
  }, [view, id]);
  async function action(task: () => Promise<void>): Promise<void> {
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
  const offer = offers.find(o => o.id === id);
  const presentation = presentations.find(p => p.id === id);
  const nav = [
    ['', t('start')],
    ['presentation', t('send')],
    ['offer', t('receive')],
    ['history', t('history')],
    ['import', tr('Anfrage importieren')],
    ['links', 'Demo-Links'],
  ];
  const redirectLink = links ? `${origin}/api/mock/redirect/${links.type}/${links.id}?lang=${locale}` : '';
  const deepLink = links
    ? `${links.type === 'offer' ? 'openid-credential-offer://' : 'openid4vp://authorize'}?${
        links.type === 'offer' ? 'credential_offer_uri' : 'request_uri'
      }=${encodeURIComponent(`${origin}/api/mock/requests/${links.type}/${links.id}`)}`
    : '';
  if (!ready)
    return (
      <p
        className="wallet-width wallet-main"
        role="status"
      >
        {tr('Demo wird geladen \u2026') + ' '}
      </p>
    );
  if (view !== 'login' && !sessionValid) {
    const unavailable =
      checked?.token === token && checked?.target === target && checked.result.status === 'unavailable';
    return (
      <div className="wallet-app">
        <header className="wallet-top">
          <Link
            className="wallet-brand"
            href={`/${locale}`}
          >
            XFSC Demo Wallet
          </Link>
          <LanguageSwitch />
        </header>
        <main className="wallet-width wallet-main">
          {unavailable ? (
            <>
              <p role="alert">
                {locale === 'de'
                  ? 'Die Anmeldung konnte gerade nicht geprüft werden. Es wurden keine Anfragedaten geöffnet.'
                  : 'Sign-in could not be verified. No request data has been opened.'}
              </p>
              <button
                className="wallet-button"
                onClick={() => {
                  setChecked(null);
                  setCheckAttempt(n => n + 1);
                }}
              >
                {locale === 'de' ? 'Erneut versuchen' : 'Try again'}
              </button>
            </>
          ) : (
            <p role="status">{locale === 'de' ? 'Anmeldung wird geprüft …' : 'Checking sign-in …'}</p>
          )}
        </main>
      </div>
    );
  }
  return (
    <div className="wallet-app">
      <header className="wallet-top">
        <Link
          className="wallet-brand"
          href={base}
        >
          <Icon name="wallet" />
          XFSC Demo Wallet
        </Link>
        <div className="wallet-account">
          <LanguageSwitch />
          {token && (
            <>
              <button
                disabled={busy}
                className="wallet-button outline"
                onClick={() => {
                  void action(async () => {
                    await api('/auth/logout', 'POST', {});
                    leaving.current = true;
                    sessionStorage.removeItem(tokenKey);
                    setToken(null);
                    router.push(`/${locale}`);
                  });
                }}
              >
                {tr('Abmelden') + ' '}
              </button>
            </>
          )}
        </div>
      </header>
      <div className="demo-banner">
        {tr('Lokale Demo \u00B7 nur Testdaten \u00B7 keine echte OID4VC-Zertifizierung oder LDP-Signatur') + ' '}
      </div>
      {token && (
        <nav
          className="wallet-tabs"
          aria-label={tr('Demo Navigation')}
        >
          {nav.map(([route, label]) => (
            <Link
              key={route}
              href={`${base}${route ? `/${route}` : ''}`}
              aria-current={view === (route || 'home') ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
      <main className="wallet-width wallet-main">
        {error && (
          <p
            className="demo-error"
            role="alert"
          >
            {error}
          </p>
        )}
        {busy && <p role="status">{tr('Wird verarbeitet \u2026')}</p>}
        {view === 'login' ? (
          <section className="demo-panel">
            <h1>{tr('Demo anmelden')}</h1>
            <p>
              {tr('Benutzername und Passwort:') + ' '}
              <strong>demo / demo</strong>
              {tr('. Das Backend erstellt ein signiertes JWT und pr\u00FCft es bei jedem gesch\u00FCtzten Aufruf.') +
                ' '}
            </p>
            <form
              onSubmit={e => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void action(async () => {
                  const session = await api<Session>('/auth/login', 'POST', {
                    username: form.get('username'),
                    password: form.get('password'),
                  });
                  sessionStorage.setItem(tokenKey, session.access_token);
                  setToken(session.access_token);
                  const next = new URLSearchParams(window.location.search).get('next');
                  router.replace(demoReturnLocation(base, next));
                });
              }}
            >
              <label>
                {tr('Benutzername') + ' '}
                <input
                  name="username"
                  autoComplete="username"
                  defaultValue="demo"
                  required
                />
              </label>
              <label>
                {tr('Passwort') + ' '}
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  defaultValue="demo"
                  required
                />
              </label>
              <button
                disabled={busy}
                className="wallet-button"
              >
                {tr('Anmelden') + ' '}
              </button>
            </form>
          </section>
        ) : !token ? (
          <p>{tr('Weiter zur Anmeldung \u2026')}</p>
        ) : (
          <>
            {view === 'home' && (
              <>
                <div className="wallet-page-title">
                  <h1>{t('title')}</h1>
                  <p>{t('subtitle')}</p>
                </div>
                <section className="wallet-actions">
                  {(['presentation', 'offer'] as const).map(type => (
                    <article
                      className="wallet-action"
                      key={type}
                    >
                      <Icon name={type === 'offer' ? 'receive' : 'send'} />
                      <div>
                        <h2>{type === 'offer' ? t('receive') : t('send')}</h2>
                        <p>
                          {type === 'offer'
                            ? tr('Angebot pr\u00FCfen und Empfang quittieren.')
                            : tr('Empf\u00E4nger und Angaben vor dem Senden best\u00E4tigen.')}
                        </p>
                        <Link
                          className="wallet-button"
                          href={`${base}/${type}`}
                        >
                          {type === 'offer' ? t('receive') : t('send')}
                        </Link>
                      </div>
                    </article>
                  ))}
                </section>
                <section className="wallet-activity">
                  <div className="section-title">
                    <h2>{tr('Meine Nachweise')}</h2>
                    <span>
                      {credentials.length}
                      {tr('Testnachweise')}
                    </span>
                  </div>
                  <div className="demo-grid">
                    {credentials.map(c => (
                      <CredentialCard
                        key={c.id}
                        credential={c}
                      />
                    ))}
                  </div>
                </section>
                <section className="wallet-activity">
                  <div className="section-title">
                    <h2>{tr('Letzte Aktivit\u00E4ten')}</h2>
                    <Link href={`${base}/history`}>{tr('Gesamte Historie')}</Link>
                  </div>
                  {history.slice(0, 3).map(e => (
                    <p
                      className="activity-row"
                      key={e.id}
                    >
                      {tr(e.event)} · {new Date(e.timestamp).toLocaleString(locale)}
                    </p>
                  ))}
                </section>
              </>
            )}
            {view === 'offer' && !id && (
              <>
                <h1>{tr('Nachweis empfangen')}</h1>
                <p>{tr('Angebote pr\u00FCfen und anschlie\u00DFend bewusst annehmen.')}</p>
                {offers.length === 0 && <p>{tr('Keine Angebote vorhanden.')}</p>}
                {offers.map(o => (
                  <section
                    key={o.id}
                    className="wallet-activity"
                  >
                    <h2>{tr(o.credential.name)}</h2>
                    <p>
                      {tr('Status:') + ' '}
                      {o.status}
                    </p>
                    <Link
                      className="wallet-button outline"
                      href={`${base}/offer/${o.id}`}
                    >
                      {tr('Angebot pr\u00FCfen') + ' '}
                    </Link>
                  </section>
                ))}
                <Link href={`${base}/links`}>{tr('Angebotslink oder QR-Code erzeugen')}</Link>
              </>
            )}
            {view === 'offer' &&
              id &&
              (offer ? (
                <section className="demo-panel">
                  <h1>{offer.status === 'accepted' ? tr('Empfang quittiert') : tr('Angebot pr\u00FCfen')}</h1>
                  <CredentialCard credential={offer.credential} />
                  {offer.status === 'received' ? (
                    <>
                      <p>{tr('Mit \u201ENachweis annehmen\u201C wird er in Ihrer Demo-Wallet gespeichert.')}</p>
                      <div className="demo-buttons">
                        <button
                          disabled={busy}
                          className="wallet-button"
                          onClick={() => {
                            void action(async () => {
                              await api(`/offers/${id}/accept`, 'POST', {});
                              setRefresh(v => v + 1);
                            });
                          }}
                        >
                          {tr('Nachweis annehmen') + ' '}
                        </button>
                        <button
                          disabled={busy}
                          className="wallet-button outline"
                          onClick={() => {
                            void action(async () => {
                              await api(`/offers/${id}/deny`, 'POST', {});
                              setRefresh(v => v + 1);
                            });
                          }}
                        >
                          {tr('Ablehnen') + ' '}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p role="status">
                        {offer.status === 'accepted'
                          ? `${tr('Nachweis gespeichert. Quittung:')} ${offer.receipt?.id}`
                          : tr('Angebot abgelehnt.')}
                      </p>
                      <Link href={base}>{tr('Zur Wallet')}</Link>
                      <br />
                      <Link href={`${base}/history`}>{tr('Historie ansehen')}</Link>
                    </>
                  )}
                </section>
              ) : (
                !busy && <p>{tr('Angebot nicht gefunden.')}</p>
              ))}
            {view === 'presentation' && !id && (
              <>
                <h1>{tr('Nachweis erbringen')}</h1>
                {presentations.map(p => (
                  <section
                    key={p.id}
                    className="wallet-activity"
                  >
                    <h2>{p.recipient}</h2>
                    <p>
                      {p.purpose}
                      {tr('\u00B7 Status:') + ' '}
                      {tr(p.status)}
                    </p>
                    <Link
                      className="wallet-button outline"
                      href={`${base}/presentation/${p.id}`}
                    >
                      {tr('Freigabe pr\u00FCfen') + ' '}
                    </Link>
                  </section>
                ))}
              </>
            )}
            {view === 'presentation' &&
              id &&
              (presentation ? (
                <PresentationConsent
                  presentation={presentation}
                  api={api}
                  base={base}
                  onUpdated={() => setRefresh(v => v + 1)}
                />
              ) : (
                !busy && <p>{tr('Pr\u00E4sentationsanfrage nicht gefunden.')}</p>
              ))}
            {view === 'history' && (
              <>
                <h1>{tr('Historie')}</h1>
                <label>
                  {tr('Filtern') + ' '}
                  <select
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                  >
                    <option value="">{tr('Alle')}</option>
                    <option value="credential_received">{tr('Nachweis empfangen')}</option>
                    <option value="presentation_sent">{tr('Pr\u00E4sentation gesendet')}</option>
                  </select>
                </label>
                {history
                  .filter(e => !filter || e.type === filter)
                  .map(e => (
                    <article
                      className="wallet-activity"
                      key={e.id}
                    >
                      <h2>{tr(e.event)}</h2>
                      <p>
                        {e.type} · {new Date(e.timestamp).toLocaleString(locale)}
                      </p>
                      {e.recipient && (
                        <p>
                          {tr('Empf\u00E4nger:') + ' '}
                          {e.recipient}
                        </p>
                      )}
                    </article>
                  ))}
              </>
            )}
            {(view === 'links' || view === 'import') && (
              <section className="demo-panel">
                <h1>{view === 'import' ? tr('Anfrage importieren') : tr('Demo-Links und QR-Codes')}</h1>
                {view === 'links' && (
                  <>
                    <div className="demo-buttons">
                      <button
                        disabled={busy}
                        className="wallet-button"
                        onClick={() => {
                          void action(async () => {
                            const o = await api<Offer>('/offers', 'POST', {});
                            setLinks({ type: 'offer', id: o.id });
                            setRefresh(v => v + 1);
                          });
                        }}
                      >
                        {tr('SD-JWT-Angebot erstellen') + ' '}
                      </button>
                      <button
                        disabled={busy}
                        className="wallet-button outline"
                        onClick={() => {
                          void action(async () => {
                            const o = await api<Offer>('/offers', 'POST', { format: 'ldp_vc' });
                            setLinks({ type: 'offer', id: o.id });
                            setRefresh(v => v + 1);
                          });
                        }}
                      >
                        {tr('LDP-VC-Angebot erstellen') + ' '}
                      </button>
                      <button
                        disabled={busy}
                        className="wallet-button outline"
                        onClick={() => {
                          void action(async () => {
                            const p = await api<Presentation>('/presentations', 'POST', {});
                            setLinks({ type: 'presentation', id: p.id });
                            setRefresh(v => v + 1);
                          });
                        }}
                      >
                        {tr('OID4VP-Anfrage erstellen') + ' '}
                      </button>
                    </div>
                    <button
                      disabled={busy}
                      className="wallet-button outline"
                      onClick={() => {
                        void action(async () => {
                          const p = await api<Presentation>('/presentations', 'POST', { profile: 'combined' });
                          setLinks({ type: 'presentation', id: p.id });
                          setRefresh(v => v + 1);
                        });
                      }}
                    >
                      {tr('Kombinierte OID4VP-Anfrage erstellen') + ' '}
                    </button>
                    {links && (
                      <div className="wallet-activity">
                        <h2>{tr('Link \u00F6ffnen oder QR scannen')}</h2>
                        <QRCode
                          value={redirectLink}
                          size={200}
                        />
                        <p>
                          <a href={redirectLink}>{tr('HTTP-Redirect \u00F6ffnen')}</a>
                        </p>
                        <p>
                          <Link href={`${base}/${links.type}/${links.id}`}>
                            {tr('Direkt zur Best\u00E4tigungsseite')}
                          </Link>
                        </p>
                        <label>
                          {tr('OID4VC Deep Link') + ' '}
                          <textarea
                            readOnly
                            value={deepLink}
                          />
                        </label>
                        <button
                          className="wallet-button outline"
                          onClick={() => {
                            void action(async () => {
                              await navigator.clipboard.writeText(deepLink);
                            });
                          }}
                        >
                          {tr('Deep Link kopieren') + ' '}
                        </button>
                        <button
                          className="wallet-button outline"
                          onClick={() => {
                            setUri(deepLink);
                          }}
                        >
                          {tr('Im Importfeld verwenden') + ' '}
                        </button>
                        <p>
                          {tr(
                            'Der QR-Code enth\u00E4lt einen im Browser \u00F6ffnenden HTTP-Link. Custom-Scheme-Links lassen sich unten importieren; eine native Protokollregistrierung wird nicht installiert.'
                          ) + ' '}
                        </p>
                      </div>
                    )}
                  </>
                )}
                <RequestImport
                  initialUri={
                    uri ||
                    (typeof window !== 'undefined'
                      ? new URLSearchParams(window.location.search).get('uri') ?? undefined
                      : undefined)
                  }
                  onResolve={async input => {
                    const resolved = await api<LinkResult>('/links/resolve', 'POST', { uri: input });
                    router.push(resolved.path.replace('/de/', `/${locale}/`));
                  }}
                />
                <p>
                  <a
                    href="/api/mock/issuer-metadata"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tr('OID4VCI-Metadaten ansehen') + ' '}
                  </a>{' '}
                  ·{' '}
                  <a
                    href="/api/mock/configuration"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tr('Backend-Konfiguration') + ' '}
                  </a>
                </p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
