'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Unstable_Grid2';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { ISalesOrder } from 'src/types/corecms-api';
import { getSalesOrderById, updateSalesOrder } from 'src/api/sales-orders';

// ----------------------------------------------------------------------

type FormValues = {
  note: string;
  discount: number;
  items: {
    id?: string;
    productId: string;
    productCode?: string;
    productName: string;
    quantity: number;
    price: number;
    discount: number;
  }[];
};

type Props = { id: string };

export default function SalesOrderEditView({ id }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const [order, setOrder] = useState<ISalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: {
      note: '',
      discount: 0,
      items: [],
    },
  });

  const { fields, remove } = useFieldArray({ control, name: 'items' });

  const watchItems = watch('items');
  const watchDiscount = watch('discount');

  const subTotal = watchItems.reduce(
    (sum, item) => sum + item.quantity * item.price - (item.discount || 0),
    0
  );
  const totalAmount = subTotal - (watchDiscount || 0);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSalesOrderById(id);
      setOrder(data);
      reset({
        note: data.note || '',
        discount: data.discountAmount || 0,
        items: data.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productCode: item.productSKU || '',
          productName: item.productName,
          quantity: item.quantity,
          price: item.unitPrice,
          discount: item.discountAmount || 0,
        })),
      });
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không tải được đơn hàng', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, enqueueSnackbar, reset]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      setSubmitting(true);
      await updateSalesOrder(id, {
        customerId: order?.customerId || undefined,
        note: data.note,
        discount: data.discount,
        items: data.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount,
        })),
      });
      enqueueSnackbar('Cập nhật thành công!');
      router.push(paths.dashboard.pos.salesOrder.details(id));
    } catch (error: any) {
      const message = error?.title || error?.message || 'Có lỗi xảy ra';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  });

  if (loading || !order) {
    return (
      <Container maxWidth="lg">
        <Typography>Đang tải...</Typography>
      </Container>
    );
  }

  if (order.status === 'Cancelled') {
    return (
      <Container maxWidth="lg">
        <Typography color="error">Hóa đơn đã hủy, không thể chỉnh sửa.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading={`Chỉnh sửa #${order.orderNumber}`}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Đơn bán hàng', href: paths.dashboard.pos.salesOrder.list },
          { name: order.orderNumber },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <form onSubmit={onSubmit}>
        <Grid container spacing={3}>
          {/* Info */}
          <Grid xs={12} md={8}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Thông tin chung
              </Typography>

              <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Mã đơn"
                    value={order.orderNumber}
                    disabled
                    fullWidth
                  />
                  <TextField
                    label="Khách hàng"
                    value={order.customerName || 'Khách lẻ'}
                    disabled
                    fullWidth
                  />
                </Stack>

                <Controller
                  name="note"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Ghi chú" multiline rows={2} fullWidth />
                  )}
                />
              </Stack>
            </Card>
          </Grid>

          {/* Totals */}
          <Grid xs={12} md={4}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Tổng hợp
              </Typography>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Tạm tính
                  </Typography>
                  <Typography variant="body2">{fCurrency(subTotal)}</Typography>
                </Stack>

                <Controller
                  name="discount"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Chiết khấu"
                      type="number"
                      size="small"
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  )}
                />

                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle1">Tổng cộng</Typography>
                  <Typography variant="subtitle1" color="primary">
                    {fCurrency(totalAmount)}
                  </Typography>
                </Stack>
              </Stack>
            </Card>
          </Grid>

          {/* Items */}
          <Grid xs={12}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Sản phẩm
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Sản phẩm</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell align="center">SL</TableCell>
                    <TableCell align="right">Đơn giá</TableCell>
                    <TableCell align="right">Chiết khấu</TableCell>
                    <TableCell align="right">Thành tiền</TableCell>
                    <TableCell width={50} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fields.map((field, index) => {
                    const item = watchItems[index];
                    const lineTotal = (item?.quantity || 0) * (item?.price || 0) - (item?.discount || 0);

                    return (
                      <TableRow key={field.id}>
                        <TableCell>{item?.productName}</TableCell>
                        <TableCell>{item?.productCode}</TableCell>
                        <TableCell align="center" sx={{ width: 80 }}>
                          <Controller
                            name={`items.${index}.quantity`}
                            control={control}
                            render={({ field: f }) => (
                              <TextField
                                {...f}
                                type="number"
                                size="small"
                                sx={{ width: 70 }}
                                inputProps={{ min: 1 }}
                                onChange={(e) => f.onChange(Number(e.target.value))}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ width: 120 }}>
                          <Controller
                            name={`items.${index}.price`}
                            control={control}
                            render={({ field: f }) => (
                              <TextField
                                {...f}
                                type="number"
                                size="small"
                                sx={{ width: 110 }}
                                onChange={(e) => f.onChange(Number(e.target.value))}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ width: 110 }}>
                          <Controller
                            name={`items.${index}.discount`}
                            control={control}
                            render={({ field: f }) => (
                              <TextField
                                {...f}
                                type="number"
                                size="small"
                                sx={{ width: 100 }}
                                onChange={(e) => f.onChange(Number(e.target.value))}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell align="right">{fCurrency(lineTotal)}</TableCell>
                        <TableCell>
                          {fields.length > 1 && (
                            <IconButton color="error" size="small" onClick={() => remove(index)}>
                              <Iconify icon="solar:trash-bin-trash-bold" />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </Grid>

          {/* Actions */}
          <Grid xs={12}>
            <Stack direction="row" justifyContent="flex-end" spacing={2}>
              <Button
                variant="outlined"
                onClick={() => router.push(paths.dashboard.pos.salesOrder.details(id))}
              >
                Hủy bỏ
              </Button>
              <LoadingButton type="submit" variant="contained" loading={submitting}>
                Lưu thay đổi
              </LoadingButton>
            </Stack>
          </Grid>
        </Grid>
      </form>
    </Container>
  );
}
