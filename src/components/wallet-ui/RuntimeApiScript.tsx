import 'server-only';

/** Whitelist public API addresses; never serialize the full environment. */
export default function RuntimeApiScript(): JSX.Element {
  const config = {
    apiUrl: process.env.WALLET_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '/api',
    accountServiceUrl:
      process.env.WALLET_ACCOUNT_SERVICE_URL ?? process.env.NEXT_PUBLIC_API_URL_ACCOUNT_SERVICE ?? '/api/accounts',
  };
  const serialized = JSON.stringify(config).replace(/</g, '\\u003c');
  return <script dangerouslySetInnerHTML={{ __html: `window.__WALLET_API_CONFIG__=${serialized};` }} />;
}
