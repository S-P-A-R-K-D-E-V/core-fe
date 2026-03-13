'use client';

import { useState, useEffect } from 'react';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { ICategory } from 'src/types/corecms-api';
import { getAllCategories } from 'src/api/categories';
import CategoryNewEditForm from '../category-new-edit-form';

// ----------------------------------------------------------------------

type Props = { id: string };

export default function CategoryEditView({ id }: Props) {
  const [currentCategory, setCurrentCategory] = useState<ICategory | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const all = await getAllCategories();
        const found = all.find((c) => c.id === id);
        if (found) setCurrentCategory(found);
      } catch (error) {
        console.error(error);
      }
    };
    fetch();
  }, [id]);

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Sửa danh mục"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Danh mục', href: paths.dashboard.pos.category.list },
          { name: currentCategory?.name || '' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      {currentCategory && <CategoryNewEditForm currentCategory={currentCategory} />}
    </Container>
  );
}
