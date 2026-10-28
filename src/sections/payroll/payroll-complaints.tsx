'use client';

import { useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import {
  filePayrollComplaint,
  getPayrollComplaints,
  replyPayrollComplaint,
  getMyPayrollComplaints,
  withdrawPayrollComplaint,
  getPayrollComplaintWindow,
} from 'src/api/payroll-complaints';
import {
  type IPayrollComplaint,
  type PayrollComplaintStatus,
  type IPayrollComplaintWindow,
  PAYROLL_COMPLAINT_STATUS_LABEL,
} from 'src/types/payroll-complaint';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { fVnd } from '../hr/hr-common';

// ----------------------------------------------------------------------
// Khiếu nại phiếu lương (Quy chế Điều 12.3): nhân viên gửi trong 3 ngày làm việc kể từ ngày nhận phiếu (không tính Chủ nhật);
// quản lý (payroll.complaint.review) trả lời "Có sai sót" / "Phiếu đúng" trong 3 ngày làm việc. Khiếu nại không tự đổi tiền —
// có sai sót thì tính lại bảng lương như thường.
// ----------------------------------------------------------------------

const STATUS_COLOR: Record<PayrollComplaintStatus, 'warning' | 'success' | 'default' | 'info'> = {
  Pending: 'warning',
  Accepted: 'info',
  Rejected: 'success',
  Withdrawn: 'default',
};

function StatusChip({ c }: { c: IPayrollComplaint }) {
  if (c.isOverdue) return <Chip size="small" color="error" label="Quá hạn trả lời" />;
  return <Chip size="small" color={STATUS_COLOR[c.status]} label={PAYROLL_COMPLAINT_STATUS_LABEL[c.status]} />;
}

const period = (c: { fromDate: string; toDate: string }) => `${fDate(c.fromDate, 'dd/MM')}–${fDate(c.toDate, 'dd/MM/yyyy')}`;

/** Nút "Khiếu nại" trên một phiếu lương của chính mình — chỉ hiện khi còn hạn (3 ngày làm việc). */
export function PayrollComplaintButton({ payrollRecordId, onFiled }: { payrollRecordId: string | null; onFiled?: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const [win, setWin] = useState<IPayrollComplaintWindow | null>(null);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!payrollRecordId) {
      setWin(null);
      return;
    }
    try {
      setWin(await getPayrollComplaintWindow(payrollRecordId));
    } catch {
      setWin(null); // phiếu chưa gửi cho nhân viên / backend cũ → ẩn nút
    }
  }, [payrollRecordId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!payrollRecordId) return;
    setSaving(true);
    try {
      await filePayrollComplaint(payrollRecordId, content.trim());
      enqueueSnackbar('Đã gửi khiếu nại — quản lý trả lời trong 3 ngày làm việc');
      setOpen(false);
      setContent('');
      await load();
      onFiled?.();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không gửi được khiếu nại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!win) return null;
  if (win.pendingComplaintId)
    return <Chip size="small" color="warning" label="Đã khiếu nại — chờ trả lời" sx={{ mr: 'auto' }} />;
  if (!win.isOpen)
    return (
      <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
        Hết hạn khiếu nại ({fDate(win.deadline, 'dd/MM')})
      </Typography>
    );

  return (
    <>
      <Button color="warning" variant="outlined" onClick={() => setOpen(true)} sx={{ mr: 'auto' }}>
        Khiếu nại phiếu lương (đến {fDate(win.deadline, 'dd/MM')})
      </Button>
      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Khiếu nại phiếu lương</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Ghi rõ khoản nào sai (ca nào, ngày nào, số giờ / số tiền đúng theo bạn). Quản lý trả lời trong 3 ngày làm việc; có
              sai sót thì bảng lương được tính lại.
            </Alert>
            <TextField
              autoFocus
              label="Nội dung khiếu nại"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              multiline
              minRows={4}
              inputProps={{ maxLength: 2000 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Đóng
          </Button>
          <LoadingButton variant="contained" loading={saving} disabled={!content.trim()} onClick={submit}>
            Gửi khiếu nại
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** Khiếu nại của tôi (trang Bảng lương của tôi) — ẩn khi chưa có. */
export function MyPayrollComplaintsCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const { enqueueSnackbar } = useSnackbar();
  const [list, setList] = useState<IPayrollComplaint[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await getMyPayrollComplaints());
    } catch {
      setList([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const withdraw = async (id: string) => {
    setBusy(id);
    try {
      await withdrawPayrollComplaint(id);
      enqueueSnackbar('Đã rút khiếu nại');
      await load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không rút được'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  if (list.length === 0) return null;

  return (
    <Card sx={{ mt: 3 }}>
      <CardHeader title="Khiếu nại phiếu lương của tôi" subheader="Quản lý trả lời trong 3 ngày làm việc." />
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kỳ lương</TableCell>
              <TableCell>Nội dung</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Trả lời</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((c) => (
              <TableRow key={c.id}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{period(c)}</TableCell>
                <TableCell sx={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>{c.content}</TableCell>
                <TableCell>
                  <StatusChip c={c} />
                </TableCell>
                <TableCell sx={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>
                  {c.reply ?? (
                    <Typography variant="caption" color="text.secondary">
                      Hạn trả lời {fDate(c.replyDueOn, 'dd/MM')}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  {c.status === 'Pending' && (
                    <LoadingButton size="small" loading={busy === c.id} onClick={() => withdraw(c.id)}>
                      Rút
                    </LoadingButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

function ReplyDialog({
  complaint,
  onClose,
  onReplied,
}: {
  complaint: IPayrollComplaint | null;
  onClose: () => void;
  onReplied: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [outcome, setOutcome] = useState<'Accepted' | 'Rejected'>('Rejected');
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOutcome('Rejected');
    setReply('');
  }, [complaint]);

  const submit = async () => {
    if (!complaint) return;
    setSaving(true);
    try {
      await replyPayrollComplaint(complaint.id, outcome, reply.trim());
      enqueueSnackbar(
        outcome === 'Accepted' ? 'Đã trả lời — nhớ tính lại bảng lương của người này' : 'Đã trả lời khiếu nại'
      );
      onReplied();
      onClose();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không trả lời được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!complaint} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Trả lời khiếu nại phiếu lương</DialogTitle>
      <DialogContent>
        {complaint && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity={complaint.isOverdue ? 'error' : 'info'}>
              {complaint.staffName} · kỳ {period(complaint)} · tổng lương lúc gửi {fVnd(complaint.totalSalaryAtFiling)}.{' '}
              Hạn trả lời {fDate(complaint.replyDueOn, 'dd/MM/yyyy')}
              {complaint.isOverdue ? ' — đã quá hạn.' : '.'}
            </Alert>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {complaint.content}
            </Typography>
            <RadioGroup value={outcome} onChange={(e) => setOutcome(e.target.value as 'Accepted' | 'Rejected')}>
              <FormControlLabel value="Rejected" control={<Radio />} label="Phiếu đúng — giải thích cho nhân viên" />
              <FormControlLabel value="Accepted" control={<Radio />} label="Có sai sót — sẽ tính lại bảng lương" />
            </RadioGroup>
            <TextField
              label="Trả lời cho nhân viên"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              multiline
              minRows={3}
              inputProps={{ maxLength: 2000 }}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!reply.trim()} onClick={submit}>
          Gửi trả lời
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

/** Trang quản lý: khiếu nại chờ trả lời / tất cả. */
export function PayrollComplaintsView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [list, setList] = useState<IPayrollComplaint[]>([]);
  const [replying, setReplying] = useState<IPayrollComplaint | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await getPayrollComplaints(tab === 'pending' ? 'Pending' : undefined));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được khiếu nại'), { variant: 'error' });
    }
  }, [tab, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Khiếu nại phiếu lương"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Lương' }, { name: 'Khiếu nại phiếu lương' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        Quy chế Điều 12: nhân viên khiếu nại trong 3 ngày làm việc kể từ ngày nhận phiếu, Cửa hàng trả lời trong 3 ngày làm việc
        (không tính Chủ nhật). Có sai sót thì tính lại bảng lương của người đó rồi trả lời.
      </Alert>
      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab value="pending" label="Chờ trả lời" />
          <Tab value="all" label="Tất cả" />
        </Tabs>
        {list.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            {tab === 'pending' ? 'Không có khiếu nại nào đang chờ.' : 'Chưa có khiếu nại nào.'}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nhân viên</TableCell>
                  <TableCell>Kỳ lương</TableCell>
                  <TableCell>Nội dung</TableCell>
                  <TableCell>Gửi lúc</TableCell>
                  <TableCell>Hạn trả lời</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>{c.staffName}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{period(c)}</TableCell>
                    <TableCell sx={{ maxWidth: 420, whiteSpace: 'pre-wrap' }}>
                      {c.content}
                      {c.reply && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          Trả lời: {c.reply}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDate(c.createdAt, 'dd/MM HH:mm')}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: c.isOverdue ? 'error.main' : undefined }}>
                      {fDate(c.replyDueOn, 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <StatusChip c={c} />
                    </TableCell>
                    <TableCell align="right">
                      {c.status === 'Pending' && (
                        <Button size="small" variant="contained" onClick={() => setReplying(c)}>
                          Trả lời
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
      <ReplyDialog complaint={replying} onClose={() => setReplying(null)} onReplied={load} />
    </Container>
  );
}
