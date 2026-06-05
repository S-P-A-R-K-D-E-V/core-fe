'use client';

import { useCallback, useEffect, useState } from 'react';

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

import { getMyShiftPoolClaims } from 'src/api/shiftPool';

import { fmtDate, needTypeLabel, poolStatusColor, poolStatusLabel } from './pool-helpers';

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

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Ca tôi nhận"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Đổi ca & Làm hộ' },
          { name: 'Ca tôi nhận' },
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
                  {posts.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: '16px' }}>{row.posterName}</td>
                      <td style={{ padding: '16px' }}>{row.shiftName}</td>
                      <td style={{ padding: '16px' }}>{fmtDate(row.shiftDate)}</td>
                      <td style={{ padding: '16px' }}>{needTypeLabel(row.needType)}</td>
                      <td style={{ padding: '16px' }}>
                        {row.extraPayAmount ? `${row.extraPayAmount.toLocaleString('vi-VN')}đ` : '-'}
                      </td>
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
        )}
      </Card>
    </Container>
  );
}
