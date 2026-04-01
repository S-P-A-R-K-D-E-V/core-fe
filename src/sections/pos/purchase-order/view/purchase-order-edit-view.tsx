'use client';

import { useState, useEffect, useCallback } from 'react';

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { useSnackbar } from 'src/components/snackbar';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { IPurchaseOrder } from 'src/types/corecms-api';
import { getPurchaseOrderById } from 'src/api/purchase-orders';

import PurchaseOrderNewForm from '../purchase-order-new-form';

// ----------------------------------------------------------------------

type Props = { id: string };

export default function PurchaseOrderEditView({ id }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const [order, setOrder] = useState<IPurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPurchaseOrderById(id);

      if (data.status !== 'Draft') {
        enqueueSnackbar('Chỉ được sửa đơn ở trạng thái Nháp', { variant: 'error' });
        setOrder(null);
        return;
      }

      setOrder(data);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không tải được đơn hàng', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, enqueueSnackbar]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Typography>Đang tải...</Typography>
      </Container>
    );
  }

  if (!order) {
    return (
      <Container maxWidth="lg">
        <Typography color="error">Không tìm thấy đơn hàng hoặc đơn không ở trạng thái Nháp.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Sửa đơn nhập hàng"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kho hàng', href: paths.dashboard.pos.root },
          { name: 'Đơn nhập hàng', href: paths.dashboard.pos.purchaseOrder.list },
          { name: order.orderNumber },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <PurchaseOrderNewForm currentPurchaseOrder={order} />
    </Container>
  );
}
