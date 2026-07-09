'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid2';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import Label from 'src/components/label';
import { useSnackbar } from 'src/components/snackbar';
import { fCurrency } from 'src/utils/format-number';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { IDebtSummary } from 'src/types/corecms-api';
import { getDebtSummary } from 'src/api/reports';

// ----------------------------------------------------------------------

function agingColor(daysOverdue: number): 'success' | 'warning' | 'error' {
  if (daysOverdue <= 30) return 'success';
  if (daysOverdue <= 60) return 'warning';
  return 'error';
}

export default function ReportDebtView() {
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState<IDebtSummary | null>(null);
  const [tab, setTab] = useState<'receivable' | 'payable'>('receivable');

  const fetchData = useCallback(async () => {
    try {
      const result = await getDebtSummary();
      setData(result);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải công nợ', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Công nợ phải thu / phải trả
      </Typography>

      {data && (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Tổng phải thu (khách hàng)
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    {fCurrency(data.totalReceivable)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Tổng phải trả (nhà cung cấp)
                  </Typography>
                  <Typography variant="h5" color="error.main">
                    {fCurrency(data.totalPayable)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            {(
              [
                { label: 'Phải thu', aging: data.receivableAging },
                { label: 'Phải trả', aging: data.payableAging },
              ] as const
            ).map((group) => (
              <Grid key={group.label} size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                      Tuổi nợ — {group.label}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={3}>
                        <Typography variant="caption" color="text.secondary">0-30 ngày</Typography>
                        <Typography variant="subtitle2">{fCurrency(group.aging.days0To30)}</Typography>
                      </Grid>
                      <Grid size={3}>
                        <Typography variant="caption" color="text.secondary">31-60 ngày</Typography>
                        <Typography variant="subtitle2">{fCurrency(group.aging.days31To60)}</Typography>
                      </Grid>
                      <Grid size={3}>
                        <Typography variant="caption" color="text.secondary">61-90 ngày</Typography>
                        <Typography variant="subtitle2">{fCurrency(group.aging.days61To90)}</Typography>
                      </Grid>
                      <Grid size={3}>
                        <Typography variant="caption" color="text.secondary">&gt;90 ngày</Typography>
                        <Typography variant="subtitle2" color="error.main">
                          {fCurrency(group.aging.daysOver90)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Card>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 2, pt: 1 }}>
              <Tab value="receivable" label={`Phải thu (${data.receivables.length})`} />
              <Tab value="payable" label={`Phải trả (${data.payables.length})`} />
            </Tabs>
            <CardContent>
              {tab === 'receivable' ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Mã đơn</TableCell>
                        <TableCell>Khách hàng</TableCell>
                        <TableCell align="right">Tổng tiền</TableCell>
                        <TableCell align="right">Đã trả</TableCell>
                        <TableCell align="right">Còn nợ</TableCell>
                        <TableCell align="center">Quá hạn</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.receivables.map((r) => (
                        <TableRow key={r.orderId}>
                          <TableCell>{r.orderCode}</TableCell>
                          <TableCell>{r.customerName || '—'}</TableCell>
                          <TableCell align="right">{fCurrency(r.total)}</TableCell>
                          <TableCell align="right">{fCurrency(r.paid)}</TableCell>
                          <TableCell align="right">{fCurrency(r.due)}</TableCell>
                          <TableCell align="center">
                            <Label variant="soft" color={agingColor(r.daysOverdue)}>
                              {r.daysOverdue} ngày
                            </Label>
                          </TableCell>
                        </TableRow>
                      ))}
                      {data.receivables.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center">Không có công nợ phải thu</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Mã đơn</TableCell>
                        <TableCell>Nhà cung cấp</TableCell>
                        <TableCell align="right">Tổng tiền</TableCell>
                        <TableCell align="right">Đã trả</TableCell>
                        <TableCell align="right">Còn nợ</TableCell>
                        <TableCell align="center">Quá hạn</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.payables.map((p) => (
                        <TableRow key={p.orderId}>
                          <TableCell>{p.orderNumber}</TableCell>
                          <TableCell>{p.supplierName || '—'}</TableCell>
                          <TableCell align="right">{fCurrency(p.total)}</TableCell>
                          <TableCell align="right">{fCurrency(p.paid)}</TableCell>
                          <TableCell align="right">{fCurrency(p.due)}</TableCell>
                          <TableCell align="center">
                            <Label variant="soft" color={agingColor(p.daysOverdue)}>
                              {p.daysOverdue} ngày
                            </Label>
                          </TableCell>
                        </TableRow>
                      ))}
                      {data.payables.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center">Không có công nợ phải trả</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
      </Box>
    </RoleBasedGuard>
  );
}
