import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import ButtonBase from '@mui/material/ButtonBase';

import Iconify from 'src/components/iconify';
import Label, { LabelColor } from 'src/components/label';
import CustomPopover, { usePopover } from 'src/components/custom-popover';

import { BranchType, canSwitchBranch, useWorkingBranch } from 'src/store/working-branch-store';

// ----------------------------------------------------------------------
// Nút chi nhánh đang làm việc trên header (kiểu "workspace" của template v6): tên chi nhánh + nhãn loại hình.
// Có từ hai chi nhánh để chọn thì bấm để đổi; chỉ một chi nhánh thì chỉ hiển thị. Màn đang có việc dở (đơn đang
// mở, máy in phiếu đang chạy) khoá nút qua useWorkingBranchLock.
// ----------------------------------------------------------------------

export const BRANCH_TYPE_META: Record<BranchType, { label: string; color: LabelColor; icon: string }> = {
  retail: { label: 'Bán lẻ', color: 'info', icon: 'solar:shop-bold' },
  fnb: { label: 'F&B', color: 'warning', icon: 'solar:cup-hot-bold' },
};

export default function BranchSwitcher() {
  const popover = usePopover();

  const branch = useWorkingBranch((s) => s.branch);
  const options = useWorkingBranch((s) => s.options);
  const lock = useWorkingBranch((s) => s.lock);
  const select = useWorkingBranch((s) => s.select);

  if (!branch) return null;

  const switchable = canSwitchBranch(options);
  const meta = BRANCH_TYPE_META[branch.type];

  const handleSelect = (id: string) => {
    select(id);
    popover.onClose();
  };

  return (
    <>
      <Tooltip title={switchable ? lock ?? 'Đổi chi nhánh làm việc' : ''}>
        <Box component="span" sx={{ display: 'inline-flex', minWidth: 0 }}>
          <ButtonBase
            disableRipple
            disabled={!switchable || !!lock}
            onClick={popover.onOpen}
            aria-label={`Chi nhánh làm việc: ${branch.name}`}
            sx={{
              py: 0.5,
              px: 1,
              gap: { xs: 0.5, sm: 1 },
              minWidth: 0,
              borderRadius: 1,
              color: 'text.primary',
              typography: 'subtitle2',
              ...(switchable && { '&:hover': { bgcolor: 'action.hover' } }),
              ...(popover.open && { bgcolor: 'action.hover' }),
            }}
          >
            <Iconify icon={meta.icon} width={24} sx={{ flexShrink: 0, color: `${meta.color}.main` }} />

            <Box
              component="span"
              sx={{
                maxWidth: { sm: 160, md: 240 },
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              {branch.name}
            </Box>

            <Label
              color={meta.color}
              sx={{
                height: 22,
                cursor: 'inherit',
                textTransform: 'none',
                display: { xs: 'none', sm: 'inline-flex' },
              }}
            >
              {meta.label}
            </Label>

            {switchable && (
              <Iconify
                width={16}
                icon="carbon:chevron-sort"
                sx={{ flexShrink: 0, color: lock ? 'text.disabled' : 'text.secondary' }}
              />
            )}
          </ButtonBase>
        </Box>
      </Tooltip>

      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="top-left" sx={{ width: 280 }}>
        {options?.map((option) => {
          const optionMeta = BRANCH_TYPE_META[option.type];

          return (
            <MenuItem
              key={option.id}
              selected={option.id === branch.id}
              onClick={() => handleSelect(option.id)}
              sx={{ height: 48 }}
            >
              <Iconify icon={optionMeta.icon} width={24} sx={{ color: `${optionMeta.color}.main` }} />

              <Box
                component="span"
                sx={{
                  flexGrow: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: 'fontWeightMedium',
                }}
              >
                {option.name}
              </Box>

              <Label color={optionMeta.color} sx={{ ml: 1, textTransform: 'none' }}>
                {optionMeta.label}
              </Label>
            </MenuItem>
          );
        })}
      </CustomPopover>
    </>
  );
}
