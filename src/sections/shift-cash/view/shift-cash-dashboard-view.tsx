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
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LoadingButton from '@mui/lab/LoadingButton';
import { useTheme, alpha } from '@mui/material/styles';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useSearchParams } from 'src/routes/hooks';

import { useBoolean } from 'src/hooks/use-boolean';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { AppDatePicker } from 'src/components/date-time-picker';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Label from 'src/components/label';

import { useAuthContext } from 'src/auth/hooks';
import { getUserRoles } from 'src/auth/roles';
import { usePageTours } from 'src/hooks/use-tour';
import type { TourDefinition } from 'src/hooks/use-tour';

import {
  vnToday,
  shiftCashDenial,
  canOverseeShiftCash,
  canViewShiftCashRevenue,
  canManageShiftCashOversight,
  isShiftCashLocationDenial,
} from 'src/utils/shift-cash-access';

import ShiftCashAccessGate, { useShiftCashAccess } from '../shift-cash-access-gate';
import ShiftCashInvestigationPanel from '../shift-cash-investigation-panel';
import ShiftCashReconciliationPanel from '../shift-cash-reconciliation-panel';
import ShiftCashRevenueBlock from '../shift-cash-revenue-block';
import ShiftCashSalesTab from '../shift-cash-sales-tab';

import {
  IShiftCashSummary,
  IShiftCashTransaction,
  IShiftCashDenomination,
  IShiftCashLog,
  IAuditLogEntry,
  IShiftCashRevenue,
  IShareholder,
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
  getShiftCashAuditLogs,
  getShiftCashRevenue,
} from 'src/api/shiftCash';
import { getShareholders } from 'src/api/shareholders';
import { FEATURE, useFeatureEnabled } from 'src/hooks/use-feature-enabled';

// ======================================================================

const DENOMINATIONS = [1, 2, 5, 10, 20, 50, 100, 200, 500];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

// Tách đơn vị hàng nghìn khi hiển thị số tiền đang nhập: "1000000" -> "1.000.000"
function formatAmountInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('vi-VN').format(Number(digits));
}

// Lấy lại chuỗi số thuần (chỉ chữ số) từ giá trị đã định dạng để lưu vào state
function parseAmountInput(value: string): string {
  return value.replace(/\D/g, '');
}

// "2026-10-02" -> "02/10/2026"
function formatDateVN(date: string): string {
  const [y, m, d] = date.split('-');
  return d && m && y ? `${d}/${m}/${y}` : date;
}

// ======================================================================
// Tour definitions
// ======================================================================

const SHIFT_CASH_TOURS: TourDefinition[] = [
  {
    tourKey: 'shift-cash-overview',
    label: 'Tổng quan',
    steps: [
      {
        element: '#tour-date-picker',
        popover: {
          title: 'Ngày kiểm tiền',
          description:
            'Ngày đang kiểm tiền (theo giờ Việt Nam), mặc định là hôm nay. Nhân viên / quản lý chỉ kiểm quầy ngày hôm nay; Admin chọn được ngày cũ để xem lại.',
          side: 'bottom' as const,
          align: 'start' as const,
        },
      },
      {
        element: '#tour-denomination-box',
        popover: {
          title: 'Bảng mệnh giá tiền mặt',
          description:
            'Nhập số lượng tiền theo từng mệnh giá để tính tổng tiền mặt trong quầy. Nhấn "Mở Quầy" để bắt đầu ca mới ( dành cho buổi sáng), còn chốt quầy sẽ enable khu vực nhập số lượng tiền để thực hiện kiểm đếm. Các bạn kiểm đếm số lượng tiền mặt vào và Lưu Nháp hoặc Chốt quầy để lưu lại.',
          side: 'right' as const,
          align: 'start' as const,
        },
      },
      {
        element: '#tour-summary-box',
        popover: {
          title: 'Tổng hợp',
          description:
            'Tồn cuối = tồn đầu ca + tiền mặt bán hàng + thu − chi quầy. So với tiền mặt kiểm đếm thực tế để biết chênh lệch.',
          side: 'left' as const,
          align: 'start' as const,
        },
      },
      {
        element: '#tour-difference-box',
        popover: {
          title: 'Chênh lệch',
          description:
            'Hiển thị chênh lệch giữa tiền mặt kiểm đếm thực tế và tồn cuối. Xanh = dư, Đỏ = thiếu. Các trường hợp bị chênh lệnh khi hết ca vui lòng nhắn tin báo lại trên messenger nhóm A/C để team hỗ trợ kiểm tra nhé.',
          side: 'top' as const,
          align: 'start' as const,
        },
      },
    ],
  },
  {
    tourKey: 'shift-cash-transactions',
    label: 'Thu chi & Chốt tiền',
    steps: [
      {
        element: '#tour-tabs-section',
        popover: {
          title: 'Các tab chi tiết',
          description:
            'Trang có các tab: Thu chi quầy, Hoá đơn bán hàng (người giám sát có thêm Nhật ký chỉnh sửa).',
          side: 'top' as const,
          align: 'start' as const,
        },
      },
      {
        element: '#tour-add-tx-buttons',
        popover: {
          title: 'Thêm thu / chi',
          description:
            'Nhấn "Thêm thu" hoặc "Thêm chi" để ghi nhận các khoản thu chi ngoài bán hàng (ví dụ: tiền ship, mua đồ dùng...).',
          side: 'bottom' as const,
          align: 'start' as const,
        },
      },
      {
        element: '#tour-finalize-area',
        popover: {
          title: 'Chốt tiền cuối ca',
          description:
            'Sau khi kiểm đếm xong, nhấn "Chốt tiền" → nhập mệnh giá → "Chốt ca" để lưu kết quả.',
          side: 'left' as const,
          align: 'start' as const,
        },
      },
    ],
  },
  {
    tourKey: 'shift-cash-kiotviet',
    label: 'Doanh thu & hoá đơn',
    steps: [
      {
        element: '#tour-kiotviet-summary',
        popover: {
          title: 'Doanh thu',
          description:
            'Doanh thu trong ngày từ dữ liệu của hệ thống: tiền mặt, chuyển khoản (so với tiền ngân hàng thực nhận), quẹt thẻ, trả hàng. Chỉ người được cấp quyền mới thấy số — người khác thấy ****.',
          side: 'left' as const,
          align: 'start' as const,
        },
      },
      {
        element: '#tour-tabs-section',
        popover: {
          title: 'Tab Hoá đơn bán hàng',
          description:
            'Chuyển sang tab "Hoá đơn bán hàng" để xem từng hoá đơn trong ngày (tiền mặt / chuyển khoản / thẻ / trả hàng), xem và in lại phiếu khi cần. Báo lại với a/c quản lý để xử lý trường hợp chênh lệch.',
          side: 'top' as const,
          align: 'start' as const,
        },
      },
      {
        popover: {
          title: 'Hoàn thành hướng dẫn! 🎉',
          description:
            'Bạn đã nắm được cách sử dụng trang Kiểm tiền quầy. Nhấn nút ❓ ở góc trên bất kỳ lúc nào để xem lại.',
        },
      },
    ],
  },
];

