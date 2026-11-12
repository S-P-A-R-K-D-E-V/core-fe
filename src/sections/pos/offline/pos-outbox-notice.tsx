import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { isUnsent } from './pos-outbox';
import { useOutboxEntries } from './use-pos-outbox';

// ----------------------------------------------------------------------
// Dải nhắc trên danh sách đơn bán hàng: máy này còn hoá đơn bán lúc mất mạng chưa lên hệ thống — số liệu đang thiếu.
// Hàng chờ chỉ gửi khi màn bán hàng mở (docs/cici/plans/pos-offline-plan.md mục 3.5).
// ----------------------------------------------------------------------

export default function PosOutboxNotice() {
  const unsent = useOutboxEntries().filter(isUnsent);
  if (unsent.length === 0) return null;
  const failed = unsent.filter((e) => e.status === 'failed').length;

  return (
    <Alert
      severity={failed > 0 ? 'error' : 'warning'}
      sx={{ mb: 2 }}
      action={
        <Button color="inherit" size="small" component={RouterLink} href={paths.dashboard.pos.sale.root}>
          Mở màn bán hàng
        </Button>
      }
    >
      Máy này còn {unsent.length} hoá đơn bán lúc mất mạng chưa lên hệ thống
      {failed > 0 ? ` (${failed} hoá đơn bị máy chủ từ chối)` : ''} — danh sách và báo cáo đang thiếu các hoá đơn này. Mở
      màn bán hàng để đồng bộ.
    </Alert>
  );
}
