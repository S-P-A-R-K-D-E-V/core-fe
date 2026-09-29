'use client';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------
// Chọn quyền cho khoá API theo nhóm: danh mục → nhóm (domain của quyền) → từng quyền. Tích ô ở
// danh mục / nhóm để chọn tất cả bên trong. Quyền ghi (không phải .read) được đánh dấu.

const DOMAIN_LABELS: Record<string, string> = {
  analytics: 'Báo cáo & phân tích',
  orders: 'Đơn hàng',
  'pos-cart': 'Giỏ hàng POS',
  customers: 'Khách hàng',
  coupon: 'Mã giảm giá',
  'promotion-campaign': 'Khuyến mại',
  'sales-return': 'Trả hàng bán',
  kiotviet: 'KiotViet',
  products: 'Sản phẩm',
  inventory: 'Tồn kho',
  stocktake: 'Kiểm kho',
  purchase: 'Nhập hàng',
  'purchase-return': 'Trả hàng nhập',
  'damage-note': 'Xuất huỷ',
  'internal-use-note': 'Xuất dùng nội bộ',
  brand: 'Thương hiệu',
  unit: 'Đơn vị tính',
  'supplier-group': 'Nhóm nhà cung cấp',
  employees: 'Nhân viên',
  shift: 'Ca làm',
  attendance: 'Chấm công',
  payroll: 'Lương',
  cash: 'Kiểm tiền ca',
  'cash-fund': 'Quỹ tiền',
  'cash-flow-category': 'Danh mục thu chi',
  'cash-voucher': 'Phiếu thu / chi',
  expense: 'Chi phí',
  'partner-voucher': 'Công nợ đối tác',
  settlement: 'Chốt sổ',
  shareholder: 'Cổ đông',
};

const CATEGORIES: { label: string; icon: string; domains: string[] }[] = [
  { label: 'Báo cáo', icon: 'solar:chart-2-bold', domains: ['analytics'] },
  {
    label: 'Bán hàng',
    icon: 'solar:cart-large-2-bold',
    domains: [
      'orders',
      'pos-cart',
      'customers',
      'coupon',
      'promotion-campaign',
      'sales-return',
      'kiotviet',
    ],
  },
  {
    label: 'Hàng hoá & kho',
    icon: 'solar:box-bold',
    domains: [
      'products',
      'inventory',
      'stocktake',
      'purchase',
      'purchase-return',
      'damage-note',
      'internal-use-note',
      'brand',
      'unit',
      'supplier-group',
    ],
  },
  {
    label: 'Nhân sự, ca & lương',
    icon: 'solar:users-group-rounded-bold',
    domains: ['employees', 'shift', 'attendance', 'payroll'],
  },
  {
    label: 'Thu chi & tài chính',
    icon: 'solar:wallet-money-bold',
    domains: [
      'cash',
      'cash-fund',
      'cash-flow-category',
      'cash-voucher',
      'expense',
      'partner-voucher',
      'settlement',
      'shareholder',
    ],
  },
];

/** Nhóm có từ chừng này quyền trở lên chiếm cả hàng, quyền xếp nhiều cột. */
const LARGE_GROUP = 6;

export const isReadPermission = (permission: string) => /\.read(\.|$)/.test(permission);

function domainOf(permission: string, domains: string[]): string {
  return (
    domains.filter((d) => permission.startsWith(`${d}.`)).sort((a, b) => b.length - a.length)[0] ??
    permission.split('.')[0]
  );
}

type Props = {
  domains: string[];
  permissions: string[];
  value: string[];
  onChange: (value: string[]) => void;
};

