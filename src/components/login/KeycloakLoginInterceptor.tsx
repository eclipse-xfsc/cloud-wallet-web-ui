'use client';
import { useKeycloak } from '@react-keycloak/web';
import { useEffect, useState } from 'react';
import LoadingSpinner from '../loading-spinner/LoadingSpinner';
export default function KeycloakLoginInterceptor({ children }: { children: React.ReactNode }): JSX.Element {
  const { initialized, keycloak } = useKeycloak();
  const debug = process.env.NEXT_PUBLIC_LOCAL_LOGIN_DEBUG === 'true';
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!debug && initialized && !keycloak.authenticated) {
      void keycloak.login({ redirectUri: window.location.href }).catch(() => setFailed(true));
    }
  }, [initialized, keycloak, debug]);
  if (debug && initialized && !keycloak.authenticated) {
    return (
      <main className="wallet-width wallet-main">
        <h1>Not authenticated (debug)</h1>
        <button className="wallet-button" onClick={() => {
          void keycloak.login({ redirectUri: window.location.origin + window.location.pathname + window.location.search }).catch(error => {
            console.error("[Manual login]", error);
            setFailed(true);
          });
        }}>Login manually</button>
        {failed && <p>Login failed. Check browser console.</p>}
      </main>
    );
  }
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
