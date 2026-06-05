'use client';

import { useCallback, useEffect, useState } from 'react';

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import { TableHeadCustom, TableNoData } from 'src/components/table';

import type { IShiftPoolPost } from 'src/types/corecms-api';

import { cancelShiftPoolPost, getMyShiftPoolPosts } from 'src/api/shiftPool';

import { fmtDate, needTypeLabel, poolStatusColor, poolStatusLabel } from './pool-helpers';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'shift', label: 'Ca', width: 160 },
  { id: 'date', label: 'Ngày', width: 110 },
  { id: 'need', label: 'Nhu cầu', width: 130 },
  { id: 'claimer', label: 'Người nhận', width: 150 },
  { id: 'status', label: 'Trạng thái', width: 120 },
  { id: 'reviewNote', label: 'Phản hồi', width: 150 },
  { id: 'action', label: '', width: 90 },
];

// ----------------------------------------------------------------------

export default function MyPoolPostsView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [posts, setPosts] = useState<IShiftPoolPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setPosts(await getMyShiftPoolPosts());
    } catch {
      enqueueSnackbar('Không thể tải dữ liệu', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCancel = async (id: string) => {
    try {
      await cancelShiftPoolPost(id);
      enqueueSnackbar('Đã huỷ bài đăng.', { variant: 'success' });
      fetchData();
    } catch (error: any) {
      enqueueSnackbar(error?.title || error?.message || 'Huỷ thất bại!', { variant: 'error' });
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Bài đăng của tôi"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Đổi ca & Làm hộ' },
          { name: 'Bài đăng của tôi' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table>
                <TableHeadCustom headLabel={TABLE_HEAD} />
                <TableBody>
                  {posts.map((row) => {
                    const canCancel = row.status === 'Open' || row.status === 'WaitingApproval';
                    return (
                      <tr key={row.id}>
                        <td style={{ padding: '16px' }}>{row.shiftName}</td>
                        <td style={{ padding: '16px' }}>{fmtDate(row.shiftDate)}</td>
                        <td style={{ padding: '16px' }}>{needTypeLabel(row.needType)}</td>
                        <td style={{ padding: '16px' }}>{row.claimerName || '-'}</td>
                        <td style={{ padding: '16px' }}>
                          <Label color={poolStatusColor(row.status)}>{poolStatusLabel(row.status)}</Label>
                        </td>
                        <td style={{ padding: '16px' }}>{row.reviewNote || '-'}</td>
                        <td style={{ padding: '16px' }}>
                          {canCancel && (
                            <Button size="small" color="error" onClick={() => handleCancel(row.id)}>
                              Huỷ
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {posts.length === 0 && <TableNoData notFound />}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        )}
      </Card>
    </Container>
  );
}
