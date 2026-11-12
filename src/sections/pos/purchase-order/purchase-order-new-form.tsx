'use client';

import * as Yup from 'yup';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import ButtonBase from '@mui/material/ButtonBase';
import Autocomplete from '@mui/material/Autocomplete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useBoolean } from 'src/hooks/use-boolean';
import { FEATURE, useFeatureEnabled } from 'src/hooks/use-feature-enabled';

import { apiErrorMessage } from 'src/utils/api-error';
import { fCurrency } from 'src/utils/format-number';

import { useAuthContext } from 'src/auth/hooks';
import { getShareholders } from 'src/api/shareholders';
import { getAllSuppliers } from 'src/api/suppliers';
import { getAllWarehouses } from 'src/api/warehouses';
import { getAllProducts, getProductUnits, getPurchaseHistory } from 'src/api/products';
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  completePurchaseOrder,
  getPurchaseOrderDraft,
  savePurchaseOrderDraft,
  deletePurchaseOrderDraft,
  getPurchaseOrderCapabilities,
} from 'src/api/purchase-orders';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFSelect, RHFTextField, RHFDateTimePicker } from 'src/components/hook-form';

import {
  IProduct,
  ISupplier,
  IWarehouse,
  IShareholder,
  IProductUnits,
  IPurchaseOrder,
  IProductVariant,
  IProductListItem,
  IPurchaseOrderCapabilities,
  ICompletePurchaseOrderRequest,
} from 'src/types/corecms-api';

import { lineNetOf } from './purchase-line';
import { usePurchaseAccess } from './purchase-access';
import PurchaseNumberInput from './purchase-number-input';
import PurchaseOrderVariantPicker from './purchase-order-variant-picker';
import PurchaseOrderLineRow, { LINE_COLUMNS, LINE_TABLE_MIN_WIDTH } from './purchase-order-line-row';
import PurchaseOrderQuickCreateProduct from './purchase-order-quick-create-product';
import PurchaseOrderQuickCreateSupplier from './purchase-order-quick-create-supplier';

// ----------------------------------------------------------------------
// Màn tạo / sửa phiếu nhập — bố cục theo KiotViet (cửa hàng quen tay): bảng hàng rộng bên trái với ô tìm hàng (F3,
// quét mã vạch + Enter), khung phải gọn: người nhập, NCC, số hoá đơn, tổng, trả NCC (F8), công nợ, ghi chú. Hai nút:
// "Lưu tạm" (phiếu tạm, sửa tiếp được) và "Hoàn thành" (một lần bấm là nhập kho — POST purchase-orders/complete).
// ----------------------------------------------------------------------

type ProductOption = {
  id: string;
  label: string;
  code: string;
  barcode: string;
  product: IProductListItem;
  variant?: IProductVariant;
  costPrice: number;
  sellingPrice: number;
  stock?: number;
  vatRate: number;
  attributes: string;
  imageUrl: string;
};

type PayMethod = 'Cash' | 'Transfer' | 'Till';

const PAY_METHODS: { value: PayMethod; label: string }[] = [
  { value: 'Cash', label: 'Tiền mặt' },
  { value: 'Transfer', label: 'Chuyển khoản' },
  { value: 'Till', label: 'Từ quầy' },
];

const DRAFT_DEBOUNCE_MS = 3000;
const SEARCH_DEBOUNCE_MS = 300;

const ItemSchema = Yup.object().shape({
  productId: Yup.string().required('Chọn sản phẩm'),
  productVariantId: Yup.string().optional().default(''),
  // Số lẻ được (0,5 thùng, 2,5 kg) — M7 bước 1.
  quantity: Yup.number().typeError('Nhập số lượng').moreThan(0, 'Số lượng phải lớn hơn 0').required('Nhập số lượng'),
  unitPrice: Yup.number().typeError('Nhập đơn giá').min(0).required('Nhập đơn giá'),
  vatRate: Yup.number().min(0).max(100).default(0),
  discountType: Yup.string().oneOf(['amount', 'percent']).default('amount'),
  discountAmount: Yup.number().min(0).default(0),
  note: Yup.string().optional().default(''),
  _productName: Yup.string().default(''),
  _productCode: Yup.string().default(''),
  _attributes: Yup.string().default(''),
  // Đơn vị nhập + hệ số về đơn vị gốc (GET products/{id}/units); trống = đơn vị gốc.
  unitId: Yup.string().default(''),
  unitName: Yup.string().default(''),
  conversionFactor: Yup.number().default(1),
  // Thành tiền trước VAT nhập tay (hoá đơn chỉ ghi thành tiền) — có thì thắng đơn giá.
  lineTotal: Yup.number().nullable().default(null),
  expiryDate: Yup.string().default(''),
  _rowKey: Yup.string().default(''),
  _baseUnitName: Yup.string().default(''),
  _itemKind: Yup.string().default(''),
});

