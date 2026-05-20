import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';

import { useBoolean } from 'src/hooks/use-boolean';

import { _addressBooks } from 'src/_mock';

import Iconify from 'src/components/iconify';

import { useCheckoutContext } from './context';
import CheckoutSummary from './checkout-summary';
import { AddressItem, AddressNewForm } from '../address';

// ----------------------------------------------------------------------

export default function CheckoutBillingAddress() {
  const checkout = useCheckoutContext();

  const addressForm = useBoolean();

  return (
    <>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          {_addressBooks.slice(0, 4).map((address) => (
            <AddressItem
              key={address.id}
              address={address}
              action={
                <Stack flexDirection="row" flexWrap="wrap" flexShrink={0}>
                  {!address.primary && (
                    <Button size="small" color="error" sx={{ mr: 1 }}>
                      Xóa
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => checkout.onCreateBilling(address)}
                  >
                    Chọn địa chỉ này
                  </Button>
                </Stack>
              }
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 2,
                boxShadow: (theme) => theme.customShadows.card,
              }}
            />
          ))}

          <Stack direction="row" justifyContent="space-between">
            <Button
              size="small"
              color="inherit"
              onClick={checkout.onBackStep}
              startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
            >
              Quay lại
            </Button>

            <Button
              size="small"
              color="primary"
              onClick={addressForm.onTrue}
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Thêm địa chỉ mới
            </Button>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <CheckoutSummary
            total={checkout.total}
            subTotal={checkout.subTotal}
            discount={checkout.discount}
          />
        </Grid>
      </Grid>

      <AddressNewForm
        open={addressForm.value}
        onClose={addressForm.onFalse}
        onCreate={checkout.onCreateBilling}
      />
    </>
  );
}
