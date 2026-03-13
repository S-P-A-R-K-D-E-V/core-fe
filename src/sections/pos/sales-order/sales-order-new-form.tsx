'use client';

import { useState, useEffect, useCallback } from 'react';
import * as Yup from 'yup';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Unstable_Grid2';
import LoadingButton from '@mui/lab/LoadingButton';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField, RHFSelect } from 'src/components/hook-form';

import { ICustomer, IWarehouse, IProduct, IBarcodeLookup } from 'src/types/corecms-api';
import { createSalesOrder } from 'src/api/sales-orders';
import { getAllCustomers } from 'src/api/customers';
import { getAllWarehouses } from 'src/api/warehouses';
import { getAllProducts } from 'src/api/products';
import BarcodeLookupField from './barcode-lookup-field';

// ----------------------------------------------------------------------

const ItemSchema = Yup.object().shape({
  productId: Yup.string().required('Chọn sản phẩm'),
  productVariantId: Yup.string().optional().default(''),
  quantity: Yup.number().min(1, 'Tối thiểu 1').required('Bắt buộc'),
  unitPrice: Yup.number().min(0).required('Bắt buộc'),
  vatRate: Yup.number().min(0).max(100).default(0),
  discountAmount: Yup.number().min(0).default(0),
});

const PaymentSchema = Yup.object().shape({
  method: Yup.string().required('Chọn hình thức'),
  amount: Yup.number().min(0).required('Bắt buộc'),
  transactionRef: Yup.string().optional().default(''),
  note: Yup.string().optional().default(''),
});

const Schema = Yup.object().shape({
  customerId: Yup.string().default(''),
  warehouseId: Yup.string().required('Chọn kho'),
  note: Yup.string().default(''),
  discountAmount: Yup.number().min(0).default(0),
  items: Yup.array().of(ItemSchema).min(1, 'Phải có ít nhất 1 sản phẩm'),
  payments: Yup.array().of(PaymentSchema),
});

