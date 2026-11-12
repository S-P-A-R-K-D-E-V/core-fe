'use client';

import { useRef, useMemo, useState, useEffect, useCallback, Fragment } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import Autocomplete from '@mui/material/Autocomplete';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import TablePagination from '@mui/material/TablePagination';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { FEATURE, useFeatureEnabled } from 'src/hooks/use-feature-enabled';

import { fDateTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import { getAllSuppliers } from 'src/api/suppliers';
import { getShareholders } from 'src/api/shareholders';
import {
  getAllPurchaseOrders,
  setPurchaseOrderPaidBy,
  getPurchaseOrderCapabilities,
} from 'src/api/purchase-orders';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { ISupplier, IShareholder, IPurchaseOrder, IPurchaseOrderCapabilities } from 'src/types/corecms-api';

import { usePurchaseAccess } from '../purchase-access';
import PurchaseOrderRowDetail from '../purchase-order-row-detail';
import { STATUS_GROUPS, type StatusGroupKey, purchaseStatusMeta } from '../purchase-status';

// ----------------------------------------------------------------------
// Danh sách phiếu nhập — bố cục KiotViet: bộ lọc bên trái (trạng thái, thời gian, NCC), ô tìm mã phiếu / NCC / số
// hoá đơn, dòng tổng "cần trả NCC" của cả bộ lọc, bấm vào dòng là mở chi tiết ngay dưới dòng.
// ----------------------------------------------------------------------

type TimeRange = 'this-month' | 'last-month' | 'last-30' | 'all' | 'custom';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'this-month', label: 'Tháng này' },
  { value: 'last-month', label: 'Tháng trước' },
  { value: 'last-30', label: '30 ngày qua' },
  { value: 'all', label: 'Toàn thời gian' },
  { value: 'custom', label: 'Tuỳ chọn' },
];

const SEARCH_DEBOUNCE_MS = 400;

/** Mốc đầu / cuối của khoảng thời gian (giờ máy — cửa hàng ở Việt Nam) → ISO UTC cho API. */
function rangeOf(range: TimeRange, customFrom: string, customTo: string): { fromDate?: string; toDate?: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  switch (range) {
    case 'this-month':
      return { fromDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() };
    case 'last-month':
      return {
        fromDate: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
        toDate: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)).toISOString(),
      };
    case 'last-30':
      return { fromDate: startOfDay(new Date(now.getTime() - 29 * 86400000)).toISOString() };
    case 'custom':
      return {
        fromDate: customFrom ? startOfDay(new Date(`${customFrom}T00:00:00`)).toISOString() : undefined,
        toDate: customTo ? endOfDay(new Date(`${customTo}T00:00:00`)).toISOString() : undefined,
      };
    default:
      return {};
  }
}

