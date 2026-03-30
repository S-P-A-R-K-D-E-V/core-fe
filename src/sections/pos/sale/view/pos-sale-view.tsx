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
import Badge from '@mui/material/Badge';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Unstable_Grid2';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { alpha, useTheme } from '@mui/material/styles';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { fCurrency } from 'src/utils/format-number';

import { IProduct, IProductListItem, IProductChild, ICustomer, IWarehouse } from 'src/types/corecms-api';
import { getAllProducts } from 'src/api/products';
import { getAllCustomers } from 'src/api/customers';
import { getAllWarehouses } from 'src/api/warehouses';
import { createSalesOrder } from 'src/api/sales-orders';

import PosDiscountPopover from '../pos-discount-popover';
import PosProductDetailDrawer from '../pos-product-detail-drawer';
import PosVariantPickerDrawer from '../pos-variant-picker-drawer';
import PosPaymentDrawer, { PaymentLine } from '../pos-payment-drawer';
import PosQrPayment from '../pos-qr-payment';

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
  couponCode: string;
}

// ======================================================================
// Helpers
// ======================================================================

const POS_DRAFT_ORDERS_KEY = 'pos_draft_orders';

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

let orderCounter = 1;

function createEmptyOrder(): DraftOrder {
  const id = orderCounter;
  orderCounter += 1;
  return {
    id,
    label: `Hóa đơn ${id}`,
    items: [],
    note: '',
    discountAmount: 0,
    couponCode: '',
  };
}

// ======================================================================
// Main Component
// ======================================================================

