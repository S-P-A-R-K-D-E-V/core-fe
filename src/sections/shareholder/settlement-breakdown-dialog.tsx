'use client';

import { useState, useEffect } from 'react';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { fCurrency, fPercent } from 'src/utils/format-number';
import { fDate, fDateTime } from 'src/utils/format-time';
import { fPaymentMethod } from 'src/utils/payment-method-label';

import {
  ISettlementDetail,
  ISettlementBreakdown,
  ISettlementCapitalFlow,
  CapitalTransactionType,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export type BreakdownTarget =
  | { kind: 'revenue' }
  | { kind: 'expense' }
  | { kind: 'profit' }
  | { kind: 'goodsPaid' }
  | { kind: 'goodsInvoice' }
  | { kind: 'paidIn' | 'collectedOut' | 'peer'; shareholderId: string };

type Props = {
  target: BreakdownTarget | null;
  onClose: VoidFunction;
  settlement: ISettlementDetail;
  breakdown: ISettlementBreakdown | null;
  loading: boolean;
};

const TYPE_LABEL: Record<CapitalTransactionType, string> = {
  Contribution: 'Góp vốn',
  ExpensePaidOnBehalf: 'Chi hộ',
  RevenueCollected: 'Thu về túi',
  Withdrawal: 'Rút tiền',
  PeerTransfer: 'Chuyển cho cổ đông',
};

function flowTypeLabel(f: ISettlementCapitalFlow) {
  if (f.source === 'CashCounter') return 'Kiểm tiền quầy';
  return f.type ? TYPE_LABEL[f.type] : '';
}

const MAX_HEIGHT = 440;

// ----------------------------------------------------------------------

function SummaryRow({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: number;
  bold?: boolean;
  color?: string;
}) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant={bold ? 'subtitle2' : 'body2'} color={bold ? 'text.primary' : 'text.secondary'}>
        {label}
      </Typography>
      <Typography variant="subtitle2" color={color}>
        {fCurrency(value)}
      </Typography>
    </Stack>
  );
}

/** Tổng popup lệch số đã chốt → dữ liệu nguồn bị sửa/xóa sau khi chốt sổ */
function MismatchAlert({ expected, actual }: { expected: number; actual: number }) {
  if (Math.abs(expected - actual) < 1) return null;
  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      Tổng chi tiết hiện tại ({fCurrency(actual)}) lệch với số đã chốt ({fCurrency(expected)}) — dữ
      liệu nguồn đã thay đổi sau khi chốt sổ.
    </Alert>
  );
}

