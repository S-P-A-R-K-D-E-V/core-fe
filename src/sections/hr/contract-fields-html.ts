// ----------------------------------------------------------------------
// Trường trộn trong nội dung hợp đồng: lưu / gửi máy chủ là chữ `{{ma}}` (trường ngày có thể kèm định dạng `{{ma:thang}}`);
// trong trình soạn là thẻ (node `mergeField`, <span data-field="ma" data-format="thang">). Hai hàm đổi qua lại khi nạp và
// khi lưu — máy chủ không phải biết đến thẻ.
// ----------------------------------------------------------------------

/** Kiểu dữ liệu kéo thả riêng của trường (trình soạn nhận; ô chữ khác nhận text/plain `{{ma}}`). */
export const FIELD_DRAG_TYPE = 'application/x-contract-field';

const TOKEN = /\{\{\s*([a-z0-9_]+)(?::([a-z0-9_]+))?\s*\}\}/g;
const FIELD_SPAN = /<span\b[^>]*\bdata-field="[a-z0-9_]+"[^>]*>[\s\S]*?<\/span>/g;

/** Định dạng trường ngày (máy chủ trộn): không định dạng = dd/MM/yyyy. */
export const DATE_FORMAT_SHORT: Record<string, string> = {
  ngay: 'ngày',
  thang: 'tháng',
  nam: 'năm',
  nam2: 'năm (2 số)',
  chu: 'bằng chữ',
};

/** Tên định dạng trong menu chọn khi máy chủ chưa gửi danh sách. */
export const DATE_FORMAT_LABEL: Record<string, string> = {
  ngay: 'Ngày (29)',
  thang: 'Tháng (10)',
  nam: 'Năm (2026)',
  nam2: 'Năm 2 số (26)',
  chu: 'Bằng chữ (ngày 29 tháng 10 năm 2026)',
};

export const fieldToken = (key: string, format?: string | null) => (format ? `{{${key}:${format}}}` : `{{${key}}}`);

function fieldSpan(key: string, format?: string | null) {
  const formatAttr = format ? ` data-format="${format}"` : '';
  return `<span data-field="${key}"${formatAttr}>${fieldToken(key, format)}</span>`;
}

/** `{{ma}}` / `{{ma:dinh_dang}}` trong phần chữ (không đụng thẻ / thuộc tính, không bọc lại thẻ đã có) → <span data-field>. */
export function tokensToFieldNodes(html: string): string {
  if (!html) return html;
  let insideField = false;
  return html
    .split(/(<[^>]*>)/)
    .map((part) => {
      if (part.startsWith('<')) {
        if (/^<span\b[^>]*\bdata-field=/i.test(part)) insideField = true;
        else if (insideField && /^<\/span>/i.test(part)) insideField = false;
        return part;
      }
      return insideField ? part : part.replace(TOKEN, (_, key: string, format?: string) => fieldSpan(key, format));
    })
    .join('');
}

/** <span data-field="ma" data-format="…" …>…</span> → `{{ma}}` / `{{ma:dinh_dang}}` (HTML lưu chỉ có chữ trường). */
export function fieldNodesToTokens(html: string): string {
  if (!html) return html;
  return html.replace(FIELD_SPAN, (span) => {
    const open = span.slice(0, span.indexOf('>'));
    const key = /\bdata-field="([a-z0-9_]+)"/.exec(open)?.[1] ?? '';
    const format = /\bdata-format="([a-z0-9_]+)"/.exec(open)?.[1];
    return fieldToken(key, format);
  });
}

/**
 * Chữ hiện trên thẻ trường: tên tiếng Việt (chữ ký có ✍, trường ngày kèm định dạng "Ngày lập · tháng"); chưa có danh sách
 * trường thì hiện mã.
 */
export function fieldChipText(
  key: string,
  labels: Map<string, string>,
  format?: string | null
): { text: string; unknown: boolean } {
  const suffix = format ? ` · ${DATE_FORMAT_SHORT[format] ?? format}` : '';
  const label = labels.get(key);
  if (!label) return { text: `${key}${suffix}`, unknown: labels.size > 0 };
  return { text: `${key.startsWith('chu_ky_') ? `✍ ${label}` : label}${suffix}`, unknown: false };
}

/** Mã trường riêng của mẫu: `rieng_` + tên không dấu, chữ thường, số, gạch dưới (≤ 40 ký tự sau tiền tố). */
export const CUSTOM_FIELD_KEY = /^rieng_[a-z0-9_]{1,40}$/;

export function customFieldKey(label: string, taken: string[] = []): string {
  const slug =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 36)
      .replace(/_+$/g, '') || 'truong';
  let key = `rieng_${slug}`;
  for (let i = 2; taken.includes(key); i += 1) key = `rieng_${slug}_${i}`;
  return key;
}

/** Nội dung có dùng trường này không (kể cả kèm định dạng). */
export const bodyUsesField = (body: string, key: string) => new RegExp(`\\{\\{\\s*${key}(?::[a-z0-9_]+)?\\s*\\}\\}`).test(body);
