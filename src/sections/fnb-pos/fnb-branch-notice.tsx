import type { Theme, SxProps } from '@mui/material/styles';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';

import { useWorkingBranch } from 'src/store/working-branch-store';

// ----------------------------------------------------------------------
// Dòng báo ở đầu các màn F&B khi chi nhánh đang làm việc (chọn ở header) không phải F&B: có chi nhánh F&B được
// làm thì cho chuyển sang ngay; không có thì báo chưa được phân công. Đang ở chi nhánh F&B → không hiện gì.
// ----------------------------------------------------------------------

type Props = {
  sx?: SxProps<Theme>;
};

export default function FnbBranchNotice({ sx }: Props) {
  const branch = useWorkingBranch((s) => s.branch);
  const options = useWorkingBranch((s) => s.options);
  const lock = useWorkingBranch((s) => s.lock);
  const select = useWorkingBranch((s) => s.select);

  if (options === null || branch?.type === 'fnb') return null;

  const fnbBranches = options.filter((b) => b.type === 'fnb');

  if (fnbBranches.length === 0) {
    return (
      <Alert severity="info" sx={sx}>
        Chưa có chi nhánh F&B nào bạn được làm. Quản lý đặt loại hình chi nhánh là F&B (trang quản trị cửa hàng) và phân
        công chi nhánh cho bạn.
      </Alert>
    );
  }

  return (
    <Alert severity="info" sx={sx}>
      Chi nhánh đang làm việc{branch ? ` (${branch.name})` : ''} không phải F&B — trang này chỉ dùng cho chi nhánh F&B.
      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mt: 1 }}>
        {fnbBranches.map((b) => (
          <Button
            key={b.id}
            size="small"
            variant="outlined"
            color="inherit"
            disabled={!!lock}
            onClick={() => select(b.id)}
          >
            Chuyển sang {b.name}
          </Button>
        ))}
      </Stack>
    </Alert>
  );
}
