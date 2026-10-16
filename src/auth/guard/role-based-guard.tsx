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
import { permissionsKnown, hasAnyPermission, hasAllPermissions } from '../permissions';

// ----------------------------------------------------------------------

type RoleBasedGuardProp = {
  hasContent?: boolean;
  roles?: readonly string[];
  /** Có MỘT trong các quyền (mã Core-be, xem src/auth/permissions.ts). */
  permissions?: readonly string[];
  /** Có ĐỦ các quyền — trang gọi nhiều API, mỗi API một quyền. */
  allPermissions?: readonly string[];
  children: React.ReactNode;
  sx?: SxProps<Theme>;
};

export const FORBIDDEN_TITLE = 'Không có quyền truy cập';

export default function RoleBasedGuard({
  hasContent,
  roles,
  permissions,
  allPermissions,
  children,
  sx,
}: RoleBasedGuardProp) {
  const { user } = useAuthContext();

  // Gộp role + roles: người kiêm nhiều vai trò (vd Staff kiêm Admin) có quyền của MỌI vai trò, như API.
  const hasRoleAccess = hasAnyRole(getUserRoles(user), roles);

  const needsPermission = !!permissions?.length || !!allPermissions?.length;
  // Token không mang quyền: chờ /users/me nạp xong thay vì báo "không có quyền" rồi lại mở.
  if (hasRoleAccess && needsPermission && !permissionsKnown(user)) return null;

  const hasPermissionAccess = hasAnyPermission(user, permissions) && hasAllPermissions(user, allPermissions);

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
