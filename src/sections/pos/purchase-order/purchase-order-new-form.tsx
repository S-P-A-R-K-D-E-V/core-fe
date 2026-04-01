'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as Yup from 'yup';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useBoolean } from 'src/hooks/use-boolean';

import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField, RHFSelect } from 'src/components/hook-form';

import CircularProgress from '@mui/material/CircularProgress';

import { ISupplier, IWarehouse, IProduct, IProductListItem, IProductVariant, IPurchaseOrder } from 'src/types/corecms-api';
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  savePurchaseOrderDraft,
  getPurchaseOrderDraft,
  deletePurchaseOrderDraft,
} from 'src/api/purchase-orders';
import { getAllSuppliers } from 'src/api/suppliers';
import { getAllWarehouses } from 'src/api/warehouses';
import { getAllProducts } from 'src/api/products';

import PurchaseOrderQuickCreateProduct from './purchase-order-quick-create-product';
import PurchaseOrderQuickCreateSupplier from './purchase-order-quick-create-supplier';
import PurchaseOrderVariantPicker from './purchase-order-variant-picker';

// ----------------------------------------------------------------------

type ProductOption = {
  id: string;
  label: string;
  code: string;
  product: IProductListItem;
  variant?: IProductVariant;
  costPrice: number;
  sellingPrice: number;
  vatRate: number;
  attributes: string;
  imageUrl: string;
};

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 25];
const DRAFT_DEBOUNCE_MS = 3000;
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_CHARS = 1;

const ItemSchema = Yup.object().shape({
  productId: Yup.string().required('Chọn sản phẩm'),
  productVariantId: Yup.string().optional().default(''),
  quantity: Yup.number().min(1, 'Tối thiểu 1').required('Bắt buộc'),
  unitPrice: Yup.number().min(0).required('Bắt buộc'),
  vatRate: Yup.number().min(0).max(100).default(0),
  discountType: Yup.string().oneOf(['amount', 'percent']).default('amount'),
  discountAmount: Yup.number().min(0).default(0),
  note: Yup.string().optional().default(''),
  _productName: Yup.string().default(''),
  _productCode: Yup.string().default(''),
  _attributes: Yup.string().default(''),
});

const Schema = Yup.object().shape({
  supplierId: Yup.string().required('Chọn nhà cung cấp'),
  warehouseId: Yup.string().required('Chọn kho'),
  note: Yup.string().default(''),
  expectedDate: Yup.string().default(''),
  discountType: Yup.string().oneOf(['amount', 'percent']).default('amount'),
  discountAmount: Yup.number().min(0).default(0),
  items: Yup.array().of(ItemSchema).min(1, 'Phải có ít nhất 1 sản phẩm'),
});

const EMPTY_ITEM = {
  productId: '',
  productVariantId: '',
  quantity: 1,
  unitPrice: 0,
  vatRate: 0,
  discountType: 'amount' as 'amount' | 'percent',
  discountAmount: 0,
  note: '',
  _productName: '',
  _productCode: '',
  _attributes: '',
};

type Props = {
  currentPurchaseOrder?: IPurchaseOrder;
};

