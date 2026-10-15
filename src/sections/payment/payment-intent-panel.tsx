'use client';

import type { PaymentIntentStatus, IPaymentIntentSummary } from 'src/types/payment-service';

import { useRef, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
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
import {
  statusChip,
  PAYMENT_FLAG_LABEL,
  PAYMENT_INTENT_STATUS,
  PAYMENT_ORDER_TYPE_LABEL,
} from 'src/utils/payment-status';

import { getReconciliationIntents } from 'src/api/payment-reconciliation';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { TableNoData, TableHeadCustom, TablePaginationCustom } from 'src/components/table';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'createdAt', label: 'Tạo lúc' },
  { id: 'paymentCode', label: 'Mã thanh toán' },
  { id: 'order', label: 'Đơn' },
  { id: 'method', label: 'Cách trả' },
  { id: 'amount', label: 'Số tiền', align: 'right' },
  { id: 'amountReceived', label: 'Đã nhận', align: 'right' },
  { id: 'status', label: 'Trạng thái' },
  { id: 'time', label: 'Thanh toán / hết hạn' },
];

type Props = {
  from: string;
  to: string;
  refreshKey: number;
};

export default function PaymentIntentPanel({ from, to, refreshKey }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [status, setStatus] = useState<PaymentIntentStatus | ''>('');
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 400);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [items, setItems] = useState<IPaymentIntentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const requestRef = useRef(0);
  useEffect(() => {
    setPage(0);
  }, [status, q, from, to]);

  const fetchData = useCallback(async () => {
    requestRef.current += 1;
    const requestId = requestRef.current;
    setLoading(true);
    try {
      const res = await getReconciliationIntents({
        from,
        to,
        status: status || undefined,
        q: q || undefined,
        page: page + 1,
        pageSize: rowsPerPage,
      });
      if (requestId !== requestRef.current) return;
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      if (requestId === requestRef.current) {
        enqueueSnackbar(apiErrorMessage(err, 'Không tải được danh sách thanh toán'), { variant: 'error' });
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [from, to, status, q, page, rowsPerPage, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  return (
    <Card>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2.5 }}>
        <TextField
          select
          size="small"
          label="Trạng thái"
          value={status}
          onChange={(e) => setStatus(e.target.value as PaymentIntentStatus | '')}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Tất cả</MenuItem>
          {(Object.keys(PAYMENT_INTENT_STATUS) as PaymentIntentStatus[]).map((s) => (
            <MenuItem key={s} value={s}>
              {PAYMENT_INTENT_STATUS[s].label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          fullWidth
          placeholder="Tìm mã thanh toán, mã đơn…"
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
                items.map((i) => {
                  const chip = statusChip(PAYMENT_INTENT_STATUS, i.status);
                  return (
                    <TableRow key={i.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDateTime(i.createdAt)}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{i.paymentCode || '—'}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{PAYMENT_ORDER_TYPE_LABEL[i.orderType] ?? i.orderType}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                          {i.orderRef}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{i.provider || i.method}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {i.channel}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {fCurrency(i.amount)}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {i.amountReceived ? fCurrency(i.amountReceived) : '—'}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          <Chip size="small" color={chip.color} label={chip.label} />
                          {(i.flags ?? []).map((f) => (
                            <Chip key={f} size="small" variant="outlined" color="warning" label={PAYMENT_FLAG_LABEL[f] ?? f} />
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {i.paidAt ? (
                          fDateTime(i.paidAt)
                        ) : i.expiresAt ? (
                          <Typography variant="caption" color="text.secondary">
                            hết hạn {fDateTime(i.expiresAt)}
                          </Typography>
                        ) : (
                          '—'
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
    </Card>
  );
}
