import { m } from 'framer-motion';

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { Theme, SxProps } from '@mui/material/styles';

import { ForbiddenIllustration } from 'src/assets/illustrations';

import { varBounce, MotionContainer } from 'src/components/animate';

import { useAuthContext } from '../hooks';

// ----------------------------------------------------------------------

type RoleBasedGuardProp = {
  hasContent?: boolean;
  roles?: string[];
  permissions?: string[];
  children: React.ReactNode;
  sx?: SxProps<Theme>;
};

export default function RoleBasedGuard({ hasContent, roles, permissions, children, sx }: RoleBasedGuardProp) {
  const { user } = useAuthContext();

  const currentRole = user?.role;
  const userRoles: string[] = user?.roles || [currentRole].filter(Boolean);
  const userPermissions: string[] = user?.permissions || [];

  // Check role-based access
  const hasRoleAccess = typeof roles === 'undefined' || roles.some((role) => userRoles.includes(role));

  // Check permission-based access
  const hasPermissionAccess = typeof permissions === 'undefined' || permissions.some((perm) => userPermissions.includes(perm));

  if (!hasRoleAccess || !hasPermissionAccess) {
    return hasContent ? (
      <Container component={MotionContainer} sx={{ textAlign: 'center', ...sx }}>
        <m.div variants={varBounce().in}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Permission Denied
          </Typography>
        </m.div>

        <m.div variants={varBounce().in}>
          <Typography sx={{ color: 'text.secondary' }}>
            You do not have permission to access this page
          </Typography>
        </m.div>

        <m.div variants={varBounce().in}>
          <ForbiddenIllustration
            sx={{
              height: 260,
              my: { xs: 5, sm: 10 },
            }}
          />
        </m.div>
      </Container>
    ) : null;
  }

  return <> {children} </>;
}
