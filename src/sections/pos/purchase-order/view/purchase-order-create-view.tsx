'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import PurchaseOrderNewForm from '../purchase-order-new-form';
import PurchaseOrderFormHeader from '../purchase-order-form-header';

// ----------------------------------------------------------------------

export default function PurchaseOrderCreateView() {
  return (
    <Container maxWidth={false} sx={{ px: { xs: 1.5, md: 2.5 } }}>
      <PurchaseOrderFormHeader title="Nhập hàng" backHref={paths.dashboard.pos.purchaseOrder.list} />
      <PurchaseOrderNewForm />
    </Container>
  );
}
