import LanguageSwitch from '@/components/wallet-ui/LanguageSwitch';
import { readRuntimeAuthConfig } from '@/service/runtimeAuthConfig';
import Link from 'next/link';
import AccessLink from '@/components/wallet-ui/AccessLink';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import Icon from '@/components/wallet-ui/Icon';
export default function Home(): JSX.Element {
  const t = useTranslations('SimpleWallet');
  const locale = useLocale();
  const authConfig = readRuntimeAuthConfig();
  const wallet = authConfig?.mock ? `/${locale}/demo/login` : `/${locale}/wallet`;
  return (
    <div className="landing">
      <header className="wallet-top">
        <Link
          href={`/${locale}`}
          className="wallet-brand"
        >
          <Image
            src="/xfsc1.png"
            alt="XFSC"
            width={48}
            height={48}
            unoptimized
          />{' '}
          Wallet
        </Link>
        <div className="wallet-account">
          <LanguageSwitch />
          <AccessLink
            className="wallet-button outline"
            href={wallet}
          >
            {t('login')}
          </AccessLink>
        </div>
      </header>
      <main>
        {!authConfig && (
          <div
            className="demo-error wallet-width"
            role="alert"
          >
            {locale === 'de' ? 'Die Anmeldung ist noch nicht konfiguriert.' : 'Sign-in has not been configured yet.'}
            {process.env.NODE_ENV !== 'production' && (
              <span>
                {' '}
                {locale === 'de' ? 'Für die lokale Demo:' : 'For the local demo:'} <code>npm run demo</code>
              </span>
            )}
          </div>
        )}

        <section className="landing-hero wallet-width">
          <div>
            <span className="eyebrow">{t('eyebrow')}</span>
            <h1>{t('hero')}</h1>
            <p>{t('heroText')}</p>
            <AccessLink
              className="wallet-button"
              href={wallet}
            >
              {t('loginWallet')}
            </AccessLink>
            <div className="security-note">
              <Icon name="lock" />
              {t('secureLogin')}
            </div>
          </div>
          <div
            className="product-preview"
            aria-label={t('preview')}
          >
            <div className="preview-circle" />
            <div className="preview-wallet">
              <h2>
                <Icon name="wallet" />
                {t('title')}
              </h2>
              <div>
                <Icon name="send" />
                {t('send')}
              </div>
              <div>
                <Icon name="receive" />
                {t('receive')}
              </div>
            </div>
            <div className="preview-credential">
              <Icon name="wallet" />
              <div>
                <h3>{t('sampleCredential')}</h3>
                <p>{t('sampleIssuer')}</p>
                <span>{t('sampleLabel')}</span>
              </div>
            </div>
          </div>
        </section>
        <section className="feature-band">
          <div className="wallet-width feature-grid">
            {(['receive', 'send', 'history'] as const).map(key => (
              <article key={key}>
                <Icon name={key} />
                <div>
                  <h2>{t(key === 'history' ? 'overview' : key)}</h2>
                  <p>{t(`${key}Description`)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section
          id="help"
          className="wallet-width landing-help"
        >
          <h2>{t('questions')}</h2>
          <details>
            <summary>{t('questionCredential')}</summary>
            <p>{t('answerCredential')}</p>
          </details>
          <details>
            <summary>{t('questionAccess')}</summary>
            <p>{t('answerAccess')}</p>
          </details>
        </section>
      </main>
      <footer className="wallet-footer wallet-width">
        <strong>XFSC Wallet</strong>
        <div>
          <a href="#help">{t('help')}</a>
          <a href="https://projects.eclipse.org/projects/technology.xfsc">{t('about')}</a>
        </div>
      </footer>
    </div>
  );
}
