'use client';

import { useEffect, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { fCurrency } from 'src/utils/format-number';

import {
  CUSTOMER_DISPLAY_CHANNEL,
  type CustomerDisplayAds,
  type CustomerDisplayCart,
  type CustomerDisplayMessage,
  type CustomerDisplayQr,
  type CustomerDisplayView as View,
} from './customer-display-bus';

// ----------------------------------------------------------------------
// Màn hình khách (cửa sổ riêng, kéo / tự đặt sang màn hình phụ hướng về khách). Không gọi API: mọi thứ do trang bán
// hàng cùng trình duyệt đẩy sang qua BroadcastChannel (customer-display-bus). Mất liên lạc với trang bán hàng quá
// lâu → về quảng cáo.

const STALE_MS = 3 * 60_000;

export function CustomerDisplayScreen() {
  const [view, setView] = useState<View>({ mode: 'idle' });
  const [ads, setAds] = useState<CustomerDisplayAds | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const lastMessage = useRef(0);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const ch = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
    ch.onmessage = (event: MessageEvent<CustomerDisplayMessage>) => {
      const msg = event.data;
      if (msg?.type !== 'state') return;
      lastMessage.current = Date.now();
      setConnected(true);
      setView(msg.view);
      setAds(msg.ads);
      setStoreName(msg.storeName);
    };
    ch.postMessage({ type: 'hello' } satisfies CustomerDisplayMessage);
    const hello = setInterval(() => {
      if (Date.now() - lastMessage.current > 30_000) ch.postMessage({ type: 'hello' } satisfies CustomerDisplayMessage);
    }, 10_000);
    const stale = setInterval(() => {
      if (lastMessage.current && Date.now() - lastMessage.current > STALE_MS) setView({ mode: 'idle' });
    }, 15_000);
    return () => {
      clearInterval(hello);
      clearInterval(stale);
      ch.close();
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  return (
    <Box sx={{ position: 'fixed', inset: 0, bgcolor: '#0B0F14', color: '#fff', overflow: 'hidden', userSelect: 'none' }}>
      {view.mode === 'idle' && <AdsView ads={ads} storeName={storeName} />}
      {view.mode === 'cart' && <CartView cart={view.cart} storeName={storeName} />}
      {view.mode === 'qr' && <QrView qr={view.qr} cart={view.cart} />}
      {view.mode === 'paid' && <PaidView amount={view.amount} storeName={storeName} />}

      {!fullscreen && (
        <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 12, right: 12, opacity: 0.85 }}>
          {!connected && (
            <Typography variant="caption" sx={{ alignSelf: 'center', color: 'grey.400' }}>
              Đang chờ trang bán hàng…
            </Typography>
          )}
          <Button
            size="small"
            variant="contained"
            sx={{ bgcolor: 'rgba(255,255,255,.92)', color: '#111', boxShadow: 'none', '&:hover': { bgcolor: '#fff' } }}
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
          >
            Toàn màn hình
          </Button>
        </Stack>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------

function AdsView({ ads, storeName }: { ads: CustomerDisplayAds | null; storeName: string | null }) {
  const slides = ads?.slides ?? [];
  const [index, setIndex] = useState(0);
  const current = slides.length ? slides[index % slides.length] : null;

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  // Ảnh: chuyển sau intervalSeconds. Video: chuyển khi chạy xong (onEnded).
  useEffect(() => {
    if (!current || current.kind === 'video' || slides.length < 2) return undefined;
    const id = setTimeout(() => setIndex((i) => (i + 1) % slides.length), Math.max(3, ads?.intervalSeconds ?? 8) * 1000);
    return () => clearTimeout(id);
  }, [current, slides.length, ads?.intervalSeconds, index]);

  if (!current) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ height: 1, px: 4, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 'clamp(28px, 5vw, 64px)', fontWeight: 800 }}>{storeName || 'Xin chào quý khách'}</Typography>
        <Typography sx={{ mt: 2, fontSize: 'clamp(16px, 2vw, 26px)', color: 'grey.400' }}>Cảm ơn quý khách đã ghé cửa hàng</Typography>
      </Stack>
    );
  }

  return (
    <Box sx={{ position: 'absolute', inset: 0 }}>
      {current.kind === 'video' ? (
        <Box
          key={`${index}-${current.url}`}
          component="video"
          src={current.url}
          autoPlay
          muted
          playsInline
          loop={slides.length === 1}
          onEnded={() => setIndex((i) => (i + 1) % slides.length)}
          onError={() => setIndex((i) => (i + 1) % slides.length)}
          sx={{ width: 1, height: 1, objectFit: 'contain', bgcolor: '#000' }}
        />
      ) : (
        <Box
          key={`${index}-${current.url}`}
          component="img"
          src={current.url}
          alt={current.title ?? ''}
          sx={{ width: 1, height: 1, objectFit: 'contain', animation: 'cdFade .6s ease', '@keyframes cdFade': { from: { opacity: 0 }, to: { opacity: 1 } } }}
        />
      )}
      {current.title && (
        <Typography
          sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: 3, fontSize: 'clamp(18px, 2.4vw, 32px)', fontWeight: 700, background: 'linear-gradient(transparent, rgba(0,0,0,.7))' }}
        >
          {current.title}
        </Typography>
      )}
    </Box>
  );
}

