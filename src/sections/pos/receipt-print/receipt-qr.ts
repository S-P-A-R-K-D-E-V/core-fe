import QRCode from 'qrcode';

// ----------------------------------------------------------------------
// Mã QR của phiếu thanh toán: vẽ chuỗi EMVCo / VietQR do core-be dựng thành SVG nằm ngay trong tài liệu
// in (không gọi mạng, không ảnh ngoài). Mỗi ô của mã rộng một số NGUYÊN điểm in của máy in nhiệt
// 203 dpi (8 điểm/mm) để các ô không bị nhoè khi máy in làm tròn.
// ----------------------------------------------------------------------

const DOTS_PER_MM = 8;

/** Vùng trắng bắt buộc quanh mã QR, tính bằng ô. */
export const QR_QUIET_MODULES = 4;

// Cỡ ô thử lần lượt từ to đến nhỏ (điểm in): 5 điểm = 0,625 mm … 2 điểm = 0,25 mm.
const MODULE_DOTS = [5, 4, 3, 2];

export type ReceiptQr = {
  svg: string;
  /** Cạnh của hình vuông mã QR kể cả vùng trắng. */
  sizeMm: number;
  /** Số ô mỗi cạnh, không kể vùng trắng. */
  modules: number;
  moduleDots: number;
};

const trimNumber = (value: number) => String(Math.round(value * 1000) / 1000);

/**
 * SVG của mã QR cho `payload`, cỡ ô lớn nhất mà cả mã (kể cả vùng trắng) còn vừa `maxMm`.
 * Trả null khi không có nội dung, nội dung quá dài cho một mã QR, hoặc mã không vừa `maxMm` dù đã
 * dùng ô nhỏ nhất — phiếu khi đó in thông tin chuyển khoản bằng chữ.
 */
export function buildReceiptQr(
  payload: string | null | undefined,
  maxMm: number
): ReceiptQr | null {
  const text = (payload ?? '').trim();
  if (!text) return null;

  let size: number;
  let data: Uint8Array;
  try {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
    ({ size, data } = modules);
  } catch {
    return null;
  }

  const total = size + QR_QUIET_MODULES * 2;
  const moduleDots = MODULE_DOTS.find((dots) => (total * dots) / DOTS_PER_MM <= maxMm);
  if (!moduleDots) return null;
  const sizeMm = (total * moduleDots) / DOTS_PER_MM;

  // Gộp các ô đen liền nhau trên một hàng thành một hình chữ nhật.
  const runs: string[] = [];
  for (let row = 0; row < size; row += 1) {
    let col = 0;
    while (col < size) {
      if (!data[row * size + col]) {
        col += 1;
      } else {
        const start = col;
        while (col < size && data[row * size + col]) col += 1;
        const length = col - start;
        runs.push(`M${start + QR_QUIET_MODULES} ${row + QR_QUIET_MODULES}h${length}v1h-${length}z`);
      }
    }
  }

  const side = `${trimNumber(sizeMm)}mm`;
  const svg =
    `<svg class="qc" xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" ` +
    `viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" ` +
    `aria-label="Mã QR chuyển khoản"><path fill="#000" d="${runs.join('')}"/></svg>`;

  return { svg, sizeMm, modules: size, moduleDots };
}
