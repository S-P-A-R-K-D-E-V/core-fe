'use client';

import type { IRoutingRule, TransferStrategy } from 'src/types/online-shop';
import type { IKiotVietBankAccount } from 'src/types/corecms-api';

import { useState, useEffect } from 'react';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { DAY_LABELS } from 'src/utils/transfer-routing';

import { newRuleId, accountLabel } from './transfer-routing-utils';

// ----------------------------------------------------------------------
// Sửa một quy tắc chọn tài khoản: điều kiện (giá trị hoá đơn, khung giờ, thứ trong tuần) → tài khoản theo thứ tự + cách chọn.
// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  rule: IRoutingRule | null;
  accounts: IKiotVietBankAccount[];
  onClose: () => void;
  onSave: (rule: IRoutingRule) => void;
};

const parseMoney = (s: string): number | null => {
  const digits = s.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
};
const showMoney = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('vi-VN'));

export default function RoutingRuleDialog({ open, rule, accounts, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<TransferStrategy>('priority');
  const [thenDefault, setThenDefault] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(rule?.name ?? '');
    setMin(showMoney(rule?.when?.amountMin));
    setMax(showMoney(rule?.when?.amountMax));
    setFrom(rule?.when?.from ?? '');
    setTo(rule?.when?.to ?? '');
    setDays(rule?.when?.days ?? []);
    setPicked(rule?.accounts.map((a) => a.id) ?? []);
    setStrategy(rule?.strategy === 'round_robin' ? 'round_robin' : 'priority');
    setThenDefault(rule?.thenDefault ?? true);
  }, [open, rule]);

  const amountMin = parseMoney(min);
  const amountMax = parseMoney(max);
  const problem =
    picked.length === 0
      ? 'Chọn ít nhất một tài khoản cho quy tắc.'
      : amountMin != null && amountMax != null && amountMin >= amountMax
        ? 'Giá trị "từ" phải nhỏ hơn "dưới".'
        : !!from !== !!to
          ? 'Khung giờ cần cả giờ bắt đầu và kết thúc.'
          : from && from === to
            ? 'Giờ bắt đầu và kết thúc phải khác nhau.'
            : null;

  const save = () => {
    if (problem) return;
    onSave({
      id: rule?.id ?? newRuleId(),
      name: name.trim() || null,
      when: { amountMin, amountMax, from: from || null, to: to || null, days: days.length && days.length < 7 ? days : null },
      accounts: picked.map((id) => ({ id })),
      strategy,
      thenDefault,
    });
  };

  const byId = (id: string) => accounts.find((a) => a.id === id);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{rule ? 'Sửa quy tắc' : 'Thêm quy tắc'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Tên quy tắc" placeholder="vd Hoá đơn lớn" value={name} onChange={(e) => setName(e.target.value)} />

          <Typography variant="subtitle2">Khi (bỏ trống = không xét điều kiện đó)</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Hoá đơn từ (đ)"
              value={min}
              inputProps={{ inputMode: 'numeric' }}
              onChange={(e) => setMin(showMoney(parseMoney(e.target.value)))}
            />
            <TextField
              fullWidth
              label="Hoá đơn dưới (đ)"
              value={max}
              inputProps={{ inputMode: 'numeric' }}
              onChange={(e) => setMax(showMoney(parseMoney(e.target.value)))}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField fullWidth type="time" label="Từ giờ" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField fullWidth type="time" label="Đến giờ" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Stack>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <Chip
                key={d}
                label={DAY_LABELS[d]}
                color={days.includes(d) ? 'primary' : 'default'}
                variant={days.includes(d) ? 'filled' : 'outlined'}
                onClick={() => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]))}
              />
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {days.length ? '' : 'Mọi ngày'}
            </Typography>
          </Stack>

          <Typography variant="subtitle2">Thì dùng</Typography>
          <Autocomplete
            multiple
            options={accounts.map((a) => a.id)}
            value={picked}
            onChange={(_, v) => setPicked(v)}
            getOptionLabel={(id) => {
              const a = byId(id);
              return `${accountLabel(a)} — ${a?.accountHolder ?? ''}`;
            }}
            renderTags={(value, getTagProps) =>
              value.map((id, i) => (
                <Chip {...getTagProps({ index: i })} key={id} size="small" label={`${i + 1}. ${accountLabel(byId(id))}`} />
              ))
            }
            renderInput={(params) => <TextField {...params} label="Tài khoản (theo thứ tự chọn)" />}
          />
          <TextField select label="Cách chọn trong quy tắc" value={strategy} onChange={(e) => setStrategy(e.target.value as TransferStrategy)}>
            <MenuItem value="priority">Ưu tiên theo thứ tự</MenuItem>
            <MenuItem value="round_robin">Luân phiên</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={thenDefault} onChange={(e) => setThenDefault(e.target.checked)} />}
            label="Tài khoản trên không dùng được thì xét tiếp danh sách của kênh"
          />
          {problem && <Alert severity="warning">{problem}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Huỷ
        </Button>
        <Button variant="contained" onClick={save} disabled={!!problem}>
          Xong
        </Button>
      </DialogActions>
    </Dialog>
  );
}
