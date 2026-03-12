import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import CustomPopover, { usePopover } from 'src/components/custom-popover';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { useBoolean } from 'src/hooks/use-boolean';
import { IShiftTemplate } from 'src/types/corecms-api';
import { fDate } from 'src/utils/format-time';
import Box from '@mui/material/Box';

// ----------------------------------------------------------------------

type Props = {
  selected: boolean;
  onEditRow: VoidFunction;
  row: IShiftTemplate;
  onSelectRow: VoidFunction;
  onDeleteRow: VoidFunction;
  onViewSchedules: VoidFunction;
};

export default function ShiftTemplateTableRow({
  row,
  selected,
  onEditRow,
  onSelectRow,
  onDeleteRow,
  onViewSchedules,
}: Props) {
  const { name, shiftType, color, isActive, createdAt } = row;

  const confirm = useBoolean();
  const popover = usePopover();

  return (
    <>
      <TableRow hover selected={selected}>
        <TableCell padding="checkbox">
          <Checkbox checked={selected} onClick={onSelectRow} />
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>{name}</TableCell>

        <TableCell>
          <Label
            variant="soft"
            color={shiftType === 'Normal' ? 'info' : 'warning'}
          >
            {shiftType}
          </Label>
        </TableCell>

        <TableCell>
          {color && (
            <Box
              sx={{
                width: 40,
                height: 24,
                borderRadius: 1,
                backgroundColor: color,
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
          )}
        </TableCell>

        <TableCell>
          <Label variant="soft" color={isActive ? 'success' : 'default'}>
            {isActive ? 'Active' : 'Inactive'}
          </Label>
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDate(createdAt)}</TableCell>

        <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
          <IconButton color={popover.open ? 'inherit' : 'default'} onClick={popover.onOpen}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 160 }}
      >
        <MenuItem
          onClick={() => {
            onViewSchedules();
            popover.onClose();
          }}
        >
          <Iconify icon="solar:calendar-bold" />
          View Schedules
        </MenuItem>

        <MenuItem
          onClick={() => {
            onEditRow();
            popover.onClose();
          }}
        >
          <Iconify icon="solar:pen-bold" />
          Edit
        </MenuItem>

        <MenuItem
          onClick={() => {
            confirm.onTrue();
            popover.onClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Iconify icon="solar:trash-bin-trash-bold" />
          Delete
        </MenuItem>
      </CustomPopover>

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Delete"
        content="Are you sure want to delete?"
        action={
          <IconButton
            color="error"
            onClick={() => {
              onDeleteRow();
              confirm.onFalse();
            }}
          >
            Delete
          </IconButton>
        }
      />
    </>
  );
}
