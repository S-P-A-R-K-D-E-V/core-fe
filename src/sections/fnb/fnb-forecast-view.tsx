'use client';

import type { ISupplier } from 'src/types/corecms-api';
import type { IFnbForecastRow, IFnbForecastAdvice, IFnbForecastResponse } from 'src/types/fnb';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import { getAllSuppliers } from 'src/api/suppliers';
import { getFnbForecast, analyzeFnbForecast, createFnbForecastOrders } from 'src/api/fnb';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import FnbBranchNotice from 'src/sections/fnb-pos/fnb-branch-notice';
import { useFnbBranches } from 'src/sections/fnb-pos/use-fnb-branches';

import { fQty } from './lib/stock';
import { fDay } from './lib/documents';
import {
  trendOf,
  draftLines,
  weekdayText,
  daysLeftText,
  needsAttention,
  groupBySupplier,
  aiUnavailableText,
  FORECAST_STATUS,
  CONFIDENCE_LABEL,
  type ForecastOrderDraft,
} from './lib/forecast';

// ----------------------------------------------------------------------
// Dự báo nhập nguyên liệu (chủ / quản lý): lượng dùng 28 ngày theo thứ trong tuần → số ngày còn đủ, lúc nên đặt, lượng
// nên nhập theo đơn vị nhập của lần trước. "Phân tích AI" nhờ trợ lý AI viết tóm tắt; "Tạo phiếu nhập nháp" lập phiếu
// nháp theo nhà cung cấp để quản lý xem lại và xác nhận ở trang Nhập hàng — không có gì tự đặt hàng.
// ----------------------------------------------------------------------

type Filter = 'attention' | 'all';

