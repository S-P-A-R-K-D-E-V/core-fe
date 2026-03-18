'use client';

import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useState, useCallback } from 'react';

import Iconify from 'src/components/iconify';
import { ICategory } from 'src/types/corecms-api';
import { ALL_COLUMNS, ColumnKey } from './view/product-list-view';

// ----------------------------------------------------------------------

type Props = {
  filterName: string;
  onFilterName: (event: React.ChangeEvent<HTMLInputElement>) => void;
  filterCategory: string;
  onFilterCategory: (event: React.ChangeEvent<HTMLInputElement>) => void;
  categories: ICategory[];
  visibleColumns: ColumnKey[];
  onToggleColumn: (columnId: ColumnKey) => void;
};

export default function ProductTableToolbar({
  filterName,
  onFilterName,
  filterCategory,
  onFilterCategory,
  categories,
  visibleColumns,
  onToggleColumn,
}: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleOpenColumns = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleCloseColumns = useCallback(() => {
    setAnchorEl(null);
  }, []);

  return (
    <Stack
      spacing={2}
      alignItems={{ xs: 'flex-end', md: 'center' }}
      direction={{ xs: 'column', md: 'row' }}
      sx={{ p: 2.5, pr: { xs: 2.5, md: 1 } }}
    >
      <TextField
        select
        label="Danh mục"
        value={filterCategory}
        onChange={onFilterCategory}
        sx={{ width: { xs: 1, md: 240 } }}
      >
        <MenuItem value="">Tất cả</MenuItem>
        {categories.map((c) => (
          <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
        ))}
      </TextField>

      <TextField
        fullWidth
        value={filterName}
        onChange={onFilterName}
        placeholder="Theo mã, tên hàng"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
            </InputAdornment>
          ),
        }}
      />

      <IconButton onClick={handleOpenColumns}>
        <Iconify icon="solar:settings-bold-duotone" />
      </IconButton>

      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={handleCloseColumns}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 2, width: 380 } } }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Cấu hình cột hiển thị</Typography>
        <Box
          display="grid"
          gridTemplateColumns="1fr 1fr"
          gap={0.5}
        >
          {ALL_COLUMNS.map((col) => (
            <FormControlLabel
              key={col.id}
              control={
                <Checkbox
                  size="small"
                  checked={visibleColumns.includes(col.id)}
                  onChange={() => onToggleColumn(col.id)}
                />
              }
              label={<Typography variant="body2">{col.label}</Typography>}
              sx={{ m: 0 }}
            />
          ))}
        </Box>
      </Popover>
    </Stack>
  );
}
