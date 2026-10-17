'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import TableContainer from '@mui/material/TableContainer';
import type { Theme, SxProps } from '@mui/material/styles';

import { canViewShiftCashRevenue } from 'src/utils/shift-cash-access';

import { useAuthContext } from 'src/auth/hooks';
import { getShiftCashReconciliation } from 'src/api/shiftCash';

import Iconify from 'src/components/iconify';

import type {
  IReconciliationRow,
  ShiftCashInvoiceIssue,
  IShiftCashReconciliation,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// "Đối chiếu doanh thu" ở trang Kiểm tiền quầy (phần mở đầu của kiểm tra chênh lệch): két, chuyển khoản trên
// hoá đơn ↔ tiền vào ngân hàng, và — cửa hàng nối KiotViet — số đọc thẳng từ KiotViet ↔ số đã đồng bộ về hệ
// thống, đến từng hoá đơn lệch. Số liệu của HỆ THỐNG nên dùng được ở mọi cửa hàng và cả khi chưa chốt.
// Người có quyền xem doanh thu (shift-cash.revenue.read) hoặc người giám sát; BE trả 403 → ẩn hẳn.
// Chỉ gọi API khi bấm "Đối chiếu" (hoặc nút "Đối chiếu" ở khối Doanh thu — runRequest tăng). Đổi ngày → thu gọn.
// ----------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
}

function signed(value: number): string {
  if (Math.abs(value) < 1) return '0';
  return `${value > 0 ? '+' : '−'}${formatCurrency(Math.abs(value))}`;
}

// Mốc UTC của BE → giờ Việt Nam "HH:mm" (+ "dd/MM" khi khác ngày đang xem).
function timeVN(iso: string | null, day: string): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const vn = new Date(ms + 7 * 60 * 60 * 1000).toISOString();
  const time = vn.slice(11, 16);
  return vn.slice(0, 10) === day ? time : `${time} ${vn.slice(8, 10)}/${vn.slice(5, 7)}`;
}

const ISSUE_LABEL: Record<ShiftCashInvoiceIssue, string> = {
  'missing-in-system': 'Chưa về hệ thống',
  'not-on-kiotviet': 'KiotViet đã huỷ / không có',
  amount: 'Lệch tổng tiền',
  payment: 'Lệch phương thức',
};

const NUM_SX = { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } as const;

type View =
  | { step: 'idle' }
  | { step: 'result'; result: IShiftCashReconciliation }
  | { step: 'error' };

type Props = {
  date: string;
  /** Tăng lên để yêu cầu chạy đối chiếu từ nơi khác (nút "Đối chiếu" ở khối Doanh thu). */
  runRequest?: number;
  sx?: SxProps<Theme>;
};

