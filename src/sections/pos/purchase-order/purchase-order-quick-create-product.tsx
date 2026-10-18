'use client';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';

import Iconify from 'src/components/iconify';

import { IProduct } from 'src/types/corecms-api';

import ProductNewEditForm from '../product/product-new-edit-form';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: VoidFunction;
  onCreated: (product: IProduct) => void;
  /** Điền sẵn tên / giá nhập (tạo mã từ dòng hoá đơn NCC). */
  initialValues?: { name?: string; costPrice?: number };
};

export default function PurchaseOrderQuickCreateProduct({ open, onClose, onCreated, initialValues }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Tạo sản phẩm mới
        <IconButton onClick={onClose} edge="end">
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        <ProductNewEditForm
          isDialog
          onDialogClose={onClose}
          onProductCreated={onCreated}
          initialValues={initialValues}
        />
      </DialogContent>
    </Dialog>
  );
}
