'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { cancelCompensation, createCompensation, getCompensations, getMyCompensations } from 'src/api/hr';
import { HR_RECORD_TYPE_LABEL, type IHrRecord, type ICompensation } from 'src/types/hr';

import { useSnackbar } from 'src/components/snackbar';

import { fVnd, parseAmount } from './hr-common';

// ----------------------------------------------------------------------
// Bồi thường thiệt hại (Quy chế Điều 25; B7) — KHÔNG phải phạt tiền. Chỉ lập từ biên bản chênh lệch tiền / hàng có lỗi cá
// nhân đã ký (hoặc ghi rõ từ chối ký); Admin duyệt; trừ dần vào kỳ lương cuối tháng, mỗi tháng tối đa 30% lương thực trả.
// ----------------------------------------------------------------------

/** Biên bản lập được bồi thường (backend kiểm lại). */
export function canCompensate(record: IHrRecord): boolean {
  return (
    (record.type === 'CashDiscrepancy' || record.type === 'StockDiscrepancy') &&
    record.personalFault === true &&
    (record.status === 'Signed' || record.status === 'RefusedToSign')
  );
}

export function CreateCompensationDialog({
  record,
  onClose,
  onCreated,
}: {
  record: IHrRecord | null;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAmountText(record?.amount != null ? String(record.amount) : '');
    setNote('');
  }, [record]);

  const amount = parseAmount(amountText);
  const over = amount != null && record?.amount != null && amount > record.amount;

  const submit = async () => {
    if (!record || amount == null) return;
    setSaving(true);
    try {
      await createCompensation({ hrRecordId: record.id, amount, note: note.trim() || null });
      enqueueSnackbar('Đã duyệt khoản bồi thường — trừ dần vào lương kỳ cuối tháng');
      onCreated?.();
      onClose();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lập được khoản bồi thường'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!record} onClose={() => !saving && onClose()} fullWidth maxWidth="xs">
      <DialogTitle>Lập khoản bồi thường</DialogTitle>
      <DialogContent>
        {record && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              {record.staffName} · {HR_RECORD_TYPE_LABEL[record.type]} ngày {fDate(record.occurredOn)}
              {record.amount != null ? ` · thiệt hại ${fVnd(record.amount)}` : ''}. Không phải phạt: trừ dần vào lương kỳ cuối
              tháng, mỗi tháng tối đa 30% lương thực trả.
            </Alert>
            <TextField
              label="Số tiền bồi thường"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              error={over}
              helperText={over ? 'Không được quá thiệt hại ghi trên biên bản.' : 'Có thể thấp hơn thiệt hại.'}
            />
            <TextField label="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={amount == null || amount <= 0 || over} onClick={submit}>
          Duyệt bồi thường
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

/** Danh sách khoản bồi thường: `mine` = của tôi (chỉ xem); không thì của mọi người (Admin huỷ được). */
export function CompensationsPanel({ mine = false, refreshKey = 0 }: { mine?: boolean; refreshKey?: number }) {
  const { enqueueSnackbar } = useSnackbar();
  const [list, setList] = useState<ICompensation[]>([]);
  const [cancelling, setCancelling] = useState<ICompensation | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(mine ? await getMyCompensations() : await getCompensations());
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được khoản bồi thường'), { variant: 'error' });
    }
  }, [mine, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const cancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await cancelCompensation(cancelling.id, reason.trim());
      enqueueSnackbar('Đã huỷ khoản bồi thường');
      setCancelling(null);
      setReason('');
      await load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không huỷ được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (mine && list.length === 0) return null;

  return (
    <Card sx={{ mt: 2 }}>
      <CardHeader
        title={mine ? 'Khoản bồi thường của tôi' : 'Khoản bồi thường'}
        subheader="Trừ dần vào lương kỳ cuối tháng, mỗi tháng tối đa 30% lương thực trả — không phải phạt tiền."
      />
      {list.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 3, pt: 1 }}>
          Chưa có khoản bồi thường nào.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {!mine && <TableCell>Nhân viên</TableCell>}
                <TableCell>Biên bản</TableCell>
                <TableCell align="right">Bồi thường</TableCell>
                <TableCell align="right">Đã trừ</TableCell>
                <TableCell align="right">Còn lại</TableCell>
                <TableCell>Trạng thái</TableCell>
                {!mine && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}>
                  {!mine && <TableCell>{c.staffName}</TableCell>}
                  <TableCell>
                    {HR_RECORD_TYPE_LABEL[c.recordType]} · {fDate(c.recordDate, 'dd/MM/yyyy')}
                    {c.note ? (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {c.note}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell align="right">{fVnd(c.amount)}</TableCell>
                  <TableCell align="right">{fVnd(c.deducted)}</TableCell>
                  <TableCell align="right">{fVnd(c.remaining)}</TableCell>
                  <TableCell>
                    {c.status === 'Cancelled' ? (
                      <Chip size="small" label="Đã huỷ" title={c.cancelReason ?? undefined} />
                    ) : (
                      <Chip size="small" color={c.remaining > 0 ? 'warning' : 'success'} label={c.remaining > 0 ? 'Đang trừ' : 'Đã đủ'} />
                    )}
                  </TableCell>
                  {!mine && (
                    <TableCell align="right">
                      {c.status === 'Active' && (
                        <Button size="small" color="error" onClick={() => setCancelling(c)}>
                          Huỷ
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!cancelling} onClose={() => !busy && setCancelling(null)} fullWidth maxWidth="xs">
        <DialogTitle>Huỷ khoản bồi thường</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Kỳ lương chưa khoá tính lại sẽ không trừ nữa; kỳ đã khoá giữ nguyên.
            </Typography>
            <TextField autoFocus label="Lý do" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelling(null)} disabled={busy}>
            Đóng
          </Button>
          <LoadingButton color="error" variant="contained" loading={busy} disabled={!reason.trim()} onClick={cancel}>
            Huỷ khoản
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
