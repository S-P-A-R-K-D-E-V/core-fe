'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { getPlatformAccessLogs, type PlatformAccessLog } from 'src/api/platform-features';

import Label from 'src/components/label';

// ----------------------------------------------------------------------
// Nhật ký gọi tính năng theo nền tảng (Core-be PlatformAccessLogs): ai dùng tính năng nào lúc nào, trên web hay app, có bị
// chặn không, và có dấu hiệu sửa nền tảng không (vd khai là app nhưng gọi từ trình duyệt). Tự chấm công ghi mọi lượt; tính
// năng khác chỉ ghi lượt bị chặn hoặc nghi sửa nền tảng.

const ACTION_LABELS: Record<string, string> = {
  CheckIn: 'Vào ca',
  CheckInWithFace: 'Vào ca (khuôn mặt)',
  SmartCheckIn: 'Vào ca',
  SmartCheckInWithFace: 'Vào ca (khuôn mặt)',
  CheckOut: 'Ra ca',
  SmartCheckOut: 'Ra ca',
  SmartCheckOutWithFace: 'Ra ca (khuôn mặt)',
};

const PLATFORM_TEXT: Record<string, string> = { web: 'Web', app: 'App' };

type Props = {
  /** Tên tính năng theo mã (GET /platform-features) — log cũ / mã lạ hiện nguyên mã. */
  featureLabels?: Record<string, string>;
};

/** Lý do bị đánh dấu nghi sửa nền tảng, dễ hiểu với chủ cửa hàng. */
export function suspicionReason(log: PlatformAccessLog): string {
  if (log.isBrowser && log.declaredPlatform === 'app') return 'Khai là app nhưng gọi từ trình duyệt (đã sửa header).';
  if (log.isBrowser && log.sessionPlatform === 'app') return 'Phiên đăng nhập của app bị dùng trên trình duyệt.';
  if (!log.isBrowser && log.sessionPlatform === 'web' && log.declaredPlatform === 'app')
    return 'Phiên đăng nhập web bị dùng ngoài trình duyệt, khai là app.';
  return 'Các dấu hiệu nền tảng không khớp nhau.';
}

const PAGE_SIZE = 20;

export default function PlatformAccessLogCard({ featureLabels = {} }: Props) {
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<PlatformAccessLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPlatformAccessLogs({ suspiciousOnly, page: page + 1, pageSize: PAGE_SIZE });
      setRows(data.data);
      setTotal(data.total);
    } catch (err) {
      setError(apiErrorMessage(err, 'Không tải được nhật ký.'));
    } finally {
      setLoading(false);
    }
  }, [suspiciousOnly, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }} spacing={2}>
        <Typography variant="h6">Nhật ký theo nền tảng</Typography>
        <FormControlLabel
          control={
            <Switch
              checked={suspiciousOnly}
              onChange={(e) => {
                setSuspiciousOnly(e.target.checked);
                setPage(0);
              }}
            />
          }
          label="Chỉ hiện nghi sửa nền tảng"
        />
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Mỗi lần tự chấm công đều được ghi lại; các tính năng khác chỉ ghi lượt bị chặn hoặc nghi sửa nền tảng. Hệ thống tự
        nhận ra trình duyệt nên sửa cài đặt trên web không thành app được; lượt có dấu hiệu sửa được đánh dấu để chủ cửa
        hàng kiểm tra.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      {!error && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Thời gian</TableCell>
                <TableCell>Nhân viên</TableCell>
                <TableCell>Tính năng</TableCell>
                <TableCell>Nền tảng</TableCell>
                <TableCell>Kết quả</TableCell>
                <TableCell>Cảnh báo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ color: 'text.secondary' }}>
                    Chưa có lượt nào
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                rows.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDateTime(log.createdAt)}</TableCell>
                    <TableCell>{log.userName || '—'}</TableCell>
                    <TableCell>
                      {featureLabels[log.featureKey] ?? log.featureKey}
                      {ACTION_LABELS[log.action] && (
                        <Typography component="div" variant="caption" sx={{ color: 'text.secondary' }}>
                          {ACTION_LABELS[log.action]}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={[log.userAgent, log.ipAddress].filter(Boolean).join(' · ') || ''}>
                        <span>{log.platform ? PLATFORM_TEXT[log.platform] ?? log.platform : 'Không rõ'}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {log.blocked ? (
                        <Label color="error">Bị chặn</Label>
                      ) : (
                        <Label color={log.statusCode < 400 ? 'success' : 'default'}>
                          {log.statusCode < 400 ? 'Thành công' : 'Không thành công'}
                        </Label>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.suspicious ? (
                        <Tooltip title={suspicionReason(log)}>
                          <span>
                            <Label color="warning">Nghi sửa nền tảng</Label>
                          </span>
                        </Tooltip>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          />
        </TableContainer>
      )}
    </Card>
  );
}
