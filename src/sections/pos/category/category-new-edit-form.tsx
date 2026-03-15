'use client';

import * as Yup from 'yup';
import { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Unstable_Grid2';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField, RHFSelect } from 'src/components/hook-form';

import { ICategory } from 'src/types/corecms-api';
import { getAllCategories, createCategory, updateCategory } from 'src/api/categories';

// ----------------------------------------------------------------------

type Props = {
  currentCategory?: ICategory;
};

// Build flat list with depth info for tree display
function buildTree(
  items: ICategory[],
  excludeId?: string,
  parentId: string | null = null,
  depth = 0
): { item: ICategory; depth: number }[] {
  return items
    .filter((c) => (c.parentCategoryId || null) === parentId && c.id !== excludeId)
    .flatMap((c) => [
      { item: c, depth },
      ...buildTree(items, excludeId, c.id, depth + 1),
    ]);
}

export default function CategoryNewEditForm({ currentCategory }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [categories, setCategories] = useState<ICategory[]>([]);

  useEffect(() => {
    getAllCategories().then(setCategories).catch(console.error);
  }, []);

  const Schema = Yup.object().shape({
    name: Yup.string().required('Tên danh mục là bắt buộc'),
    description: Yup.string().default(''),
    parentCategoryId: Yup.string().default(''),
    sortOrder: Yup.number().default(0),
    imageUrl: Yup.string().default(''),
  });

  const defaultValues = useMemo(
    () => ({
      name: currentCategory?.name || '',
      description: currentCategory?.description || '',
      parentCategoryId: currentCategory?.parentCategoryId || '',
      sortOrder: currentCategory?.sortOrder || 0,
      imageUrl: currentCategory?.imageUrl || '',
    }),
    [currentCategory]
  );

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });

  const { reset, handleSubmit, formState: { isSubmitting } } = methods;

  useEffect(() => {
    if (currentCategory) reset(defaultValues);
  }, [currentCategory, defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        parentCategoryId: data.parentCategoryId || undefined,
        sortOrder: data.sortOrder,
        imageUrl: data.imageUrl || undefined,
      };
      if (currentCategory) {
        await updateCategory(currentCategory.id, payload);
        enqueueSnackbar('Cập nhật thành công!');
      } else {
        await createCategory(payload);
        enqueueSnackbar('Tạo thành công!');
      }
      router.push(paths.dashboard.pos.category.list);
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
            <Box rowGap={3} columnGap={2} display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}>
              <RHFTextField name="name" label="Tên danh mục" />
              <RHFTextField name="sortOrder" label="Thứ tự" type="number" />
              <RHFSelect name="parentCategoryId" label="Danh mục cha">
                <MenuItem value="">— Không —</MenuItem>
                {buildTree(categories, currentCategory?.id).map(({ item, depth }) => (
                  <MenuItem key={item.id} value={item.id}>
                    {depth > 0 && (
                      <span style={{ marginRight: 4, opacity: 0.4 }}>
                        {'│  '.repeat(depth - 1)}{'└─ '}
                      </span>
                    )}
                    {item.name}
                  </MenuItem>
                ))}
              </RHFSelect>
              <RHFTextField name="imageUrl" label="URL hình ảnh" />
            </Box>
            <RHFTextField name="description" label="Mô tả" multiline rows={3} sx={{ mt: 3 }} />
            <Stack alignItems="flex-end" sx={{ mt: 3 }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                {!currentCategory ? 'Tạo danh mục' : 'Lưu thay đổi'}
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
