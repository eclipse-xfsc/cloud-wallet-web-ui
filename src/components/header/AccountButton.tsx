'use client';

import css from './Header.module.scss';
import SearchUserLoginState from './SearchUserLoginState';
import useLogoutApi from '@/hooks/useLogoutApi';
import { useRouter } from 'next/navigation';
import { useContext } from 'react';
import { AppContext } from '@/store/AppContextProvider';
import { useAuthConfig } from '@/store/AuthConfigProvider';
import { useLocale, useTranslations } from 'next-intl';
import { useKeycloak } from '@react-keycloak/web';

const AccountButton = (): JSX.Element => {
  const { keycloak } = useKeycloak();
  const config = useAuthConfig();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const [logOut] = useLogoutApi(config!, keycloak.token, keycloak.refreshToken);
  const router = useRouter();
  const locale = useLocale();
  const { setError } = useContext(AppContext);
  const t = useTranslations('Auth');

  const handleSignIn = (): void => {
    keycloak
      .login({
        redirectUri: `${window.location.origin}/${locale}/wallet`,
      })
      .catch(setError);
  };

  const handleSignOut = (): void => {
    logOut()
      .then(() => {
        router.push(`/${locale}/`);

        window.location.reload();
      })
      .catch(setError);
  };

  return (
    <div className={css['flex-center']}>
      {!keycloak.authenticated && (
        <SearchUserLoginState
          text={t('login')}
          onClick={handleSignIn}
        />
      )}
      {keycloak.authenticated && (
        <SearchUserLoginState
          text={t('logout')}
          onClick={handleSignOut}
        />
      )}
    </div>
  );
};

export default AccountButton;
