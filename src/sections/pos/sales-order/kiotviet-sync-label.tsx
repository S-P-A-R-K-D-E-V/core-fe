import Tooltip from '@mui/material/Tooltip';

import { kiotVietSyncDisplay } from 'src/utils/kiotviet-sync-status';

import Label from 'src/components/label';

import { ISalesOrder } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

type Props = {
  order: ISalesOrder;
};

/** Nhãn KiotViet của hoá đơn; chú thích (lỗi đẩy / mã đơn KiotViet / giải thích nhãn) hiện khi rê chuột. */
export default function KiotVietSyncLabel({ order }: Props) {
  const { label, color, hint } = kiotVietSyncDisplay(order);

  return (
    <Tooltip title={hint}>
      <span>
        <Label variant="soft" color={color}>
          {label}
        </Label>
      </span>
    </Tooltip>
  );
}
