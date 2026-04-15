'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { TaxReportResult } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function formatVND(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} ₫`;
}

// ----------------------------------------------------------------------

interface Props {
  data: TaxReportResult | null;
  loading: boolean;
}

export default function TaxReportTable({ data, loading }: Props) {
  const theme = useTheme();

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Skeleton variant="text" width="40%" height={28} />
            {Array.from({ length: 8 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <Skeleton key={i} variant="rectangular" height={36} />
            ))}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const isEmpty = data.totalTransactions === 0;

  return (
    <Card>
      <CardContent>
        {/* Summary */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 2 }}
        >
          <Typography variant="subtitle1" fontWeight="bold">
            Tháng {data.month}/{data.year}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            •
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data.totalTransactions.toLocaleString('vi-VN')} giao dịch
          </Typography>
          <Typography variant="body2" color="text.secondary">
            •
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatVND(data.totalAmount)}
          </Typography>
        </Stack>

        {isEmpty && (
          <Box
            sx={{
              mb: 2,
              px: 2,
              py: 1,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.warning.main, 0.08),
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Không có giao dịch nào trong tháng {data.month}/{data.year}.
            </Typography>
          </Box>
        )}

        {/* Table */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ngày</TableCell>
                <TableCell align="right">Số giao dịch</TableCell>
                <TableCell align="right">Tổng thanh toán</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.days.map((day) => {
                const isZero = day.totalAmount === 0;
                return (
                  <TableRow
                    key={day.date}
                    sx={{ opacity: isZero ? 0.4 : 1 }}
                  >
                    <TableCell sx={{ color: isZero ? 'text.secondary' : 'text.primary' }}>
                      {formatDate(day.date)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: isZero ? 'text.secondary' : 'text.primary' }}>
                      {day.transactionCount}
                    </TableCell>
                    <TableCell align="right" sx={{ color: isZero ? 'text.secondary' : 'text.primary' }}>
                      {formatVND(day.totalAmount)}
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Total row */}
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Tổng cộng</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {data.totalTransactions.toLocaleString('vi-VN')}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {formatVND(data.totalAmount)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
