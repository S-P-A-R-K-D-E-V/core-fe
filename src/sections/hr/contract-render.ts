import type { IEmploymentContract } from 'src/types/hr';

// ----------------------------------------------------------------------
// Hiển thị / in hợp đồng. Nội dung đã trộn có hai dạng: chữ (mẫu cũ — định dạng theo dòng) hoặc HTML (mẫu soạn bằng trình
// soạn / tải lên; máy chủ đã lọc thẻ). Hai trường chữ ký không trộn ở máy chủ: {{chu_ky_nguoi_lao_dong}} thành ảnh chữ ký
// nhân viên (SVG máy chủ dựng từ nét vẽ) hoặc chỗ trống để ký, {{chu_ky_cua_hang}} thành chỗ trống để ký.
// ----------------------------------------------------------------------

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

/** Ảnh chữ ký (SVG do máy chủ dựng) → thẻ img dạng data URL. */
export function signatureImg(svg: string): string {
  return `<img class="signature" alt="Chữ ký" src="data:image/svg+xml;base64,${base64Utf8(svg)}">`;
}

const SIGN_SLOT = '<span class="sign-slot"></span>';

/** Thay hai trường chữ ký trong nội dung đã trộn. */
export function fillSignatureFields(html: string, signatureSvg?: string | null): string {
  return html
    .replace(/\{\{\s*chu_ky_nguoi_lao_dong\s*\}\}/g, signatureSvg ? signatureImg(signatureSvg) : SIGN_SLOT)
    .replace(/\{\{\s*chu_ky_cua_hang\s*\}\}/g, SIGN_SLOT);
}

/** Khối chữ ký hai cột ([[CHU_KY]]): bên người lao động có ảnh chữ ký khi nhân viên đã ký. */
export const SIGN_HTML = (staffName: string, signatureSvg?: string | null) =>
  `<table class="sign"><tr><td><strong>NGƯỜI LAO ĐỘNG</strong><br><em>(Ký, ghi rõ họ tên)</em>${
    signatureSvg ? `<div class="sign-image">${signatureImg(signatureSvg)}</div>` : '<div class="sign-space"></div>'
  }<strong>${escapeHtml(
    staffName
  )}</strong></td><td><strong>NGƯỜI SỬ DỤNG LAO ĐỘNG</strong><br><em>(Ký, ghi rõ họ tên)</em><div class="sign-space"></div></td></tr></table>`;

/**
 * Nội dung hợp đồng dạng chữ (mẫu cũ) → HTML kiểu văn bản hợp đồng: các dòng đầu viết HOA / "Độc lập…" / "Số:" căn giữa,
 * dòng "Điều N." và dòng viết HOA in đậm, thụt lề giữ theo khoảng trắng đầu dòng, <c>[[NGAT_TRANG]]</c> sang trang,
 * <c>[[CHU_KY]]</c> khối chữ ký hai cột. Mọi chữ đều được thoát HTML.
 */
export function contractBodyHtml(body: string, staffName: string, signatureSvg?: string | null): string {
  let header = true;
  const html = body
    .split(/\r?\n/)
    .map((raw) => {
      const line = raw.trimEnd();
      const trimmed = line.trim();
      if (trimmed === '[[NGAT_TRANG]]') return '<div class="page-break"></div>';
      if (trimmed === '[[CHU_KY]]') return SIGN_HTML(staffName, signatureSvg);
      if (!trimmed) return '<p class="gap"></p>';
      const text = escapeHtml(trimmed);
      const caps = trimmed === trimmed.toLocaleUpperCase('vi') && /\p{L}/u.test(trimmed);
      if (header && (caps || /^(Độc lập|Số:)/.test(trimmed))) return `<p class="center${caps ? ' strong' : ''}">${text}</p>`;
      header = false;
      if (/^Điều\s+\d+[a-z]?\./.test(trimmed) || caps) return `<p class="strong head">${text}</p>`;
      const indent = line.length - line.trimStart().length;
      return indent > 0 ? `<p style="padding-left:${Math.min(indent, 12) * 0.4}em">${text}</p>` : `<p>${text}</p>`;
    })
    .join('');
  return fillSignatureFields(html, signatureSvg);
}

