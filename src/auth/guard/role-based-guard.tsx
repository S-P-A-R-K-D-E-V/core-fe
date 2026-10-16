'use client';

// Dùng được trong page / layout server component (đọc user từ AuthContext phía client).

import { m } from 'framer-motion';

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { Theme, SxProps } from '@mui/material/styles';

import { ForbiddenIllustration } from 'src/assets/illustrations';

import { varBounce, MotionContainer } from 'src/components/animate';

import { useAuthContext } from '../hooks';
import { hasAnyRole, getUserRoles } from '../roles';

// ----------------------------------------------------------------------

type RoleBasedGuardProp = {
  hasContent?: boolean;
  roles?: readonly string[];
  permissions?: string[];
  children: React.ReactNode;
  sx?: SxProps<Theme>;
};

export const FORBIDDEN_TITLE = 'Không có quyền truy cập';

export default function RoleBasedGuard({ hasContent, roles, permissions, children, sx }: RoleBasedGuardProp) {
  const { user } = useAuthContext();

  // Gộp role + roles: người kiêm nhiều vai trò (vd Staff kiêm Admin) có quyền của MỌI vai trò, như API.
  const userRoles = getUserRoles(user);
  const userPermissions: string[] = user?.permissions || [];

  const hasRoleAccess = hasAnyRole(userRoles, roles);

  // Check permission-based access
  const hasPermissionAccess = typeof permissions === 'undefined' || permissions.some((perm) => userPermissions.includes(perm));

  if (!hasRoleAccess || !hasPermissionAccess) {
    return hasContent ? (
      <Container component={MotionContainer} sx={{ textAlign: 'center', ...sx }}>
        <m.div variants={varBounce().in}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            {FORBIDDEN_TITLE}
          </Typography>
        </m.div>

        <m.div variants={varBounce().in}>
          <Typography sx={{ color: 'text.secondary' }}>
            Tài khoản của bạn không có quyền mở trang này. Liên hệ chủ cửa hàng nếu bạn cần dùng.
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