// ======================================================================

// Staff / Manager phải qua cổng (có ca hôm nay + GPS ở cửa hàng) mới thấy trang; Admin vào thẳng.
export default function ShiftCashDashboardView() {
  return (
    <ShiftCashAccessGate>
      <ShiftCashDashboardContent />
    </ShiftCashAccessGate>
  );
}

function ShiftCashDashboardContent() {
  const theme = useTheme();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const access = useShiftCashAccess();
  const txDialog = useBoolean();
  const confirmDelete = useBoolean();

  // Ngày theo giờ VN (BE so "hôm nay" theo múi VN). Không phải Admin thì luôn là hôm nay.
  const [currentDate, setCurrentDate] = useState(() => vnToday());
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<IShiftCashSummary | null>(null);
  const [logs, setLogs] = useState<IShiftCashLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<IAuditLogEntry[]>([]);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  // Doanh thu của ngày từ dữ liệu hệ thống (kèm hoá đơn cho tab bán hàng). Không có quyền → { masked: true }.
  const [revenue, setRevenue] = useState<IShiftCashRevenue | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  // Nút "Đối chiếu" ở khối Doanh thu → tăng để thẻ Đối chiếu doanh thu tự chạy.
  const [reconcileRequest, setReconcileRequest] = useState(0);
  const [tab, setTab] = useState(0);

  // Denomination editing
  const [denomQuantities, setDenomQuantities] = useState<Record<number, number>>({});
  const [savingDenom, setSavingDenom] = useState(false);
  const [denomEditing, setDenomEditing] = useState(false);
  const confirmFinalize = useBoolean();

  const [shareholders, setShareholders] = useState<IShareholder[]>([]);

  // Transaction form
  const [txMode, setTxMode] = useState<'add' | 'edit'>('add');
  const [txEditId, setTxEditId] = useState<string | null>(null);
  const [txType, setTxType] = useState<'Thu' | 'Chi'>('Thu');
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txShareholderId, setTxShareholderId] = useState('');
  const [txSaving, setTxSaving] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const todayDate = vnToday();

  const isToday = currentDate === todayDate;
  // Người giám sát Kiểm quầy (shift-cash.oversight.read — Admin, hoặc vai trò được cấp): chọn ngày cũ, xem nhật ký /
  // audit, xem theo tháng (Manager theo luật của Staff). Sửa ngày cũ / khoản của người khác cần thêm quyền sửa giám sát;
  // người chỉ được xem thì trang chỉ xem (họ vào không qua kiểm ca nên API sẽ chặn ghi).
  const canOversee = canOverseeShiftCash(user);
  const canManageOversight = canManageShiftCashOversight(user);
  const canViewRevenue = canViewShiftCashRevenue(user);
  const viewOnly = canOversee && !canManageOversight;
  // Gắn cổ đông: chỉ chủ cửa hàng (danh sách cổ đông chỉ Admin đọc được).
  const isOwner = getUserRoles(user).includes('Admin');
  const shareholdersOn = useFeatureEnabled(FEATURE.shareholders);

  // Link từ thông báo "Kiểm tra chênh lệch quầy": ?date=yyyy-MM-dd mở thẳng ngày đó (chỉ Admin được xem ngày
  // cũ; ngày tương lai / sai định dạng thì bỏ qua). Chỉ áp một lần cho mỗi giá trị trên URL.
  const searchParams = useSearchParams();
  const urlDate = searchParams.get('date');
  const appliedUrlDateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!canOversee || !urlDate || appliedUrlDateRef.current === urlDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(urlDate) || urlDate > todayDate) return;
    appliedUrlDateRef.current = urlDate;
    setCurrentDate(urlDate);
  }, [canOversee, urlDate, todayDate]);
  const canEdit = canManageOversight || (isToday && !viewOnly);
  const hasOpenedToday = (summary?.denominations ?? []).length > 0;

  // ========== Tour hướng dẫn ==========
  const {
    startTour,
    startNextPending,
    resetAndRestartAll,
    completedMap,
    allCompleted,
    tours: tourList,
  } = usePageTours({ tours: SHIFT_CASH_TOURS });
  const [tourMenuAnchor, setTourMenuAnchor] = useState<null | HTMLElement>(null);

  // 403 ShiftCash.* từ BE (không có ca / ngoài cửa hàng / ngày cũ). Trả true nếu đã xử lý.
  //  - Tải dữ liệu bị chặn → về màn chặn của cổng với đúng thông điệp BE.
  //  - Thao tác (lưu / chốt / xoá…) bị chặn vì vị trí → chỉ báo lỗi, giữ nguyên số đang nhập để bấm lại khi
  //    GPS ổn; hết ca / ngày cũ thì cũng về màn chặn.
  const handleDenied = useCallback(
    (err: unknown, kind: 'load' | 'action') => {
      const denial = shiftCashDenial(err);
      if (!denial) return false;
      if (kind === 'action' && isShiftCashLocationDenial(denial.code)) {
        enqueueSnackbar(denial.message, { variant: 'error' });
      } else {
        access.deny(denial.message);
      }
      return true;
    },
    [access, enqueueSnackbar]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Nhật ký chỉnh sửa / audit chỉ người giám sát xem (BE chặn với người khác).
      // Lỗi nhật ký không được làm hỏng cả trang.
      const [summaryData, logsData, auditLogsData] = await Promise.all([
        getShiftCashSummary(currentDate),
        canOversee
          ? getShiftCashLogs(currentDate).catch((err) => {
              console.error('Shift-cash logs error:', err);
              return [] as IShiftCashLog[];
            })
          : Promise.resolve([] as IShiftCashLog[]),
        canOversee
          ? getShiftCashAuditLogs(currentDate).catch((err) => {
              console.error('Shift-cash audit-logs error:', err);
              return [] as IAuditLogEntry[];
            })
          : Promise.resolve([] as IAuditLogEntry[]),
      ]);
      setSummary(summaryData);
      setLogs(logsData);
      setAuditLogs(auditLogsData);

      // Init denomination quantities
      const denomMap: Record<number, number> = {};
      DENOMINATIONS.forEach((d) => {
        const existing = summaryData.denominations.find((dd) => dd.denomination === d);
        denomMap[d] = existing?.quantity ?? 0;
      });
      setDenomQuantities(denomMap);

      // Doanh thu từ dữ liệu hệ thống (không chặn trang). BE tự che số với người không có quyền.
      setRevenueLoading(true);
      getShiftCashRevenue(currentDate, true)
        .then((data) => setRevenue(data))
        .catch((err) => {
          console.error('Shift-cash revenue error:', err);
          setRevenue(null);
          handleDenied(err, 'load');
        })
        .finally(() => setRevenueLoading(false));
    } catch (error) {
      console.error(error);
      if (handleDenied(error, 'load')) return;
      enqueueSnackbar('Không tải được dữ liệu', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentDate, canOversee, enqueueSnackbar, handleDenied]);

  useEffect(() => {
    // Đổi ngày → bỏ số doanh thu của ngày cũ ngay, không chờ lần tải mới.
    setRevenue(null);
    fetchData();
  }, [fetchData]);

  // Cổ đông (để gắn vào khoản thu chi) — GET /shareholders chỉ Admin: vai trò khác không gọi, khỏi 403 thừa.
  useEffect(() => {
    if (!isOwner || !shareholdersOn) return;
    getShareholders(true)
      .then((list) => setShareholders(list))
      .catch((err) => console.error('Shareholders error:', err));
  }, [isOwner, shareholdersOn]);

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
      if (handleDenied(error, 'action')) return;
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
      if (handleDenied(error, 'action')) return;
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
    setTxShareholderId('');
    txDialog.onTrue();
  };

  const handleOpenEditTx = (tx: IShiftCashTransaction) => {
    setTxMode('edit');
    setTxEditId(tx.id);
    setTxType(tx.type);
    setTxAmount(tx.amount.toString());
    setTxNote(tx.note || '');
    setTxShareholderId(tx.shareholderId || '');
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
          shareholderId: txShareholderId || null,
        });
        enqueueSnackbar('Đã thêm!');
      } else if (txEditId) {
        await updateShiftCashTransaction(txEditId, {
          amount: parseFloat(txAmount),
          note: txNote || undefined,
          shareholderId: txShareholderId || null,
        });
        enqueueSnackbar('Đã cập nhật!');
      }
      txDialog.onFalse();
      fetchData();
    } catch (error: any) {
      if (handleDenied(error, 'action')) return;
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
      if (handleDenied(error, 'action')) return;
      enqueueSnackbar('Xoá thất bại', { variant: 'error' });
    }
  };

  const handleOpenCounter = async () => {
    try {
      await openCounter(currentDate);
      enqueueSnackbar('Đã mở quầy!', { variant: 'success' });
      fetchData();
    } catch (error) {
      if (handleDenied(error, 'action')) return;
      enqueueSnackbar('Mở quầy thất bại', { variant: 'error' });
    }
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
          action={
            <>
              {canOversee && (
                <Button
                  component={RouterLink}
                  href={paths.dashboard.shiftCash.monthly}
                  variant="outlined"
                  startIcon={<Iconify icon="solar:calendar-bold" />}
                  sx={{ mr: 1 }}
                >
                  Xem theo tháng
                </Button>
              )}
              <Tooltip title="Hướng dẫn sử dụng">
                <IconButton onClick={(e) => setTourMenuAnchor(e.currentTarget)}>
                  <Iconify icon="solar:question-circle-bold" width={24} />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={tourMenuAnchor}
                open={Boolean(tourMenuAnchor)}
                onClose={() => setTourMenuAnchor(null)}
                slotProps={{ paper: { sx: { minWidth: 220 } } }}
              >
                {tourList.map((t) => (
                  <MenuItem
                    key={t.tourKey}
                    onClick={() => {
                      setTourMenuAnchor(null);
                      startTour(t.tourKey);
                    }}
                  >
                    <ListItemIcon>
                      <Iconify
                        icon={completedMap[t.tourKey] ? 'solar:check-circle-bold' : 'solar:play-circle-bold'}
                        width={20}
                        sx={{ color: completedMap[t.tourKey] ? 'success.main' : 'text.secondary' }}
                      />
                    </ListItemIcon>
                    <ListItemText primary={t.label} />
                  </MenuItem>
                ))}
                <Divider />
                <MenuItem
                  onClick={() => {
                    setTourMenuAnchor(null);
                    resetAndRestartAll();
                  }}
                >
                  <ListItemIcon>
                    <Iconify icon="solar:restart-bold" width={20} />
                  </ListItemIcon>
                  <ListItemText primary="Xem lại tất cả" />
                </MenuItem>
              </Menu>
            </>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {/* Date picker — chỉ người giám sát chọn được ngày cũ; Staff / Manager cố định ngày hôm nay */}
        <Card id="tour-date-picker" sx={{ mb: 3, p: 2.5 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            {canOversee ? (
              <AppDatePicker
                label="Ngày"
                value={currentDate}
                onChange={setCurrentDate}
                sx={{ width: 200 }}
              />
            ) : (
              <Chip
                icon={<Iconify icon="solar:calendar-date-bold" width={18} />}
                // Trang mở qua nửa đêm: ngày đang xem không còn là hôm nay (banner bên dưới nhắc bấm "Hôm nay")
                label={`${isToday ? 'Hôm nay' : 'Ngày'} · ${formatDateVN(currentDate)}`}
                color="primary"
                variant="soft"
              />
            )}
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
                // Staff / Manager qua ngày mới khi trang vẫn mở → kiểm lại ca + vị trí cho ngày mới
                onClick={() => (canOversee ? setCurrentDate(todayDate) : access.recheck())}
              >
                Hôm nay
              </Button>
            )}
            {!canOversee && (
              <Typography variant="caption" color="text.secondary">
                Chỉ kiểm quầy được ngày hôm nay khi đang có ca và có mặt tại cửa hàng.
              </Typography>
            )}
          </Stack>
        </Card>

        {!isToday && !canOversee && (
          <Card sx={{ mb: 2, p: 2, bgcolor: alpha(theme.palette.warning.main, 0.08), border: `1px solid ${alpha(theme.palette.warning.main, 0.24)}` }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Iconify icon="solar:lock-keyhole-bold" width={20} sx={{ color: 'warning.main' }} />
              <Typography variant="body2" color="warning.dark">
                Đã sang ngày mới. Bấm &quot;Hôm nay&quot; để kiểm quầy ngày {formatDateVN(todayDate)} — dữ liệu ngày cũ chỉ người giám sát Kiểm quầy xem / sửa.
              </Typography>
            </Stack>
          </Card>
        )}

        {/* Đối chiếu doanh thu (hệ thống ↔ ngân hàng ↔ KiotViet) — người được xem doanh thu (tự ẩn với người khác) */}
        <ShiftCashReconciliationPanel date={currentDate} runRequest={reconcileRequest} sx={{ mb: 3 }} />

        {/* Kiểm tra chênh lệch của ngày đang chọn — chỉ người giám sát (component tự ẩn với vai trò khác) */}
        <ShiftCashInvestigationPanel date={currentDate} summary={summary} sx={{ mb: 3 }} />

        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={3}>
            {/* Row 1: Denomination box + Summary box */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              {/* Denomination Box */}
              <Card id="tour-denomination-box" sx={{ flex: 1, p: 3 }}>
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
                  <Stack id="tour-finalize-area" direction="row" spacing={1}>
                    {!hasOpenedToday ? (
                      <Tooltip title={!canEdit ? 'Chỉ người giám sát Kiểm quầy mới sửa được ngày cũ' : ''}>
                        <span>
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            startIcon={<Iconify icon="solar:shop-bold" />}
                            onClick={handleOpenCounter}
                            disabled={!canEdit}
                          >
                            Mở Quầy
                          </Button>
                        </span>
                      </Tooltip>
                    ) : !denomEditing ? (
                      <Tooltip title={!canEdit ? 'Chỉ người giám sát Kiểm quầy mới sửa được ngày cũ' : ''}>
                        <span>
                          <Button
                            variant="contained"
                            color="warning"
                            size="small"
                            startIcon={<Iconify icon="solar:lock-keyhole-unlocked-bold" />}
                            onClick={() => setDenomEditing(true)}
                            disabled={!canEdit}
                          >
                            Chốt tiền
                          </Button>
                        </span>
                      </Tooltip>
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
              <Card id="tour-summary-box" sx={{ flex: 1, p: 3 }}>
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
                    <Tooltip title="Tiền mặt thu từ hoá đơn trong ngày, đã trừ tiền mặt trả lại khách">
                      <Typography variant="body2" color="text.secondary">+ Tiền mặt bán hàng</Typography>
                    </Tooltip>
                    <Typography variant="body2">{formatCurrency(summary?.totalCashFromKiot || 0)}</Typography>
                  </Stack>
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
                      <Typography variant="subtitle2">= Tồn cuối</Typography>
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
                    id="tour-difference-box"
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

                  <ShiftCashRevenueBlock
                    revenue={revenue}
                    loading={revenueLoading}
                    onReconcile={canViewRevenue ? () => setReconcileRequest((n) => n + 1) : undefined}
                  />

                  {summary?.finalizations && summary.finalizations.length > 0 && (
                    <Stack spacing={1} style={{ maxHeight: 220, overflowY: 'auto' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Lịch sử chốt ({summary.finalizations.length} lần)
                      </Typography>
                      {summary.finalizations.map((f, idx) => {
                        const diff = f.closingBalance - f.openingBalance;
                        const totalDiff = f.difference ?? 0;
                        const isFirst = idx === 0;
                        return (
                          <Box
                            key={f.id}
                            sx={{
                              p: 1.5,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.success.main, isFirst ? 0.08 : 0.04),
                              border: `1px solid ${alpha(theme.palette.success.main, isFirst ? 0.24 : 0.12)}`,
                            }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                              <Iconify
                                icon="solar:check-circle-bold"
                                width={18}
                                sx={{ color: isFirst ? 'success.main' : 'text.disabled' }}
                              />
                              <Typography variant="caption" color={isFirst ? 'success.main' : 'text.secondary'}>
                                {isFirst ? 'Lần chốt cuối: ' : ''}
                                {f.finalizedAt
                                  ? new Date(f.finalizedAt).toLocaleString('vi-VN', {
                                      hour: '2-digit', minute: '2-digit',
                                      day: '2-digit', month: '2-digit',
                                    })
                                  : ''}
                                {f.finalizedByName && ` bởi ${f.finalizedByName}`}
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} sx={{ pl: 3.5 }}>
                              <Stack flex={1} alignItems="center">
                                <Typography variant="caption" color="text.disabled">Trước chốt</Typography>
                                <Typography variant="caption" fontWeight={500}>{formatCurrency(f.openingBalance)}</Typography>
                              </Stack>
                              <Iconify icon="solar:arrow-right-bold" width={14} sx={{ color: 'text.disabled', mt: 1.5 }} />
                              <Stack flex={1} alignItems="center">
                                <Typography variant="caption" color="text.disabled">Sau chốt</Typography>
                                <Typography variant="caption" fontWeight={700} color={isFirst ? 'primary.main' : 'text.secondary'}>
                                  {formatCurrency(f.closingBalance)}
                                </Typography>
                              </Stack>
                              <Stack flex={1} alignItems="center">
                                <Typography variant="caption" color="text.disabled">Chênh tiền mặt</Typography>
                                <Typography
                                  variant="caption"
                                  fontWeight={600}
                                  color={diff >= 0 ? 'success.main' : 'error.main'}
                                >
                                  {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                                </Typography>
                              </Stack>
                            </Stack>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{
                                pl: 3.5,
                                mt: 0.75,
                                pt: 0.75,
                                borderTop: `1px dashed ${alpha(theme.palette.divider, 0.6)}`,
                              }}
                            >
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <Iconify
                                  icon={
                                    totalDiff === 0
                                      ? 'solar:check-circle-bold'
                                      : 'solar:danger-triangle-bold'
                                  }
                                  width={14}
                                  sx={{ color: totalDiff === 0 ? 'success.main' : 'warning.main' }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  Chênh tiền tổng
                                </Typography>
                              </Stack>
                              <Typography
                                variant="caption"
                                fontWeight={700}
                                color={
                                  totalDiff === 0
                                    ? 'success.main'
                                    : totalDiff > 0
                                      ? 'warning.main'
                                      : 'error.main'
                                }
                              >
                                {totalDiff === 0
                                  ? 'Khớp'
                                  : `${totalDiff > 0 ? '+' : ''}${formatCurrency(totalDiff)} (${totalDiff > 0 ? 'thừa' : 'thiếu'})`}
                              </Typography>
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </Stack>
              </Card>
            </Stack>

            {/* Row 2: Tabs - Transactions / KiotViet / Logs */}
            <Card id="tour-tabs-section">
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
                      <span>Hoá đơn bán hàng</span>
                    </Stack>
                  }
                />
                {/* Nhật ký chỉnh sửa (ai sửa gì, toạ độ GPS) — chỉ người giám sát */}
                {canOversee && (
                  <Tab
                    label={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Iconify icon="solar:document-text-bold-duotone" width={20} />
                        <span>Nhật ký chỉnh sửa</span>
                        {auditLogs.length > 0 && (
                          <Chip label={auditLogs.length} size="small" variant="outlined" />
                        )}
                      </Stack>
                    }
                  />
                )}
              </Tabs>

              <Box sx={{ p: 2.5 }}>
                {/* Tab 0: Thu chi quầy */}
                {tab === 0 && (
                  <>
                    <Stack id="tour-add-tx-buttons" direction="row" spacing={1} sx={{ mb: 2 }}>
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<Iconify icon="mingcute:add-line" />}
                        onClick={() => handleOpenAddTx('Thu')}
                        disabled={!canEdit}
                      >
                        Thêm thu
                      </Button>
                      <Button
                        variant="contained"
                        color="error"
                        size="small"
                        startIcon={<Iconify icon="mingcute:add-line" />}
                        onClick={() => handleOpenAddTx('Chi')}
                        disabled={!canEdit}
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
                              {shareholdersOn && <TableCell>Cổ đông</TableCell>}
                              <TableCell>Người tạo</TableCell>
                              <TableCell>Thời gian</TableCell>
                              <TableCell align="right" />
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(!summary?.transactions || summary.transactions.length === 0) && (
                              <TableRow>
                                <TableCell colSpan={7} align="center">
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
                                {shareholdersOn && (
                                  <TableCell>
                                    {tx.shareholderName ? (
                                      <Label variant="soft" color="warning">
                                        {tx.shareholderName}
                                      </Label>
                                    ) : (
                                      '—'
                                    )}
                                  </TableCell>
                                )}
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
                                  {/* Khoản gắn cổ đông vào chốt sổ cổ đông — chỉ chủ cửa hàng sửa / xoá (Core-be
                                      Till.ShareholderOwnerOnly). */}
                                  {canEdit && (isOwner || !tx.shareholderId) && (
                                    <>
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
                                    </>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Scrollbar>
                  </>
                )}

                {/* Tab 1: Hoá đơn bán hàng (dữ liệu hệ thống) */}
                {tab === 1 && (
                  <ShiftCashSalesTab
                    date={currentDate}
                    revenue={revenue}
                    loading={revenueLoading}
                    onReload={fetchData}
                  />
                )}

                {/* Tab 2: Nhật ký chỉnh sửa (MongoDB audit logs) — chỉ người giám sát */}
                {tab === 2 && canOversee && (
                  <Scrollbar>
                    <TableContainer>
                      <Table size="small" sx={{ minWidth: 720 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: 32 }} />
                            <TableCell>Ai</TableCell>
                            <TableCell>Lúc nào</TableCell>
                            <TableCell>Thao tác</TableCell>
                            <TableCell>Chi tiết thay đổi</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {auditLogs.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} align="center">
                                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                  Chưa có nhật ký
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                          {auditLogs.map((entry) => {
                            const isExpanded = expandedAuditId === entry.id;
                            const actionMeta: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'primary' | 'default' }> = {
                              CREATE:              { label: 'Thêm thu/chi',      color: 'success' },
                              UPDATE:              { label: 'Sửa thu/chi',       color: 'warning' },
                              DELETE:              { label: 'Xóa thu/chi',       color: 'error'   },
                              FINALIZE_SHIFT:      { label: 'Chốt tiền ca',      color: 'primary' },
                              UPDATE_DENOMINATION: { label: 'Cập nhật mệnh giá', color: 'info'    },
                              OPEN_COUNTER:        { label: 'Mở quầy',           color: 'default' },
                            };
                            const meta = actionMeta[entry.actionType] ?? { label: entry.actionType, color: 'default' as const };
                            const timeVn = new Date(entry.timestamp).toLocaleString('vi-VN', {
                              hour: '2-digit', minute: '2-digit', second: '2-digit',
                              day: '2-digit', month: '2-digit',
                            });
                            const firstDelta = entry.delta[0];

                            const hasCash = entry.totalCashBefore != null || entry.totalCashAfter != null;
                            const cashDiff = hasCash && entry.totalCashAfter != null && entry.totalCashBefore != null
                              ? entry.totalCashAfter - entry.totalCashBefore
                              : null;

                            const canExpand = entry.delta.length > 0 || hasCash;

                            return (
                              <>
                                <TableRow
                                  key={entry.id}
                                  hover
                                  sx={{ cursor: canExpand ? 'pointer' : 'default' }}
                                  onClick={() =>
                                    canExpand ? setExpandedAuditId(isExpanded ? null : entry.id) : undefined
                                  }
                                >
                                  <TableCell sx={{ pr: 0 }}>
                                    {canExpand && (
                                      <IconButton size="small">
                                        <Iconify
                                          icon={isExpanded ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'}
                                          width={16}
                                        />
                                      </IconButton>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" fontWeight={600}>
                                      {entry.userName}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption" color="text.secondary">
                                      {timeVn}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Stack spacing={0.5}>
                                      <Chip
                                        label={meta.label}
                                        size="small"
                                        color={meta.color}
                                        variant="soft"
                                      />
                                      {hasCash && (
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                          <Iconify icon="solar:wallet-bold-duotone" width={12} sx={{ color: 'text.disabled' }} />
                                          <Typography variant="caption" color="text.disabled">
                                            {entry.totalCashBefore != null ? formatCurrency(entry.totalCashBefore) : '—'}
                                            {' → '}
                                            <Typography component="span" variant="caption" fontWeight={700} color="primary.main">
                                              {entry.totalCashAfter != null ? formatCurrency(entry.totalCashAfter) : '—'}
                                            </Typography>
                                            {cashDiff != null && (
                                              <Typography
                                                component="span"
                                                variant="caption"
                                                color={cashDiff >= 0 ? 'success.main' : 'error.main'}
                                                fontWeight={600}
                                              >
                                                {' '}({cashDiff >= 0 ? '+' : ''}{formatCurrency(cashDiff)})
                                              </Typography>
                                            )}
                                          </Typography>
                                        </Stack>
                                      )}
                                    </Stack>
                                  </TableCell>
                                  <TableCell>
                                    {firstDelta ? (
                                      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                                        <Typography variant="caption" color="text.secondary">
                                          {firstDelta.field}:
                                        </Typography>
                                        {firstDelta.oldValue && (
                                          <>
                                            <Typography variant="caption" color="error.main" sx={{ textDecoration: 'line-through' }}>
                                              {firstDelta.oldValue}
                                            </Typography>
                                            <Iconify icon="solar:arrow-right-bold" width={12} sx={{ color: 'text.disabled' }} />
                                          </>
                                        )}
                                        <Typography variant="caption" color="success.main" fontWeight={600}>
                                          {firstDelta.newValue ?? '—'}
                                        </Typography>
                                        {entry.delta.length > 1 && (
                                          <Typography variant="caption" color="text.disabled">
                                            +{entry.delta.length - 1} nữa
                                          </Typography>
                                        )}
                                      </Stack>
                                    ) : (
                                      <Typography variant="caption" color="text.disabled">—</Typography>
                                    )}
                                  </TableCell>
                                </TableRow>

                                {/* Expanded delta detail */}
                                {isExpanded && (
                                  <TableRow key={`${entry.id}-detail`}>
                                    <TableCell colSpan={5} sx={{ py: 0, bgcolor: 'background.neutral' }}>
                                      <Collapse in={isExpanded}>
                                        <Box sx={{ py: 1.5, px: 2 }}>
                                          {/* Total cash summary banner */}
                                          {hasCash && (
                                            <Box
                                              sx={{
                                                mb: 1.5,
                                                p: 1.5,
                                                borderRadius: 1,
                                                bgcolor: 'background.paper',
                                                border: '1px solid',
                                                borderColor: 'divider',
                                              }}
                                            >
                                              <Stack direction="row" spacing={3} alignItems="center" justifyContent="center">
                                                <Stack alignItems="center">
                                                  <Typography variant="caption" color="text.disabled">💰 Trước thao tác</Typography>
                                                  <Typography variant="body2" fontWeight={500}>
                                                    {entry.totalCashBefore != null ? formatCurrency(entry.totalCashBefore) : '—'}
                                                  </Typography>
                                                </Stack>
                                                <Iconify icon="solar:arrow-right-bold" width={20} sx={{ color: 'text.disabled' }} />
                                                <Stack alignItems="center">
                                                  <Typography variant="caption" color="text.disabled">💰 Sau thao tác</Typography>
                                                  <Typography variant="body2" fontWeight={700} color="primary.main">
                                                    {entry.totalCashAfter != null ? formatCurrency(entry.totalCashAfter) : '—'}
                                                  </Typography>
                                                </Stack>
                                                {cashDiff != null && (
                                                  <Stack alignItems="center">
                                                    <Typography variant="caption" color="text.disabled">Chênh lệch</Typography>
                                                    <Typography
                                                      variant="body2"
                                                      fontWeight={700}
                                                      color={cashDiff >= 0 ? 'success.main' : 'error.main'}
                                                    >
                                                      {cashDiff >= 0 ? '+' : ''}{formatCurrency(cashDiff)}
                                                    </Typography>
                                                  </Stack>
                                                )}
                                              </Stack>
                                            </Box>
                                          )}
                                          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                                            Chi tiết thay đổi ({entry.delta.length} trường)
                                          </Typography>
                                          <Table size="small">
                                            <TableHead>
                                              <TableRow>
                                                <TableCell sx={{ py: 0.5 }}>Trường</TableCell>
                                                <TableCell sx={{ py: 0.5 }} align="right">Cũ</TableCell>
                                                <TableCell sx={{ py: 0.5, width: 24 }} />
                                                <TableCell sx={{ py: 0.5 }} align="right">Mới</TableCell>
                                              </TableRow>
                                            </TableHead>
                                            <TableBody>
                                              {entry.delta.map((d, idx) => (
                                                <TableRow key={idx}>
                                                  <TableCell sx={{ py: 0.5 }}>
                                                    <Typography variant="caption">{d.field}</Typography>
                                                  </TableCell>
                                                  <TableCell align="right" sx={{ py: 0.5 }}>
                                                    <Typography variant="caption" color="error.main" sx={{ textDecoration: d.oldValue ? 'line-through' : 'none' }}>
                                                      {d.oldValue ?? '—'}
                                                    </Typography>
                                                  </TableCell>
                                                  <TableCell sx={{ py: 0.5 }}>
                                                    <Iconify icon="solar:arrow-right-bold" width={12} sx={{ color: 'text.disabled' }} />
                                                  </TableCell>
                                                  <TableCell align="right" sx={{ py: 0.5 }}>
                                                    <Typography variant="caption" color="success.main" fontWeight={600}>
                                                      {d.newValue ?? '—'}
                                                    </Typography>
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </Box>
                                      </Collapse>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            );
                          })}
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
              type="text"
              value={formatAmountInput(txAmount)}
              onChange={(e) => setTxAmount(parseAmountInput(e.target.value))}
              inputProps={{ inputMode: 'numeric' }}
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
            {/* Gắn cổ đông: chỉ chủ cửa hàng (danh sách cổ đông chỉ Admin đọc được). Vai trò khác sửa khoản đã
                gắn thì giữ nguyên cổ đông cũ — txShareholderId vẫn gửi lại như cũ. */}
            {isOwner && shareholdersOn && (
              <TextField
                select
                fullWidth
                label={txType === 'Thu' ? 'Thu từ cổ đông (nếu có)' : 'Chi cho cổ đông (nếu có)'}
                value={txShareholderId}
                onChange={(e) => setTxShareholderId(e.target.value)}
                helperText="Chỉ để đối chiếu với hoạch toán cổ đông, không tự động ghi sổ"
              >
                <MenuItem value="">— Không —</MenuItem>
                {shareholders.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
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
                  <Typography variant="body2" color="text.secondary">+ Tiền mặt bán hàng</Typography>
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
                    <Typography variant="subtitle2">= Tồn cuối</Typography>
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

    </>
  );
}
