import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import CustomPopover, { usePopover } from 'src/components/custom-popover';

import { IShiftSchedule } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

type Props = {
  row: IShiftSchedule;
  onEditRow: VoidFunction;
  onLockToggle: VoidFunction;
};

export default function ShiftScheduleTableRow({ row, onEditRow, onLockToggle }: Props) {
  const {
    templateName,
    startTime,
    endTime,
    fromDate,
    toDate,
    repeatDaysNames,
    version,
    totalHours,
    isPayrollLocked,
    isActive,
    payrollLockerName,
  } = row;

  const popover = usePopover();

  return (
    <>
      <TableRow hover>
        <TableCell sx={{ whiteSpace: 'nowrap' }}>{templateName}</TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          {startTime} - {endTime}
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          {fromDate} {toDate && `→ ${toDate}`}
        </TableCell>

        <TableCell>
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {repeatDaysNames.map((day) => (
              <Chip key={day} label={day.substring(0, 3)} size="small" variant="outlined" />
            ))}
          </Stack>
        </TableCell>

        <TableCell align="center">
          <Label variant="soft" color="info">
            v{version}
          </Label>
        </TableCell>

        <TableCell align="center">{totalHours}h</TableCell>

        <TableCell>
          <Tooltip title={isPayrollLocked ? `Locked by ${payrollLockerName || 'System'}` : 'Unlocked'}>
            <IconButton color={isPayrollLocked ? 'error' : 'default'} onClick={onLockToggle}>
              <Iconify icon={isPayrollLocked ? 'solar:lock-bold' : 'solar:lock-unlocked-bold'} />
            </IconButton>
          </Tooltip>
        </TableCell>

        <TableCell>
          <Label variant="soft" color={isActive ? 'success' : 'default'}>
            {isActive ? 'Active' : 'Inactive'}
          </Label>
        </TableCell>

        <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
          <IconButton
            color={popover.open ? 'inherit' : 'default'}
            onClick={popover.onOpen}
            disabled={isPayrollLocked}
          >
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 140 }}
      >
        <MenuItem
          onClick={() => {
            onEditRow();
            popover.onClose();
          }}
        >
          <Iconify icon="solar:pen-bold" />
          Edit
        </MenuItem>
      </CustomPopover>
    </>
  );
}