export default function AgentPermissionPicker({ domains, permissions, value, onChange }: Props) {
  const [search, setSearch] = useState('');
  const selected = useMemo(() => new Set(value), [value]);

  // danh mục → [nhóm, quyền của nhóm]; nhóm chưa khai báo ở CATEGORIES rơi vào "Khác".
  const groups = useMemo(() => {
    const byDomain = new Map<string, string[]>();
    permissions.forEach((p) => {
      const d = domainOf(p, domains);
      byDomain.set(d, [...(byDomain.get(d) ?? []), p]);
    });
    const known = new Set(CATEGORIES.flatMap((c) => c.domains));
    const others = [...byDomain.keys()].filter((d) => !known.has(d)).sort();
    return [...CATEGORIES, { label: 'Khác', icon: 'solar:widget-bold', domains: others }]
      .map((c) => ({
        ...c,
        domains: c.domains
          .filter((d) => byDomain.has(d))
          .map((d) => ({ domain: d, permissions: byDomain.get(d)!.sort() })),
      }))
      .filter((c) => c.domains.length > 0);
  }, [permissions, domains]);

  const keyword = search.trim().toLowerCase();
  const matches = (domain: string, permission: string) =>
    !keyword ||
    permission.toLowerCase().includes(keyword) ||
    (DOMAIN_LABELS[domain] ?? domain).toLowerCase().includes(keyword);

  const setMany = (items: string[], checked: boolean) => {
    const next = new Set(selected);
    items.forEach((p) => (checked ? next.add(p) : next.delete(p)));
    onChange(permissions.filter((p) => next.has(p)));
  };

  const groupBox = (items: string[]) => {
    const count = items.filter((p) => selected.has(p)).length;
    return {
      checked: count > 0 && count === items.length,
      indeterminate: count > 0 && count < items.length,
      count,
      onChange: (_: unknown, checked: boolean) => setMany(items, checked),
    };
  };

  const writeCount = value.filter((p) => !isReadPermission(p)).length;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
        <TextField
          size="small"
          placeholder="Tìm quyền hoặc nhóm (vd: lương, orders, read)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" />
              </InputAdornment>
            ),
          }}
        />
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            onClick={() => onChange(permissions.filter(isReadPermission))}
          >
            Chỉ đọc (khuyên dùng)
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            onClick={() => onChange([...permissions])}
          >
            Toàn quyền
          </Button>
          <Button size="small" color="inherit" onClick={() => onChange([])}>
            Bỏ chọn
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Đã chọn <b>{value.length}</b>/{permissions.length} quyền
        {writeCount > 0 && (
          <>
            {' '}
            · trong đó <b>{writeCount}</b> quyền ghi
          </>
        )}
      </Typography>

      {writeCount > 0 && (
        <Alert severity="warning" sx={{ py: 0 }}>
          Khoá có quyền ghi: agent sửa / tạo / xoá được dữ liệu trong phạm vi đó. Thao tác nguy hiểm
          (xoá đơn, chốt lương…) vẫn phải qua bước xác nhận.
        </Alert>
      )}

      <Box sx={{ maxHeight: '58vh', overflowY: 'auto', pr: 0.5 }}>
        <Stack spacing={3}>
          {groups.map((category) => {
            const visibleDomains = category.domains
              .map((g) => ({
                ...g,
                permissions: g.permissions.filter((p) => matches(g.domain, p)),
              }))
              .filter((g) => g.permissions.length > 0);
            if (visibleDomains.length === 0) return null;
            const all = category.domains.flatMap((g) => g.permissions);
            const box = groupBox(all);
            return (
              <Box key={category.label}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <Checkbox
                    size="small"
                    checked={box.checked}
                    indeterminate={box.indeterminate}
                    onChange={box.onChange}
                  />
                  <Iconify icon={category.icon} width={20} sx={{ color: 'text.secondary' }} />
                  <Typography variant="subtitle1">{category.label}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {box.count}/{all.length}
                  </Typography>
                </Stack>

                {/* Nhóm lớn (>= LARGE_GROUP quyền) chiếm cả hàng, quyền xếp nhiều cột; nhóm nhỏ xếp lưới cạnh nhau. */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                    gridAutoFlow: 'row dense',
                    alignItems: 'start',
                    gap: 1.5,
                  }}
                >
                  {[...visibleDomains]
                    .sort(
                      (a, b) =>
                        Number(b.permissions.length >= LARGE_GROUP) -
                        Number(a.permissions.length >= LARGE_GROUP)
                    )
                    .map((g) => {
                      const fullGroup = category.domains.find(
                        (d) => d.domain === g.domain
                      )!.permissions;
                      const gb = groupBox(fullGroup);
                      const large = g.permissions.length >= LARGE_GROUP;
                      return (
                        <Box
                          key={g.domain}
                          sx={{
                            gridColumn: large ? '1 / -1' : 'auto',
                            p: 1,
                            borderRadius: 1.5,
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                            bgcolor: gb.count > 0 ? 'action.hover' : 'transparent',
                          }}
                        >
                          <Stack direction="row" alignItems="center" sx={{ mb: 0.5 }}>
                            <Checkbox
                              size="small"
                              checked={gb.checked}
                              indeterminate={gb.indeterminate}
                              onChange={gb.onChange}
                            />
                            <Typography variant="subtitle2" sx={{ flex: 1 }}>
                              {DOMAIN_LABELS[g.domain] ?? g.domain}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', pr: 1 }}>
                              {gb.count}/{fullGroup.length}
                            </Typography>
                          </Stack>
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: large
                                ? 'repeat(auto-fill, minmax(230px, 1fr))'
                                : '1fr',
                              columnGap: 1,
                            }}
                          >
                            {g.permissions.map((p) => (
                              <Stack
                                key={p}
                                direction="row"
                                alignItems="center"
                                spacing={0.5}
                                onClick={() => setMany([p], !selected.has(p))}
                                sx={{
                                  pl: 2,
                                  cursor: 'pointer',
                                  borderRadius: 1,
                                  '&:hover': { bgcolor: 'action.selected' },
                                }}
                              >
                                <Checkbox
                                  size="small"
                                  checked={selected.has(p)}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(_, checked) => setMany([p], checked)}
                                  sx={{ p: 0.5 }}
                                />
                                <Tooltip title={p} placement="top-start">
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontFamily: 'monospace',
                                      fontSize: 12.5,
                                      flex: 1,
                                      minWidth: 0,
                                    }}
                                    noWrap
                                  >
                                    {p.slice(g.domain.length + 1) || p}
                                  </Typography>
                                </Tooltip>
                                {!isReadPermission(p) && (
                                  <Chip
                                    label="Ghi"
                                    size="small"
                                    color="warning"
                                    variant="soft"
                                    sx={{ height: 18, fontSize: 11 }}
                                  />
                                )}
                              </Stack>
                            ))}
                          </Box>
                        </Box>
                      );
                    })}
                </Box>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Stack>
  );
}