export default function PurchaseOrderNewForm({ currentPurchaseOrder }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const isEdit = !!currentPurchaseOrder;

  const quickCreateProduct = useBoolean();
  const quickCreateSupplier = useBoolean();

  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [warehouses, setWarehouses] = useState<IWarehouse[]>([]);
  const [products, setProducts] = useState<IProductListItem[]>([]);

  // Lazy search state
  const [searchOptions, setSearchOptions] = useState<ProductOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pagination for items table
  const [itemsPage, setItemsPage] = useState(0);
  const [itemsRowsPerPage, setItemsRowsPerPage] = useState(10);
  const [savingDraft, setSavingDraft] = useState(false);

  // Draft recovery
  const [draftData, setDraftData] = useState<any>(null);
  const draftDialogOpen = useBoolean();
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftLoadedRef = useRef(false);

  // Variant picker
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [variantPickerProduct, setVariantPickerProduct] = useState<IProductListItem | null>(null);

  // Product search
  const [productSearchInput, setProductSearchInput] = useState('');

  useEffect(() => {
    Promise.all([getAllSuppliers(), getAllWarehouses()])
      .then(([s, w]) => {
        setSuppliers(s);
        setWarehouses(w);
        // Auto-set default warehouse (only for new orders)
        if (!isEdit) {
          const defaultWh = w.find((wh: IWarehouse) => wh.isDefault && wh.isActive);
          if (defaultWh) {
            setValue('warehouseId', defaultWh.id);
          }
        }
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load draft on mount (skip in edit mode)
  useEffect(() => {
    if (isEdit) return;
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    getPurchaseOrderDraft()
      .then((draft) => {
        if (draft) {
          setDraftData(draft);
          draftDialogOpen.onTrue();
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build flat product options from a product list
  const buildOptions = useCallback((items: IProductListItem[]): ProductOption[] => {
    const opts: ProductOption[] = [];
    items.forEach((p) => {
      if (p.hasVariants && p.variants && p.variants.length > 0) {
        p.variants.forEach((v) => {
          const attrs =
            v.combinations?.map((c) => `${c.attributeName}: ${c.valueName}`).join(', ') || '';
          opts.push({
            id: `${p.id}__${v.id}`,
            label: `${p.name} — ${v.name || v.sku}`,
            code: v.sku || p.code,
            product: p,
            variant: v,
            costPrice: v.costPrice ?? p.costPrice ?? 0,
            sellingPrice: v.sellingPrice ?? p.sellingPrice ?? p.basePrice ?? 0,
            vatRate: p.vatRate || 0,
            attributes: attrs,
            imageUrl: v.imageUrl || p.imageUrl || '',
          });
        });
      } else {
        opts.push({
          id: p.id,
          label: `${p.name}`,
          code: p.sku || p.code,
          product: p,
          costPrice: p.costPrice ?? 0,
          sellingPrice: p.sellingPrice ?? p.basePrice ?? 0,
          vatRate: p.vatRate || 0,
          attributes: '',
          imageUrl: p.imageUrl || '',
        });
      }
    });
    return opts;
  }, []);

  // Lazy search: call API when user types
  const handleSearchInputChange = useCallback(
    (_: any, value: string, reason: string) => {
      setProductSearchInput(value);
      if (reason !== 'input') return;

      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

      if (value.length < SEARCH_MIN_CHARS) {
        setSearchOptions([]);
        setSearchLoading(false);
        return;
      }

      setSearchLoading(true);
      searchTimerRef.current = setTimeout(() => {
        getAllProducts({ keyword: value, pageSize: 20 })
          .then((res) => {
            setProducts((prev) => {
              // Merge new products into local cache (for variant picker)
              const existing = new Set(prev.map((p) => p.id));
              const newItems = res.items.filter((p) => !existing.has(p.id));
              return newItems.length > 0 ? [...prev, ...newItems] : prev;
            });
            setSearchOptions(buildOptions(res.items));
          })
          .catch(() => setSearchOptions([]))
          .finally(() => setSearchLoading(false));
      }, SEARCH_DEBOUNCE_MS);
    },
    [buildOptions]
  );

  const defaultValues = useMemo(() => {
    if (currentPurchaseOrder) {
      return {
        supplierId: currentPurchaseOrder.supplierId || '',
        warehouseId: currentPurchaseOrder.warehouseId || '',
        note: currentPurchaseOrder.note || '',
        expectedDate: currentPurchaseOrder.expectedDate
          ? new Date(currentPurchaseOrder.expectedDate).toISOString().slice(0, 16)
          : '',
        discountType: 'amount' as 'amount' | 'percent',
        discountAmount: currentPurchaseOrder.discountAmount || 0,
        items: (currentPurchaseOrder.items || []).map((item) => ({
          productId: item.productId,
          productVariantId: item.productVariantId || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate || 0,
          discountType: 'amount' as 'amount' | 'percent',
          discountAmount: item.discountAmount || 0,
          note: item.note || '',
          _productName: item.variantName
            ? `${item.productName} — ${item.variantName}`
            : item.productName,
          _productCode: item.productSKU || '',
          _attributes: '',
        })),
      };
    }
    return {
      supplierId: '',
      warehouseId: '',
      note: '',
      expectedDate: '',
      discountType: 'amount' as 'amount' | 'percent',
      discountAmount: 0,
      items: [],
    };
  }, [currentPurchaseOrder]);

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });
  const {
    control,
    watch,
    setValue,
    reset,
    getValues,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const watchItems = watch('items');
  const watchDiscount = watch('discountAmount');
  const watchDiscountType = watch('discountType');

  // Auto-save draft with debounce (skip in edit mode)
  const watchAll = watch();
  useEffect(() => {
    if (isEdit) return;
    // Skip if form is in default state
    const items = watchAll.items || [];
    const hasContent =
      watchAll.supplierId || items.some((i: any) => i.productId);
    if (!hasContent) return;

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      savePurchaseOrderDraft(watchAll).catch(() => {});
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [watchAll]);

  // Helper: compute line discount amount based on discountType
  const getLineDiscount = useCallback((item: any) => {
    const gross = (item.quantity || 0) * (item.unitPrice || 0);
    if (item.discountType === 'percent') {
      return gross * ((item.discountAmount || 0) / 100);
    }
    return item.discountAmount || 0;
  }, []);

  const subTotal = (watchItems || []).reduce((sum, item) => {
    const gross = (item.quantity || 0) * (item.unitPrice || 0);
    return sum + gross - getLineDiscount(item);
  }, 0);

  const vatTotal = (watchItems || []).reduce((sum, item) => {
    const gross = (item.quantity || 0) * (item.unitPrice || 0);
    const lineNet = gross - getLineDiscount(item);
    return sum + lineNet * ((item.vatRate || 0) / 100);
  }, 0);

  // Order-level discount
  const orderDiscount = useMemo(() => {
    if (watchDiscountType === 'percent') {
      return (subTotal + vatTotal) * ((watchDiscount || 0) / 100);
    }
    return watchDiscount || 0;
  }, [watchDiscountType, watchDiscount, subTotal, vatTotal]);

  const grandTotal = subTotal + vatTotal - orderDiscount;

  const buildPayload = (data: any) => {
    // Compute actual order-level discount amount
    const itemsGross = (data.items || []).reduce((s: number, it: any) => {
      const g = (it.quantity || 0) * (it.unitPrice || 0);
      const d = it.discountType === 'percent' ? g * ((it.discountAmount || 0) / 100) : (it.discountAmount || 0);
      const net = g - d;
      return s + net + net * ((it.vatRate || 0) / 100);
    }, 0);
    const orderDiscAmt = data.discountType === 'percent'
      ? itemsGross * ((data.discountAmount || 0) / 100)
      : (data.discountAmount || 0);

    return {
      supplierId: data.supplierId as string,
      warehouseId: data.warehouseId as string,
      note: data.note || undefined,
      expectedDate: data.expectedDate || undefined,
      discountAmount: Math.round(orderDiscAmt * 100) / 100,
      items: (data.items || []).map((item: any) => {
        const gross = (item.quantity || 0) * (item.unitPrice || 0);
        const discAmt = item.discountType === 'percent'
          ? gross * ((item.discountAmount || 0) / 100)
          : (item.discountAmount || 0);
        return {
          productId: item.productId,
          productVariantId: item.productVariantId || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate || 0,
          discountAmount: Math.round(discAmt * 100) / 100,
          note: item.note || undefined,
        };
      }),
    };
  };

  // Submit order
  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = buildPayload(data);
      if (isEdit && currentPurchaseOrder) {
        await updatePurchaseOrder(currentPurchaseOrder.id, payload);
        enqueueSnackbar('Cập nhật đơn nhập hàng thành công!');
        router.push(paths.dashboard.pos.purchaseOrder.details(currentPurchaseOrder.id));
      } else {
        await createPurchaseOrder(payload);
        deletePurchaseOrderDraft().catch(() => {});
        enqueueSnackbar('Tạo đơn nhập hàng thành công!');
        router.push(paths.dashboard.pos.purchaseOrder.list);
      }
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  });

  // Save draft explicitly
  const handleSaveDraft = async () => {
    try {
      setSavingDraft(true);
      await savePurchaseOrderDraft(getValues());
      enqueueSnackbar('Đã lưu bản nháp!');
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Lỗi khi lưu nháp', { variant: 'error' });
    } finally {
      setSavingDraft(false);
    }
  };

  // Restore draft
  const handleRestoreDraft = useCallback(() => {
    if (draftData) {
      reset(draftData);
      enqueueSnackbar('Đã khôi phục bản nháp');
    }
    draftDialogOpen.onFalse();
    setDraftData(null);
  }, [draftData, reset, enqueueSnackbar, draftDialogOpen]);

  const handleDiscardDraft = useCallback(() => {
    deletePurchaseOrderDraft().catch(() => {});
    draftDialogOpen.onFalse();
    setDraftData(null);
  }, [draftDialogOpen]);

  // (Products are only added via the search bar — no empty rows)

  // Quick-add: select from search bar → append as new row (or merge if duplicate)
  const handleQuickAddProduct = useCallback(
    (option: ProductOption | null) => {
      if (!option) return;
      setProductSearchInput('');

      // Check for duplicate: same productId + productVariantId → merge quantity
      const currentItems = getValues('items') || [];
      const dupIndex = currentItems.findIndex(
        (it) => it.productId === option.product.id && (it.productVariantId || '') === (option.variant?.id || '')
      );
      if (dupIndex >= 0) {
        setValue(`items.${dupIndex}.quantity`, (currentItems[dupIndex].quantity || 0) + 1);
        // Navigate to the page containing the merged item
        setItemsPage(Math.floor(dupIndex / itemsRowsPerPage));
        return;
      }

      append({
        productId: option.product.id,
        productVariantId: option.variant?.id || '',
        quantity: 1,
        unitPrice: option.sellingPrice,
        vatRate: option.vatRate,
        discountType: 'amount',
        discountAmount: 0,
        note: '',
        _productName: option.label,
        _productCode: option.code,
        _attributes: option.attributes,
      });
      // Jump to last page
      const newTotal = fields.length + 1;
      const lastPage = Math.floor((newTotal - 1) / itemsRowsPerPage);
      setItemsPage(lastPage);
    },
    [append, fields.length, itemsRowsPerPage, getValues, setValue]
  );

  // Quick-create product callback → auto-add to order
  const handleProductCreated = useCallback(
    (newProduct: IProduct) => {
      setProducts((prev) => [...prev, newProduct]);

      // Check for duplicate
      const currentItems = getValues('items') || [];
      const dupIndex = currentItems.findIndex((it) => it.productId === newProduct.id && !it.productVariantId);
      if (dupIndex >= 0) {
        setValue(`items.${dupIndex}.quantity`, (currentItems[dupIndex].quantity || 0) + 1);
        setItemsPage(Math.floor(dupIndex / itemsRowsPerPage));
        return;
      }

      // Auto-add this new product to the order
      append({
        productId: newProduct.id,
        productVariantId: '',
        quantity: 1,
        unitPrice: newProduct.sellingPrice ?? newProduct.basePrice ?? 0,
        vatRate: newProduct.vatRate ?? 0,
        discountType: 'amount',
        discountAmount: 0,
        note: '',
        _productName: newProduct.name,
        _productCode: newProduct.sku || newProduct.code || '',
        _attributes: '',
      });
      const newTotal = fields.length + 1;
      const lastPage = Math.floor((newTotal - 1) / itemsRowsPerPage);
      setItemsPage(lastPage);
    },
    [append, fields.length, itemsRowsPerPage, getValues, setValue]
  );

  // Quick-create supplier callback
  const handleSupplierCreated = useCallback(
    (newSupplier: ISupplier) => {
      setSuppliers((prev) => [...prev, newSupplier]);
      setValue('supplierId', newSupplier.id);
    },
    [setValue]
  );

  // Variant picker: open from table row action
  const handleOpenVariantPicker = useCallback(
    (index: number) => {
      const item = watchItems?.[index];
      if (!item?.productId) return;
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) return;
      setVariantPickerProduct(prod);
      setVariantPickerOpen(true);
    },
    [watchItems, products]
  );

  // Variant picker: multi-select callback — merge or append items to order
  const handleVariantsSelected = useCallback(
    (items: Array<{ product: IProductListItem; variant?: IProductVariant; quantity: number; sellingPrice: number; attributes: string; label: string; sku: string }>) => {
      const currentItems = getValues('items') || [];
      let addedCount = 0;

      items.forEach((sel) => {
        const dupIndex = currentItems.findIndex(
          (it) => it.productId === sel.product.id && (it.productVariantId || '') === (sel.variant?.id || '')
        );
        if (dupIndex >= 0) {
          // Merge: add quantity to existing row
          setValue(`items.${dupIndex}.quantity`, (currentItems[dupIndex].quantity || 0) + sel.quantity);
        } else {
          append({
            productId: sel.product.id,
            productVariantId: sel.variant?.id || '',
            quantity: sel.quantity,
            unitPrice: sel.sellingPrice,
            vatRate: sel.product.vatRate ?? 0,
            discountType: 'amount',
            discountAmount: 0,
            note: '',
            _productName: sel.variant ? `${sel.product.name} — ${sel.variant.name || sel.variant.sku}` : sel.label,
            _productCode: sel.sku,
            _attributes: sel.attributes,
          });
          addedCount += 1;
        }
      });
      // Jump to last page if new items were added
      if (addedCount > 0) {
        const newTotal = fields.length + addedCount;
        const lastPage = Math.floor((newTotal - 1) / itemsRowsPerPage);
        setItemsPage(lastPage);
      }
    },
    [append, fields.length, itemsRowsPerPage, getValues, setValue]
  );

  // Paginated slice of items
  const paginatedStart = itemsPage * itemsRowsPerPage;
  const paginatedEnd = paginatedStart + itemsRowsPerPage;
  const paginatedFields = fields.slice(paginatedStart, paginatedEnd);

  // Current datetime default
  const nowDatetime = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }, []);

  return (
    <>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <Grid container spacing={3}>
          {/* ====== LEFT PANEL: Product search + Items table ====== */}
          <Grid xs={12} md={8}>
            <Card sx={{ p: 3 }}>
              {/* Product search bar */}
              <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
                <Autocomplete
                  fullWidth
                  size="small"
                  options={searchOptions}
                  loading={searchLoading}
                  filterOptions={(x) => x}
                  getOptionLabel={(o) => (typeof o === 'string' ? o : `${o.code} — ${o.label}`)}
                  inputValue={productSearchInput}
                  onInputChange={handleSearchInputChange}
                  value={null}
                  onChange={(_, val) => handleQuickAddProduct(val)}
                  isOptionEqualToValue={(opt, val) => opt.id === val?.id}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                        {option.imageUrl ? (
                          <Box
                            component="img"
                            src={option.imageUrl}
                            alt={option.label}
                            sx={{ width: 40, height: 40, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 1,
                              bgcolor: 'background.neutral',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Iconify icon="solar:box-bold" width={20} sx={{ color: 'text.disabled' }} />
                          </Box>
                        )}
                        <Stack sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap>
                            <strong>{option.code}</strong> — {option.label}
                          </Typography>
                          {option.attributes && (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.25 }}>
                              {option.attributes.split(', ').map((attr, i) => (
                                <Chip key={i} label={attr} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                              ))}
                            </Stack>
                          )}
                          <Typography variant="caption" color="primary.main">
                          Giá bán: {fCurrency(option.sellingPrice)}
                          </Typography>
                        </Stack>
                        {option.product.hasVariants && (
                          <Chip label="Cùng loại" size="small" color="info" variant="soft" sx={{ flexShrink: 0 }} />
                        )}
                      </Stack>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Tìm theo tên, mã sản phẩm, barcode..."
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled', mr: 1 }} />
                            {params.InputProps.startAdornment}
                          </>
                        ),
                        endAdornment: (
                          <>
                            {searchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  noOptionsText={productSearchInput.length >= SEARCH_MIN_CHARS ? 'Không tìm thấy sản phẩm' : 'Nhập để tìm kiếm...'}
                  blurOnSelect
                  clearOnBlur
                />
                <Tooltip title="Tạo sản phẩm mới">
                  <IconButton color="primary" onClick={quickCreateProduct.onTrue}>
                    <Iconify icon="mingcute:add-line" />
                  </IconButton>
                </Tooltip>
              </Stack>

              {/* Items table header */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">
                  Chi tiết sản phẩm{' '}
                  {fields.length > 0 && (
                    <Chip label={`${fields.length} dòng`} size="small" color="primary" variant="outlined" />
                  )}
                </Typography>
              </Stack>

              {/* Items table */}
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 720 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell width={36}>STT</TableCell>
                      <TableCell width={100}>Mã hàng</TableCell>
                      <TableCell sx={{ minWidth: 200 }}>Tên hàng</TableCell>
                      <TableCell width={70} align="center">SL</TableCell>
                      <TableCell width={110} align="right">Đơn giá</TableCell>
                      <TableCell width={150} align="right">Chiết khấu</TableCell>
                      <TableCell width={120} align="right">Thành tiền</TableCell>
                      <TableCell width={72} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedFields.map((field, pageIndex) => {
                      const realIndex = paginatedStart + pageIndex;
                      const item = watchItems?.[realIndex];
                      const gross = (item?.quantity || 0) * (item?.unitPrice || 0);
                      const lineDiscAmt = item?.discountType === 'percent'
                        ? gross * ((item?.discountAmount || 0) / 100)
                        : (item?.discountAmount || 0);
                      const lineNet = gross - lineDiscAmt;
                      const lineVat = lineNet * ((item?.vatRate || 0) / 100);

                      const productName = item?._productName || '';
                      const productCode = item?._productCode || '';
                      const productAttrs = item?._attributes || '';

                      return (
                        <TableRow key={field.id} hover>
                          {/* STT */}
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {realIndex + 1}
                            </Typography>
                          </TableCell>

                          {/* Mã hàng */}
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {productCode}
                            </Typography>
                          </TableCell>

                          {/* Tên hàng + attributes */}
                          <TableCell>
                            <Stack>
                              <Typography variant="body2" noWrap>
                                {productName}
                              </Typography>
                              {productAttrs && (
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {productAttrs}
                                </Typography>
                              )}
                            </Stack>
                          </TableCell>

                          {/* SL */}
                          <TableCell align="center">
                            <RHFTextField
                              name={`items.${realIndex}.quantity`}
                              size="small"
                              type="number"
                              inputProps={{ min: 1, style: { textAlign: 'center' } }}
                            />
                          </TableCell>

                          {/* Đơn giá */}
                          <TableCell align="right">
                            <RHFTextField
                              name={`items.${realIndex}.unitPrice`}
                              size="small"
                              type="number"
                              inputProps={{ min: 0, style: { textAlign: 'right' } }}
                            />
                          </TableCell>

                          {/* Chiết khấu */}
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                              <RHFTextField
                                name={`items.${realIndex}.discountAmount`}
                                size="small"
                                type="number"
                                inputProps={{ min: 0, style: { textAlign: 'right' } }}
                                sx={{ width: 80 }}
                              />
                              <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={item?.discountType || 'amount'}
                                onChange={(_, v) => { if (v) setValue(`items.${realIndex}.discountType`, v); }}
                                sx={{ height: 32 }}
                              >
                                <ToggleButton value="amount" sx={{ px: 0.75, fontSize: '0.7rem' }}>đ</ToggleButton>
                                <ToggleButton value="percent" sx={{ px: 0.75, fontSize: '0.7rem' }}>%</ToggleButton>
                              </ToggleButtonGroup>
                            </Stack>
                          </TableCell>

                          {/* Thành tiền */}
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="bold">
                              {fCurrency(lineNet + lineVat)}
                            </Typography>
                          </TableCell>

                          {/* Actions: variant picker + delete */}
                          <TableCell>
                            <Stack direction="row" spacing={0}>
                              {item?.productId && (
                                <Tooltip title="Chọn hàng cùng loại">
                                  <IconButton
                                    size="small"
                                    color="info"
                                    onClick={() => handleOpenVariantPicker(realIndex)}
                                  >
                                    <Iconify icon="solar:layers-bold" width={18} />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <IconButton size="small" color="error" onClick={() => remove(realIndex)}>
                                <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {fields.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            Tìm và thêm sản phẩm ở thanh tìm kiếm phía trên
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>

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
            </Card>
          </Grid>

          {/* ====== RIGHT PANEL: Order info + Totals ====== */}
          <Grid xs={12} md={4}>
            <Stack spacing={3}>
              {/* Supplier & Warehouse */}
              <Card sx={{ p: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Thông tin đơn hàng
                </Typography>

                {/* Supplier with quick-create */}
                <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 2 }}>
                  <RHFSelect name="supplierId" label="Nhà cung cấp *" sx={{ flexGrow: 1 }}>
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
                    <IconButton color="primary" onClick={quickCreateSupplier.onTrue} sx={{ mt: 1 }}>
                      <Iconify icon="mingcute:add-line" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <RHFSelect name="warehouseId" label="Kho nhập *" sx={{ mb: 2 }}>
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
                  label="Ngày nhập hàng"
                  type="datetime-local"
                  InputLabelProps={{ shrink: true }}
                  defaultValue={nowDatetime}
                />
              </Card>

              {/* Summary */}
              <Card sx={{ p: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Thanh toán
                </Typography>

                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Tổng tiền hàng ({fields.length} dòng):
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
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <RHFTextField
                        name="discountAmount"
                        size="small"
                        type="number"
                        sx={{ width: 100 }}
                        inputProps={{ min: 0, style: { textAlign: 'right' } }}
                      />
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={watchDiscountType || 'amount'}
                        onChange={(_, v) => { if (v) setValue('discountType', v); }}
                        sx={{ height: 32 }}
                      >
                        <ToggleButton value="amount" sx={{ px: 0.75, fontSize: '0.7rem' }}>đ</ToggleButton>
                        <ToggleButton value="percent" sx={{ px: 0.75, fontSize: '0.7rem' }}>%</ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>
                  </Stack>

                  {watchDiscountType === 'percent' && orderDiscount > 0 && (
                    <Typography variant="caption" color="text.secondary" align="right">
                      = {fCurrency(orderDiscount)}
                    </Typography>
                  )}

                  <Divider />

                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle1">Cần trả NCC:</Typography>
                    <Typography variant="subtitle1" color="primary.main">
                      {fCurrency(grandTotal)}
                    </Typography>
                  </Stack>
                </Stack>
              </Card>

              {/* Notes */}
              <Card sx={{ p: 3 }}>
                <RHFTextField name="note" label="Ghi chú" multiline rows={3} />
              </Card>

              {/* Action buttons */}
              <Stack spacing={1.5}>
                <LoadingButton
                  type="submit"
                  variant="contained"
                  loading={isSubmitting}
                  size="large"
                  fullWidth
                  startIcon={<Iconify icon="eva:checkmark-circle-2-fill" />}
                >
                  {isEdit ? 'Cập nhật đơn nhập hàng' : 'Tạo đơn nhập hàng'}
                </LoadingButton>

                {!isEdit && (
                  <LoadingButton
                    variant="outlined"
                    loading={savingDraft}
                    onClick={handleSaveDraft}
                    fullWidth
                    startIcon={<Iconify icon="solar:document-bold" />}
                  >
                    Lưu nháp
                  </LoadingButton>
                )}
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </FormProvider>

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

      {/* Variant picker */}
      <PurchaseOrderVariantPicker
        open={variantPickerOpen}
        onClose={() => setVariantPickerOpen(false)}
        product={variantPickerProduct}
        allProducts={products}
        onSelect={handleVariantsSelected}
      />

      {/* Draft recovery dialog */}
      <Dialog open={draftDialogOpen.value} maxWidth="xs">
        <DialogTitle>Khôi phục bản nháp</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 1 }}>
            Bạn có bản nháp đơn nhập hàng chưa hoàn thành. Bạn muốn khôi phục hay bỏ qua?
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDiscardDraft} color="inherit">
            Bỏ qua
          </Button>
          <Button onClick={handleRestoreDraft} variant="contained">
            Khôi phục
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
