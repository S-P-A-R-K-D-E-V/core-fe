'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
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
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';


import { fDate, fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { getActiveStaffUsers } from 'src/api/users';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import { getHrRecords, signHrRecord, voidHrRecord, createHrRecord, getMyHrRecords, refuseHrRecord, markHrRecordRefused } from 'src/api/hr';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { IHrRecord, HrRecordType, HrRecordStatus } from 'src/types/hr';
import { HR_RECORD_TYPE_LABEL, NEW_HR_RECORD_TYPES, HR_RECORD_STATUS_LABEL } from 'src/types/hr';
import { useActiveHrRules } from 'src/api/hr-rules';

import { fVnd, MonthField, monthStart, parseAmount, previousMonth } from '../hr-common';
import { canCompensate, CompensationsPanel, CreateCompensationDialog } from '../compensations-panel';

// ----------------------------------------------------------------------
// Biên bản: chênh lệch tiền / hàng, vi phạm (biên bản "cảnh báo hoàn thành công việc" cũ vẫn xem được, không lập mới). Nhân viên đọc, ghi ý kiến, ký hoặc từ chối ký (ghi lý do). Biên bản chỉ ghi nhận — không trừ lương,
// không phạt tiền.
// ----------------------------------------------------------------------

const STATUS_COLOR: Record<HrRecordStatus, 'warning' | 'success' | 'error' | 'default'> = {
  AwaitingSignature: 'warning',
  Signed: 'success',
  RefusedToSign: 'error',
  Voided: 'default',
};

type Draft = {
  type: HrRecordType;
  staffId: string;
  occurredOn: string;
  amount: string;
  personalFault: 'yes' | 'no' | '';
  description: string;
  cause: string;
  violationLevel: string;
  evaluatedMonth: string;
  improvementPlan: string;
};

function newDraft(): Draft {
  const today = new Date();
  return {
    type: 'CashDiscrepancy',
    staffId: '',
    occurredOn: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    amount: '',
    personalFault: '',
    description: '',
    cause: '',
    violationLevel: '1',
    evaluatedMonth: previousMonth(monthStart()),
    improvementPlan: '',
  };
}

const isDiscrepancy = (t: HrRecordType) => t === 'CashDiscrepancy' || t === 'StockDiscrepancy';

export { parseAmount };

export default function HrRecordsView({ initialTab }: { initialTab?: string }) {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const canManage = hasPermission(user, PERMISSIONS.hr.recordManage);

  const [tab, setTab] = useState<'mine' | 'manage'>(initialTab === 'mine' || !canManage ? 'mine' : 'manage');
  const [month, setMonth] = useState(monthStart());
  const [typeFilter, setTypeFilter] = useState<HrRecordType | ''>('');
  const [records, setRecords] = useState<IHrRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const rules = useActiveHrRules();
  const cashThreshold = rules?.recordCashThreshold ?? null;
  const performanceOn = rules?.performanceEnabled ?? false;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [detail, setDetail] = useState<IHrRecord | null>(null);
  // Bồi thường (B7): Admin duyệt từ biên bản chênh lệch có lỗi cá nhân.
  const canManageCompensation = hasPermission(user, PERMISSIONS.hr.compensationManage);
  const [compensating, setCompensating] = useState<IHrRecord | null>(null);
  const [compensationsKey, setCompensationsKey] = useState(0);
  const [action, setAction] = useState<{ record: IHrRecord; kind: 'sign' | 'refuse' | 'void' | 'refused'; text: string } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(
        tab === 'mine' ? await getMyHrRecords() : await getHrRecords({ month, type: typeFilter || undefined })
      );
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được biên bản'), { variant: 'error' });
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [tab, month, typeFilter, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    getActiveStaffUsers()
      .then((users) => setStaff(users.map((u) => ({ id: u.id, name: u.fullName }))))
      .catch(() => setStaff([]));
  }, [canManage]);

  const amount = draft ? parseAmount(draft.amount) : null;
  const belowThreshold =
    draft?.type === 'CashDiscrepancy' && amount !== null && cashThreshold != null && Math.abs(amount) < cashThreshold;
  const draftValid =
    !!draft &&
    !!draft.staffId &&
    !!draft.description.trim() &&
    (!isDiscrepancy(draft.type) || (amount !== null && draft.personalFault !== '' && !belowThreshold));

  const create = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await createHrRecord({
        type: draft.type,
        staffId: draft.staffId,
        occurredOn: draft.occurredOn,
        amount: isDiscrepancy(draft.type) ? amount : null,
        description: draft.description.trim(),
        cause: draft.cause.trim() || null,
        personalFault: isDiscrepancy(draft.type) ? draft.personalFault === 'yes' : null,
        violationLevel: null,
        evaluatedMonth: null,
        improvementPlan: null,
      });
      enqueueSnackbar('Đã lập biên bản — nhân viên được báo để ký');
      setDraft(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lập được biên bản'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const runAction = async () => {
    if (!action) return;
    setBusy(true);
    try {
      const { record, kind, text } = action;
      if (kind === 'sign') await signHrRecord(record.id, text.trim());
      else if (kind === 'refuse') await refuseHrRecord(record.id, text.trim());
      else if (kind === 'refused') await markHrRecordRefused(record.id, text.trim());
      else await voidHrRecord(record.id, text.trim());
      setAction(null);
      setDetail(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Biên bản"
        links={[{ name: 'Nhân sự' }, { name: 'Biên bản' }]}
        action={
          canManage && (
            <Button variant="contained" onClick={() => setDraft(newDraft())}>
              Lập biên bản
            </Button>
          )
        }
        sx={{ mb: 2 }}
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        Biên bản chỉ ghi nhận sự việc — không phạt tiền. Bồi thường thiệt hại (nếu có lỗi cá nhân) là khoản riêng Admin
        duyệt, trừ dần tối đa 30% lương / tháng. Nhân viên được ghi ý kiến trước khi ký; không đồng ý thì
        từ chối ký và ghi rõ lý do.
      </Alert>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        {canManage && (
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab value="manage" label="Quản lý" />
            <Tab value="mine" label="Của tôi" />
          </Tabs>
        )}
        {tab === 'manage' && (
          <>
            <MonthField value={month} onChange={setMonth} />
            <TextField
              select
              size="small"
              label="Loại"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as HrRecordType | '')}
              sx={{ width: 220 }}
            >
              <MenuItem value="">Tất cả</MenuItem>
              {(Object.keys(HR_RECORD_TYPE_LABEL) as HrRecordType[]).map((t) => (
                <MenuItem key={t} value={t}>
                  {HR_RECORD_TYPE_LABEL[t]}
                </MenuItem>
              ))}
            </TextField>
          </>
        )}
      </Stack>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : records.length === 0 ? (
        <Card>
          <Typography color="text.secondary" sx={{ p: 3 }}>
            Không có biên bản nào.
          </Typography>
        </Card>
      ) : tab === 'mine' ? (
        <Stack spacing={1.5}>
          {records.map((r) => (
            <Card key={r.id}>
              <CardContent>
                <RecordBody record={r} />
                {r.status === 'AwaitingSignature' && (
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button variant="contained" onClick={() => setAction({ record: r, kind: 'sign', text: '' })}>
                      Ký xác nhận
                    </Button>
                    <Button color="error" onClick={() => setAction({ record: r, kind: 'refuse', text: '' })}>
                      Không ký
                    </Button>
                  </Stack>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ngày</TableCell>
                  <TableCell>Nhân viên</TableCell>
                  <TableCell>Loại</TableCell>
                  <TableCell align="right">Số tiền</TableCell>
                  <TableCell>Lỗi cá nhân</TableCell>
                  <TableCell>Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetail(r)}>
                    <TableCell>{fDate(r.occurredOn, 'dd/MM')}</TableCell>
                    <TableCell>{r.staffName}</TableCell>
                    <TableCell>
                      {HR_RECORD_TYPE_LABEL[r.type]}
                      {r.violationLevel ? ` · mức ${r.violationLevel}` : ''}
                    </TableCell>
                    <TableCell align="right">{r.amount != null ? fVnd(r.amount) : '—'}</TableCell>
                    <TableCell>{r.personalFault == null ? '—' : r.personalFault ? 'Có' : 'Không'}</TableCell>
                    <TableCell>
                      <Chip size="small" color={STATUS_COLOR[r.status]} label={HR_RECORD_STATUS_LABEL[r.status]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Bồi thường: quản lý thấy của mọi người (Admin), nhân viên thấy của mình */}
      {tab === 'manage' && canManageCompensation && <CompensationsPanel refreshKey={compensationsKey} />}
      {tab === 'mine' && <CompensationsPanel mine />}

      {/* Lập biên bản */}
      <Dialog open={!!draft} onClose={() => !busy && setDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>Lập biên bản</DialogTitle>
        <DialogContent>
          {draft && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                select
                label="Loại biên bản"
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as HrRecordType })}
              >
                {NEW_HR_RECORD_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {HR_RECORD_TYPE_LABEL[t]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Nhân viên" value={draft.staffId} onChange={(e) => setDraft({ ...draft, staffId: e.target.value })}>
                {staff.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                type="date"
                label="Ngày xảy ra"
                value={draft.occurredOn}
                onChange={(e) => setDraft({ ...draft, occurredOn: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              {isDiscrepancy(draft.type) && (
                <>
                  <TextField
                    label="Số tiền chênh lệch (âm = thiếu)"
                    value={draft.amount}
                    onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                    error={belowThreshold}
                    helperText={
                      belowThreshold
                        ? `Dưới ${fVnd(cashThreshold ?? 0)} không lập biên bản — chỉ ghi chú vào phiếu đối soát ca.`
                        : undefined
                    }
                  />
                  <Box>
                    <FormLabel>Có lỗi cá nhân?</FormLabel>
                    <RadioGroup
                      row
                      value={draft.personalFault}
                      onChange={(e) => setDraft({ ...draft, personalFault: e.target.value as 'yes' | 'no' })}
                    >
                      <FormControlLabel value="yes" control={<Radio />} label="Có" />
                      <FormControlLabel value="no" control={<Radio />} label="Không / chưa rõ" />
                    </RadioGroup>
                    {performanceOn && (
                      <Typography variant="caption" color="text.secondary">
                        Chỉ chênh lệch có lỗi cá nhân mới tính vào điểm hiệu suất.
                      </Typography>
                    )}
                  </Box>
                </>
              )}
              <TextField
                label="Nội dung sự việc"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                multiline
                minRows={3}
              />
              <TextField
                label="Nguyên nhân"
                value={draft.cause}
                onChange={(e) => setDraft({ ...draft, cause: e.target.value })}
                multiline
                minRows={2}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraft(null)} disabled={busy}>
            Đóng
          </Button>
          <LoadingButton variant="contained" loading={busy} disabled={!draftValid} onClick={create}>
            Lập biên bản
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Chi tiết (quản lý) */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} fullWidth maxWidth="sm">
        <DialogTitle>{detail && HR_RECORD_TYPE_LABEL[detail.type]}</DialogTitle>
        <DialogContent>{detail && <RecordBody record={detail} showStaff />}</DialogContent>
        <DialogActions>
          {detail && detail.status !== 'Voided' && (
            <Button color="error" onClick={() => setAction({ record: detail, kind: 'void', text: '' })} sx={{ mr: 'auto' }}>
              Huỷ biên bản
            </Button>
          )}
          {detail?.status === 'AwaitingSignature' && (
            <Button onClick={() => setAction({ record: detail, kind: 'refused', text: '' })}>Ghi nhận không ký</Button>
          )}
          {detail && canManageCompensation && canCompensate(detail) && (
            <Button
              variant="outlined"
              onClick={() => {
                setCompensating(detail);
                setDetail(null);
              }}
            >
              Lập bồi thường
            </Button>
          )}
          <Button onClick={() => setDetail(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      <CreateCompensationDialog
        record={compensating}
        onClose={() => setCompensating(null)}
        onCreated={() => setCompensationsKey((k) => k + 1)}
      />

      {/* Ký / không ký / huỷ */}
      <Dialog open={!!action} onClose={() => !busy && setAction(null)} fullWidth maxWidth="xs">
        <DialogTitle>
          {action?.kind === 'sign'
            ? 'Ký xác nhận biên bản'
            : action?.kind === 'void'
              ? 'Huỷ biên bản'
              : 'Không ký biên bản'}
        </DialogTitle>
        <DialogContent>
          {action && (
            <TextField
              fullWidth
              sx={{ mt: 1 }}
              label={
                action.kind === 'sign'
                  ? 'Ý kiến của tôi (tuỳ chọn)'
                  : action.kind === 'void'
                    ? 'Lý do huỷ'
                    : action.kind === 'refused'
                      ? 'Lý do nhân viên không ký'
                      : 'Lý do tôi không ký'
              }
              value={action.text}
              onChange={(e) => setAction({ ...action, text: e.target.value })}
              multiline
              minRows={3}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAction(null)} disabled={busy}>
            Đóng
          </Button>
          <LoadingButton
            variant="contained"
            color={action?.kind === 'sign' ? 'primary' : 'error'}
            loading={busy}
            disabled={action?.kind !== 'sign' && !action?.text.trim()}
            onClick={runAction}
          >
            {action?.kind === 'sign' ? 'Ký' : 'Xác nhận'}
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

// ----------------------------------------------------------------------

function RecordBody({ record: r, showStaff = false }: { record: IHrRecord; showStaff?: boolean }) {
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="subtitle1">
          {HR_RECORD_TYPE_LABEL[r.type]}
          {r.violationLevel ? ` · mức ${r.violationLevel}` : ''}
        </Typography>
        <Chip size="small" color={STATUS_COLOR[r.status]} label={HR_RECORD_STATUS_LABEL[r.status]} />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {showStaff && `${r.staffName} · `}Ngày {fDate(r.occurredOn)}
        {r.amount != null && ` · ${fVnd(r.amount)}`}
        {r.personalFault != null && ` · ${r.personalFault ? 'có lỗi cá nhân' : 'không do lỗi cá nhân'}`}
        {r.evaluatedMonth && ` · tháng ${fDate(r.evaluatedMonth, 'MM/yyyy')}`}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
        {r.description}
      </Typography>
      {r.cause && (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
          <strong>Nguyên nhân:</strong> {r.cause}
        </Typography>
      )}
      {r.improvementPlan && (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
          <strong>Kế hoạch cải thiện:</strong> {r.improvementPlan}
        </Typography>
      )}
      {r.staffStatement && (
        <Alert severity="info">
          <strong>Ý kiến nhân viên:</strong> {r.staffStatement}
        </Alert>
      )}
      {r.signedAt && (
        <Typography variant="caption" color="success.main">
          Đã ký {fDateTime(r.signedAt, 'HH:mm dd/MM/yyyy')}
        </Typography>
      )}
      {r.refusalReason && <Alert severity="warning">Không ký: {r.refusalReason}</Alert>}
      {r.voidReason && <Alert severity="error">Đã huỷ: {r.voidReason}</Alert>}
    </Stack>
  );
}
