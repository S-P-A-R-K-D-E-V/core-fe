'use client';

import type { IBankTxn, BankTxnStatus, IReconciliationSummary } from 'src/types/payment-service';

import { useRef, useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { useDebounce } from 'src/hooks/use-debounce';

import { fDateTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';
import { statusChip, BANK_TXN_STATUS, PAYMENT_ORDER_TYPE_LABEL } from 'src/utils/payment-status';

import { getBankTransactions } from 'src/api/payment-reconciliation';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { TableNoData, TableHeadCustom, TablePaginationCustom } from 'src/components/table';

import BankTxnMatchDialog from './bank-txn-match-dialog';
import BankTxnIgnoreDialog from './bank-txn-ignore-dialog';

// ----------------------------------------------------------------------

type StatusTab = 'all' | BankTxnStatus;

const TABLE_HEAD = [
  { id: 'bookedAt', label: 'Thời gian' },
  { id: 'source', label: 'Nguồn' },
  { id: 'amount', label: 'Số tiền', align: 'right' },
  { id: 'content', label: 'Nội dung' },
  { id: 'status', label: 'Trạng thái' },
  { id: 'intent', label: 'Thanh toán' },
  { id: '', label: '' },
];

type Props = {
  from: string;
  to: string;
  summary: IReconciliationSummary | null;
  /** Đổi giá trị → tải lại (nút Làm mới) */
  refreshKey: number;
  /** Khớp / bỏ qua xong → trang tải lại tổng hợp */
  onChanged: VoidFunction;
};

export default function BankTxnPanel({ from, to, summary, refreshKey, onChanged }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 400);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [items, setItems] = useState<IBankTxn[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchTarget, setMatchTarget] = useState<IBankTxn | null>(null);
  const [ignoreTarget, setIgnoreTarget] = useState<IBankTxn | null>(null);

  // Đổi bộ lọc → về trang đầu. Phản hồi của lần tải cũ (đổi bộ lọc liên tiếp) bị bỏ qua.
  const requestRef = useRef(0);
  useEffect(() => {
    setPage(0);
  }, [tab, q, from, to]);

  const fetchData = useCallback(async () => {
    requestRef.current += 1;
    const requestId = requestRef.current;
    setLoading(true);
    try {
      const res = await getBankTransactions({
        from,
        to,
        status: tab === 'all' ? undefined : tab,
        q: q || undefined,
        page: page + 1,
        pageSize: rowsPerPage,
      });
      if (requestId !== requestRef.current) return;
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      if (requestId === requestRef.current) {
        enqueueSnackbar(apiErrorMessage(err, 'Không tải được giao dịch'), { variant: 'error' });
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [from, to, tab, q, page, rowsPerPage, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const handleChanged = () => {
    setMatchTarget(null);
    setIgnoreTarget(null);
    fetchData();
    onChanged();
  };

  const counts = summary?.transactions;
  const tabs: { value: StatusTab; label: string; count?: number; color: 'default' | 'warning' | 'success' }[] = [
    { value: 'all', label: 'Tất cả', count: counts?.total, color: 'default' },
    { value: 'unmatched', label: 'Chưa khớp', count: counts?.unmatched, color: 'warning' },
    { value: 'matched', label: 'Đã khớp', count: counts?.matched, color: 'success' },
    { value: 'ignored', label: 'Bỏ qua', count: counts?.ignored, color: 'default' },
  ];

  return (
    <Card>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2.5 }}>
        {tabs.map((t) => (
          <Tab
            key={t.value}
            value={t.value}
            label={t.label}
            iconPosition="end"
            icon={
              t.count !== undefined ? (
                <Label variant={t.value === tab ? 'filled' : 'soft'} color={t.color}>
                  {t.count}
                </Label>
              ) : undefined
            }
          />
        ))}
      </Tabs>

      <Stack sx={{ p: 2.5 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Tìm nội dung, mã thanh toán, mã tham chiếu…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
        <Scrollbar>
          <Table size="small" sx={{ minWidth: 960 }}>
            <TableHeadCustom headLabel={TABLE_HEAD} />
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={TABLE_HEAD.length} align="center" sx={{ py: 5 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((t) => {
                  const chip = statusChip(BANK_TXN_STATUS, t.status);
                  const incoming = t.direction === 'in';
                  return (
                    <TableRow key={t.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDateTime(t.bookedAt)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {t.provider}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t.accountNumber}
                        </Typography>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ whiteSpace: 'nowrap', fontWeight: 600, color: incoming ? 'success.main' : 'error.main' }}
                      >
                        {incoming ? '+' : '−'}
                        {fCurrency(t.amount)}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                          {t.content || '—'}
                        </Typography>
                        {(t.paymentCode || t.referenceCode) && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {[t.paymentCode, t.referenceCode && `Ref ${t.referenceCode}`].filter(Boolean).join(' · ')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={chip.color} label={chip.label} />
                        {t.status === 'ignored' && t.ignoreReason && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            {t.ignoreReason}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.matchedIntent ? (
                          <>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {t.matchedIntent.paymentCode}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {PAYMENT_ORDER_TYPE_LABEL[t.matchedIntent.orderType] ?? t.matchedIntent.orderType} ·{' '}
                              {fCurrency(t.matchedIntent.amount)}
                            </Typography>
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {t.status === 'unmatched' && incoming && (
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" variant="contained" onClick={() => setMatchTarget(t)}>
                              Khớp với thanh toán
                            </Button>
                            <Tooltip title="Không phải tiền bán hàng">
                              <Button size="small" color="inherit" onClick={() => setIgnoreTarget(t)}>
                                Bỏ qua
                              </Button>
                            </Tooltip>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              <TableNoData notFound={!loading && items.length === 0} />
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      <TablePaginationCustom
        count={total}
        page={page}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[10, 25, 50]}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
      />

      <BankTxnMatchDialog txn={matchTarget} onClose={() => setMatchTarget(null)} onMatched={handleChanged} />
      <BankTxnIgnoreDialog txn={ignoreTarget} onClose={() => setIgnoreTarget(null)} onIgnored={handleChanged} />
    </Card>
  );
}
