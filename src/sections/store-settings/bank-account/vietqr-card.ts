import QRCode from 'qrcode';

import { escapeHtml } from 'src/utils/print-html';

import { buildReceiptQr } from 'src/sections/pos/receipt-print/receipt-qr';

// ----------------------------------------------------------------------
// Thẻ mã VietQR của tài khoản nhận tiền: in (khổ A6, dán quầy) hoặc tải ảnh PNG. Mã QR vẽ từ chuỗi EMVCo (payload) do
// core-be dựng — in thành SVG nằm ngay trong tài liệu, ảnh PNG vẽ bằng canvas; chỉ khi không có payload mới dùng ảnh
// img.vietqr.io.
// ----------------------------------------------------------------------

export type VietQrCardData = {
  storeName?: string | null;
  /** Logo ngân hàng (danh sách VietQR) — không tải được thì bỏ */
  bankLogoUrl?: string | null;
  /** Tên ngắn: VCB, Techcombank… */
  bankLabel: string;
  /** Tên đầy đủ của ngân hàng */
  bankName?: string | null;
  accountNumber: string;
  accountName?: string | null;
  amount?: number | null;
  content?: string | null;
  payload?: string | null;
  imageUrl?: string | null;
};

/** Cạnh mã QR trên thẻ in (mm). */
export const CARD_QR_MM = 70;

