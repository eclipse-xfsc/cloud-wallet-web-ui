import RuntimeApiScript from '@/components/wallet-ui/RuntimeApiScript';
import AuthConfigProvider from '@/store/AuthConfigProvider';
import { readRuntimeAuthConfig } from '@/service/runtimeAuthConfig';
import '../../../scss/globals.scss';
import '../../../scss/wallet-ui.scss';
import { NextIntlClientProvider, useMessages } from 'next-intl';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'XFSC Wallet', description: 'Digitale Nachweise sicher empfangen und teilen.' };
export default function Layout({
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
      <body>
        <AuthConfigProvider config={authConfig}>
          <NextIntlClientProvider
            locale={locale}
            messages={messages}
          >
            {children}
          </NextIntlClientProvider>
        </AuthConfigProvider>
      </body>
    </html>
  );
}
