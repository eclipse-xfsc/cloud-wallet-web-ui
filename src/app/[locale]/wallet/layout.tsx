import RuntimeApiScript from '@/components/wallet-ui/RuntimeApiScript';
import AuthConfigProvider from '@/store/AuthConfigProvider';
import { readRuntimeAuthConfig } from '@/service/runtimeAuthConfig';
import '../../../scss/globals.scss';
import '../../../scss/wallet-ui.scss';
import 'react-toastify/dist/ReactToastify.css';
import { WalletProvider } from '@/store/Provider';
import { NextIntlClientProvider, useMessages } from 'next-intl';
import WalletNav from '@/components/wallet-ui/WalletNav';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'XFSC Wallet', icons: ['/images/favicon.ico'] };
export default function WalletLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}): JSX.Element {
  const messages = useMessages();
  const authConfig = readRuntimeAuthConfig();
  return (
    <html lang={locale}>
      <head>
        <RuntimeApiScript />
      </head>
      <body className="wallet-app">
        <AuthConfigProvider config={authConfig}>
          <NextIntlClientProvider
            locale={locale}
            messages={messages}
          >
            <WalletProvider>
              <WalletNav />
              <main
                id="main-content"
                className="wallet-width wallet-main"
              >
                {children}
              </main>
            </WalletProvider>
          </NextIntlClientProvider>
        </AuthConfigProvider>
      </body>
    </html>
  );
}