export default function FnbForecastView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { branchId } = useFnbBranches();

  const [data, setData] = useState<IFnbForecastResponse | null>(null);
  const [filter, setFilter] = useState<Filter>('attention');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [advice, setAdvice] = useState<IFnbForecastAdvice | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [drafting, setDrafting] = useState<ForecastOrderDraft[] | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    try {
      const result = await getFnbForecast(branchId);
      setData(result);
      // Chọn sẵn các dòng cần đặt có gợi ý nhập.
      setSelected(
        new Set(
          result.report.rows
            .filter((r) => (r.status === 'out' || r.status === 'order') && r.purchase && !r.makeInHouse)
            .map((r) => r.id)
        )
      );
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được dự báo nhập'), { variant: 'error' });
    }
  }, [branchId, enqueueSnackbar]);

  useEffect(() => {
    setData(null);
    setAdvice(null);
    load();
  }, [load]);

  const report = data?.report;
  const rows = useMemo(
    () => (report ? (filter === 'all' ? report.rows : report.rows.filter(needsAttention)) : []),
    [report, filter]
  );
  const count = (status: IFnbForecastRow['status'][]) => report?.rows.filter((r) => status.includes(r.status)).length ?? 0;
  const orderable = (r: IFnbForecastRow) => !!r.purchase && !r.makeInHouse && r.purchase.quantity > 0;
  const chosen = report?.rows.filter((r) => selected.has(r.id) && orderable(r)) ?? [];

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const analyze = async () => {
    if (!branchId) return;
    setAnalyzing(true);
    try {
      setAdvice(await analyzeFnbForecast(branchId));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'AI chưa phân tích được'), { variant: 'error' });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Dự báo nhập nguyên liệu"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kho nguyên liệu', href: paths.dashboard.fnb.stock },
          { name: 'Dự báo nhập' },
        ]}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={data && !data.aiAvailable ? aiUnavailableText(data.aiUnavailableReason) : ''}>
              <span>
                <LoadingButton
                  variant="outlined"
                  loading={analyzing}
                  disabled={!data?.aiAvailable}
                  startIcon={<Iconify icon="solar:magic-stick-3-bold" />}
                  onClick={analyze}
                >
                  Phân tích AI
                </LoadingButton>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              disabled={chosen.length === 0}
              startIcon={<Iconify icon="solar:cart-plus-bold" />}
              onClick={() => setDrafting(draftLines(chosen))}
            >
              Tạo phiếu nhập nháp{chosen.length > 0 ? ` (${chosen.length})` : ''}
            </Button>
          </Stack>
        }
        sx={{ mb: 3 }}
      />

      <FnbBranchNotice sx={{ mb: 2 }} />

      {report && (
        <>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <Summary title="Cần đặt ngay" value={count(['out', 'order'])} color="error.main" />
            <Summary title="Sắp tới lúc đặt" value={count(['soon'])} color="warning.main" />
            <Summary title="Đã đặt, chờ hàng về" value={count(['ordered'])} color="info.main" />
            <Summary title="Có hàng sẽ hỏng" value={report.rows.filter((r) => r.waste > 0).length} color="text.primary" />
          </Stack>

          <Alert
            severity={report.confidence === 'low' ? 'warning' : 'info'}
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" component={RouterLink} href={paths.dashboard.automation.root}>
                Đổi thiết lập
              </Button>
            }
          >
            Tính theo lượng dùng {report.historyDays} ngày gần nhất (pha chế + pha mẻ) theo thứ trong tuần · hàng về sau{' '}
            {report.settings.leadDays} ngày · dự phòng {report.settings.safetyDays} ngày · mỗi lần nhập đủ dùng{' '}
            {report.settings.coverDays} ngày. Độ tin cậy {CONFIDENCE_LABEL[report.confidence]} ({report.dataDays} ngày
            có dữ liệu){report.confidence === 'low' ? ' — mới dùng chưa đủ 7 ngày, số dự báo chỉ để tham khảo' : ''}. Ngày
            lễ, khuyến mại, thời tiết có thể làm lệch dự báo.
          </Alert>
        </>
      )}

      {advice && (
        <Card sx={{ p: 2.5, mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Iconify icon="solar:magic-stick-3-bold" color="primary.main" />
            <Typography variant="subtitle1">Phân tích của AI</Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(advice.generatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} — AI viết
              từ bảng số bên dưới, nên kiểm tra lại trước khi đặt hàng
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {advice.text}
          </Typography>
        </Card>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip
          label="Cần chú ý"
          color={filter === 'attention' ? 'primary' : 'default'}
          variant={filter === 'attention' ? 'filled' : 'outlined'}
          onClick={() => setFilter('attention')}
        />
        <Chip
          label="Tất cả nguyên liệu"
          color={filter === 'all' ? 'primary' : 'default'}
          variant={filter === 'all' ? 'filled' : 'outlined'}
          onClick={() => setFilter('all')}
        />
      </Stack>

      <Card>
        {!report ? (
          <Stack alignItems="center" sx={{ py: 5 }}>
            {branchId ? <CircularProgress /> : null}
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>Nguyên liệu</TableCell>
                  <TableCell align="right">Tồn</TableCell>
                  <TableCell align="right">Dùng / ngày</TableCell>
                  <TableCell align="right">Còn đủ</TableCell>
                  <TableCell align="right">Đang đặt</TableCell>
                  <TableCell>Gợi ý</TableCell>
                  <TableCell align="right">Ước tính</TableCell>
                  <TableCell>Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <ForecastRow
                    key={row.id}
                    row={row}
                    checked={selected.has(row.id)}
                    selectable={orderable(row)}
                    onToggle={() => toggle(row.id)}
                  />
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                        {filter === 'attention'
                          ? 'Chưa có nguyên liệu nào cần đặt hay sắp hỏng.'
                          : 'Chưa có nguyên liệu nào có tồn hoặc lượng dùng.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {drafting && branchId && (
        <FnbForecastOrderDialog
          branchId={branchId}
          lines={drafting}
          onClose={() => setDrafting(null)}
          onCreated={() => {
            setDrafting(null);
            load();
          }}
        />
      )}
    </Container>
  );
}

// ----------------------------------------------------------------------

function Summary({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <Card sx={{ p: 2, flex: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h5" color={value > 0 ? color : 'text.disabled'}>
        {value}
      </Typography>
    </Card>
  );
}

type RowProps = { row: IFnbForecastRow; checked: boolean; selectable: boolean; onToggle: VoidFunction };

function ForecastRow({ row, checked, selectable, onToggle }: RowProps) {
  const unit = row.unit ?? '';
  const status = FORECAST_STATUS[row.status];
  const trend = trendOf(row);
  return (
    <TableRow hover>
      <TableCell padding="checkbox">
        {selectable && <Checkbox size="small" checked={checked} onChange={onToggle} />}
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2">{row.name}</Typography>
          {row.makeInHouse && <Chip size="small" variant="soft" color="secondary" label="Pha tại quán" />}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {row.code}
          {unit ? ` · ${unit}` : ''}
          {row.confidence === 'low' ? ' · dữ liệu ít' : ''}
        </Typography>
      </TableCell>
      <TableCell align="right">
        {fQty(row.onHand)}
        {row.waste > 0 && (
          <Typography variant="caption" color="error.main" display="block">
            sẽ hỏng {fQty(row.waste)}
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">
        <Tooltip title={`Dự báo theo thứ: ${weekdayText(row)}`}>
          <span>{row.avgDaily ? fQty(Math.round(row.avgDaily * 10) / 10) : '—'}</span>
        </Tooltip>
        {trend && (
          <Typography variant="caption" color={trend === 'up' ? 'error.main' : 'info.main'} display="block">
            {trend === 'up' ? '↑' : '↓'} {fQty(row.trend ?? 0)}× tuần trước
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">
        {daysLeftText(row)}
        {row.runOutDate && row.status !== 'out' && (
          <Typography variant="caption" color="text.secondary" display="block">
            hết khoảng {fDay(row.runOutDate)}
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">{row.onOrder > 0 ? fQty(row.onOrder) : '—'}</TableCell>
      <TableCell>
        {row.makeInHouse && row.suggestedQuantity > 0 && (
          <Button size="small" component={RouterLink} href={paths.dashboard.fnb.batches}>
            Pha thêm ~{fQty(Math.round(row.suggestedQuantity))} {unit}
          </Button>
        )}
        {row.purchase && (
          <>
            <Typography variant="body2">
              {fQty(row.purchase.quantity)} {row.purchase.unitName ?? unit}
              {row.purchase.factor > 1 ? ` (${fQty(row.suggestedQuantity)} ${unit})` : ''}
            </Typography>
            <Typography variant="caption" color={row.supplierName ? 'text.secondary' : 'warning.main'}>
              {row.supplierName ?? 'chưa rõ nhà cung cấp'}
            </Typography>
          </>
        )}
        {!row.purchase && !(row.makeInHouse && row.suggestedQuantity > 0) && '—'}
      </TableCell>
      <TableCell align="right">{row.estimatedCost ? fCurrency(row.estimatedCost) : '—'}</TableCell>
      <TableCell>
        <Chip size="small" variant="soft" color={status.color} label={status.label} />
      </TableCell>
    </TableRow>
  );
}

// ----------------------------------------------------------------------

type DialogProps = {
  branchId: string;
  lines: ForecastOrderDraft[];
  onClose: VoidFunction;
  onCreated: VoidFunction;
};

function FnbForecastOrderDialog({ branchId, lines: initial, onClose, onCreated }: DialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [lines, setLines] = useState(initial);
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ orderId: string; supplierId: string; lines: number }[] | null>(null);

  useEffect(() => {
    getAllSuppliers({ isActive: true })
      .then(setSuppliers)
      .catch(() => setSuppliers([]));
  }, []);

  const groups = groupBySupplier(lines);
  const supplierName = (id: string) =>
    suppliers.find((s) => s.id === id)?.name ?? lines.find((l) => l.supplierId === id)?.supplierName ?? '';
  const missing = lines.filter((l) => !l.supplierId).length;
  const invalid = lines.some((l) => !(l.quantity > 0));

  const update = (productId: string, patch: Partial<ForecastOrderDraft>) =>
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));

  const submit = async () => {
    setSaving(true);
    try {
      const result = await createFnbForecastOrders(
        branchId,
        lines.map((l) => ({ productId: l.productId, supplierId: l.supplierId, quantity: l.quantity, unitId: l.unitId }))
      );
      setCreated(result);
      enqueueSnackbar(`Đã tạo ${result.length} phiếu nhập nháp`);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tạo được phiếu nhập nháp'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="md" open onClose={saving ? undefined : created ? onCreated : onClose}>
      <DialogTitle>Tạo phiếu nhập nháp</DialogTitle>
      <DialogContent dividers>
        {created ? (
          <Stack spacing={1.5}>
            <Alert severity="success">
              Đã tạo {created.length} phiếu nhập nháp. Mở từng phiếu để xem lại giá, xác nhận với nhà cung cấp và nhận hàng
              khi hàng về.
            </Alert>
            {created.map((c) => (
              <Button
                key={c.orderId}
                variant="outlined"
                sx={{ justifyContent: 'flex-start' }}
                component={RouterLink}
                href={paths.dashboard.pos.purchaseOrder.details(c.orderId)}
                endIcon={<Iconify icon="eva:arrow-ios-forward-fill" />}
              >
                {supplierName(c.supplierId) || 'Nhà cung cấp'} · {c.lines} dòng
              </Button>
            ))}
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Mỗi nhà cung cấp một phiếu nháp. Sửa số lượng nếu cần; giá lấy theo lần nhập trước, sửa được trong phiếu.
            </Typography>
            {[...groups.entries()].map(([supplierId, group]) => (
              <Card key={supplierId || 'none'} variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                  {supplierId ? supplierName(supplierId) : 'Chưa rõ nhà cung cấp — chọn cho từng dòng'}
                </Typography>
                <Stack spacing={1.5}>
                  {group.map((line) => (
                    <Stack
                      key={line.productId}
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      alignItems={{ sm: 'center' }}
                    >
                      <Typography variant="body2" sx={{ flex: 2 }}>
                        {line.name}
                      </Typography>
                      {!supplierId && (
                        <TextField
                          select
                          size="small"
                          label="Nhà cung cấp"
                          value={line.supplierId}
                          onChange={(e) => update(line.productId, { supplierId: e.target.value })}
                          sx={{ flex: 2, minWidth: 180 }}
                        >
                          {suppliers.map((s) => (
                            <MenuItem key={s.id} value={s.id}>
                              {s.name}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                      <TextField
                        size="small"
                        type="number"
                        label="Số lượng"
                        value={Number.isFinite(line.quantity) && line.quantity !== 0 ? line.quantity : ''}
                        onChange={(e) => update(line.productId, { quantity: Number(e.target.value) })}
                        inputProps={{ min: 0, step: 'any' }}
                        InputProps={{ endAdornment: <InputAdornment position="end">{line.unitName}</InputAdornment> }}
                        sx={{ width: 170 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90, textAlign: 'right' }}>
                        {line.unitPrice != null && line.quantity > 0 ? fCurrency(line.unitPrice * line.quantity) : ''}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Card>
            ))}
            {missing > 0 && suppliers.length === 0 && (
              <Alert severity="warning">Cửa hàng chưa có nhà cung cấp nào — thêm ở trang Nhà cung cấp trước.</Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {created ? (
          <Button variant="contained" onClick={onCreated}>
            Xong
          </Button>
        ) : (
          <>
            <Button variant="outlined" onClick={onClose} disabled={saving}>
              Đóng
            </Button>
            <LoadingButton variant="contained" loading={saving} disabled={missing > 0 || invalid} onClick={submit}>
              Tạo {groups.size} phiếu nháp
            </LoadingButton>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
