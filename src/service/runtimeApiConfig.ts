interface RuntimeApiConfig {
  apiUrl: string;
  accountServiceUrl: string;
}
declare global {
  interface Window {
    __WALLET_API_CONFIG__?: RuntimeApiConfig;
  }
}
/** Helm runtime values take precedence over legacy development/build defaults. */
export function getRuntimeApiConfig(): RuntimeApiConfig {
  const config = typeof window === 'undefined' ? undefined : window.__WALLET_API_CONFIG__;
  if (config) return config;
  return {
    apiUrl: process.env.API_URL ?? '/api',
    accountServiceUrl: process.env.API_URL_ACCOUNT_SERVICE ?? '/api/accounts',
  };
}
