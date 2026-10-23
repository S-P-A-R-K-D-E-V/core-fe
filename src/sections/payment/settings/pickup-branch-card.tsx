'use client';

import type { IPickupBranch, IOnlineShopSettings } from 'src/types/online-shop';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';

import BranchPickupDialog from './branch-pickup-dialog';

// ----------------------------------------------------------------------
// Chi nhánh gửi hàng: hãng vận chuyển lấy hàng ở địa chỉ gửi hàng của chi nhánh này (GHN from_*, Ahamove điểm lấy) — gửi
// kèm mỗi báo giá / vận đơn. Để "Tự động" = chi nhánh đang hoạt động đầu tiên có địa chỉ gửi hàng.
// ----------------------------------------------------------------------

export function pickupLine(b: IPickupBranch): string | null {
  return b.pickup ? `${b.pickup.street}, ${b.pickup.wardName}, ${b.pickup.provinceName}` : null;
}

type Props = {
  settings: IOnlineShopSettings;
  /** Chi nhánh đang chọn trong form (chưa lưu); null = tự động */
  value: string | null;
  onChange: (branchId: string | null) => void;
  /** Tải lại danh sách chi nhánh sau khi sửa địa chỉ gửi hàng */
  onRefresh: () => void;
};

export default function PickupBranchCard({ settings, value, onChange, onRefresh }: Props) {
  const [editing, setEditing] = useState<IPickupBranch | null>(null);
  const branches = (settings.branches ?? []).filter((b) => b.isActive);
  const effective = branches.find((b) => b.id === settings.effectivePickupBranchId) ?? null;

  return (
    <Card>
      <CardHeader
        title="Chi nhánh gửi hàng"
        subheader="Hãng vận chuyển đến lấy hàng (và hoàn hàng) ở địa chỉ gửi hàng của chi nhánh này — không cần sửa địa chỉ trên trang của hãng."
      />
      <Stack spacing={2} sx={{ p: 3, pt: 2 }}>
        {!effective && (
          <Alert severity="warning">
            Chưa có chi nhánh nào có địa chỉ gửi hàng. Nhập địa chỉ cho chi nhánh lấy hàng — chưa có thì GHN lấy theo địa chỉ khai
            trên trang GHN, Ahamove không báo giá được.
          </Alert>
        )}
        <TextField
          select
          label="Lấy hàng tại"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          helperText={
            value === null && effective ? `Đang tự động dùng: ${effective.name}` : 'Lưu cài đặt để áp dụng cho báo giá mới'
          }
        >
          <MenuItem value="">Tự động — chi nhánh đầu tiên có địa chỉ gửi hàng</MenuItem>
          {branches.map((b) => (
            <MenuItem key={b.id} value={b.id} disabled={!b.pickup}>
              {b.name}
              {!b.pickup && ' (chưa có địa chỉ gửi hàng)'}
            </MenuItem>
          ))}
        </TextField>

        {branches.map((b) => (
          <Stack
            key={b.id}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
            sx={{ p: 1.5, borderRadius: 1, border: (theme) => `1px solid ${theme.palette.divider}` }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="subtitle2">{b.name}</Typography>
                {b.id === settings.effectivePickupBranchId && <Chip size="small" color="success" variant="soft" label="Đang dùng" />}
              </Stack>
              {b.pickup ? (
                <Typography variant="body2" color="text.secondary">
                  {pickupLine(b)} · {b.pickup.senderName}
                  {b.pickup.phone ? ` · ${b.pickup.phone}` : ''}
                </Typography>
              ) : (
                <Typography variant="body2" color="warning.main">
                  Chưa có địa chỉ gửi hàng{b.address ? ` (địa chỉ chi nhánh: ${b.address})` : ''}
                </Typography>
              )}
            </Box>
            <Button size="small" variant={b.pickup ? 'text' : 'contained'} onClick={() => setEditing(b)}>
              {b.pickup ? 'Sửa' : 'Nhập địa chỉ gửi hàng'}
            </Button>
          </Stack>
        ))}
      </Stack>

      <BranchPickupDialog
        open={!!editing}
        branch={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onRefresh();
        }}
      />
    </Card>
  );
}
