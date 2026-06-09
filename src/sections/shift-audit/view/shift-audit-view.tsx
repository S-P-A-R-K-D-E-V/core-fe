'use client';

import type { ReactNode } from 'react';

import { useCallback, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';

import { type IShiftAuditLog, getShiftAuditLogs } from 'src/api/shiftAudit';

// ----------------------------------------------------------------------

const ACTION_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  ASSIGN: 'primary',
  BULK_ASSIGN: 'primary',
  MANAGE_ASSIGN: 'info',
  SWAP_DIRECTED: 'warning',
  CREATE_POST: 'default',
  CLAIM_POST: 'info',
  CANCEL_POST: 'default',
  APPROVE_POST: 'success',
  REJECT_CLAIM: 'error',
  DIRECTED_RESOLVE: 'warning',
  SET_PREFERENCE: 'secondary',
};

const ACTION_LABELS: Record<string, string> = {
  ASSIGN: 'Phân công',
  BULK_ASSIGN: 'Phân công hàng loạt',
  MANAGE_ASSIGN: 'Quản lý phân công',
  SWAP_DIRECTED: 'Chỉ định đổi ca',
  CREATE_POST: 'Đăng pool',
  CLAIM_POST: 'Nhận ca',
  CANCEL_POST: 'Huỷ đăng',
  APPROVE_POST: 'Duyệt pool',
  REJECT_CLAIM: 'Từ chối nhận',
  DIRECTED_RESOLVE: 'Chỉ định giải quyết',
  SET_PREFERENCE: 'Cài ca ưa thích',
};

const ROLE_COLORS: Record<string, 'default' | 'primary' | 'warning' | 'error'> = {
  Admin: 'error',
  Manager: 'warning',
  Staff: 'primary',
};

const ACTION_TYPES = Object.keys(ACTION_LABELS);

function toVNDateTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function toVNDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

/** Sinh summary text "A → B" từ oldData/newData JSON */
function parseChangeSummary(log: IShiftAuditLog): ReactNode | null {
  if (!log.oldData && !log.newData) return null;

  try {
    const old = log.oldData ? JSON.parse(log.oldData) : null;
    const next = log.newData ? JSON.parse(log.newData) : null;

    if (log.actionType === 'SWAP_DIRECTED' || (log.actionType === 'APPROVE_POST' && log.needType === 'Swap')) {
      // old.Staff1, old.Staff2 → new.Staff1NowHas, new.Staff2NowHas
      const s1 = old?.Staff1 ?? old?.staff1;
      const s2 = old?.Staff2 ?? old?.staff2;
      const n1 = next?.Staff1NowHas ?? next?.staff1NowHas;
      const n2 = next?.Staff2NowHas ?? next?.staff2NowHas;
      if (!s1 || !s2) return null;
      return (
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>
              {s1.Name ?? s1.name}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              ({s1.ShiftDate ?? s1.shiftDate} · {s1.ShiftName ?? s1.shiftName})
            </Typography>
            <Iconify icon="eva:arrow-right-fill" width={14} sx={{ color: 'text.disabled', flexShrink: 0 }} />
            <Typography variant="caption" color="success.main" noWrap>
              {n1?.ShiftDate ?? n1?.shiftDate} · {n1?.ShiftName ?? n1?.shiftName}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>
              {s2.Name ?? s2.name}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              ({s2.ShiftDate ?? s2.shiftDate} · {s2.ShiftName ?? s2.shiftName})
            </Typography>
            <Iconify icon="eva:arrow-right-fill" width={14} sx={{ color: 'text.disabled', flexShrink: 0 }} />
            <Typography variant="caption" color="success.main" noWrap>
              {n2?.ShiftDate ?? n2?.shiftDate} · {n2?.ShiftName ?? n2?.shiftName}
            </Typography>
          </Stack>
        </Stack>
      );
    }

    if (log.actionType === 'APPROVE_POST' && log.needType === 'FullCover') {
      const poster  = old?.Poster  ?? old?.poster;
      const newStaff = next?.NewStaff ?? next?.newStaff;
      if (!poster) return null;
      return (
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
          <Typography variant="caption" color="text.secondary" noWrap>
            {poster.Name ?? poster.name}
          </Typography>
          <Iconify icon="eva:arrow-right-fill" width={14} sx={{ color: 'text.disabled', flexShrink: 0 }} />
          <Typography variant="caption" color="success.main" noWrap>
            {newStaff?.Name ?? newStaff?.name}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            ({poster.ShiftDate ?? poster.shiftDate} · {poster.ShiftName ?? poster.shiftName})
          </Typography>
        </Stack>
      );
    }

    if (log.actionType === 'APPROVE_POST' && log.needType === 'PartialCover') {
      const poster   = old?.Poster  ?? old?.poster;
      const claimer  = next?.Claimer ?? next?.claimer;
      if (!poster || !claimer) return null;
      const pay = claimer.ExtraPay ?? claimer.extraPay;
      const hrs = claimer.Hours    ?? claimer.hours;
      return (
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" color="text.secondary">
              {poster.Name ?? poster.name}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              ({poster.PartialFrom ?? poster.partialFrom} – {poster.PartialTo ?? poster.partialTo})
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="caption" color="info.main">
              Làm hộ: {claimer.Name ?? claimer.name}
            </Typography>
            {pay != null && (
              <Chip
                label={`${Number(pay).toLocaleString('vi-VN')}đ${hrs ? ` (${hrs}h)` : ''}`}
                size="small"
                color="warning"
                variant="soft"
              />
            )}
          </Stack>
        </Stack>
      );
    }
  } catch {
    // JSON parse fail
  }
  return null;
}

