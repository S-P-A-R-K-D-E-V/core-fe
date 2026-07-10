'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import Container from '@mui/material/Container';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { TableHeadCustom, TableNoData } from 'src/components/table';
import { fCurrency, fPercent } from 'src/utils/format-number';
import { fDate } from 'src/utils/format-time';

import { ISettlementDetail } from 'src/types/corecms-api';
import { getSettlementById, markTransferPaid } from 'src/api/shareholders';

// ----------------------------------------------------------------------

const LINE_HEAD = [
  { id: 'shareholder', label: 'Cổ đông' },
  { id: 'equity', label: '% Sở hữu', align: 'right' as const, width: 100 },
  { id: 'profitShare', label: 'Chia lợi nhuận', align: 'right' as const, width: 150 },
  { id: 'paidIn', label: 'Đã đưa vào', align: 'right' as const, width: 150 },
  { id: 'collectedOut', label: 'Đã lấy ra', align: 'right' as const, width: 150 },
  { id: 'netBalance', label: 'Vị thế ròng', align: 'right' as const, width: 160 },
];

type Props = {
  id: string;
};

export default function SettlementDetailView({ id }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState<ISettlementDetail | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setData(await getSettlementById(id));
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải chi tiết kỳ chốt sổ', { variant: 'error' });
    }
  }, [id, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarkPaid = async (transferId: string | null) => {
    if (!transferId) return;
    setPayingId(transferId);
    try {
      await markTransferPaid(transferId);
      enqueueSnackbar('Đã đánh dấu tất toán!');
      fetchData();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    } finally {
      setPayingId(null);
    }
  };

  if (!data) return null;

  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <Container maxWidth="xl">
        <CustomBreadcrumbs
          heading={data.name}
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Hoạch toán cổ đông', href: paths.dashboard.pos.shareholder.list },
            { name: 'Kỳ chốt sổ', href: paths.dashboard.pos.shareholder.settlements },
            { name: data.name },
          ]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Chip
                label={data.status === 'Closed' ? 'Đã chốt' : 'Mở'}
                color={data.status === 'Closed' ? 'success' : 'default'}
              />
              <Typography variant="body2" color="text.secondary">
                {fDate(data.fromDate)} — {fDate(data.toDate)}
              </Typography>
              {data.closedAt && (
                <Typography variant="body2" color="text.secondary">
                  Chốt bởi {data.closedByName} lúc {fDate(data.closedAt)}
                </Typography>
              )}
            </Stack>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Typography variant="subtitle2" color="text.secondary">Doanh thu</Typography>
                <Typography variant="h6">{fCurrency(data.totalRevenue)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Typography variant="subtitle2" color="text.secondary">Tổng chi</Typography>
                <Typography variant="h6">{fCurrency(data.totalExpense)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Typography variant="subtitle2" color="text.secondary">Lợi nhuận</Typography>
                <Typography variant="h6" color={data.profit >= 0 ? 'success.main' : 'error.main'}>
                  {fCurrency(data.profit)}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Typography variant="subtitle2" color="text.secondary">Quỹ giữ lại</Typography>
                <Typography variant="h6">{fCurrency(data.reserveAmount)}</Typography>
              </Grid>
            </Grid>

            {data.note && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Ghi chú: {data.note}
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Vị thế từng cổ đông</Typography>
            <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
              <Scrollbar>
                <Table sx={{ minWidth: 800 }}>
                  <TableHeadCustom headLabel={LINE_HEAD} rowCount={data.lines.length} />
                  <TableBody>
                    {data.lines.map((line) => (
                      <TableRow key={line.shareholderId} hover>
                        <TableCell>{line.shareholderName}</TableCell>
                        <TableCell align="right">{fPercent(line.equityPercentSnapshot)}</TableCell>
                        <TableCell align="right">{fCurrency(line.profitShare)}</TableCell>
                        <TableCell align="right">{fCurrency(line.paidIn)}</TableCell>
                        <TableCell align="right">{fCurrency(line.collectedOut)}</TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="subtitle2"
                            color={line.netBalance >= 0 ? 'success.main' : 'error.main'}
                          >
                            {line.netBalance >= 0 ? '+' : ''}
                            {fCurrency(line.netBalance)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableNoData notFound={!data.lines.length} />
                  </TableBody>
                </Table>
              </Scrollbar>
            </TableContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Tất toán</Typography>
            {data.transfers.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Không có giao dịch tất toán nào cho kỳ này.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {data.transfers.map((t, idx) => (
                  <Stack
                    key={t.id || idx}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.neutral' }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="subtitle2">{t.fromShareholderName}</Typography>
                      <Iconify icon="solar:arrow-right-bold" width={18} />
                      <Typography variant="subtitle2">{t.toShareholderName}</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Typography variant="subtitle1" color="primary.main">
                        {fCurrency(t.amount)}
                      </Typography>
                      {t.isPaid ? (
                        <Chip size="small" color="success" label="Đã trả" />
                      ) : (
                        <LoadingButton
                          size="small"
                          variant="outlined"
                          loading={payingId === t.id}
                          onClick={() => handleMarkPaid(t.id)}
                        >
                          Đánh dấu đã trả
                        </LoadingButton>
                      )}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Container>
    </RoleBasedGuard>
  );
}