const Schema = Yup.object().shape({
  supplierId: Yup.string().required('Chọn nhà cung cấp'),
  warehouseId: Yup.string().required('Chọn kho nhập'),
  note: Yup.string().default(''),
  invoiceNumber: Yup.string().default(''),
  expectedDate: Yup.string().default(''),
  discountType: Yup.string().oneOf(['amount', 'percent']).default('amount'),
  discountAmount: Yup.number().min(0).default(0),
  items: Yup.array().of(ItemSchema).min(1, 'Phiếu chưa có hàng nào'),
  paidByShareholderId: Yup.string().nullable().default(null),
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
  unitId: '',
  unitName: '',
  conversionFactor: 1,
  lineTotal: null as number | null,
  expiryDate: '',
  _rowKey: '',
  _baseUnitName: '',
  _itemKind: '',
};

/** Khoá dòng để gắn đơn vị / giá mặc định (tải bất đồng bộ) đúng dòng vừa thêm. */
const newRowKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Ghi chú gửi lên: số hoá đơn NCC (chưa có cột riêng) đứng đầu ghi chú — KiotViet cũng nhận ghi chú này. */
const INVOICE_PREFIX = /^HĐ\s+([^·\n]+?)\s*(?:·\s*|$)/;

function splitNote(note: string | undefined | null): { invoiceNumber: string; note: string } {
  const text = note || '';
  const match = text.match(INVOICE_PREFIX);
  if (!match) return { invoiceNumber: '', note: text };
  return { invoiceNumber: match[1].trim(), note: text.slice(match[0].length) };
}

function joinNote(invoiceNumber: string, note: string): string | undefined {
  const parts = [invoiceNumber.trim() ? `HĐ ${invoiceNumber.trim()}` : '', note.trim()].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

/** Tên hiển thị của mã cùng loại: bỏ phần lặp "Kẹp phồng tóc — Kẹp phồng tóc". */
function variantLabel(product: IProductListItem, variant: IProductVariant, attrs: string): string {
  const variantName = (variant.name || '').trim();
  if (!variantName || variantName === product.name.trim()) return attrs ? `${product.name} — ${attrs}` : product.name;
  if (variantName.startsWith(product.name.trim())) return variantName;
  return `${product.name} — ${variantName}`;
}

/**
 * Giá vốn thật của hàng = giá vốn trên dòng tồn (KiotViet / core tính bình quân). Không dùng costPrice của danh sách
 * hàng: api/products gán costPrice = giá bán khi máy chủ không trả giá vốn. Chưa có giá vốn → undefined.
 */
function inventoryCost(inventories?: { cost?: number }[]): number | undefined {
  const cost = inventories?.map((inv) => inv.cost ?? 0).find((c) => c > 0);
  return cost ? Math.round(cost) : undefined;
}

const nowLocalIso = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

type Props = {
  currentPurchaseOrder?: IPurchaseOrder;
};

export default function PurchaseOrderNewForm({ currentPurchaseOrder }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const isEdit = !!currentPurchaseOrder;

  const quickCreateProduct = useBoolean();
  const quickCreateSupplier = useBoolean();
  const confirmComplete = useBoolean();

  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [warehouses, setWarehouses] = useState<IWarehouse[]>([]);
  const [products, setProducts] = useState<IProductListItem[]>([]);
  const [shareholders, setShareholders] = useState<IShareholder[]>([]);
  const [capabilities, setCapabilities] = useState<IPurchaseOrderCapabilities | null>(null);
  const shareholdersOn = useFeatureEnabled(FEATURE.shareholders);

  // Ô tìm hàng
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchOptions, setSearchOptions] = useState<ProductOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [productSearchInput, setProductSearchInput] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);

  // Bản nháp tự lưu (Redis) — khôi phục khi mở lại màn tạo phiếu
  const [draftData, setDraftData] = useState<any>(null);
  const draftDialogOpen = useBoolean();
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftLoadedRef = useRef(false);

  // Chọn hàng cùng loại
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [variantPickerProduct, setVariantPickerProduct] = useState<IProductListItem | null>(null);

  // Trả NCC ngay (F8) + đối chiếu tổng in trên hoá đơn giấy
  const payInputRef = useRef<HTMLInputElement | null>(null);
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payMethod, setPayMethod] = useState<PayMethod>('Cash');
  const [invoiceTotal, setInvoiceTotal] = useState<number | ''>('');
  const [saving, setSaving] = useState<'temp' | 'complete' | null>(null);
  const paymentIdRef = useRef<string | null>(null);

  const defaultValues = useMemo(() => {
    if (currentPurchaseOrder) {
      const { invoiceNumber, note } = splitNote(currentPurchaseOrder.note);
      return {
        supplierId: currentPurchaseOrder.supplierId || '',
        warehouseId: currentPurchaseOrder.warehouseId || '',
        note,
        invoiceNumber,
        expectedDate: currentPurchaseOrder.expectedDate
          ? new Date(currentPurchaseOrder.expectedDate).toISOString().slice(0, 16)
          : '',
        discountType: 'amount' as 'amount' | 'percent',
        discountAmount: currentPurchaseOrder.discountAmount || 0,
        paidByShareholderId: currentPurchaseOrder.paidByShareholderId || null,
        items: (currentPurchaseOrder.items || []).map((item) => ({
          ...EMPTY_ITEM,
          productId: item.productId,
          productVariantId: item.productVariantId || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate || 0,
          discountAmount: item.discountAmount || 0,
          note: item.note || '',
          _productName: item.variantName ? `${item.productName} — ${item.variantName}` : item.productName,
          _productCode: item.productCode || '',
          unitId: item.unitId || '',
          unitName: item.unitName || '',
          conversionFactor: item.conversionFactor || 1,
          expiryDate: item.expiryDate || '',
          _rowKey: item.id,
        })),
      };
    }
    return {
      supplierId: '',
      warehouseId: '',
      note: '',
      invoiceNumber: '',
      expectedDate: nowLocalIso(),
      discountType: 'amount' as 'amount' | 'percent',
      discountAmount: 0,
      paidByShareholderId: null,
      items: [],
    };
  }, [currentPurchaseOrder]);

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });
  const { control, watch, setValue, reset, getValues, handleSubmit, formState } = methods;
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const access = usePurchaseAccess();
  const { canSeeCost } = access;

  useEffect(() => {
    Promise.all([getAllSuppliers(), getAllWarehouses()])
      .then(([s, w]) => {
        setSuppliers(s);
        setWarehouses(w);
        if (!isEdit && !getValues('warehouseId')) {
          const active = w.filter((wh: IWarehouse) => wh.isActive);
          const defaultWh = active.find((wh: IWarehouse) => wh.isDefault) ?? (active.length === 1 ? active[0] : undefined);
          if (defaultWh) setValue('warehouseId', defaultWh.id);
        }
      })
      .catch(console.error);
    getPurchaseOrderCapabilities()
      .then(setCapabilities)
      .catch(() =>
        setCapabilities({ kiotVietConnected: false, canComplete: false, canPayOnComplete: false, completeBlockedReason: null })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (shareholdersOn) getShareholders(true).then(setShareholders).catch(() => {});
  }, [shareholdersOn]);

  // Bản nháp chưa xong lần trước (chỉ màn tạo mới)
  useEffect(() => {
    if (isEdit || draftLoadedRef.current) return;
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

  // F3: về ô tìm hàng; F8: ô tiền trả NCC — như KiotViet.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'F3') {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (event.key === 'F8' && payInputRef.current) {
        event.preventDefault();
        payInputRef.current.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- Tìm hàng ----------
  const buildOptions = useCallback((items: IProductListItem[]): ProductOption[] => {
    const opts: ProductOption[] = [];
    items.forEach((p) => {
      if (p.hasVariants && p.variants && p.variants.length > 0) {
        p.variants.forEach((v) => {
          const attrs = v.combinations?.map((c) => `${c.attributeName}: ${c.valueName}`).join(', ') || '';
          const child = p.childProducts?.find((c) => c.id === v.id);
          opts.push({
            id: `${p.id}__${v.id}`,
            label: variantLabel(p, v, attrs),
            code: v.sku || p.code,
            barcode: v.barcode || '',
            product: p,
            variant: v,
            costPrice: inventoryCost(child?.inventories) ?? 0,
            sellingPrice: v.sellingPrice ?? p.sellingPrice ?? p.basePrice ?? 0,
            stock: v.totalStock,
            vatRate: p.vatRate || 0,
            attributes: attrs,
            imageUrl: v.imageUrl || p.imageUrl || '',
          });
        });
      } else {
        opts.push({
          id: p.id,
          label: p.name,
          code: p.sku || p.code,
          barcode: p.barcode || p.barCode || '',
          product: p,
          costPrice: inventoryCost(p.inventories) ?? 0,
          sellingPrice: p.sellingPrice ?? p.basePrice ?? 0,
          stock: p.totalStock,
          vatRate: p.vatRate || 0,
          attributes: '',
          imageUrl: p.imageUrl || p.coverImageUrl || '',
        });
      }
    });
    return opts;
  }, []);

  const searchProducts = useCallback(
    async (keyword: string) => {
      const res = await getAllProducts({ keyword, pageSize: 20 });
      setProducts((prev) => {
        const existing = new Set(prev.map((p) => p.id));
        const fresh = res.items.filter((p) => !existing.has(p.id));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
      return buildOptions(res.items);
    },
    [buildOptions]
  );

  const handleSearchInputChange = useCallback(
    (_: unknown, value: string, reason: string) => {
      setProductSearchInput(value);
      if (reason !== 'input') return;
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      // Xoá kết quả cũ ngay: Enter của máy quét mã không được chọn nhầm dòng của lần tìm trước.
      setSearchOptions([]);
      if (!value.trim()) {
        setSearchLoading(false);
        return;
      }
      setSearchLoading(true);
      const seq = ++searchSeqRef.current;
      searchTimerRef.current = setTimeout(() => {
        searchProducts(value.trim())
          .then((opts) => {
            if (seq === searchSeqRef.current) setSearchOptions(opts);
          })
          .catch(() => setSearchOptions([]))
          .finally(() => {
            if (seq === searchSeqRef.current) setSearchLoading(false);
          });
      }, SEARCH_DEBOUNCE_MS);
    },
    [searchProducts]
  );

  // ---------- Đơn vị nhập + giá mặc định (M7 bước 1) ----------
  const [unitsByProduct, setUnitsByProduct] = useState<Record<string, IProductUnits>>({});
  const unitsRequests = useRef<Record<string, Promise<IProductUnits | null>>>({});

  const loadUnits = useCallback((productId: string) => {
    if (!unitsRequests.current[productId]) {
      unitsRequests.current[productId] = getProductUnits(productId)
        .then((units) => {
          setUnitsByProduct((prev) => ({ ...prev, [productId]: units }));
          return units;
        })
        .catch(() => null);
    }
    return unitsRequests.current[productId];
  }, []);

  /**
   * Gắn đơn vị nhập mặc định và giá nhập mặc định cho dòng vừa thêm: giá nhập gần nhất cùng đơn vị → giá nhập gần nhất
   * theo đơn vị gốc × hệ số → giá vốn × hệ số. Không bao giờ lấy giá bán. Chỉ đổi giá khi người dùng chưa sửa.
   */
  const applyLineDefaults = useCallback(
    async (rowKey: string, productId: string, baseCost: number, placeholderPrice: number) => {
      const units = await loadUnits(productId);
      const option = units?.units.find((u) => u.isDefaultPurchase) ?? units?.units[0];
      const factor = option?.factor ?? 1;

      let price = Math.round(baseCost * factor * 100) / 100;
      if (canSeeCost) {
        try {
          const history = await getPurchaseHistory(productId, 10);
          const sameUnit = history.find((h) => (h.unitId ?? null) === (option?.unitId ?? null));
          if (sameUnit) price = sameUnit.unitPrice;
          else if (history[0]?.baseUnitCost) price = Math.round(history[0].baseUnitCost * factor * 100) / 100;
        } catch {
          // Không có lịch sử → giữ giá theo giá vốn.
        }
      }

      const items = getValues('items') || [];
      const index = items.findIndex((it: any) => it._rowKey === rowKey);
      if (index < 0) return;
      setValue(`items.${index}.unitId`, option?.unitId ?? '');
      setValue(`items.${index}.unitName`, option?.name ?? '');
      setValue(`items.${index}.conversionFactor`, factor);
      setValue(`items.${index}._baseUnitName`, units?.baseUnitName ?? '');
      if (Number(items[index].unitPrice) === placeholderPrice) setValue(`items.${index}.unitPrice`, price);
    },
    [loadUnits, canSeeCost, getValues, setValue]
  );

  // Phiếu đang sửa / bản nháp khôi phục: tải đơn vị của các hàng đã có.
  useEffect(() => {
    (getValues('items') || []).forEach((it: any) => {
      if (it.productId) loadUnits(it.productId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.length]);

  /** Thêm một dòng (hoặc +1 số lượng nếu hàng đã có trên phiếu), rồi về lại ô tìm hàng. */
  const addLine = useCallback(
    (line: {
      product: { id: string; itemKind?: string };
      variantId?: string;
      name: string;
      code: string;
      attributes?: string;
      quantity: number;
      baseCost: number;
      vatRate: number;
    }) => {
      const currentItems = getValues('items') || [];
      const dupIndex = currentItems.findIndex(
        (it: any) => it.productId === line.product.id && (it.productVariantId || '') === (line.variantId || '')
      );
      if (dupIndex >= 0) {
        setValue(`items.${dupIndex}.quantity`, (Number(currentItems[dupIndex].quantity) || 0) + line.quantity);
        setValue(`items.${dupIndex}.lineTotal`, null);
        return;
      }
      const rowKey = newRowKey();
      append({
        ...EMPTY_ITEM,
        productId: line.product.id,
        productVariantId: line.variantId || '',
        quantity: line.quantity,
        unitPrice: line.baseCost,
        vatRate: line.vatRate,
        _productName: line.name,
        _productCode: line.code,
        _attributes: line.attributes || '',
        _rowKey: rowKey,
        _itemKind: line.product.itemKind || '',
      });
      void applyLineDefaults(rowKey, line.product.id, line.baseCost, line.baseCost);
    },
    [append, getValues, setValue, applyLineDefaults]
  );

  const addOption = useCallback(
    (option: ProductOption | null) => {
      if (!option) return;
      addLine({
        product: option.product,
        variantId: option.variant?.id,
        name: option.label,
        code: option.code,
        attributes: option.variant ? '' : option.attributes,
        quantity: 1,
        baseCost: option.costPrice || 0,
        vatRate: option.vatRate,
      });
      setProductSearchInput('');
      setSearchOptions([]);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    },
    [addLine]
  );

  /** Enter khi chưa có gợi ý (máy quét mã gõ nhanh hơn lần tìm): tìm ngay, thêm nếu đúng một mã / mã vạch khớp. */
  const handleSearchEnter = useCallback(async (typed: string) => {
    const keyword = typed.trim();
    if (!keyword) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchSeqRef.current += 1;
    setSearchLoading(true);
    try {
      const opts = await searchProducts(keyword);
      const key = keyword.toLowerCase();
      const exact = opts.filter((o) => o.code.toLowerCase() === key || (o.barcode && o.barcode.toLowerCase() === key));
      if (exact.length === 1) addOption(exact[0]);
      else if (opts.length === 1) addOption(opts[0]);
      else setSearchOptions(opts);
      if (opts.length === 0) enqueueSnackbar(`Không tìm thấy hàng "${keyword}"`, { variant: 'warning' });
    } catch {
      enqueueSnackbar('Không tìm được hàng — thử lại', { variant: 'error' });
    } finally {
      setSearchLoading(false);
    }
  }, [searchProducts, addOption, enqueueSnackbar]);

  const handleProductCreated = useCallback(
    (newProduct: IProduct) => {
      setProducts((prev) => [...prev, newProduct as unknown as IProductListItem]);
      addLine({
        product: newProduct,
        name: newProduct.name,
        code: newProduct.sku || newProduct.code || '',
        quantity: 1,
        baseCost: newProduct.costPrice ?? 0,
        vatRate: newProduct.vatRate ?? 0,
      });
    },
    [addLine]
  );

  const handleSupplierCreated = useCallback(
    (newSupplier: ISupplier) => {
      setSuppliers((prev) => [...prev, newSupplier]);
      setValue('supplierId', newSupplier.id, { shouldValidate: true });
    },
    [setValue]
  );

  const handleOpenVariantPicker = useCallback(
    (index: number) => {
      const productId = getValues(`items.${index}.productId`);
      const prod = products.find((p) => p.id === productId);
      if (!prod) return;
      setVariantPickerProduct(prod);
      setVariantPickerOpen(true);
    },
    [getValues, products]
  );

  const handleVariantsSelected = useCallback(
    (
      items: Array<{
        product: IProductListItem;
        variant?: IProductVariant;
        quantity: number;
        sellingPrice: number;
        attributes: string;
        label: string;
        sku: string;
      }>
    ) => {
      items.forEach((sel) => {
        addLine({
          product: sel.product,
          variantId: sel.variant?.id,
          name: sel.variant ? variantLabel(sel.product, sel.variant, sel.attributes) : sel.label,
          code: sel.sku,
          quantity: sel.quantity,
          baseCost:
            inventoryCost(
              sel.variant
                ? sel.product.childProducts?.find((c) => c.id === sel.variant!.id)?.inventories
                : sel.product.inventories
            ) ?? 0,
          vatRate: sel.product.vatRate ?? 0,
        });
      });
    },
    [addLine]
  );

  // ---------- Tổng ----------
  const watchItems = watch('items');
  const watchDiscount = watch('discountAmount');
  const watchDiscountType = watch('discountType');
  const watchPaidBy = watch('paidByShareholderId');
  const watchSupplierId = watch('supplierId');

  const subTotal = (watchItems || []).reduce((sum: number, item: any) => sum + lineNetOf(item), 0);
  const vatTotal = (watchItems || []).reduce(
    (sum: number, item: any) => sum + lineNetOf(item) * ((Number(item.vatRate) || 0) / 100),
    0
  );
  const totalQuantity = (watchItems || []).reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
  const orderDiscount =
    watchDiscountType === 'percent' ? (subTotal + vatTotal) * ((Number(watchDiscount) || 0) / 100) : Number(watchDiscount) || 0;
  const grandTotal = Math.max(0, subTotal + vatTotal - orderDiscount);

  const canPay = !!capabilities?.canPayOnComplete && !watchPaidBy;
  const paid = canPay && payAmount !== '' ? Math.min(Number(payAmount), grandTotal) : 0;
  const debt = grandTotal - paid;

  // Bản nháp tự lưu (chỉ màn tạo mới)
  const watchAll = watch();
  useEffect(() => {
    if (isEdit) return undefined;
    const items = watchAll.items || [];
    if (!watchAll.supplierId && !items.some((i: any) => i.productId)) return undefined;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      savePurchaseOrderDraft(watchAll).catch(() => {});
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [watchAll, isEdit]);

  const handleRestoreDraft = useCallback(() => {
    if (draftData) {
      reset({ ...defaultValues, ...draftData });
      enqueueSnackbar('Đã khôi phục bản nháp');
    }
    draftDialogOpen.onFalse();
    setDraftData(null);
  }, [draftData, reset, defaultValues, enqueueSnackbar, draftDialogOpen]);

  const handleDiscardDraft = useCallback(() => {
    deletePurchaseOrderDraft().catch(() => {});
    draftDialogOpen.onFalse();
    setDraftData(null);
  }, [draftDialogOpen]);

  // ---------- Gửi ----------
  const buildPayload = (data: any) => {
    const itemsGross = (data.items || []).reduce((s: number, it: any) => {
      const net = lineNetOf(it);
      return s + net + net * ((Number(it.vatRate) || 0) / 100);
    }, 0);
    const orderDiscAmt =
      data.discountType === 'percent' ? itemsGross * ((Number(data.discountAmount) || 0) / 100) : Number(data.discountAmount) || 0;

    return {
      supplierId: data.supplierId as string,
      warehouseId: data.warehouseId as string,
      note: joinNote(data.invoiceNumber || '', data.note || ''),
      expectedDate: data.expectedDate || undefined,
      discountAmount: Math.round(orderDiscAmt * 100) / 100,
      paidByShareholderId: data.paidByShareholderId || null,
      items: (data.items || []).map((item: any) => {
        const gross = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
        const discAmt =
          item.discountType === 'percent' ? gross * ((Number(item.discountAmount) || 0) / 100) : Number(item.discountAmount) || 0;
        return {
          productId: item.productId,
          productVariantId: item.productVariantId || undefined,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          vatRate: Number(item.vatRate) || 0,
          discountAmount: Math.round(discAmt * 100) / 100,
          note: item.note || undefined,
          unitId: item.unitId || undefined,
          lineTotal:
            item.lineTotal !== null && item.lineTotal !== undefined && item.lineTotal !== ''
              ? Number(item.lineTotal)
              : undefined,
          expiryDate: item.expiryDate || undefined,
        };
      }),
    };
  };

  const onInvalid = useCallback(
    (errors: any) => {
      const first =
        errors.items?.message ||
        errors.supplierId?.message ||
        errors.warehouseId?.message ||
        (Array.isArray(errors.items) &&
          errors.items.map((e: any) => e && (e.quantity?.message || e.unitPrice?.message)).find(Boolean));
      enqueueSnackbar(first || 'Kiểm tra lại phiếu', { variant: 'warning' });
    },
    [enqueueSnackbar]
  );

  /** Lưu tạm = phiếu tạm trong hệ thống (sửa / hoàn thành tiếp được). */
  const handleSaveTemp = handleSubmit(async (data) => {
    setSaving('temp');
    try {
      const payload = buildPayload(data);
      if (isEdit && currentPurchaseOrder) {
        await updatePurchaseOrder(currentPurchaseOrder.id, payload);
        enqueueSnackbar(`Đã lưu tạm ${currentPurchaseOrder.orderNumber}`);
        router.push(paths.dashboard.pos.purchaseOrder.details(currentPurchaseOrder.id));
      } else {
        const created = await createPurchaseOrder(payload);
        deletePurchaseOrderDraft().catch(() => {});
        enqueueSnackbar('Đã lưu tạm phiếu nhập');
        router.push(paths.dashboard.pos.purchaseOrder.details(created.id));
      }
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không lưu được phiếu'), { variant: 'error' });
    } finally {
      setSaving(null);
    }
  }, onInvalid);

  const handleAskComplete = handleSubmit(() => {
    if (!paymentIdRef.current) paymentIdRef.current = crypto.randomUUID();
    confirmComplete.onTrue();
  }, onInvalid);

  const handleComplete = async () => {
    setSaving('complete');
    try {
      const payload = buildPayload(getValues());
      const request: ICompletePurchaseOrderRequest = {};
      if (isEdit && currentPurchaseOrder) {
        await updatePurchaseOrder(currentPurchaseOrder.id, payload);
        request.existingOrderId = currentPurchaseOrder.id;
      } else {
        request.order = payload;
      }
      if (canPay && paid > 0) {
        request.payment = {
          amount: paid,
          method: payMethod === 'Transfer' ? 'Transfer' : 'Cash',
          fromTill: payMethod === 'Till',
          id: paymentIdRef.current ?? undefined,
        };
      }

      const result = await completePurchaseOrder(request);
      if (!isEdit) deletePurchaseOrderDraft().catch(() => {});
      confirmComplete.onFalse();

      if (result.completed) {
        enqueueSnackbar(
          result.kiotVietCode
            ? `Đã nhập hàng ${result.orderNumber} — KiotViet ${result.kiotVietCode}`
            : `Đã nhập hàng ${result.orderNumber}`
        );
        router.push(paths.dashboard.pos.purchaseOrder.details(result.id));
      } else {
        // Phiếu đã lưu tạm; KiotViet chưa nhận → sửa rồi bấm Hoàn thành lại ở màn sửa.
        enqueueSnackbar(`Đã lưu tạm ${result.orderNumber} nhưng chưa hoàn thành: ${result.kiotVietError}`, {
          variant: 'warning',
          autoHideDuration: 10000,
        });
        router.push(paths.dashboard.pos.purchaseOrder.edit(result.id));
      }
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không hoàn thành được phiếu'), { variant: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const activeWarehouses = warehouses.filter((w) => w.isActive);
  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.isActive), [suppliers]);
  const selectedSupplier = suppliers.find((s) => s.id === watchSupplierId) ?? null;
  const supplierError = formState.errors.supplierId?.message as string | undefined;
  const completeBlocked = capabilities && !capabilities.canComplete ? capabilities.completeBlockedReason : null;

  // ---------- Giao diện ----------
  const renderSearch = (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5, borderBottom: (t) => `1px solid ${t.palette.divider}` }}>
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
        // freeSolo: Enter khi chưa có gợi ý (đang tìm / máy quét mã gõ nhanh hơn lần tìm) trả về chữ đã gõ → tìm ngay.
        freeSolo
        onChange={(_, val) => {
          if (typeof val === 'string') void handleSearchEnter(val);
          else addOption(val);
        }}
        isOptionEqualToValue={(opt, val) => opt.id === val?.id}
        autoHighlight
        clearOnBlur={false}
        loadingText="Đang tìm…"
        ListboxProps={{ style: { maxHeight: 440 } }}
        // Gợi ý rộng hơn ô tìm (như KiotViet) để mã, giá vốn, giá bán, tồn nằm trên một dòng.
        slotProps={{ popper: { placement: 'bottom-start', sx: { minWidth: { sm: 620 } } } }}
        renderOption={(props, option) => (
          <li {...props} key={option.id}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', py: 0.25 }}>
              {option.imageUrl ? (
                <Box
                  component="img"
                  src={option.imageUrl}
                  alt=""
                  sx={{ width: 40, height: 40, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.neutral',
                  }}
                >
                  <Iconify icon="solar:box-bold" width={20} sx={{ color: 'text.disabled' }} />
                </Box>
              )}
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {option.label}
                </Typography>
                <Stack direction="row" spacing={1.5} sx={{ typography: 'caption', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                  <span>{option.code}</span>
                  {canSeeCost && option.costPrice > 0 && <span>Giá vốn: {fCurrency(option.costPrice)}</span>}
                  <span>Giá bán: {fCurrency(option.sellingPrice)}</span>
                  {option.stock !== undefined && option.stock !== null && (
                    <Box component="span" sx={{ color: option.stock > 0 ? 'text.secondary' : 'error.main' }}>
                      Tồn: {option.stock.toLocaleString('vi-VN')}
                    </Box>
                  )}
                </Stack>
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
            inputRef={searchInputRef}
            autoFocus={!isEdit}
            placeholder="Tìm hàng theo mã, tên hoặc quét mã vạch (F3)"
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
      />
      {access.canCreateProducts && (
        <Tooltip title="Tạo hàng mới">
          <IconButton color="primary" onClick={quickCreateProduct.onTrue}>
            <Iconify icon="mingcute:add-line" />
          </IconButton>
        </Tooltip>
      )}
      {!isEdit && (
        <Tooltip title="Chụp / tải ảnh hoá đơn NCC để hệ thống đọc dòng hàng">
          <Button
            component={RouterLink}
            href={paths.dashboard.pos.purchaseOrder.import}
            variant="outlined"
            color="inherit"
            startIcon={<Iconify icon="solar:camera-add-bold" />}
            sx={{ flexShrink: 0, display: { xs: 'none', sm: 'inline-flex' } }}
          >
            Đọc ảnh hoá đơn
          </Button>
        </Tooltip>
      )}
    </Stack>
  );

  const renderLines = (
    <TableContainer sx={{ flex: 1, maxHeight: { lg: 'calc(100vh - 230px)' } }}>
      <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', minWidth: LINE_TABLE_MIN_WIDTH }}>
        <TableHead>
          <TableRow>
            {LINE_COLUMNS.map((col) => (
              <TableCell
                key={col.id}
                align={col.align}
                sx={{ width: col.width, whiteSpace: 'nowrap', bgcolor: 'background.neutral', fontWeight: 600 }}
              >
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {fields.map((field, index) => {
            const productId = (watchItems?.[index] as any)?.productId as string | undefined;
            const product = productId ? products.find((p) => p.id === productId) : undefined;
            return (
              <PurchaseOrderLineRow
                key={field.id}
                index={index}
                units={productId ? unitsByProduct[productId] : undefined}
                onRemove={remove}
                onOpenVariants={handleOpenVariantPicker}
                canOpenVariants={!!product?.hasVariants}
              />
            );
          })}

          {fields.length === 0 && (
            <TableRow>
              <TableCell colSpan={LINE_COLUMNS.length} sx={{ border: 0 }}>
                <Stack alignItems="center" spacing={1.5} sx={{ py: 10, color: 'text.secondary' }}>
                  <Iconify icon="solar:box-minimalistic-outline" width={48} sx={{ color: 'text.disabled' }} />
                  <Typography variant="subtitle1" color="text.primary">
                    Phiếu chưa có hàng
                  </Typography>
                  <Typography variant="body2">
                    Gõ mã / tên hàng hoặc quét mã vạch ở ô tìm phía trên (phím F3).
                  </Typography>
                  {!isEdit && (
                    <Link component={RouterLink} href={paths.dashboard.pos.purchaseOrder.import} variant="body2">
                      Hoặc đọc dòng hàng từ ảnh hoá đơn NCC
                    </Link>
                  )}
                </Stack>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const row = (label: React.ReactNode, value: React.ReactNode, strong?: boolean) => (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ minHeight: 32 }}>
      <Typography variant={strong ? 'subtitle2' : 'body2'} color={strong ? 'text.primary' : 'text.secondary'}>
        {label}
      </Typography>
      {typeof value === 'string' ? (
        <Typography variant={strong ? 'subtitle1' : 'body2'} sx={{ fontWeight: strong ? 700 : 500 }}>
          {value}
        </Typography>
      ) : (
        value
      )}
    </Stack>
  );

  const renderSide = (
    <Card
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        position: { lg: 'sticky' },
        top: { lg: 80 },
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip
          size="small"
          variant="soft"
          icon={<Iconify icon="solar:user-rounded-bold" width={16} />}
          label={user?.displayName || 'Tôi'}
          sx={{ maxWidth: 150 }}
        />
        <Box sx={{ flex: 1 }}>
          <RHFDateTimePicker name="expectedDate" label="Ngày nhập" size="small" />
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Autocomplete
          fullWidth
          size="small"
          options={activeSuppliers}
          value={selectedSupplier}
          autoHighlight
          onChange={(_, val) => setValue('supplierId', val?.id ?? '', { shouldValidate: true, shouldDirty: true })}
          getOptionLabel={(s) => s.name}
          filterOptions={(opts, state) => {
            const q = state.inputValue.trim().toLowerCase();
            if (!q) return opts.slice(0, 50);
            return opts
              .filter((s) => [s.name, s.code, s.phone].some((v) => v?.toLowerCase().includes(q)))
              .slice(0, 50);
          }}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderOption={(props, s) => (
            <li {...props} key={s.id}>
              <Stack>
                <Typography variant="body2">{s.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {[s.code, s.phone].filter(Boolean).join(' · ')}
                </Typography>
              </Stack>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Tìm nhà cung cấp"
              error={!!supplierError}
              helperText={supplierError}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="solar:shop-2-outline" width={18} sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />
          )}
        />
        {access.canManageSuppliers && (
          <Tooltip title="Thêm nhà cung cấp">
            <IconButton color="primary" onClick={quickCreateSupplier.onTrue} size="small" sx={{ mt: 0.5 }}>
              <Iconify icon="mingcute:add-line" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* Kho: chỉ hỏi khi cửa hàng có nhiều kho */}
      {(activeWarehouses.length > 1 || !getValues('warehouseId')) && (
        <RHFSelect name="warehouseId" label="Kho nhập" size="small">
          {activeWarehouses.map((w) => (
            <MenuItem key={w.id} value={w.id}>
              {w.name}
            </MenuItem>
          ))}
        </RHFSelect>
      )}

      {row('Mã phiếu nhập', currentPurchaseOrder?.orderNumber || 'Tự động')}
      {row('Trạng thái', 'Phiếu tạm')}
      <RHFTextField name="invoiceNumber" size="small" label="Số hoá đơn NCC" placeholder="Số hoá đơn đầu vào" />

      <Divider sx={{ borderStyle: 'dashed' }} />

      {row(
        <>
          Tổng tiền hàng{' '}
          <Box component="span" sx={{ color: 'text.disabled' }}>
            ({fields.length} dòng · SL {totalQuantity.toLocaleString('vi-VN')})
          </Box>
        </>,
        fCurrency(subTotal)
      )}
      {vatTotal > 0 && row('VAT', fCurrency(vatTotal))}
      {row(
        'Giảm giá',
        <PurchaseNumberInput
          size="small"
          value={watchDiscount as number}
          onValueChange={(v) => setValue('discountAmount', v === '' ? 0 : v)}
          sx={{ width: 150 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <ButtonBase
                  onClick={() => setValue('discountType', watchDiscountType === 'percent' ? 'amount' : 'percent')}
                  sx={{ typography: 'caption', fontWeight: 700, color: 'text.secondary', px: 0.5 }}
                >
                  {watchDiscountType === 'percent' ? '%' : 'đ'}
                </ButtonBase>
              </InputAdornment>
            ),
          }}
        />
      )}
      {row(
        'Cần trả nhà cung cấp',
        <Typography variant="h6" color="primary.main">
          {fCurrency(grandTotal)}
        </Typography>,
        true
      )}

      {canPay && (
        <>
          {row(
            <Stack direction="row" spacing={0.5} alignItems="center">
              <span>Tiền trả NCC (F8)</span>
              <ButtonBase
                onClick={() => setPayAmount(Math.round(grandTotal))}
                sx={{ typography: 'caption', color: 'primary.main', px: 0.5 }}
              >
                Trả đủ
              </ButtonBase>
            </Stack>,
            <PurchaseNumberInput
              ref={payInputRef}
              size="small"
              value={payAmount}
              onValueChange={setPayAmount}
              sx={{ width: 150 }}
              placeholder="0"
            />
          )}
          <Stack direction="row" spacing={0.75} justifyContent="flex-end">
            {PAY_METHODS.map((m) => (
              <Chip
                key={m.value}
                size="small"
                label={m.label}
                color={payMethod === m.value ? 'primary' : 'default'}
                variant={payMethod === m.value ? 'filled' : 'outlined'}
                onClick={() => setPayMethod(m.value)}
              />
            ))}
          </Stack>
          {row('Tính vào công nợ', fCurrency(debt))}
        </>
      )}
      {capabilities?.kiotVietConnected && (
        <Typography variant="caption" color="text.secondary">
          Cửa hàng nối KiotViet: tiền trả và công nợ nhà cung cấp ghi trên KiotViet.
        </Typography>
      )}

      {shareholdersOn && access.canSetPaidBy && (
        <RHFSelect name="paidByShareholderId" label="Ai chi hộ (nếu có)" size="small">
          <MenuItem value="">Cửa hàng tự trả</MenuItem>
          {shareholders.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </RHFSelect>
      )}

      <PurchaseNumberInput
        size="small"
        label="Tổng trên hoá đơn giấy (đối chiếu)"
        value={invoiceTotal}
        onValueChange={setInvoiceTotal}
        align="left"
      />
      {invoiceTotal !== '' && Math.abs(Number(invoiceTotal) - grandTotal) >= 1 && (
        <Alert severity="warning" sx={{ py: 0 }}>
          Lệch {fCurrency(Math.abs(Number(invoiceTotal) - grandTotal))} so với hoá đơn — kiểm tra số lượng, đơn vị, thành tiền.
        </Alert>
      )}
      {invoiceTotal !== '' && Math.abs(Number(invoiceTotal) - grandTotal) < 1 && (
        <Typography variant="caption" color="success.main">
          Khớp với hoá đơn.
        </Typography>
      )}

      <RHFTextField name="note" size="small" placeholder="Ghi chú" multiline minRows={2} />

      {completeBlocked && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          {completeBlocked}
        </Alert>
      )}

      <Stack direction="row" spacing={1.5}>
        <LoadingButton
          fullWidth
          size="large"
          variant="outlined"
          color="primary"
          loading={saving === 'temp'}
          disabled={!!saving}
          onClick={handleSaveTemp}
        >
          Lưu tạm
        </LoadingButton>
        <Tooltip title={completeBlocked || ''}>
          <Box sx={{ width: 1 }}>
            <LoadingButton
              fullWidth
              size="large"
              variant="contained"
              color="primary"
              loading={saving === 'complete'}
              disabled={!!saving || !capabilities?.canComplete}
              onClick={handleAskComplete}
            >
              Hoàn thành
            </LoadingButton>
          </Box>
        </Tooltip>
      </Stack>
    </Card>
  );

  return (
    <>
      <FormProvider methods={methods} onSubmit={(event?: any) => event?.preventDefault?.()}>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            alignItems: 'start',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 340px', xl: 'minmax(0, 1fr) 380px' },
          }}
        >
          <Card sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: { lg: 'calc(100vh - 160px)' } }}>
            {renderSearch}
            {renderLines}
            {fields.length > 0 && (
              <Stack
                direction="row"
                justifyContent="flex-end"
                spacing={3}
                sx={{ px: 2, py: 1.25, borderTop: (t) => `1px solid ${t.palette.divider}`, typography: 'body2' }}
              >
                <span>
                  {fields.length} dòng · Tổng SL <strong>{totalQuantity.toLocaleString('vi-VN')}</strong>
                </span>
                <span>
                  Tổng tiền hàng <strong>{fCurrency(subTotal)}</strong>
                </span>
              </Stack>
            )}
          </Card>

          {renderSide}
        </Box>
      </FormProvider>

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
      <PurchaseOrderVariantPicker
        open={variantPickerOpen}
        onClose={() => setVariantPickerOpen(false)}
        product={variantPickerProduct}
        allProducts={products}
        onSelect={handleVariantsSelected}
      />

      {/* Xác nhận Hoàn thành — nhập kho ngay, không sửa lại được */}
      <Dialog open={confirmComplete.value} onClose={saving ? undefined : confirmComplete.onFalse} maxWidth="xs" fullWidth>
        <DialogTitle>Hoàn thành phiếu nhập?</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {row('Nhà cung cấp', selectedSupplier?.name || '')}
            {row('Hàng nhập', `${fields.length} dòng · SL ${totalQuantity.toLocaleString('vi-VN')}`)}
            {row('Cần trả NCC', fCurrency(grandTotal), true)}
            {canPay && paid > 0 && row(`Trả ngay (${PAY_METHODS.find((m) => m.value === payMethod)?.label})`, fCurrency(paid))}
            {canPay && row('Ghi nợ NCC', fCurrency(debt))}
            <Alert severity="info" sx={{ mt: 1 }}>
              {capabilities?.kiotVietConnected
                ? 'Phiếu được tạo bên KiotViet ở trạng thái "Đã nhập hàng" — tồn kho và giá vốn KiotViet cập nhật ngay.'
                : 'Hàng được cộng vào tồn kho và tính lại giá vốn ngay. Phiếu hoàn thành không sửa được nữa.'}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={confirmComplete.onFalse} disabled={!!saving}>
            Xem lại
          </Button>
          <LoadingButton variant="contained" loading={saving === 'complete'} onClick={handleComplete}>
            Hoàn thành
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Bản nháp lần trước */}
      <Dialog open={draftDialogOpen.value} maxWidth="xs">
        <DialogTitle>Khôi phục bản nháp</DialogTitle>
        <DialogContent>
          <Alert severity="info">Bạn có phiếu nhập đang nhập dở lần trước. Khôi phục hay bỏ qua?</Alert>
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
