'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableContainer from '@mui/material/TableContainer';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import LoadingButton from '@mui/lab/LoadingButton';
import { useTheme, alpha } from '@mui/material/styles';

import { paths } from 'src/routes/paths';

import { useBoolean } from 'src/hooks/use-boolean';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Label from 'src/components/label';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { parseDateStr, toDateStr } from 'src/utils/format-time';

import {
  IShiftCashSummary,
  IShiftCashTransaction,
  IShiftCashDenomination,
  IShiftCashLog,
  IKiotVietDailySummary,
  IKiotVietInvoice,
  IKiotVietReturn,
  IKiotVietInvoiceDetailResponse,
  IVietQRBank,
  IKiotVietBankAccount,
} from 'src/types/corecms-api';
import {
  getShiftCashSummary,
  addShiftCashTransaction,
  updateShiftCashTransaction,
  deleteShiftCashTransaction,
  updateDenominationBatch,
  finalizeShiftCash,
  openCounter,
  getShiftCashLogs,
  getKiotVietDailySummary,
  getKiotVietInvoiceDetail,
  getKiotVietBankAccounts,
  getVietQRBanks,
  exportKiotVietExcel,
} from 'src/api/shiftCash';

// ======================================================================

const DENOMINATIONS = [1, 2, 5, 10, 20, 50, 100, 200, 500];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

// ======================================================================

