'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

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

import { alpha, useTheme } from '@mui/material/styles';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { fCurrency } from 'src/utils/format-number';

import { IProduct, ICustomer, IWarehouse } from 'src/types/corecms-api';
import { getAllProducts } from 'src/api/products';
import { getAllCustomers } from 'src/api/customers';
import { getAllWarehouses } from 'src/api/warehouses';
import { createSalesOrder } from 'src/api/sales-orders';

import PosPaymentDialog from '../../sale/pos-payment-dialog';

// ----------------------------------------------------------------------

interface CartItem {
  productId: string;
  productVariantId?: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountAmount: number;
  imageUrl?: string;
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

// ----------------------------------------------------------------------

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

// ----------------------------------------------------------------------

export default function PosSaleView() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  // Data
  const [products, setProducts] = useState<IProduct[]>([]);
  const [customers, setCustomers] = useState<ICustomer[]>([]);
  const [warehouses, setWarehouses] = useState<IWarehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<IWarehouse | null>(null);

  // Draft orders (tabs)
  const [orders, setOrders] = useState<DraftOrder[]>([createEmptyOrder()]);
  const [activeOrderId, setActiveOrderId] = useState<number>(orders[0].id);

  // Search
  const [productSearch, setProductSearch] = useState('');

  // Payment dialog
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Load data
  useEffect(() => {
    Promise.all([getAllProducts({ isActive: true }), getAllCustomers({ isActive: true }), getAllWarehouses()])
      .then(([p, c, w]) => {
        setProducts(p);
        setCustomers(c);
        setWarehouses(w);
        if (w.length > 0) setSelectedWarehouse(w.find((wh) => wh.isActive) || w[0]);
      })
      .catch(console.error);
  }, []);

  // Current order
  const activeOrder = useMemo(
    () => orders.find((o) => o.id === activeOrderId) || orders[0],
    [orders, activeOrderId]
  );

