'use client';

import * as Yup from 'yup';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField, RHFSelect, RHFEditor } from 'src/components/hook-form';

import {
  IProduct,
  ICategory,
  IUnitOfMeasure,
  IVariantAttribute,
} from 'src/types/corecms-api';
import { createProduct, updateProduct } from 'src/api/products';
import { getAllCategories } from 'src/api/categories';
import { getAllUnitOfMeasures } from 'src/api/unit-of-measures';
import { getAllVariantAttributes } from 'src/api/variant-attributes';

import CategoryTreeDialog from './category-tree-dialog';
import UnitAttributeDialog, {
  UnitConversionFormItem,
  AttributeFormItem,
} from './unit-attribute-dialog';

// ----------------------------------------------------------------------

interface VariantFormItem {
  sku: string;
  barcode: string;
  name: string;
  costPrice: number;
  sellingPrice: number;
  imageUrl: string;
  attributeValueIds: string[];
}

type Props = {
  currentProduct?: IProduct;
};

export default function ProductNewEditForm({ currentProduct }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const [currentTab, setCurrentTab] = useState(0);
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [units, setUnits] = useState<IUnitOfMeasure[]>([]);
  const [variantAttributes, setVariantAttributes] = useState<IVariantAttribute[]>([]);

  // Dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [unitAttrDialogOpen, setUnitAttrDialogOpen] = useState(false);

  // Unit conversions & attributes managed in dialog
  const [unitConversions, setUnitConversions] = useState<UnitConversionFormItem[]>([]);
  const [productAttributes, setProductAttributes] = useState<AttributeFormItem[]>([]);

  // Selected category display
  const [selectedCategoryName, setSelectedCategoryName] = useState('');

  useEffect(() => {
    Promise.all([
      getAllCategories(true),
      getAllUnitOfMeasures(),
      getAllVariantAttributes(),
    ])
      .then(([cats, uoms, attrs]) => {
        setCategories(cats);
        setUnits(uoms);
        setVariantAttributes(attrs);
      })
      .catch(console.error);
  }, []);

  const Schema = Yup.object().shape({
    name: Yup.string().required('Tên hàng là bắt buộc'),
    sku: Yup.string().default(''),
    barcode: Yup.string().default(''),
    description: Yup.string().default(''),
    categoryId: Yup.string().required('Nhóm hàng là bắt buộc'),
    unitOfMeasureId: Yup.string().required('Đơn vị tính là bắt buộc'),
    costPrice: Yup.number().min(0).default(0),
    sellingPrice: Yup.number().min(0).default(0),
    imageUrl: Yup.string().default(''),
    lowStockThreshold: Yup.number().min(0).default(0),
    highStockThreshold: Yup.number().min(0).default(999999999),
    isLoyaltyPoints: Yup.boolean().default(false),
    weight: Yup.number().min(0).nullable().default(0),
    weightUnit: Yup.string().default('g'),
    location: Yup.string().default(''),
    hasVariants: Yup.boolean().default(false),
    variants: Yup.array()
      .of(
        Yup.object().shape({
          sku: Yup.string().required('SKU là bắt buộc'),
          barcode: Yup.string().default(''),
          name: Yup.string().required('Tên là bắt buộc'),
          costPrice: Yup.number().min(0).default(0),
          sellingPrice: Yup.number().min(0).default(0),
          imageUrl: Yup.string().default(''),
          attributeValueIds: Yup.array().of(Yup.string()).default([]),
        })
      )
      .default([]),
  });

  const defaultValues = useMemo(
    () => ({
      name: currentProduct?.name || '',
      sku: currentProduct?.sku || '',
      barcode: currentProduct?.barcode || '',
      description: currentProduct?.description || '',
      categoryId: currentProduct?.categoryId || '',
      unitOfMeasureId: currentProduct?.unitOfMeasureId || '',
      costPrice: currentProduct?.costPrice || 0,
      sellingPrice: currentProduct?.sellingPrice || 0,
      imageUrl: currentProduct?.imageUrl || '',
      lowStockThreshold: currentProduct?.lowStockThreshold || 0,
      highStockThreshold: currentProduct?.highStockThreshold || 999999999,
      isLoyaltyPoints: currentProduct?.isLoyaltyPoints || false,
      weight: currentProduct?.weight || 0,
      weightUnit: currentProduct?.weightUnit || 'g',
      location: currentProduct?.location || '',
      hasVariants: currentProduct?.hasVariants || false,
      variants:
        currentProduct?.variants?.map((v) => ({
          sku: v.sku,
          barcode: v.barcode || '',
          name: v.name,
          costPrice: v.costPrice || 0,
          sellingPrice: v.sellingPrice || 0,
          imageUrl: v.imageUrl || '',
          attributeValueIds: v.combinations?.map((c) => c.valueId) || [],
        })) || [],
    }),
    [currentProduct]
  );

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });

  const {
    reset,
    watch,
    setValue,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = methods;

  const hasVariants = watch('hasVariants');

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });

  useEffect(() => {
    if (currentProduct) {
      reset(defaultValues);
      setSelectedCategoryName(currentProduct.categoryName || '');

      // Load unit conversions from product
      if (currentProduct.unitConversions) {
        setUnitConversions(
          currentProduct.unitConversions.map((uc) => ({
            unitOfMeasureId: uc.unitOfMeasureId,
            unitOfMeasureName: uc.unitOfMeasureName,
            conversionRate: uc.conversionRate,
            costPrice: uc.costPrice || 0,
            sellingPrice: uc.sellingPrice || 0,
            barcode: uc.barcode || '',
          }))
        );
      }
    }
  }, [currentProduct, defaultValues, reset]);

  // Find category name when categories load
  useEffect(() => {
    const catId = watch('categoryId');
    if (catId && categories.length > 0) {
      const findCat = (cats: ICategory[]): string => {
        for (const c of cats) {
          if (c.id === catId) return c.name;
          if (c.subCategories) {
            const found = findCat(c.subCategories);
            if (found) return found;
          }
        }
        return '';
      };
      const name = findCat(categories);
      if (name) setSelectedCategoryName(name);
    }
  }, [categories, watch]);

  // Generate child products when unit conversions or attributes change
  const handleGenerateVariants = useCallback(() => {
    const baseName = watch('name') || 'SP';
    const baseSku = watch('sku') || '';
    const baseCost = watch('costPrice') || 0;
    const basePrice = watch('sellingPrice') || 0;

    const newVariants: VariantFormItem[] = [];

    // Gather dimension lists
    const unitDimension =
      unitConversions.length > 0
        ? unitConversions.map((uc) => ({
            label: uc.unitOfMeasureName,
            costPrice: uc.costPrice,
            sellingPrice: uc.sellingPrice,
          }))
        : [{ label: '', costPrice: baseCost, sellingPrice: basePrice }];

    const attrDimension =
      productAttributes.length > 0
        ? productAttributes.map((a) => a.value)
        : [''];

    // Cartesian product
    let idx = 0;
    unitDimension.forEach((unit) => {
      attrDimension.forEach((attr) => {
        const nameParts = [baseName, attr, unit.label].filter(Boolean);
        const skuParts = [baseSku, attr.substring(0, 3).toUpperCase(), unit.label.substring(0, 3).toUpperCase()].filter(Boolean);

        newVariants.push({
          sku: skuParts.join('-'),
          barcode: '',
          name: nameParts.join(' - '),
          costPrice: unit.costPrice || baseCost,
          sellingPrice: unit.sellingPrice || basePrice,
          imageUrl: '',
          attributeValueIds: [],
        });
        idx += 1;
      });
    });

    setValue('variants', newVariants);
    setValue('hasVariants', newVariants.length > 0);
  }, [unitConversions, productAttributes, watch, setValue]);

  const handleUnitAttrSave = (
    newUnits: UnitConversionFormItem[],
    newAttrs: AttributeFormItem[]
  ) => {
    setUnitConversions(newUnits);
    setProductAttributes(newAttrs);
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const unitConversionPayload =
        unitConversions.length > 0
          ? unitConversions.map((uc) => ({
              unitOfMeasureId: uc.unitOfMeasureId,
              conversionRate: uc.conversionRate,
              costPrice: uc.costPrice || undefined,
              sellingPrice: uc.sellingPrice || undefined,
              barcode: uc.barcode || undefined,
            }))
          : undefined;

      const variantsPayload =
        data.hasVariants && data.variants && data.variants.length > 0
          ? data.variants.map((v) => ({
              sku: v.sku,
              barcode: v.barcode || undefined,
              name: v.name,
              costPrice: v.costPrice || undefined,
              sellingPrice: v.sellingPrice || undefined,
              imageUrl: v.imageUrl || undefined,
              attributeValueIds: (v.attributeValueIds || []).filter(Boolean) as string[],
            }))
          : undefined;

      if (currentProduct) {
        await updateProduct(currentProduct.id, {
          name: data.name,
          sku: data.sku || undefined,
          barcode: data.barcode || undefined,
          description: data.description || undefined,
          categoryId: data.categoryId,
          unitOfMeasureId: data.unitOfMeasureId,
          costPrice: data.costPrice,
          sellingPrice: data.sellingPrice,
          imageUrl: data.imageUrl || undefined,
          lowStockThreshold: data.lowStockThreshold,
          highStockThreshold: data.highStockThreshold,
          isLoyaltyPoints: data.isLoyaltyPoints,
          weight: data.weight || undefined,
          weightUnit: data.weightUnit || undefined,
          location: data.location || undefined,
          hasVariants: data.hasVariants,
          variants: variantsPayload,
          unitConversions: unitConversionPayload,
        });
        enqueueSnackbar('Cập nhật thành công!');
      } else {
        await createProduct({
          name: data.name,
          sku: data.sku || undefined,
          barcode: data.barcode || undefined,
          description: data.description || undefined,
          categoryId: data.categoryId,
          unitOfMeasureId: data.unitOfMeasureId,
          costPrice: data.costPrice,
          sellingPrice: data.sellingPrice,
          imageUrl: data.imageUrl || undefined,
          lowStockThreshold: data.lowStockThreshold,
          highStockThreshold: data.highStockThreshold,
          isLoyaltyPoints: data.isLoyaltyPoints,
          weight: data.weight || undefined,
          weightUnit: data.weightUnit || undefined,
          location: data.location || undefined,
          hasVariants: data.hasVariants,
          variants: variantsPayload,
          unitConversions: unitConversionPayload,
        });
        enqueueSnackbar('Tạo thành công!');
      }
      router.push(paths.dashboard.pos.product.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  });

  // Flatten categories for display
  const flatCategories = useMemo(() => {
    const result: { id: string; name: string; depth: number }[] = [];
    const flatten = (cats: ICategory[], depth = 0) => {
      cats.forEach((c) => {
        result.push({ id: c.id, name: c.name, depth });
        if (c.subCategories) flatten(c.subCategories, depth + 1);
      });
    };
    flatten(categories);
    return result;
  }, [categories]);

  const renderTabInfo = (
    <Stack spacing={3}>
      {/* Basic info */}
      <Card sx={{ p: 3 }}>
        <Box
          rowGap={3}
          columnGap={2}
          display="grid"
          gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}
        >
          <RHFTextField name="sku" label="Mã hàng" placeholder="Tự sinh nếu để trống" />
          <RHFTextField name="barcode" label="Mã vạch" placeholder="Tự sinh nếu để trống" />

          <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
            <RHFTextField name="name" label="Tên hàng" />
          </Box>

          {/* Category with treeview picker */}
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <FormControl fullWidth size="medium">
              <InputLabel>Nhóm hàng</InputLabel>
              <Select
                value={watch('categoryId')}
                onChange={(e) => {
                  const id = e.target.value;
                  setValue('categoryId', id);
                  const cat = flatCategories.find((c) => c.id === id);
                  if (cat) setSelectedCategoryName(cat.name);
                }}
                label="Nhóm hàng"
              >
                <MenuItem value="">— Chọn nhóm hàng —</MenuItem>
                {flatCategories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {'—'.repeat(c.depth)} {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <IconButton
              color="primary"
              onClick={() => setCategoryDialogOpen(true)}
              sx={{ mt: 1 }}
              title="Quản lý nhóm hàng"
            >
              <Iconify icon="mingcute:add-line" />
            </IconButton>
          </Stack>

          <RHFSelect name="unitOfMeasureId" label="Đơn vị tính">
            <MenuItem value="">— Chọn đơn vị —</MenuItem>
            {units.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name} {u.abbreviation ? `(${u.abbreviation})` : ''}
              </MenuItem>
            ))}
          </RHFSelect>

          <RHFTextField name="imageUrl" label="URL hình ảnh" />
        </Box>
      </Card>

      {/* Price section */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
          <Typography variant="subtitle1" fontWeight={700}>
            Giá vốn, giá bán
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box
            rowGap={2}
            columnGap={2}
            display="grid"
            gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}
          >
            <RHFTextField name="costPrice" label="Giá vốn" type="number" />
            <RHFTextField name="sellingPrice" label="Giá bán" type="number" />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Stock section */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
          <Typography variant="subtitle1" fontWeight={700}>
            Tồn kho
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Quản lý số lượng tồn kho và định mức tồn. Khi tồn kho chạm đến định mức, bạn sẽ nhận
            được cảnh báo.
          </Typography>
          <Box
            rowGap={2}
            columnGap={2}
            display="grid"
            gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr 1fr' }}
          >
            <RHFTextField
              name="lowStockThreshold"
              label="Định mức tồn thấp nhất"
              type="number"
            />
            <RHFTextField
              name="highStockThreshold"
              label="Định mức tồn cao nhất"
              type="number"
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Loyalty points */}
      <Card sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1" fontWeight={700}>
            Tích điểm
          </Typography>
          <Switch
            checked={watch('isLoyaltyPoints')}
            onChange={(e) => setValue('isLoyaltyPoints', e.target.checked)}
          />
        </Stack>
      </Card>

      {/* Location & Weight */}
      <Accordion>
        <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
          <Typography variant="subtitle1" fontWeight={700}>
            Vị trí, trọng lượng
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Quản lý việc sắp xếp kho, vị trí bán hàng hoặc trọng lượng hàng hóa
          </Typography>
          <Box
            rowGap={2}
            columnGap={2}
            display="grid"
            gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr 1fr' }}
          >
            <RHFTextField name="location" label="Vị trí" />
            <RHFTextField name="weight" label="Trọng lượng" type="number" />
            <RHFSelect name="weightUnit" label="Đơn vị">
              <MenuItem value="g">g</MenuItem>
              <MenuItem value="kg">kg</MenuItem>
            </RHFSelect>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Unit & Attribute management card */}
      <Card sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Quản lý theo đơn vị tính và thuộc tính
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hàng hóa được tạo ra từ ĐƠN VỊ và THUỘC TÍNH
            </Typography>
          </Box>
          <Button
            variant="text"
            endIcon={<Iconify icon="eva:arrow-ios-forward-fill" />}
            onClick={() => setUnitAttrDialogOpen(true)}
          >
            Xem chi tiết
          </Button>
        </Stack>

        {/* Summary of configured units & attributes */}
        {(unitConversions.length > 0 || productAttributes.length > 0) && (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {unitConversions.length > 0 && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                  Đơn vị:
                </Typography>
                {unitConversions.map((uc, i) => (
                  <Chip
                    key={i}
                    label={`${uc.unitOfMeasureName} (x${uc.conversionRate})`}
                    size="small"
                    color="primary"
                    variant="soft"
                  />
                ))}
              </Stack>
            )}
            {productAttributes.length > 0 && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                  Thuộc tính:
                </Typography>
                {productAttributes.map((a, i) => (
                  <Chip
                    key={i}
                    label={`${a.attributeName}: ${a.value}`}
                    size="small"
                    color="info"
                    variant="soft"
                  />
                ))}
              </Stack>
            )}

            {(unitConversions.length > 0 || productAttributes.length > 0) && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<Iconify icon="solar:magic-stick-bold" />}
                onClick={handleGenerateVariants}
                sx={{ mt: 1, alignSelf: 'flex-start' }}
              >
                Tạo hàng hóa cùng loại
              </Button>
            )}
          </Stack>
        )}
      </Card>

      {/* Generated child products / variants */}
      {hasVariants && fields.length > 0 && (
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Hàng hóa cùng loại ({fields.length})
          </Typography>

          <Stack spacing={2}>
            {fields.map((field, index) => (
              <Card
                key={field.id}
                variant="outlined"
                sx={{ p: 2, bgcolor: 'background.neutral' }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 1.5 }}
                >
                  <Typography variant="subtitle2">#{index + 1}</Typography>
                  <IconButton size="small" color="error" onClick={() => remove(index)}>
                    <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                  </IconButton>
                </Stack>

                <Box
                  rowGap={2}
                  columnGap={2}
                  display="grid"
                  gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr 1fr' }}
                >
                  <RHFTextField
                    name={`variants.${index}.name`}
                    label="Tên hàng"
                    size="small"
                  />
                  <RHFTextField name={`variants.${index}.sku`} label="Mã hàng" size="small" />
                  <RHFTextField
                    name={`variants.${index}.barcode`}
                    label="Mã vạch"
                    size="small"
                  />
                  <RHFTextField
                    name={`variants.${index}.costPrice`}
                    label="Giá vốn"
                    type="number"
                    size="small"
                  />
                  <RHFTextField
                    name={`variants.${index}.sellingPrice`}
                    label="Giá bán"
                    type="number"
                    size="small"
                  />
                </Box>
              </Card>
            ))}

            <Button
              variant="soft"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() =>
                append({
                  sku: '',
                  barcode: '',
                  name: '',
                  costPrice: watch('costPrice') || 0,
                  sellingPrice: watch('sellingPrice') || 0,
                  imageUrl: '',
                  attributeValueIds: [],
                })
              }
            >
              + Thêm hàng hoá cùng loại
            </Button>
          </Stack>
        </Card>
      )}
    </Stack>
  );

  const renderTabDescription = (
    <Card sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Mô tả sản phẩm
      </Typography>
      <RHFEditor simple name="description" />
    </Card>
  );

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Stack spacing={3}>
        {/* Tabs */}
        <Card>
          <Tabs
            value={currentTab}
            onChange={(_, newValue) => setCurrentTab(newValue)}
            sx={{ px: 3 }}
          >
            <Tab label="Thông tin" />
            <Tab label="Mô tả" />
          </Tabs>
        </Card>

        {/* Tab content */}
        {currentTab === 0 && renderTabInfo}
        {currentTab === 1 && renderTabDescription}

        {/* Actions */}
        <Stack direction="row" justifyContent="flex-end" spacing={2}>
          <Button
            variant="outlined"
            onClick={() => router.push(paths.dashboard.pos.product.list)}
          >
            Bỏ qua
          </Button>
          {hasVariants && (unitConversions.length > 0 || productAttributes.length > 0) && (
            <Button variant="outlined" onClick={handleGenerateVariants}>
              Lưu & Thêm hàng hóa cùng loại
            </Button>
          )}
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            {!currentProduct ? 'Lưu' : 'Lưu thay đổi'}
          </LoadingButton>
        </Stack>
      </Stack>

      {/* Dialogs */}
      <CategoryTreeDialog
        open={categoryDialogOpen}
        onClose={() => {
          setCategoryDialogOpen(false);
          // Reload categories
          getAllCategories(true).then(setCategories).catch(console.error);
        }}
        selectedId={watch('categoryId')}
        onSelect={(id, name) => {
          setValue('categoryId', id);
          setSelectedCategoryName(name);
        }}
      />

      <UnitAttributeDialog
        open={unitAttrDialogOpen}
        onClose={() => setUnitAttrDialogOpen(false)}
        unitConversions={unitConversions}
        attributes={productAttributes}
        onSave={handleUnitAttrSave}
        baseCostPrice={watch('costPrice') || 0}
        baseSellingPrice={watch('sellingPrice') || 0}
      />
    </FormProvider>
  );
}