export default function ShiftCashDashboardView() {
  const theme = useTheme();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const txDialog = useBoolean();
  const confirmDelete = useBoolean();

  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60 * 1000);
    return local.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<IShiftCashSummary | null>(null);
  const [logs, setLogs] = useState<IShiftCashLog[]>([]);
  const [kiotData, setKiotData] = useState<IKiotVietDailySummary | null>(null);
  const [kiotLoading, setKiotLoading] = useState(false);
  const [kiotTab, setKiotTab] = useState(0); // 0=Cash, 1=Bank, 2=Card, 3=Returns
  const [tab, setTab] = useState(0);

  // Denomination editing
  const [denomQuantities, setDenomQuantities] = useState<Record<number, number>>({});
  const [savingDenom, setSavingDenom] = useState(false);
  const [denomEditing, setDenomEditing] = useState(false);
  const confirmFinalize = useBoolean();

  // Invoice detail
  const invoiceDetailDialog = useBoolean();
  const [invoiceDetailCache, setInvoiceDetailCache] = useState<Record<number, IKiotVietInvoiceDetailResponse>>({});
  const [invoiceDetailLoading, setInvoiceDetailLoading] = useState<number | null>(null);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<IKiotVietInvoiceDetailResponse | null>(null);
  const [invoiceBatchProgress, setInvoiceBatchProgress] = useState<{ loaded: number; total: number } | null>(null);
  const batchAbortRef = useRef(false);

  // Bank data (VietQR + KiotViet bank accounts)
  const [vietQRBanks, setVietQRBanks] = useState<IVietQRBank[]>([]);
  const [kiotBankAccounts, setKiotBankAccounts] = useState<IKiotVietBankAccount[]>([]);

  // Transaction form
  const [txMode, setTxMode] = useState<'add' | 'edit'>('add');
  const [txEditId, setTxEditId] = useState<string | null>(null);
  const [txType, setTxType] = useState<'Thu' | 'Chi'>('Thu');
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txSaving, setTxSaving] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const todayDate = (() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
  })();

  const isToday = currentDate === todayDate;
  const hasOpenedToday = (summary?.denominations ?? []).length > 0;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, logsData] = await Promise.all([
        getShiftCashSummary(currentDate),
        getShiftCashLogs(currentDate),
      ]);
      setSummary(summaryData);
      setLogs(logsData);

      // Init denomination quantities
      const denomMap: Record<number, number> = {};
      DENOMINATIONS.forEach((d) => {
        const existing = summaryData.denominations.find((dd) => dd.denomination === d);
        denomMap[d] = existing?.quantity ?? 0;
      });
      setDenomQuantities(denomMap);

      // Fetch KiotViet data (non-blocking)
      setKiotLoading(true);
      getKiotVietDailySummary(currentDate)
        .then((data) => setKiotData(data))
        .catch((err) => {
          console.error('KiotViet fetch error:', err);
          setKiotData(null);
        })
        .finally(() => setKiotLoading(false));
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không tải được dữ liệu', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentDate, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
    // Reset cache when date changes
    setInvoiceDetailCache({});
    batchAbortRef.current = true;
  }, [fetchData]);

  // Load VietQR banks + KiotViet bank accounts once on mount
  useEffect(() => {
    Promise.allSettled([
      // getVietQRBanks().then((banks) => setVietQRBanks(banks)),
      getKiotVietBankAccounts().then((accounts) => setKiotBankAccounts(accounts)),
    ]);
  }, []);

  // Lazy-load all invoice details when kiotData is available
  useEffect(() => {
    if (!kiotData) return;

    const allInvoices = [
      ...kiotData.cashInvoices,
      ...kiotData.bankInvoices,
      ...kiotData.cardInvoices,
    ];
    const idsToFetch = allInvoices
      .map((inv) => inv.id)
      .filter((id, idx, arr) => arr.indexOf(id) === idx); // dedupe

    if (idsToFetch.length === 0) return;

    batchAbortRef.current = false;
    setInvoiceBatchProgress({ loaded: 0, total: idsToFetch.length });

    const BATCH_SIZE = 5;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    const delay = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

    const fetchBatch = async (ids: number[]): Promise<{ success: Record<number, IKiotVietInvoiceDetailResponse>; failed: number[] }> => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          getKiotVietInvoiceDetail(id).then((detail) => ({ id, detail }))
        )
      );
      const success: Record<number, IKiotVietInvoiceDetailResponse> = {};
      const failed: number[] = [];
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          success[r.value.id] = r.value.detail;
        } else {
          failed.push(ids[idx]);
        }
      });
      return { success, failed };
    };

    (async () => {
      let loaded = 0;
      let allFailed: number[] = [];

      for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
        if (batchAbortRef.current) break;

        const batch = idsToFetch.slice(i, i + BATCH_SIZE);
        const { success, failed } = await fetchBatch(batch);

        if (batchAbortRef.current) break;

        if (Object.keys(success).length > 0) {
          setInvoiceDetailCache((prev) => ({ ...prev, ...success }));
        }
        allFailed.push(...failed);
        loaded += batch.length;
        setInvoiceBatchProgress({ loaded: Math.min(loaded, idsToFetch.length), total: idsToFetch.length });
        await delay(250); // small delay between batches to avoid overwhelming the server
      }

      // Retry failed items
      for (let attempt = 1; attempt <= MAX_RETRIES && allFailed.length > 0; attempt++) {
        if (batchAbortRef.current) break;

        await delay(RETRY_DELAY);
        if (batchAbortRef.current) break;

        const retryIds = [...allFailed];
        allFailed = [];

        for (let i = 0; i < retryIds.length; i += BATCH_SIZE) {
          if (batchAbortRef.current) break;

          const batch = retryIds.slice(i, i + BATCH_SIZE);
          const { success, failed } = await fetchBatch(batch);

          if (batchAbortRef.current) break;

          if (Object.keys(success).length > 0) {
            setInvoiceDetailCache((prev) => ({ ...prev, ...success }));
          }
          allFailed.push(...failed);
        }
      }

      setInvoiceBatchProgress(null);
    })();

    return () => {
      batchAbortRef.current = true;
    };
  }, [kiotData]);

  // ========== Denomination ==========

  const handleDenomChange = (denom: number, value: string) => {
    setDenomQuantities((prev) => ({
      ...prev,
      [denom]: parseInt(value, 10) || 0,
    }));
  };

  const handleSaveDenominations = async () => {
    try {
      setSavingDenom(true);
      await updateDenominationBatch({
        date: currentDate,
        items: DENOMINATIONS.map((d) => ({ denomination: d, quantity: denomQuantities[d] || 0 })),
      });
      enqueueSnackbar('Đã lưu mệnh giá!');
      setDenomEditing(false);
      fetchData();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Lưu mệnh giá thất bại', { variant: 'error' });
    } finally {
      setSavingDenom(false);
    }
  };

  const handleFinalize = async () => {
    try {
      setSavingDenom(true);
      await finalizeShiftCash({
        date: currentDate,
        items: DENOMINATIONS.map((d) => ({ denomination: d, quantity: denomQuantities[d] || 0 })),
      });
      enqueueSnackbar('Đã chốt tiền!', { variant: 'success' });
      confirmFinalize.onFalse();
      setDenomEditing(false);
      fetchData();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Chốt tiền thất bại', { variant: 'error' });
    } finally {
      setSavingDenom(false);
    }
  };

  const totalCash = DENOMINATIONS.reduce(
    (sum, d) => sum + d * 1000 * (denomQuantities[d] || 0),
    0
  );

  // ========== Transactions ==========

  const handleOpenAddTx = (type: 'Thu' | 'Chi') => {
    setTxMode('add');
    setTxEditId(null);
    setTxType(type);
    setTxAmount('');
    setTxNote('');
    txDialog.onTrue();
  };

  const handleOpenEditTx = (tx: IShiftCashTransaction) => {
    setTxMode('edit');
    setTxEditId(tx.id);
    setTxType(tx.type);
    setTxAmount(tx.amount.toString());
    setTxNote(tx.note || '');
    txDialog.onTrue();
  };

  const handleSaveTx = async () => {
    try {
      setTxSaving(true);
      if (txMode === 'add') {
        await addShiftCashTransaction({
          date: currentDate,
          type: txType,
          amount: parseFloat(txAmount),
          note: txNote || undefined,
        });
        enqueueSnackbar('Đã thêm!');
      } else if (txEditId) {
        await updateShiftCashTransaction(txEditId, {
          amount: parseFloat(txAmount),
          note: txNote || undefined,
        });
        enqueueSnackbar('Đã cập nhật!');
      }
      txDialog.onFalse();
      fetchData();
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'Thất bại', { variant: 'error' });
    } finally {
      setTxSaving(false);
    }
  };

  const handleDeleteTx = async () => {
    if (!deleteId) return;
    try {
      await deleteShiftCashTransaction(deleteId);
      enqueueSnackbar('Đã xoá!');
      confirmDelete.onFalse();
      setDeleteId(null);
      fetchData();
    } catch (error) {
      enqueueSnackbar('Xoá thất bại', { variant: 'error' });
    }
  };

  const handleOpenCounter = async () => {
    try {
      await openCounter(currentDate);
      enqueueSnackbar('Đã mở quầy!', { variant: 'success' });
      fetchData();
    } catch (error) {
      enqueueSnackbar('Mở quầy thất bại', { variant: 'error' });
    }
  };

  // ========== Invoice Detail ==========

  const handleViewInvoiceDetail = async (invoiceId: number) => {
    // Check cache first
    if (invoiceDetailCache[invoiceId]) {
      setSelectedInvoiceDetail(invoiceDetailCache[invoiceId]);
      invoiceDetailDialog.onTrue();
      return;
    }
    try {
      setInvoiceDetailLoading(invoiceId);
      const detail = await getKiotVietInvoiceDetail(invoiceId);
      setInvoiceDetailCache((prev) => ({ ...prev, [invoiceId]: detail }));
      setSelectedInvoiceDetail(detail);
      invoiceDetailDialog.onTrue();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không tải được chi tiết hóa đơn', { variant: 'error' });
    } finally {
      setInvoiceDetailLoading(null);
    }
  };

  // ========== Bank helpers ==========

  const getBankInfoForPayment = (accountId?: number) => {
    if (!accountId) return null;
    const kiotAccount = kiotBankAccounts.find((a) => a.id === accountId);
    if (!kiotAccount?.bankName) return null;

    // Try to match VietQR bank by shortName or code contained in KiotViet bankName
    const bankNameLower = kiotAccount.bankName.toLowerCase();
    const matchedBank = vietQRBanks.find((b) => {
      const short = b.shortName.toLowerCase();
      const code = b.code.toLowerCase();
      return bankNameLower.includes(short) || bankNameLower.includes(code)
        || short.includes(bankNameLower.split(' ')[0]);
    });

    return {
      bankName: kiotAccount.bankName,
      accountNumber: kiotAccount.accountNumber,
      description: kiotAccount.description,
      logo: matchedBank?.logo || null,
      vietQRShortName: matchedBank?.shortName || null,
    };
  };

  // ========== Render ==========

  return (
    <>
      <Container maxWidth={settings.themeStretch ? false : 'xl'}>
        <CustomBreadcrumbs
          heading="Kiểm tiền quầy"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Kiểm tiền' },
          ]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {/* Date picker */}
        <Card sx={{ mb: 3, p: 2.5 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <DatePicker
              label="Ngày"
              value={parseDateStr(currentDate)}
              onChange={(val) => setCurrentDate(toDateStr(val))}
              format="dd/MM/yyyy"
              slotProps={{ textField: { sx: { width: 200 } } }}
            />
            {isToday ? (
              <Button
                variant="outlined"
                size="small"
                startIcon={<Iconify icon="solar:refresh-bold" />}
                onClick={fetchData}
              >
                Đồng bộ
              </Button>
            ) : (
              <Button
                variant="outlined"
                size="small"
                onClick={() => setCurrentDate(todayDate)}
              >
                Hôm nay
              </Button>
            )}
          </Stack>
        </Card>

        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={3}>
            {/* Row 1: Denomination box + Summary box */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              {/* Denomination Box */}
              <Card sx={{ flex: 1, p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h6">
                      <Iconify icon="solar:wallet-money-bold-duotone" width={24} sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Tiền mặt trong quầy
                    </Typography>
                    {summary?.isFinalized && (
                      <Chip
                        icon={<Iconify icon="solar:check-circle-bold" width={16} />}
                        label={`Đã chốt ${summary.finalizations?.length || 0} lần`}
                        color="success"
                        size="small"
                        variant="soft"
                      />
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    {!hasOpenedToday ? (
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={<Iconify icon="solar:shop-bold" />}
                        onClick={handleOpenCounter}
                      >
                        Mở Quầy
                      </Button>
                    ) : !denomEditing ? (
                      <Button
                        variant="contained"
                        color="warning"
                        size="small"
                        startIcon={<Iconify icon="solar:lock-keyhole-unlocked-bold" />}
                        onClick={() => setDenomEditing(true)}
                      >
                        Chốt tiền
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            setDenomEditing(false);
                            // Reset to saved values
                            const denomMap: Record<number, number> = {};
                            DENOMINATIONS.forEach((d) => {
                              const existing = summary?.denominations.find((dd) => dd.denomination === d);
                              denomMap[d] = existing?.quantity ?? 0;
                            });
                            setDenomQuantities(denomMap);
                          }}
                        >
                          Huỷ
                        </Button>
                        <LoadingButton
                          variant="contained"
                          size="small"
                          loading={savingDenom}
                          onClick={handleSaveDenominations}
                          startIcon={<Iconify icon="solar:diskette-bold" />}
                        >
                          Lưu tạm
                        </LoadingButton>
                        <LoadingButton
                          variant="contained"
                          color="success"
                          size="small"
                          loading={savingDenom}
                          onClick={confirmFinalize.onTrue}
                          startIcon={<Iconify icon="solar:check-circle-bold" />}
                        >
                          Chốt ca
                        </LoadingButton>
                      </>
                    )}
                  </Stack>
                </Stack>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Mệnh giá</TableCell>
                        <TableCell align="center">Số lượng</TableCell>
                        <TableCell align="right">Thành tiền</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {DENOMINATIONS.map((d) => (
                        <TableRow key={d} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {formatCurrency(d * 1000)}đ
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              type="number"
                              value={denomQuantities[d] || 0}
                              onChange={(e) => handleDenomChange(d, e.target.value)}
                              disabled={!denomEditing}
                              inputProps={{ min: 0, style: { textAlign: 'center' } }}
                              sx={{ width: 80 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {formatCurrency(d * 1000 * (denomQuantities[d] || 0))}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={2}>
                          <Typography variant="subtitle1" fontWeight={700}>
                            Tổng tiền mặt
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                            {formatCurrency(totalCash)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>

              {/* Summary Box */}
              <Card sx={{ flex: 1, p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  <Iconify icon="solar:calculator-bold-duotone" width={24} sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Tổng hợp
                </Typography>

                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Tồn đầu ca</Typography>
                    <Typography variant="body2">{formatCurrency(summary?.openingBalance || 0)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">+ KiotViet</Typography>
                    <Typography variant="body2">
                        {kiotLoading ? '...' : formatCurrency((kiotData?.totalRevenue || 0) - (kiotData?.totalReturns || 0))}
                    </Typography>
                  </Stack>
                  {kiotData && (
                      <>
                        <Stack direction="row" justifyContent="space-between" sx={{ pl: 2 }}>
                          <Typography variant="caption" color="text.disabled">Tiền mặt</Typography>
                          <Typography variant="caption" color="text.disabled">{formatCurrency(kiotData.totalCash)}</Typography>
                        </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ pl: 2 }}>
                        <Typography variant="caption" color="text.disabled">Chuyển khoản</Typography>
                        <Typography variant="caption" color="text.disabled">{formatCurrency(kiotData.totalBank)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ pl: 2 }}>
                        <Typography variant="caption" color="text.disabled">Quẹt thẻ</Typography>
                        <Typography variant="caption" color="text.disabled">{formatCurrency(kiotData.totalCard)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ pl: 2 }}>
                        <Typography variant="caption" color="text.disabled">Trả hàng (TM)</Typography>
                        <Typography variant="caption" color="error.main">-{formatCurrency(kiotData.totalReturns)}</Typography>
                      </Stack>
                    </>
                  )}
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">+ Thu quầy thủ công</Typography>
                    <Typography variant="body2" color="success.main">
                      +{formatCurrency(summary?.manualIncome || 0)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">- Chi quầy thủ công</Typography>
                    <Typography variant="body2" color="error.main">
                      -{formatCurrency(summary?.manualExpense || 0)}
                    </Typography>
                  </Stack>

                  <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="subtitle2">= Tồn cuối lý thuyết</Typography>
                      <Typography variant="subtitle2" color="info.main">
                        {formatCurrency(summary?.expectedClosing || 0)}
                      </Typography>
                    </Stack>
                  </Box>

                  <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="subtitle2">Tiền mặt kiểm đếm</Typography>
                      <Typography variant="subtitle2" color="primary.main" fontWeight={700}>
                        {formatCurrency(totalCash)}
                      </Typography>
                    </Stack>
                  </Box>

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      bgcolor: (summary?.difference || 0) >= 0
                        ? alpha(theme.palette.success.main, 0.08)
                        : alpha(theme.palette.error.main, 0.08),
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle1" fontWeight={700}>
                        Chênh lệch
                      </Typography>
                      <Typography
                        variant="h5"
                        color={(summary?.difference || 0) >= 0 ? 'success.main' : 'error.main'}
                        fontWeight={700}
                      >
                        {(summary?.difference || 0) >= 0 ? '+' : ''}
                        {formatCurrency(totalCash - (summary?.expectedClosing || 0))}
                      </Typography>
                    </Stack>
                  </Box>

                  {summary?.finalizations && summary.finalizations.length > 0 && (
                    <Stack spacing={1} style={{ maxHeight: 159, overflowY: "auto"}}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Lịch sử chốt ({summary.finalizations.length} lần)
                      </Typography>
                      {summary.finalizations.map((f, idx) => (
                        <Box
                          key={f.id}
                          sx={{
                            p: 1.5,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.success.main, idx === 0 ? 0.08 : 0.04),
                            border: `1px solid ${alpha(theme.palette.success.main, idx === 0 ? 0.24 : 0.12)}`,
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Iconify
                              icon="solar:check-circle-bold"
                              width={18}
                              sx={{ color: idx === 0 ? 'success.main' : 'text.disabled' }}
                            />
                            <Typography
                              variant="caption"
                              color={idx === 0 ? 'success.main' : 'text.secondary'}
                            >
                              {idx === 0 ? 'Lần chốt cuối: ' : ''}
                              {f.finalizedAt
                                ? new Date(f.finalizedAt).toLocaleString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    day: '2-digit',
                                    month: '2-digit',
                                  })
                                : ''}
                              {f.finalizedByName && ` bởi ${f.finalizedByName}`}
                            </Typography>
                            <Typography
                              variant="caption"
                              color={idx === 0 ? 'primary.main' : 'text.disabled'}
                              fontWeight={idx === 0 ? 700 : 400}
                              sx={{ ml: 'auto !important' }}
                            >
                              {formatCurrency(f.closingBalance)}
                            </Typography>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Card>
            </Stack>

            {/* Row 2: Tabs - Transactions / KiotViet / Logs */}
            <Card>
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{ px: 2.5, pt: 1 }}
              >
                <Tab
                  label={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Iconify icon="solar:cash-out-bold-duotone" width={20} />
                      <span>Thu chi quầy</span>
                      {summary?.transactions && (
                        <Chip label={summary.transactions.length} size="small" color="primary" />
                      )}
                    </Stack>
                  }
                />
                <Tab
                  label={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Iconify icon="solar:shop-bold-duotone" width={20} />
                      <span>Bán hàng KiotViet</span>
                    </Stack>
                  }
                />
                <Tab
                  label={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Iconify icon="solar:document-text-bold-duotone" width={20} />
                      <span>Nhật ký chỉnh sửa</span>
                      {logs.length > 0 && (
                        <Chip label={logs.length} size="small" variant="outlined" />
                      )}
                    </Stack>
                  }
                />
              </Tabs>

              <Box sx={{ p: 2.5 }}>
                {/* Tab 0: Thu chi quầy */}
                {tab === 0 && (
                  <>
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<Iconify icon="mingcute:add-line" />}
                        onClick={() => handleOpenAddTx('Thu')}
                      >
                        Thêm thu
                      </Button>
                      <Button
                        variant="contained"
                        color="error"
                        size="small"
                        startIcon={<Iconify icon="mingcute:add-line" />}
                        onClick={() => handleOpenAddTx('Chi')}
                      >
                        Thêm chi
                      </Button>
                    </Stack>

                    <Scrollbar>
                      <TableContainer>
                        <Table size="small" sx={{ minWidth: 600 }}>
                          <TableHead>
                            <TableRow>
                              <TableCell>Loại</TableCell>
                              <TableCell align="right">Số tiền</TableCell>
                              <TableCell>Ghi chú</TableCell>
                              <TableCell>Người tạo</TableCell>
                              <TableCell>Thời gian</TableCell>
                              <TableCell align="right" />
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(!summary?.transactions || summary.transactions.length === 0) && (
                              <TableRow>
                                <TableCell colSpan={6} align="center">
                                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                    Chưa có thu chi nào
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            )}
                            {summary?.transactions.map((tx) => (
                              <TableRow key={tx.id} hover>
                                <TableCell>
                                  <Label
                                    variant="soft"
                                    color={tx.type === 'Thu' ? 'success' : 'error'}
                                  >
                                    {tx.type}
                                  </Label>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography
                                    variant="body2"
                                    fontWeight={600}
                                    color={tx.type === 'Thu' ? 'success.main' : 'error.main'}
                                  >
                                    {tx.type === 'Thu' ? '+' : '-'}
                                    {formatCurrency(tx.amount)}
                                  </Typography>
                                </TableCell>
                                <TableCell>{tx.note || '—'}</TableCell>
                                <TableCell>
                                  <Typography variant="caption">{tx.createdByName}</Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="caption">
                                    {new Date(tx.createdAt).toLocaleTimeString('vi-VN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenEditTx(tx)}
                                  >
                                    <Iconify icon="solar:pen-bold" width={18} />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => {
                                      setDeleteId(tx.id);
                                      confirmDelete.onTrue();
                                    }}
                                  >
                                    <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Scrollbar>
                  </>
                )}

                {/* Tab 1: KiotViet */}
                {tab === 1 && (
                  <>
                    {kiotLoading ? (
                      <Box display="flex" justifyContent="center" py={4}>
                        <CircularProgress size={32} />
                      </Box>
                    ) : !kiotData ? (
                      <Box sx={{ py: 4, textAlign: 'center' }}>
                        <Iconify icon="solar:shop-bold-duotone" width={48} sx={{ color: 'text.disabled', mb: 2 }} />
                        <Typography variant="body1" color="text.secondary">
                          Không tải được dữ liệu KiotViet
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        {/* KiotViet Summary Bar */}
                        <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" alignItems="center">
                          <Chip
                            icon={<Iconify icon="solar:bill-list-bold" width={16} />}
                            label={`${kiotData.totalInvoices} đơn`}
                            variant="outlined"
                          />
                          <Chip
                            label={`Tổng: ${formatCurrency(kiotData.totalRevenue)}`}
                            color="primary"
                            variant="soft"
                          />
                          <Chip
                            label={`TM: ${formatCurrency(kiotData.totalCash)}`}
                            color="success"
                            variant="soft"
                          />
                          <Chip
                            label={`CK: ${formatCurrency(kiotData.totalBank)}`}
                            color="info"
                            variant="soft"
                          />
                          <Chip
                            label={`Thẻ: ${formatCurrency(kiotData.totalCard)}`}
                            color="warning"
                            variant="soft"
                          />
                          {kiotData.totalReturns > 0 && (
                            <Chip
                              label={`Trả: -${formatCurrency(kiotData.totalReturns)}`}
                              color="error"
                              variant="soft"
                            />
                          )}
                          {invoiceBatchProgress && (
                            <Chip
                              icon={<CircularProgress size={14} />}
                              label={`Đang tải chi tiết ${invoiceBatchProgress.loaded}/${invoiceBatchProgress.total}`}
                              variant="outlined"
                              size="small"
                            />
                          )}

                          <Box sx={{ flexGrow: 1 }} />

                          <LoadingButton
                            variant="outlined"
                            size="small"
                            startIcon={<Iconify icon="solar:download-minimalistic-bold" />}
                            onClick={async () => {
                              try {
                                await exportKiotVietExcel(currentDate);
                                enqueueSnackbar('Đã tải xuống báo cáo Excel');
                              } catch (err) {
                                console.error(err);
                                enqueueSnackbar('Tải xuống thất bại', { variant: 'error' });
                              }
                            }}
                          >
                            Tải Excel
                          </LoadingButton>
                        </Stack>

                        {/* KiotViet sub-tabs */}
                        <Tabs
                          value={kiotTab}
                          onChange={(_, v) => setKiotTab(v)}
                          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                        >
                          <Tab label={`Tiền mặt (${kiotData.cashInvoices.length})`} />
                          <Tab label={`Chuyển khoản (${kiotData.bankInvoices.length})`} />
                          <Tab label={`Thẻ (${kiotData.cardInvoices.length})`} />
                          <Tab label={`Trả hàng (${kiotData.returns.length})`} />
                        </Tabs>

                        {/* Invoice tables */}
                        {kiotTab < 3 && (
                          <Scrollbar sx={{ maxHeight: 500 }}>
                            <TableContainer>
                              <Table size="small" stickyHeader sx={{ minWidth: 800 }}>
                                <TableHead>
                                  <TableRow>
                                    <TableCell align="right">Số tiền</TableCell>
                                    <TableCell>Mã đơn</TableCell>
                                    <TableCell>Sản phẩm</TableCell>
                                    <TableCell>Ghi chú</TableCell>
                                    <TableCell align="center">Thao tác</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {(() => {
                                    const invoices = kiotTab === 0
                                      ? kiotData.cashInvoices
                                      : kiotTab === 1
                                        ? kiotData.bankInvoices
                                        : kiotData.cardInvoices;

                                    if (invoices.length === 0) {
                                      return (
                                        <TableRow>
                                          <TableCell colSpan={5} align="center">
                                            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                              Không có đơn
                                            </Typography>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    }

                                    return invoices.map((inv) => {
                                      const netAmount = inv.total - inv.returnAmount;
                                      const hasPartialCash = inv.total !== inv.totalPayment && inv.cashDifference > 0;
                                      const cached = invoiceDetailCache[inv.id];
                                      const products = cached?.products ?? [];
                                      const displayProducts = products.slice(0, 3);
                                      const moreCount = products.length - 3;

                                      return (
                                        <TableRow
                                          key={inv.id}
                                          hover
                                          sx={{
                                            ...(inv.hasReturn && {
                                              bgcolor: 'error.lighter',
                                            }),
                                            ...(hasPartialCash && {
                                              bgcolor: 'warning.lighter',
                                            }),
                                          }}
                                        >
                                          <TableCell align="right">
                                            <Typography variant="body2" fontWeight={600}>
                                              {formatCurrency(netAmount)}
                                            </Typography>
                                            {inv.hasReturn && (
                                              <Typography variant="caption" color="error.main" display="block">
                                                {inv.returnNote}
                                              </Typography>
                                            )}
                                            {hasPartialCash && (
                                              <Typography variant="caption" color="warning.main" display="block">
                                                Đơn: {formatCurrency(inv.total)}
                                              </Typography>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <Typography variant="body2">{inv.code}</Typography>
                                            <Typography variant="caption" color="text.disabled">
                                              {new Date(inv.createdDate).toLocaleTimeString('vi-VN', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit',
                                              })}
                                            </Typography>
                                          </TableCell>
                                          <TableCell sx={{ maxWidth: 250 }}>
                                            {cached ? (
                                              <Stack spacing={0.25}>
                                                {displayProducts.map((p, idx) => (
                                                  <Typography key={idx} variant="caption" noWrap>
                                                    {p.productName} × {p.quantity} — {formatCurrency(p.price)}
                                                  </Typography>
                                                ))}
                                                {moreCount > 0 && (
                                                  <Typography variant="caption" color="text.disabled">
                                                    +{moreCount} sản phẩm khác
                                                  </Typography>
                                                )}
                                              </Stack>
                                            ) : (
                                              <Typography variant="caption" color="text.disabled">
                                                —
                                              </Typography>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <Typography variant="caption">
                                              {hasPartialCash
                                                ? `Thu: ${formatCurrency(inv.cashDifference)}đ tiền mặt`
                                                : inv.description || ''}
                                            </Typography>
                                          </TableCell>
                                          <TableCell align="center">
                                            <Tooltip title="Xem chi tiết">
                                              <IconButton
                                                size="small"
                                                color="info"
                                                onClick={() => handleViewInvoiceDetail(inv.id)}
                                                disabled={invoiceDetailLoading === inv.id}
                                              >
                                                {invoiceDetailLoading === inv.id ? (
                                                  <CircularProgress size={18} />
                                                ) : (
                                                  <Iconify icon="solar:eye-bold" width={18} />
                                                )}
                                              </IconButton>
                                            </Tooltip>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    });
                                  })()}

                                  {/* Total row */}
                                  <TableRow>
                                    <TableCell align="right">
                                      <Typography variant="subtitle2" fontWeight={700} color="primary.main">
                                        Tổng:{' '}
                                        {formatCurrency(
                                          kiotTab === 0
                                            ? kiotData.totalCash
                                            : kiotTab === 1
                                              ? kiotData.totalBank
                                              : kiotData.totalCard
                                        )}
                                      </Typography>
                                    </TableCell>
                                    <TableCell colSpan={4} />
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </Scrollbar>
                        )}

                        {/* Returns table */}
                        {kiotTab === 3 && (
                          <Scrollbar sx={{ maxHeight: 500 }}>
                            <TableContainer>
                              <Table size="small" stickyHeader sx={{ minWidth: 650 }}>
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Mã trả</TableCell>
                                    <TableCell>Đơn gốc</TableCell>
                                    <TableCell align="right">Trả</TableCell>
                                    <TableCell align="right">Đổi</TableCell>
                                    <TableCell align="right">Thực trả</TableCell>
                                    <TableCell>PT gốc</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {kiotData.returns.length === 0 && (
                                    <TableRow>
                                      <TableCell colSpan={6} align="center">
                                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                          Không có đơn trả
                                        </Typography>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  {kiotData.returns.map((ret) => (
                                    <TableRow key={ret.id} hover>
                                      <TableCell>
                                        <Typography variant="body2">{ret.code}</Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="caption">{ret.invoiceCode || '—'}</Typography>
                                      </TableCell>
                                      <TableCell align="right">
                                        <Typography variant="body2" color="error.main">
                                          {formatCurrency(ret.returnTotal)}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="right">
                                        <Typography variant="body2" color="success.main">
                                          {ret.exchangeInvoiceTotal
                                            ? formatCurrency(ret.exchangeInvoiceTotal)
                                            : '—'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="right">
                                        <Typography variant="body2" fontWeight={600}>
                                          {formatCurrency(ret.netReturnAmount)}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Label
                                          variant="soft"
                                          color={
                                            ret.paymentMethod === 'Cash'
                                              ? 'success'
                                              : ret.paymentMethod === 'Transfer'
                                                ? 'info'
                                                : 'warning'
                                          }
                                        >
                                          {ret.paymentMethod || '—'}
                                        </Label>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </Scrollbar>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Tab 2: Nhật ký chỉnh sửa */}
                {tab === 2 && (
                  <Scrollbar>
                    <TableContainer>
                      <Table size="small" sx={{ minWidth: 700 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Vị trí</TableCell>
                            <TableCell>Loại</TableCell>
                            <TableCell>Thời gian</TableCell>
                            <TableCell align="right">OLD</TableCell>
                            <TableCell align="right">NEW</TableCell>
                            <TableCell>Người thực hiện</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {logs.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} align="center">
                                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                  Chưa có nhật ký
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                          {logs.map((log) => (
                            <TableRow key={log.id} hover>
                              <TableCell>
                                <Chip
                                  label={log.fieldName || '—'}
                                  size="small"
                                  color={
                                    log.actionType === 'FinalizeShift'
                                      ? 'success'
                                      : log.actionType === 'OpenCounter'
                                        ? 'primary'
                                        : log.actionType.includes('Denomination')
                                          ? 'info'
                                          : 'warning'
                                  }
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption">
                                  {log.actionType === 'UpdateDenomination' && 'Kiểm tra tiền mặt'}
                                  {log.actionType === 'AddTransaction' && 'Chi tiêu quầy - ghi chú'}
                                  {log.actionType === 'UpdateTransaction' && 'Sửa thu chi'}
                                  {log.actionType === 'DeleteTransaction' && 'Xoá thu chi'}
                                  {log.actionType === 'FinalizeShift' && 'Chốt tiền ca'}
                                  {log.actionType === 'OpenCounter' && 'Mở quầy'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption">
                                  {new Date(log.timestamp).toLocaleTimeString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" color="text.secondary">
                                  {log.oldValue || ''}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight={600}>
                                  {log.newValue || ''}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption">{log.userName}</Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Scrollbar>
                )}
              </Box>
            </Card>
          </Stack>
        )}
      </Container>

      {/* Transaction Dialog */}
      <Dialog open={txDialog.value} onClose={txDialog.onFalse} maxWidth="xs" fullWidth>
        <DialogTitle>
          {txMode === 'add' ? `Thêm ${txType === 'Thu' ? 'thu' : 'chi'} quầy` : 'Sửa thu chi'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {txMode === 'add' && (
              <TextField
                select
                fullWidth
                label="Loại"
                value={txType}
                onChange={(e) => setTxType(e.target.value as 'Thu' | 'Chi')}
              >
                <MenuItem value="Thu">Thu</MenuItem>
                <MenuItem value="Chi">Chi</MenuItem>
              </TextField>
            )}
            <TextField
              fullWidth
              label="Số tiền"
              type="number"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              InputProps={{
                endAdornment: <InputAdornment position="end">VNĐ</InputAdornment>,
              }}
            />
            <TextField
              fullWidth
              label="Ghi chú"
              value={txNote}
              onChange={(e) => setTxNote(e.target.value)}
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={txDialog.onFalse}>
            Huỷ
          </Button>
          <LoadingButton
            variant="contained"
            onClick={handleSaveTx}
            loading={txSaving}
            disabled={!txAmount || parseFloat(txAmount) <= 0}
          >
            {txMode === 'add' ? 'Thêm' : 'Lưu'}
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={confirmDelete.value} onClose={confirmDelete.onFalse} maxWidth="xs">
        <DialogTitle>Xác nhận xoá</DialogTitle>
        <DialogContent>
          <Typography>Bạn có chắc muốn xoá khoản thu/chi này?</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={confirmDelete.onFalse}>
            Huỷ
          </Button>
          <Button variant="contained" color="error" onClick={handleDeleteTx}>
            Xoá
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Finalize */}
      <Dialog open={confirmFinalize.value} onClose={confirmFinalize.onFalse} maxWidth="xs" fullWidth>
        <DialogTitle>Xác nhận chốt tiền</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography>
              Bạn đang chốt tiền cho ngày <strong>{currentDate}</strong>
            </Typography>

            <Box sx={{ bgcolor: 'background.neutral', borderRadius: 1, p: 2 }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Tồn đầu ca</Typography>
                  <Typography variant="body2">{formatCurrency(summary?.openingBalance || 0)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">+ KiotViet (tiền mặt)</Typography>
                  <Typography variant="body2">{formatCurrency(summary?.totalCashFromKiot || 0)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">+ Thu quầy</Typography>
                  <Typography variant="body2" color="success.main">+{formatCurrency(summary?.manualIncome || 0)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">- Chi quầy</Typography>
                  <Typography variant="body2" color="error.main">-{formatCurrency(summary?.manualExpense || 0)}</Typography>
                </Stack>
                <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2">= Tồn cuối lý thuyết</Typography>
                    <Typography variant="subtitle2" color="info.main">
                      {formatCurrency(summary?.expectedClosing || 0)}
                    </Typography>
                  </Stack>
                </Box>
                <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2">Tiền mặt kiểm đếm</Typography>
                    <Typography variant="subtitle2" color="primary.main" fontWeight={700}>
                      {formatCurrency(totalCash)}
                    </Typography>
                  </Stack>
                </Box>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: (totalCash - (summary?.expectedClosing || 0)) >= 0
                      ? alpha(theme.palette.success.main, 0.12)
                      : alpha(theme.palette.error.main, 0.12),
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" fontWeight={700}>Chênh lệch</Typography>
                    <Typography
                      variant="subtitle1"
                      color={(totalCash - (summary?.expectedClosing || 0)) >= 0 ? 'success.main' : 'error.main'}
                      fontWeight={700}
                    >
                      {(totalCash - (summary?.expectedClosing || 0)) >= 0 ? '+' : ''}
                      {formatCurrency(totalCash - (summary?.expectedClosing || 0))}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            </Box>

            <Typography variant="caption" color="text.secondary">
              Tồn cuối ({formatCurrency(totalCash)}) sẽ trở thành tồn đầu ca ngày kế tiếp.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={confirmFinalize.onFalse}>
            Huỷ
          </Button>
          <LoadingButton
            variant="contained"
            color="success"
            loading={savingDenom}
            onClick={handleFinalize}
            startIcon={<Iconify icon="solar:check-circle-bold" />}
          >
            Xác nhận chốt
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <Dialog
        open={invoiceDetailDialog.value}
        onClose={invoiceDetailDialog.onFalse}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <Iconify icon="solar:document-text-bold-duotone" width={24} />
            <span>Chi tiết hóa đơn {selectedInvoiceDetail?.code}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedInvoiceDetail && (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              {/* Invoice info */}
              <Box sx={{ bgcolor: 'background.neutral', borderRadius: 1, p: 2 }}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Mã đơn</Typography>
                    <Typography variant="body2" fontWeight={600}>{selectedInvoiceDetail.code}</Typography>
                  </Stack>
                  {selectedInvoiceDetail.orderCode && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Mã đặt hàng</Typography>
                      <Typography variant="body2">{selectedInvoiceDetail.orderCode}</Typography>
                    </Stack>
                  )}
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Ngày mua</Typography>
                    <Typography variant="body2">
                      {new Date(selectedInvoiceDetail.purchaseDate).toLocaleString('vi-VN')}
                    </Typography>
                  </Stack>
                  {selectedInvoiceDetail.customerName && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Khách hàng</Typography>
                      <Typography variant="body2">
                        {selectedInvoiceDetail.customerName}
                        {selectedInvoiceDetail.customerCode && ` (${selectedInvoiceDetail.customerCode})`}
                      </Typography>
                    </Stack>
                  )}
                  {selectedInvoiceDetail.soldByName && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Nhân viên bán</Typography>
                      <Typography variant="body2">{selectedInvoiceDetail.soldByName}</Typography>
                    </Stack>
                  )}
                  {selectedInvoiceDetail.branchName && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Chi nhánh</Typography>
                      <Typography variant="body2">{selectedInvoiceDetail.branchName}</Typography>
                    </Stack>
                  )}
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Trạng thái</Typography>
                    <Label
                      variant="soft"
                      color={selectedInvoiceDetail.status === 1 ? 'success' : 'default'}
                    >
                      {selectedInvoiceDetail.statusValue || `Status ${selectedInvoiceDetail.status}`}
                    </Label>
                  </Stack>
                  {selectedInvoiceDetail.description && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Ghi chú</Typography>
                      <Typography variant="body2">{selectedInvoiceDetail.description}</Typography>
                    </Stack>
                  )}
                </Stack>
              </Box>

              {/* Products table */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  <Iconify icon="solar:box-bold-duotone" width={20} sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                  Sản phẩm ({selectedInvoiceDetail.products.length})
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Tên sản phẩm</TableCell>
                        <TableCell align="right">SL</TableCell>
                        <TableCell align="right">Đơn giá</TableCell>
                        <TableCell align="right">Giảm giá</TableCell>
                        <TableCell align="right">Thành tiền</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedInvoiceDetail.products.map((p, idx) => {
                        const lineTotal = p.price * p.quantity - (p.discount || 0);
                        return (
                          <TableRow key={idx} hover>
                            <TableCell>
                              <Typography variant="body2">{p.productName}</Typography>
                              {p.productCode && (
                                <Typography variant="caption" color="text.disabled">
                                  {p.productCode}
                                </Typography>
                              )}
                              {p.note && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {p.note}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">{p.quantity}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">{formatCurrency(p.price)}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              {p.discount ? (
                                <Typography variant="body2" color="error.main">
                                  -{formatCurrency(p.discount)}
                                  {p.discountRatio ? ` (${p.discountRatio}%)` : ''}
                                </Typography>
                              ) : (
                                <Typography variant="body2" color="text.disabled">—</Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={600}>
                                {formatCurrency(lineTotal)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Surcharges */}
              {selectedInvoiceDetail.surcharges.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Phụ thu</Typography>
                  <Stack spacing={0.5}>
                    {selectedInvoiceDetail.surcharges.map((s) => (
                      <Stack key={s.id} direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          {s.surchargeName || 'Phụ thu'}
                        </Typography>
                        <Typography variant="body2">{formatCurrency(s.price || 0)}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Payments */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  <Iconify icon="solar:card-bold-duotone" width={20} sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                  Thanh toán ({selectedInvoiceDetail.payments.length})
                </Typography>
                <Stack spacing={1}>
                  {selectedInvoiceDetail.payments.map((pm) => {
                    const bankInfo = getBankInfoForPayment(pm.accountId);
                    return (
                      <Stack key={pm.id} direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          {bankInfo?.logo && (
                            <Box
                              component="img"
                              src={bankInfo.logo}
                              alt={bankInfo.vietQRShortName || ''}
                              sx={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 0.5 }}
                            />
                          )}
                          <Label
                            variant="soft"
                            color={
                              pm.method === 'Cash'
                                ? 'success'
                                : pm.method === 'Transfer'
                                  ? 'info'
                                  : 'warning'
                            }
                          >
                            {pm.method === 'Cash' ? 'Tiền mặt' : pm.method === 'Transfer' ? 'Chuyển khoản' : pm.method}
                          </Label>
                          {bankInfo ? (
                            <Stack>
                              <Typography variant="caption" fontWeight={600}>
                                {bankInfo.vietQRShortName || bankInfo.bankName}
                              </Typography>
                              {bankInfo.accountNumber && (
                                <Typography variant="caption" color="text.secondary">
                                  {bankInfo.accountNumber}
                                </Typography>
                              )}
                            </Stack>
                          ) : pm.bankAccount ? (
                            <Typography variant="caption" color="text.secondary">
                              {pm.bankAccount}
                            </Typography>
                          ) : null}
                        </Stack>
                        <Typography variant="body2" fontWeight={600}>
                          {formatCurrency(pm.amount)}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              </Box>

              {/* Total summary */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                }}
              >
                <Stack spacing={0.5}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle2">Khách cần trả</Typography>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {formatCurrency(selectedInvoiceDetail.total)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Khách đã trả</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {formatCurrency(selectedInvoiceDetail.totalPayment)}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={invoiceDetailDialog.onFalse}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
