import { useMemo } from 'react';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';

// ----------------------------------------------------------------------
// Quyền hộp thư khách của người đang đăng nhập (chủ cửa hàng luôn đủ quyền).

export function useInboxPermissions() {
  const { user } = useAuthContext();
  return useMemo(
    () => ({
      myUserId: (user?.id as string | undefined) ?? null,
      read: hasPermission(user, PERMISSIONS.conversation.read),
      reply: hasPermission(user, PERMISSIONS.conversation.reply),
      manage: hasPermission(user, PERMISSIONS.conversation.manage),
    }),
    [user]
  );
}
