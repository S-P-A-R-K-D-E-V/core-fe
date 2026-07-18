'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid2';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';
import { useBoolean } from 'src/hooks/use-boolean';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { AppDatePicker } from 'src/components/date-time-picker';
import { TableHeadCustom, TableNoData } from 'src/components/table';
import { fCurrency, fPercent } from 'src/utils/format-number';
import { fPaymentMethod } from 'src/utils/payment-method-label';

import { ISettlementPreview, ISettlementItemDetail } from 'src/types/corecms-api';
import { getSettlementPreview, closeSettlement, getShareholderSettlementDetail } from 'src/api/shareholders';

// ----------------------------------------------------------------------

// "Đã đưa vào"/"Đã lấy ra" click để xem popup chi tiết từng khoản (nguồn, ngày, ghi chú) — chỉ
// có ở bản xem trước (tính live), kỳ đã chốt không tra cứu lại được nên hiện số thường, không click được.
function AmountDetailButton({
  amount,
  onClick,
}: {
  amount: number;
  onClick?: () => void;
}) {
  if (!onClick) return <>{fCurrency(amount)}</>;

  return (
    <Typography
      component="span"
      variant="body2"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick();
      }}
      sx={{ textDecoration: 'underline dotted', cursor: 'pointer' }}
    >
      {fCurrency(amount)}
    </Typography>
  );
}

const LINE_HEAD = [
  { id: 'shareholder', label: 'Cổ đông' },
  { id: 'equity', label: '%', align: 'right' as const, width: 70 },
  { id: 'profitShare', label: 'Chia LN', align: 'right' as const, width: 120 },
  { id: 'paidIn', label: 'Đã đưa vào', align: 'right' as const, width: 130 },
  { id: 'collectedOut', label: 'Đã lấy ra', align: 'right' as const, width: 130 },
  { id: 'peer', label: 'Chuyển/Nhận', align: 'right' as const, width: 130 },
  { id: 'priorBalance', label: 'Nợ cũ', align: 'right' as const, width: 120 },
  { id: 'netBalance', label: 'Kỳ này', align: 'right' as const, width: 120 },
  { id: 'cumulative', label: 'Lũy kế', align: 'right' as const, width: 130 },
];

const SHEET_STYLE_HEAD = [
  { id: 'shareholder', label: 'Cổ đông' },
  { id: 'revenueShare', label: 'Chia doanh thu', align: 'right' as const, width: 130 },
  { id: 'netBalance', label: 'Kỳ này', align: 'right' as const, width: 120 },
  { id: 'cumulative', label: 'Lũy kế', align: 'right' as const, width: 130 },
];

function getDefaultDates() {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: now.toISOString().slice(0, 10),
  };
}

