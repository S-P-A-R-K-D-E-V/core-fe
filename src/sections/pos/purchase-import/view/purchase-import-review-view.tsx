'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import PurchaseImportDrawer from '../purchase-import-drawer';

// ----------------------------------------------------------------------
// Trang duyệt đầy đủ một lần nhập từ ảnh hoá đơn: cùng khung với drawer duyệt nhanh (trao đổi với trợ lý, NCC + lịch sử
// nhập, tạo phiếu, đẩy KiotViet) nhưng các dòng là FORM PHIẾU NHẬP — chọn sản phẩm tại ô, sửa số, giá theo gói — kèm ô
// kho / số / ngày / tổng hoá đơn; "Tạo phiếu nhập" tạo đúng phiếu theo form.
// ----------------------------------------------------------------------

type Props = { id: string };

export default function PurchaseImportReviewView({ id }: Props) {
  const router = useRouter();

  return (
    <Container maxWidth={false}>
      <CustomBreadcrumbs
        heading="Duyệt hoá đơn nhập"
        links={[
          { name: 'Đơn nhập hàng', href: paths.dashboard.pos.purchaseOrder.list },
          { name: 'Nhập từ ảnh hoá đơn', href: paths.dashboard.pos.purchaseOrder.import },
          { name: 'Duyệt' },
        ]}
        sx={{ mb: 2 }}
      />
      <PurchaseImportDrawer
        variant="page"
        importId={id}
        onClose={() => router.push(paths.dashboard.pos.purchaseOrder.import)}
        onNavigate={(href) => router.push(href)}
      />
    </Container>
  );
}
