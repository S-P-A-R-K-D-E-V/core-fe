'use client';

import { useState, useCallback } from 'react';

import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { IBarcodeLookup } from 'src/types/corecms-api';
import { lookupBarcode } from 'src/api/reports';

// ----------------------------------------------------------------------

type Props = {
  onProductFound: (product: IBarcodeLookup) => void;
  warehouseId?: string;
};

export default function BarcodeLookupField({ onProductFound, warehouseId }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLookup = useCallback(async (code: string) => {
    if (!code.trim()) return;

    try {
      setLoading(true);
      const result = await lookupBarcode(code.trim(), warehouseId);
      onProductFound(result);
      setBarcode('');
      enqueueSnackbar(`Tìm thấy: ${result.productName}`, { variant: 'success' });
    } catch (error: any) {
      const message = error?.response?.data?.title || 'Không tìm thấy sản phẩm';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [onProductFound, warehouseId, enqueueSnackbar]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLookup(barcode);
    }
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        fullWidth
        size="small"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Quét barcode hoặc nhập mã..."
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="solar:barcode-bold" width={24} />
            </InputAdornment>
          ),
          endAdornment: loading ? (
            <InputAdornment position="end">
              <CircularProgress size={20} />
            </InputAdornment>
          ) : null,
        }}
      />
    </Stack>
  );
}
