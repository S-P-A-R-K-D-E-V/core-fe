import Fab from '@mui/material/Fab';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';

import Label from 'src/components/label';
import Image from 'src/components/image';
import Iconify from 'src/components/iconify';
import { ColorPreview } from 'src/components/color-utils';

import { IProductItem } from 'src/types/product';

import { useCheckoutContext } from '../checkout/context';

// ----------------------------------------------------------------------

type Props = {
  product: IProductItem;
  /** Ảnh tải ngay, không lazy-load (các thẻ hàng đầu). */
  eager?: boolean;
};

export default function ProductItem({ product, eager = false }: Props) {
  const { onAddToCart } = useCheckoutContext();

  const { id, name, coverUrl, price, colors, available, sizes, priceSale, newLabel, saleLabel } =
    product;

  const linkTo = paths.product.details(id);

  const handleAddCart = async () => {
    const newProduct = {
      id,
      name,
      coverUrl,
      available,
      price,
      colors: [colors[0]],
      size: sizes[0],
      quantity: 1,
    };
    try {
      onAddToCart(newProduct);
    } catch (error) {
      console.error(error);
    }
  };

  const renderLabels = (newLabel.enabled || saleLabel.enabled) && (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ position: 'absolute', zIndex: 9, top: 16, right: 16 }}
    >
      {newLabel.enabled && (
        <Label variant="filled" color="info">
          {newLabel.content}
        </Label>
      )}
      {saleLabel.enabled && (
        <Label variant="filled" color="error">
          {saleLabel.content}
        </Label>
      )}
    </Stack>
  );

  const renderImg = (
    <Box sx={{ position: 'relative', p: 1 }}>
      {!!available && (
        <Fab
          color="warning"
          size="medium"
          className="add-cart-btn"
          aria-label={`Thêm ${name} vào giỏ`}
          onClick={handleAddCart}
          sx={{
            right: 16,
            bottom: 16,
            zIndex: 9,
            opacity: 0,
            position: 'absolute',
            transition: (theme) =>
              theme.transitions.create('all', {
                easing: theme.transitions.easing.easeInOut,
                duration: theme.transitions.duration.shorter,
              }),
          }}
        >
          <Iconify icon="solar:cart-plus-bold" width={24} />
        </Fab>
      )}

      {/* Nhãn "Hết hàng" hiện luôn (thay Tooltip "Out of stock" — Tooltip gắn aria-label lên span, sai ARIA). */}
      {!available && (
        <Label variant="filled" color="default" sx={{ position: 'absolute', zIndex: 9, left: 16, bottom: 16 }}>
          Hết hàng
        </Label>
      )}
      <Image
        alt={name}
        src={coverUrl}
        ratio="1/1"
        // Hàng đầu (thấy ngay khi mở trang) tải luôn, không chờ JS của lazy-load — ảnh lớn đầu tiên là LCP.
        visibleByDefault={eager}
        disabledEffect={eager}
        sx={{
          borderRadius: 1.5,
          ...(!available && {
            opacity: 0.48,
            filter: 'grayscale(1)',
          }),
        }}
      />
    </Box>
  );

  const renderContent = (
    <Stack spacing={2.5} sx={{ p: 3, pt: 2 }}>
      <Link component={RouterLink} href={linkTo} color="inherit" variant="subtitle2" noWrap>
        {name}
      </Link>

      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <ColorPreview colors={colors} />

        <Stack direction="row" spacing={0.5} sx={{ typography: 'subtitle1' }}>
          {!!priceSale && (
            <Box component="span" sx={{ color: 'text.disabled', textDecoration: 'line-through' }}>
              {fCurrency(priceSale)}
            </Box>
          )}

          <Box component="span">{fCurrency(price)}</Box>
        </Stack>
      </Stack>
    </Stack>
  );

  return (
    <Card
      component="article"
      sx={{
        '&:hover .add-cart-btn': {
          opacity: 1,
        },
      }}
    >
      {renderLabels}

      {renderImg}

      {renderContent}
    </Card>
  );
}
