'use client';

import { format } from 'date-fns';

import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';

import { useBoolean } from 'src/hooks/use-boolean';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomPopover, { usePopover } from 'src/components/custom-popover';

import { IRole } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

type Props = {
  selected: boolean;
  row: IRole;
  onSelectRow: VoidFunction;
  onDeleteRow: VoidFunction;
  onEditRow: VoidFunction;
};

export default function RoleTableRow({
  row,
  selected,
  onSelectRow,
  onDeleteRow,
  onEditRow,
}: Props) {
  const { name, description, permissions, isActive, createdAt } = row;

  const confirm = useBoolean();

  const popover = usePopover();

  return (
    <>
      <TableRow hover selected={selected}>
        <TableCell padding="checkbox">
          <Checkbox checked={selected} onClick={onSelectRow} />
        </TableCell>

        <TableCell sx={{ fontWeight: 'bold' }}>{name}</TableCell>

        <TableCell sx={{ color: 'text.secondary' }}>
          {description || '—'}
        </TableCell>

        <TableCell>
          <Label variant="soft" color="info">
            {permissions?.length || 0} permissions
          </Label>
        </TableCell>

        <TableCell>
          <Label variant="soft" color={isActive ? 'success' : 'error'}>
            {isActive ? 'Active' : 'Inactive'}
          </Label>
        </TableCell>

        <TableCell>
          {createdAt ? format(new Date(createdAt), 'dd MMM yyyy') : '—'}
        </TableCell>

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
        content={`Are you sure you want to delete role "${name}"?`}
        action={
          <Button variant="contained" color="error" onClick={onDeleteRow}>
            Delete
          </Button>
        }
      />
    </>
  );
}
