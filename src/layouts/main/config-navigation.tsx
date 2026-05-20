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
    title: 'Dashboard',
    icon: <Iconify icon="solar:atom-bold-duotone" />,
    path: PATH_AFTER_LOGIN,
  },
];
