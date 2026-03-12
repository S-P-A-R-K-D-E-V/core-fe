'use client';

import { useCallback, useEffect, useState } from 'react';

import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import {
  TableHeadCustom,
  TableNoData,
  TablePaginationCustom,
  useTable,
} from 'src/components/table';

import type { ISalaryHistory } from 'src/types/corecms-api';

import { getMySalaryHistory } from 'src/api/salaryHistory';
import { getAllUsers } from 'src/api/users';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'effectiveFrom', label: 'Hiệu lực từ', width: 120 },
  { id: 'effectiveTo', label: 'Hiệu lực đến', width: 120 },
  { id: 'salaryType', label: 'Loại lương', width: 120 },
  { id: 'amount', label: 'Mức lương', width: 150 },
  { id: 'probationRate', label: 'Tỷ lệ thử việc', width: 120 },
  { id: 'note', label: 'Ghi chú', width: 200 },
  { id: 'createdBy', label: 'Người tạo', width: 150 },
  { id: 'createdAt', label: 'Ngày tạo', width: 150 },
];

const SALARY_TYPES: Record<string, string> = {
  PerShift: 'Theo ca',
  Hourly: 'Theo giờ',
  Monthly: 'Theo tháng',
};

// ----------------------------------------------------------------------

export default function SalaryHistoryView() {
  const table = useTable();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [history, setHistory] = useState<ISalaryHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>('me');
  const [users, setUsers] = useState<any[]>([]);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMySalaryHistory();
      setHistory(data);
    } catch (error) {
      console.error('Error fetching salary history:', error);
      enqueueSnackbar('Không thể tải lịch sử lương', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchUsers();
  }, [fetchHistory, fetchUsers]);

  const formatCurrency = (amount: number) => `${amount.toLocaleString()}đ`;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Lịch sử thay đổi lương"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Quản lý lương', href: paths.dashboard.salary.root },
          { name: 'Lịch sử lương' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <Stack spacing={3} sx={{ p: 3 }}>
          <TextField
            select
            label="Nhân viên"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            SelectProps={{ native: true }}
            sx={{ maxWidth: 400 }}
          >
            <option value="me">Của tôi</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
          </TextField>
        </Stack>

        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <>
            <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
              <Scrollbar>
                <Table size="medium">
                  <TableHeadCustom headLabel={TABLE_HEAD} />
                  <TableBody>
                    {history.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.effectiveFrom}</TableCell>
                        <TableCell>
                          {record.effectiveTo || (
                            <Label color="success" variant="soft">
                              Hiện tại
                            </Label>
                          )}
                        </TableCell>
                        <TableCell>
                          <Label variant="soft" color="info">
                            {SALARY_TYPES[record.salaryType] || record.salaryType}
                          </Label>
                        </TableCell>
                        <TableCell>{formatCurrency(record.amount)}</TableCell>
                        <TableCell>
                          {record.probationRate ? (
                            <Label variant="soft" color="warning">
                              {(record.probationRate * 100).toFixed(0)}%
                            </Label>
                          ) : (
                            '100%'
                          )}
                        </TableCell>
                        <TableCell>{record.note || '-'}</TableCell>
                        <TableCell>{record.createdByName}</TableCell>
                        <TableCell>{formatDate(record.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {history.length === 0 && <TableNoData notFound />}
                  </TableBody>
                </Table>
              </Scrollbar>
            </TableContainer>

            <TablePaginationCustom
              count={history.length}
              page={table.page}
              rowsPerPage={table.rowsPerPage}
              onPageChange={table.onChangePage}
              onRowsPerPageChange={table.onChangeRowsPerPage}
            />
          </>
        )}
      </Card>
    </Container>
  );
}