export default function ShiftCashReconciliationPanel({ date, runRequest = 0, sx }: Props) {
  const { user } = useAuthContext();
  const canView = canViewShiftCashRevenue(user);

  const [forbidden, setForbidden] = useState(false);
  const [state, setState] = useState<{ date: string; view: View; loading: number | null }>({
    date,
    view: { step: 'idle' },
    loading: null,
  });
  const tokenRef = useRef(0);
  const cardRef = useRef<HTMLDivElement | null>(null);

  if (state.date !== date) setState({ date, view: { step: 'idle' }, loading: null });
  const { view } = state;
  const loading = state.loading !== null;

  const run = useCallback(async (forDate: string) => {
    tokenRef.current += 1;
    const token = tokenRef.current;
    const settle = (next: View) =>
      setState((prev) =>
        prev.date === forDate && prev.loading === token ? { date: forDate, view: next, loading: null } : prev
      );
    setState((prev) => ({ date: forDate, view: prev.date === forDate ? prev.view : { step: 'idle' }, loading: token }));

    try {
      const outcome = await getShiftCashReconciliation(forDate);
      if (outcome.status === 'forbidden') setForbidden(true);
      else settle({ step: 'result', result: outcome.result });
    } catch (error) {
      console.error('Shift-cash reconciliation error:', error);
      settle({ step: 'error' });
    }
  }, []);

  // Nút "Đối chiếu" ở khối Doanh thu: chạy + cuộn tới đây.
  const lastRequestRef = useRef(runRequest);
  useEffect(() => {
    if (runRequest === lastRequestRef.current) return;
    lastRequestRef.current = runRequest;
    if (!canView || !date) return;
    run(date);
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [runRequest, canView, date, run]);

  if (!canView || forbidden) return null;

  let actionLabel = 'Tải lại';
  if (view.step === 'idle') actionLabel = 'Đối chiếu';
  else if (view.step === 'error') actionLabel = 'Thử lại';

  return (
    <Card ref={cardRef} sx={[{ p: 2.5 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap spacing={1.5}>
        <Box sx={{ minWidth: 0, flex: '1 1 240px' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1">
              <Iconify icon="solar:scale-bold-duotone" width={22} sx={{ mr: 1, verticalAlign: 'middle' }} />
              Đối chiếu doanh thu
            </Typography>
            {view.step === 'result' && <StatusChip result={view.result} />}
          </Stack>
          {view.step !== 'result' && (
            <Typography
              variant="body2"
              color={view.step === 'error' && !loading ? 'error.main' : 'text.secondary'}
              sx={{ mt: 0.5 }}
            >
              {loading
                ? 'Đang đối chiếu…'
                : view.step === 'error'
                  ? 'Không đối chiếu được. Vui lòng thử lại.'
                  : 'So két, chuyển khoản với tiền ngân hàng thực nhận, và KiotViet với hệ thống (nếu cửa hàng nối KiotViet) — chạy được cả khi chưa chốt.'}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <LoadingButton
            variant="outlined"
            size="small"
            loading={loading}
            disabled={!date}
            onClick={() => run(date)}
            startIcon={<Iconify icon={view.step === 'idle' ? 'solar:scale-bold-duotone' : 'solar:refresh-bold'} />}
          >
            {actionLabel}
          </LoadingButton>
          {view.step === 'result' && (
            <Button
              size="small"
              color="inherit"
              onClick={() => setState({ date, view: { step: 'idle' }, loading: null })}
              startIcon={<Iconify icon="solar:alt-arrow-up-bold" />}
            >
              Thu gọn
            </Button>
          )}
        </Stack>
      </Stack>

      {view.step === 'result' && (
        <>
          <Divider sx={{ my: 2, borderStyle: 'dashed' }} />
          <Box sx={{ opacity: loading ? 0.48 : 1 }}>
            <ReconciliationResult result={view.result} />
          </Box>
        </>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------

// Két chưa đếm thì chưa nói được "khớp": hiện "Chưa đếm két" (trừ khi đã thấy lệch ở phần khác).
function StatusChip({ result }: { result: IShiftCashReconciliation }) {
  const notCounted = result.drawer.counted === null;
  const hasIssue =
    (result.bank.hasBankFeed && (result.bank.missingCredits.length > 0 || result.bank.unmatchedCredits.length > 0)) ||
    (!!result.kiotViet && (!result.kiotViet.ok || result.kiotViet.diffs.length > 0));
  if (notCounted && !hasIssue) return <Chip size="small" variant="soft" label="Chưa đếm két" />;
  return (
    <Chip
      size="small"
      variant="soft"
      color={result.allMatched ? 'success' : 'warning'}
      label={result.allMatched ? 'Khớp' : 'Có chênh lệch'}
    />
  );
}

function DiffCell({ value }: { value: number | null }) {
  if (value === null) return <TableCell align="right">—</TableCell>;
  const color = Math.abs(value) < 1 ? 'success.main' : value < 0 ? 'error.main' : 'warning.main';
  return (
    <TableCell align="right" sx={{ ...NUM_SX, color, fontWeight: 600 }}>
      {Math.abs(value) < 1 ? 'Khớp' : signed(value)}
    </TableCell>
  );
}

export function ReconciliationResult({ result }: { result: IShiftCashReconciliation }) {
  const { drawer, bank, kiotViet, kiotVietConnected, rows, notes, date } = result;
  const showKiotViet = kiotVietConnected && !!kiotViet?.ok && !!kiotViet.totals;
  const showBank = bank.hasBankFeed;
  const value = (row: IReconciliationRow, v: number) =>
    row.key === 'returns' && v !== 0 ? `−${formatCurrency(v)}` : formatCurrency(v);

  return (
    <Stack spacing={2.5}>
      {/* Nhận xét dựng sẵn từ BE */}
      <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
        {notes.map((note) => (
          <Typography component="li" variant="body2" key={note}>
            {note}
          </Typography>
        ))}
      </Stack>

      {/* Két */}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <Typography variant="caption" color="text.secondary">
          Tồn cuối dự kiến <b>{formatCurrency(drawer.expected)}</b>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Đã đếm <b>{drawer.counted === null ? 'chưa đếm' : formatCurrency(drawer.counted)}</b>
        </Typography>
        {drawer.difference !== null && (
          <Typography
            variant="caption"
            color={Math.abs(drawer.difference) < 1 ? 'success.main' : drawer.difference < 0 ? 'error.main' : 'warning.main'}
          >
            Chênh lệch <b>{signed(drawer.difference)}</b>
          </Typography>
        )}
        <Typography variant="caption" color="text.disabled">
          {drawer.isFinalized ? `Đã chốt lúc ${timeVN(drawer.finalizedAt, date)}` : 'Chưa chốt'}
        </Typography>
      </Stack>

      {/* Bảng theo kênh tiền */}
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: showKiotViet ? 640 : 420 }}>
          <TableHead>
            <TableRow>
              <TableCell>Khoản</TableCell>
              <TableCell align="right">Hệ thống</TableCell>
              {showKiotViet && <TableCell align="right">KiotViet</TableCell>}
              {showKiotViet && <TableCell align="right">Lệch KiotViet</TableCell>}
              {showBank && <TableCell align="right">Ngân hàng nhận</TableCell>}
              {showBank && <TableCell align="right">Lệch ngân hàng</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key} sx={row.key === 'net' ? { '& td': { fontWeight: 700 } } : undefined}>
                <TableCell>{row.label}</TableCell>
                <TableCell align="right" sx={NUM_SX}>
                  {value(row, row.system)}
                </TableCell>
                {showKiotViet && (
                  <TableCell align="right" sx={NUM_SX}>
                    {row.kiotViet === null ? '—' : value(row, row.kiotViet)}
                  </TableCell>
                )}
                {showKiotViet && <DiffCell value={row.kiotVietDiff} />}
                {showBank && (
                  <TableCell align="right" sx={NUM_SX}>
                    {row.bank === null ? '' : formatCurrency(row.bank)}
                  </TableCell>
                )}
                {showBank && (row.bankDiff === null ? <TableCell /> : <DiffCell value={row.bankDiff} />)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Chi tiết lệch */}
      {bank.missingCredits.length > 0 && (
        <DetailList
          icon="solar:card-recive-bold-duotone"
          title={`Hoá đơn chuyển khoản chưa thấy tiền về (${bank.missingCredits.length})`}
          items={bank.missingCredits.map((m) => ({
            key: m.salesOrderId,
            left: `${m.code} · ${timeVN(m.at, date)}`,
            right: formatCurrency(m.amount),
          }))}
        />
      )}
      {bank.unmatchedCredits.length > 0 && (
        <DetailList
          icon="solar:wallet-money-bold-duotone"
          title={`Tiền về chưa khớp hoá đơn chuyển khoản (${bank.unmatchedCredits.length})`}
          hint="Có thể khách chuyển khoản mà hoá đơn ghi tiền mặt, hoặc tiền không phải bán hàng."
          items={bank.unmatchedCredits.map((c, i) => ({
            key: `${c.at}-${i}`,
            left: `${timeVN(c.at, date)}${c.linkedInvoiceCode ? ` · mã QR của ${c.linkedInvoiceCode}` : ''}`,
            right: formatCurrency(c.amount),
          }))}
        />
      )}
      {kiotViet && kiotViet.diffs.length > 0 && (
        <DetailList
          icon="solar:shop-bold-duotone"
          title={`Hoá đơn lệch giữa KiotViet và hệ thống (${kiotViet.diffs.length})`}
          items={kiotViet.diffs.map((d) => ({
            key: `${d.code}-${d.issue}`,
            left: `${d.code} · ${ISSUE_LABEL[d.issue]}`,
            sub: d.detail,
            right: formatCurrency(d.kiotVietTotal ?? d.systemTotal ?? 0),
          }))}
        />
      )}
      {kiotViet && kiotViet.systemOnlyCount > 0 && (
        <Typography variant="caption" color="text.disabled">
          {kiotViet.systemOnlyCount} hoá đơn bán thẳng trên Spark ({formatCurrency(kiotViet.systemOnlyRevenue)}) — không có
          trên KiotViet, không phải lỗi.
        </Typography>
      )}
    </Stack>
  );
}

type DetailItem = { key: string; left: string; sub?: string; right: string };

function DetailList({ icon, title, hint, items }: { icon: string; title: string; hint?: string; items: DetailItem[] }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        <Iconify icon={icon} width={18} sx={{ mr: 0.75, verticalAlign: 'text-bottom' }} />
        {title}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
          {hint}
        </Typography>
      )}
      <Stack spacing={0.5} sx={{ pl: 3.25 }}>
        {items.map((item) => (
          <Stack key={item.key} direction="row" justifyContent="space-between" spacing={2}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2">{item.left}</Typography>
              {item.sub && (
                <Typography variant="caption" color="text.secondary">
                  {item.sub}
                </Typography>
              )}
            </Box>
            <Typography variant="body2" sx={NUM_SX}>
              {item.right}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
