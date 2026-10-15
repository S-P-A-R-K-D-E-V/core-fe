'use client';

import { useState, useEffect, forwardRef } from 'react';

import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';

import Iconify from 'src/components/iconify';

import { parseQuantityInput } from './pos-sale-utils';

// ----------------------------------------------------------------------
// Ô số lượng của dòng hàng: −/+ và gõ số. Xoá trắng ô để gõ số mới không còn xoá mất dòng hàng (trước đây ô trống = 0 =
// xoá dòng); bỏ ra ngoài khi ô trống thì trả lại số cũ. Vượt tồn kho thì màn bán hàng từ chối và báo.
// ----------------------------------------------------------------------

type Props = {
  value: number;
  onChange: (quantity: number) => void;
  error?: boolean;
};

const PosQtyInput = forwardRef<HTMLDivElement, Props>(
  ({ value, onChange, error, ...other }, ref) => {
    const [draft, setDraft] = useState(String(value));

    useEffect(() => {
      setDraft(String(value));
    }, [value]);

    return (
      <Stack
        ref={ref}
        direction="row"
        alignItems="center"
        justifyContent="center"
        spacing={0.25}
        {...other}
      >
        <IconButton
          size="small"
          aria-label="Giảm số lượng"
          disabled={value <= 1}
          onClick={() => onChange(value - 1)}
          sx={{ p: 0.25 }}
        >
          <Iconify icon="mingcute:minimize-line" width={16} />
        </IconButton>
        <TextField
          size="small"
          value={draft}
          error={error}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '');
            setDraft(raw);
            const quantity = parseQuantityInput(raw);
            if (quantity !== null && quantity !== value) onChange(quantity);
          }}
          onBlur={() => setDraft(String(value))}
          onFocus={(e) => e.target.select()}
          inputProps={{
            inputMode: 'numeric',
            'aria-label': 'Số lượng',
            style: { textAlign: 'center' },
          }}
          sx={{ width: 52, '& .MuiOutlinedInput-input': { px: 0.5 } }}
        />
        <IconButton
          size="small"
          aria-label="Tăng số lượng"
          onClick={() => onChange(value + 1)}
          sx={{ p: 0.25 }}
        >
          <Iconify icon="mingcute:add-line" width={16} />
        </IconButton>
      </Stack>
    );
  }
);

PosQtyInput.displayName = 'PosQtyInput';

export default PosQtyInput;
