'use client';

import * as Yup from 'yup';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LoadingButton from '@mui/lab/LoadingButton';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField, RHFSelect } from 'src/components/hook-form';

import { IProduct, ICategory, IUnitOfMeasure } from 'src/types/corecms-api';
import { createProduct } from 'src/api/products';
import { getAllCategories } from 'src/api/categories';
import { getAllUnitOfMeasures } from 'src/api/unit-of-measures';

// ----------------------------------------------------------------------

const Schema = Yup.object().shape({
  name: Yup.string().required('Tên sản phẩm là bắt buộc'),
  sku: Yup.string().required('Mã SKU là bắt buộc'),
  barcode: Yup.string().default(''),
  categoryId: Yup.string().required('Chọn danh mục'),
  unitOfMeasureId: Yup.string().required('Chọn đơn vị'),
  costPrice: Yup.number().min(0).required('Bắt buộc'),
  sellingPrice: Yup.number().min(0).required('Bắt buộc'),
  vatRate: Yup.number().min(0).max(100).default(0),
});

type Props = {
  open: boolean;
  onClose: VoidFunction;
  onCreated: (product: IProduct) => void;
};

export default function PurchaseOrderQuickCreateProduct({ open, onClose, onCreated }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const [categories, setCategories] = useState<ICategory[]>([]);
  const [units, setUnits] = useState<IUnitOfMeasure[]>([]);

  useEffect(() => {
    if (!open) return;
    Promise.all([getAllCategories(), getAllUnitOfMeasures()])
      .then(([cats, uoms]) => {
        setCategories(cats);
        setUnits(uoms);
      })
      .catch(console.error);
  }, [open]);

  const defaultValues = {
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    unitOfMeasureId: '',
    costPrice: 0,
    sellingPrice: 0,
    vatRate: 0,
  };

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      const result = await createProduct({
        name: data.name,
        sku: data.sku,
        barcode: data.barcode || undefined,
        categoryId: data.categoryId,
        unitOfMeasureId: data.unitOfMeasureId,
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice,
        vatRate: data.vatRate || 0,
      });
      const cat = categories.find((c) => c.id === data.categoryId);
      const unit = units.find((u) => u.id === data.unitOfMeasureId);
      const newProduct: IProduct = {
        id: result.id,
        code: data.sku,
        name: data.name,
        sku: data.sku,
        barcode: data.barcode || '',
        categoryId: data.categoryId,
        categoryName: cat?.name || '',
        allowsSale: true,
        hasVariants: false,
        basePrice: data.sellingPrice,
        productType: 2,
        isActive: true,
        minQuantity: 0,
        maxQuantity: 999999999,
        createdDate: new Date().toISOString(),
        unitOfMeasureId: data.unitOfMeasureId,
        unitOfMeasureName: unit?.name || '',
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice,
        vatRate: data.vatRate || 0,
        imageUrl: '',
        lowStockThreshold: 0,
        highStockThreshold: 999999999,
        isLoyaltyPoints: false,
        createdAt: new Date().toISOString(),
        variants: [],
        totalStock: 0,
      };
      enqueueSnackbar('Tạo sản phẩm thành công!');
      onCreated(newProduct);
      reset(defaultValues);
      onClose();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  });

  const handleClose = () => {
    reset(defaultValues);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <DialogTitle>Tạo nhanh sản phẩm</DialogTitle>

        <DialogContent dividers>
          <Box
            rowGap={2.5}
            columnGap={2}
            display="grid"
            gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}
            sx={{ pt: 1 }}
          >
            <RHFTextField name="name" label="Tên sản phẩm" />
            <RHFTextField name="sku" label="Mã SKU" />
            <RHFTextField name="barcode" label="Barcode" />
            <RHFSelect name="categoryId" label="Danh mục">
              <MenuItem value="">— Chọn —</MenuItem>
              {categories
                .filter((c) => c.isActive)
                .map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
            </RHFSelect>
            <RHFSelect name="unitOfMeasureId" label="Đơn vị tính">
              <MenuItem value="">— Chọn —</MenuItem>
              {units
                .filter((u) => u.isActive)
                .map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.name} ({u.abbreviation})
                  </MenuItem>
                ))}
            </RHFSelect>
            <RHFTextField name="vatRate" label="VAT (%)" type="number" />
            <RHFTextField name="costPrice" label="Giá nhập" type="number" />
            <RHFTextField name="sellingPrice" label="Giá bán" type="number" />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" onClick={handleClose}>
            Hủy
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            Tạo sản phẩm
          </LoadingButton>
        </DialogActions>
      </FormProvider>
    </Dialog>
  );
}
