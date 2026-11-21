'use client';
import { getRuntimeApiConfig } from '@/service/runtimeApiConfig';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useKeycloak } from '@react-keycloak/web';
import { useQuery } from '@tanstack/react-query';
import { genericFetch } from '@/service/apiService';
import { type HistoryData, type OfferingData } from '@/service/types';
import Icon from '@/components/wallet-ui/Icon';
export default function WalletHome(): JSX.Element {
  const locale = useLocale();
  const t = useTranslations('SimpleWallet');
  const { keycloak } = useKeycloak();
  const base = `/${locale}/wallet`;
  const headers = { Authorization: `Bearer ${keycloak.token}` };
  const history = useQuery({
    queryKey: ['historyList', headers],
    queryFn: async () =>
      await genericFetch<HistoryData>(`${getRuntimeApiConfig().accountServiceUrl}/history/list`, { headers }),
  });
  const offers = useQuery({
    queryKey: ['offeringList', headers],
    queryFn: async () =>
      await genericFetch<OfferingData[]>(`${getRuntimeApiConfig().accountServiceUrl}/credentials/offers/list`, {
        headers,
      }),
  });
  const pending = offers.data?.filter(offer => offer.status === 'received').length ?? 0;
  const events = [...(history.data?.events ?? [])]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 3);
  return (
    <>
      <div className="wallet-page-title">
        <h1>{t('title')}</h1>
        <p>{t('subtitle')}</p>
      </div>
      <section
        className="wallet-actions"
        aria-label={t('actions')}
      >
        {(['send', 'receive'] as const).map(key => (
          <article
            className="wallet-action"
            key={key}
          >
            <Icon name={key} />
            <div>
              <h2>{t(key)}</h2>
              <p>{t(`${key}Text`)}</p>
              <Link
                className={`wallet-button ${key === 'receive' ? 'outline' : ''}`}
                href={`${base}/${key === 'send' ? 'selection' : 'offering'}`}
              >
                {t(key)}
              </Link>
            </div>
          </article>
        ))}
      </section>
      {pending > 0 && (
        <section className="wallet-pending">
          <Icon name="receive" />
          <div>
            <strong>{t('pending', { count: pending })}</strong>
            <p>{t('pendingText')}</p>
          </div>
          <Link href={`${base}/offering`}>{t('review')}</Link>
        </section>
      )}
      <section className="wallet-activity">
        <div className="section-title">
          <h2>{t('recent')}</h2>
          <Link href={`${base}/history`}>{t('allHistory')}</Link>
        </div>
        {history.isPending ? (
          <p role="status">{t('loading')}</p>
        ) : history.isError ? (
          <div role="alert">
            <p>{t('historyError')}</p>
            <button
              className="wallet-button outline"
              onClick={() => {
                void history.refetch();
              }}
            >
              {t('retry')}
            </button>
          </div>
        ) : events.length ? (
          events.map((event, i) => (
            <div
              className="activity-row"
              key={`${event.timestamp}-${i}`}
            >
              <span className="activity-icon">
                <Icon name="history" />
              </span>
              <div>
                <strong>{event.event}</strong>
                <p>{event.type}</p>
              </div>
              <time dateTime={event.timestamp}>
                {Number.isNaN(new Date(event.timestamp).getTime())
                  ? event.timestamp
                  : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                      new Date(event.timestamp)
                    )}
              </time>
            </div>
          ))
        ) : (
          <p className="wallet-empty">{t('noHistory')}</p>
        )}
      </section>
      {offers.isError && (
        <p
          className="wallet-inline-error"
          role="alert"
        >
          {t('offersError')}{' '}
          <button
            onClick={() => {
              void offers.refetch();
            }}
          >
            {t('retry')}
          </button>
        </p>
      )}
      <p className="security-note wallet-reassurance">
        <Icon name="lock" />
        {t('control')}
      </p>
    </>
  );
}
