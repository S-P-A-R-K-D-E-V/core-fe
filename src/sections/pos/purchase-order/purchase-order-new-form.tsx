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
import TextField from '@mui/material/TextField';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField, RHFSelect } from 'src/components/hook-form';

import { ISupplier, IWarehouse, IProduct } from 'src/types/corecms-api';
import { createPurchaseOrder } from 'src/api/purchase-orders';
import { getAllSuppliers } from 'src/api/suppliers';
import { getAllWarehouses } from 'src/api/warehouses';
import { getAllProducts } from 'src/api/products';

// ----------------------------------------------------------------------

const ItemSchema = Yup.object().shape({
  productId: Yup.string().required('Chọn sản phẩm'),
  productVariantId: Yup.string().optional().default(''),
  quantity: Yup.number().min(1, 'Tối thiểu 1').required('Bắt buộc'),
  unitPrice: Yup.number().min(0).required('Bắt buộc'),
  vatRate: Yup.number().min(0).max(100).default(0),
  discountAmount: Yup.number().min(0).default(0),
  note: Yup.string().optional().default(''),
});

const Schema = Yup.object().shape({
  supplierId: Yup.string().required('Chọn nhà cung cấp'),
  warehouseId: Yup.string().required('Chọn kho'),
  note: Yup.string().default(''),
  expectedDate: Yup.string().default(''),
  discountAmount: Yup.number().min(0).default(0),
  items: Yup.array().of(ItemSchema).min(1, 'Phải có ít nhất 1 sản phẩm'),
});

export default function PurchaseOrderNewForm() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [warehouses, setWarehouses] = useState<IWarehouse[]>([]);
  const [products, setProducts] = useState<IProduct[]>([]);

  useEffect(() => {
    Promise.all([getAllSuppliers(), getAllWarehouses(), getAllProducts()])
      .then(([s, w, p]) => { setSuppliers(s); setWarehouses(w); setProducts(p); })
      .catch(console.error);
  }, []);

  const defaultValues = {
    supplierId: '',
    warehouseId: '',
    note: '',
    expectedDate: '',
    discountAmount: 0,
    items: [{ productId: '', productVariantId: '', quantity: 1, unitPrice: 0, vatRate: 0, discountAmount: 0, note: '' }],
  };

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });
  const { control, watch, handleSubmit, formState: { isSubmitting } } = methods;

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const watchItems = watch('items');
  const watchDiscount = watch('discountAmount');

  const subTotal = (watchItems || []).reduce((sum, item) => {
    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0) - (item.discountAmount || 0);
    return sum + lineTotal;
  }, 0);

  const vatTotal = (watchItems || []).reduce((sum, item) => {
    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0) - (item.discountAmount || 0);
    return sum + lineTotal * ((item.vatRate || 0) / 100);
  }, 0);

  const grandTotal = subTotal + vatTotal - (watchDiscount || 0);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await createPurchaseOrder({
        supplierId: data.supplierId,
        warehouseId: data.warehouseId,
        note: data.note || undefined,
        expectedDate: data.expectedDate || undefined,
        discountAmount: data.discountAmount || 0,
        items: (data.items || []).map((item) => ({
          productId: item.productId,
          productVariantId: item.productVariantId || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate || 0,
          discountAmount: item.discountAmount || 0,
          note: item.note || undefined,
        })),
      });
      enqueueSnackbar('Tạo đơn nhập hàng thành công!');
      router.push(paths.dashboard.pos.purchaseOrder.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  });

  const handleAddItem = () => {
    append({ productId: '', productVariantId: '', quantity: 1, unitPrice: 0, vatRate: 0, discountAmount: 0, note: '' });
  };

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid xs={12}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>Thông tin đơn hàng</Typography>
            <Box rowGap={3} columnGap={2} display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr 1fr' }}>
              <RHFSelect name="supplierId" label="Nhà cung cấp">
                <MenuItem value="">— Chọn NCC —</MenuItem>
                {suppliers.filter((s) => s.isActive).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </RHFSelect>
              <RHFSelect name="warehouseId" label="Kho nhập">
                <MenuItem value="">— Chọn kho —</MenuItem>
                {warehouses.filter((w) => w.isActive).map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
              </RHFSelect>
              <RHFTextField name="expectedDate" label="Ngày dự kiến" type="date" InputLabelProps={{ shrink: true }} />
            </Box>
            <RHFTextField name="note" label="Ghi chú" multiline rows={2} sx={{ mt: 3 }} />
          </Card>
        </Grid>

        <Grid xs={12}>
          <Card sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
              <Typography variant="h6">Chi tiết sản phẩm</Typography>
              <Button size="small" startIcon={<Iconify icon="mingcute:add-line" />} onClick={handleAddItem}>
                Thêm dòng
              </Button>
            </Stack>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Sản phẩm</TableCell>
                  <TableCell width={100}>SL</TableCell>
                  <TableCell width={140}>Đơn giá</TableCell>
                  <TableCell width={80}>VAT %</TableCell>
                  <TableCell width={120}>Chiết khấu</TableCell>
                  <TableCell width={140} align="right">Thành tiền</TableCell>
                  <TableCell width={50} />
                </TableRow>
              </TableHead>
              <TableBody>
                {fields.map((field, index) => {
                  const item = watchItems?.[index];
                  const lineTotal = ((item?.quantity || 0) * (item?.unitPrice || 0)) - (item?.discountAmount || 0);
                  const lineVat = lineTotal * ((item?.vatRate || 0) / 100);

                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <RHFSelect name={`items.${index}.productId`} size="small" label="">
                          <MenuItem value="">— Chọn —</MenuItem>
                          {products.map((p) => <MenuItem key={p.id} value={p.id}>{p.name} ({p.sku})</MenuItem>)}
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
                        {fields.length > 1 && (
                          <IconButton size="small" color="error" onClick={() => remove(index)}>
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
                <Stack direction="row" justifyContent="space-between">
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

            <Stack alignItems="flex-end" sx={{ mt: 3 }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting} size="large">
                Tạo đơn nhập hàng
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
