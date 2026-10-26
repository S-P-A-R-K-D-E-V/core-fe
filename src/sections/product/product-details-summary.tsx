import { useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Rating from '@mui/material/Rating';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fCurrency, fShortenNumber } from 'src/utils/format-number';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { ColorPicker } from 'src/components/color-utils';
import FormProvider, { RHFSelect } from 'src/components/hook-form';

import { IProductItem } from 'src/types/product';
import { ICheckoutItem } from 'src/types/checkout';

import IncrementerButton from './common/incrementer-button';

// ----------------------------------------------------------------------

// Tình trạng kho hiện cho khách. Mapper trả 'in_stock' / 'out_of_stock'; dữ liệu mẫu cũ viết 'in stock', 'low stock'….
const INVENTORY_STATUS: Record<string, { label: string; color: string }> = {
  in_stock: { label: 'Còn hàng', color: 'success.main' },
  low_stock: { label: 'Sắp hết hàng', color: 'warning.main' },
  out_of_stock: { label: 'Hết hàng', color: 'error.main' },
};

// ----------------------------------------------------------------------

type Props = {
  product: IProductItem;
  items?: ICheckoutItem[];
  disabledActions?: boolean;
  onGotoStep?: (step: number) => void;
  onAddCart?: (cartItem: ICheckoutItem) => void;
};

