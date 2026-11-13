'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ButtonBase from '@mui/material/ButtonBase';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { alpha, darken, lighten, useTheme, ThemeProvider, type Theme } from '@mui/material/styles';

import Iconify from 'src/components/iconify';
import { allowedPosMethods, usePosPaymentMethods } from 'src/components/payment-connection-select';
import { useSnackbar } from 'src/components/snackbar';
import { fCurrency } from 'src/utils/format-number';
import { qrTransactionRef } from 'src/utils/payment-status';
import { salesOrderCreatedMessage } from 'src/utils/kiotviet-sync-status';
import { useAuthContext } from 'src/auth/hooks';

import {
  IProduct,
  IProductListItem,
  IProductChild,
  ICustomer,
  IWarehouse,
  ICreateSalesOrderRequest,
  ISalesOrderReceipt,
} from 'src/types/corecms-api';
import { getAllProducts } from 'src/api/products';
import { getAllCustomers } from 'src/api/customers';
import { getAllWarehouses } from 'src/api/warehouses';
import { createSalesOrder, getAllSalesOrders, getSalesOrderReceipt } from 'src/api/sales-orders';

import ReceiptPrintDialog from 'src/sections/pos/receipt-print/receipt-print-dialog';

import PosDiscountPopover from '../pos-discount-popover';
import PosProductDetailDrawer from '../pos-product-detail-drawer';
import PosVariantPickerDrawer from '../pos-variant-picker-drawer';
import PosPaymentDrawer, { PaymentLine } from '../pos-payment-drawer';
import PosQrPayment from '../pos-qr-payment';
import PosQtyInput from '../pos-qty-input';
import { newId } from 'src/sections/fnb-pos/lib/ids';

import {
  clampOrderDiscount,
  findScannedProduct,
  isDefinitiveRejection,
  percentDiscount,
  quickCashAmounts,
  saleFingerprint,
  saleRequestFor,
  settlePayments,
  type PendingSaleRequest,
} from '../pos-sale-utils';
import { useWorkingBranch } from 'src/store/working-branch-store';
import { useStoreBrand } from 'src/components/branding';

import {
  isUnsent,
  posOutbox,
  describeSaleError,
  type OutboxEntry,
  type ProcessResult,
} from '../../offline/pos-outbox';
import { requestPersistentStorage } from '../../offline/pos-store';
import { registerPosServiceWorker } from '../../offline/register-pos-sw';
import {
  fetchCatalog,
  searchCatalog,
  saveCatalogSnapshot,
  loadCatalogSnapshot,
  type CatalogSnapshot,
} from '../../offline/pos-catalog';
import { useConnectivity, useOutboxEntries, useOutboxSender } from '../../offline/use-pos-outbox';
import { buildOfflineReceipt } from '../../offline/offline-receipt';
import OfflineTransferQr from '../../offline/offline-transfer-qr';
import { nextOfflineCode, noteWithOfflineCode } from '../../offline/pos-device';
import { loadPrintKit, refreshPrintKit, EMPTY_PRINT_KIT, type PrintKit } from '../../offline/pos-print-kit';
import { getPrintTemplates } from 'src/api/print-templates';
import { loadPosBankAccounts } from 'src/components/account-capability';
import {
  loadReceiptSettings,
  saveReceiptSettings,
  usableTransferAccounts,
} from 'src/sections/pos/receipt-print/receipt-settings';
import { PosManageMenu, PosSyncButton, PosRecentSalesButton } from '../pos-top-bar-actions';
import { useCustomerDisplaySync } from 'src/sections/customer-display/use-customer-display-sync';
import {
  customerDisplay,
  openCustomerDisplayWindow,
  type CustomerDisplayCart,
} from 'src/sections/customer-display/customer-display-bus';

// ======================================================================
// Types
// ======================================================================

interface CartItem {
  productId: string;
  productVariantId?: string;
  name: string;
  sku: string;
  attributes?: { attributeName: string; attributeValue: string }[];
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountAmount: number;
  imageUrl?: string;
  note: string;
  // Inventory info
  stockOnHand: number;
  stockOnOrder: number;
}

interface DraftOrder {
  id: number;
  label: string;
  customerId?: string;
  customerName?: string;
  items: CartItem[];
  note: string;
  discountAmount: number;
  /** Ô giảm giá hoá đơn đang nhập theo tiền hay %; % thì tiền giảm tính lại khi tổng tiền hàng đổi. */
  discountMode?: 'amount' | 'percent';
  discountPercent?: number;
  couponCode: string;
  /** Mã chống trùng của lần gửi gần nhất (lưu cùng đơn tạm — tải lại trang vẫn gửi lại đúng mã). */
  pendingRequest?: PendingSaleRequest;
  /** Mã tạm (pos-device.ts) — cấp sớm khi hiện QR tĩnh (làm nội dung chuyển khoản), dùng lại nếu hoá đơn phải nằm chờ. */
  offlineCode?: string;
}

// ======================================================================
// Helpers
// ======================================================================

const POS_DRAFT_ORDERS_KEY = 'pos_draft_orders';

/** Số thẻ hàng tối đa vẽ ở lưới "Bán thường" (cả danh mục ~600 hàng — gõ để lọc). */
const GRID_LIMIT = 120;

