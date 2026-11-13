'use client';

import { useEffect } from 'react';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useAuthContext } from 'src/auth/hooks';

import { LoadingScreen } from 'src/components/loading-screen';

import { useNavTree } from '../config-navigation';

// ----------------------------------------------------------------------
// /dashboard: chờ /users/me (navMenu) rồi chuyển tới trang mở đầu của vai trò. Chưa cấu hình → Kiểm quầy nếu người này
// thấy, không thì trang đầu tiên trong menu. Không đợi quá 1,5 s (Core-be cũ không trả navMenu).
// ----------------------------------------------------------------------

export default function NavHomeRedirect() {
  const router = useRouter();
  const { user } = useAuthContext();
  const tree = useNavTree();

  const profileLoaded = user?.navMenu !== undefined || Array.isArray(user?.permissions);

  useEffect(() => {
    const go = () => {
      const byKey = new Map(tree.pages.map((p) => [p.key, p]));
      const home =
        (tree.homeKey && byKey.get(tree.homeKey)) ||
        byKey.get('cash.shift') ||
        tree.pages[0] ||
        null;
      router.replace(home?.path ?? paths.dashboard.shiftCash.root);
    };
    if (profileLoaded && user?.navMenu !== undefined) {
      go();
      return undefined;
    }
    const timer = setTimeout(go, 1500);
    return () => clearTimeout(timer);
  }, [profileLoaded, user?.navMenu, tree, router]);

  return <LoadingScreen />;
}
