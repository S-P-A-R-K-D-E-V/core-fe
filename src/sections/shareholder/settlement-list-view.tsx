'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import Container from '@mui/material/Container';
import TableContainer from '@mui/material/TableContainer';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { TableHeadCustom, TableNoData } from 'src/components/table';
import { fCurrency } from 'src/utils/format-number';
import { fDate } from 'src/utils/format-time';

import { ISettlementListItem } from 'src/types/corecms-api';
import { getSettlements } from 'src/api/shareholders';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Tên kỳ' },
  { id: 'period', label: 'Khoảng thời gian', width: 220 },
  { id: 'profit', label: 'Lợi nhuận', align: 'right' as const, width: 160 },
  { id: 'status', label: 'Trạng thái', width: 120 },
  { id: 'closedAt', label: 'Ngày chốt', width: 140 },
  { id: '', width: 60 },
];

export default function SettlementListView() {
  const { enqueueSnackbar } = useSnackbar();
  const router = useRouter();
  const [tableData, setTableData] = useState<ISettlementListItem[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setTableData(await getSettlements());
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải danh sách kỳ chốt sổ', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <Container maxWidth="xl">
        <CustomBreadcrumbs
          heading="Danh sách kỳ chốt sổ"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Hoạch toán cổ đông', href: paths.dashboard.pos.shareholder.list },
            { name: 'Kỳ chốt sổ' },
          ]}
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.pos.shareholder.settlement}
              variant="contained"
              startIcon={<Iconify icon="solar:lock-keyhole-bold" />}
            >
              Chốt sổ kỳ mới
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table sx={{ minWidth: 800 }}>
                <TableHeadCustom headLabel={TABLE_HEAD} rowCount={tableData.length} />
                <TableBody>
                  {tableData.map((row) => (
                    <TableRow
                      key={row.id}
                      hover
                      onClick={() => router.push(paths.dashboard.pos.shareholder.settlementDetails(row.id))}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Typography variant="subtitle2">{row.name}</Typography>
                      </TableCell>
                      <TableCell>
                        {fDate(row.fromDate)} — {fDate(row.toDate)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="subtitle2"
                          color={row.profit >= 0 ? 'success.main' : 'error.main'}
                        >
                          {fCurrency(row.profit)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.status === 'Closed' ? 'Đã chốt' : 'Mở'}
                          color={row.status === 'Closed' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{row.closedAt ? fDate(row.closedAt) : '—'}</TableCell>
                      <TableCell align="right">
                        <Iconify icon="eva:arrow-ios-forward-fill" />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableNoData notFound={!tableData.length} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        </Card>
      </Container>
    </RoleBasedGuard>
  );
}