export default function SalesOrderNewForm() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const [customers, setCustomers] = useState<ICustomer[]>([]);
  const [warehouses, setWarehouses] = useState<IWarehouse[]>([]);
  const [products, setProducts] = useState<IProduct[]>([]);

  useEffect(() => {
    Promise.all([getAllCustomers(), getAllWarehouses(), getAllProducts()])
      .then(([c, w, p]) => { setCustomers(c); setWarehouses(w); setProducts(p); })
      .catch(console.error);
  }, []);

  const defaultValues = {
    customerId: '',
    warehouseId: '',
    note: '',
    discountAmount: 0,
    items: [{ productId: '', productVariantId: '', quantity: 1, unitPrice: 0, vatRate: 0, discountAmount: 0 }],
    payments: [{ method: 'Cash', amount: 0, transactionRef: '', note: '' }],
  };

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });
  const { control, watch, setValue, handleSubmit, formState: { isSubmitting } } = methods;

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({ control, name: 'items' });
  const { fields: paymentFields, append: appendPayment, remove: removePayment } = useFieldArray({ control, name: 'payments' });

  const watchItems = watch('items');
  const watchDiscount = watch('discountAmount');
  const watchPayments = watch('payments');

  const subTotal = (watchItems || []).reduce((sum, item) => {
    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0) - (item.discountAmount || 0);
    return sum + lineTotal;
  }, 0);

  const vatTotal = (watchItems || []).reduce((sum, item) => {
    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0) - (item.discountAmount || 0);
    return sum + lineTotal * ((item.vatRate || 0) / 100);
  }, 0);

  const grandTotal = subTotal + vatTotal - (watchDiscount || 0);

  const paidTotal = (watchPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

  // Auto-fill selling price when product is selected
  const handleProductChange = useCallback((index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`items.${index}.unitPrice`, product.sellingPrice);
      setValue(`items.${index}.vatRate`, product.vatRate);
    }
  }, [products, setValue]);

  // Barcode lookup: add or increment product
  const handleBarcodeFound = useCallback((result: IBarcodeLookup) => {
    const currentItems = watch('items') || [];
    const existingIndex = currentItems.findIndex((item) => item.productId === result.productId);

    if (existingIndex >= 0) {
      setValue(`items.${existingIndex}.quantity`, (currentItems[existingIndex].quantity || 0) + 1);
    } else {
      const product = products.find((p) => p.id === result.productId);
      appendItem({
        productId: result.productId,
        productVariantId: '',
        quantity: 1,
        unitPrice: product?.sellingPrice || 0,
        vatRate: product?.vatRate || 0,
        discountAmount: 0,
      });
    }
  }, [watch, setValue, products, appendItem]);

  const watchWarehouseId = watch('warehouseId');

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createSalesOrder({
        customerId: data.customerId || undefined,
        warehouseId: data.warehouseId,
        note: data.note || undefined,
        discountAmount: data.discountAmount || 0,
        items: (data.items || []).map((item) => ({
          productId: item.productId,
          productVariantId: item.productVariantId || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate || 0,
          discountAmount: item.discountAmount || 0,
        })),
        payments: (data.payments || []).filter((p) => p.amount > 0).map((p) => ({
          method: p.method,
          amount: p.amount,
          transactionRef: p.transactionRef || undefined,
          note: p.note || undefined,
        })),
      });
      enqueueSnackbar('Tạo đơn bán hàng thành công!');
      router.push(paths.dashboard.pos.salesOrder.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        {/* Order Info */}
        <Grid xs={12}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>Thông tin đơn hàng</Typography>
            <Box rowGap={3} columnGap={2} display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr 1fr' }}>
              <RHFSelect name="customerId" label="Khách hàng">
                <MenuItem value="">— Khách lẻ —</MenuItem>
                {customers.filter((c) => c.isActive).map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</MenuItem>
                ))}
              </RHFSelect>
              <RHFSelect name="warehouseId" label="Kho xuất">
                <MenuItem value="">— Chọn kho —</MenuItem>
                {warehouses.filter((w) => w.isActive).map((w) => (
                  <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
                ))}
              </RHFSelect>
              <RHFTextField name="note" label="Ghi chú" />
            </Box>
          </Card>
        </Grid>

        {/* Items */}
        <Grid xs={12}>
          <Card sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
              <Typography variant="h6">Sản phẩm</Typography>
              <Button size="small" startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => appendItem({ productId: '', productVariantId: '', quantity: 1, unitPrice: 0, vatRate: 0, discountAmount: 0 })}>
                Thêm dòng
              </Button>
            </Stack>

            <Box sx={{ mb: 2, maxWidth: 400 }}>
              <BarcodeLookupField onProductFound={handleBarcodeFound} warehouseId={watchWarehouseId} />
            </Box>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Sản phẩm</TableCell>
                  <TableCell width={80}>SL</TableCell>
                  <TableCell width={130}>Đơn giá</TableCell>
                  <TableCell width={70}>VAT %</TableCell>
                  <TableCell width={110}>CK</TableCell>
                  <TableCell width={130} align="right">Thành tiền</TableCell>
                  <TableCell width={50} />
                </TableRow>
              </TableHead>
              <TableBody>
                {itemFields.map((field, index) => {
                  const item = watchItems?.[index];
                  const lineTotal = ((item?.quantity || 0) * (item?.unitPrice || 0)) - (item?.discountAmount || 0);
                  const lineVat = lineTotal * ((item?.vatRate || 0) / 100);

                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <RHFSelect name={`items.${index}.productId`} size="small" label=""
                          onChange={(e) => { handleProductChange(index, e.target.value as string); }}>
                          <MenuItem value="">— Chọn —</MenuItem>
                          {products.filter((p) => p.isActive).map((p) => (
                            <MenuItem key={p.id} value={p.id}>{p.name} ({p.sku})</MenuItem>
                          ))}
                        </RHFSelect>
                      </TableCell>
                      <TableCell>
                        <RHFTextField name={`items.${index}.quantity`} size="small" type="number" />
                      </TableCell>
                      <TableCell>
                        <RHFTextField name={`items.${index}.unitPrice`} size="small" type="number" />
                      </TableCell>
                      <TableCell>
                        <RHFTextField name={`items.${index}.vatRate`} size="small" type="number" />
                      </TableCell>
                      <TableCell>
                        <RHFTextField name={`items.${index}.discountAmount`} size="small" type="number" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{fCurrency(lineTotal + lineVat)}</Typography>
                      </TableCell>
                      <TableCell>
                        {itemFields.length > 1 && (
                          <IconButton size="small" color="error" onClick={() => removeItem(index)}>
                            <Iconify icon="solar:trash-bin-trash-bold" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Divider sx={{ my: 3 }} />

            <Stack direction="row" justifyContent="flex-end" spacing={2}>
              <Stack spacing={1} sx={{ textAlign: 'right', minWidth: 240 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Tạm tính:</Typography>
                  <Typography variant="body2">{fCurrency(subTotal)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">VAT:</Typography>
                  <Typography variant="body2">{fCurrency(vatTotal)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Chiết khấu:</Typography>
                  <RHFTextField name="discountAmount" size="small" type="number" sx={{ width: 120 }} />
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle1">Tổng cộng:</Typography>
                  <Typography variant="subtitle1" color="primary">{fCurrency(grandTotal)}</Typography>
                </Stack>
              </Stack>
            </Stack>
          </Card>
        </Grid>

        {/* Payment */}
        <Grid xs={12}>
          <Card sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
              <Typography variant="h6">Thanh toán</Typography>
              <Button size="small" startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => appendPayment({ method: 'Cash', amount: 0, transactionRef: '', note: '' })}>
                Thêm hình thức
              </Button>
            </Stack>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={180}>Hình thức</TableCell>
                  <TableCell width={160}>Số tiền</TableCell>
                  <TableCell>Mã giao dịch</TableCell>
                  <TableCell>Ghi chú</TableCell>
                  <TableCell width={50} />
                </TableRow>
              </TableHead>
              <TableBody>
                {paymentFields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <RHFSelect name={`payments.${index}.method`} size="small" label="">
                        <MenuItem value="Cash">Tiền mặt</MenuItem>
                        <MenuItem value="BankTransfer">Chuyển khoản</MenuItem>
                        <MenuItem value="QRCode">QR Code</MenuItem>
                      </RHFSelect>
                    </TableCell>
                    <TableCell>
                      <RHFTextField name={`payments.${index}.amount`} size="small" type="number" />
                    </TableCell>
                    <TableCell>
                      <RHFTextField name={`payments.${index}.transactionRef`} size="small" />
                    </TableCell>
                    <TableCell>
                      <RHFTextField name={`payments.${index}.note`} size="small" />
                    </TableCell>
                    <TableCell>
                      {paymentFields.length > 1 && (
                        <IconButton size="small" color="error" onClick={() => removePayment(index)}>
                          <Iconify icon="solar:trash-bin-trash-bold" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
              <Stack spacing={1} sx={{ textAlign: 'right', minWidth: 240 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Tổng thanh toán:</Typography>
                  <Typography variant="body2" color={paidTotal >= grandTotal ? 'success.main' : 'warning.main'}>
                    {fCurrency(paidTotal)}
                  </Typography>
                </Stack>
                {grandTotal - paidTotal > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Còn thiếu:</Typography>
                    <Typography variant="body2" color="error.main">{fCurrency(grandTotal - paidTotal)}</Typography>
                  </Stack>
                )}
              </Stack>
            </Stack>

            <Stack alignItems="flex-end" sx={{ mt: 3 }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting} size="large">
                Tạo đơn bán hàng
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
