'use client';

import type { IBankTxn, PaymentIntentStatus, IPaymentIntentSummary } from 'src/types/payment-service';

import { useState, useEffect } from 'react';

import Chip from '@mui/material/Chip';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import TablePagination from '@mui/material/TablePagination';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { useDebounce } from 'src/hooks/use-debounce';

import { fDateTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';
import { statusChip, PAYMENT_INTENT_STATUS, PAYMENT_ORDER_TYPE_LABEL } from 'src/utils/payment-status';

import { matchBankTransaction, getReconciliationIntents } from 'src/api/payment-reconciliation';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Khớp tay giao dịch chưa khớp (thường là khách quên / ghi sai mã thanh toán) với một thanh toán đang chờ hoặc đã hết
// hạn. Máy chủ cộng tiền vào thanh toán đó như khi tự khớp.
// ----------------------------------------------------------------------

const STATUS_OPTIONS: { value: PaymentIntentStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ thanh toán' },
  { value: 'expired', label: 'Hết hạn' },
  { value: 'partially_paid', label: 'Trả thiếu' },
];

const PAGE_SIZE = 10;

type Props = {
  txn: IBankTxn | null;
  onClose: VoidFunction;
  onMatched: (txn: IBankTxn) => void;
};

export default function BankTxnMatchDialog({ txn, onClose, onMatched }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [status, setStatus] = useState<PaymentIntentStatus>('pending');
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 400);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<IPaymentIntentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const open = !!txn;

  useEffect(() => {
    if (!open) return;
    setStatus('pending');
    setSearch('');
    setPage(0);
    setSelectedId(null);
  }, [open, txn?.id]);

  useEffect(() => {
    setPage(0);
  }, [status, q]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    getReconciliationIntents({ status, q: q || undefined, page: page + 1, pageSize: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (!cancelled) enqueueSnackbar(apiErrorMessage(err, 'Không tải được danh sách thanh toán'), { variant: 'error' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, status, q, page, enqueueSnackbar]);

  const handleMatch = async () => {
    if (!txn || !selectedId) return;
    setSaving(true);
    try {
      const res = await matchBankTransaction(txn.id, selectedId);
      enqueueSnackbar('Đã khớp giao dịch với thanh toán');
      onMatched(res);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Khớp giao dịch thất bại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const selected = items.find((i) => i.id === selectedId);
  const amountMismatch = !!txn && !!selected && selected.amount - selected.amountReceived !== txn.amount;

  return (
    <Dialog fullWidth maxWidth="md" open={open} onClose={saving ? undefined : onClose}>
      <DialogTitle>Khớp với thanh toán</DialogTitle>
      <DialogContent dividers>
        {txn && (
          <Stack spacing={2}>
            <Alert severity="info" icon={<Iconify icon="solar:card-recive-bold" />}>
              <b>{fCurrency(txn.amount)}</b> · {fDateTime(txn.bookedAt)} · tài khoản {txn.accountNumber}
              <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
                Nội dung: {txn.content || '—'}
              </Typography>
            </Alert>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <ToggleButtonGroup exclusive size="small" value={status} onChange={(_, v) => v && setStatus(v)}>
                {STATUS_OPTIONS.map((o) => (
                  <ToggleButton key={o.value} value={o.value}>
                    {o.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
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

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Mã thanh toán</TableCell>
                    <TableCell>Đơn</TableCell>
                    <TableCell align="right">Số tiền</TableCell>
                    <TableCell align="right">Đã nhận</TableCell>
                    <TableCell>Tạo lúc</TableCell>
                    <TableCell>Trạng thái</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((i) => {
                      const chip = statusChip(PAYMENT_INTENT_STATUS, i.status);
                      const sameAmount = i.amount - i.amountReceived === txn.amount;
                      return (
                        <TableRow
                          key={i.id}
                          hover
                          selected={i.id === selectedId}
                          onClick={() => setSelectedId(i.id)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell padding="checkbox">
                            <Radio size="small" checked={i.id === selectedId} />
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{i.paymentCode}</TableCell>
                          <TableCell>
                            <Typography variant="body2">{PAYMENT_ORDER_TYPE_LABEL[i.orderType] ?? i.orderType}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                              {i.orderRef}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                              {sameAmount && <Chip size="small" color="success" variant="outlined" label="Đúng số tiền" />}
                              <span>{fCurrency(i.amount)}</span>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">{i.amountReceived ? fCurrency(i.amountReceived) : '—'}</TableCell>
                          <TableCell>{fDateTime(i.createdAt)}</TableCell>
                          <TableCell>
                            <Chip size="small" color={chip.color} label={chip.label} />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                  {!loading && items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        Không có thanh toán phù hợp
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={total}
              page={page}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
              onPageChange={(_, p) => setPage(p)}
            />

            {amountMismatch && (
              <Alert severity="warning">
                Số tiền giao dịch khác số tiền còn phải trả của thanh toán đã chọn — máy chủ sẽ ghi nhận trả thiếu hoặc
                trả dư.
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!selectedId} onClick={handleMatch}>
          Khớp
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