  // Calculations
  const subTotal = useMemo(
    () =>
      activeOrder.items.reduce((sum, item) => {
        const lineTotal = item.quantity * item.unitPrice - item.discountAmount;
        return sum + lineTotal;
      }, 0),
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

  // Filtered products
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

  // --- Handlers ---

  const updateActiveOrder = useCallback(
    (updater: (order: DraftOrder) => DraftOrder) => {
      setOrders((prev) => prev.map((o) => (o.id === activeOrderId ? updater(o) : o)));
    },
    [activeOrderId]
  );

  const handleAddProduct = useCallback(
    (product: IProduct) => {
      updateActiveOrder((order) => {
        const existingIdx = order.items.findIndex((item) => item.productId === product.id);
        if (existingIdx >= 0) {
          const newItems = [...order.items];
          newItems[existingIdx] = { ...newItems[existingIdx], quantity: newItems[existingIdx].quantity + 1 };
          return { ...order, items: newItems };
        }
        return {
          ...order,
          items: [
            ...order.items,
            {
              productId: product.id,
              name: product.name,
              sku: product.sku || '',
              quantity: 1,
              unitPrice: product.sellingPrice,
              vatRate: product.vatRate,
              discountAmount: 0,
              imageUrl: product.imageUrl,
            },
          ],
        };
      });
    },
    [updateActiveOrder]
  );

  const handleUpdateQuantity = useCallback(
    (productId: string, delta: number) => {
      updateActiveOrder((order) => {
        const newItems = order.items
          .map((item) => (item.productId === productId ? { ...item, quantity: item.quantity + delta } : item))
          .filter((item) => item.quantity > 0);
        return { ...order, items: newItems };
      });
    },
    [updateActiveOrder]
  );

  const handleRemoveItem = useCallback(
    (productId: string) => {
      updateActiveOrder((order) => ({
        ...order,
        items: order.items.filter((item) => item.productId !== productId),
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

  const handleSetNote = useCallback(
    (note: string) => {
      updateActiveOrder((order) => ({ ...order, note }));
    },
    [updateActiveOrder]
  );

  const handleSetDiscount = useCallback(
    (discountAmount: number) => {
      updateActiveOrder((order) => ({ ...order, discountAmount }));
    },
    [updateActiveOrder]
  );

  // Tabs
  const handleAddTab = useCallback(() => {
    const newOrder = createEmptyOrder();
    setOrders((prev) => [...prev, newOrder]);
    setActiveOrderId(newOrder.id);
  }, []);

  const handleCloseTab = useCallback(
    (orderId: number) => {
      setOrders((prev) => {
        if (prev.length <= 1) return prev;
        const newOrders = prev.filter((o) => o.id !== orderId);
        if (activeOrderId === orderId) {
          setActiveOrderId(newOrders[newOrders.length - 1].id);
        }
        return newOrders;
      });
    },
    [activeOrderId]
  );

  // Product search keyboard shortcut (Enter to add first match)
  const handleProductSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && filteredProducts.length > 0) {
        handleAddProduct(filteredProducts[0]);
        setProductSearch('');
      }
    },
    [filteredProducts, handleAddProduct]
  );

  // Payment
  const handleOpenPayment = useCallback(() => {
    if (activeOrder.items.length === 0) {
      enqueueSnackbar('Chưa có sản phẩm trong đơn hàng', { variant: 'warning' });
      return;
    }
    if (!selectedWarehouse) {
      enqueueSnackbar('Chưa chọn chi nhánh/kho', { variant: 'warning' });
      return;
    }
    setPaymentOpen(true);
  }, [activeOrder.items, selectedWarehouse, enqueueSnackbar]);

  const handleConfirmPayment = useCallback(
    async (payments: { method: string; amount: number; transactionRef?: string; note?: string }[]) => {
      if (!selectedWarehouse) return;

      try {
        await createSalesOrder({
          customerId: activeOrder.customerId || undefined,
          warehouseId: selectedWarehouse.id,
          note: activeOrder.note || undefined,
          discountAmount: activeOrder.discountAmount,
          items: activeOrder.items.map((item) => ({
            productId: item.productId,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            discountAmount: item.discountAmount,
          })),
          payments: payments.filter((p) => p.amount > 0).map((p) => ({
            method: p.method,
            amount: p.amount,
            transactionRef: p.transactionRef,
            note: p.note,
          })),
        });

        enqueueSnackbar('Thanh toán thành công!', { variant: 'success' });
        setPaymentOpen(false);

        // Reset current order
        setOrders((prev) => {
          if (prev.length <= 1) {
            const newOrder = createEmptyOrder();
            setActiveOrderId(newOrder.id);
            return [newOrder];
          }
          const remaining = prev.filter((o) => o.id !== activeOrderId);
          setActiveOrderId(remaining[remaining.length - 1].id);
          return remaining;
        });

        // Refresh products to update stock
        getAllProducts({ isActive: true }).then(setProducts).catch(console.error);
      } catch (error: any) {
        const message = error?.title || error?.message || 'Có lỗi xảy ra khi thanh toán';
        enqueueSnackbar(message, { variant: 'error' });
      }
    },
    [activeOrder, activeOrderId, selectedWarehouse, enqueueSnackbar]
  );

  // Current time
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      {/* TOP BAR */}
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          px: 2,
          py: 1,
          bgcolor: theme.palette.primary.main,
          color: 'white',
          minHeight: 52,
        }}
      >
        {/* Product search */}
        <TextField
          size="small"
          placeholder="Tìm hàng hóa (F3)"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          onKeyDown={handleProductSearchKeyDown}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: 320,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'white',
              borderRadius: 1,
            },
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
                <Stack direction="row" alignItems="center" spacing={0.5}>
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

        {/* Right icons */}
        <Typography variant="caption" sx={{ mr: 2, opacity: 0.8 }}>
          {selectedWarehouse?.name || 'Chọn kho'}
        </Typography>
      </Stack>

