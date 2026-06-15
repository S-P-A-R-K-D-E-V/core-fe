import { useEffect, useCallback } from 'react';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { SplashScreen } from 'src/components/loading-screen';

import { useAuthContext } from '../hooks';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export default function GuestGuard({ children }: Props) {
  const { loading } = useAuthContext();

  return <>{loading ? <SplashScreen /> : <Container>{children}</Container>}</>;
}

// ----------------------------------------------------------------------

function Container({ children }: Props) {
  const router = useRouter();

  const searchParams = useSearchParams();

  const returnTo = searchParams.get('returnTo') || paths.dashboard.root;
  const isMobile = searchParams.get('mobile') === 'true';
  const mobileRedirectUri = searchParams.get('redirect_uri');

  const { authenticated } = useAuthContext();

  const check = useCallback(() => {
    if (!authenticated) return;

    // Mobile deep-link flow (app-mobile / Expo Go): the in-app browser may already
    // carry a logged-in web session, so the login form's redirect handler never runs.
    // Bounce straight back to the app with the stored session token instead of
    // silently landing on the dashboard.
    if (isMobile && mobileRedirectUri) {
      const sessionToken =
        typeof window !== 'undefined' ? localStorage.getItem('sessionToken') : null;
      if (sessionToken) {
        window.location.href = `${mobileRedirectUri}?sessionToken=${encodeURIComponent(sessionToken)}`;
        return;
      }
    }

    router.replace(returnTo);
  }, [authenticated, isMobile, mobileRedirectUri, returnTo, router]);

  useEffect(() => {
    check();
  }, [check]);

  return <>{children}</>;
}
