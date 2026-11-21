'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useAuthConfig } from '@/store/AuthConfigProvider';

/** Start OIDC directly from the landing page and retain incoming wallet requests. */
export default function AccessLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  const locale = useLocale();
  const config = useAuthConfig();
  const t = useTranslations('SimpleWallet');
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const signIn = async (): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFailed(false);
    try {
      const redirect = new URL(href, window.location.origin);
      const incoming = new URLSearchParams(window.location.search);
      for (const key of ['presentation', 'params']) {
        const value = incoming.get(key);
        if (value) redirect.searchParams.set(key, value);
      }
      if (!config) throw new Error('Missing authentication configuration');
      if (config.mock) {
        window.location.assign(`/${locale}/demo/login`);
        return;
      }
      const { default: Keycloak } = await import('keycloak-js');
      const keycloak = new Keycloak({ url: config.auth, realm: config.realm, clientId: config.clientId });
      await keycloak.init({ checkLoginIframe: false, pkceMethod: 'S256', flow: 'standard' });
      await keycloak.login({ redirectUri: redirect.toString(), locale });
    } catch {
      busy.current = false;
      setPending(false);
      setFailed(true);
    }
  };

  // Native navigation is intentional: demo sign-in must work before hydration,
  // with JavaScript disabled, and for new-tab / keyboard activation.
  if (config?.mock === true || href === `/${locale}/demo/login` || config === null) {
    return (
      <a
        className={className}
        href={config?.mock ? `/${locale}/demo/login` : href}
      >
        {children}
      </a>
    );
  }

  return (
    <div>
      <Link
        href={href}
        className={className}
        aria-disabled={pending || undefined}
        aria-busy={pending || undefined}
        onClick={event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          void signIn();
        }}
      >
        {pending ? t('loginPending') : children}
      </Link>
      {failed && (
        <p
          role="alert"
          className="wallet-login-error"
        >
          {t('loginFailed')}
        </p>
      )}
    </div>
  );
}
