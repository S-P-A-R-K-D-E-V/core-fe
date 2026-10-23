'use client';

import type {
  IAdminUnit,
  IStorefrontCheckoutConfig,
  IStorefrontShippingQuote,
  IStorefrontShippingOption,
} from 'src/types/online-shop';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid2';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { useRouter } from 'src/routes/hooks';

import { useDebounce } from 'src/hooks/use-debounce';

import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import { getWards, getProvinces, getCheckoutConfig, getShippingQuote, placeOnlineOrder } from 'src/api/online-shop';

import Iconify from 'src/components/iconify';

import { useCheckoutContext } from './context';
import CheckoutSummary from './checkout-summary';
import {
  orderHref,
  formatEta,
  orderItems,
  addressReady,
  normalizeVnPhone,
  pickShippingOption,
  isShippingFeeChanged,
  type AddressDraft,
} from './online-checkout-utils';

// ----------------------------------------------------------------------
// Bước "Nhận hàng & thanh toán" của trang bán online (khách không cần đăng nhập): liên hệ, cách nhận hàng (nhận tại cửa
// hàng / giao tận nơi — địa chỉ 2 cấp tỉnh → phường/xã, phí ship máy chủ hỏi hãng), phương thức thanh toán chủ cửa hàng
// bật cho kênh Online. Đặt xong chuyển sang trang đơn (mã QR / cổng thanh toán, tự cập nhật khi tiền về).
// ----------------------------------------------------------------------

