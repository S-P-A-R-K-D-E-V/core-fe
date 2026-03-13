'use client';

import { useState, useEffect } from 'react';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { IWarehouse } from 'src/types/corecms-api';
import { getAllWarehouses } from 'src/api/warehouses';
import WarehouseNewEditForm from '../warehouse-new-edit-form';

type Props = { id: string };

export default function WarehouseEditView({ id }: Props) {
  const [current, setCurrent] = useState<IWarehouse | null>(null);

  useEffect(() => {
    getAllWarehouses()
      .then((all) => setCurrent(all.find((w) => w.id === id) || null))
      .catch(console.error);
  }, [id]);

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Sửa kho"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kho hàng', href: paths.dashboard.pos.warehouse.list },
          { name: current?.name || '' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      {current && <WarehouseNewEditForm currentWarehouse={current} />}
    </Container>
  );
}
