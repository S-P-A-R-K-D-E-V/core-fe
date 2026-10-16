import { PERMISSIONS } from 'src/auth/permissions';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { UserEditView } from 'src/sections/user/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: User Edit',
};

type Props = {
  params: {
    id: string;
  };
};

export default function UserEditPage({ params }: Props) {
  const { id } = params;

  return (
    <RoleBasedGuard hasContent allPermissions={[PERMISSIONS.user.update]}>
      <UserEditView id={id} />
    </RoleBasedGuard>
  );
}
