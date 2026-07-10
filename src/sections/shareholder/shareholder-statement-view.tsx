'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

import { paths } from 'src/routes/paths';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { AppDatePicker } from 'src/components/date-time-picker';
import { TableHeadCustom, TableNoData } from 'src/components/table';
import { fCurrency } from 'src/utils/format-number';
import { fDate } from 'src/utils/format-time';

import { IShareholder, IShareholderStatement, CapitalTransactionType } from 'src/types/corecms-api';
import { getShareholders, getShareholderStatement } from 'src/api/shareholders';

// ----------------------------------------------------------------------

const LINE_HEAD = [
  { id: 'transactionDate', label: 'Ngày', width: 110 },
  { id: 'type', label: 'Loại', width: 170 },
  { id: 'amount', label: 'Số tiền', align: 'right' as const, width: 150 },
  { id: 'counterparty', label: 'Bên liên quan', width: 140 },
  { id: 'note', label: 'Ghi chú' },
];

const TYPE_LABEL: Record<CapitalTransactionType, string> = {
  Contribution: 'Góp vốn',
  ExpensePaidOnBehalf: 'Chi hộ',
  RevenueCollected: 'Thu về túi',
  Withdrawal: 'Rút tiền',
  PeerTransfer: 'Chuyển cho cổ đông',
};

function getDefaultDates() {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: now.toISOString().slice(0, 10),
  };
}

export default function ShareholderStatementView() {
  const { enqueueSnackbar } = useSnackbar();
  const defaults = getDefaultDates();

  const [shareholders, setShareholders] = useState<IShareholder[]>([]);
  const [shareholderId, setShareholderId] = useState('');
  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [data, setData] = useState<IShareholderStatement | null>(null);

  const fetchShareholders = useCallback(async () => {
    try {
      const result = await getShareholders(true);
      setShareholders(result);
      if (result.length > 0) setShareholderId((prev) => prev || result[0].id);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchStatement = useCallback(async () => {
    if (!shareholderId) return;
    try {
      const result = await getShareholderStatement(shareholderId, { fromDate, toDate });
      setData(result);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải sao kê', { variant: 'error' });
    }
  }, [shareholderId, fromDate, toDate, enqueueSnackbar]);

  useEffect(() => {
    fetchShareholders();
  }, [fetchShareholders]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <Container maxWidth="xl">
        <CustomBreadcrumbs
          heading="Sao kê cổ đông"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Hoạch toán cổ đông', href: paths.dashboard.pos.shareholder.list },
            { name: 'Sao kê' },
          ]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                select
                label="Cổ đông"
                value={shareholderId}
                onChange={(e) => setShareholderId(e.target.value)}
                size="small"
                sx={{ minWidth: 200 }}
              >
                {shareholders.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
              <AppDatePicker label="Từ ngày" value={fromDate} onChange={setFromDate} size="small" />
              <AppDatePicker label="Đến ngày" value={toDate} onChange={setToDate} size="small" />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              &quot;Thu tự động qua kênh&quot; là doanh thu khớp qua kênh thu tiền — không cần nhập tay, cùng
              công thức với lúc chốt sổ nên số liệu luôn khớp nhau.
            </Typography>
          </CardContent>
        </Card>

        {data && (
          <>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Đã đưa vào</Typography>
                    <Typography variant="h6" color="success.main">{fCurrency(data.totalPutIn)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Đã lấy ra (nhập tay)</Typography>
                    <Typography variant="h6">{fCurrency(data.manualCollectedOut)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Card>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="subtitle2" color="text.secondary">Thu tự động qua kênh</Typography>
                      <Chip size="small" color="info" variant="soft" label="tự tính" />
                    </Stack>
                    <Typography variant="h6" color="info.main">{fCurrency(data.channelCollected)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Tổng đã lấy ra</Typography>
                    <Typography variant="h6" color="error.main">{fCurrency(data.totalTakenOut)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Vị thế ròng</Typography>
                    <Typography variant="h6" color={data.netPosition >= 0 ? 'success.main' : 'error.main'}>
                      {data.netPosition >= 0 ? '+' : ''}
                      {fCurrency(data.netPosition)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Stack direction="row" spacing={4}>
                  <Stack>
                    <Typography variant="subtitle2" color="text.secondary">Đã trả cổ đông khác</Typography>
                    <Typography variant="subtitle1">{fCurrency(data.totalPaidToPeers)}</Typography>
                  </Stack>
                  <Stack>
                    <Typography variant="subtitle2" color="text.secondary">Đã nhận từ cổ đông khác</Typography>
                    <Typography variant="subtitle1">{fCurrency(data.totalReceivedFromPeers)}</Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Chi tiết giao dịch</Typography>
                <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
                  <Scrollbar>
                    <Table sx={{ minWidth: 800 }}>
                      <TableHeadCustom headLabel={LINE_HEAD} rowCount={data.lines.length} />
                      <TableBody>
                        {data.lines.map((line) => (
                          <TableRow key={line.transactionId} hover>
                            <TableCell>{fDate(line.transactionDate)}</TableCell>
                            <TableCell>{TYPE_LABEL[line.type] ?? line.type}</TableCell>
                            <TableCell align="right">
                              <Typography
                                variant="subtitle2"
                                color={line.signedAmount >= 0 ? 'success.main' : 'error.main'}
                              >
                                {line.signedAmount >= 0 ? '+' : ''}
                                {fCurrency(line.signedAmount)}
                              </Typography>
                            </TableCell>
                            <TableCell>{line.counterpartyName || '—'}</TableCell>
                            <TableCell>{line.note || '—'}</TableCell>
                          </TableRow>
                        ))}
                        <TableNoData notFound={!data.lines.length} />
                      </TableBody>
                    </Table>
                  </Scrollbar>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        )}
      </Container>
    </RoleBasedGuard>
  );
}
