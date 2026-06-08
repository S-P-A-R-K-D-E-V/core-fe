'use client';

import { useCallback, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import { TableHeadCustom, TableNoData } from 'src/components/table';

import type { IShiftPoolPost } from 'src/types/corecms-api';

import { getMyShiftPoolClaims } from 'src/api/shiftPool';

import PoolCalendar from './pool-calendar';
import LegendDot from './pool-legend';
import { fmtDate, needTypeLabel, poolStatusColor, poolStatusLabel, statusHex } from './pool-helpers';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'poster', label: 'Người đăng', width: 150 },
  { id: 'shift', label: 'Ca', width: 160 },
  { id: 'date', label: 'Ngày', width: 110 },
  { id: 'need', label: 'Nhu cầu', width: 130 },
  { id: 'pay', label: 'Phụ cấp', width: 120 },
  { id: 'status', label: 'Trạng thái', width: 120 },
  { id: 'reviewNote', label: 'Phản hồi', width: 150 },
];

// ----------------------------------------------------------------------

export default function MyPoolClaimsView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [posts, setPosts] = useState<IShiftPoolPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
  const [selected, setSelected] = useState<IShiftPoolPost | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setPosts(await getMyShiftPoolClaims());
    } catch {
      enqueueSnackbar('Không thể tải dữ liệu', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmtPay = (v?: number) => (v ? `${v.toLocaleString('vi-VN')}đ` : '-');

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Ca tôi nhận"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Đổi ca & Làm hộ' },
          { name: 'Ca tôi nhận' },
        ]}
        action={
          <ToggleButtonGroup
            size="small"
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
          >
            <ToggleButton value="calendar">
              <Iconify icon="eva:calendar-fill" />
            </ToggleButton>
            <ToggleButton value="table">
              <Iconify icon="eva:list-fill" />
            </ToggleButton>
          </ToggleButtonGroup>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {loading ? (
        <Card>
          <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
            <CircularProgress />
          </Stack>
        </Card>
      ) : viewMode === 'calendar' ? (
        <>
          <PoolCalendar
            posts={posts}
            getColor={(p) => statusHex(p.status)}
            getTitle={(p) => `${needTypeLabel(p.needType)} · ${p.posterName}`}
            onClickPost={setSelected}
          />
          <Stack direction="row" spacing={2} sx={{ mt: 1.5, px: 1 }} flexWrap="wrap">
            <LegendDot color={statusHex('WaitingApproval')} label="Chờ duyệt" />
            <LegendDot color={statusHex('Approved')} label="Đã duyệt" />
            <LegendDot color={statusHex('Cancelled')} label="Đã huỷ" />
          </Stack>
        </>
      ) : (
        <Card>
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table>
                <TableHeadCustom headLabel={TABLE_HEAD} />
                <TableBody>
                  {posts.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: '16px' }}>{row.posterName}</td>
                      <td style={{ padding: '16px' }}>{row.shiftName}</td>
                      <td style={{ padding: '16px' }}>{fmtDate(row.shiftDate)}</td>
                      <td style={{ padding: '16px' }}>{needTypeLabel(row.needType)}</td>
                      <td style={{ padding: '16px' }}>{fmtPay(row.extraPayAmount)}</td>
                      <td style={{ padding: '16px' }}>
                        <Label color={poolStatusColor(row.status)}>{poolStatusLabel(row.status)}</Label>
                      </td>
                      <td style={{ padding: '16px' }}>{row.reviewNote || '-'}</td>
                    </tr>
                  ))}
                  {posts.length === 0 && <TableNoData notFound />}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        </Card>
      )}

      {/* Detail dialog (calendar click) */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Ca tôi nhận</DialogTitle>
        <DialogContent>
          {selected && (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography variant="subtitle2">
                {needTypeLabel(selected.needType)} · {selected.shiftName} · {fmtDate(selected.shiftDate)}
              </Typography>
              <Typography variant="body2">Người đăng: {selected.posterName}</Typography>
              {selected.needType === 'PartialCover' && selected.partialStartTime && (
                <Typography variant="body2">
                  Khoảng làm hộ: {selected.partialStartTime} - {selected.partialEndTime}
                </Typography>
              )}
              {!!selected.extraPayAmount && (
                <Typography variant="body2">Phụ cấp: {fmtPay(selected.extraPayAmount)}</Typography>
              )}
              <Box>
                <Label color={poolStatusColor(selected.status)}>{poolStatusLabel(selected.status)}</Label>
              </Box>
              {selected.reviewNote && (
                <Typography variant="body2" color="text.secondary">
                  Phản hồi: {selected.reviewNote}
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setSelected(null)}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
