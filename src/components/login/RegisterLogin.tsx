'use client';

import { ReactKeycloakProvider } from '@react-keycloak/web';
import Keycloak, { type KeycloakError } from 'keycloak-js';
import { useCallback, useContext, useEffect, useState } from 'react';
import { AppContext } from '@/store/AppContextProvider';
import { useAuthConfig } from '@/store/AuthConfigProvider';
import LoadingSpinner from '../loading-spinner/LoadingSpinner';
import { useTranslations } from 'next-intl';

const RegisterLogin = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const config = useAuthConfig();
  const t = useTranslations('SimpleWallet');
  const { setError } = useContext(AppContext);
  const [keycloak, setKeycloak] = useState<Keycloak>();
  const handleError = useCallback(
    (error: KeycloakError) => {
      setError(Error(error.error_description));
    },
    [setError]
  );

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
    if (!config) return;
    const kc = new Keycloak({ url: config.auth, realm: config.realm, clientId: config.clientId });
    kc.onAuthError = handleError;
    setKeycloak(kc);
  }, [config, handleError]);

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
      initOptions={{ checkLoginIframe: false, pkceMethod: 'S256', flow: 'standard' }}
      LoadingComponent={<LoadingSpinner />}
    >
      {children}
    </ReactKeycloakProvider>
  ) : (
    <LoadingSpinner />
  );
};
export default RegisterLogin;