/** Raw JSON viewer cho expand row */
function RawDataView({ label, json }: { label: string; json?: string }) {
  if (!json) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { parsed = json; }
  return (
    <Box>
      <Typography variant="caption" color="text.disabled" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      <Box
        component="pre"
        sx={{
          fontSize: 11,
          bgcolor: 'action.hover',
          borderRadius: 1,
          p: 1,
          overflow: 'auto',
          maxHeight: 140,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          m: 0,
        }}
      >
        {JSON.stringify(parsed, null, 2)}
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

function AuditRow({ log }: { log: IShiftAuditLog }) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!(log.oldData || log.newData || log.note || log.affectedStaffIds?.length > 0);
  const changeSummary = parseChangeSummary(log);

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: open ? 'unset' : undefined } }}>
        {/* Thời gian */}
        <TableCell sx={{ minWidth: 150, verticalAlign: 'top' }}>
          <Typography variant="caption" noWrap color="text.secondary">
            {toVNDateTime(log.timestamp)}
          </Typography>
        </TableCell>

        {/* Thao tác */}
        <TableCell sx={{ minWidth: 130, verticalAlign: 'top' }}>
          <Chip
            label={ACTION_LABELS[log.actionType] ?? log.actionType}
            color={ACTION_COLORS[log.actionType] ?? 'default'}
            size="small"
            variant="soft"
          />
          {log.needType && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.3 }}>
              {log.needType}
            </Typography>
          )}
        </TableCell>

        {/* Người thực hiện */}
        <TableCell sx={{ minWidth: 150, verticalAlign: 'top' }}>
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
            <Tooltip title={`ID: ${log.actorId}`} placement="top">
              <Typography variant="body2" noWrap sx={{ maxWidth: 120, cursor: 'default' }}>
                {log.actorName}
              </Typography>
            </Tooltip>
            <Chip
              label={log.actorRole}
              color={ROLE_COLORS[log.actorRole] ?? 'default'}
              size="small"
              variant="soft"
              sx={{ height: 16, fontSize: 10 }}
            />
          </Stack>
        </TableCell>

        {/* Ngày ca */}
        <TableCell sx={{ minWidth: 100, verticalAlign: 'top' }}>
          <Typography variant="body2">{log.shiftDate}</Typography>
        </TableCell>

        {/* Nội dung thay đổi */}
        <TableCell sx={{ minWidth: 260, verticalAlign: 'top' }}>
          {changeSummary ?? (
            <Typography variant="caption" color="text.disabled">—</Typography>
          )}
        </TableCell>

        {/* Ghi chú */}
        <TableCell sx={{ minWidth: 120, verticalAlign: 'top' }}>
          <Typography variant="caption" color="text.secondary">
            {log.note ?? '—'}
          </Typography>
        </TableCell>

        {/* Expand */}
        <TableCell sx={{ width: 40, verticalAlign: 'top', px: 0 }}>
          {hasDetail && (
            <IconButton size="small" onClick={() => setOpen((v) => !v)}>
              <Iconify
                icon={open ? 'eva:chevron-up-fill' : 'eva:chevron-down-fill'}
                width={16}
              />
            </IconButton>
          )}
        </TableCell>
      </TableRow>

      {/* Expand detail row */}
      {hasDetail && (
        <TableRow>
          <TableCell colSpan={7} sx={{ py: 0, px: 2, bgcolor: 'background.neutral' }}>
            <Collapse in={open} unmountOnExit>
              <Stack spacing={1.5} sx={{ py: 1.5 }}>
                {/* Nhân viên bị ảnh hưởng */}
                {log.affectedStaffIds?.length > 0 && (
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="caption" color="text.secondary">
                      Nhân viên liên quan:
                    </Typography>
                    {log.affectedStaffIds.map((id) => (
                      <Chip key={id} label={id.slice(0, 8) + '…'} size="small" variant="soft" />
                    ))}
                  </Stack>
                )}
                {/* Raw JSON */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Box flex={1}>
                    <RawDataView label="Trước thay đổi (oldData)" json={log.oldData} />
                  </Box>
                  <Box flex={1}>
                    <RawDataView label="Sau thay đổi (newData)" json={log.newData} />
                  </Box>
                </Stack>
                {/* Entity info */}
                <Typography variant="caption" color="text.disabled">
                  Entity: {log.entityType} / {log.entityId}
                </Typography>
              </Stack>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ----------------------------------------------------------------------

export default function ShiftAuditView() {
  const settings = useSettingsContext();

  // Default: 7 ngày gần nhất
  const todayStr = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(sevenDaysAgo);
  const [dateTo, setDateTo] = useState(todayStr);
  const [actionType, setActionType] = useState('');
  const [logs, setLogs] = useState<IShiftAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getShiftAuditLogs({
        from: dateFrom,
        to: dateTo,
        actionType: actionType || undefined,
        limit: 500,
      });
      setLogs(data);
    } catch {
      setError('Không thể tải audit log. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, actionType]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Quick range shortcuts
  const setQuickRange = (days: number) => {
    const now = new Date();
    setDateTo(now.toISOString().slice(0, 10));
    setDateFrom(new Date(now.getTime() - (days - 1) * 24 * 3600 * 1000).toISOString().slice(0, 10));
  };

  const TABLE_HEAD = [
    { label: 'Thời gian', minWidth: 150 },
    { label: 'Thao tác', minWidth: 130 },
    { label: 'Người thực hiện', minWidth: 150 },
    { label: 'Ngày ca', minWidth: 100 },
    { label: 'Nội dung thay đổi', minWidth: 260 },
    { label: 'Ghi chú', minWidth: 120 },
    { label: '', minWidth: 40 },
  ];

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Audit Log ca làm"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Audit Log ca làm' },
        ]}
        sx={{ mb: 3 }}
      />

      {/* Bộ lọc */}
      <Card sx={{ p: 2, mb: 2.5 }}>
        <Stack spacing={2}>
          {/* Date range */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              label="Từ ngày"
              type="date"
              size="small"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160 }}
            />
            <TextField
              label="Đến ngày"
              type="date"
              size="small"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160 }}
            />
            <TextField
              label="Loại thao tác"
              select
              size="small"
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Tất cả</MenuItem>
              {ACTION_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {ACTION_LABELS[t] ?? t}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {/* Quick range chips */}
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              Nhanh:
            </Typography>
            {[
              { label: 'Hôm nay', days: 1 },
              { label: '7 ngày', days: 7 },
              { label: '30 ngày', days: 30 },
              { label: '90 ngày', days: 90 },
            ].map(({ label, days }) => (
              <Chip
                key={days}
                label={label}
                size="small"
                variant="soft"
                onClick={() => setQuickRange(days)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Typography variant="caption" color="text.disabled" sx={{ alignSelf: 'center' }}>
              {toVNDate(dateFrom)} – {toVNDate(dateTo)}
            </Typography>
          </Stack>
        </Stack>
      </Card>

      <Card>
        {loading && (
          <Stack alignItems="center" py={5}>
            <CircularProgress size={28} />
          </Stack>
        )}

        {!loading && error && (
          <Typography color="error" sx={{ p: 3 }}>
            {error}
          </Typography>
        )}

        {!loading && !error && (
          <Scrollbar>
            <TableContainer sx={{ minWidth: 900 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {TABLE_HEAD.map((h) => (
                      <TableCell key={h.label} sx={{ minWidth: h.minWidth }}>
                        {h.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        Không có dữ liệu trong khoảng thời gian này.
                      </TableCell>
                    </TableRow>
                  )}
                  {logs.map((log) => (
                    <AuditRow key={log.id} log={log} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>
        )}

        {!loading && !error && (
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="caption" color="text.secondary">
              {toVNDate(dateFrom)} – {toVNDate(dateTo)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {logs.length} bản ghi
            </Typography>
          </Stack>
        )}
      </Card>
    </Container>
  );
}
