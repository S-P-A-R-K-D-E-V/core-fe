import Box from '@mui/material/Box';

import { NAV } from '../config-layout';
import NavRail from './nav/nav-rail';
import { useNavTree } from './config-navigation';
import NavToggleButton from '../common/nav-toggle-button';

// ----------------------------------------------------------------------
// Kiểu menu "Thanh bên thu gọn": cột icon module + flyout cấp 2–3.
// ----------------------------------------------------------------------

export default function NavMini() {
  const tree = useNavTree();

  return (
    <Box sx={{ flexShrink: { lg: 0 }, width: { lg: NAV.W_MINI } }}>
      <NavToggleButton sx={{ top: 22, left: NAV.W_MINI - 12 }} />
      <NavRail tree={tree} />
    </Box>
  );
}
