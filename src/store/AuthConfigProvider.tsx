'use client';
import { createContext, useContext } from 'react';
import type { KeycloakConfig } from '@/service/types';

const AuthConfig = createContext<KeycloakConfig | null>(null);
export function useAuthConfig(): KeycloakConfig | null {
  return useContext(AuthConfig);
}
export default function AuthConfigProvider({
  config,
  children,
}: {
  config: KeycloakConfig | null;
  children: React.ReactNode;
}): JSX.Element {
  return <AuthConfig.Provider value={config}>{children}</AuthConfig.Provider>;
}