      {/* MAIN CONTENT */}
      <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT - Product list */}
        <Box
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            bgcolor: theme.palette.grey[100],
            p: 2,
          }}
        >
          {filteredProducts.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', opacity: 0.5 }}>
              <Iconify icon="solar:box-minimalistic-bold-duotone" width={80} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                {productSearch ? 'Không tìm thấy sản phẩm' : 'Tìm kiếm hoặc quét barcode để thêm sản phẩm'}
              </Typography>
            </Stack>
          ) : (
            <Grid container spacing={1.5}>
              {filteredProducts.map((product) => (
                <Grid xs={6} sm={4} md={3} lg={2} key={product.id}>
                  <Card
                    onClick={() => handleAddProduct(product)}
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      '&:hover': {
                        boxShadow: theme.customShadows?.z8 || theme.shadows[8],
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        pt: '100%',
                        position: 'relative',
                        borderRadius: 1,
                        overflow: 'hidden',
                        bgcolor: theme.palette.grey[200],
                        mb: 1,
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
                            width={32}
                            sx={{ color: theme.palette.grey[400] }}
                          />
                        </Stack>
                      )}
                    </Box>

                    <Typography variant="subtitle2" noWrap>
                      {product.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {product.sku}
                    </Typography>
                    <Typography variant="subtitle2" color="primary.main" sx={{ mt: 0.5 }}>
                      {fCurrency(product.sellingPrice)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Tồn: {product.totalStock}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        {/* RIGHT - Order panel */}
        <Box
          sx={{
            width: 380,
            minWidth: 380,
            borderLeft: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
          }}
        >
          {/* Warehouse + datetime */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1.5 }}>
            {warehouses.length > 0 && (
              <Autocomplete
                size="small"
                options={warehouses.filter((w) => w.isActive)}
                getOptionLabel={(option) => option.name}
                value={selectedWarehouse || undefined}
                onChange={(_, v) => setSelectedWarehouse(v)}
                sx={{ width: 160 }}
                renderInput={(params) => <TextField {...params} placeholder="Chi nhánh" />}
                disableClearable
              />
            )}
            <Typography variant="caption" color="text.secondary">
              {now.toLocaleDateString('vi-VN')} {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Stack>

          {/* Customer search */}
          <Box sx={{ px: 2, pt: 1.5 }}>
            <Autocomplete
              size="small"
              options={customers}
              getOptionLabel={(option) => `${option.name}${option.phone ? ` (${option.phone})` : ''}`}
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
          </Box>

          {/* Cart items */}
          <Box sx={{ flexGrow: 1, overflow: 'auto', px: 2, py: 1 }}>
            {activeOrder.items.length === 0 ? (
              <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', opacity: 0.4 }}>
                <Iconify icon="solar:cart-large-minimalistic-bold-duotone" width={60} />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Chưa có sản phẩm
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={1}>
                {activeOrder.items.map((item) => {
                  const lineTotal = item.quantity * item.unitPrice - item.discountAmount;
                  return (
                    <Paper
                      key={item.productId}
                      variant="outlined"
                      sx={{ p: 1.5, borderRadius: 1 }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" noWrap>
                            {item.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {fCurrency(item.unitPrice)}
                          </Typography>
                        </Box>
                        <IconButton size="small" color="error" onClick={() => handleRemoveItem(item.productId)}>
                          <Iconify icon="mingcute:close-line" width={16} />
                        </IconButton>
                      </Stack>

                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <IconButton
                            size="small"
                            onClick={() => handleUpdateQuantity(item.productId, -1)}
                            sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 0.5, width: 28, height: 28 }}
                          >
                            <Iconify icon="mingcute:minimize-line" width={14} />
                          </IconButton>

                          <Typography variant="body2" sx={{ minWidth: 28, textAlign: 'center', fontWeight: 600 }}>
                            {item.quantity}
                          </Typography>

                          <IconButton
                            size="small"
                            onClick={() => handleUpdateQuantity(item.productId, 1)}
                            sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 0.5, width: 28, height: 28 }}
                          >
                            <Iconify icon="mingcute:add-line" width={14} />
                          </IconButton>
                        </Stack>

                        <Typography variant="subtitle2">{fCurrency(lineTotal)}</Typography>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Box>

          <Divider />

          {/* Order summary */}
          <Box sx={{ px: 2, py: 1.5 }}>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Tổng tiền hàng
                </Typography>
                <Typography variant="body2" sx={{ minWidth: 60, textAlign: 'right' }}>
                  {activeOrder.items.reduce((s, i) => s + i.quantity, 0)}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {fCurrency(subTotal)}
                </Typography>
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
                  onChange={(e) =>
                    updateActiveOrder((order) => ({ ...order, couponCode: e.target.value }))
                  }
                  sx={{ width: 120 }}
                  inputProps={{ style: { textAlign: 'right' } }}
                />
              </Stack>

              <Divider />

              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle1" fontWeight={700}>
                  Khách cần trả
                </Typography>
                <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                  {fCurrency(grandTotal > 0 ? grandTotal : 0)}
                </Typography>
              </Stack>
            </Stack>
          </Box>

          {/* Note */}
          <Box sx={{ px: 2, pb: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Ghi chú đơn hàng"
              value={activeOrder.note}
              onChange={(e) => handleSetNote(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="solar:pen-2-bold" width={18} sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

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
      </Box>

      {/* Bottom tabs */}
      <Stack
        direction="row"
        spacing={0}
        sx={{
          borderTop: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
        }}
      >
        <Chip
          icon={<Iconify icon="solar:bolt-bold" width={18} />}
          label="Bán nhanh"
          variant="filled"
          color="primary"
          sx={{ borderRadius: 0, flex: 1, height: 40, fontWeight: 600 }}
        />
        <Chip
          icon={<Iconify icon="mdi:clock-outline" width={18} />}
          label="Bán thường"
          variant="outlined"
          sx={{ borderRadius: 0, flex: 1, height: 40 }}
        />
        <Chip
          icon={<Iconify icon="solar:delivery-bold" width={18} />}
          label="Bán giao hàng"
          variant="outlined"
          sx={{ borderRadius: 0, flex: 1, height: 40 }}
        />
      </Stack>

      {/* Payment dialog */}
      <PosPaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        totalAmount={grandTotal}
        onConfirm={handleConfirmPayment}
      />
    </Box>
  );
}
