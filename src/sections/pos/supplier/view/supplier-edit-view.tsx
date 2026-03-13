'use client';

import { useState, useEffect } from 'react';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { ISupplier } from 'src/types/corecms-api';
import { getAllSuppliers } from 'src/api/suppliers';
import SupplierNewEditForm from '../supplier-new-edit-form';

// ----------------------------------------------------------------------

type Props = {
  id: string;
};

export default function SupplierEditView({ id }: Props) {
  const [currentSupplier, setCurrentSupplier] = useState<ISupplier>();

  useEffect(() => {
    getAllSuppliers().then((suppliers) => {
      const found = suppliers.find((s) => s.id === id);
      if (found) setCurrentSupplier(found);
    });
  }, [id]);

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Sửa nhà cung cấp"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Nhà cung cấp', href: paths.dashboard.pos.supplier.list },
          { name: currentSupplier?.name || '...' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {currentSupplier && <SupplierNewEditForm currentSupplier={currentSupplier} />}
    </Container>
  );
}
