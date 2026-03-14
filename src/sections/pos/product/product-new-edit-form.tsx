'use client';

import * as Yup from 'yup';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Grid from '@mui/material/Unstable_Grid2';
import Autocomplete from '@mui/material/Autocomplete';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField, RHFSelect } from 'src/components/hook-form';

import {
  IProduct,
  ICategory,
  IUnitOfMeasure,
  IVariantAttribute,
  IVariantAttributeValue,
} from 'src/types/corecms-api';
import { createProduct, updateProduct } from 'src/api/products';
import { getAllCategories } from 'src/api/categories';
import { getAllUnitOfMeasures } from 'src/api/unit-of-measures';
import { getAllVariantAttributes } from 'src/api/variant-attributes';

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

  const [categories, setCategories] = useState<ICategory[]>([]);
  const [units, setUnits] = useState<IUnitOfMeasure[]>([]);
  const [variantAttributes, setVariantAttributes] = useState<IVariantAttribute[]>([]);

  useEffect(() => {
    Promise.all([
      getAllCategories(),
      getAllUnitOfMeasures(),
      getAllVariantAttributes(),
    ]).then(([cats, uoms, attrs]) => {
      setCategories(cats);
      setUnits(uoms);
      setVariantAttributes(attrs);
    }).catch(console.error);
  }, []);

  const Schema = Yup.object().shape({
    name: Yup.string().required('Tên sản phẩm là bắt buộc'),
    sku: Yup.string().required('SKU là bắt buộc'),
    barcode: Yup.string().default(''),
    description: Yup.string().default(''),
    categoryId: Yup.string().required('Danh mục là bắt buộc'),
    unitOfMeasureId: Yup.string().required('Đơn vị tính là bắt buộc'),
    costPrice: Yup.number().min(0).required('Giá nhập là bắt buộc'),
    sellingPrice: Yup.number().min(0).required('Giá bán là bắt buộc'),
    vatRate: Yup.number().min(0).max(100).default(0),
    imageUrl: Yup.string().default(''),
    lowStockThreshold: Yup.number().min(0).default(10),
    hasVariants: Yup.boolean().default(false),
    variants: Yup.array().of(
      Yup.object().shape({
        sku: Yup.string().required('SKU biến thể là bắt buộc'),
        barcode: Yup.string().default(''),
        name: Yup.string().required('Tên biến thể là bắt buộc'),
        costPrice: Yup.number().min(0).default(0),
        sellingPrice: Yup.number().min(0).default(0),
        imageUrl: Yup.string().default(''),
        attributeValueIds: Yup.array().of(Yup.string()).default([]),
      })
    ).default([]),
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
      vatRate: currentProduct?.vatRate || 0,
      imageUrl: currentProduct?.imageUrl || '',
      lowStockThreshold: currentProduct?.lowStockThreshold || 10,
      hasVariants: currentProduct?.hasVariants || false,
      variants: currentProduct?.variants?.map((v) => ({
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

  const { reset, watch, setValue, handleSubmit, control, formState: { isSubmitting } } = methods;

  const hasVariants = watch('hasVariants');
  const variants = watch('variants') || [];

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });

  useEffect(() => {
    if (currentProduct) reset(defaultValues);
  }, [currentProduct, defaultValues, reset]);

  // Auto-generate variants from selected attributes
  const [selectedAttributes, setSelectedAttributes] = useState<
    { attributeId: string; valueIds: string[] }[]
  >([]);

  const handleGenerateVariants = useCallback(() => {
    if (selectedAttributes.length === 0) return;

    // Build combinations
    const allValueSets = selectedAttributes
      .filter((a) => a.valueIds.length > 0)
      .map((a) => {
        const attr = variantAttributes.find((va) => va.id === a.attributeId);
        return a.valueIds.map((vid) => {
          const val = attr?.values.find((v) => v.id === vid);
          return { attributeId: a.attributeId, attributeName: attr?.name || '', valueId: vid, valueName: val?.value || '' };
        });
      });

    if (allValueSets.length === 0) return;

    // Cartesian product
    const combinations = allValueSets.reduce<typeof allValueSets[0][]>(
      (acc, curr) => {
        if (acc.length === 0) return curr.map((item) => [item]);
        const result: typeof acc = [];
        acc.forEach((existing) => {
          curr.forEach((item) => {
            result.push([...existing, item]);
          });
        });
        return result;
      },
      []
    );

    const baseSku = watch('sku') || 'SP';
    const baseCost = watch('costPrice') || 0;
    const basePrice = watch('sellingPrice') || 0;

    const newVariants: VariantFormItem[] = combinations.map((combo, idx) => {
      const variantName = combo.map((c) => c.valueName).join(' - ');
      const variantSku = `${baseSku}-${combo.map((c) => c.valueName.substring(0, 3).toUpperCase()).join('-')}`;
      return {
        sku: variantSku,
        barcode: '',
        name: variantName,
        costPrice: baseCost,
        sellingPrice: basePrice,
        imageUrl: '',
        attributeValueIds: combo.map((c) => c.valueId),
      };
    });

    // Replace existing variants
    setValue('variants', newVariants);
  }, [selectedAttributes, variantAttributes, watch, setValue]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (currentProduct) {
        await updateProduct(currentProduct.id, {
          name: data.name,
          sku: data.sku,
          barcode: data.barcode || undefined,
          description: data.description || undefined,
          categoryId: data.categoryId,
          unitOfMeasureId: data.unitOfMeasureId,
          costPrice: data.costPrice,
          sellingPrice: data.sellingPrice,
          vatRate: data.vatRate,
          imageUrl: data.imageUrl || undefined,
          lowStockThreshold: data.lowStockThreshold,
          hasVariants: data.hasVariants,
        });
        enqueueSnackbar('Cập nhật thành công!');
      } else {
        await createProduct({
          name: data.name,
          sku: data.sku,
          barcode: data.barcode || undefined,
          description: data.description || undefined,
          categoryId: data.categoryId,
          unitOfMeasureId: data.unitOfMeasureId,
          costPrice: data.costPrice,
          sellingPrice: data.sellingPrice,
          vatRate: data.vatRate,
          imageUrl: data.imageUrl || undefined,
          lowStockThreshold: data.lowStockThreshold,
          hasVariants: data.hasVariants,
          variants: data.hasVariants && data.variants && data.variants.length > 0
            ? data.variants.map((v) => ({
                sku: v.sku,
                barcode: v.barcode || undefined,
                name: v.name,
                costPrice: v.costPrice || undefined,
                sellingPrice: v.sellingPrice || undefined,
                imageUrl: v.imageUrl || undefined,
                attributeValueIds: (v.attributeValueIds || []).filter(Boolean) as string[],
              }))
            : undefined,
        });
        enqueueSnackbar('Tạo thành công!');
      }
      router.push(paths.dashboard.pos.product.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  });

  // Helper to get all attribute values as a flat lookup
  const allAttributeValues = useMemo(() => {
    const map: Record<string, { attr: IVariantAttribute; val: IVariantAttributeValue }> = {};
    variantAttributes.forEach((attr) => {
      attr.values.forEach((val) => {
        map[val.id] = { attr, val };
      });
    });
    return map;
  }, [variantAttributes]);

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        {/* Left column: Product info */}
        <Grid xs={12} md={8}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Thông tin sản phẩm
            </Typography>

            <Box
              rowGap={3}
              columnGap={2}
              display="grid"
              gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}
            >
              <RHFTextField name="name" label="Tên sản phẩm" />
              <RHFTextField name="sku" label="SKU" />
              <RHFTextField name="barcode" label="Barcode" />

              <RHFSelect name="categoryId" label="Danh mục">
                <MenuItem value="">— Chọn danh mục —</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </RHFSelect>

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

            <RHFTextField
              name="description"
              label="Mô tả"
              multiline
              rows={3}
              sx={{ mt: 3 }}
            />
          </Card>

          {/* Variants section */}
          {hasVariants && (
            <Card sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Quản lý biến thể
              </Typography>

              {!currentProduct && (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Chọn thuộc tính và giá trị, sau đó nhấn &quot;Tạo biến thể&quot; để tự động sinh các biến thể.
                    Bạn cũng có thể thêm thủ công từng biến thể bên dưới.
                  </Alert>

                  {/* Attribute selector */}
                  <Stack spacing={2} sx={{ mb: 3 }}>
                    {variantAttributes.map((attr) => {
                      const selected = selectedAttributes.find((s) => s.attributeId === attr.id);
                      return (
                        <Autocomplete
                          key={attr.id}
                          multiple
                          options={attr.values}
                          getOptionLabel={(option) => option.value}
                          value={attr.values.filter((v) => selected?.valueIds.includes(v.id))}
                          onChange={(_, newValue) => {
                            setSelectedAttributes((prev) => {
                              const existing = prev.filter((s) => s.attributeId !== attr.id);
                              if (newValue.length > 0) {
                                return [...existing, { attributeId: attr.id, valueIds: newValue.map((v) => v.id) }];
                              }
                              return existing;
                            });
                          }}
                          renderInput={(params) => (
                            <TextField {...params} label={attr.name} placeholder={`Chọn ${attr.name}`} />
                          )}
                          renderTags={(selected, getTagProps) =>
                            selected.map((option, index) => (
                              <Chip
                                {...getTagProps({ index })}
                                key={option.id}
                                label={option.value}
                                size="small"
                                color="primary"
                                variant="soft"
                              />
                            ))
                          }
                        />
                      );
                    })}

                    <Button
                      variant="outlined"
                      startIcon={<Iconify icon="solar:magic-stick-bold" />}
                      onClick={handleGenerateVariants}
                      disabled={selectedAttributes.length === 0}
                    >
                      Tạo biến thể tự động
                    </Button>
                  </Stack>

                  <Divider sx={{ mb: 2 }} />
                </>
              )}

              {/* Variant list */}
              <Stack spacing={2}>
                {fields.map((field, index) => (
                  <Card
                    key={field.id}
                    variant="outlined"
                    sx={{ p: 2, bgcolor: 'background.neutral' }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle2">
                        Biến thể #{index + 1}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => remove(index)}
                      >
                        <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                      </IconButton>
                    </Stack>

                    <Box
                      rowGap={2}
                      columnGap={2}
                      display="grid"
                      gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr 1fr' }}
                    >
                      <RHFTextField name={`variants.${index}.name`} label="Tên biến thể" size="small" />
                      <RHFTextField name={`variants.${index}.sku`} label="SKU" size="small" />
                      <RHFTextField name={`variants.${index}.barcode`} label="Barcode" size="small" />
                      <RHFTextField name={`variants.${index}.costPrice`} label="Giá nhập" type="number" size="small" />
                      <RHFTextField name={`variants.${index}.sellingPrice`} label="Giá bán" type="number" size="small" />
                      <RHFTextField name={`variants.${index}.imageUrl`} label="URL hình ảnh" size="small" />
                    </Box>

                    {/* Show current attribute tags */}
                    {variants[index]?.attributeValueIds && variants[index].attributeValueIds.length > 0 && (
                      <Stack direction="row" spacing={0.5} sx={{ mt: 1.5 }} flexWrap="wrap">
                        {variants[index].attributeValueIds.filter((vid): vid is string => !!vid).map((vid) => {
                          const info = allAttributeValues[vid];
                          return info ? (
                            <Chip
                              key={vid}
                              label={`${info.attr.name}: ${info.val.value}`}
                              size="small"
                              color="info"
                              variant="soft"
                            />
                          ) : null;
                        })}
                      </Stack>
                    )}
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
                  Thêm biến thể thủ công
                </Button>
              </Stack>
            </Card>
          )}
        </Grid>

        {/* Right column: Price & settings */}
        <Grid xs={12} md={4}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Giá & thiết lập
            </Typography>

            <Stack spacing={3}>
              <RHFTextField name="costPrice" label="Giá nhập (VNĐ)" type="number" />
              <RHFTextField name="sellingPrice" label="Giá bán (VNĐ)" type="number" />
              <RHFTextField name="vatRate" label="Thuế VAT (%)" type="number" />
              <RHFTextField name="lowStockThreshold" label="Cảnh báo tồn kho thấp" type="number" />

              <FormControlLabel
                control={
                  <Switch
                    checked={hasVariants}
                    onChange={(e) => setValue('hasVariants', e.target.checked)}
                  />
                }
                label="Có biến thể (Size, Màu...)"
              />
            </Stack>

            <Stack alignItems="flex-end" sx={{ mt: 3 }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                {!currentProduct ? 'Tạo sản phẩm' : 'Lưu thay đổi'}
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
