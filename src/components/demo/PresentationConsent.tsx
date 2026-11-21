'use client';
import { useDemoText } from './demoText';
import { useEffect, useState } from 'react';
import Link from 'next/link';
interface Selection {
  queryId: string;
  credentialId: string;
  disclosures: string[];
}
interface Disclosure {
  id: string;
  disclosure: string;
  value: string;
  required: boolean;
}
interface Candidate {
  display: {
    name: string;
    issuer: string;
  };
  claims: Record<string, string>;
  disclosureOptions: Disclosure[];
  selectiveDisclosure: boolean;
}
interface CandidateResponse {
  presentationId: string;
  dcqlQuery: object;
  candidates: Array<{
    id: string;
    format: string;
    credentials: Record<string, Candidate>;
  }>;
  combinations: string[][];
  suggestedSelection: {
    selections: Selection[];
  };
}
interface RequestView {
  id: string;
  status: string;
  recipient: string;
  purpose: string;
  receipt?: {
    id: string;
  };
  sharedClaims?: object;
  response?: object;
}
interface Props {
  presentation: RequestView;
  api: <T>(path: string, method?: string, body?: object) => Promise<T>;
  base: string;
  onUpdated: () => void;
}
export default function PresentationConsent({ presentation, api, base, onUpdated }: Props): JSX.Element {
  const tr = useDemoText();
  const [candidates, setCandidates] = useState<CandidateResponse>();
  const [selections, setSelections] = useState<Selection[]>([]);
  const [combination, setCombination] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (presentation.status !== 'pending') return;
    let active = true;
    setLoading(true);
    setError('');
    api<CandidateResponse>(`/presentations/${presentation.id}/candidates`)
      .then(result => {
        if (active) {
          setCandidates(result);
          setSelections(result.suggestedSelection.selections);
          setCombination([...new Set(result.suggestedSelection.selections.map(s => s.queryId))]);
          setConfirmed(false);
        }
      })
      .catch(e => {
        if (active) setError(tr(e instanceof Error ? e.message : String(e)));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [presentation.id, presentation.status]);
  function initial(queryId: string, credentialId?: string): Selection {
    const group = candidates!.candidates.find(c => c.id === queryId)!;
    const id = credentialId ?? Object.keys(group.credentials)[0];
    const c = group.credentials[id];
    return {
      queryId,
      credentialId: id,
      disclosures: c.selectiveDisclosure ? c.disclosureOptions.filter(f => f.required).map(f => f.disclosure) : [],
    };
  }
  function chooseCombination(option: string[]): void {
    setCombination(option);
    setSelections(
      option.flatMap(id => {
        const current = selections.filter(s => s.queryId === id);
        return current.length ? current : [initial(id)];
      })
    );
    setConfirmed(false);
  }
  function toggleCredential(queryId: string, id: string, checked: boolean): void {
    const group = candidates!.candidates.find(g => g.id === queryId)!;
    const updated = selections.filter(
      s => !(s.queryId === queryId && (s.credentialId === id || group.format === 'ldp_vc'))
    );
    setSelections(checked ? [...updated, initial(queryId, id)] : updated);
    setConfirmed(false);
  }
  function toggleDisclosure(queryId: string, id: string, field: string, checked: boolean): void {
    setSelections(
      selections.map(s =>
        s.queryId === queryId && s.credentialId === id
          ? { ...s, disclosures: checked ? [...s.disclosures, field] : s.disclosures.filter(f => f !== field) }
          : s
      )
    );
    setConfirmed(false);
  }
  const missing =
    combination.some(q => !selections.some(s => s.queryId === q)) ||
    selections.some(s => {
      const c = candidates?.candidates.find(g => g.id === s.queryId)?.credentials[s.credentialId];
      return (
        !c ||
        (c.selectiveDisclosure && c.disclosureOptions.some(f => f.required && !s.disclosures.includes(f.disclosure)))
      );
    });
  async function submit(approve: boolean): Promise<void> {
    setLoading(true);
    setError('');
    try {
      await api(
        `/presentations/${presentation.id}/${approve ? 'approve' : 'reject'}`,
        'POST',
        approve ? { presentationId: presentation.id, approved: confirmed, selections } : {}
      );
      onUpdated();
    } catch (e) {
      setError(tr(e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }
  if (presentation.status !== 'pending')
    return (
      <section className="demo-panel">
        <h1>
          {['completed', 'sent'].includes(presentation.status)
            ? tr('Pr\u00E4sentation gesendet')
            : tr('Anfrage abgelehnt')}
        </h1>
        <p>
          {tr('Empf\u00E4nger:') + ' '}
          {presentation.recipient}
        </p>
        <p>
          {tr('Status:') + ' '}
          {tr(presentation.status)}
        </p>
        {presentation.receipt && (
          <p role="status">
            {tr('Quittung:') + ' '}
            {presentation.receipt.id}
          </p>
        )}
        <h2>{tr('\u00DCbermittelte Angaben')}</h2>
        <pre>{JSON.stringify(presentation.sharedClaims ?? {}, null, 2)}</pre>
        {presentation.response && (
          <details>
            <summary>{tr('Demo-VP-Token und Auswahl ansehen')}</summary>
            <pre>{JSON.stringify(presentation.response, null, 2)}</pre>
          </details>
        )}
        <Link href={`${base}/history`}>{tr('Zur Historie')}</Link>
      </section>
    );
  return (
    <section className="demo-panel">
      <h1>{tr('Pr\u00E4sentation zusammenstellen')}</h1>
      <p>
        <strong>{tr('Empf\u00E4nger:')}</strong> {presentation.recipient}
      </p>
      <p>
        <strong>{tr('Zweck:')}</strong> {tr(presentation.purpose)}
      </p>
      <p>
        {tr(
          'Die API schl\u00E4gt passende Nachweise und die minimal ben\u00F6tigten Angaben vor. Pr\u00FCfen oder \u00E4ndern Sie diese Auswahl. Erst Ihre Best\u00E4tigung gibt Daten frei.'
        ) + ' '}
      </p>
      {error && (
        <p
          role="alert"
          className="demo-error"
        >
          {error}
        </p>
      )}
      {loading && <p role="status">{tr('Kandidaten werden geladen / Vorgang wird verarbeitet \u2026')}</p>}
      {candidates && (
        <>
          <details>
            <summary>{tr('DCQL-Anfrage und API-Vorauswahl ansehen')}</summary>
            <pre>{JSON.stringify(candidates, null, 2)}</pre>
          </details>
          {candidates.combinations.length > 1 && (
            <label>
              {tr('G\u00FCltige Nachweis-Kombination') + ' '}
              <select
                value={candidates.combinations.findIndex(
                  o => o.length === combination.length && o.every(q => combination.includes(q))
                )}
                onChange={e => chooseCombination(candidates.combinations[Number(e.target.value)])}
              >
                {candidates.combinations.map((option, i) => (
                  <option
                    value={i}
                    key={i}
                  >
                    {option.join(' + ')}
                  </option>
                ))}
              </select>
            </label>
          )}
          {combination.map(queryId => {
            const group = candidates.candidates.find(g => g.id === queryId)!;
            return (
              <fieldset
                className="demo-selection"
                key={queryId}
              >
                <legend>
                  {queryId === 'employment' ? tr('Besch\u00E4ftigungsnachweis') : tr('Qualifikationsnachweis')} ·{' '}
                  {group.format}
                </legend>
                {Object.entries(group.credentials).map(([id, c]) => {
                  const selection = selections.find(s => s.queryId === queryId && s.credentialId === id);
                  return (
                    <article
                      className="wallet-activity"
                      key={id}
                    >
                      <label className="demo-consent">
                        <input
                          type={group.format === 'ldp_vc' ? 'radio' : 'checkbox'}
                          name={queryId}
                          checked={!!selection}
                          onChange={e => toggleCredential(queryId, id, e.target.checked)}
                        />
                        <strong>{tr(c.display.name)}</strong> · {c.display.issuer}
                      </label>
                      {selection &&
                        (c.selectiveDisclosure ? (
                          <div>
                            <p>{tr('Offenzulegende Angaben:')}</p>
                            {c.disclosureOptions.map(field => (
                              <label
                                className="demo-consent"
                                key={field.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={selection.disclosures.includes(field.disclosure)}
                                  onChange={e => toggleDisclosure(queryId, id, field.disclosure, e.target.checked)}
                                />
                                <span>
                                  {tr(field.disclosure)}: <strong>{field.value}</strong>{' '}
                                  {field.required ? tr('(Pflichtangabe)') : tr('(optional)')}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <>
                            <p className="demo-banner">
                              {tr(
                                'Dieser LDP-Nachweis unterst\u00FCtzt keine selektive Offenlegung. Bei Freigabe wird der vollst\u00E4ndige Nachweis \u00FCbertragen.'
                              ) + ' '}
                            </p>
                            <pre>{JSON.stringify(c.claims, null, 2)}</pre>
                          </>
                        ))}
                    </article>
                  );
                })}
              </fieldset>
            );
          })}
          <h2>{tr('Vorschau der Datenfreigabe')}</h2>
          {selections.length === 0 ? (
            <p>{tr('Keine Nachweise ausgew\u00E4hlt.')}</p>
          ) : (
            selections.map(s => {
              const c = candidates.candidates.find(g => g.id === s.queryId)!.credentials[s.credentialId];
              return (
                <div
                  className="wallet-activity"
                  key={`${s.queryId}-${s.credentialId}`}
                >
                  <strong>{tr(c.display.name)}</strong>
                  <dl>
                    {Object.entries(
                      c.selectiveDisclosure ? Object.fromEntries(s.disclosures.map(d => [d, c.claims[d]])) : c.claims
                    ).map(([name, value]) => (
                      <div key={name}>
                        <dt>{tr(name)}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })
          )}
          {missing && (
            <p role="status">
              {tr('Bitte pro ben\u00F6tigter Gruppe einen passenden Nachweis und alle Pflichtangaben ausw\u00E4hlen.')}
            </p>
          )}
          {candidates.combinations.length === 0 && (
            <p>{tr('Keine g\u00FCltige Kombination vorhanden. Es werden keine Daten gesendet.')}</p>
          )}
          <label className="demo-consent">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
            />
            {tr('Ich gebe ausschlie\u00DFlich die oben angezeigten Angaben an') + ' '}
            {presentation.recipient}
            {tr('frei.') + ' '}
          </label>
        </>
      )}
      <div className="demo-buttons">
        <button
          className="wallet-button"
          disabled={loading || !candidates || !combination.length || missing || !confirmed}
          onClick={() => {
            void submit(true);
          }}
        >
          {tr('Pr\u00E4sentation freigeben (Demo)') + ' '}
        </button>
        <button
          className="wallet-button outline"
          disabled={loading}
          onClick={() => {
            void submit(false);
          }}
        >
          {tr('Anfrage ablehnen') + ' '}
        </button>
      </div>
    </section>
  );
}
