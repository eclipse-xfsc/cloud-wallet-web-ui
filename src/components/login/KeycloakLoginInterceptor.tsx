'use client';
import { useKeycloak } from '@react-keycloak/web';
import { useEffect, useState } from 'react';
import LoadingSpinner from '../loading-spinner/LoadingSpinner';
export default function KeycloakLoginInterceptor({ children }: { children: React.ReactNode }): JSX.Element {
  const { initialized, keycloak } = useKeycloak();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (initialized && !keycloak.authenticated) {
      void keycloak.login({ redirectUri: window.location.href }).catch(() => setFailed(true));
    }
  }, [initialized, keycloak]);
  if (failed)
    return (
      <main className="wallet-width wallet-main">
        <h1>Anmeldung nicht verfügbar / Sign-in unavailable</h1>
        <button
          className="wallet-button"
          onClick={() => window.location.reload()}
        >
          Erneut versuchen / Retry
        </button>
      </main>
    );
  return initialized && keycloak.authenticated ? (
    <>{children}</>
  ) : (
    <div
      className="wallet-loading"
      role="status"
    >
      <LoadingSpinner />
    </div>
  );
}
