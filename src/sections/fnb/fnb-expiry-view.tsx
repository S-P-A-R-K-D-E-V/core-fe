'use client';

import type { IFnbLot, IFnbLotsReport, FnbLotStatus, IFnbStockIngredient } from 'src/types/fnb';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { getFnbLots, getFnbStock } from 'src/api/fnb';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { useFnbBranches } from 'src/sections/fnb-pos/use-fnb-branches';

import { fDay, fQtyWithUnit } from './lib/documents';
import { FnbDisposalCreateDialog, type FnbDisposalDraftLine } from './fnb-disposals-view';

// ----------------------------------------------------------------------
// Hạn dùng nguyên liệu: các lô còn hàng của chi nhánh (mỗi lần nhận hàng là một lô mang hạn ghi trên phiếu nhập), hạn
// sớm nhất trước. Lô quá hạn / sắp hết hạn → "Xuất huỷ" lập phiếu trừ đúng lô đó (nhân viên lập thì chờ duyệt).
// ----------------------------------------------------------------------

type Filter = 'attention' | 'all';

const LOT_STATUS: Record<
  FnbLotStatus,
  { label: string; color: 'error' | 'warning' | 'success' | 'default' }
> = {
  expired: { label: 'Quá hạn', color: 'error' },
  expiring: { label: 'Sắp hết hạn', color: 'warning' },
  ok: { label: 'Còn hạn', color: 'success' },
  none: { label: 'Không rõ hạn', color: 'default' },
};

const SOURCE_LABEL = {
  PurchaseOrder: 'Nhập hàng',
  Opening: 'Tồn đầu',
  Adjustment: 'Điều chỉnh',
} as const;

function daysText(lot: IFnbLot) {
  if (lot.daysLeft == null) return '';
  if (lot.daysLeft < 0) return `quá ${-lot.daysLeft} ngày`;
  if (lot.daysLeft === 0) return 'hết hạn hôm nay';
  return `còn ${lot.daysLeft} ngày`;
}

/** Dòng phiếu xuất huỷ cho một lô: toàn bộ lượng còn lại (đơn vị gốc), lý do theo hạn. */
function lotLine(lot: IFnbLot, ingredient: IFnbStockIngredient | undefined): FnbDisposalDraftLine {
  return {
    ingredient: ingredient ?? {
      id: lot.productId,
      code: lot.productCode,
      name: lot.productName,
      unit: lot.unit,
      kind: 'Ingredient',
      onHand: lot.remaining,
      unitCost: null,
      value: 0,
      used: 0,
      daysLeft: null,
      usedInDishes: 0,
      status: 'ok',
      units: lot.units,
      nearestExpiry: lot.expiryDate,
      expiringQuantity: 0,
      expiredQuantity: 0,
    },
    quantity: String(lot.remaining),
    unitId: null,
    reason: lot.status === 'expired' ? 'Expired' : 'Damaged',
    lotId: lot.id,
    lotLabel:
      lot.label ?? (lot.expiryDate ? `HSD ${fDay(lot.expiryDate)}` : SOURCE_LABEL[lot.source]),
  };
}

