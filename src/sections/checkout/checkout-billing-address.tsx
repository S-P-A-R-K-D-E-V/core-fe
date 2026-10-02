import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';
import LoadingButton from '@mui/lab/LoadingButton';

import { useBoolean } from 'src/hooks/use-boolean';

import { useAuthContext } from 'src/auth/hooks';

import { _addressBooks } from 'src/_mock';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { IAddressItem } from 'src/types/address';

import { useCheckoutContext } from './context';
import CheckoutSummary from './checkout-summary';
import { AddressItem, AddressNewForm } from '../address';

// ----------------------------------------------------------------------

const STORE_ROLES = ['Admin', 'Manager', 'Staff'];

export default function CheckoutBillingAddress() {
  const checkout = useCheckoutContext();

  const { enqueueSnackbar } = useSnackbar();

  const addressForm = useBoolean();

  const submitting = useBoolean();

  // POST /sales-orders chỉ nhận vai trò cửa hàng (Admin/Manager/Staff) — tài khoản khách (User) bị 403.
  // Shop web chưa nhận đặt hàng trực tuyến: báo rõ, không gọi API rồi bảo "thử lại".
  const { user } = useAuthContext();
  const userRoles: string[] = [...(user?.roles ?? []), user?.role].filter(Boolean);
  const canPlaceOrder = STORE_ROLES.some((r) => userRoles.includes(r));

  const handleSelectAddress = async (address: IAddressItem) => {
    if (!canPlaceOrder) {
      enqueueSnackbar('Cửa hàng chưa nhận đặt hàng trực tuyến, vui lòng liên hệ cửa hàng để đặt hàng', {
        variant: 'warning',
      });
      return;
    }
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
