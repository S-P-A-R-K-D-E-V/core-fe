'use client';

import { useAuthContext } from 'src/auth/hooks';

import LoginButton from './login-button';
import AccountPopover from './account-popover';

// ----------------------------------------------------------------------

type Props = {
  sx?: object;
};

/**
 * Renders AccountPopover (avatar + dropdown) when authenticated,
 * or the standard LoginButton when not authenticated.
 */
export default function LoginOrAccount({ sx }: Props) {
  const { authenticated } = useAuthContext();

  if (authenticated) {
    return <AccountPopover />;
  }

  return <LoginButton sx={sx} />;
}
