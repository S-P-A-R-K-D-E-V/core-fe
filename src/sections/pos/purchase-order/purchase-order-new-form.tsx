'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import * as Yup from 'yup';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
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
import TablePagination from '@mui/material/TablePagination';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Tooltip from '@mui/material/Tooltip';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useBoolean } from 'src/hooks/use-boolean';

import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField, RHFSelect } from 'src/components/hook-form';

import { ISupplier, IWarehouse, IProduct, IProductVariant } from 'src/types/corecms-api';
import { createPurchaseOrder } from 'src/api/purchase-orders';
import { getAllSuppliers } from 'src/api/suppliers';
import { getAllWarehouses } from 'src/api/warehouses';
import { getAllProducts } from 'src/api/products';

import PurchaseOrderQuickCreateProduct from './purchase-order-quick-create-product';
import PurchaseOrderQuickCreateSupplier from './purchase-order-quick-create-supplier';

// ----------------------------------------------------------------------

type ProductOption = {
  id: string;
  label: string;
  product: IProduct;
  variant?: IProductVariant;
  costPrice: number;
  vatRate: number;
};

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 25];

const ItemSchema = Yup.object().shape({
  productId: Yup.string().required('Chọn sản phẩm'),
  productVariantId: Yup.string().optional().default(''),
  quantity: Yup.number().min(1, 'Tối thiểu 1').required('Bắt buộc'),
  unitPrice: Yup.number().min(0).required('Bắt buộc'),
  vatRate: Yup.number().min(0).max(100).default(0),
  discountAmount: Yup.number().min(0).default(0),
  note: Yup.string().optional().default(''),
  // Display-only fields (not submitted)
  _productName: Yup.string().default(''),
});

const Schema = Yup.object().shape({
  supplierId: Yup.string().required('Chọn nhà cung cấp'),
  warehouseId: Yup.string().required('Chọn kho'),
  note: Yup.string().default(''),
  expectedDate: Yup.string().default(''),
  discountAmount: Yup.number().min(0).default(0),
  items: Yup.array().of(ItemSchema).min(1, 'Phải có ít nhất 1 sản phẩm'),
});

const EMPTY_ITEM = {
  productId: '',
  productVariantId: '',
  quantity: 1,
  unitPrice: 0,
  vatRate: 0,
  discountAmount: 0,
  note: '',
  _productName: '',
};

