'use client';

import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';

import Iconify from 'src/components/iconify';
import { ICategory } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

type Props = {
  filterName: string;
  onFilterName: (event: React.ChangeEvent<HTMLInputElement>) => void;
  filterCategory: string;
  onFilterCategory: (event: React.ChangeEvent<HTMLInputElement>) => void;
  categories: ICategory[];
};

export default function ProductTableToolbar({
  filterName,
  onFilterName,
  filterCategory,
  onFilterCategory,
  categories,
}: Props) {
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
        placeholder="Tìm kiếm sản phẩm..."
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
            </InputAdornment>
          ),
        }}
      />
    </Stack>
  );
}