export default function CheckoutDeliveryPayment() {
  const checkout = useCheckoutContext();
  const router = useRouter();

  const [config, setConfig] = useState<IStorefrontCheckoutConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<'ship' | 'pickup'>('ship');
  const [address, setAddress] = useState<AddressDraft>({ provinceCode: '', wardCode: '', street: '' });
  const [provinces, setProvinces] = useState<IAdminUnit[]>([]);
  const [wards, setWards] = useState<IAdminUnit[]>([]);
  const [wardsLoading, setWardsLoading] = useState(false);

  const [quote, setQuote] = useState<IStorefrontShippingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<{ connectionId: string; service?: string | null } | null>(null);

  const [payment, setPayment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    getCheckoutConfig()
      .then((c) => {
        setConfig(c);
        setMethod(c.delivery.ship ? 'ship' : 'pickup');
        setPayment(c.payments[0]?.key ?? c.payments[0]?.method ?? '');
        if (c.delivery.ship) getProvinces().then(setProvinces).catch(() => setProvinces([]));
      })
      .catch((err) => setConfigError(apiErrorMessage(err, 'Không tải được thông tin đặt hàng')));
  }, []);

  // Đổi tỉnh → tải phường/xã của tỉnh, bỏ phường đã chọn.
  useEffect(() => {
    setWards([]);
    if (!address.provinceCode) return;
    setWardsLoading(true);
    getWards(address.provinceCode)
      .then(setWards)
      .catch(() => setWards([]))
      .finally(() => setWardsLoading(false));
  }, [address.provinceCode]);

  const items = useMemo(() => orderItems(checkout.items), [checkout.items]);
  const debouncedStreet = useDebounce(address.street, 600);
  const quoteKey = method === 'ship' && addressReady({ ...address, street: debouncedStreet })
    ? JSON.stringify({ items, provinceCode: address.provinceCode, wardCode: address.wardCode, street: debouncedStreet.trim() })
    : null;

  const loadQuote = useCallback(async (key: string) => {
    const { items: quoteItems, ...addr } = JSON.parse(key);
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      setQuote(await getShippingQuote(quoteItems, addr));
    } catch (err) {
      setQuote(null);
      setQuoteError(apiErrorMessage(err, 'Chưa tính được phí giao hàng'));
    } finally {
      setQuoteLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!quoteKey) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    loadQuote(quoteKey);
  }, [quoteKey, loadQuote]);

  const option: IStorefrontShippingOption | null = method === 'ship' ? pickShippingOption(quote, chosen) : null;
  const shippingFee = method === 'pickup' ? 0 : option ? option.fee : undefined;
  const phoneOk = !!normalizeVnPhone(phone);
  const nameOk = name.trim().length >= 2;

  if (configError) {
    return <Alert severity="error">{configError}</Alert>;
  }
  if (!config || placed) {
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const noPayment = config.payments.length === 0;
  const noDelivery = !config.delivery.ship && !config.delivery.pickup;
  const canSubmit =
    !noPayment && !noDelivery && nameOk && phoneOk && items.length > 0 &&
    (method === 'pickup' || (!!option && addressReady(address) && !quoteLoading));

  const submit = async () => {
    setTouched(true);
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await placeOnlineOrder({
        customerName: name.trim(),
        phone: normalizeVnPhone(phone)!,
        email: email.trim() || null,
        note: note.trim() || null,
        items,
        paymentMethod: payment || null,
        returnUrl: `${window.location.origin}/order/{code}/?t={token}`,
        delivery:
          method === 'pickup'
            ? { method: 'pickup' }
            : {
                method: 'ship',
                address: { ...address, street: address.street.trim() },
                connectionId: option?.connectionId ?? null,
                service: option?.service ?? null,
                quotedFee: option?.fee ?? null,
              },
      });
      // Giỏ được làm trống ở trang đơn (?new=1) — làm trống ở đây thì trang này nháy "giỏ hàng trống" trước khi chuyển.
      setPlaced(true);
      router.push(`${orderHref(result.orderCode, result.token)}&new=1`);
    } catch (err) {
      if (isShippingFeeChanged(err) && quoteKey) {
        // Phí ship vừa đổi (hãng cập nhật giá / giỏ đổi): hỏi lại khách với số mới, không lặng lẽ thu khác.
        await loadQuote(quoteKey);
      }
      setSubmitError(apiErrorMessage(err, 'Đặt hàng thất bại, vui lòng thử lại'));
    } finally {
      setSubmitting(false);
    }
  };

  const province = provinces.find((p) => p.code === address.provinceCode) ?? null;
  const ward = wards.find((w) => w.code === address.wardCode) ?? null;
  const freeNote =
    config.delivery.freeShippingThreshold && method === 'ship' && checkout.subTotal < config.delivery.freeShippingThreshold
      ? `Mua thêm ${fCurrency(config.delivery.freeShippingThreshold - checkout.subTotal)} để được miễn phí giao hàng`
      : null;

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 8 }}>
        <Stack spacing={3}>
          <Card>
            <CardHeader title="Thông tin người nhận" />
            <Stack spacing={2} sx={{ p: 3 }}>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <TextField
                  label="Họ tên *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={touched && !nameOk}
                  helperText={touched && !nameOk ? 'Vui lòng nhập họ tên' : undefined}
                  autoComplete="name"
                  inputProps={{ maxLength: 150 }}
                />
                <TextField
                  label="Số điện thoại *"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  error={touched && !phoneOk}
                  helperText={touched && !phoneOk ? 'Số điện thoại chưa đúng' : undefined}
                  autoComplete="tel"
                  inputProps={{ inputMode: 'tel', maxLength: 20 }}
                />
              </Box>
              <TextField label="Email (không bắt buộc)" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              <TextField
                label="Ghi chú cho cửa hàng"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                multiline
                minRows={2}
                inputProps={{ maxLength: 1000 }}
              />
            </Stack>
          </Card>

          <Card>
            <CardHeader title="Nhận hàng" />
            <Stack spacing={2} sx={{ p: 3 }}>
              {noDelivery && <Alert severity="warning">Cửa hàng chưa mở nhận đơn online.</Alert>}
              <RadioGroup value={method} onChange={(e) => setMethod(e.target.value as 'ship' | 'pickup')}>
                {config.delivery.ship && (
                  <FormControlLabel value="ship" control={<Radio />} label="Giao tận nơi" />
                )}
                {config.delivery.pickup && (
                  <FormControlLabel
                    value="pickup"
                    control={<Radio />}
                    label={
                      <Stack>
                        <span>Nhận tại cửa hàng — miễn phí</span>
                        {config.delivery.pickupNote && (
                          <Typography variant="caption" color="text.secondary">
                            {config.delivery.pickupNote}
                          </Typography>
                        )}
                      </Stack>
                    }
                  />
                )}
              </RadioGroup>

              {method === 'ship' && (
                <Stack spacing={2}>
                  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                    <Autocomplete
                      options={provinces}
                      value={province}
                      onChange={(_, p) => setAddress({ provinceCode: p?.code ?? '', wardCode: '', street: address.street })}
                      getOptionLabel={(o) => o.name}
                      isOptionEqualToValue={(a, b) => a.code === b.code}
                      renderInput={(params) => <TextField {...params} label="Tỉnh / thành phố *" />}
                      noOptionsText="Không tìm thấy"
                    />
                    <Autocomplete
                      options={wards}
                      value={ward}
                      loading={wardsLoading}
                      disabled={!address.provinceCode}
                      onChange={(_, w) => setAddress({ ...address, wardCode: w?.code ?? '' })}
                      getOptionLabel={(o) => o.name}
                      isOptionEqualToValue={(a, b) => a.code === b.code}
                      renderInput={(params) => <TextField {...params} label="Phường / xã *" />}
                      noOptionsText="Không tìm thấy"
                    />
                  </Box>
                  <TextField
                    label="Số nhà, tên đường *"
                    value={address.street}
                    onChange={(e) => setAddress({ ...address, street: e.target.value })}
                    autoComplete="street-address"
                    inputProps={{ maxLength: 250 }}
                    helperText="Địa chỉ theo đơn vị hành chính mới (sau sáp nhập 07/2025)"
                  />

                  {quoteLoading && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={18} />
                      <Typography variant="body2">Đang tính phí giao hàng…</Typography>
                    </Stack>
                  )}
                  {quoteError && !quoteLoading && <Alert severity="warning">{quoteError}</Alert>}
                  {quote && !quoteLoading && quote.carrierSelection === 'choose' && quote.options.length > 1 && (
                    <RadioGroup
                      value={option ? `${option.connectionId}|${option.service ?? ''}` : ''}
                      onChange={(e) => {
                        const [connectionId, service] = e.target.value.split('|');
                        setChosen({ connectionId, service: service || null });
                      }}
                    >
                      {quote.options.map((o) => (
                        <FormControlLabel
                          key={`${o.connectionId}|${o.service ?? ''}`}
                          value={`${o.connectionId}|${o.service ?? ''}`}
                          control={<Radio />}
                          label={<ShippingOptionLabel option={o} />}
                        />
                      ))}
                    </RadioGroup>
                  )}
                  {option && !quoteLoading && (quote?.carrierSelection !== 'choose' || (quote?.options.length ?? 0) <= 1) && (
                    <Alert severity="info" icon={<Iconify icon="solar:delivery-bold" />}>
                      <ShippingOptionLabel option={option} />
                    </Alert>
                  )}
                </Stack>
              )}
            </Stack>
          </Card>

          <Card>
            <CardHeader title="Thanh toán" />
            <Stack spacing={2} sx={{ p: 3 }}>
              {noPayment ? (
                <Alert severity="warning">
                  Cửa hàng chưa nhận thanh toán online — vui lòng liên hệ cửa hàng để đặt hàng.
                </Alert>
              ) : (
                <RadioGroup value={payment} onChange={(e) => setPayment(e.target.value)}>
                  {config.payments.map((p) => (
                    <FormControlLabel
                      key={p.key ?? p.method}
                      value={p.key ?? p.method}
                      control={<Radio />}
                      label={
                        <Stack>
                          <span>{p.label}</span>
                          {p.detail && (
                            <Typography variant="caption" color="text.secondary">
                              {p.detail}
                            </Typography>
                          )}
                        </Stack>
                      }
                    />
                  ))}
                </RadioGroup>
              )}
            </Stack>
          </Card>

          <Stack direction="row" justifyContent="space-between">
            <Button
              size="small"
              color="inherit"
              onClick={checkout.onBackStep}
              startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
            >
              Quay lại giỏ hàng
            </Button>
          </Stack>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <CheckoutSummary
          subTotal={checkout.subTotal}
          shipping={shippingFee}
          freeShipping={option?.freeShipping}
          shippingNote={method === 'pickup' ? 'Nhận tại cửa hàng' : freeNote ?? (option ? option.carrierLabel : 'Chọn địa chỉ để tính')}
        >
          {submitError && <Alert severity="error">{submitError}</Alert>}
          <LoadingButton fullWidth size="large" variant="contained" loading={submitting} onClick={submit} disabled={noPayment || noDelivery}>
            Đặt hàng và thanh toán
          </LoadingButton>
          <Typography variant="caption" color="text.secondary">
            Giá và phí giao hàng được cửa hàng kiểm lại khi đặt. Đơn được xác nhận ngay khi tiền về.
          </Typography>
        </CheckoutSummary>
      </Grid>
    </Grid>
  );
}

function ShippingOptionLabel({ option }: { option: IStorefrontShippingOption }) {
  const eta = formatEta(option.expectedDeliveryAt);
  return (
    <Stack>
      <Typography variant="body2">
        {option.carrierLabel}
        {option.serviceLabel ? ` · ${option.serviceLabel}` : ''} —{' '}
        <strong>{option.freeShipping || option.fee === 0 ? 'Miễn phí' : fCurrency(option.fee)}</strong>
      </Typography>
      {eta && (
        <Typography variant="caption" color="text.secondary">
          Dự kiến giao {eta}
        </Typography>
      )}
    </Stack>
  );
}