export default function PurchaseOrderListView() {
  const { enqueueSnackbar } = useSnackbar();
  const access = usePurchaseAccess();
  const shareholdersOn = useFeatureEnabled(FEATURE.shareholders);

  const [rows, setRows] = useState<IPurchaseOrder[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [shareholders, setShareholders] = useState<IShareholder[]>([]);
  const [capabilities, setCapabilities] = useState<IPurchaseOrderCapabilities | null>(null);
  const [savingPaidById, setSavingPaidById] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Bộ lọc
  const [groups, setGroups] = useState<StatusGroupKey[]>(['temp', 'done']);
  const [timeRange, setTimeRange] = useState<TimeRange>('this-month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [supplier, setSupplier] = useState<ISupplier | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    getAllSuppliers().then(setSuppliers).catch(() => {});
    getPurchaseOrderCapabilities()
      .then(setCapabilities)
      .catch(() => setCapabilities(null));
  }, []);

  useEffect(() => {
    // Danh sách cổ đông chỉ chủ cửa hàng đọc được — người khác vẫn xem được phiếu, chỉ không chọn "ai chi hộ".
    if (shareholdersOn && access.canSetPaidBy) getShareholders(true).then(setShareholders).catch(() => {});
  }, [shareholdersOn, access.canSetPaidBy]);

  const statuses = useMemo(() => {
    if (groups.length === 0 || groups.length === STATUS_GROUPS.length) return undefined;
    return STATUS_GROUPS.filter((g) => groups.includes(g.key))
      .flatMap((g) => g.statuses)
      .join(',');
  }, [groups]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllPurchaseOrders({
        supplierId: supplier?.id,
        statuses,
        keyword: keyword || undefined,
        ...rangeOf(timeRange, customFrom, customTo),
        pageNumber: page + 1,
        pageSize,
      });
      setRows(result.items);
      setTotalCount(result.totalCount);
      setTotalAmount(result.totalAmount ?? result.items.reduce((s, r) => s + (r.totalAmount || 0), 0));
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không tải được danh sách phiếu nhập', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [supplier, statuses, keyword, timeRange, customFrom, customTo, page, pageSize, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetPage = () => {
    setPage(0);
    setExpandedId(null);
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      resetPage();
      setKeyword(value.trim());
    }, SEARCH_DEBOUNCE_MS);
  };

  const toggleGroup = (key: StatusGroupKey) => {
    resetPage();
    setGroups((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleSetPaidBy = useCallback(
    async (id: string, shareholderId: string) => {
      setSavingPaidById(id);
      try {
        await setPurchaseOrderPaidBy(id, shareholderId || null);
        setRows((prev) =>
          prev.map((row) =>
            row.id === id
              ? {
                  ...row,
                  paidByShareholderId: shareholderId || null,
                  paidByShareholderName: shareholders.find((s) => s.id === shareholderId)?.name || null,
                }
              : row
          )
        );
        enqueueSnackbar('Đã cập nhật người chi hộ');
      } catch (error) {
        console.error(error);
        enqueueSnackbar('Không thể cập nhật người chi hộ', { variant: 'error' });
      } finally {
        setSavingPaidById(null);
      }
    },
    [enqueueSnackbar, shareholders]
  );

  const columns = [
    { id: 'code', label: 'Mã nhập hàng', width: 140 },
    { id: 'time', label: 'Thời gian', width: 140 },
    { id: 'supplier', label: 'Nhà cung cấp' },
    { id: 'total', label: 'Cần trả NCC', width: 130, align: 'right' as const },
    { id: 'paid', label: 'Thanh toán', width: 140 },
    { id: 'status', label: 'Trạng thái', width: 124 },
  ];
  const totalColumnIndex = columns.findIndex((c) => c.id === 'total');

  const renderFilters = (
    <Card sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2.5, position: { md: 'sticky' }, top: { md: 80 } }}>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Trạng thái
        </Typography>
        {STATUS_GROUPS.map((g) => (
          <FormControlLabel
            key={g.key}
            sx={{ display: 'flex', mr: 0 }}
            control={<Checkbox size="small" checked={groups.includes(g.key)} onChange={() => toggleGroup(g.key)} />}
            label={<Typography variant="body2">{g.label}</Typography>}
          />
        ))}
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Thời gian
        </Typography>
        <RadioGroup
          value={timeRange}
          onChange={(e) => {
            resetPage();
            setTimeRange(e.target.value as TimeRange);
          }}
        >
          {TIME_RANGES.map((r) => (
            <FormControlLabel
              key={r.value}
              value={r.value}
              control={<Radio size="small" />}
              label={<Typography variant="body2">{r.label}</Typography>}
            />
          ))}
        </RadioGroup>
        {timeRange === 'custom' && (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <TextField
              type="date"
              size="small"
              label="Từ ngày"
              value={customFrom}
              onChange={(e) => {
                resetPage();
                setCustomFrom(e.target.value);
              }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="date"
              size="small"
              label="Đến ngày"
              value={customTo}
              onChange={(e) => {
                resetPage();
                setCustomTo(e.target.value);
              }}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Nhà cung cấp
        </Typography>
        <Autocomplete
          size="small"
          options={suppliers}
          value={supplier}
          onChange={(_, val) => {
            resetPage();
            setSupplier(val);
          }}
          getOptionLabel={(s) => s.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderOption={(props, s) => (
            <li {...props} key={s.id}>
              {s.name}
            </li>
          )}
          renderInput={(params) => <TextField {...params} placeholder="Tất cả NCC" />}
        />
      </Box>
    </Card>
  );

  const renderPaid = (row: IPurchaseOrder) => {
    if (row.status === 'Cancelled') return '—';
    if (row.paidByShareholderName) {
      return (
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {row.paidByShareholderName} chi hộ
        </Typography>
      );
    }
    const remaining = row.remainingAmount ?? 0;
    const paid = row.paidAmount ?? 0;
    if (remaining <= 0 && paid > 0) {
      return (
        <Label variant="soft" color="success">
          Đã trả đủ
        </Label>
      );
    }
    if (remaining > 0 && paid > 0) {
      return (
        <Typography variant="caption" color="warning.main">
          Còn nợ {fCurrency(remaining)}
        </Typography>
      );
    }
    if (remaining > 0) {
      return (
        <Typography variant="caption" color="text.secondary">
          Chưa trả
        </Typography>
      );
    }
    return '—';
  };

  const renderTable = (
    <Card sx={{ minWidth: 0 }}>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 760, tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              {columns.map((c) => (
                <TableCell
                  key={c.id}
                  align={c.align}
                  sx={{ width: c.width, whiteSpace: 'nowrap', bgcolor: 'background.neutral', fontWeight: 600 }}
                >
                  {c.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Dòng tổng của cả bộ lọc — như KiotViet */}
            <TableRow>
              <TableCell colSpan={totalColumnIndex} sx={{ color: 'text.secondary' }}>
                {loading ? <CircularProgress size={16} /> : `${totalCount.toLocaleString('vi-VN')} phiếu`}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {fCurrency(totalAmount)}
              </TableCell>
              <TableCell colSpan={columns.length - totalColumnIndex - 1} />
            </TableRow>

            {rows.map((row) => {
              const status = purchaseStatusMeta(row.status);
              const open = expandedId === row.id;
              return (
                <Fragment key={row.id}>
                  <TableRow
                    hover
                    selected={open}
                    onClick={() => setExpandedId(open ? null : row.id)}
                    sx={{ cursor: 'pointer', '& td': { borderBottom: open ? 'none' : undefined } }}
                  >
                    <TableCell sx={{ fontWeight: 600, color: 'primary.main', whiteSpace: 'nowrap' }}>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Iconify
                          icon={open ? 'eva:arrow-ios-downward-fill' : 'eva:arrow-ios-forward-fill'}
                          width={14}
                          sx={{ color: 'text.disabled' }}
                        />
                        <span>{row.orderNumber}</span>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDateTime(row.createdAt)}</TableCell>
                    <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.supplierName || '—'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {fCurrency(row.totalAmount)}
                    </TableCell>
                    <TableCell>{renderPaid(row)}</TableCell>
                    <TableCell>
                      <Label variant="soft" color={status.color}>
                        {status.label}
                      </Label>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={columns.length} sx={{ p: 0, borderBottom: open ? undefined : 'none' }}>
                      <Collapse in={open} timeout="auto" unmountOnExit>
                        <PurchaseOrderRowDetail
                          order={row}
                          access={access}
                          capabilities={capabilities}
                          onChanged={fetchData}
                          paidBy={
                            // "Ai chi hộ" chỉ ghi được khi phiếu đã nhập hàng từ KiotViet (BE: Status = Returned).
                            shareholdersOn && access.canSetPaidBy && row.status === 'Returned' && shareholders.length > 0
                              ? {
                                  shareholders,
                                  saving: savingPaidById === row.id,
                                  onChange: (shareholderId: string) => handleSetPaidBy(row.id, shareholderId),
                                }
                              : undefined
                          }
                        />
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}

            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                  Không có phiếu nhập nào khớp bộ lọc.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[15, 20, 50, 100]}
        onPageChange={(_, p) => {
          setPage(p);
          setExpandedId(null);
        }}
        onRowsPerPageChange={(e) => {
          setPageSize(parseInt(e.target.value, 10));
          resetPage();
        }}
        labelRowsPerPage="Hiển thị"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
      />
    </Card>
  );

  return (
    <Container maxWidth={false} sx={{ px: { xs: 1.5, md: 2.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ flexShrink: 0, width: { md: 240 } }}>
          Nhập hàng
        </Typography>
        <TextField
          size="small"
          value={searchInput}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Theo mã phiếu nhập, NCC, số hoá đơn"
          sx={{ flex: 1, maxWidth: { sm: 460 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
        <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />
        {access.canCreate && (
          <Stack direction="row" spacing={1}>
            <Button
              component={RouterLink}
              href={paths.dashboard.pos.purchaseOrder.import}
              variant="outlined"
              color="inherit"
              startIcon={<Iconify icon="solar:camera-add-bold" />}
            >
              Nhập từ ảnh
            </Button>
            <Button
              component={RouterLink}
              href={paths.dashboard.pos.purchaseOrder.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Nhập hàng
            </Button>
          </Stack>
        )}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          alignItems: 'start',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '240px minmax(0, 1fr)' },
        }}
      >
        {renderFilters}
        {renderTable}
      </Box>
    </Container>
  );
}
