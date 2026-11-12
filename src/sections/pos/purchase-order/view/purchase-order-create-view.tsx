'use client';

import { useState, useEffect } from 'react';

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { useSnackbar } from 'src/components/snackbar';

import { IPurchaseOrder } from 'src/types/corecms-api';
import { getPurchaseOrderById } from 'src/api/purchase-orders';

import PurchaseOrderNewForm from '../purchase-order-new-form';
import PurchaseOrderFormHeader from '../purchase-order-form-header';

// ----------------------------------------------------------------------
// Tạo phiếu nhập. "?copy=<id>" (nút Sao chép ở danh sách): điền sẵn NCC, hàng, giá, ghi chú của phiếu đó.
// Đọc tham số trong effect (không dùng useSearchParams) để trang vẫn dựng tĩnh được.
// ----------------------------------------------------------------------

export default function PurchaseOrderCreateView() {
  const { enqueueSnackbar } = useSnackbar();
  const [copyId, setCopyId] = useState<string | null | undefined>(undefined);
  const [template, setTemplate] = useState<IPurchaseOrder | null>(null);

  useEffect(() => {
    setCopyId(new URLSearchParams(window.location.search).get('copy'));
  }, []);

  useEffect(() => {
    if (!copyId) return;
    getPurchaseOrderById(copyId)
      .then(setTemplate)
      .catch(() => {
        enqueueSnackbar('Không tải được phiếu để sao chép', { variant: 'error' });
        setCopyId(null);
      });
  }, [copyId, enqueueSnackbar]);

  const waiting = copyId === undefined || (!!copyId && !template);

  return (
    <Container maxWidth={false} sx={{ px: { xs: 1.5, md: 2.5 } }}>
      <PurchaseOrderFormHeader
        title="Nhập hàng"
        subtitle={template ? `sao chép từ ${template.orderNumber}` : undefined}
        backHref={paths.dashboard.pos.purchaseOrder.list}
      />
      {waiting ? (
        <Typography color="text.secondary">Đang tải…</Typography>
      ) : (
        <PurchaseOrderNewForm key={template?.id ?? 'new'} templateOrder={template ?? undefined} />
      )}
    </Container>
  );
}