export default function ProductDetailsSummary({
  items,
  product,
  onAddCart,
  onGotoStep,
  disabledActions,
  ...other
}: Props) {
  const router = useRouter();

  const {
    id,
    name,
    sizes,
    price,
    coverUrl,
    colors,
    newLabel,
    available,
    priceSale,
    saleLabel,
    totalRatings,
    totalReviews,
    inventoryType,
    subDescription,
  } = product;

  const existProduct = !!items?.length && items.map((item) => item.id).includes(id);

  const outOfStock = available < 1;

  const isMaxQuantity =
    !!items?.length &&
    items.filter((item) => item.id === id).map((item) => item.quantity)[0] >= available;

  const inventoryStatus =
    INVENTORY_STATUS[inventoryType.replace(/ /g, '_')] ??
    INVENTORY_STATUS[outOfStock ? 'out_of_stock' : 'in_stock'];

  const defaultValues = {
    id,
    name,
    coverUrl,
    available,
    price,
    colors: colors[0],
    size: sizes[0],
    quantity: outOfStock ? 0 : 1,
  };

  const methods = useForm({
    defaultValues,
  });

  const { reset, watch, control, setValue, handleSubmit } = methods;

  const values = watch();

  // Đặt lại khi sang sản phẩm khác hoặc giá / số còn đổi. Không theo object `product`: SWR tải lại (vd khách quay lại
  // tab) tạo object mới cùng nội dung — đặt lại lúc đó làm mất số lượng khách đang chọn.
  useEffect(() => {
    if (product) {
      reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, price, available]);

  // "Mua ngay": thêm vào giỏ (nếu chưa có) rồi sang trang đặt hàng.
  const onSubmit = handleSubmit(async (data) => {
    try {
      if (!existProduct) {
        onAddCart?.({
          ...data,
          colors: values.colors ? [values.colors] : [],
          subTotal: data.price * data.quantity,
        });
      }
      onGotoStep?.(0);
      router.push(paths.product.checkout);
    } catch (error) {
      console.error(error);
    }
  });

  const handleAddCart = useCallback(() => {
    try {
      onAddCart?.({
        ...values,
        colors: values.colors ? [values.colors] : [],
        subTotal: values.price * values.quantity,
      });
    } catch (error) {
      console.error(error);
    }
  }, [onAddCart, values]);

  // priceSale = 0 (không giảm giá): phải ép về boolean — `0 && …` làm React in chữ "0" trước giá ("015.000 ₫").
  const renderPrice = (
    <Box sx={{ typography: 'h5' }}>
      {!!priceSale && (
        <Box
          component="span"
          sx={{
            color: 'text.disabled',
            textDecoration: 'line-through',
            mr: 0.5,
          }}
        >
          {fCurrency(priceSale)}
        </Box>
      )}

      {fCurrency(price)}
    </Box>
  );

  // Màu / kích cỡ chỉ hiện khi sản phẩm có dữ liệu (hàng KiotViet hiện chưa có); không có bảng size, so sánh, yêu thích, chia sẻ.
  const renderColorOptions = colors.length > 0 && (
    <Stack direction="row">
      <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
        Màu sắc
      </Typography>

      <Controller
        name="colors"
        control={control}
        render={({ field }) => (
          <ColorPicker
            colors={colors}
            selected={field.value}
            onSelectColor={(color) => field.onChange(color as string)}
            limit={4}
          />
        )}
      />
    </Stack>
  );

  const renderSizeOptions = sizes.length > 0 && (
    <Stack direction="row">
      <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
        Kích cỡ
      </Typography>

      <RHFSelect name="size" size="small" sx={{ maxWidth: 88 }}>
        {sizes.map((size) => (
          <MenuItem key={size} value={size}>
            {size}
          </MenuItem>
        ))}
      </RHFSelect>
    </Stack>
  );

  const renderQuantity = (
    <Stack direction="row">
      <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
        Số lượng
      </Typography>

      {/* Không hiện số tồn: cửa hàng online chỉ biết còn/hết (nhãn phía trên), máy chủ kiểm tồn khi đặt hàng. */}
      <IncrementerButton
        name="quantity"
        quantity={values.quantity}
        disabledDecrease={values.quantity <= 1}
        disabledIncrease={values.quantity >= available}
        onIncrease={() => setValue('quantity', values.quantity + 1)}
        onDecrease={() => setValue('quantity', values.quantity - 1)}
      />
    </Stack>
  );

  const renderActions = (
    <Stack direction="row" spacing={2}>
      <Button
        fullWidth
        disabled={isMaxQuantity || outOfStock || disabledActions}
        size="large"
        color="warning"
        variant="contained"
        startIcon={<Iconify icon="solar:cart-plus-bold" width={24} />}
        onClick={handleAddCart}
        sx={{ whiteSpace: 'nowrap' }}
      >
        Thêm vào giỏ
      </Button>

      <Button
        fullWidth
        size="large"
        type="submit"
        variant="contained"
        disabled={outOfStock || disabledActions}
      >
        Mua ngay
      </Button>
    </Stack>
  );

  const renderSubDescription = (
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      {subDescription}
    </Typography>
  );

  // Chưa có đánh giá thì không hiện sao (0 sao trông như bị chấm điểm thấp).
  const renderRating = totalReviews > 0 && (
    <Stack
      direction="row"
      alignItems="center"
      sx={{
        color: 'text.disabled',
        typography: 'body2',
      }}
    >
      <Rating size="small" value={totalRatings} precision={0.1} readOnly sx={{ mr: 1 }} />
      {`(${fShortenNumber(totalReviews)} đánh giá)`}
    </Stack>
  );

  const renderLabels = (newLabel.enabled || saleLabel.enabled) && (
    <Stack direction="row" alignItems="center" spacing={1}>
      {newLabel.enabled && <Label color="info">{newLabel.content}</Label>}
      {saleLabel.enabled && <Label color="error">{saleLabel.content}</Label>}
    </Stack>
  );

  const renderInventoryType = (
    <Box component="span" sx={{ typography: 'overline', color: inventoryStatus.color }}>
      {inventoryStatus.label}
    </Box>
  );

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Stack spacing={3} sx={{ pt: 3 }} {...other}>
        <Stack spacing={2} alignItems="flex-start">
          {renderLabels}

          {renderInventoryType}

          <Typography variant="h5" component="h1">
            {name}
          </Typography>

          {renderRating}

          {renderPrice}

          {!!subDescription && renderSubDescription}
        </Stack>

        <Divider sx={{ borderStyle: 'dashed' }} />

        {renderColorOptions}

        {renderSizeOptions}

        {renderQuantity}

        <Divider sx={{ borderStyle: 'dashed' }} />

        {renderActions}
      </Stack>
    </FormProvider>
  );
}