export default function PurchaseOrderNewForm() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const quickCreateProduct = useBoolean();
  const quickCreateSupplier = useBoolean();

  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [warehouses, setWarehouses] = useState<IWarehouse[]>([]);
  const [products, setProducts] = useState<IProduct[]>([]);

  // Pagination for items table
  const [itemsPage, setItemsPage] = useState(0);
  const [itemsRowsPerPage, setItemsRowsPerPage] = useState(10);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    Promise.all([getAllSuppliers(), getAllWarehouses(), getAllProducts()])
      .then(([s, w, p]) => {
        setSuppliers(s);
        setWarehouses(w);
        setProducts(p);
      })
      .catch(console.error);
  }, []);

  // Build flat product options (product + variants)
  const productOptions = useMemo<ProductOption[]>(() => {
    const opts: ProductOption[] = [];
    products.forEach((p) => {
      if (p.hasVariants && p.variants && p.variants.length > 0) {
        p.variants.forEach((v) => {
          const combLabel = v.name || v.sku;
          opts.push({
            id: `${p.id}__${v.id}`,
            label: `${p.name} — ${combLabel} (${v.sku})`,
            product: p,
            variant: v,
            costPrice: v.costPrice ?? p.costPrice,
            vatRate: p.vatRate || 0,
          });
        });
      } else {
        opts.push({
          id: p.id,
          label: `${p.name} (${p.sku})`,
          product: p,
          costPrice: p.costPrice,
          vatRate: p.vatRate || 0,
        });
      }
    });
    return opts;
  }, [products]);

  const defaultValues = {
    supplierId: '',
    warehouseId: '',
    note: '',
    expectedDate: '',
    discountAmount: 0,
    items: [{ ...EMPTY_ITEM }],
  };

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });
  const {
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

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

  const buildPayload = (data: any) => ({
    supplierId: data.supplierId as string,
    warehouseId: data.warehouseId as string,
    note: data.note || undefined,
    expectedDate: data.expectedDate || undefined,
    discountAmount: data.discountAmount || 0,
    items: (data.items || []).map((item: any) => ({
      productId: item.productId,
      productVariantId: item.productVariantId || undefined,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate || 0,
      discountAmount: item.discountAmount || 0,
      note: item.note || undefined,
    })),
  });

  // Submit as confirmed order
  const onSubmit = handleSubmit(async (data) => {
    try {
      await createPurchaseOrder(buildPayload(data));
      enqueueSnackbar('Tạo đơn nhập hàng thành công!');
      router.push(paths.dashboard.pos.purchaseOrder.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  });

  // Save as draft
  const handleSaveDraft = handleSubmit(async (data) => {
    try {
      setSavingDraft(true);
      await createPurchaseOrder(buildPayload(data));
      enqueueSnackbar('Lưu đơn nháp thành công!');
      router.push(paths.dashboard.pos.purchaseOrder.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    } finally {
      setSavingDraft(false);
    }
  });

  const handleAddItem = useCallback(() => {
    append({ ...EMPTY_ITEM });
    // Jump to last page after adding
    const newTotal = fields.length + 1;
    const lastPage = Math.floor((newTotal - 1) / itemsRowsPerPage);
    setItemsPage(lastPage);
  }, [append, fields.length, itemsRowsPerPage]);

  // When selecting a product from Autocomplete, auto-fill price/vat
  const handleProductSelect = useCallback(
    (index: number, option: ProductOption | null) => {
      if (option) {
        setValue(`items.${index}.productId`, option.product.id);
        setValue(`items.${index}.productVariantId`, option.variant?.id || '');
        setValue(`items.${index}.unitPrice`, option.costPrice);
        setValue(`items.${index}.vatRate`, option.vatRate);
        setValue(`items.${index}._productName`, option.label);
      } else {
        setValue(`items.${index}.productId`, '');
        setValue(`items.${index}.productVariantId`, '');
        setValue(`items.${index}.unitPrice`, 0);
        setValue(`items.${index}.vatRate`, 0);
        setValue(`items.${index}._productName`, '');
      }
    },
    [setValue]
  );

  // Quick-create product callback
  const handleProductCreated = useCallback(
    (newProduct: IProduct) => {
      setProducts((prev) => [...prev, newProduct]);
    },
    []
  );

  // Quick-create supplier callback
  const handleSupplierCreated = useCallback(
    (newSupplier: ISupplier) => {
      setSuppliers((prev) => [...prev, newSupplier]);
      setValue('supplierId', newSupplier.id);
    },
    [setValue]
  );

  // Paginated slice of items
  const paginatedStart = itemsPage * itemsRowsPerPage;
  const paginatedEnd = paginatedStart + itemsRowsPerPage;
  const paginatedFields = fields.slice(paginatedStart, paginatedEnd);

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        {/* ---- Header info ---- */}
        <Grid xs={12}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Thông tin đơn hàng
            </Typography>
            <Box
              rowGap={3}
              columnGap={2}
              display="grid"
              gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr 1fr' }}
            >
              {/* Supplier with quick-create */}
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <RHFSelect name="supplierId" label="Nhà cung cấp" sx={{ flexGrow: 1 }}>
                  <MenuItem value="">— Chọn NCC —</MenuItem>
                  {suppliers
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                </RHFSelect>
                <Tooltip title="Tạo nhanh NCC">
                  <IconButton
                    color="primary"
                    onClick={quickCreateSupplier.onTrue}
                    sx={{ mt: 1 }}
                  >
                    <Iconify icon="mingcute:add-line" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <RHFSelect name="warehouseId" label="Kho nhập">
                <MenuItem value="">— Chọn kho —</MenuItem>
                {warehouses
                  .filter((w) => w.isActive)
                  .map((w) => (
                    <MenuItem key={w.id} value={w.id}>
                      {w.name}
                    </MenuItem>
                  ))}
              </RHFSelect>
              <RHFTextField
                name="expectedDate"
                label="Ngày dự kiến"
                type="date"
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <RHFTextField name="note" label="Ghi chú" multiline rows={2} sx={{ mt: 3 }} />
          </Card>
        </Grid>

        {/* ---- Items table ---- */}
        <Grid xs={12}>
          <Card sx={{ p: 3 }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 3 }}
            >
              <Typography variant="h6">
                Chi tiết sản phẩm{' '}
                <Chip
                  label={`${fields.length} dòng`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={quickCreateProduct.onTrue}
                >
                  Tạo SP mới
                </Button>
                <Button
                  size="small"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={handleAddItem}
                >
                  Thêm dòng
                </Button>
              </Stack>
            </Stack>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={40}>#</TableCell>
                  <TableCell sx={{ minWidth: 260 }}>Sản phẩm</TableCell>
                  <TableCell width={90}>SL</TableCell>
                  <TableCell width={130}>Đơn giá</TableCell>
                  <TableCell width={70}>VAT %</TableCell>
                  <TableCell width={110}>Chiết khấu</TableCell>
                  <TableCell width={130} align="right">
                    Thành tiền
                  </TableCell>
                  <TableCell width={50} />
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedFields.map((field, pageIndex) => {
                  const realIndex = paginatedStart + pageIndex;
                  const item = watchItems?.[realIndex];
                  const lineTotal =
                    (item?.quantity || 0) * (item?.unitPrice || 0) - (item?.discountAmount || 0);
                  const lineVat = lineTotal * ((item?.vatRate || 0) / 100);

                  // Find current selected option for display
                  const currentOptionId = item?.productVariantId
                    ? `${item.productId}__${item.productVariantId}`
                    : item?.productId || '';
                  const currentOption =
                    productOptions.find((o) => o.id === currentOptionId) || null;

                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {realIndex + 1}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Autocomplete
                          size="small"
                          options={productOptions}
                          getOptionLabel={(o) => (typeof o === 'string' ? o : o.label)}
                          value={currentOption}
                          onChange={(_, val) => handleProductSelect(realIndex, val)}
                          isOptionEqualToValue={(opt, val) => opt.id === val?.id}
                          renderInput={(params) => (
                            <TextField {...params} placeholder="Tìm sản phẩm..." />
                          )}
                          noOptionsText="Không tìm thấy"
                        />
                      </TableCell>
                      <TableCell>
                        <RHFTextField
                          name={`items.${realIndex}.quantity`}
                          size="small"
                          type="number"
                        />
                      </TableCell>
                      <TableCell>
                        <RHFTextField
                          name={`items.${realIndex}.unitPrice`}
                          size="small"
                          type="number"
                        />
                      </TableCell>
                      <TableCell>
                        <RHFTextField
                          name={`items.${realIndex}.vatRate`}
                          size="small"
                          type="number"
                        />
                      </TableCell>
                      <TableCell>
                        <RHFTextField
                          name={`items.${realIndex}.discountAmount`}
                          size="small"
                          type="number"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{fCurrency(lineTotal + lineVat)}</Typography>
                      </TableCell>
                      <TableCell>
                        {fields.length > 1 && (
                          <IconButton size="small" color="error" onClick={() => remove(realIndex)}>
                            <Iconify icon="solar:trash-bin-trash-bold" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {fields.length > ITEMS_PER_PAGE_OPTIONS[0] && (
              <TablePagination
                component="div"
                count={fields.length}
                page={itemsPage}
                onPageChange={(_, newPage) => setItemsPage(newPage)}
                rowsPerPage={itemsRowsPerPage}
                onRowsPerPageChange={(e) => {
                  setItemsRowsPerPage(parseInt(e.target.value, 10));
                  setItemsPage(0);
                }}
                rowsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
                labelRowsPerPage="Dòng/trang:"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
              />
            )}

            <Divider sx={{ my: 3 }} />

            {/* Totals */}
            <Stack direction="row" justifyContent="flex-end" spacing={2}>
              <Stack spacing={1} sx={{ textAlign: 'right', minWidth: 260 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Tạm tính:
                  </Typography>
                  <Typography variant="body2">{fCurrency(subTotal)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    VAT:
                  </Typography>
                  <Typography variant="body2">{fCurrency(vatTotal)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Chiết khấu:
                  </Typography>
                  <RHFTextField
                    name="discountAmount"
                    size="small"
                    type="number"
                    sx={{ width: 120 }}
                  />
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle1">Tổng cộng:</Typography>
                  <Typography variant="subtitle1" color="primary">
                    {fCurrency(grandTotal)}
                  </Typography>
                </Stack>
              </Stack>
            </Stack>

            {/* Action buttons */}
            <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 3 }}>
              <LoadingButton
                variant="outlined"
                loading={savingDraft}
                onClick={handleSaveDraft}
                startIcon={<Iconify icon="solar:document-bold" />}
              >
                Lưu nháp
              </LoadingButton>
              <LoadingButton
                type="submit"
                variant="contained"
                loading={isSubmitting}
                size="large"
              >
                Tạo đơn nhập hàng
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>

      {/* Quick-create dialogs */}
      <PurchaseOrderQuickCreateProduct
        open={quickCreateProduct.value}
        onClose={quickCreateProduct.onFalse}
        onCreated={handleProductCreated}
      />
      <PurchaseOrderQuickCreateSupplier
        open={quickCreateSupplier.value}
        onClose={quickCreateSupplier.onFalse}
        onCreated={handleSupplierCreated}
      />
    </FormProvider>
  );
}