function Totals({ cart, big }: { cart: CustomerDisplayCart; big?: boolean }) {
  const row = (label: string, value: string, strong?: boolean) => (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
      <Typography sx={{ fontSize: strong ? 'clamp(20px, 2.4vw, 30px)' : 'clamp(15px, 1.6vw, 20px)', color: strong ? '#fff' : 'grey.400', fontWeight: strong ? 800 : 500 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: strong ? (big ? 'clamp(30px, 4vw, 56px)' : 'clamp(22px, 2.8vw, 36px)') : 'clamp(15px, 1.6vw, 20px)', fontWeight: strong ? 800 : 600 }}>
        {value}
      </Typography>
    </Stack>
  );
  return (
    <Box>
      {row(`Tạm tính (${cart.itemCount} món)`, fCurrency(cart.subtotal))}
      {cart.vat > 0 && row('VAT', fCurrency(cart.vat))}
      {cart.orderDiscount > 0 && row('Giảm giá', `-${fCurrency(cart.orderDiscount)}`)}
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,.15)', my: 1 }} />
      {row('Tổng thanh toán', fCurrency(Math.max(0, cart.total)), true)}
    </Box>
  );
}

function CartView({ cart, storeName }: { cart: CustomerDisplayCart; storeName: string | null }) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    el?.scrollTo?.({ top: el.scrollHeight, behavior: 'smooth' });
  }, [cart.lines.length]);

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} sx={{ height: 1 }}>
      <Box sx={{ flex: 1.4, display: 'flex', flexDirection: 'column', p: { xs: 2, md: 4 }, minHeight: 0 }}>
        <Typography sx={{ fontSize: 'clamp(18px, 2vw, 26px)', color: 'grey.400', mb: 1 }}>{storeName ?? 'Đơn hàng của quý khách'}</Typography>
        <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
          {cart.lines.map((line, i) => (
            <Stack
              key={line.key}
              direction="row"
              alignItems="center"
              spacing={2}
              sx={{ py: 1.5, borderBottom: '1px solid rgba(255,255,255,.08)', bgcolor: i === cart.lines.length - 1 ? 'rgba(255,255,255,.05)' : 'transparent', px: 1, borderRadius: 1 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 'clamp(16px, 1.8vw, 24px)', fontWeight: 700 }}>{line.name}</Typography>
                {line.detail && <Typography noWrap sx={{ color: 'grey.500', fontSize: 'clamp(13px, 1.3vw, 17px)' }}>{line.detail}</Typography>}
                <Typography sx={{ color: 'grey.400', fontSize: 'clamp(13px, 1.4vw, 18px)' }}>
                  {line.quantity} × {fCurrency(line.unitPrice)}
                  {line.discount > 0 ? `  (giảm ${fCurrency(line.discount)})` : ''}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 'clamp(16px, 1.9vw, 24px)', fontWeight: 700 }}>{fCurrency(line.amount)}</Typography>
            </Stack>
          ))}
        </Box>
      </Box>
      <Box sx={{ flex: 1, p: { xs: 2, md: 4 }, bgcolor: 'rgba(255,255,255,.04)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {cart.customerName && (
          <Typography sx={{ fontSize: 'clamp(16px, 1.8vw, 24px)', mb: 2 }}>
            Khách hàng: <b>{cart.customerName}</b>
          </Typography>
        )}
        <Totals cart={cart} big />
      </Box>
    </Stack>
  );
}

