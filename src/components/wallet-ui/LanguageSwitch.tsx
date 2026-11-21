'use client';
import { useLocale } from 'next-intl';
import { useAuthConfig } from '@/store/AuthConfigProvider';
import { languageLocation } from '@/utils/languageLocation';
export default function LanguageSwitch(): JSX.Element {
  const locale = useLocale();
  const config = useAuthConfig();
  return (
    <label className="wallet-language">
      <span>{locale === 'de' ? 'Sprache' : 'Language'}</span>
      <select
        aria-label={locale === 'de' ? 'Sprache auswählen' : 'Select language'}
        value={locale}
        onChange={event => {
          const language = event.target.value;
          document.cookie = `NEXT_LOCALE=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
          if (config?.mock) {
            const token = sessionStorage.getItem('xfsc-demo-token');
            if (token)
              void fetch('/api/mock/configuration/language', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ language }),
                keepalive: true,
              }).catch(() => {});
          }
          window.location.assign(
            languageLocation(window.location.pathname, window.location.search, window.location.hash, language)
          );
        }}
      >
        <option value="de">Deutsch</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
