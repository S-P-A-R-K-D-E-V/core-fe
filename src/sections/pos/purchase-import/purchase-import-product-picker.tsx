'use client';

import { useRef, useState, useEffect } from 'react';

import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';

import { fCurrency } from 'src/utils/format-number';

import { getAllProducts } from 'src/api/products';

import type { IProductListItem } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Chọn mã hàng khác cho một dòng hoá đơn. Hàng gốc và từng hàng con (đơn vị / thuộc tính) đều là một mã nhập được —
// cùng cách Core-be gợi ý (PurchaseImportRepository.SearchSkusAsync).
// ----------------------------------------------------------------------

export type PickedProduct = { id: string; code: string; name: string; price?: number };

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

function flatten(items: IProductListItem[]): PickedProduct[] {
  return items.flatMap((p) => [
    { id: p.id, code: p.sku || p.code, name: p.fullName || p.name, price: p.sellingPrice ?? p.basePrice },
    ...(p.childProducts ?? [])
      .filter((c) => c.isActive !== false)
      .map((c) => ({ id: c.id, code: c.code, name: c.fullName || c.name, price: c.basePrice })),
  ]);
}

type Props = {
  /** Gợi ý ô tìm (tên đọc được trên hoá đơn). */
  defaultKeyword?: string;
  disabled?: boolean;
  onPick: (product: PickedProduct) => void;
};

export default function PurchaseImportProductPicker({ defaultKeyword, disabled, onPick }: Props) {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<PickedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const request = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (keyword: string) => {
    clearTimeout(timer.current);
    if (keyword.trim().length < MIN_CHARS) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const current = ++request.current;
    timer.current = setTimeout(() => {
      getAllProducts({ keyword: keyword.trim(), pageSize: 20 })
        .then((res) => current === request.current && setOptions(flatten(res.items)))
        .catch(() => current === request.current && setOptions([]))
        .finally(() => current === request.current && setLoading(false));
    }, DEBOUNCE_MS);
  };

  return (
    <Autocomplete
      size="small"
      fullWidth
      disabled={disabled}
      options={options}
      loading={loading}
      value={null}
      inputValue={input}
      filterOptions={(x) => x}
      noOptionsText={input.trim().length < MIN_CHARS ? 'Gõ tên hoặc mã hàng' : 'Không tìm thấy'}
      getOptionLabel={(o) => `${o.code} — ${o.name}`}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      onOpen={() => {
        if (!input && defaultKeyword) {
          setInput(defaultKeyword);
          search(defaultKeyword);
        }
      }}
      onInputChange={(_, value, reason) => {
        if (reason === 'reset') return;
        setInput(value);
        search(value);
      }}
      onChange={(_, value) => {
        if (!value) return;
        setInput('');
        setOptions([]);
        onPick(value);
      }}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
            <strong>{option.code}</strong> — {option.name}
          </Typography>
          {!!option.price && (
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1, flexShrink: 0 }}>
              bán {fCurrency(option.price)}
            </Typography>
          )}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Chọn mã khác…"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading && <CircularProgress color="inherit" size={16} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
