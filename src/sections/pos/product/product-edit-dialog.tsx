'use client';

import { useState, useEffect } from 'react';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';

import { IProduct } from 'src/types/corecms-api';
import { getProductById } from 'src/api/products';
import ProductNewEditForm from './product-new-edit-form';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  productId?: string; // undefined = create mode
  onSaved?: () => void;
};

export default function ProductEditDialog({ open, onClose, productId, onSaved }: Props) {
  const [currentProduct, setCurrentProduct] = useState<IProduct | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && productId) {
      setLoading(true);
      getProductById(productId)
        .then(setCurrentProduct)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (!productId) {
      setCurrentProduct(null);
    }
  }, [open, productId]);

  const isEdit = !!productId;
  const title = isEdit ? 'Sửa hàng hóa' : 'Thêm hàng hóa';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {title}
        <IconButton onClick={onClose} size="small">
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {loading && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" color="text.disabled">Đang tải...</Typography>
          </Box>
        )}

        {!loading && (isEdit ? currentProduct : true) && (
          <Box sx={{ p: 3 }}>
            <ProductNewEditForm
              currentProduct={currentProduct ?? undefined}
              isDialog
              onDialogClose={onClose}
              onDialogSaved={onSaved}
            />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
