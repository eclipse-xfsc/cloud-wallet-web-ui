'use client';
import LanguageSwitch from './LanguageSwitch';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import AccountButton from '@/components/header/AccountButton';
export default function WalletNav(): JSX.Element {
  const locale = useLocale();
  const t = useTranslations('SimpleWallet');
  const path = usePathname();
  const base = `/${locale}/wallet`;
  const links = [
    ['', 'start'],
    ['/selection', 'send'],
    ['/offering', 'receive'],
    ['/history', 'history'],
  ];
  return (
    <>
      <header className="wallet-top">
        <Link
          href={base}
          className="wallet-brand"
        >
          <Image
            src="/xfsc1.png"
            alt="XFSC"
            width={48}
            height={48}
            unoptimized
          />{' '}
          Wallet
        </Link>
        <div className="wallet-account">
          <LanguageSwitch />
          <AccountButton />
        </div>
      </header>
      <nav
        className="wallet-tabs"
        aria-label={t('navigation')}
      >
        {links.map(([route, label]) => (
          <Link
            key={label}
            href={`${base}${route}`}
            aria-current={path === `${base}${route}` ? 'page' : undefined}
          >
            {t(label)}
          </Link>
        ))}
      </nav>
    </>
  );
}
