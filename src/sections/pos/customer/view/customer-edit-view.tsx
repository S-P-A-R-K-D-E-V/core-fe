'use client';

import { useState, useEffect } from 'react';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { ICustomer } from 'src/types/corecms-api';
import { getAllCustomers } from 'src/api/customers';
import CustomerNewEditForm from '../customer-new-edit-form';

// ----------------------------------------------------------------------

type Props = {
  id: string;
};

export default function CustomerEditView({ id }: Props) {
  const [currentCustomer, setCurrentCustomer] = useState<ICustomer>();

  useEffect(() => {
    getAllCustomers().then((customers) => {
      const found = customers.find((c) => c.id === id);
      if (found) setCurrentCustomer(found);
    });
  }, [id]);

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Sửa khách hàng"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Khách hàng', href: paths.dashboard.pos.customer.list },
          { name: currentCustomer?.name || '...' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {currentCustomer && <CustomerNewEditForm currentCustomer={currentCustomer} />}
    </Container>
  );
}