function SimpleTable({
  head,
  rows,
  empty = 'Không có dữ liệu',
}: {
  head: { label: string; align?: 'right' }[];
  rows: React.ReactNode[][];
  empty?: string;
}) {
  return (
    <TableContainer sx={{ maxHeight: MAX_HEIGHT }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {head.map((h) => (
              <TableCell key={h.label} align={h.align}>
                {h.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={head.length} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((cells, i) => (
              <TableRow key={i} hover>
                {cells.map((c, j) => (
                  <TableCell key={j} align={head[j]?.align}>
                    {c}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function FlowTable({ items, showCounterparty }: { items: ISettlementCapitalFlow[]; showCounterparty?: 'to' | 'from' }) {
  const head = [
    { label: 'Ngày' },
    { label: 'Loại' },
    ...(showCounterparty ? [{ label: showCounterparty === 'to' ? 'Chuyển cho' : 'Nhận từ' }] : []),
    { label: 'Ghi chú' },
    { label: 'Số tiền', align: 'right' as const },
  ];
  const rows = items.map((f) => [
    fDate(f.date),
    <Stack direction="row" spacing={0.5} alignItems="center">
      <span>{flowTypeLabel(f)}</span>
      {f.isGoodsPurchase && <Chip size="small" label="Tiền hàng" color="info" variant="soft" />}
    </Stack>,
    ...(showCounterparty ? [showCounterparty === 'to' ? f.counterpartyName : f.shareholderName] : []),
    f.note || '—',
    fCurrency(f.amount),
  ]);
  return <SimpleTable head={head} rows={rows} />;
}

// ----------------------------------------------------------------------

function RevenueContent({ b, s }: { b: ISettlementBreakdown; s: ISettlementDetail }) {
  const [tab, setTab] = useState('days');
  const [keyword, setKeyword] = useState('');
  const r = b.revenue;

  const kw = keyword.trim().toLowerCase();
  const orders = kw
    ? r.orders.filter(
        (o) => o.code.toLowerCase().includes(kw) || (o.customerName ?? '').toLowerCase().includes(kw)
      )
    : r.orders;

  return (
    <>
      <MismatchAlert expected={s.totalRevenue} actual={r.netRevenue} />
      <Stack spacing={1} sx={{ mb: 2 }}>
        <SummaryRow label={`Doanh thu bán hàng (${r.orders.length} hóa đơn)`} value={r.grossRevenue} />
        <SummaryRow label={`Trả hàng (${r.returns.length} phiếu)`} value={-r.totalReturns} color="error.main" />
        <Divider />
        <SummaryRow label="Doanh thu thuần" value={r.netRevenue} bold />
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="days" label="Theo ngày" />
        <Tab value="methods" label="Theo phương thức" />
        <Tab value="orders" label={`Hóa đơn (${r.orders.length})`} />
        <Tab value="returns" label={`Trả hàng (${r.returns.length})`} />
      </Tabs>

      {tab === 'days' && (
        <SimpleTable
          head={[
            { label: 'Ngày' },
            { label: 'Số HĐ', align: 'right' },
            { label: 'Bán hàng', align: 'right' },
            { label: 'Trả hàng', align: 'right' },
            { label: 'Thuần', align: 'right' },
          ]}
          rows={r.days.map((d) => [
            fDate(d.date),
            d.orderCount,
            fCurrency(d.gross),
            d.returns ? fCurrency(d.returns) : '—',
            <Typography variant="subtitle2">{fCurrency(d.net)}</Typography>,
          ])}
        />
      )}

      {tab === 'methods' && (
        <>
          <SimpleTable
            head={[{ label: 'Phương thức' }, { label: 'Số tiền', align: 'right' }, { label: '%', align: 'right' }]}
            rows={r.byMethod.map((m) => [
              fPaymentMethod(m.method),
              fCurrency(m.amount),
              r.grossRevenue ? fPercent((m.amount / r.grossRevenue) * 100) : '—',
            ])}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Theo số tiền khách đã thanh toán trên hóa đơn — có thể khác tổng bán hàng nếu có hóa đơn ghi nợ.
          </Typography>
        </>
      )}

      {tab === 'orders' && (
        <>
          <TextField
            size="small"
            fullWidth
            placeholder="Tìm mã hóa đơn / khách hàng..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            sx={{ mb: 1.5 }}
          />
          <SimpleTable
            head={[
              { label: 'Mã HĐ' },
              { label: 'Thời gian' },
              { label: 'Khách hàng' },
              { label: 'Thanh toán' },
              { label: 'Tổng tiền', align: 'right' },
            ]}
            rows={orders.map((o) => [
              o.code,
              fDateTime(o.createdDate),
              o.customerName || 'Khách lẻ',
              o.method ? o.method.split(', ').map(fPaymentMethod).join(', ') : '—',
              fCurrency(o.total),
            ])}
          />
        </>
      )}

      {tab === 'returns' && (
        <SimpleTable
          head={[
            { label: 'Mã phiếu' },
            { label: 'Ngày' },
            { label: 'Khách hàng' },
            { label: 'Tiền trả', align: 'right' },
          ]}
          rows={r.returns.map((x) => [
            x.code,
            fDateTime(x.returnDate),
            x.customerName || 'Khách lẻ',
            fCurrency(x.returnTotal),
          ])}
        />
      )}
    </>
  );
}

function ExpenseContent({ b, s }: { b: ISettlementBreakdown; s: ISettlementDetail }) {
  const [tab, setTab] = useState('category');
  const e = b.expense;

  return (
    <>
      <MismatchAlert expected={s.totalExpense} actual={e.total} />
      <SummaryRow label={`Tổng chi (${e.items.length} khoản)`} value={e.total} bold />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ my: 2 }}>
        <Tab value="category" label="Theo danh mục" />
        <Tab value="items" label={`Danh sách (${e.items.length})`} />
      </Tabs>

      {tab === 'category' && (
        <SimpleTable
          head={[
            { label: 'Danh mục' },
            { label: 'Số khoản', align: 'right' },
            { label: 'Số tiền', align: 'right' },
            { label: '%', align: 'right' },
          ]}
          rows={e.byCategory.map((c) => [
            c.categoryName,
            c.count,
            fCurrency(c.amount),
            e.total ? fPercent((c.amount / e.total) * 100) : '—',
          ])}
        />
      )}

      {tab === 'items' && (
        <SimpleTable
          head={[
            { label: 'Ngày' },
            { label: 'Danh mục' },
            { label: 'Ghi chú' },
            { label: 'Người chi' },
            { label: 'Số tiền', align: 'right' },
          ]}
          rows={e.items.map((x) => [
            fDate(x.expenseDate),
            x.categoryName,
            x.note || '—',
            x.paidByShareholderName || '—',
            fCurrency(x.amount),
          ])}
        />
      )}
    </>
  );
}

function ProfitContent({ s }: { s: ISettlementDetail }) {
  const distributed = s.profit - s.reserveAmount;
  return (
    <Stack spacing={1.25}>
      <SummaryRow label="Doanh thu thuần" value={s.totalRevenue} />
      <SummaryRow label="− Tổng chi" value={-s.totalExpense} />
      <SummaryRow label="− Tiền hàng thực trả" value={-s.goodsPaidTotal} />
      <Divider />
      <SummaryRow label="Lợi nhuận" value={s.profit} bold color={s.profit >= 0 ? 'success.main' : 'error.main'} />
      <SummaryRow label="− Quỹ giữ lại" value={-s.reserveAmount} />
      <Divider />
      <SummaryRow label="Lợi nhuận chia" value={distributed} bold />
      <Typography variant="overline" color="text.secondary" sx={{ pt: 1 }}>
        Chia theo % cổ phần
      </Typography>
      {s.lines.map((l) => (
        <SummaryRow
          key={l.shareholderId}
          label={`${l.shareholderName} (${fPercent(l.equityPercentSnapshot)})`}
          value={l.profitShare}
        />
      ))}
    </Stack>
  );
}

function GoodsPaidContent({ b, s }: { b: ISettlementBreakdown; s: ISettlementDetail }) {
  return (
    <>
      <MismatchAlert expected={s.goodsPaidTotal} actual={b.goods.paidTotal} />
      <SummaryRow label="Tổng tiền hàng thực trả" value={b.goods.paidTotal} bold />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Giao dịch vốn Góp vốn/Chi hộ có đánh dấu &quot;Tiền hàng&quot;.
      </Typography>
      <FlowTable items={b.goods.paidItems} showCounterparty={undefined} />
    </>
  );
}

function GoodsInvoiceContent({ b, s }: { b: ISettlementBreakdown; s: ISettlementDetail }) {
  return (
    <>
      <MismatchAlert expected={s.goodsInvoiceTotal} actual={b.goods.invoiceTotal} />
      <SummaryRow label={`Tổng hóa đơn nhập (${b.goods.invoices.length} phiếu)`} value={b.goods.invoiceTotal} bold />
      <Divider sx={{ my: 2 }} />
      <SimpleTable
        head={[
          { label: 'Mã phiếu' },
          { label: 'Ngày' },
          { label: 'Nhà cung cấp' },
          { label: 'Người trả' },
          { label: 'Tổng tiền', align: 'right' },
        ]}
        rows={b.goods.invoices.map((x) => [
          x.code,
          fDate(x.date),
          x.supplierName || '—',
          x.paidByShareholderName || '—',
          fCurrency(x.totalAmount),
        ])}
      />
    </>
  );
}

function ShareholderContent({
  b,
  s,
  kind,
  shareholderId,
}: {
  b: ISettlementBreakdown;
  s: ISettlementDetail;
  kind: 'paidIn' | 'collectedOut' | 'peer';
  shareholderId: string;
}) {
  const flow = b.shareholders.find((x) => x.shareholderId === shareholderId);
  const line = s.lines.find((l) => l.shareholderId === shareholderId);
  if (!flow || !line) {
    return <Typography color="text.secondary">Không có dữ liệu cho cổ đông này.</Typography>;
  }

  const sum = (items: ISettlementCapitalFlow[]) => items.reduce((acc, f) => acc + f.amount, 0);

  if (kind === 'paidIn') {
    const total = sum(flow.paidIn);
    return (
      <>
        <MismatchAlert expected={line.paidIn} actual={total} />
        <SummaryRow label="Tổng đã đưa vào" value={total} bold />
        <Divider sx={{ my: 2 }} />
        <FlowTable items={flow.paidIn} />
      </>
    );
  }

  if (kind === 'collectedOut') {
    const channels = Object.entries(flow.collectedByChannel).filter(([, v]) => v);
    const channelTotal = channels.reduce((acc, [, v]) => acc + v, 0);
    const total = channelTotal + sum(flow.collectedOut);
    return (
      <>
        <MismatchAlert expected={line.collectedOut} actual={total} />
        <Stack spacing={1}>
          {channels.map(([method, v]) => (
            <SummaryRow key={method} label={`Doanh thu về túi qua ${fPaymentMethod(method)}`} value={v} />
          ))}
          <SummaryRow label="Thu tay / rút vốn / rút quầy" value={sum(flow.collectedOut)} />
          <Divider />
          <SummaryRow label="Tổng đã lấy ra" value={total} bold />
        </Stack>
        {channels.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Doanh thu theo kênh thu tiền được tính lại từ thanh toán hóa đơn và cấu hình Kênh thu tiền
            hiện tại.
          </Typography>
        )}
        <Divider sx={{ my: 2 }} />
        <FlowTable items={flow.collectedOut} />
      </>
    );
  }

  const paid = sum(flow.peerPaid);
  const received = sum(flow.peerReceived);
  return (
    <>
      <Stack spacing={1} sx={{ mb: 2 }}>
        <SummaryRow label="Đã chuyển cho cổ đông khác" value={paid} color="success.main" />
        <SummaryRow label="Đã nhận từ cổ đông khác" value={-received} color="error.main" />
      </Stack>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Đã chuyển
      </Typography>
      <FlowTable items={flow.peerPaid} showCounterparty="to" />
      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
        Đã nhận
      </Typography>
      <FlowTable items={flow.peerReceived} showCounterparty="from" />
    </>
  );
}

// ----------------------------------------------------------------------

function titleOf(target: BreakdownTarget, s: ISettlementDetail) {
  const name =
    'shareholderId' in target
      ? s.lines.find((l) => l.shareholderId === target.shareholderId)?.shareholderName ?? ''
      : '';
  switch (target.kind) {
    case 'revenue':
      return 'Chi tiết doanh thu';
    case 'expense':
      return 'Chi tiết tổng chi';
    case 'profit':
      return 'Cách tính lợi nhuận';
    case 'goodsPaid':
      return 'Tiền hàng thực trả';
    case 'goodsInvoice':
      return 'Hóa đơn nhập hàng (KiotViet)';
    case 'paidIn':
      return `${name} — Đã đưa vào`;
    case 'collectedOut':
      return `${name} — Đã lấy ra`;
    case 'peer':
      return `${name} — Chuyển/Nhận giữa cổ đông`;
    default:
      return '';
  }
}

export default function SettlementBreakdownDialog({ target, onClose, settlement, breakdown, loading }: Props) {
  // Giữ target cuối cùng để nội dung không biến mất trong lúc dialog đang đóng (animation)
  const [shown, setShown] = useState<BreakdownTarget | null>(target);
  useEffect(() => {
    if (target) setShown(target);
  }, [target]);

  const needsData = shown && shown.kind !== 'profit';

  const renderContent = () => {
    if (!shown) return null;
    if (shown.kind === 'profit') return <ProfitContent s={settlement} />;
    if (!breakdown) {
      return loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <Typography color="text.secondary">Không tải được chi tiết.</Typography>
      );
    }
    switch (shown.kind) {
      case 'revenue':
        return <RevenueContent b={breakdown} s={settlement} />;
      case 'expense':
        return <ExpenseContent b={breakdown} s={settlement} />;
      case 'goodsPaid':
        return <GoodsPaidContent b={breakdown} s={settlement} />;
      case 'goodsInvoice':
        return <GoodsInvoiceContent b={breakdown} s={settlement} />;
      default:
        return (
          <ShareholderContent b={breakdown} s={settlement} kind={shown.kind} shareholderId={shown.shareholderId} />
        );
    }
  };

  return (
    <Dialog open={!!target} onClose={onClose} fullWidth maxWidth={needsData ? 'md' : 'xs'}>
      <DialogTitle>
        {shown && titleOf(shown, settlement)}
        <Typography variant="body2" color="text.secondary">
          {fDate(settlement.fromDate)} — {fDate(settlement.toDate)}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>{renderContent()}</DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
