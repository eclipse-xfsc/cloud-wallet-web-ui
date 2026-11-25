'use client';

import { ReactKeycloakProvider } from '@react-keycloak/web';
import Keycloak from 'keycloak-js';
import { useContext, useEffect, useState } from 'react';
import { AppContext } from '@/store/AppContextProvider';
import { useAuthConfig } from '@/store/AuthConfigProvider';
import LoadingSpinner from '../loading-spinner/LoadingSpinner';
import { useTranslations } from 'next-intl';

const RegisterLogin = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const config = useAuthConfig();
  const t = useTranslations('SimpleWallet');
  const { setError } = useContext(AppContext);
  const [keycloak, setKeycloak] = useState<Keycloak>();
  const debug = process.env.NEXT_PUBLIC_LOCAL_LOGIN_DEBUG === 'true';
  const auth = config?.auth;
  const realm = config?.realm;
  const clientId = config?.clientId;

  useEffect(() => {
    if (!debug) return;
    console.info('[RegisterLogin] MOUNT');
    return () => console.info('[RegisterLogin] UNMOUNT');
  }, [debug]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const presentation = params.get('presentation');
    if (presentation) localStorage.setItem('urlParams', JSON.stringify({ presentation }));
    const plugin = params.get('params');
    if (plugin) {
      try {
        localStorage.setItem('pluginParams', JSON.stringify(JSON.parse(plugin)));
      } catch {
        setError(new Error('Invalid plugin request'));
      }
    }
  }, [setError]);

  useEffect(() => {
    if (!auth || !realm || !clientId) return;
    if (debug) console.count('[Keycloak] Creating instance');
    const kc = new Keycloak({ url: auth, realm, clientId });
    setKeycloak(kc);
  }, [auth, realm, clientId, debug]);

  if (!config)
    return (
      <main
        className="wallet-width wallet-main"
        role="alert"
      >
        <p>{t('loginFailed')}</p>
      </main>
    );
  return keycloak ? (
    <ReactKeycloakProvider
      authClient={keycloak}
      initOptions={{
        checkLoginIframe: false, pkceMethod: 'S256', flow: 'standard',
        ...(debug ? { onLoad: 'check-sso' as const, responseMode: 'fragment' as const, enableLogging: true } : {}),
      }}
     onEvent={(event, error) => {
        console.log('[Keycloak Event]', event);

        if (event === 'onInitError') {
          console.error('[Keycloak Init Error]', error);
          console.error('[Keycloak Init Error Details]', {
            message: error?.message,
            stack: error?.stack,
            error: error?.error,
            errorDescription: error?.error_description,
          });

          debugger;
        }
      }}
      onTokens={tokens => {
        if (debug) console.info('[Keycloak Tokens]', {
          hasAccessToken: !!tokens.token, hasRefreshToken: !!tokens.refreshToken,
          hasIdToken: !!tokens.idToken,
        });
      }}
      LoadingComponent={<LoadingSpinner />}
    >
      {children}
    </ReactKeycloakProvider>
  ) : (
    <LoadingSpinner />
  );
};
export default RegisterLogin;