function QrView({ qr, cart }: { qr: CustomerDisplayQr; cart: CustomerDisplayCart | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = qr.expiresAt ? Math.max(0, Math.floor((new Date(qr.expiresAt).getTime() - now) / 1000)) : null;

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} alignItems="center" justifyContent="center" spacing={{ xs: 3, md: 8 }} sx={{ height: 1, p: 4 }}>
      <Box sx={{ bgcolor: '#fff', p: 2, borderRadius: 3, width: 'min(70vh, 42vw, 520px)', minWidth: 260, aspectRatio: '1 / 1' }}>
        <Box component="img" src={qr.imageSrc} alt="Mã QR chuyển khoản" sx={{ width: 1, height: 1, objectFit: 'contain' }} />
      </Box>
      <Box sx={{ maxWidth: 560 }}>
        <Typography sx={{ fontSize: 'clamp(22px, 2.6vw, 36px)', fontWeight: 800 }}>Quét mã để thanh toán</Typography>
        <Typography sx={{ fontSize: 'clamp(36px, 5vw, 72px)', fontWeight: 900, my: 1 }}>{fCurrency(qr.amount)}</Typography>
        {(qr.bankName || qr.accountNumber) && (
          <Typography sx={{ fontSize: 'clamp(16px, 1.8vw, 24px)', color: 'grey.300' }}>
            {[qr.bankName, qr.accountNumber].filter(Boolean).join(' · ')}
          </Typography>
        )}
        {qr.accountName && <Typography sx={{ fontSize: 'clamp(16px, 1.8vw, 24px)', color: 'grey.300' }}>{qr.accountName}</Typography>}
        {qr.paymentCode && (
          <Typography sx={{ mt: 1, fontSize: 'clamp(14px, 1.5vw, 20px)', color: 'grey.400' }}>
            Nội dung chuyển khoản: <b style={{ color: '#fff' }}>{qr.paymentCode}</b>
          </Typography>
        )}
        {left != null && (
          <Typography sx={{ mt: 1, color: left > 0 ? 'grey.500' : 'error.light' }}>
            {left > 0 ? `Mã hết hạn sau ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Mã đã hết hạn — nhờ thu ngân tạo mã mới'}
          </Typography>
        )}
        {cart && cart.lines.length > 0 && (
          <Typography sx={{ mt: 3, color: 'grey.500' }}>
            {cart.itemCount} món{cart.customerName ? ` · ${cart.customerName}` : ''}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

function PaidView({ amount, storeName }: { amount: number; storeName: string | null }) {
  return (
    <Stack alignItems="center" justifyContent="center" sx={{ height: 1, textAlign: 'center', px: 4 }}>
      <Box sx={{ width: 120, height: 120, borderRadius: '50%', bgcolor: 'success.main', display: 'grid', placeItems: 'center', mb: 3 }}>
        <Typography sx={{ fontSize: 72, lineHeight: 1, fontWeight: 900 }}>✓</Typography>
      </Box>
      <Typography sx={{ fontSize: 'clamp(30px, 4.5vw, 64px)', fontWeight: 900 }}>Cảm ơn quý khách!</Typography>
      {amount > 0 && <Typography sx={{ mt: 1, fontSize: 'clamp(20px, 2.4vw, 32px)', color: 'grey.300' }}>Đã thanh toán {fCurrency(amount)}</Typography>}
      {storeName && <Typography sx={{ mt: 3, color: 'grey.500', fontSize: 'clamp(16px, 1.6vw, 22px)' }}>{storeName} hẹn gặp lại</Typography>}
    </Stack>
  );
}