/** Nội dung HTML (máy chủ đã lọc): đoạn chỉ có [[CHU_KY]] / [[NGAT_TRANG]] thành khối ký / ngắt trang, rồi thay trường chữ ký. */
export function htmlContractBody(html: string, staffName: string, signatureSvg?: string | null): string {
  return fillSignatureFields(
    html
      .replace(/<p[^>]*>\s*\[\[CHU_KY\]\]\s*<\/p>/g, () => SIGN_HTML(staffName, signatureSvg))
      .replace(/<p[^>]*>\s*\[\[NGAT_TRANG\]\]\s*<\/p>/g, '<div class="page-break"></div>'),
    signatureSvg
  );
}

export type ContractBodySource = {
  body: string;
  isHtml?: boolean;
  staffName: string;
  signatureSvg?: string | null;
};

export function renderContractHtml({ body, isHtml, staffName, signatureSvg }: ContractBodySource): string {
  return isHtml ? htmlContractBody(body, staffName, signatureSvg) : contractBodyHtml(body, staffName, signatureSvg);
}

export const CONTRACT_CSS = `
.contract-doc { font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.45; color: #000; }
.contract-doc p { margin: 0 0 2pt; text-align: justify; }
.contract-doc .center { text-align: center; }
.contract-doc .strong { font-weight: bold; }
.contract-doc .head { margin-top: 6pt; }
.contract-doc .gap { height: 6pt; margin: 0; }
.contract-doc h1, .contract-doc h2, .contract-doc h3, .contract-doc h4 { font-size: 13pt; margin: 8pt 0 4pt; }
.contract-doc h1, .contract-doc h2 { font-size: 15pt; }
.contract-doc ul, .contract-doc ol { margin: 0 0 4pt; padding-left: 1.5em; }
.contract-doc table { width: 100%; border-collapse: collapse; margin: 4pt 0 8pt; }
.contract-doc table td, .contract-doc table th { border: 1px solid #555; padding: 3pt 6pt; vertical-align: top; text-align: left; }
.contract-doc table th { font-weight: bold; background: #f2f2f2; }
.contract-doc table td p, .contract-doc table th p { margin: 0; text-align: left; }
.contract-doc table.sign { margin-top: 18pt; }
.contract-doc table.sign td { width: 50%; text-align: center; border: none; }
.contract-doc .sign-space { height: 70pt; }
.contract-doc .sign-image { height: 70pt; display: flex; align-items: center; justify-content: center; }
.contract-doc .sign-slot { display: inline-block; width: 160pt; height: 60pt; vertical-align: bottom; }
.contract-doc img.signature { height: 60pt; max-width: 100%; vertical-align: bottom; }
.contract-doc .page-break { break-after: page; page-break-after: always; }`;

/** Trang in A4 (chữ Times, định dạng văn bản hợp đồng) cho nội dung đã dựng HTML. */
export function buildPrintPage(title: string, innerHtml: string): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page { size: A4; margin: 20mm 18mm 20mm 25mm; }
body { margin: 0; }${CONTRACT_CSS}
</style></head><body><div class="contract-doc">${innerHtml}</div></body></html>`;
}

/** Trang in hợp đồng (A4, chữ Times, định dạng văn bản hợp đồng). */
export function buildPrintHtml(
  contract: Pick<IEmploymentContract, 'renderedBody' | 'contractNumber' | 'staffName'> &
    Partial<Pick<IEmploymentContract, 'isHtml' | 'employeeSignatureSvg'>>
): string {
  return buildPrintPage(
    `Hợp đồng ${contract.contractNumber ?? '(nháp)'} – ${contract.staffName}`,
    renderContractHtml({
      body: contract.renderedBody,
      isHtml: contract.isHtml,
      staffName: contract.staffName,
      signatureSvg: contract.employeeSignatureSvg,
    })
  );
}

/** Mở cửa sổ in; false khi trình duyệt chặn pop-up. */
export function printPage(html: string): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
