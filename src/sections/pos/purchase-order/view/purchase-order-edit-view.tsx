'use client';

import { useState, useEffect, useCallback } from 'react';

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { useSnackbar } from 'src/components/snackbar';

import { IPurchaseOrder } from 'src/types/corecms-api';
import { getPurchaseOrderById } from 'src/api/purchase-orders';

import PurchaseOrderNewForm from '../purchase-order-new-form';
import PurchaseOrderFormHeader from '../purchase-order-form-header';

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
    <Container maxWidth={false} sx={{ px: { xs: 1.5, md: 2.5 } }}>
      <PurchaseOrderFormHeader
        title="Sửa phiếu nhập"
        subtitle={`${order.orderNumber} · phiếu tạm`}
        backHref={paths.dashboard.pos.purchaseOrder.details(order.id)}
      />

      <PurchaseOrderNewForm currentPurchaseOrder={order} />
    </Container>
  );
}
