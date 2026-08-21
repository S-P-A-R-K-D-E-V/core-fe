import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';
import LoadingButton from '@mui/lab/LoadingButton';

import { useBoolean } from 'src/hooks/use-boolean';

import { _addressBooks } from 'src/_mock';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { IAddressItem } from 'src/types/address';

import { useCheckoutContext } from './context';
import CheckoutSummary from './checkout-summary';
import { AddressItem, AddressNewForm } from '../address';

// ----------------------------------------------------------------------

export default function CheckoutBillingAddress() {
  const checkout = useCheckoutContext();

  const { enqueueSnackbar } = useSnackbar();

  const addressForm = useBoolean();

  const submitting = useBoolean();

  const handleSelectAddress = async (address: IAddressItem) => {
    submitting.onTrue();
    try {
      await checkout.onCreateBilling(address);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Đặt hàng thất bại, vui lòng thử lại', { variant: 'error' });
    } finally {
      submitting.onFalse();
    }
  };

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
                  <LoadingButton
                    variant="outlined"
                    size="small"
                    loading={submitting.value}
                    onClick={() => handleSelectAddress(address)}
                  >
                    Chọn địa chỉ này
                  </LoadingButton>
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
        onCreate={handleSelectAddress}
      />
    </>
  );
}