export default function FnbExpiryView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const manager = ['Admin', 'Manager'].some(
    (r) => user?.role === r || (user?.roles ?? []).includes(r)
  );
  const { branches, branchId, setBranchId } = useFnbBranches();

  const [filter, setFilter] = useState<Filter>('attention');
  const [report, setReport] = useState<IFnbLotsReport | null>(null);
  const [ingredients, setIngredients] = useState<IFnbStockIngredient[]>([]);
  const [disposeLines, setDisposeLines] = useState<FnbDisposalDraftLine[] | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    try {
      const [lots, stock] = await Promise.all([getFnbLots(branchId), getFnbStock(branchId)]);
      setReport(lots);
      setIngredients(stock.ingredients);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được hạn dùng'), { variant: 'error' });
      setReport({ today: '', expiringDays: 3, lots: [] });
    }
  }, [branchId, enqueueSnackbar]);

  useEffect(() => {
    setReport(null);
    load();
  }, [load]);

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const lots = report?.lots ?? [];
  const expired = lots.filter((l) => l.status === 'expired');
  const expiring = lots.filter((l) => l.status === 'expiring');
  const shown = filter === 'all' ? lots : [...expired, ...expiring];
  const sum = (list: IFnbLot[]) => list.reduce((s, l) => s + (l.value ?? 0), 0);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Hạn dùng nguyên liệu"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kho nguyên liệu', href: paths.dashboard.fnb.stock },
          { name: 'Hạn dùng' },
        ]}
        action={
          <Stack direction="row" spacing={1}>
            {branches && branches.length > 1 && (
              <TextField
                select
                size="small"
                label="Chi nhánh"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.branchName}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Button
              variant="contained"
              color="error"
              startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
              disabled={expired.length === 0}
              onClick={() =>
                setDisposeLines(expired.slice(0, 100).map((l) => lotLine(l, byId.get(l.productId))))
              }
            >
              Huỷ mọi lô quá hạn
            </Button>
          </Stack>
        }
        sx={{ mb: 3 }}
      />

      {branches?.length === 0 && (
        <Alert severity="info">Chưa có chi nhánh F&amp;B nào bạn được làm.</Alert>
      )}

      {report && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <Alert severity={expired.length > 0 ? 'error' : 'success'} sx={{ flex: 1 }}>
            {expired.length > 0
              ? `${expired.length} lô quá hạn${manager ? ` — ${fCurrency(sum(expired))}` : ''}: cần xuất huỷ.`
              : 'Không có lô quá hạn.'}
          </Alert>
          <Alert severity={expiring.length > 0 ? 'warning' : 'info'} sx={{ flex: 1 }}>
            {expiring.length > 0
              ? `${expiring.length} lô còn ≤ ${report.expiringDays} ngày${manager ? ` — ${fCurrency(sum(expiring))}` : ''}: ưu tiên dùng trước.`
              : `Không có lô nào sắp hết hạn trong ${report.expiringDays} ngày.`}
          </Alert>
        </Stack>
      )}

      <Card>
        <Tabs value={filter} onChange={(_, v) => setFilter(v)} sx={{ px: 2 }}>
          <Tab value="attention" label={`Cần xử lý (${expired.length + expiring.length})`} />
          <Tab value="all" label={`Mọi lô còn hàng (${lots.length})`} />
        </Tabs>
        {report === null ? (
          <Stack alignItems="center" sx={{ py: 5 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nguyên liệu</TableCell>
                  <TableCell>Lô</TableCell>
                  <TableCell>Hạn dùng</TableCell>
                  <TableCell align="right">Còn lại</TableCell>
                  {manager && <TableCell align="right">Giá trị</TableCell>}
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {shown.map((lot) => (
                  <TableRow key={lot.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2">{lot.productName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {lot.productCode}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {lot.label ?? SOURCE_LABEL[lot.source]}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {lot.source === 'PurchaseOrder'
                          ? 'Nhận '
                          : `${SOURCE_LABEL[lot.source]} · `}
                        {new Date(lot.receivedAt).toLocaleDateString('vi-VN')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">
                          {lot.expiryDate ? fDay(lot.expiryDate) : '—'}
                        </Typography>
                        <Chip
                          size="small"
                          variant="soft"
                          color={LOT_STATUS[lot.status].color}
                          label={daysText(lot) || LOT_STATUS[lot.status].label}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      {fQtyWithUnit(lot.remaining, lot.unit, lot.units)}
                    </TableCell>
                    {manager && (
                      <TableCell align="right">
                        {lot.value == null ? '—' : fCurrency(lot.value)}
                      </TableCell>
                    )}
                    <TableCell align="right">
                      <Button
                        size="small"
                        color={lot.status === 'expired' ? 'error' : 'inherit'}
                        onClick={() => setDisposeLines([lotLine(lot, byId.get(lot.productId))])}
                      >
                        Xuất huỷ
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {shown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 3, textAlign: 'center' }}
                      >
                        {filter === 'attention'
                          ? 'Không có lô nào quá hạn hay sắp hết hạn.'
                          : 'Chưa có lô nào. Hạn dùng lấy từ phiếu nhập — nhập hạn dùng cho từng dòng khi nhập nguyên liệu.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
        Mỗi lần nhận hàng là một lô mang hạn dùng ghi trên phiếu nhập. Bán / pha chế trừ lô hết hạn
        sớm nhất trước; tồn có từ trước khi theo dõi lô được chia theo các phiếu nhập gần nhất, phần
        còn lại là &quot;Tồn đầu&quot; không rõ hạn.
      </Typography>

      <FnbDisposalCreateDialog
        open={!!disposeLines}
        branchId={branchId}
        manager={manager}
        ingredients={ingredients}
        initialLines={disposeLines ?? undefined}
        onClose={() => setDisposeLines(null)}
        onCreated={(note) => {
          setDisposeLines(null);
          enqueueSnackbar(
            note.status === 'Completed'
              ? `Đã xuất huỷ — ${note.code}`
              : `Đã lập ${note.code}, chờ duyệt`
          );
          load();
        }}
      />
    </Container>
  );
}
