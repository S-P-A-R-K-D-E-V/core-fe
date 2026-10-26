import { paths } from 'src/routes/paths';

import { PATH_AFTER_LOGIN } from 'src/config-global';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

export const navConfig = [
  {
    title: 'Trang chủ',
    icon: <Iconify icon="solar:home-2-bold-duotone" />,
    path: '/',
  },
  {
    title: 'Sản phẩm',
    icon: <Iconify icon="solar:bag-smile-bold-duotone" />,
    path: paths.product.root,
  },
  {
    title: 'Tin tức',
    icon: <Iconify icon="solar:document-text-bold-duotone" />,
    path: paths.news.root,
  },
  // Trang quản lý cho nhân viên — header chỉ hiện khi đã đăng nhập (khách mua hàng không cần).
  {
    title: 'Quản lý cửa hàng',
    icon: <Iconify icon="solar:atom-bold-duotone" />,
    path: PATH_AFTER_LOGIN,
  },
];

/**
 * Menu header trang công khai: "Sản phẩm" ẩn khi cửa hàng chưa có hàng, "Tin tức" khi chưa có bài đã đăng; "Quản lý cửa
 * hàng" chỉ khi đã đăng nhập.
 */
export function mainNav({
  hasProducts,
  hasPosts = false,
  authenticated,
}: {
  hasProducts: boolean;
  hasPosts?: boolean;
  authenticated: boolean;
}) {
  return navConfig.filter(
    (item) =>
      (hasProducts || item.path !== paths.product.root) &&
      (hasPosts || item.path !== paths.news.root) &&
      (authenticated || item.path !== PATH_AFTER_LOGIN)
  );
}
