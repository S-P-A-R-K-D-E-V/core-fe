'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { paths } from 'src/routes/paths';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { IShiftCashTransaction, IShareholder } from 'src/types/corecms-api';
import { getShiftCashTransactions, updateShiftCashTransaction } from 'src/api/shiftCash';
import { getShareholders } from 'src/api/shareholders';

// ----------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

// Bỏ dấu tiếng Việt + hạ chữ thường để so khớp gợi ý không phân biệt dấu/hoa-thường
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

// Từ đệm/xưng hô không dùng để so khớp tên — tránh nhầm động từ "chi" (chi tiền) với "Chị" (xưng hô)
const HONORIFIC_STOPWORDS = new Set(['chi', 'anh', 'co', 'chu', 'bac', 'ong', 'ba', 'em', 'a', 'c']);

function nameTokens(name: string): string[] {
  return normalize(name)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !HONORIFIC_STOPWORDS.has(w));
}

// Gợi ý cổ đông dựa trên ghi chú (vd "c uyên"/"chi uyên" → khớp token "uyen" của "Chị Uyên")
function suggestShareholder(
  note: string | null | undefined,
  shareholders: IShareholder[]
): IShareholder | null {
  if (!note) return null;
  const noteWords = new Set(normalize(note).split(/[^a-z0-9]+/).filter(Boolean));
  return (
    shareholders.find((s) => {
      const tokens = nameTokens(s.name);
      return tokens.length > 0 && tokens.some((t) => noteWords.has(t));
    }) || null
  );
}

export default function ShiftCashMonthlyView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [transactions, setTransactions] = useState<IShiftCashTransaction[]>([]);
  const [shareholders, setShareholders] = useState<IShareholder[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const { fromDate, toDate } = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { fromDate: fmt(new Date(y, m, 1)), toDate: fmt(new Date(y, m + 1, 0)) };
  }, [month]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getShiftCashTransactions(fromDate, toDate);
      setTransactions(list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải dữ liệu thu chi', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    getShareholders(true).then(setShareholders).catch(() => {});
  }, []);

  const handleSetShareholder = useCallback(
    async (tx: IShiftCashTransaction, shareholderId: string) => {
      setSavingId(tx.id);
      try {
        await updateShiftCashTransaction(tx.id, {
          amount: tx.amount,
          note: tx.note,
          shareholderId: shareholderId || null,
        });
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === tx.id
              ? {
                  ...t,
                  shareholderId: shareholderId || null,
                  shareholderName: shareholders.find((s) => s.id === shareholderId)?.name || null,
                }
              : t
          )
        );
      } catch (error) {
        enqueueSnackbar('Cập nhật thất bại', { variant: 'error' });
      } finally {
        setSavingId(null);
      }
    },
    [shareholders, enqueueSnackbar]
  );

  const totalThu = transactions.filter((t) => t.type === 'Thu').reduce((s, t) => s + t.amount, 0);
  const totalChi = transactions.filter((t) => t.type === 'Chi').reduce((s, t) => s + t.amount, 0);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Thu chi quầy theo tháng"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kiểm tiền', href: paths.dashboard.shiftCash.root },
          { name: 'Theo tháng' },
        ]}
        sx={{ mb: 3 }}
      />

      <Card sx={{ p: 2.5, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }}>
          <DatePicker
            label="Tháng"
            views={['year', 'month']}
            openTo="month"
            value={month}
            onChange={(val) => val && setMonth(new Date(val.getFullYear(), val.getMonth(), 1))}
            format="MM/yyyy"
            slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
          />
          <Stack direction="row" spacing={3}>
            <Typography variant="body2">
              Tổng thu:{' '}
              <Typography component="span" variant="subtitle2" color="success.main">
                {formatCurrency(totalThu)}
              </Typography>
            </Typography>
            <Typography variant="body2">
              Tổng chi:{' '}
              <Typography component="span" variant="subtitle2" color="error.main">
                {formatCurrency(totalChi)}
              </Typography>
            </Typography>
          </Stack>
        </Stack>
      </Card>

      <Card>
        <Scrollbar>
          <TableContainer sx={{ minWidth: 800 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ngày</TableCell>
                  <TableCell>Loại</TableCell>
                  <TableCell align="right">Số tiền</TableCell>
                  <TableCell>Ghi chú</TableCell>
                  <TableCell sx={{ minWidth: 260 }}>Chi cho / Thu từ ai</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!loading && transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        Không có thu chi nào trong tháng này
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {transactions.map((tx) => {
                  const suggestion = !tx.shareholderId ? suggestShareholder(tx.note, shareholders) : null;
                  return (
                    <TableRow key={tx.id} hover>
                      <TableCell>{tx.date.split('-').reverse().join('/')}</TableCell>
                      <TableCell>
                        <Label variant="soft" color={tx.type === 'Thu' ? 'success' : 'error'}>
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
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TextField
                            select
                            size="small"
                            value={tx.shareholderId || ''}
                            onChange={(e) => handleSetShareholder(tx, e.target.value)}
                            disabled={savingId === tx.id}
                            sx={{ minWidth: 150 }}
                          >
                            <MenuItem value="">Cửa hàng (mặc định)</MenuItem>
                            {shareholders.map((s) => (
                              <MenuItem key={s.id} value={s.id}>
                                {s.name}
                              </MenuItem>
                            ))}
                          </TextField>
                          {suggestion && (
                            <Chip
                              size="small"
                              color="warning"
                              variant="outlined"
                              icon={<Iconify icon="solar:magic-stick-3-bold" width={14} />}
                              label={`Gợi ý: ${suggestion.name}`}
                              onClick={() => handleSetShareholder(tx, suggestion.id)}
                              sx={{ cursor: 'pointer' }}
                            />
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      </Card>
    </Container>
  );
}