export default function PosSaleView() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  // Restore dialog
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [cachedData, setCachedData] = useState<DraftOrdersCache | null>(null);

  // Data
  const [products, setProducts] = useState<IProductListItem[]>([]);
  const [customers, setCustomers] = useState<ICustomer[]>([]);
  const [warehouses, setWarehouses] = useState<IWarehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<IWarehouse | null>(null);

  // Draft orders (tabs)
  const [orders, setOrders] = useState<DraftOrder[]>([createEmptyOrder()]);
  const [activeOrderId, setActiveOrderId] = useState<number>(1);

  // Search
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<IProductListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
  const [quickMethodAmounts, setQuickMethodAmounts] = useState<Record<string, number>>({});
  const [quickMethodRefs, setQuickMethodRefs] = useState<Record<string, string>>({});
  const [quickCustomerPayment, setQuickCustomerPayment] = useState<number>(0);
  const [quickDiscountMode, setQuickDiscountMode] = useState<'amount' | 'percent'>('amount');
  const [quickDiscountInput, setQuickDiscountInput] = useState<string>('');
  const [quickPaymentLoading, setQuickPaymentLoading] = useState(false);

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
      }
    }
  }, []);

  // Handle restore/discard cached orders
  const handleRestoreDrafts = useCallback(() => {
    if (cachedData) {
      orderCounter = cachedData.orderCounter;
      const restored = relabelOrders(cachedData.orders);
      setOrders(restored);
      setActiveOrderId(restored[0].id);
      enqueueSnackbar(`Đã khôi phục ${restored.length} đơn hàng tạm`, { variant: 'info' });
    }
    setRestoreDialogOpen(false);
    setCachedData(null);
  }, [cachedData, enqueueSnackbar]);

  const handleDiscardDrafts = useCallback(() => {
    clearDraftsFromStorage();
    setRestoreDialogOpen(false);
    setCachedData(null);
  }, []);

  // Sync orders to localStorage whenever orders change
  useEffect(() => {
    const hasItems = orders.some((o) => o.items.length > 0);
    if (hasItems) {
      saveDraftsToStorage(orders, orderCounter, selectedWarehouse?.id);
    } else {
      clearDraftsFromStorage();
    }
  }, [orders, selectedWarehouse?.id]);

  // Load initial data
  useEffect(() => {
    Promise.all([
      getAllProducts({ isActive: true }),
      getAllCustomers({ isActive: true }),
      getAllWarehouses(),
    ])
      .then(([p, c, w]) => {
        setProducts(p.items);
        setCustomers(c);
        setWarehouses(w);
        if (w.length > 0) {
          // If we have a cached warehouse, try to select it
          const cached = loadDraftsFromStorage();
          const cachedWh = cached?.selectedWarehouseId
            ? w.find((wh) => wh.id === cached.selectedWarehouseId)
            : null;
          setSelectedWarehouse(cachedWh || w.find((wh) => wh.isActive) || w[0]);
        }
      })
      .catch(console.error);
  }, []);

  // Search products with debounce
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!productSearch.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchDebounceRef.current = setTimeout(() => {
      getAllProducts({ keyword: productSearch, isActive: true })
        .then((r) => {
          setSearchResults(r.items);
          setProducts((prev) => {
            // Merge new results into existing products list
            const existingIds = new Set(prev.map((p) => p.id));
            const newItems = r.items.filter((p) => !existingIds.has(p.id));
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        })
        .catch(console.error)
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [productSearch]);

  // F3 global keyboard shortcut to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        searchInputRef.current?.focus();
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

  // Filtered products for the right sidebar
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const keyword = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(keyword) ||
        (p.sku && p.sku.toLowerCase().includes(keyword)) ||
        (p.barcode && p.barcode.toLowerCase().includes(keyword))
    );
  }, [products, productSearch]);

  // ====== Order handlers ======

  const updateActiveOrder = useCallback(
    (updater: (order: DraftOrder) => DraftOrder) => {
      setOrders((prev) => prev.map((o) => (o.id === activeOrderId ? updater(o) : o)));
    },
    [activeOrderId]
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
          if (existing.quantity + 1 > stock) {
            enqueueSnackbar(`Sản phẩm ${product.name} không đủ tồn kho (Tồn: ${stock})`, {
              variant: 'warning',
            });
            return order;
          }
          const newItems = [...order.items];
          newItems[existingIdx] = { ...existing, quantity: existing.quantity + 1 };
          return { ...order, items: newItems };
        }
        if (stock <= 0) {
          enqueueSnackbar(`Sản phẩm ${product.name} hết hàng`, { variant: 'warning' });
          return order;
        }
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
    [updateActiveOrder, enqueueSnackbar]
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
          if (existing.quantity + 1 > stock) {
            enqueueSnackbar(`Sản phẩm ${child.name} không đủ tồn kho (Tồn: ${stock})`, {
              variant: 'warning',
            });
            return order;
          }
          const newItems = [...order.items];
          newItems[existingIdx] = { ...existing, quantity: existing.quantity + 1 };
          return { ...order, items: newItems };
        }
        if (stock <= 0) {
          enqueueSnackbar(`Sản phẩm ${child.name} hết hàng`, { variant: 'warning' });
          return order;
        }
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
    [updateActiveOrder, enqueueSnackbar]
  );

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
            if (newQuantity > item.stockOnHand) {
              enqueueSnackbar(
                `Không đủ tồn kho. Tồn hiện tại: ${item.stockOnHand}`,
                { variant: 'warning' }
              );
              return item;
            }
            return { ...item, quantity: newQuantity };
          }),
        };
      });
    },
    [updateActiveOrder, enqueueSnackbar]
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

  const handleSetDiscount = useCallback(
    (discountAmount: number) => {
      updateActiveOrder((order) => ({ ...order, discountAmount }));
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
    const newOrder = createEmptyOrder();
    setOrders((prev) => relabelOrders([...prev, newOrder]));
    setActiveOrderId(newOrder.id);
  }, []);

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

  const handleConfirmPayment = useCallback(
    async (payments: PaymentLine[]) => {
      if (!selectedWarehouse) return;

      try {
        await createSalesOrder({
          customerId: activeOrder.customerId || undefined,
          discount: activeOrder.discountAmount,
          totalPayment: grandTotal > 0 ? grandTotal : 0,
          method: payments[0]?.method || 'Cash',
          invoiceDetails: activeOrder.items.map((item) => ({
            productId: item.productId,
            productCode: item.sku || undefined,
            productName: item.name,
            quantity: item.quantity,
            price: item.unitPrice,
            discount: item.discountAmount,
          })),
          payments: payments
            .filter((p) => p.amount > 0)
            .map((p) => ({
              method: p.method,
              amount: p.amount,
            })),
        });

        enqueueSnackbar('Thanh toán thành công!', { variant: 'success' });
        setPaymentDrawerOpen(false);

        // Reset current order and relabel
        setOrders((prev) => {
          if (prev.length <= 1) {
            const newOrder = createEmptyOrder();
            setActiveOrderId(newOrder.id);
            return relabelOrders([newOrder]);
          }
          const remaining = relabelOrders(prev.filter((o) => o.id !== activeOrderId));
          setActiveOrderId(remaining[remaining.length - 1].id);
          return remaining;
        });

        // Refresh products
        getAllProducts({ isActive: true })
          .then((r) => setProducts(r.items))
          .catch(console.error);
      } catch (error: any) {
        const message = error?.title || error?.message || 'Có lỗi xảy ra khi thanh toán';
        enqueueSnackbar(message, { variant: 'error' });
      }
    },
    [activeOrder, activeOrderId, selectedWarehouse, enqueueSnackbar]
  );

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
      await handleConfirmPayment(payments);
      // Reset quick payment state
      setQuickSelectedMethods(['Cash']);
      setQuickMethodAmounts({});
      setQuickMethodRefs({});
      setQuickCustomerPayment(0);
      setQuickDiscountInput('');
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
  ]);

  // Quick discount apply
  const handleQuickDiscountApply = useCallback(() => {
    const numVal = Number(quickDiscountInput) || 0;
    if (quickDiscountMode === 'percent') {
      handleSetDiscount(Math.round((subTotal * numVal) / 100));
    } else {
      handleSetDiscount(numVal);
    }
  }, [quickDiscountInput, quickDiscountMode, subTotal, handleSetDiscount]);

  // Auto-fill customer payment when grand total changes
  useEffect(() => {
    if (grandTotal > 0) {
      setQuickCustomerPayment(grandTotal);
      if (quickSelectedMethods.length === 1) {
        setQuickMethodAmounts({ [quickSelectedMethods[0]]: grandTotal });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grandTotal]);

  // Quick payment method toggle
  const handleQuickToggleMethod = useCallback((method: string) => {
    setQuickSelectedMethods((prev) => {
      if (prev.includes(method)) {
        const next = prev.filter((m) => m !== method);
        if (next.length === 0) return prev;
        // Clear removed method amount
        setQuickMethodAmounts((a) => {
          const copy = { ...a };
          delete copy[method];
          return copy;
        });
        return next;
      }
      // Adding a new method — auto-fill its amount with remaining
      const currentPaid = prev.reduce((s, m) => s + (quickMethodAmounts[m] || 0), 0);
      const remaining = Math.max(0, grandTotal - currentPaid);
      setQuickMethodAmounts((a) => ({ ...a, [method]: remaining }));
      setQuickCustomerPayment(Math.max(currentPaid + remaining, grandTotal));
      return [...prev, method];
    });
  }, [quickMethodAmounts, grandTotal]);

  // ====== Render ======

  const PAYMENT_METHODS = [
    { value: 'Cash', label: 'Tiền mặt', icon: 'solar:wallet-money-bold' },
    { value: 'BankTransfer', label: 'Chuyển khoản', icon: 'solar:card-transfer-bold' },
    { value: 'Card', label: 'Thẻ', icon: 'solar:card-bold' },
    { value: 'EWallet', label: 'Ví', icon: 'solar:smartphone-bold' },
  ];

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: theme.zIndex.drawer + 2,
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ========== Restore Draft Orders Dialog ========== */}
      <Dialog open={restoreDialogOpen} maxWidth="xs" fullWidth>
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

      {/* ========== TOP BAR (AppBar) ========== */}
      <AppBar position="static" elevation={1} style={{backgroundColor: theme.palette.primary.main}}>
        <Toolbar variant="dense" sx={{ minHeight: 52, gap: 1 }}>
          {/* Product search */}
        <Autocomplete
          freeSolo
          openOnFocus={false}
          open={productSearch.trim().length > 0 && (searchResults.length > 0 || searchLoading)}
          options={searchResults}
          getOptionLabel={(option) =>
            typeof option === 'string' ? option : `${option.code || option.sku || ''} - ${option.name}`
          }
          filterOptions={(x) => x}
          inputValue={productSearch}
          onInputChange={(_, value, reason) => {
            if (reason === 'input' || reason === 'clear') setProductSearch(value);
          }}
          onChange={(_, value) => {
            if (value && typeof value !== 'string') {
              handleAddProduct(value);
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
                      <Typography
                        variant="caption"
                        color={stock > 0 ? 'success.main' : 'error.main'}
                      >
                        Tồn: {stock}
                      </Typography>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults.length > 0 && !searchLoading) {
                  e.preventDefault();
                  handleAddProduct(searchResults[0]);
                  setProductSearch('');
                  setSearchResults([]);
                }
              }}
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
                width: 420,
                '& .MuiAutocomplete-listbox': { maxHeight: 360 },
              },
            },
          }}
          sx={{
            width: 320,
            '& .MuiOutlinedInput-root': { bgcolor: 'white', borderRadius: 1 },
          }}
        />

        <IconButton sx={{ color: 'white', ml: 1 }}>
          <Iconify icon="solar:barcode-bold" />
        </IconButton>

        {/* Invoice tabs */}
        <Tabs
          value={activeOrderId}
          onChange={(_, v) => setActiveOrderId(v)}
          sx={{
            ml: 2,
            '& .MuiTab-root': { color: alpha('#fff', 0.7), minHeight: 40, py: 0 },
            '& .Mui-selected': { color: '#fff !important' },
            '& .MuiTabs-indicator': { bgcolor: '#fff' },
          }}
        >
          {orders.map((order) => (
            <Tab
              key={order.id}
              value={order.id}
              label={
                <Stack direction="row" alignItems="center" spacing={0.5} style={{width: 140}}>
                  <Iconify icon="solar:document-text-bold" width={16} />
                  <span>{order.label}</span>
                  <Badge badgeContent={order.items.length} color="error" sx={{ ml: 1 }}>
                    <span />
                  </Badge>
                  {orders.length > 1 && (
                    <IconButton
                      size="small"
                      sx={{ color: alpha('#fff', 0.6), p: 0.25 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTab(order.id);
                      }}
                    >
                      <Iconify icon="mingcute:close-line" width={14} />
                    </IconButton>
                  )}
                </Stack>
              }
            />
          ))}
        </Tabs>

        <IconButton sx={{ color: 'white' }} onClick={handleAddTab}>
          <Iconify icon="mingcute:add-circle-line" />
        </IconButton>

        <Box sx={{ flexGrow: 1 }} />

        {/* Right side icons */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton sx={{ color: 'white' }}>
            <Iconify icon="solar:lock-keyhole-bold" />
          </IconButton>
          <IconButton sx={{ color: 'white' }}>
            <Iconify icon="solar:undo-left-round-bold" />
          </IconButton>
          <IconButton sx={{ color: 'white' }}>
            <Iconify icon="solar:refresh-bold" />
          </IconButton>
          <IconButton sx={{ color: 'white' }}>
            <Iconify icon="solar:printer-bold" />
          </IconButton>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {selectedWarehouse?.name || 'Chọn kho'}
          </Typography>
          <IconButton sx={{ color: 'white' }}>
            <Iconify icon="eva:menu-fill" />
          </IconButton>
        </Stack>
      </Toolbar>
      </AppBar>

      {/* ========== MAIN CONTENT ========== */}
      <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ===== LEFT PANEL (70%) - Product list in order ===== */}
        <Box
          sx={{
            flex: '0 0 70%',
            maxWidth: '70%',
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
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={40} align="center">
                      STT
                    </TableCell>
                    <TableCell width={40} />
                    <TableCell>Tên sản phẩm</TableCell>
                    <TableCell width={100} align="center">
                      Số lượng
                    </TableCell>
                    <TableCell width={130} align="right">
                      Giá bán
                    </TableCell>
                    <TableCell width={120} align="right">
                      Thành tiền
                    </TableCell>
                    <TableCell width={80} align="center">
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
                        <TableCell align="center">
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
                            <Typography variant="subtitle2">{item.sku}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {item.name}
                            </Typography>
                            {item.attributes && item.attributes.length > 0 && (
                              <Stack
                                direction="row"
                                flexWrap="wrap"
                                spacing={0.5}
                                sx={{ mt: 0.5 }}
                              >
                                {item.attributes.map((attr, attrIdx) => (
                                  <Chip
                                    key={attrIdx}
                                    size="small"
                                    label={attr.attributeValue}
                                    color="info"
                                    variant="filled"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                ))}
                              </Stack>
                            )}
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
                                {isLowStock && (
                                  <div style={{ color: '#ff5252' }}>⚠ Hết hàng!</div>
                                )}
                              </Box>
                            }
                            arrow
                          >
                            <TextField
                              size="small"
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateQuantity(itemKey, Number(e.target.value) || 0)
                              }
                              inputProps={{ min: 1, max: item.stockOnHand, style: { textAlign: 'center' } }}
                              sx={{
                                width: 70,
                                '& .MuiOutlinedInput-root': {
                                  bgcolor: isLowStock
                                    ? alpha(theme.palette.error.main, 0.08)
                                    : undefined,
                                },
                              }}
                              error={isLowStock}
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
                        <TableCell align="center">
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
            flex: '0 0 30%',
            maxWidth: '30%',
            borderLeft: `1px solid ${theme.palette.divider}`,
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
          {rightTab === 0 && (
            <Box sx={{ flexGrow: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              {/* Seller & Time info */}
              <Stack spacing={0.75} sx={{ px: 2, py: 1.5, bgcolor: theme.palette.grey[50] }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Người bán</Typography>
                  <Typography variant="caption" fontWeight={600}>Admin</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Thời gian</Typography>
                  <Typography variant="caption">
                    {now.toLocaleDateString('vi-VN')} {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Kênh bán</Typography>
                  <Autocomplete
                    size="small"
                    options={warehouses.filter((w) => w.isActive)}
                    getOptionLabel={(o) => o.name}
                    value={selectedWarehouse ?? undefined}
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

              {/* Totals */}
              <Stack spacing={0.75} sx={{ px: 2, py: 1.5, flexGrow: 0 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Tổng tiền hàng
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      {totalItemCount} SP
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {fCurrency(subTotal)}
                    </Typography>
                  </Stack>
                </Stack>

                {/* Discount */}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Giảm giá
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Button
                      size="small"
                      variant={quickDiscountMode === 'percent' ? 'contained' : 'outlined'}
                      onClick={() => setQuickDiscountMode('percent')}
                      sx={{ minWidth: 28, px: 0.5, fontSize: '0.65rem' }}
                    >
                      %
                    </Button>
                    <Button
                      size="small"
                      variant={quickDiscountMode === 'amount' ? 'contained' : 'outlined'}
                      onClick={() => setQuickDiscountMode('amount')}
                      sx={{ minWidth: 34, px: 0.5, fontSize: '0.65rem' }}
                    >
                      VNĐ
                    </Button>
                    <TextField
                      size="small"
                      type="number"
                      value={quickDiscountInput}
                      onChange={(e) => setQuickDiscountInput(e.target.value)}
                      onBlur={handleQuickDiscountApply}
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickDiscountApply()}
                      sx={{ width: 80 }}
                      inputProps={{ min: 0, style: { textAlign: 'right', fontSize: '0.8rem' } }}
                    />
                  </Stack>
                </Stack>

                {activeOrder.discountAmount > 0 && (
                  <Typography variant="caption" color="error.main" sx={{ textAlign: 'right' }}>
                    -{fCurrency(activeOrder.discountAmount)}
                  </Typography>
                )}

                {/* Coupon */}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Mã coupon
                  </Typography>
                  <TextField
                    size="small"
                    placeholder="Nhập mã"
                    value={activeOrder.couponCode}
                    onChange={(e) => handleSetCoupon(e.target.value)}
                    sx={{ width: 120 }}
                    inputProps={{ style: { textAlign: 'right', fontSize: '0.8rem' } }}
                  />
                </Stack>

                <Divider />

                {/* Grand total */}
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle1" fontWeight={700}>
                    Khách cần trả
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="error.main">
                    {fCurrency(grandTotal > 0 ? grandTotal : 0)}
                  </Typography>
                </Stack>

                {/* Customer payment */}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Khách thanh toán
                  </Typography>
                  <TextField
                    size="small"
                    type="number"
                    value={quickCustomerPayment || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setQuickCustomerPayment(val);
                      if (quickSelectedMethods.length === 1) {
                        setQuickMethodAmounts({ [quickSelectedMethods[0]]: val });
                      }
                    }}
                    sx={{ width: 120 }}
                    inputProps={{ min: 0, style: { textAlign: 'right', fontWeight: 600, fontSize: '0.85rem' } }}
                  />
                </Stack>
              </Stack>

              <Divider />

              {/* Payment methods */}
              <Box sx={{ px: 2, py: 1, flexGrow: 0 }}>
                <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                  Phương thức thanh toán
                </Typography>
                <Stack spacing={0.5}>
                  {PAYMENT_METHODS.map((pm) => {
                    const isSelected = quickSelectedMethods.includes(pm.value);
                    return (
                      <Box key={pm.value}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={isSelected}
                              onChange={() => handleQuickToggleMethod(pm.value)}
                            />
                          }
                          label={
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Iconify icon={pm.icon} width={16} />
                              <Typography variant="body2">{pm.label}</Typography>
                            </Stack>
                          }
                        />
                        {isSelected && (
                          <Box sx={{ pl: 4, pb: 0.5 }}>
                            <TextField
                              fullWidth
                              size="small"
                              type="number"
                              placeholder="Số tiền"
                              value={quickMethodAmounts[pm.value] || ''}
                              onChange={(e) =>
                                setQuickMethodAmounts((prev) => ({
                                  ...prev,
                                  [pm.value]: Number(e.target.value) || 0,
                                }))
                              }
                              inputProps={{ min: 0 }}
                              sx={{ mb: 0.5 }}
                            />
                            {pm.value === 'BankTransfer' && (
                              <PosQrPayment amount={quickMethodAmounts[pm.value] || grandTotal} />
                            )}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              </Box>

              {/* Quick sale payment button */}
              <Box sx={{ p: 2, mt: 'auto' }}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleQuickPayment}
                  disabled={activeOrder.items.length === 0 || quickPaymentLoading}
                  sx={{ py: 1.5, fontSize: '1rem', fontWeight: 700, borderRadius: 1.5 }}
                >
                  {quickPaymentLoading ? 'Đang xử lý...' : 'THANH TOÁN'}
                </Button>
              </Box>
            </Box>
          )}

          {/* ===== TAB: BÁN THƯỜNG ===== */}
          {rightTab === 1 && (
            <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                    value={selectedWarehouse ?? undefined}
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
                        endAdornment: (
                          <>
                            {params.InputProps.endAdornment}
                            <InputAdornment position="end">
                              <IconButton size="small">
                                <Iconify icon="mingcute:add-line" width={18} />
                              </IconButton>
                            </InputAdornment>
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
              <Box sx={{ flexGrow: 1, overflow: 'auto', px: 2, py: 1 }}>
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
                  <Grid container spacing={1}>
                    {filteredProducts.map((product) => (
                      <Grid xs={6} key={product.id}>
                        <Card
                          onClick={() => handleAddProduct(product)}
                          sx={{
                            p: 1,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            '&:hover': {
                              boxShadow: theme.shadows[8],
                              transform: 'translateY(-1px)',
                            },
                          }}
                        >
                          <Box
                            sx={{
                              width: '100%',
                              pt: '80%',
                              position: 'relative',
                              borderRadius: 0.75,
                              overflow: 'hidden',
                              bgcolor: theme.palette.grey[100],
                              mb: 0.75,
                            }}
                          >
                            {product.imageUrl ? (
                              <Box
                                component="img"
                                src={product.imageUrl}
                                alt={product.name}
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                            ) : (
                              <Stack
                                alignItems="center"
                                justifyContent="center"
                                sx={{ position: 'absolute', inset: 0 }}
                              >
                                <Iconify
                                  icon="solar:box-minimalistic-bold"
                                  width={28}
                                  sx={{ color: theme.palette.grey[400] }}
                                />
                              </Stack>
                            )}
                          </Box>

                          <Typography variant="caption" fontWeight={600} noWrap>
                            {product.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {product.sku}
                          </Typography>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" fontWeight={600} color="primary.main">
                              {fCurrency(product.sellingPrice || product.basePrice)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Tồn: {product.totalStock ?? 0}
                            </Typography>
                          </Stack>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Box>

              <Divider />

              {/* Order summary */}
              <Stack spacing={0.75} sx={{ px: 2, py: 1.5 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Tổng tiền hàng
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      {totalItemCount}
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {fCurrency(subTotal)}
                    </Typography>
                  </Stack>
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Giảm giá
                  </Typography>
                  <TextField
                    size="small"
                    type="number"
                    value={activeOrder.discountAmount || ''}
                    onChange={(e) => handleSetDiscount(Number(e.target.value) || 0)}
                    sx={{ width: 100 }}
                    inputProps={{ min: 0, style: { textAlign: 'right' } }}
                  />
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
                    sx={{ width: 120 }}
                    inputProps={{ style: { textAlign: 'right' } }}
                  />
                </Stack>

                <Divider />

                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle1" fontWeight={700}>
                    Khách cần trả
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="error.main">
                    {fCurrency(grandTotal > 0 ? grandTotal : 0)}
                  </Typography>
                </Stack>
              </Stack>

              {/* Payment button */}
              <Box sx={{ p: 2, pt: 0 }}>
                <Button
                  fullWidth
                  variant="contained"
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
        sellerName="Admin"
        onCustomerChange={handleSetCustomer}
        onDiscountChange={handleSetDiscount}
        onCouponChange={handleSetCoupon}
        onConfirm={handleConfirmPayment}
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
    </Box>
  );
}

// ======================================================================
// Utility
// ======================================================================

function getItemKey(item: CartItem): string {
  return item.productVariantId
    ? `${item.productId}__${item.productVariantId}`
    : item.productId;
}