/** Hiển thị giờ lưu danh mục: "16:05 12/11". */
function fDateTimeShort(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
      })}`;
}

/** Cột phụ của bảng giỏ hàng (STT, thao tác) ẩn trên điện thoại. */
const HIDE_ON_PHONE = { xs: 'none', sm: 'table-cell' };

/** Bề rộng chung của ô nhập bên cột phải (giảm giá, coupon) — các ô thẳng hàng. */
const DISCOUNT_FIELD_WIDTH = 120;

interface DraftOrdersCache {
  orders: DraftOrder[];
  orderCounter: number;
  selectedWarehouseId?: string;
}

function saveDraftsToStorage(orders: DraftOrder[], counter: number, warehouseId?: string) {
  try {
    const cache: DraftOrdersCache = { orders, orderCounter: counter, selectedWarehouseId: warehouseId };
    localStorage.setItem(POS_DRAFT_ORDERS_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to save draft orders to localStorage', e);
  }
}

function loadDraftsFromStorage(): DraftOrdersCache | null {
  try {
    const raw = localStorage.getItem(POS_DRAFT_ORDERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftOrdersCache;
    if (!parsed.orders || !Array.isArray(parsed.orders)) return null;
    return parsed;
  } catch (e) {
    console.error('Failed to load draft orders from localStorage', e);
    return null;
  }
}

function clearDraftsFromStorage() {
  try {
    localStorage.removeItem(POS_DRAFT_ORDERS_KEY);
  } catch (e) {
    console.error('Failed to clear draft orders from localStorage', e);
  }
}

function relabelOrders(orders: DraftOrder[]): DraftOrder[] {
  return orders.map((o, idx) => ({ ...o, label: `Hóa đơn ${idx + 1}` }));
}

function createEmptyOrder(id: number): DraftOrder {
  return {
    id,
    label: `Hóa đơn ${id}`,
    items: [],
    note: '',
    discountAmount: 0,
    couponCode: '',
  };
}

const POS_SALE_METHODS = [
  { value: 'Cash', label: 'Tiền mặt', icon: 'solar:wallet-money-bold' },
  { value: 'BankTransfer', label: 'Chuyển khoản', icon: 'solar:card-transfer-bold' },
  { value: 'Card', label: 'Thẻ', icon: 'solar:card-bold' },
  { value: 'EWallet', label: 'Ví', icon: 'solar:smartphone-bold' },
];

// ======================================================================
// Main Component
// ======================================================================

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Màu chính của theme đổi thành màu cửa hàng — mọi nút / ô chọn / tab của màn bán hàng cùng một tông. */
function brandTheme(outer: Theme, brand: string): Theme {
  const primary = {
    ...outer.palette.primary,
    lighter: lighten(brand, 0.8),
    light: lighten(brand, 0.3),
    main: brand,
    dark: darken(brand, 0.25),
    darker: darken(brand, 0.5),
    contrastText: outer.palette.getContrastText(brand),
  };
  return { ...outer, palette: { ...outer.palette, primary } };
}

/**
 * Màn bán hàng theo màu cửa hàng (Cài đặt cửa hàng → Thương hiệu → màu chính). Chưa đặt / sai định dạng thì giữ màu
 * chính của giao diện.
 */
export default function PosSaleView() {
  const { primaryColor } = useStoreBrand();
  const brand = primaryColor && HEX_COLOR.test(primaryColor) ? primaryColor : null;
  if (!brand) return <PosSaleScreen />;
  return (
    <ThemeProvider theme={(outer: Theme) => brandTheme(outer, brand)}>
      <PosSaleScreen />
    </ThemeProvider>
  );
}

function PosSaleScreen() {
  const theme = useTheme();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { brandName } = useStoreBrand();
  const { user } = useAuthContext();
  const sellerName = user ? `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.email : 'Admin';

  // Thanh trên cùng theo màu chính — PosSaleView đã đặt màu chính = màu cửa hàng cho cả màn bán hàng.
  const barColor = theme.palette.primary.main;
  const barFg = theme.palette.primary.contrastText;

  // Trạng thái mạng (trình duyệt + gõ nhịp tới máy chủ) — báo "Mất mạng" trên thanh trên.
  const { online, browserOnline, report: reportReachable } = useConnectivity();

  // Hàng chờ hoá đơn trên máy (IndexedDB) — mọi lần bán đều ghi vào đây trước khi gửi.
  const outbox = posOutbox();

  // Bộ in lưu trên máy (thông tin cửa hàng, mẫu in, tài khoản nhận) — in phiếu tạm / QR tĩnh khi mất mạng.
  const [printKit, setPrintKit] = useState<PrintKit>(EMPTY_PRINT_KIT);
  const printKitRef = useRef(printKit);
  printKitRef.current = printKit;
  useEffect(() => {
    loadPrintKit().then(setPrintKit).catch(() => {});
  }, []);
  const refreshKit = useCallback(() => {
    refreshPrintKit({
      getPrintTemplates: () => getPrintTemplates('receipt'),
      latestReceipt: async () => {
        const latest = (await getAllSalesOrders({ pageNumber: 1, pageSize: 1 })).items?.[0];
        return latest ? getSalesOrderReceipt(latest.id) : null;
      },
      bankAccounts: async () => usableTransferAccounts((await loadPosBankAccounts()).accounts),
    })
      .then(setPrintKit)
      .catch(() => {});
  }, []);

  // In: hoá đơn trên máy chủ (printOrderId) hoặc phiếu tạm dựng tại máy (localReceipt); "Tự in sau khi bán" nhớ theo máy.
  const [printOrderId, setPrintOrderId] = useState<string | null>(null);
  const [localReceipt, setLocalReceipt] = useState<ISalesOrderReceipt | null>(null);
  const [printAuto, setPrintAuto] = useState(false);
  const [autoPrint, setAutoPrint] = useState(() => loadReceiptSettings().autoPrint);
  const handleToggleAutoPrint = useCallback((value: boolean) => {
    setAutoPrint(value);
    saveReceiptSettings({ ...loadReceiptSettings(), autoPrint: value });
  }, []);
  const outboxEntries = useOutboxEntries(outbox);
  const [outboxDurable, setOutboxDurable] = useState(true);
  // Phiên offline (mở màn lúc mất mạng, chưa đăng nhập lại — auth/context/jwt/offline-session.ts): chưa gửi hàng chờ.
  const offlineSession = !!(user as any)?.offlineSession;

  useEffect(() => {
    requestPersistentStorage();
    registerPosServiceWorker();
    outbox.prune().catch(() => {});
    outbox
      .durable()
      .then(setOutboxDurable)
      .catch(() => setOutboxDurable(false));
  }, [outbox]);

  // Restore dialog
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [cachedData, setCachedData] = useState<DraftOrdersCache | null>(null);
  // Chưa quyết định khôi phục đơn tạm → KHÔNG ghi / xoá bộ nhớ: trước đây lúc mở màn (giỏ trống) hiệu ứng đồng bộ xoá
  // ngay đơn tạm đã lưu trong khi hộp "Khôi phục" còn đang hỏi — tải lại trang / mất điện lần nữa là mất đơn.
  const [draftsHydrated, setDraftsHydrated] = useState(false);

  // Data
  const [products, setProducts] = useState<IProductListItem[]>([]);
  const [customers, setCustomers] = useState<ICustomer[]>([]);
  const [warehouses, setWarehouses] = useState<IWarehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<IWarehouse | null>(null);

  // Draft orders (tabs). Bộ đếm id theo từng lần mở màn hình — trước đây là biến cấp module và đơn đầu tạo lại mỗi lần
  // render: vào lại màn bán hàng (điều hướng trong app) thì đơn đầu có id ≠ activeOrderId → bấm sản phẩm không vào đơn.
  const orderCounterRef = useRef(2);
  const [orders, setOrders] = useState<DraftOrder[]>(() => [createEmptyOrder(1)]);
  const [activeOrderId, setActiveOrderId] = useState<number>(1);
  const nextEmptyOrder = useCallback(() => {
    const order = createEmptyOrder(orderCounterRef.current);
    orderCounterRef.current += 1;
    return order;
  }, []);

  // Search
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<IProductListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lượt tìm mới nhất — bỏ kết quả về muộn của từ khoá cũ (gõ nhanh / quét mã).
  const searchSeqRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Right sidebar tab: 0 = Bán nhanh, 1 = Bán thường
  const [rightTab, setRightTab] = useState(0);

  // Payment drawer (for "Bán thường" tab)
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);

  // Product detail drawer
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailProductId, setDetailProductId] = useState('');

  // Variant picker drawer
  const [variantDrawerOpen, setVariantDrawerOpen] = useState(false);
  const [variantPickerProduct, setVariantPickerProduct] = useState<IProductListItem | null>(null);

  // Discount popover
  const [discountAnchorEl, setDiscountAnchorEl] = useState<HTMLElement | null>(null);
  const [discountItemId, setDiscountItemId] = useState<string>('');

  // Quick sale payment state
  const [quickSelectedMethods, setQuickSelectedMethods] = useState<string[]>(['Cash']);
  // Phương thức chủ cửa hàng bật cho quầy (Thanh toán → Cài đặt → Phương thức theo kênh); chọn sẵn phương thức đầu tiên.
  const posMethods = allowedPosMethods(POS_SALE_METHODS, usePosPaymentMethods());
  const firstPosMethod = posMethods[0]?.value ?? 'Cash';
  useEffect(() => {
    setQuickSelectedMethods((current) =>
      current.every((m) => posMethods.some((p) => p.value === m)) ? current : [firstPosMethod]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstPosMethod, posMethods.length]);
  const [quickMethodAmounts, setQuickMethodAmounts] = useState<Record<string, number>>({});
  const [quickMethodRefs, setQuickMethodRefs] = useState<Record<string, string>>({});
  // Thu ngân đã tự nhập tiền khách đưa → không tự ghi đè bằng số cần trả khi đổi giảm giá / số lượng nữa.
  const [quickPaymentTouched, setQuickPaymentTouched] = useState(false);
  const quickPaymentOrderRef = useRef<number | null>(null);
  const [quickPaymentLoading, setQuickPaymentLoading] = useState(false);
  const [quickQrPaymentCompleted, setQuickQrPaymentCompleted] = useState(false);

  // In hoá đơn: hoá đơn vừa bán gần nhất (nút máy in trên thanh trên cùng)
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

  /** In phiếu tạm của hoá đơn chưa lên hệ thống (dựng tại máy). */
  const openLocalReceipt = useCallback(
    (sale: OutboxEntry, auto = false) => {
      setLocalReceipt(
        buildOfflineReceipt(sale, { kit: printKitRef.current, fallbackStoreName: brandName, cashierName: sellerName })
      );
      setPrintOrderId(null);
      setPrintAuto(auto);
      setReceiptDialogOpen(true);
    },
    [brandName, sellerName]
  );

  // Current time
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Load cached draft orders from localStorage on mount
  useEffect(() => {
    const cached = loadDraftsFromStorage();
    if (cached && cached.orders.length > 0) {
      const hasItems = cached.orders.some((o) => o.items.length > 0);
      if (hasItems) {
        setCachedData(cached);
        setRestoreDialogOpen(true);
        return;
      }
    }
    setDraftsHydrated(true);
  }, []);

  // Handle restore/discard cached orders
  const handleRestoreDrafts = useCallback(() => {
    if (cachedData) {
      const maxId = Math.max(0, ...cachedData.orders.map((o) => o.id));
      orderCounterRef.current = Math.max(cachedData.orderCounter || 0, maxId + 1);
      const restored = relabelOrders(cachedData.orders);
      setOrders(restored);
      setActiveOrderId(restored[0].id);
      enqueueSnackbar(`Đã khôi phục ${restored.length} đơn hàng tạm`, { variant: 'info' });
    }
    setRestoreDialogOpen(false);
    setDraftsHydrated(true);
  }, [cachedData, enqueueSnackbar]);

  const handleDiscardDrafts = useCallback(() => {
    clearDraftsFromStorage();
    setRestoreDialogOpen(false);
    setDraftsHydrated(true);
  }, []);

  // Sync orders to localStorage whenever orders change (chỉ sau khi đã khôi phục / bỏ đơn tạm cũ)
  useEffect(() => {
    if (!draftsHydrated) return;
    const hasItems = orders.some((o) => o.items.length > 0);
    if (hasItems) {
      saveDraftsToStorage(orders, orderCounterRef.current, selectedWarehouse?.id);
    } else {
      clearDraftsFromStorage();
    }
  }, [orders, selectedWarehouse?.id, draftsHydrated]);

  // Danh mục (hàng + khách + kho): hiện ngay bản lưu trên máy (mất mạng vẫn bán được), rồi tải bản mới từ máy chủ
  // (đủ mọi trang — trước đây chỉ 25 hàng đầu) và lưu lại. Tìm hàng / quét mã làm tại máy khi đã có danh mục đầy đủ.
  const [catalogComplete, setCatalogComplete] = useState(false);
  const [catalogSyncedAt, setCatalogSyncedAt] = useState<string | null>(null);
  const catalogFromServerRef = useRef(false);

  const applyCatalog = useCallback((snap: CatalogSnapshot) => {
    setProducts(snap.products);
    setCustomers(snap.customers);
    setWarehouses(snap.warehouses);
    setCatalogComplete(snap.complete);
    setCatalogSyncedAt(snap.syncedAt);
    // Chưa chọn kho / kho đang chọn không còn: kho của đơn tạm đã lưu → kho đang hoạt động → kho đầu.
    setSelectedWarehouse((current) => {
      const w = snap.warehouses;
      if (current && w.some((wh) => wh.id === current.id)) return current;
      const cachedId = loadDraftsFromStorage()?.selectedWarehouseId;
      return (cachedId && w.find((wh) => wh.id === cachedId)) || w.find((wh) => wh.isActive) || w[0] || null;
    });
  }, []);

  /** Tải danh mục từ máy chủ; `manual` = bấm nút Tải lại (báo kết quả). */
  const refreshCatalog = useCallback(
    async (manual = false) => {
      try {
        const snap = await fetchCatalog({ getAllProducts, getAllCustomers, getAllWarehouses });
        catalogFromServerRef.current = true;
        applyCatalog(snap);
        saveCatalogSnapshot(snap);
        refreshKit();
        if (manual) {
          closeSnackbar();
          enqueueSnackbar(`Đã tải lại ${snap.products.length} mặt hàng và khách hàng`, { variant: 'success' });
        }
        return true;
      } catch (err) {
        console.error(err);
        return false;
      }
    },
    [applyCatalog, enqueueSnackbar, closeSnackbar, refreshKit]
  );

  useEffect(() => {
    let alive = true;
    const cached = loadCatalogSnapshot().then((snap) => {
      // Máy chủ trả trước thì không đè bằng bản cũ.
      if (alive && snap && !catalogFromServerRef.current) applyCatalog(snap);
      return snap;
    });
    refreshCatalog().then(async (ok) => {
      if (ok || !alive) return;
      const snap = await cached;
      if (snap) {
        enqueueSnackbar(
          `Không tải được danh mục mới — đang dùng danh mục lưu trên máy lúc ${fDateTimeShort(snap.syncedAt)}.`,
          { variant: 'warning' }
        );
      } else {
        // Chưa từng lưu danh mục trên máy này mà lại mất mạng → không có gì để bán.
        enqueueSnackbar('Không tải được hàng hoá / khách hàng / kho. Kiểm tra mạng rồi bấm nút Tải lại (↻).', {
          variant: 'error',
          persist: true,
        });
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Danh mục mới mỗi 10 phút khi có mạng (giá, tồn, hàng mới).
  useEffect(() => {
    if (!online) return undefined;
    const timer = setInterval(() => refreshCatalog(), 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [online, refreshCatalog]);

  // Tìm hàng: có danh mục đầy đủ thì tìm tại máy (tức thì, chạy cả khi mất mạng); chưa có thì hỏi máy chủ như trước.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!productSearch.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    if (catalogComplete) {
      searchSeqRef.current += 1;
      setSearchResults(searchCatalog(products, productSearch));
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchDebounceRef.current = setTimeout(() => {
      searchSeqRef.current += 1;
      const seq = searchSeqRef.current;
      getAllProducts({ keyword: productSearch, isActive: true })
        .then((r) => {
          if (seq !== searchSeqRef.current) return;
          setSearchResults(r.items);
          setProducts((prev) => {
            // Merge new results into existing products list
            const existingIds = new Set(prev.map((p) => p.id));
            const newItems = r.items.filter((p) => !existingIds.has(p.id));
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        })
        .catch((err) => {
          console.error(err);
          // Không hỏi được máy chủ: tìm trong những hàng đã có trên máy.
          if (seq === searchSeqRef.current) setSearchResults(searchCatalog(products, productSearch));
        })
        .finally(() => {
          if (seq === searchSeqRef.current) setSearchLoading(false);
        });
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSearch, catalogComplete]);

  // F3: ô tìm hàng hoá; F4: ô tìm khách hàng (cả hai đều ghi trên ô nhập)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        customerInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // ====== Derived state ======

  const activeOrder = useMemo(
    () => orders.find((o) => o.id === activeOrderId) || orders[0],
    [orders, activeOrderId]
  );

  const subTotal = useMemo(
    () =>
      activeOrder.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice - item.discountAmount,
        0
      ),
    [activeOrder.items]
  );

  const vatTotal = useMemo(
    () =>
      activeOrder.items.reduce((sum, item) => {
        const lineTotal = item.quantity * item.unitPrice - item.discountAmount;
        return sum + lineTotal * (item.vatRate / 100);
      }, 0),
    [activeOrder.items]
  );

  const grandTotal = subTotal + vatTotal - activeOrder.discountAmount;

  const totalItemCount = useMemo(
    () => activeOrder.items.reduce((s, i) => s + i.quantity, 0),
    [activeOrder.items]
  );

  // Màn hình khách (màn phụ hướng về khách): giỏ đang bán + quảng cáo của chi nhánh đang làm việc.
  const workingBranchId = useWorkingBranch((st) => st.branch?.id ?? null);
  const displayCart = useMemo<CustomerDisplayCart | null>(
    () =>
      activeOrder.items.length === 0
        ? null
        : {
            lines: activeOrder.items.map((item) => ({
              key: getItemKey(item),
              name: item.name,
              detail: item.attributes?.length
                ? item.attributes.map((a) => `${a.attributeName}: ${a.attributeValue}`).join(', ')
                : null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discountAmount,
              amount: item.quantity * item.unitPrice - item.discountAmount,
            })),
            itemCount: totalItemCount,
            subtotal: subTotal,
            vat: vatTotal,
            orderDiscount: activeOrder.discountAmount,
            total: grandTotal,
            customerName: activeOrder.customerName ?? null,
          },
    [activeOrder, totalItemCount, subTotal, vatTotal, grandTotal]
  );
  useCustomerDisplaySync(displayCart, workingBranchId);

  // Lưới "Bán thường": cả danh mục (tìm theo ô tìm hàng, không phân biệt dấu); vẽ tối đa GRID_LIMIT thẻ.
  const matchedProducts = useMemo(
    () => (productSearch.trim() ? searchCatalog(products, productSearch, products.length) : products),
    [products, productSearch]
  );
  const filteredProducts = useMemo(() => matchedProducts.slice(0, GRID_LIMIT), [matchedProducts]);

  // ====== Order handlers ======

  // Sửa đúng đơn đang hiện (activeOrder rơi về đơn đầu khi activeOrderId không còn khớp đơn nào).
  const activeId = activeOrder.id;
  const updateActiveOrder = useCallback(
    (updater: (order: DraftOrder) => DraftOrder) => {
      setOrders((prev) => prev.map((o) => (o.id === activeId ? updater(o) : o)));
    },
    [activeId]
  );

  // Tồn trên hệ thống chỉ để cảnh báo, KHÔNG chặn bán: CiCi để KiotViet giữ tồn (tồn ở đây là bản đồng bộ, có thể cũ),
  // máy chủ cũng cho bán âm. Trước đây hàng có thật trên kệ mà tồn hệ thống ≤ 0 thì không thêm vào giỏ được.
  // Chỉ báo lúc số lượng vừa vượt tồn (không báo lại mỗi lần bấm +).
  const warnOverStock = useCallback(
    (name: string, fromQty: number, toQty: number, stock: number) => {
      if (toQty > stock && fromQty <= stock) {
        enqueueSnackbar(
          stock > 0
            ? `${name}: bán vượt tồn trên hệ thống (Tồn: ${stock}) — kiểm tra hàng thực tế`
            : `${name}: hệ thống ghi hết hàng — vẫn bán được nếu có hàng thực tế`,
          { variant: 'warning' }
        );
      }
    },
    [enqueueSnackbar]
  );

  const handleAddProduct = useCallback(
    (product: IProductListItem) => {
      // Only open variant picker if product actually has child products/variants
      const hasVariants = (product.childProducts?.length || 0) > 0 || (product.variants?.length || 0) > 0;

      if (hasVariants) {
        setVariantPickerProduct(product);
        setVariantDrawerOpen(true);
        return;
      }

      const hasInventoryData = product.totalStock != null || (product.inventories && product.inventories.length > 0);
      const stock = hasInventoryData
        ? (product.totalStock ?? product.inventories?.reduce((s, inv) => s + (inv.onHand || 0), 0) ?? 0)
        : 999999; // No inventory tracking → allow unlimited
      const onOrder =
        product.inventories?.reduce((s, inv) => s + (inv.reserved || 0), 0) ?? 0;

      updateActiveOrder((order) => {
        const existingIdx = order.items.findIndex((item) => item.productId === product.id && !item.productVariantId);
        if (existingIdx >= 0) {
          const existing = order.items[existingIdx];
          warnOverStock(product.name, existing.quantity, existing.quantity + 1, stock);
          const newItems = [...order.items];
          newItems[existingIdx] = { ...existing, quantity: existing.quantity + 1 };
          return { ...order, items: newItems };
        }
        warnOverStock(product.name, 0, 1, stock);
        return {
          ...order,
          items: [
            {
              productId: product.id,
              name: product.name,
              sku: product.sku || product.code || '',
              quantity: 1,
              unitPrice: product.sellingPrice || product.basePrice,
              vatRate: product.vatRate || 0,
              discountAmount: 0,
              imageUrl: product.imageUrl,
              note: '',
              stockOnHand: stock,
              stockOnOrder: onOrder,
            },
            ...order.items,
          ],
        };
      });
    },
    [updateActiveOrder, warnOverStock]
  );

  const handleAddVariant = useCallback(
    (parent: IProductListItem, child: IProductChild) => {
      const stock =
        child.inventories?.reduce((s, inv) => s + (inv.onHand || 0), 0) ?? 0;
      const onOrder =
        child.inventories?.reduce((s, inv) => s + (inv.reserved || 0), 0) ?? 0;

      updateActiveOrder((order) => {
        const existingIdx = order.items.findIndex(
          (item) => item.productId === parent.id && item.productVariantId === child.id
        );
        if (existingIdx >= 0) {
          const existing = order.items[existingIdx];
          warnOverStock(child.name, existing.quantity, existing.quantity + 1, stock);
          const newItems = [...order.items];
          newItems[existingIdx] = { ...existing, quantity: existing.quantity + 1 };
          return { ...order, items: newItems };
        }
        warnOverStock(child.name, 0, 1, stock);
        return {
          ...order,
          items: [
            {
              productId: parent.id,
              productVariantId: child.id,
              name: child.name,
              sku: child.code || '',
              attributes: child.attributes?.map((a) => ({
                attributeName: a.attributeName,
                attributeValue: a.attributeValue,
              })),
              quantity: 1,
              unitPrice: child.basePrice,
              vatRate: 0,
              discountAmount: 0,
              note: '',
              stockOnHand: stock,
              stockOnOrder: onOrder,
            },
            ...order.items,
          ],
        };
      });
    },
    [updateActiveOrder, warnOverStock]
  );

  // Enter khi chưa có lựa chọn trong danh sách (máy quét mã vạch gõ mã + Enter nhanh hơn lượt tìm 300 ms, hoặc gõ đủ mã
  // rồi Enter): tra ngay; khớp đúng mã / mã vạch (kể cả của phiên bản) thì thêm luôn, nhiều kết quả thì để chọn.
  const handleScanCode = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchSeqRef.current += 1;
      const seq = searchSeqRef.current;
      setSearchLoading(true);
      try {
        // Danh mục đầy đủ trên máy → tra tại máy (quét mã khi mất mạng); không thì hỏi máy chủ, lỗi thì tra tại máy.
        const items = catalogComplete
          ? searchCatalog(products, code, 50)
          : await getAllProducts({ keyword: code, isActive: true })
              .then((r) => r.items)
              .catch(() => searchCatalog(products, code, 50));
        if (seq !== searchSeqRef.current) return;
        const r = { items };
        const hit = findScannedProduct(r.items, code);
        if (hit) {
          if (hit.child) handleAddVariant(hit.product, hit.child);
          else handleAddProduct(hit.product);
          setProductSearch('');
          setSearchResults([]);
        } else if (r.items.length === 0) {
          enqueueSnackbar(`Không tìm thấy sản phẩm "${code}"`, { variant: 'warning' });
        } else {
          setSearchResults(r.items);
        }
      } catch {
        if (seq === searchSeqRef.current) enqueueSnackbar('Không tìm được sản phẩm, thử lại', { variant: 'error' });
      } finally {
        if (seq === searchSeqRef.current) setSearchLoading(false);
      }
    },
    [handleAddProduct, handleAddVariant, enqueueSnackbar, catalogComplete, products]
  );

  const handleRefreshData = useCallback(() => {
    refreshCatalog(true).then((ok) => {
      if (!ok) {
        enqueueSnackbar(
          catalogSyncedAt
            ? `Không tải lại được — đang dùng danh mục lưu trên máy lúc ${fDateTimeShort(catalogSyncedAt)}.`
            : 'Không tải lại được dữ liệu',
          { variant: 'error' }
        );
      }
    });
  }, [refreshCatalog, enqueueSnackbar, catalogSyncedAt]);

  const handleUpdateQuantity = useCallback(
    (itemKey: string, newQuantity: number) => {
      updateActiveOrder((order) => {
        if (newQuantity <= 0) {
          return { ...order, items: order.items.filter((i) => getItemKey(i) !== itemKey) };
        }
        return {
          ...order,
          items: order.items.map((item) => {
            if (getItemKey(item) !== itemKey) return item;
            warnOverStock(item.name, item.quantity, newQuantity, item.stockOnHand);
            return { ...item, quantity: newQuantity };
          }),
        };
      });
    },
    [updateActiveOrder, warnOverStock]
  );

  const handleRemoveItem = useCallback(
    (itemKey: string) => {
      updateActiveOrder((order) => ({
        ...order,
        items: order.items.filter((i) => getItemKey(i) !== itemKey),
      }));
    },
    [updateActiveOrder]
  );

  const handleItemDiscount = useCallback(
    (discountAmount: number) => {
      if (!discountItemId) return;
      updateActiveOrder((order) => ({
        ...order,
        items: order.items.map((i) =>
          getItemKey(i) === discountItemId ? { ...i, discountAmount } : i
        ),
      }));
    },
    [discountItemId, updateActiveOrder]
  );

  const handleItemNote = useCallback(
    (itemKey: string, note: string) => {
      updateActiveOrder((order) => ({
        ...order,
        items: order.items.map((i) => (getItemKey(i) === itemKey ? { ...i, note } : i)),
      }));
    },
    [updateActiveOrder]
  );

  const handleSetCustomer = useCallback(
    (customer: ICustomer | null) => {
      updateActiveOrder((order) => ({
        ...order,
        customerId: customer?.id,
        customerName: customer?.name,
      }));
    },
    [updateActiveOrder]
  );

  // Giảm giá hoá đơn lưu theo TỪNG đơn tạm (trước đây ô giảm giá "Bán nhanh" là một ô chung: chuyển tab vẫn hiện số
  // của đơn kia, rời ô là áp nhầm sang đơn đang mở).
  const handleSetDiscount = useCallback(
    (discountAmount: number) => {
      updateActiveOrder((order) => ({
        ...order,
        discountMode: 'amount',
        discountPercent: undefined,
        discountAmount: clampOrderDiscount(discountAmount, orderSubTotal(order)),
      }));
    },
    [updateActiveOrder]
  );

  const handleSetDiscountPercent = useCallback(
    (percent: number) => {
      updateActiveOrder((order) => {
        const d = percentDiscount(percent, orderSubTotal(order));
        return { ...order, discountMode: 'percent', discountPercent: d.percent, discountAmount: d.amount };
      });
    },
    [updateActiveOrder]
  );

  const handleSetDiscountMode = useCallback(
    (mode: 'amount' | 'percent') => {
      updateActiveOrder((order) => {
        if ((order.discountMode ?? 'amount') === mode) return order;
        if (mode === 'amount') return { ...order, discountMode: 'amount', discountPercent: undefined };
        const sub = orderSubTotal(order);
        // Đổi sang %: giữ nguyên mức giảm đang có, quy ra % (2 chữ số lẻ).
        const percent = sub > 0 ? Math.round((order.discountAmount * 10000) / sub) / 100 : 0;
        return { ...order, discountMode: 'percent', discountPercent: percent };
      });
    },
    [updateActiveOrder]
  );

  const handleSetCoupon = useCallback(
    (couponCode: string) => {
      updateActiveOrder((order) => ({ ...order, couponCode }));
    },
    [updateActiveOrder]
  );

  const handleUpdateUnitPrice = useCallback(
    (itemKey: string, newPrice: number) => {
      updateActiveOrder((order) => ({
        ...order,
        items: order.items.map((i) =>
          getItemKey(i) === itemKey ? { ...i, unitPrice: newPrice } : i
        ),
      }));
    },
    [updateActiveOrder]
  );

  // ====== Tab handlers ======

  const handleAddTab = useCallback(() => {
    const newOrder = nextEmptyOrder();
    setOrders((prev) => relabelOrders([...prev, newOrder]));
    setActiveOrderId(newOrder.id);
  }, [nextEmptyOrder]);

  // Đóng tab đang có hàng thì hỏi lại (trước đây bấm nhầm dấu × là mất cả giỏ).
  const [closeTabId, setCloseTabId] = useState<number | null>(null);

  const handleCloseTab = useCallback(
    (orderId: number) => {
      setOrders((prev) => {
        if (prev.length <= 1) return prev;
        const newOrders = relabelOrders(prev.filter((o) => o.id !== orderId));
        if (activeOrderId === orderId) {
          setActiveOrderId(newOrders[newOrders.length - 1].id);
        }
        return newOrders;
      });
    },
    [activeOrderId]
  );

  // ====== Payment ======

  const handleOpenPayment = useCallback(() => {
    if (activeOrder.items.length === 0) {
      enqueueSnackbar('Chưa có sản phẩm trong đơn hàng', { variant: 'warning' });
      return;
    }
    if (!selectedWarehouse) {
      enqueueSnackbar('Chưa chọn chi nhánh/kho', { variant: 'warning' });
      return;
    }
    setPaymentDrawerOpen(true);
  }, [activeOrder.items, selectedWarehouse, enqueueSnackbar]);

  /** true = đã tạo hoá đơn; false = lỗi (đã báo) — giữ nguyên trạng thái thanh toán để thu ngân thử lại. */
  const handleConfirmPayment = useCallback(
    async (payments: PaymentLine[]): Promise<boolean> => {
      if (!selectedWarehouse) return false;

      const due = grandTotal > 0 ? grandTotal : 0;
      const soldId = activeOrder.id;
      // Khách đưa dư tiền mặt: khoản thu tiền mặt chỉ gồm phần phải trả, phần dư gửi ở cashTendered (tiền thối).
      const settled = settlePayments(due, payments);
      // Mã chống trùng: giỏ không đổi kể từ lần gửi trước (lỗi mạng / hết thời gian chờ) → gửi lại đúng mã đó, máy chủ
      // trả hoá đơn đã tạo thay vì tạo hoá đơn thứ hai. Ghi vào đơn tạm (localStorage) để tải lại trang vẫn còn.
      const request = saleRequestFor(
        activeOrder.pendingRequest,
        saleFingerprint({
          customerId: activeOrder.customerId,
          warehouseId: selectedWarehouse.id,
          discount: activeOrder.discountAmount,
          items: activeOrder.items.map((item) => ({
            productId: item.productId,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            price: item.unitPrice,
            discount: item.discountAmount,
          })),
        }),
        newId
      );
      if (request !== activeOrder.pendingRequest) {
        setOrders((prev) => prev.map((o) => (o.id === soldId ? { ...o, pendingRequest: request } : o)));
      }

      const payload: ICreateSalesOrderRequest = {
        clientRequestId: request.id,
        customerId: activeOrder.customerId || undefined,
        discount: activeOrder.discountAmount,
        totalPayment: due,
        method: settled.payments[0]?.method || payments[0]?.method || 'Cash',
        warehouseId: selectedWarehouse.id,
        note: activeOrder.note || undefined,
        couponCode: activeOrder.couponCode || undefined,
        soldByName: sellerName,
        invoiceDetails: activeOrder.items.map((item) => ({
          productId: item.productId,
          productVariantId: item.productVariantId || undefined,
          productCode: item.sku || undefined,
          productName: item.name,
          quantity: item.quantity,
          price: item.unitPrice,
          discount: item.discountAmount,
          note: item.note || undefined,
        })),
        payments: settled.payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          transactionRef: p.transactionRef || undefined,
        })),
        cashTendered: settled.cashTendered,
      };
      const soldAt = new Date().toISOString();

      // Bỏ đơn vừa bán (hoặc vừa chuyển vào hàng chờ); còn mỗi nó thì thay bằng đơn trống
      const releaseSoldOrder = () => {
        setPaymentDrawerOpen(false);
        customerDisplay.paid(due);
        const replacement = nextEmptyOrder();
        setOrders((prev) => {
          const remaining = prev.filter((o) => o.id !== soldId);
          const next = relabelOrders(remaining.length > 0 ? remaining : [replacement]);
          setActiveOrderId(next[next.length - 1].id);
          return next;
        });
      };

      // Ghi hoá đơn xuống máy TRƯỚC khi gửi (ghi bền): trình duyệt tắt / mất điện giữa lúc gửi thì mở lại màn bán hàng
      // vẫn gửi tiếp được, cùng mã chống trùng. Không ghi được (hết chỗ, trình duyệt chặn) thì vẫn gửi như trước.
      const entry: OutboxEntry = {
        id: request.id,
        payload,
        label: activeOrder.label,
        customerName: activeOrder.customerName,
        total: due,
        itemCount: totalItemCount,
        createdAt: soldAt,
        status: 'sending',
        attempts: 1,
        lastAttemptAt: soldAt,
        offlineCode: activeOrder.offlineCode,
      };
      let queued = true;
      try {
        await outbox.put(entry);
      } catch (err) {
        queued = false;
        console.error('Không ghi được hoá đơn vào hàng chờ trên máy', err);
      }

      try {
        const created = await createSalesOrder(payload);
        if (queued) {
          outbox
            .update(entry.id, { status: 'sent', serverId: created?.id, sentAt: new Date().toISOString() })
            .catch(console.error);
        }
        reportReachable(true);

        // Chỉ nhắc KiotViet khi hoá đơn được xếp hàng đẩy (Pending); NotPushed chỉ lưu trong hệ thống
        enqueueSnackbar(
          created?.replayed
            ? 'Hoá đơn này đã được tạo ở lần gửi trước — không tạo thêm'
            : salesOrderCreatedMessage(created?.kiotVietSyncStatus),
          { variant: created?.replayed ? 'info' : 'success' }
        );
        if (settled.change > 0) {
          enqueueSnackbar(`Tiền thừa trả khách: ${fCurrency(settled.change)}`, { variant: 'info' });
        }
        if (created?.id) {
          setLastSaleId(created.id);
          if (autoPrint) {
            setLocalReceipt(null);
            setPrintOrderId(created.id);
            setPrintAuto(true);
            setReceiptDialogOpen(true);
          }
        }
        releaseSoldOrder();

        return true;
      } catch (error: any) {
        if (isDefinitiveRejection(error)) {
          // Máy chủ từ chối → chắc chắn chưa có hoá đơn: bỏ khỏi hàng chờ + bỏ mã, giỏ giữ nguyên để thu ngân sửa.
          if (queued) outbox.remove(entry.id).catch(console.error);
          setOrders((prev) => prev.map((o) => (o.id === soldId ? { ...o, pendingRequest: undefined } : o)));
          enqueueSnackbar(error?.title || error?.message || 'Có lỗi xảy ra khi thanh toán', { variant: 'error' });
          return false;
        }
        if (!queued) {
          // Không lưu được trên máy → không thể hứa gửi sau: giữ giỏ để thu ngân thử lại.
          enqueueSnackbar(
            'Mất mạng và máy này không lưu được hoá đơn. Giữ nguyên giỏ — bấm thanh toán lại khi có mạng (không tạo trùng).',
            { variant: 'error', autoHideDuration: 10000 }
          );
          return false;
        }
        // Mất mạng / hết thời gian chờ / lỗi máy chủ: khách đã trả tiền — hoá đơn nằm trong hàng chờ (cùng mã chống
        // trùng, giờ bán = bây giờ), bán tiếp; bộ gửi thử lại ngay rồi lùi dần, máy chủ đã lưu thì không tạo trùng.
        reportReachable(false);
        // Mã tạm in trên phiếu + ghi vào ghi chú hoá đơn (tra lại ở Đơn bán hàng sau khi có mã chính thức).
        const offlineCode = entry.offlineCode ?? nextOfflineCode();
        const queuedEntry =
          (await outbox
            .update(entry.id, {
              status: 'pending',
              lastError: describeSaleError(error),
              nextAttemptAt: undefined,
              offlineCode,
              payload: { ...payload, note: noteWithOfflineCode(payload.note, offlineCode) },
            })
            .catch((err) => {
              console.error(err);
              return undefined;
            })) ?? { ...entry, status: 'pending' as const, offlineCode };
        enqueueSnackbar(
          `Mất mạng — đã lưu hoá đơn trên máy (mã tạm ${offlineCode}), sẽ tự đồng bộ khi có mạng (nút "Chờ đồng bộ" trên thanh trên cùng).`,
          {
            variant: 'warning',
            autoHideDuration: 10000,
            action: (key) => (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  closeSnackbar(key);
                  openLocalReceipt(queuedEntry);
                }}
              >
                In phiếu tạm
              </Button>
            ),
          }
        );
        if (autoPrint) openLocalReceipt(queuedEntry, true);
        releaseSoldOrder();
        return true;
      }
    },
    [
      activeOrder,
      grandTotal,
      totalItemCount,
      nextEmptyOrder,
      selectedWarehouse,
      sellerName,
      enqueueSnackbar,
      outbox,
      reportReachable,
      autoPrint,
      openLocalReceipt,
      closeSnackbar,
    ]
  );

  // ====== Hoá đơn chờ đồng bộ (bán lúc mất mạng) ======
  const unsentSales = useMemo(() => outboxEntries.filter(isUnsent), [outboxEntries]);
  const deviceSentSales = useMemo(
    () => outboxEntries.filter((e) => e.status === 'sent' && e.serverId).reverse(),
    [outboxEntries]
  );

  const handleSyncResult = useCallback(
    (result: ProcessResult, manual: boolean) => {
      if (result.sent.length > 0) {
        reportReachable(true);
        const last = result.sent[result.sent.length - 1];
        if (last.serverId) setLastSaleId(last.serverId);
        enqueueSnackbar(`Đã đồng bộ ${result.sent.length} hoá đơn bán lúc mất mạng`, { variant: 'success' });
      }
      if (result.failed.length > 0) {
        enqueueSnackbar(
          `${result.failed.length} hoá đơn bị máy chủ từ chối — mở nút trên thanh trên cùng để xử lý`,
          { variant: 'error' }
        );
      }
      if (result.networkDown) {
        reportReachable(false);
        if (manual) {
          enqueueSnackbar('Chưa gửi được — vẫn chưa có mạng. Hệ thống sẽ tự thử lại.', { variant: 'warning' });
        }
      }
    },
    [reportReachable, enqueueSnackbar]
  );

  const { syncing, syncNow } = useOutboxSender({
    outbox,
    entries: outboxEntries,
    // Chưa đăng nhập lại (phiên offline) thì chưa gửi — máy chủ sẽ trả 401; đăng nhập lại xong tự gửi.
    browserOnline: browserOnline && !offlineSession,
    send: createSalesOrder,
    onResult: handleSyncResult,
  });

  /** Hoá đơn lỗi: gửi lại (vd quản lý đã sửa giá / khách) — vẫn cùng mã chống trùng. */
  const handleRetryOutboxSale = useCallback(
    async (sale: OutboxEntry) => {
      await outbox.update(sale.id, { status: 'pending', nextAttemptAt: undefined });
      syncNow();
    },
    [outbox, syncNow]
  );

  // Còn hoá đơn chưa gửi mà đóng / tải lại trang: trình duyệt hỏi lại (hoá đơn vẫn nằm trên máy, mở lại sẽ gửi tiếp).
  const unsentCount = unsentSales.length;
  useEffect(() => {
    if (unsentCount === 0) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [unsentCount]);

  /** Hoá đơn bị máy chủ từ chối: mở lại thành một đơn tạm để sửa rồi thanh toán lại (mã chống trùng mới). */
  const handleReopenPendingSale = useCallback(
    (sale: OutboxEntry) => {
      // Giá hiện hành của hàng (lỗi hay gặp nhất của hoá đơn offline là giá đã đổi trong lúc mất mạng).
      const currentPrice = (productId: string, variantId?: string): number | undefined => {
        const product = products.find((p) => p.id === productId);
        if (!product) return undefined;
        if (variantId) return product.childProducts?.find((c) => c.id === variantId)?.basePrice;
        return product.sellingPrice || product.basePrice;
      };
      const order: DraftOrder = {
        ...nextEmptyOrder(),
        customerId: sale.payload.customerId,
        customerName: sale.customerName,
        note: sale.payload.note ?? '',
        couponCode: sale.payload.couponCode ?? '',
        discountAmount: sale.payload.discount ?? 0,
        items: sale.payload.invoiceDetails.map((d) => ({
          productId: d.productId,
          productVariantId: d.productVariantId,
          name: d.productName ?? d.productCode ?? '',
          sku: d.productCode ?? '',
          quantity: d.quantity,
          unitPrice: currentPrice(d.productId, d.productVariantId) ?? d.price,
          vatRate: 0,
          discountAmount: d.discount ?? 0,
          note: d.note ?? '',
          // Không biết tồn lúc mở lại — không cảnh báo vượt tồn cho các dòng này.
          stockOnHand: Number.MAX_SAFE_INTEGER,
          stockOnOrder: 0,
        })),
      };
      setOrders((prev) => relabelOrders([...prev.filter((o) => o.items.length > 0), order]));
      setActiveOrderId(order.id);
      outbox.remove(sale.id).catch(console.error);
      enqueueSnackbar('Đã mở lại hoá đơn thành đơn tạm (theo giá hiện hành) — kiểm tra rồi thanh toán lại', {
        variant: 'info',
      });
    },
    [nextEmptyOrder, enqueueSnackbar, outbox, products]
  );

  // Nút máy in: chọn một hoá đơn gần đây để in lại (không tự in sau khi bán)
  const handlePrintSale = useCallback((salesOrderId: string) => {
    setLocalReceipt(null);
    setPrintOrderId(salesOrderId);
    setPrintAuto(false);
    setReceiptDialogOpen(true);
  }, []);

  // Quick sale payment
  const handleQuickPayment = useCallback(async () => {
    if (activeOrder.items.length === 0) {
      enqueueSnackbar('Chưa có sản phẩm trong đơn hàng', { variant: 'warning' });
      return;
    }
    if (!selectedWarehouse) {
      enqueueSnackbar('Chưa chọn chi nhánh/kho', { variant: 'warning' });
      return;
    }

    const payments: PaymentLine[] = quickSelectedMethods
      .filter((m) => (quickMethodAmounts[m] || 0) > 0)
      .map((m) => ({
        method: m,
        amount: quickMethodAmounts[m] || 0,
        transactionRef: quickMethodRefs[m] || undefined,
      }));

    const paidTotal = payments.reduce((s, p) => s + p.amount, 0);
    if (paidTotal < grandTotal) {
      enqueueSnackbar('Số tiền thanh toán không đủ', { variant: 'warning' });
      return;
    }

    setQuickPaymentLoading(true);
    try {
      // Lỗi tạo hoá đơn: giữ phương thức / số tiền / mã QR đã trả để thử lại, không reset.
      if (!(await handleConfirmPayment(payments))) return;
      // Reset quick payment state
      setQuickSelectedMethods([firstPosMethod]);
      setQuickMethodAmounts({});
      setQuickMethodRefs({});
      setQuickPaymentTouched(false);
      setQuickQrPaymentCompleted(false);
      setUseStaticQr(false);
    } finally {
      setQuickPaymentLoading(false);
    }
  }, [
    activeOrder.items,
    selectedWarehouse,
    quickSelectedMethods,
    quickMethodAmounts,
    quickMethodRefs,
    grandTotal,
    enqueueSnackbar,
    handleConfirmPayment,
    firstPosMethod,
  ]);

  // Giảm theo %: tổng tiền hàng đổi (thêm / bớt hàng) thì tính lại tiền giảm; giảm theo tiền thì không vượt tổng tiền hàng.
  useEffect(() => {
    const expected =
      activeOrder.discountMode === 'percent'
        ? percentDiscount(activeOrder.discountPercent ?? 0, subTotal).amount
        : clampOrderDiscount(activeOrder.discountAmount, subTotal);
    if (expected !== activeOrder.discountAmount) {
      updateActiveOrder((order) => ({ ...order, discountAmount: expected }));
    }
  }, [subTotal, activeOrder.discountMode, activeOrder.discountPercent, activeOrder.discountAmount, updateActiveOrder]);

  // Tự điền "Khách thanh toán" = số cần trả khi tổng đổi (cả khi giỏ về 0 — không giữ số tiền của giỏ cũ). Thu ngân đã
  // tự nhập tiền khách đưa thì giữ nguyên (trước đây đổi giảm giá là mất số khách đưa); sang đơn tạm khác thì điền lại.
  useEffect(() => {
    const due = grandTotal > 0 ? grandTotal : 0;
    const switchedOrder = quickPaymentOrderRef.current !== activeId;
    quickPaymentOrderRef.current = activeId;
    if (!switchedOrder && quickPaymentTouched) return;
    if (switchedOrder) setQuickPaymentTouched(false);
    if (quickSelectedMethods.length === 1) {
      setQuickMethodAmounts({ [quickSelectedMethods[0]]: due });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grandTotal, activeId]);

  // Quick payment — chọn duy nhất 1 phương thức
  const handleQuickSelectMethod = useCallback((method: string) => {
    setQuickSelectedMethods([method]);
    setQuickMethodAmounts({ [method]: grandTotal });
    setQuickMethodRefs({});
    setQuickPaymentTouched(false);
    setQuickQrPaymentCompleted(false);
  }, [grandTotal]);

  const quickDue = grandTotal > 0 ? grandTotal : 0;
  const quickMethod: string | undefined = quickSelectedMethods[0];

  // Chuyển khoản lúc mất mạng (hoặc QR qua máy chủ lỗi): QR tĩnh dựng tại máy, nội dung = mã tạm của đơn.
  const [useStaticQr, setUseStaticQr] = useState(false);
  const showStaticQr = quickMethod === 'BankTransfer' && (!online || useStaticQr);
  useEffect(() => {
    if (showStaticQr && !activeOrder.offlineCode) {
      const code = nextOfflineCode();
      updateActiveOrder((order) => (order.offlineCode ? order : { ...order, offlineCode: code }));
    }
  }, [showStaticQr, activeOrder.offlineCode, updateActiveOrder]);
  const quickPaid = quickSelectedMethods.reduce((sum, m) => sum + (quickMethodAmounts[m] || 0), 0);

  // Ô giảm giá hoá đơn dùng chung cho cả hai tab: chọn ₫ / % rồi nhập; số tiền giảm hiện ngay dưới.
  const renderOrderDiscount = () => {
    const percentMode = activeOrder.discountMode === 'percent';
    return (
      <Stack alignItems="flex-end" spacing={0.25}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <ToggleButtonGroup
            exclusive
            size="small"
            value={percentMode ? 'percent' : 'amount'}
            onChange={(_, mode) => mode && handleSetDiscountMode(mode)}
            aria-label="Giảm theo"
            sx={{ '& .MuiToggleButton-root': { px: 1, py: 0.25, minWidth: 34, fontWeight: 700 } }}
          >
            <ToggleButton value="amount" aria-label="Giảm theo tiền">
              ₫
            </ToggleButton>
            <ToggleButton value="percent" aria-label="Giảm theo %">
              %
            </ToggleButton>
          </ToggleButtonGroup>
          <TextField
            size="small"
            type="number"
            placeholder="0"
            value={percentMode ? activeOrder.discountPercent || '' : activeOrder.discountAmount || ''}
            onChange={(e) => {
              const val = Number(e.target.value) || 0;
              if (percentMode) handleSetDiscountPercent(val);
              else handleSetDiscount(val);
            }}
            sx={{ width: DISCOUNT_FIELD_WIDTH }}
            inputProps={{
              'aria-label': 'Giảm giá hoá đơn',
              min: 0,
              max: percentMode ? 100 : undefined,
              style: { textAlign: 'right' },
            }}
          />
        </Stack>
        {activeOrder.discountAmount > 0 && (
          <Typography variant="caption" color="error.main">
            −{fCurrency(activeOrder.discountAmount)}
          </Typography>
        )}
      </Stack>
    );
  };

  // ====== Render ======

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        // Trên header / thanh điều hướng của dashboard (appBar + 1) nhưng DƯỚI ngăn kéo (drawer) và hộp thoại — trước đây
        // là drawer + 2 nên ngăn chọn phiên bản, chi tiết sản phẩm, thanh toán "Bán thường" mở mà bị che.
        zIndex: theme.zIndex.appBar + 2,
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ========== Restore Draft Orders Dialog ========== */}
      {/* Xoá dữ liệu đơn tạm cũ khi hộp đã đóng hẳn — xoá ngay thì lúc mờ dần chữ nhảy thành "0 đơn". */}
      <Dialog
        open={restoreDialogOpen}
        maxWidth="xs"
        fullWidth
        TransitionProps={{ onExited: () => setCachedData(null) }}
      >
        <DialogTitle>Khôi phục đơn hàng tạm</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Phát hiện {cachedData?.orders.length || 0} đơn hàng tạm chưa thanh toán.
            Bạn có muốn khôi phục lại không?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDiscardDrafts} color="inherit">
            Bỏ qua
          </Button>
          <Button onClick={handleRestoreDrafts} variant="contained">
            Khôi phục
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========== Xác nhận đóng tab có hàng ========== */}
      <Dialog open={closeTabId !== null} onClose={() => setCloseTabId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Đóng hoá đơn tạm?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {(() => {
              const order = orders.find((o) => o.id === closeTabId);
              return order
                ? `${order.label} đang có ${order.items.length} mặt hàng chưa thanh toán. Đóng sẽ bỏ cả giỏ này.`
                : '';
            })()}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseTabId(null)} color="inherit">
            Giữ lại
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (closeTabId !== null) handleCloseTab(closeTabId);
              setCloseTabId(null);
            }}
          >
            Đóng hoá đơn
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========== TOP BAR (AppBar) ========== */}
      <AppBar position="static" elevation={0} sx={{ bgcolor: barColor, color: barFg }}>
        {/* Dưới 900 px (máy tính bảng dọc): 2 hàng — ô tìm + nút ở trên, tab hoá đơn ở dưới. */}
        <Toolbar
          variant="dense"
          sx={{
            minHeight: 56,
            gap: 0.5,
            px: { xs: 1, sm: 1.5 },
            pt: { xs: 0.75, md: 0 },
            flexWrap: { xs: 'wrap', md: 'nowrap' },
          }}
        >
          {/* Product search */}
        <Autocomplete
          freeSolo
          autoHighlight
          clearOnEscape
          openOnFocus={false}
          // Luôn null: chọn lại đúng sản phẩm / quét lại đúng mã vẫn báo onChange (MUI bỏ qua khi giá trị không đổi).
          value={null}
          open={productSearch.trim().length > 0 && (searchResults.length > 0 || searchLoading)}
          // Đang tìm thì chưa có lựa chọn: Enter lúc này là mã quét / gõ → tra ngay (handleScanCode), không lấy nhầm
          // kết quả của từ khoá trước.
          options={searchLoading ? [] : searchResults}
          getOptionLabel={(option) =>
            typeof option === 'string' ? option : `${option.code || option.sku || ''} - ${option.name}`
          }
          filterOptions={(x) => x}
          inputValue={productSearch}
          onInputChange={(_, value, reason) => {
            if (reason === 'input' || reason === 'clear') setProductSearch(value);
          }}
          onChange={(_, value) => {
            if (typeof value === 'string') {
              handleScanCode(value);
            } else if (value) {
              // Quét / gõ đúng mã của một phiên bản rồi Enter (kết quả tìm tại máy về tức thì nên Enter chọn luôn hàng cha):
              // thêm thẳng phiên bản đó, không mở ngăn chọn phiên bản.
              const hit = findScannedProduct([value], productSearch);
              if (hit?.child) handleAddVariant(hit.product, hit.child);
              else handleAddProduct(value);
              setProductSearch('');
              setSearchResults([]);
            }
          }}
          loading={searchLoading}
          loadingText="Đang tìm..."
          noOptionsText="Không tìm thấy sản phẩm"
          renderOption={(props, option) => {
            const { key, ...optionProps } = props as any;
            const stock =
              option.totalStock ??
              option.inventories?.reduce((s, inv) => s + (inv.onHand || 0), 0) ??
              0;
            const variantCount = option.childProducts?.length ?? 0;
            return (
              <li key={option.id} {...optionProps}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: '100%' }}>
                  <Avatar
                    variant="rounded"
                    src={option.imageUrl || ''}
                    sx={{ width: 40, height: 40, bgcolor: 'grey.200' }}
                  >
                    <Iconify icon="solar:box-bold" width={20} />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>
                      {option.name}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {option.code || option.sku}
                      </Typography>
                      <Typography variant="caption" color="primary.main" fontWeight={600}>
                        {fCurrency(option.sellingPrice || option.basePrice)}
                      </Typography>
                      {variantCount > 0 ? (
                        <Typography variant="caption" color="info.main">
                          {variantCount} phiên bản
                        </Typography>
                      ) : (
                        <Typography
                          variant="caption"
                          color={stock > 0 ? 'success.main' : 'error.main'}
                        >
                          Tồn: {stock}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              inputRef={searchInputRef}
              size="small"
              placeholder="Tìm hàng hóa (F3)"
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <>
                    {searchLoading ? <CircularProgress color="inherit" size={18} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          slotProps={{
            paper: {
              sx: {
                width: { xs: 'calc(100vw - 16px)', sm: 420 },
                '& .MuiAutocomplete-listbox': { maxHeight: 360 },
              },
            },
          }}
          sx={{
            flex: { xs: '1 1 160px', md: '0 0 auto' },
            width: { md: 220, lg: 320 },
            minWidth: 0,
            '& .MuiOutlinedInput-root': { bgcolor: 'white', borderRadius: 1 },
          }}
        />

        <Tooltip title="Quét mã vạch: đặt con trỏ vào ô tìm rồi quét (Enter tự thêm)">
          <IconButton
            aria-label="Quét mã vạch"
            sx={{ color: barFg, ml: 0.5, display: { xs: 'none', sm: 'inline-flex' } }}
            onClick={() => searchInputRef.current?.focus()}
          >
            <Iconify icon="solar:barcode-bold" />
          </IconButton>
        </Tooltip>

        {/* Tab hoá đơn tạm dạng thẻ: tab đang mở nền sáng nối liền phần nội dung bên dưới, tab khác nền mờ — trước đây
            chỉ khác nhau một gạch chân mảnh, khó thấy đang ở hoá đơn nào. */}
        <Box
          sx={{
            order: { xs: 2, md: 0 },
            flex: { xs: '1 1 100%', md: '1 1 auto' },
            minWidth: 0,
            display: 'flex',
            alignItems: 'flex-end',
            alignSelf: 'flex-end',
            ml: { md: 1 },
            mt: { xs: 0.5, md: 0 },
          }}
        >
        <Tabs
          value={activeOrderId}
          onChange={(_, v) => setActiveOrderId(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            flex: '0 1 auto',
            minHeight: 44,
            minWidth: 0,
            '& .MuiTabs-indicator': { display: 'none' },
            '& .MuiTabs-scrollButtons': { color: barFg },
            '& .MuiTab-root': {
              minHeight: 40,
              height: 40,
              mt: 0.5,
              mr: 0.5,
              px: 1.25,
              opacity: 1,
              borderRadius: '10px 10px 0 0',
              fontWeight: 500,
              bgcolor: alpha(barFg, 0.14),
              transition: theme.transitions.create(['background-color', 'color']),
              '&:hover': { bgcolor: alpha(barFg, 0.24) },
            },
            // Theme tô tab chưa chọn màu chữ phụ (xám) với độ ưu tiên cao — trên nền màu gần như không đọc được.
            '& .MuiTab-root:not(.Mui-selected)': { color: barFg },
            '& .MuiTab-root.Mui-selected': {
              color: barColor,
              fontWeight: 700,
              bgcolor: 'background.default',
            },
          }}
        >
          {orders.map((order) => {
            const active = order.id === activeOrder.id;
            return (
              <Tab
                key={order.id}
                value={order.id}
                label={
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Box component="span" sx={{ display: { xs: 'none', lg: 'inline-flex' } }}>
                      <Iconify icon="solar:bill-list-bold" width={16} />
                    </Box>
                    <span>{order.label}</span>
                    {order.items.length > 0 && (
                      <Box
                        component="span"
                        sx={{
                          minWidth: 20,
                          height: 20,
                          px: 0.5,
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          lineHeight: '20px',
                          textAlign: 'center',
                          bgcolor: active ? barColor : barFg,
                          color: active ? barFg : barColor,
                        }}
                      >
                        {order.items.length}
                      </Box>
                    )}
                    {orders.length > 1 && (
                      <IconButton
                        size="small"
                        component="span"
                        sx={{ color: 'inherit', p: 0.25, opacity: 0.7, '&:hover': { opacity: 1 } }}
                        aria-label={`Đóng ${order.label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (order.items.length > 0) setCloseTabId(order.id);
                          else handleCloseTab(order.id);
                        }}
                      >
                        <Iconify icon="mingcute:close-line" width={14} />
                      </IconButton>
                    )}
                  </Stack>
                }
              />
            );
          })}
        </Tabs>

        <Tooltip title="Thêm hoá đơn tạm">
          <IconButton aria-label="Thêm hoá đơn tạm" sx={{ color: barFg, mb: 0.25 }} onClick={handleAddTab}>
            <Iconify icon="mingcute:add-circle-line" />
          </IconButton>
        </Tooltip>
        </Box>

        {/* Bên phải: đồng bộ hoá đơn mất mạng (chỉ hiện khi cần), công cụ, kho, quản lý */}
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0, ml: 'auto' }}>
          <PosSyncButton
            online={online}
            offlineSession={offlineSession}
            durable={outboxDurable}
            pendingSales={unsentSales}
            syncing={syncing}
            onSync={syncNow}
            onRetry={handleRetryOutboxSale}
            onReopen={handleReopenPendingSale}
            onDiscard={(sale) => {
              outbox.remove(sale.id).catch(console.error);
              enqueueSnackbar(`Đã bỏ ${sale.label}`, { variant: 'info' });
            }}
          />
          <Tooltip title="Tải lại hàng hoá, khách hàng">
            <IconButton aria-label="Tải lại dữ liệu" sx={{ color: barFg }} onClick={handleRefreshData}>
              <Iconify icon="solar:refresh-bold" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Mở màn hình khách (màn phụ hướng về khách)">
            <IconButton
              aria-label="Mở màn hình khách"
              sx={{ color: barFg, display: { xs: 'none', md: 'inline-flex' } }}
              onClick={() => openCustomerDisplayWindow()}
            >
              <Iconify icon="solar:monitor-bold" />
            </IconButton>
          </Tooltip>
          <PosRecentSalesButton
            fg={barFg}
            lastSaleId={lastSaleId}
            deviceSales={deviceSentSales}
            unsentSales={unsentSales}
            onPrint={handlePrintSale}
            onPrintLocal={(sale) => openLocalReceipt(sale)}
            autoPrint={autoPrint}
            onAutoPrintChange={handleToggleAutoPrint}
          />
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{
              px: 1,
              py: 0.5,
              mx: 0.5,
              borderRadius: 1,
              bgcolor: alpha(barFg, 0.14),
              color: barFg,
              display: { xs: 'none', lg: 'flex' },
            }}
          >
            <Iconify icon="solar:shop-bold" width={16} />
            <Typography variant="caption" fontWeight={600} noWrap sx={{ maxWidth: 120 }}>
              {selectedWarehouse?.name || 'Chọn kho'}
            </Typography>
          </Stack>
          <PosManageMenu fg={barFg} unsentCount={unsentCount} />
        </Stack>
      </Toolbar>
      </AppBar>

      {/* ========== MAIN CONTENT ========== */}
      {/* Từ 900 px: giỏ hàng trái, thanh toán phải. Hẹp hơn (máy tính bảng dọc): giỏ trên, thanh toán dưới. */}
      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          overflow: 'hidden',
        }}
      >
        {/* ===== LEFT PANEL (70%) - Product list in order ===== */}
        <Box
          sx={{
            flex: { xs: '1 1 auto', md: '1 1 70%' },
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Product table */}
          <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
            {activeOrder.items.length === 0 ? (
              <Stack
                alignItems="center"
                justifyContent="center"
                sx={{ height: '100%', opacity: 0.4, py: 8 }}
              >
                <Iconify icon="solar:cart-large-minimalistic-bold-duotone" width={80} />
                <Typography variant="body1" sx={{ mt: 2 }}>
                  Tìm kiếm hoặc chọn sản phẩm từ danh sách bên phải
                </Typography>
              </Stack>
            ) : (
              <Table size="small" stickyHeader sx={{ '& th': { whiteSpace: 'nowrap' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell width={40} align="center" sx={{ display: HIDE_ON_PHONE }}>
                      STT
                    </TableCell>
                    <TableCell width={40} />
                    <TableCell>Tên sản phẩm</TableCell>
                    <TableCell width={130} align="center">
                      Số lượng
                    </TableCell>
                    <TableCell width={130} align="right">
                      Giá bán
                    </TableCell>
                    <TableCell width={120} align="right">
                      Thành tiền
                    </TableCell>
                    <TableCell width={80} align="center" sx={{ display: HIDE_ON_PHONE }}>
                      Thao tác
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeOrder.items.map((item, idx) => {
                    const itemKey = getItemKey(item);
                    const lineTotal = item.quantity * item.unitPrice - item.discountAmount;
                    const stt = activeOrder.items.length - idx;
                    const isLowStock = item.quantity >= item.stockOnHand;
                    const isOverStock = item.quantity > item.stockOnHand;

                    return (
                      <TableRow
                        key={itemKey}
                        hover
                        sx={{
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.04),
                          },
                        }}
                      >
                        {/* STT */}
                        <TableCell align="center" sx={{ display: HIDE_ON_PHONE }}>
                          <Typography variant="body2" color="text.secondary">
                            {stt}
                          </Typography>
                        </TableCell>

                        {/* Delete */}
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveItem(itemKey)}
                          >
                            <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                          </IconButton>
                        </TableCell>

                        {/* Product name + attributes */}
                        <TableCell>
                          <Box>
                            {/* Tên hàng là thứ thu ngân nhìn — đậm; mã hàng + thuộc tính phiên bản ở dòng phụ. */}
                            <Typography variant="subtitle2" sx={{ lineHeight: 1.4 }}>
                              {item.name}
                            </Typography>
                            <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ gap: 0.5, mt: 0.25 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                {item.sku}
                              </Typography>
                              {item.attributes?.map((attr, attrIdx) => (
                                <Chip
                                  key={attrIdx}
                                  size="small"
                                  label={
                                    attr.attributeName ? `${attr.attributeName}: ${attr.attributeValue}` : attr.attributeValue
                                  }
                                  color="info"
                                  variant="soft"
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              ))}
                            </Stack>
                            {/* Item note */}
                            {item.note && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontStyle: 'italic', display: 'block', mt: 0.5 }}
                              >
                                Ghi chú: {item.note}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>

                        {/* Quantity */}
                        <TableCell align="center">
                          <Tooltip
                            title={
                              <Box>
                                <div>Tồn kho: {item.stockOnHand}</div>
                                <div>Đã đặt: {item.stockOnOrder}</div>
                                {isOverStock ? (
                                  <div style={{ color: '#ff5252' }}>⚠ Bán vượt tồn trên hệ thống</div>
                                ) : (
                                  isLowStock && <div style={{ color: '#ff5252' }}>⚠ Đã lấy hết số tồn</div>
                                )}
                              </Box>
                            }
                            arrow
                          >
                            <PosQtyInput
                              value={item.quantity}
                              onChange={(quantity) => handleUpdateQuantity(itemKey, quantity)}
                              error={isOverStock}
                            />
                          </Tooltip>
                        </TableCell>

                        {/* Unit price + discount */}
                        <TableCell align="right">
                          <Box
                            onClick={(e) => {
                              setDiscountAnchorEl(e.currentTarget as HTMLElement);
                              setDiscountItemId(itemKey);
                            }}
                            sx={{ cursor: 'pointer' }}
                          >
                            <Typography variant="body2">{fCurrency(item.unitPrice)}</Typography>
                            {item.discountAmount > 0 && (
                              <Typography variant="caption" color="error.main">
                                -{fCurrency(item.discountAmount)}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>

                        {/* Line total */}
                        <TableCell align="right">
                          <Typography variant="subtitle2" fontWeight={600}>
                            {fCurrency(lineTotal)}
                          </Typography>
                        </TableCell>

                        {/* Actions */}
                        <TableCell align="center" sx={{ display: HIDE_ON_PHONE }}>
                          <Stack direction="row" spacing={0.25} justifyContent="center">
                            <Tooltip title="Chi tiết sản phẩm">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setDetailProductId(item.productId);
                                  setDetailDrawerOpen(true);
                                }}
                              >
                                <Iconify icon="solar:info-circle-bold" width={18} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Ghi chú">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const note = prompt('Ghi chú cho sản phẩm:', item.note);
                                  if (note !== null) handleItemNote(itemKey, note);
                                }}
                              >
                                <Iconify icon="solar:pen-2-bold" width={18} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TableContainer>

          {/* Bottom note */}
          <Box
            sx={{
              px: 2,
              py: 1,
              borderTop: `1px solid ${theme.palette.divider}`,
              bgcolor: 'background.paper',
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="Ghi chú đơn hàng"
              value={activeOrder.note}
              onChange={(e) =>
                updateActiveOrder((order) => ({ ...order, note: e.target.value }))
              }
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="solar:pen-2-bold" width={18} sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Box>

        {/* ===== RIGHT PANEL (30%) ===== */}
        <Box
          sx={{
            flex: { xs: '0 0 auto', md: '0 0 30%' },
            maxWidth: { xs: '100%', md: '30%' },
            minWidth: { xs: 0, md: 340 },
            height: { xs: '58%', md: 'auto' },
            minHeight: 0,
            borderLeft: { md: `1px solid ${theme.palette.divider}` },
            borderTop: { xs: `1px solid ${theme.palette.divider}`, md: 'none' },
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
          }}
        >
          {/* Right tab selection */}
          <Tabs
            value={rightTab}
            onChange={(_, v) => setRightTab(v)}
            variant="fullWidth"
            sx={{
              borderBottom: `1px solid ${theme.palette.divider}`,
              '& .MuiTab-root': { fontWeight: 600, py: 1.5 },
            }}
          >
            <Tab
              label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Iconify icon="solar:bolt-bold" width={18} />
                  <span>Bán nhanh</span>
                </Stack>
              }
            />
            <Tab
              label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Iconify icon="mdi:clock-outline" width={18} />
                  <span>Bán thường</span>
                </Stack>
              }
            />
          </Tabs>

          {/* ===== TAB: BÁN NHANH ===== */}
          {/* Phần trên cuộn được; chân (khách cần trả + THANH TOÁN) luôn nằm trong màn — trước đây ở màn cao 768 px nút
              THANH TOÁN bị đẩy khuất dưới đáy, phải cuộn mới thấy. */}
          {rightTab === 0 && (
            <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'auto' }}>
                {/* Seller & Time info */}
                <Stack spacing={0.75} sx={{ px: 2, py: 1.25, bgcolor: 'background.neutral' }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Người bán</Typography>
                    <Typography variant="caption" fontWeight={600}>{sellerName}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Thời gian</Typography>
                    <Typography variant="caption">
                      {now.toLocaleDateString('vi-VN')} {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Kho xuất</Typography>
                    <Autocomplete
                      size="small"
                      options={warehouses.filter((w) => w.isActive)}
                      getOptionLabel={(o) => o.name}
                      // Kiểm soát ngay từ đầu (null khi chưa tải): trước đây undefined → ô hiện trống dù đã chọn kho.
                      value={selectedWarehouse as IWarehouse}
                      isOptionEqualToValue={(o, v) => o.id === v.id}
                      onChange={(_, v) => setSelectedWarehouse(v)}
                      sx={{ width: 140 }}
                      renderInput={(params) => <TextField {...params} variant="standard" />}
                      disableClearable
                    />
                  </Stack>
                </Stack>

                <Divider />

                {/* Customer */}
                <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                  <Autocomplete
                    size="small"
                    options={customers}
                    getOptionLabel={(option) =>
                      `${option.name}${option.phone ? ` (${option.phone})` : ''}`
                    }
                    value={customers.find((c) => c.id === activeOrder.customerId) || null}
                    onChange={(_, v) => handleSetCustomer(v)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        inputRef={customerInputRef}
                        placeholder="Tìm khách hàng (F4)"
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <InputAdornment position="start">
                                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                              </InputAdornment>
                              {params.InputProps.startAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                  {!activeOrder.customerId && (
                    <Typography variant="caption" color="text.secondary">
                      Mặc định: Khách lẻ
                    </Typography>
                  )}
                </Box>

                <Divider />

                <Divider />

                {/* Totals */}
                <Stack spacing={1} sx={{ px: 2, py: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Tổng tiền hàng{totalItemCount > 0 ? ` (${totalItemCount} SP)` : ''}
                    </Typography>
                    <Typography variant="subtitle2">{fCurrency(subTotal)}</Typography>
                  </Stack>

                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="body2" color="text.secondary" sx={{ pt: 0.75 }}>
                      Giảm giá
                    </Typography>
                    {renderOrderDiscount()}
                  </Stack>

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Mã coupon
                    </Typography>
                    <TextField
                      size="small"
                      placeholder="Nhập mã"
                      value={activeOrder.couponCode}
                      onChange={(e) => handleSetCoupon(e.target.value)}
                      sx={{ width: DISCOUNT_FIELD_WIDTH }}
                      inputProps={{ style: { textAlign: 'right' } }}
                    />
                  </Stack>
                </Stack>

                <Divider />

                {/* Phương thức thanh toán: 4 nút ô vuông thay danh sách radio; một ô số tiền cho phương thức đang chọn */}
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                    Phương thức thanh toán
                  </Typography>
                  <Box
                    role="radiogroup"
                    aria-label="Phương thức thanh toán"
                    sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}
                  >
                    {posMethods.map((pm) => {
                      const selected = quickSelectedMethods.includes(pm.value);
                      return (
                        <ButtonBase
                          key={pm.value}
                          role="radio"
                          aria-checked={selected}
                          onClick={() => handleQuickSelectMethod(pm.value)}
                          sx={{
                            justifyContent: 'flex-start',
                            gap: 1,
                            px: 1.25,
                            py: 1,
                            borderRadius: 1,
                            typography: 'body2',
                            fontWeight: selected ? 600 : 400,
                            border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
                            bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                            color: selected ? 'primary.main' : 'text.primary',
                            transition: theme.transitions.create(['background-color', 'border-color']),
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                          }}
                        >
                          <Iconify icon={pm.icon} width={18} />
                          {pm.label}
                        </ButtonBase>
                      );
                    })}
                  </Box>

                  {quickMethod && (
                    <Box sx={{ mt: 1.5 }}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label={quickMethod === 'Cash' ? 'Khách đưa' : 'Số tiền'}
                        placeholder="Số tiền"
                        value={quickMethodAmounts[quickMethod] || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setQuickPaymentTouched(true);
                          setQuickMethodAmounts((prev) => ({ ...prev, [quickMethod]: val }));
                        }}
                        InputProps={{ endAdornment: <InputAdornment position="end">₫</InputAdornment> }}
                        inputProps={{ min: 0, style: { textAlign: 'right', fontWeight: 600 } }}
                      />

                      {quickMethod === 'Cash' && quickDue > 0 && (
                        <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.75, mt: 1 }}>
                          {quickCashAmounts(quickDue, 4).map((value) => (
                            <Chip
                              key={value}
                              size="small"
                              clickable
                              label={value === quickDue ? 'Đúng tiền' : fCurrency(value)}
                              color={quickPaid === value ? 'primary' : 'default'}
                              variant={quickPaid === value ? 'filled' : 'outlined'}
                              onClick={() => {
                                setQuickPaymentTouched(value !== quickDue);
                                setQuickMethodAmounts({ Cash: value });
                              }}
                            />
                          ))}
                        </Stack>
                      )}

                      {quickMethod === 'BankTransfer' && !showStaticQr && (
                        <Box sx={{ mt: 1 }}>
                          <PosQrPayment
                            amount={quickMethodAmounts.BankTransfer || grandTotal}
                            onPaymentCompleted={(qrStatus) => {
                              setQuickQrPaymentCompleted(true);
                              setQuickPaymentTouched(true);
                              setQuickMethodAmounts((prev) => ({ ...prev, BankTransfer: qrStatus.amount }));
                              setQuickMethodRefs((prev) => ({
                                ...prev,
                                BankTransfer: qrTransactionRef(qrStatus),
                              }));
                            }}
                          />
                          <Button size="small" color="inherit" sx={{ mt: 0.5 }} onClick={() => setUseStaticQr(true)}>
                            Mất mạng / không tạo được QR? Dùng QR tĩnh
                          </Button>
                        </Box>
                      )}
                      {showStaticQr && (
                        <OfflineTransferQr
                          amount={quickDue}
                          code={activeOrder.offlineCode ?? null}
                          accounts={printKit.bankAccounts}
                          confirmed={quickQrPaymentCompleted}
                          onConfirm={(reference) => {
                            setQuickQrPaymentCompleted(true);
                            setQuickPaymentTouched(true);
                            setQuickMethodAmounts({ BankTransfer: quickDue });
                            setQuickMethodRefs({ BankTransfer: reference });
                          }}
                          onUseDynamic={online ? () => setUseStaticQr(false) : undefined}
                        />
                      )}
                    </Box>
                  )}

                </Box>
              </Box>

              {/* Chân cố định */}
              <Box sx={{ px: 2, pt: 1.25, pb: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Khách cần trả
                  </Typography>
                  <Typography variant="h5" fontWeight={700} color="error.main">
                    {fCurrency(quickDue)}
                  </Typography>
                </Stack>
                {/* Tiền thừa / còn thiếu ở chân cố định — thu ngân luôn thấy, không phải cuộn. */}
                {activeOrder.items.length > 0 && quickPaid !== quickDue && (quickPaid < quickDue || quickMethod === 'Cash') && (
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    sx={{
                      mb: 1,
                      px: 1.25,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: alpha(
                        quickPaid > quickDue ? theme.palette.success.main : theme.palette.error.main,
                        0.08
                      ),
                    }}
                  >
                    <Typography variant="body2" color={quickPaid > quickDue ? 'success.dark' : 'error.dark'}>
                      {quickPaid > quickDue ? 'Tiền thừa trả khách' : 'Còn thiếu'}
                    </Typography>
                    <Typography variant="subtitle2" color={quickPaid > quickDue ? 'success.dark' : 'error.dark'}>
                      {fCurrency(Math.abs(quickPaid - quickDue))}
                    </Typography>
                  </Stack>
                )}
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleQuickPayment}
                  disabled={activeOrder.items.length === 0 || quickPaymentLoading}
                  sx={{ py: 1.5, fontSize: '1rem', fontWeight: 700, borderRadius: 1.5 }}
                >
                  {quickPaymentLoading ? 'Đang xử lý...' : quickQrPaymentCompleted ? 'XÁC NHẬN ĐƠN HÀNG' : 'THANH TOÁN'}
                </Button>
              </Box>
            </Box>
          )}

          {/* ===== TAB: BÁN THƯỜNG ===== */}
          {rightTab === 1 && (
            <Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Warehouse + datetime */}
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ px: 2, pt: 1.5 }}
              >
                {warehouses.length > 0 && (
                  <Autocomplete
                    size="small"
                    options={warehouses.filter((w) => w.isActive)}
                    getOptionLabel={(option) => option.name}
                    value={selectedWarehouse as IWarehouse}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    onChange={(_, v) => setSelectedWarehouse(v)}
                    sx={{ width: 160 }}
                    renderInput={(params) => <TextField {...params} placeholder="Chi nhánh" />}
                    disableClearable
                  />
                )}
                <Typography variant="caption" color="text.secondary">
                  {now.toLocaleDateString('vi-VN')}{' '}
                  {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Stack>

              {/* Customer */}
              <Box sx={{ px: 2, pt: 1.5 }}>
                <Autocomplete
                  size="small"
                  options={customers}
                  getOptionLabel={(option) =>
                    `${option.name}${option.phone ? ` (${option.phone})` : ''}`
                  }
                  value={customers.find((c) => c.id === activeOrder.customerId) || null}
                  onChange={(_, v) => handleSetCustomer(v)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      inputRef={customerInputRef}
                      placeholder="Tìm khách hàng (F4)"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <InputAdornment position="start">
                              <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                            </InputAdornment>
                            {params.InputProps.startAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
                {!activeOrder.customerId && (
                  <Typography variant="caption" color="text.secondary">
                    Mặc định: Khách lẻ
                  </Typography>
                )}
              </Box>

              {/* Product suggestions grid */}
              <Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'auto', px: 2, py: 1 }}>
                {filteredProducts.length === 0 ? (
                  <Stack
                    alignItems="center"
                    justifyContent="center"
                    sx={{ height: '100%', opacity: 0.4 }}
                  >
                    <Iconify icon="solar:box-minimalistic-bold-duotone" width={60} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {productSearch ? 'Không tìm thấy' : 'Tìm kiếm sản phẩm'}
                    </Typography>
                  </Stack>
                ) : (
                  // Thẻ ngang gọn: hàng của cửa hàng gần như không có ảnh — ô ảnh trống to chỉ để thấy được 4 món.
                  <Box
                    sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 1 }}
                  >
                    {filteredProducts.map((product) => {
                      const stock =
                        product.totalStock ??
                        product.inventories?.reduce((sum, inv) => sum + (inv.onHand || 0), 0) ??
                        0;
                      const variantCount = product.childProducts?.length ?? 0;
                      return (
                        <ButtonBase
                          key={product.id}
                          onClick={() => handleAddProduct(product)}
                          sx={{
                            p: 1,
                            gap: 1,
                            borderRadius: 1,
                            textAlign: 'left',
                            alignItems: 'flex-start',
                            justifyContent: 'flex-start',
                            border: `1px solid ${theme.palette.divider}`,
                            transition: theme.transitions.create(['border-color', 'background-color']),
                            '&:hover': {
                              borderColor: theme.palette.primary.main,
                              bgcolor: alpha(theme.palette.primary.main, 0.04),
                            },
                          }}
                        >
                          <Avatar
                            variant="rounded"
                            src={product.imageUrl || undefined}
                            alt={product.name}
                            sx={{ width: 40, height: 40, bgcolor: 'background.neutral', color: 'text.disabled' }}
                          >
                            <Iconify icon="solar:box-minimalistic-bold" width={20} />
                          </Avatar>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                              variant="caption"
                              fontWeight={600}
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                lineHeight: 1.35,
                              }}
                            >
                              {product.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.disabled"
                              noWrap
                              display="block"
                              sx={{ fontFamily: 'monospace', fontSize: '0.68rem' }}
                            >
                              {product.code || product.sku}
                            </Typography>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.5}>
                              <Typography variant="caption" fontWeight={700} color="primary.main" noWrap>
                                {fCurrency(product.sellingPrice || product.basePrice)}
                              </Typography>
                              <Typography
                                variant="caption"
                                noWrap
                                color={variantCount > 0 ? 'info.main' : stock > 0 ? 'text.secondary' : 'error.main'}
                              >
                                {variantCount > 0 ? `${variantCount} phiên bản` : `Tồn ${stock}`}
                              </Typography>
                            </Stack>
                          </Box>
                        </ButtonBase>
                      );
                    })}
                  </Box>
                )}
                {matchedProducts.length > filteredProducts.length && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                    Đang hiện {filteredProducts.length} / {matchedProducts.length} mặt hàng — gõ tên hoặc mã ở ô tìm để lọc
                  </Typography>
                )}
              </Box>

              <Divider />

              {/* Order summary */}
              <Stack spacing={1} sx={{ px: 2, py: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Tổng tiền hàng{totalItemCount > 0 ? ` (${totalItemCount} SP)` : ''}
                  </Typography>
                  <Typography variant="subtitle2">{fCurrency(subTotal)}</Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Typography variant="body2" color="text.secondary" sx={{ pt: 0.75 }}>
                    Giảm giá
                  </Typography>
                  {renderOrderDiscount()}
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Mã coupon
                  </Typography>
                  <TextField
                    size="small"
                    placeholder="Nhập mã"
                    value={activeOrder.couponCode}
                    onChange={(e) => handleSetCoupon(e.target.value)}
                    sx={{ width: DISCOUNT_FIELD_WIDTH }}
                    inputProps={{ style: { textAlign: 'right' } }}
                  />
                </Stack>
              </Stack>

              {/* Payment button */}
              <Box sx={{ px: 2, pt: 1.25, pb: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Khách cần trả
                  </Typography>
                  <Typography variant="h5" fontWeight={700} color="error.main">
                    {fCurrency(grandTotal > 0 ? grandTotal : 0)}
                  </Typography>
                </Stack>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleOpenPayment}
                  disabled={activeOrder.items.length === 0}
                  sx={{ py: 1.5, fontSize: '1rem', fontWeight: 700, borderRadius: 1.5 }}
                >
                  THANH TOÁN
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* ========== DRAWERS & POPOVERS ========== */}

      {/* Payment Drawer (for "Bán thường" mode) */}
      <PosPaymentDrawer
        open={paymentDrawerOpen}
        onClose={() => setPaymentDrawerOpen(false)}
        totalAmount={grandTotal > 0 ? grandTotal : 0}
        totalItems={totalItemCount}
        subTotal={subTotal}
        orderDiscount={activeOrder.discountAmount}
        couponCode={activeOrder.couponCode}
        customerId={activeOrder.customerId}
        customerName={activeOrder.customerName}
        customers={customers}
        warehouseName={selectedWarehouse?.name}
        sellerName={sellerName}
        onCustomerChange={handleSetCustomer}
        onDiscountChange={handleSetDiscount}
        onCouponChange={handleSetCoupon}
        onConfirm={async (payments) => {
          await handleConfirmPayment(payments);
        }}
      />

      {/* Product Detail Drawer */}
      <PosProductDetailDrawer
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        productId={detailProductId}
      />

      {/* Variant Picker Drawer */}
      <PosVariantPickerDrawer
        open={variantDrawerOpen}
        onClose={() => setVariantDrawerOpen(false)}
        product={variantPickerProduct}
        onSelectVariant={handleAddVariant}
      />

      {/* Discount Popover */}
      <PosDiscountPopover
        open={Boolean(discountAnchorEl)}
        anchorEl={discountAnchorEl}
        onClose={() => {
          setDiscountAnchorEl(null);
          setDiscountItemId('');
        }}
        unitPrice={
          activeOrder.items.find((i) => getItemKey(i) === discountItemId)?.unitPrice || 0
        }
        currentDiscount={
          activeOrder.items.find((i) => getItemKey(i) === discountItemId)?.discountAmount || 0
        }
        onApply={handleItemDiscount}
      />

      {/* In hoá đơn vừa bán */}
      <ReceiptPrintDialog
        open={receiptDialogOpen}
        onClose={() => setReceiptDialogOpen(false)}
        orderId={printOrderId}
        localReceipt={localReceipt}
        autoPrint={printAuto}
      />
    </Box>
  );
}

// ======================================================================
// Utility
// ======================================================================

/** Tổng tiền hàng của một đơn tạm (Σ số lượng × đơn giá − giảm dòng), như `subTotal` của đơn đang mở. */
function orderSubTotal(order: DraftOrder): number {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discountAmount, 0);
}

function getItemKey(item: CartItem): string {
  return item.productVariantId
    ? `${item.productId}__${item.productVariantId}`
    : item.productId;
}