/** 125000 → "125.000 đ" (không phụ thuộc ngôn ngữ giao diện). */
export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)} đ`;
}

/** Tên file ảnh: vietqr-vcb-0123456789.png */
export function vietQrFileName(
  data: Pick<VietQrCardData, 'bankLabel' | 'accountNumber' | 'amount'>
): string {
  const slug = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const parts = ['vietqr', slug(data.bankLabel), slug(data.accountNumber)];
  if (data.amount) parts.push(String(data.amount));
  return `${parts.filter(Boolean).join('-')}.png`;
}

const CARD_CSS = [
  '@page{size:105mm 148mm;margin:0}',
  '*{box-sizing:border-box;margin:0;padding:0}',
  'html,body{width:105mm;height:148mm;background:#fff;color:#111}',
  "body{font-family:'Public Sans',Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}",
  '.card{width:105mm;height:148mm;padding:7mm 8mm;display:flex;flex-direction:column;align-items:center;text-align:center}',
  '.store{font-size:15pt;font-weight:700;line-height:1.2;margin-bottom:2mm}',
  '.bank{display:flex;align-items:center;justify-content:center;gap:2mm;margin-bottom:3mm;font-size:11pt;font-weight:600}',
  '.bank img{height:9mm;max-width:30mm;object-fit:contain}',
  '.qr{display:flex;align-items:center;justify-content:center}',
  `.qr svg,.qr img{width:${CARD_QR_MM}mm;height:${CARD_QR_MM}mm;display:block}`,
  '.acc{font-size:17pt;font-weight:700;letter-spacing:0.5mm;margin-top:3mm;font-family:Consolas,Menlo,monospace}',
  '.name{font-size:12pt;font-weight:600;margin-top:1mm}',
  '.full{font-size:9pt;color:#555;margin-top:0.5mm}',
  '.extra{margin-top:2.5mm;font-size:11pt}',
  '.extra b{font-size:13pt}',
  '.hint{margin-top:auto;font-size:8.5pt;color:#555}',
].join('');

/** Tài liệu in thẻ VietQR (cả trang, khổ A6 dọc) cho printHtmlDocument. */
export function buildVietQrCardHtml(data: VietQrCardData): string {
  const qr = buildReceiptQr(data.payload, CARD_QR_MM);
  let qrHtml = '';
  if (qr) qrHtml = qr.svg;
  else if (data.imageUrl)
    qrHtml = `<img src="${escapeHtml(data.imageUrl)}" alt="Mã QR chuyển khoản">`;

  const rows: string[] = [];
  if (data.storeName?.trim())
    rows.push(`<div class="store">${escapeHtml(data.storeName.trim())}</div>`);

  const logo = data.bankLogoUrl ? `<img src="${escapeHtml(data.bankLogoUrl)}" alt="">` : '';
  rows.push(`<div class="bank">${logo}<span>${escapeHtml(data.bankLabel)}</span></div>`);
  rows.push(`<div class="qr">${qrHtml}</div>`);
  rows.push(`<div class="acc">${escapeHtml(data.accountNumber)}</div>`);
  if (data.accountName?.trim())
    rows.push(`<div class="name">${escapeHtml(data.accountName.trim())}</div>`);
  if (data.bankName?.trim() && data.bankName.trim() !== data.bankLabel)
    rows.push(`<div class="full">${escapeHtml(data.bankName.trim())}</div>`);
  if (data.amount)
    rows.push(`<div class="extra">Số tiền: <b>${escapeHtml(formatVnd(data.amount))}</b></div>`);
  if (data.content?.trim())
    rows.push(`<div class="extra">Nội dung: <b>${escapeHtml(data.content.trim())}</b></div>`);
  rows.push(
    '<div class="hint">Quét mã bằng app ngân hàng hoặc ví hỗ trợ VietQR để chuyển khoản</div>'
  );

  const title = `Mã VietQR ${data.bankLabel} ${data.accountNumber}`;
  return (
    '<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">' +
    `<title>${escapeHtml(title)}</title><style>${CARD_CSS}</style></head>` +
    `<body><div class="card">${rows.join('')}</div></body></html>`
  );
}

// ---------------------------------------------------------------------- Ảnh PNG

function loadImage(
  src: string,
  crossOrigin: boolean,
  timeoutMs = 5000
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

/** Ngắt dòng theo từ cho vừa maxWidth (tên chủ tài khoản / nội dung dài). */
function wrapLines(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines;
}

const FONT = "'Public Sans', Arial, Helvetica, sans-serif";

/**
 * Vẽ thẻ VietQR thành ảnh PNG (Blob). Logo ngân hàng chỉ vẽ khi máy chủ ảnh cho phép CORS (không thì bỏ, để canvas
 * không bị "bẩn"). Không có payload → thử ảnh img.vietqr.io; vẫn không được thì null.
 */
export async function renderVietQrCardPng(data: VietQrCardData): Promise<Blob | null> {
  const qrSrc = data.payload
    ? await QRCode.toDataURL(data.payload, { width: 640, margin: 2, errorCorrectionLevel: 'M' })
    : data.imageUrl;
  if (!qrSrc) return null;

  const [qrImage, logo] = await Promise.all([
    loadImage(qrSrc, !data.payload),
    data.bankLogoUrl ? loadImage(data.bankLogoUrl, true) : Promise.resolve(null),
  ]);
  if (!qrImage) return null;

  const width = 900;
  const pad = 60;
  const inner = width - pad * 2;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Đo trước để biết chiều cao ảnh.
  ctx.font = `600 34px ${FONT}`;
  const nameLines = data.accountName?.trim() ? wrapLines(ctx, data.accountName.trim(), inner) : [];
  ctx.font = `400 30px ${FONT}`;
  const contentLines = data.content?.trim()
    ? wrapLines(ctx, `Nội dung: ${data.content.trim()}`, inner)
    : [];
  ctx.font = `700 42px ${FONT}`;
  const storeLines = data.storeName?.trim() ? wrapLines(ctx, data.storeName.trim(), inner) : [];

  const qrSize = 640;
  let height = pad;
  height += storeLines.length * 52 + (storeLines.length ? 16 : 0);
  height += 80 + 24; // logo + tên ngân hàng
  height += qrSize + 24;
  height += 60; // số tài khoản
  height += nameLines.length * 44;
  height += data.amount ? 48 : 0;
  height += contentLines.length * 40;
  height += 70 + pad; // dòng hướng dẫn

  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#111111';

  let y = pad;
  if (storeLines.length) {
    ctx.font = `700 42px ${FONT}`;
    storeLines.forEach((line) => {
      ctx.fillText(line, width / 2, y);
      y += 52;
    });
    y += 16;
  }

  // Logo + tên ngắn của ngân hàng trên một hàng, căn giữa.
  ctx.font = `600 36px ${FONT}`;
  const labelWidth = ctx.measureText(data.bankLabel).width;
  const logoHeight = 64;
  const logoWidth = logo ? Math.min(200, (logo.width / Math.max(1, logo.height)) * logoHeight) : 0;
  const gap = logo ? 20 : 0;
  const rowStart = (width - (logoWidth + gap + labelWidth)) / 2;
  if (logo) ctx.drawImage(logo, rowStart, y + 8, logoWidth, logoHeight);
  ctx.textAlign = 'left';
  ctx.fillText(data.bankLabel, rowStart + logoWidth + gap, y + 22);
  ctx.textAlign = 'center';
  y += 80 + 24;

  ctx.drawImage(qrImage, (width - qrSize) / 2, y, qrSize, qrSize);
  y += qrSize + 24;

  ctx.font = `700 48px Consolas, Menlo, monospace`;
  ctx.fillText(data.accountNumber, width / 2, y);
  y += 60;

  if (nameLines.length) {
    ctx.font = `600 34px ${FONT}`;
    nameLines.forEach((line) => {
      ctx.fillText(line, width / 2, y);
      y += 44;
    });
  }
  if (data.amount) {
    ctx.font = `700 36px ${FONT}`;
    ctx.fillText(`Số tiền: ${formatVnd(data.amount)}`, width / 2, y + 4);
    y += 48;
  }
  if (contentLines.length) {
    ctx.font = `400 30px ${FONT}`;
    contentLines.forEach((line) => {
      ctx.fillText(line, width / 2, y + 4);
      y += 40;
    });
  }

  ctx.font = `400 24px ${FONT}`;
  ctx.fillStyle = '#666666';
  ctx.fillText(
    'Quét mã bằng app ngân hàng hoặc ví hỗ trợ VietQR để chuyển khoản',
    width / 2,
    height - pad - 20
  );

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      // Ảnh dự phòng img.vietqr.io không cho CORS → canvas "bẩn", không xuất được.
      resolve(null);
    }
  });
}

/** Tải Blob về máy với tên file cho trước. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Chờ ảnh (logo ngân hàng / ảnh QR dự phòng) vào bộ nhớ đệm trước khi in — print() không chờ ảnh mạng. */
export async function preloadImages(
  urls: (string | null | undefined)[],
  timeoutMs = 3000
): Promise<void> {
  await Promise.all(
    urls.filter((u): u is string => !!u).map((u) => loadImage(u, false, timeoutMs))
  );
}