export default function SettlementPreviewView() {
  const { enqueueSnackbar } = useSnackbar();
  const router = useRouter();
  const dialog = useBoolean();
  const sheetStyleOpen = useBoolean();
  const defaults = getDefaultDates();

  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [reserveAmount, setReserveAmount] = useState(0);
  const [data, setData] = useState<ISettlementPreview | null>(null);
  const [loading, setLoading] = useState(false);

  const [periodName, setPeriodName] = useState('');
  const [note, setNote] = useState('');
  const [closing, setClosing] = useState(false);

  const detailDialog = useBoolean();
  const [detailTitle, setDetailTitle] = useState('');
  const [detailItems, setDetailItems] = useState<ISettlementItemDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSettlementPreview({ fromDate, toDate, reserveAmount });
      setData(result);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải đối chiếu sổ', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, reserveAmount, enqueueSnackbar]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const handleOpenDetail = useCallback(
    async (shareholderId: string, shareholderName: string, kind: 'paidIn' | 'collectedOut') => {
      setDetailTitle(`${kind === 'paidIn' ? 'Đã đưa vào' : 'Đã lấy ra'} — ${shareholderName}`);
      setDetailItems([]);
      detailDialog.onTrue();
      setDetailLoading(true);
      try {
        const detail = await getShareholderSettlementDetail(shareholderId, { fromDate, toDate });
        setDetailItems(kind === 'paidIn' ? detail.paidInItems : detail.collectedOutItems);
      } catch (error) {
        console.error(error);
        enqueueSnackbar('Không thể tải chi tiết', { variant: 'error' });
      } finally {
        setDetailLoading(false);
      }
    },
    [fromDate, toDate, enqueueSnackbar, detailDialog]
  );

  const handleOpenClose = () => {
    setPeriodName(`Kỳ ${fromDate} - ${toDate}`);
    setNote('');
    dialog.onTrue();
  };

  const handleConfirmClose = async () => {
    if (!periodName.trim()) {
      enqueueSnackbar('Nhập tên kỳ chốt sổ', { variant: 'error' });
      return;
    }
    setClosing(true);
    try {
      const result = await closeSettlement({
        name: periodName.trim(),
        fromDate,
        toDate,
        reserveAmount,
        note: note || null,
      });
      enqueueSnackbar('Chốt sổ thành công!');
      dialog.onFalse();
      router.push(paths.dashboard.pos.shareholder.settlementDetails(result.id));
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi khi chốt sổ — kiểm tra lại kênh thu tiền chưa gán', { variant: 'error' });
    } finally {
      setClosing(false);
    }
  };

  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <Container maxWidth="xl">
        <CustomBreadcrumbs
          heading="Đối chiếu & Chốt sổ"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Hoạch toán cổ đông', href: paths.dashboard.pos.shareholder.list },
            { name: 'Chốt sổ' },
          ]}
          action={
            <Button
              component="a"
              href={paths.dashboard.pos.shareholder.settlements}
              variant="outlined"
              startIcon={<Iconify icon="solar:list-bold" />}
            >
              Danh sách kỳ đã chốt
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <AppDatePicker label="Từ ngày" value={fromDate} onChange={setFromDate} size="small" />
              <AppDatePicker label="Đến ngày" value={toDate} onChange={setToDate} size="small" />
              <TextField
                label="Quỹ giữ lại (đ)"
                type="number"
                size="small"
                value={reserveAmount}
                onChange={(e) => setReserveAmount(Number(e.target.value) || 0)}
                sx={{ minWidth: 180 }}
                helperText="Không chia, giữ lại tại cửa hàng"
              />
            </Stack>
          </CardContent>
        </Card>

        {data && (
          <>
            {data.unmappedChannels.length > 0 && (
              <Alert severity="error" sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Có {data.unmappedChannels.length} kênh thu tiền chưa gán cổ đông — phải gán trước khi chốt sổ:
                </Typography>
                <Stack spacing={0.5}>
                  {data.unmappedChannels.map((c, idx) => (
                    <Typography key={idx} variant="body2">
                      • {fPaymentMethod(c.paymentMethod)}
                      {c.bankAccountName ? ` (${c.bankAccountName})` : ''}: {fCurrency(c.amount)}
                    </Typography>
                  ))}
                </Stack>
                <Button
                  component="a"
                  href={paths.dashboard.pos.shareholder.list}
                  size="small"
                  sx={{ mt: 1.5 }}
                  startIcon={<Iconify icon="mingcute:add-line" />}
                >
                  Đi tới Cổ đông & Kênh thu tiền để gán
                </Button>
              </Alert>
            )}

            {data.isOverlapping && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                Khoảng thời gian này chồng lấn với một kỳ đã chốt sổ khác.
              </Alert>
            )}

            {Math.abs(data.balanceCheck) > 1 && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                Chênh lệch kiểm tra: {fCurrency(data.balanceCheck)} — có thể có chi phí/doanh thu chưa được
                cổ đông nào &quot;nhận trách nhiệm&quot; bằng giao dịch vốn. Vẫn có thể chốt sổ.
              </Alert>
            )}

            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Doanh thu thuần</Typography>
                    <Typography variant="h5" color="primary.main">{fCurrency(data.totalRevenue)}</Typography>
                    {data.totalReturns > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Đã trừ trả hàng {fCurrency(data.totalReturns)}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Tổng chi</Typography>
                    <Typography variant="h5">{fCurrency(data.totalExpense)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Lợi nhuận</Typography>
                    <Typography variant="h5" color={data.profit >= 0 ? 'success.main' : 'error.main'}>
                      {fCurrency(data.profit)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Quỹ giữ lại</Typography>
                    <Typography variant="h5">{fCurrency(data.reserveAmount)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">LN chia</Typography>
                    <Typography variant="h5">{fCurrency(data.distributedProfit)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Chi phí hàng hóa (đối chiếu)</Typography>
                <Stack spacing={1.5}>
                  {data.lines
                    .filter((l) => l.goodsPaid > 0)
                    .map((l) => (
                      <Stack key={l.shareholderId} direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Tiền hàng {l.shareholderName} nhập
                        </Typography>
                        <Typography variant="subtitle2">{fCurrency(l.goodsPaid)}</Typography>
                      </Stack>
                    ))}
                  <Divider />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Tổng tiền hàng thực trả</Typography>
                    <Typography variant="subtitle2">{fCurrency(data.goodsPaidTotal)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Tổng tiền hàng trên hóa đơn (KiotViet)</Typography>
                    <Typography variant="subtitle2">{fCurrency(data.goodsInvoiceTotal)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Giảm giá hóa đơn</Typography>
                    <Typography variant="subtitle2" color={data.goodsDiscount >= 0 ? 'success.main' : 'error.main'}>
                      {fCurrency(data.goodsDiscount)}
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Vị thế từng cổ đông</Typography>
                <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
                  <Scrollbar>
                    <Table sx={{ minWidth: 1100 }}>
                      <TableHeadCustom headLabel={LINE_HEAD} rowCount={data.lines.length} />
                      <TableBody>
                        {data.lines.map((line) => (
                          <TableRow key={line.shareholderId} hover>
                            <TableCell>{line.shareholderName}</TableCell>
                            <TableCell align="right">{fPercent(line.equityPercentSnapshot)}</TableCell>
                            <TableCell align="right">{fCurrency(line.profitShare)}</TableCell>
                            <TableCell align="right">
                              <AmountDetailButton
                                amount={line.paidIn}
                                onClick={() => handleOpenDetail(line.shareholderId, line.shareholderName, 'paidIn')}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <AmountDetailButton
                                amount={line.collectedOut}
                                onClick={() => handleOpenDetail(line.shareholderId, line.shareholderName, 'collectedOut')}
                              />
                            </TableCell>
                            <TableCell align="right">
                              {line.peerPaid > 0 && `+${fCurrency(line.peerPaid)}`}
                              {line.peerPaid > 0 && line.peerReceived > 0 && ' / '}
                              {line.peerReceived > 0 && `−${fCurrency(line.peerReceived)}`}
                              {line.peerPaid === 0 && line.peerReceived === 0 && '—'}
                            </TableCell>
                            <TableCell align="right">{fCurrency(line.priorBalance)}</TableCell>
                            <TableCell align="right">
                              <Typography
                                variant="body2"
                                color={line.netBalance >= 0 ? 'success.main' : 'error.main'}
                              >
                                {line.netBalance >= 0 ? '+' : ''}
                                {fCurrency(line.netBalance)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                variant="subtitle2"
                                color={line.cumulativeBalance >= 0 ? 'success.main' : 'error.main'}
                              >
                                {line.cumulativeBalance >= 0 ? '+' : ''}
                                {fCurrency(line.cumulativeBalance)}
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

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Gợi ý tất toán (ai trả ai)</Typography>
                {data.transfers.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Không cần chuyển tiền — mọi vị thế đã cân bằng.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {data.transfers.map((t, idx) => (
                      <Stack
                        key={idx}
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
                        <Typography variant="subtitle1" color="primary.main">
                          {fCurrency(t.amount)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {data.sheetStyle && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    onClick={sheetStyleOpen.onToggle}
                    sx={{ cursor: 'pointer' }}
                  >
                    <Typography variant="h6">Đối chiếu cách tính cũ (gộp tiền hàng vào chi phí)</Typography>
                    <Iconify
                      icon={sheetStyleOpen.value ? 'eva:chevron-up-fill' : 'eva:chevron-down-fill'}
                      width={22}
                    />
                  </Stack>
                  <Collapse in={sheetStyleOpen.value}>
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      <Alert severity="info">
                        Chỉ để xem so sánh với sổ Google Sheet gốc — sổ này gộp tiền hàng nhập vào
                        chi phí trước khi chia lời, khác với công thức chính thức (tách riêng, xem
                        khối &quot;Chi phí hàng hóa&quot;). Không dùng số này để chốt sổ.
                      </Alert>

                      <Stack direction="row" spacing={4}>
                        <Typography variant="body2">
                          Lợi nhuận (gộp tiền hàng):{' '}
                          <Typography
                            component="span"
                            variant="subtitle2"
                            color={data.sheetStyle.profit >= 0 ? 'success.main' : 'error.main'}
                          >
                            {fCurrency(data.sheetStyle.profit)}
                          </Typography>
                        </Typography>
                      </Stack>

                      <TableContainer>
                        <Scrollbar>
                          <Table size="small">
                            <TableHeadCustom headLabel={SHEET_STYLE_HEAD} />
                            <TableBody>
                              {data.sheetStyle.lines.map((line) => (
                                <TableRow key={line.shareholderId}>
                                  <TableCell>{line.shareholderName}</TableCell>
                                  <TableCell align="right">{fCurrency(line.revenueShare)}</TableCell>
                                  <TableCell align="right">
                                    <Typography
                                      variant="body2"
                                      color={line.netBalance >= 0 ? 'success.main' : 'error.main'}
                                    >
                                      {line.netBalance >= 0 ? '+' : ''}
                                      {fCurrency(line.netBalance)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography
                                      variant="subtitle2"
                                      color={line.cumulativeBalance >= 0 ? 'success.main' : 'error.main'}
                                    >
                                      {line.cumulativeBalance >= 0 ? '+' : ''}
                                      {fCurrency(line.cumulativeBalance)}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Scrollbar>
                      </TableContainer>

                      <Stack spacing={1}>
                        <Typography variant="subtitle2">Ai trả ai (theo cách tính cũ)</Typography>
                        {data.sheetStyle.transfers.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            Không cần chuyển tiền theo cách tính này.
                          </Typography>
                        ) : (
                          data.sheetStyle.transfers.map((t, idx) => (
                            <Stack
                              key={idx}
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                              sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.neutral' }}
                            >
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography variant="body2">{t.fromShareholderName}</Typography>
                                <Iconify icon="solar:arrow-right-bold" width={16} />
                                <Typography variant="body2">{t.toShareholderName}</Typography>
                              </Stack>
                              <Typography variant="subtitle2">{fCurrency(t.amount)}</Typography>
                            </Stack>
                          ))
                        )}
                      </Stack>
                    </Stack>
                  </Collapse>
                </CardContent>
              </Card>
            )}

            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                size="large"
                disabled={!data.canClose || loading}
                startIcon={<Iconify icon="solar:lock-keyhole-bold" />}
                onClick={handleOpenClose}
              >
                Xác nhận chốt sổ
              </Button>
            </Stack>
          </>
        )}
      </Container>

      <Dialog open={detailDialog.value} onClose={detailDialog.onFalse} maxWidth="sm" fullWidth>
        <DialogTitle>{detailTitle}</DialogTitle>
        <DialogContent>
          {detailLoading ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              Đang tải...
            </Typography>
          ) : detailItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              Không có khoản nào trong kỳ này.
            </Typography>
          ) : (
            <TableContainer sx={{ mt: 1 }}>
              <Scrollbar>
                <Table size="small">
                  <TableHeadCustom
                    headLabel={[
                      { id: 'source', label: 'Nguồn' },
                      { id: 'date', label: 'Ngày' },
                      { id: 'note', label: 'Ghi chú' },
                      { id: 'amount', label: 'Số tiền', align: 'right' as const },
                    ]}
                  />
                  <TableBody>
                    {detailItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{fPaymentMethod(item.source)}</TableCell>
                        <TableCell>{new Date(item.date).toLocaleDateString('vi-VN')}</TableCell>
                        <TableCell>{item.note || '—'}</TableCell>
                        <TableCell align="right">{fCurrency(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography variant="subtitle2">Tổng</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2">
                          {fCurrency(detailItems.reduce((sum, i) => sum + i.amount, 0))}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Scrollbar>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={detailDialog.onFalse}>Đóng</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog.value} onClose={dialog.onFalse} maxWidth="xs" fullWidth>
        <DialogTitle>Xác nhận chốt sổ</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Alert severity="warning">
              Sau khi chốt, mọi giao dịch vốn trong kỳ sẽ bị khóa — không thể sửa/xóa.
            </Alert>
            <TextField
              label="Tên kỳ chốt sổ"
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Ghi chú"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={dialog.onFalse}>Hủy</Button>
          <LoadingButton
            variant="contained"
            color="error"
            loading={closing}
            onClick={handleConfirmClose}
          >
            Chốt sổ
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </RoleBasedGuard>
  );
}
