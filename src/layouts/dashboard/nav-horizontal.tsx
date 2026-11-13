import { memo } from 'react';

import NavModuleBar from './nav/nav-module-bar';
import { useNavTree } from './config-navigation';

// ----------------------------------------------------------------------
// Kiểu menu "Thanh ngang" (mặc định, kiểu KiotViet): thanh module + mega-menu dưới header.
// ----------------------------------------------------------------------

function NavHorizontal() {
  const tree = useNavTree();
  return <NavModuleBar tree={tree} />;
}

export default memo(NavHorizontal);
