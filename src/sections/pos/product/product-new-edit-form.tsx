'use client';

import * as Yup from 'yup';
import { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Unstable_Grid2';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField, RHFSelect } from 'src/components/hook-form';

import { IProduct, ICategory, IUnitOfMeasure } from 'src/types/corecms-api';
import { createProduct, updateProduct } from 'src/api/products';
import { getAllCategories } from 'src/api/categories';
import { getAllUnitOfMeasures } from 'src/api/unit-of-measures';

// ----------------------------------------------------------------------

type Props = {
  currentProduct?: IProduct;
};

export default function ProductNewEditForm({ currentProduct }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const [categories, setCategories] = useState<ICategory[]>([]);
  const [units, setUnits] = useState<IUnitOfMeasure[]>([]);

  useEffect(() => {
    getAllCategories().then(setCategories).catch(console.error);
    getAllUnitOfMeasures().then(setUnits).catch(console.error);
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
    }),
    [currentProduct]
  );

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });

  const { reset, watch, setValue, handleSubmit, formState: { isSubmitting } } = methods;

  const hasVariants = watch('hasVariants');

  useEffect(() => {
    if (currentProduct) reset(defaultValues);
  }, [currentProduct, defaultValues, reset]);

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
        });
        enqueueSnackbar('Tạo thành công!');
      }
      router.push(paths.dashboard.pos.product.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid xs={12} md={8}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>Thông tin sản phẩm</Typography>
            <Box rowGap={3} columnGap={2} display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}>
              <RHFTextField name="name" label="Tên sản phẩm" />
              <RHFTextField name="sku" label="SKU" />
              <RHFTextField name="barcode" label="Barcode" />
              <RHFSelect name="categoryId" label="Danh mục">
                <MenuItem value="">— Chọn danh mục —</MenuItem>
                {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </RHFSelect>
              <RHFSelect name="unitOfMeasureId" label="Đơn vị tính">
                <MenuItem value="">— Chọn đơn vị —</MenuItem>
                {units.map((u) => <MenuItem key={u.id} value={u.id}>{u.name} ({u.abbreviation})</MenuItem>)}
              </RHFSelect>
              <RHFTextField name="imageUrl" label="URL hình ảnh" />
            </Box>

            <RHFTextField name="description" label="Mô tả" multiline rows={3} sx={{ mt: 3 }} />
          </Card>
        </Grid>

        <Grid xs={12} md={4}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>Giá & thuế</Typography>
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
