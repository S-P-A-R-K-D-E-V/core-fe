// ----------------------------------------------------------------------
// Trường trộn trong nội dung hợp đồng: lưu / gửi máy chủ là chữ `{{ma}}`; trong trình soạn là thẻ (node `mergeField`,
// <span data-field="ma">). Hai hàm đổi qua lại khi nạp và khi lưu — máy chủ không phải biết đến thẻ.
// ----------------------------------------------------------------------

/** Kiểu dữ liệu kéo thả riêng của trường (trình soạn nhận; ô chữ khác nhận text/plain `{{ma}}`). */
export const FIELD_DRAG_TYPE = 'application/x-contract-field';

const TOKEN = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;
const FIELD_SPAN = /<span\b[^>]*\bdata-field="([a-z0-9_]+)"[^>]*>[\s\S]*?<\/span>/g;

export const fieldToken = (key: string) => `{{${key}}}`;

/** `{{ma}}` trong phần chữ (không đụng thẻ / thuộc tính, không bọc lại thẻ đã có) → <span data-field="ma">{{ma}}</span>. */
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
      return insideField ? part : part.replace(TOKEN, (_, key: string) => `<span data-field="${key}">{{${key}}}</span>`);
    })
    .join('');
}

/** <span data-field="ma" …>…</span> → `{{ma}}` (HTML lưu chỉ có chữ trường như máy chủ cần). */
export function fieldNodesToTokens(html: string): string {
  return html ? html.replace(FIELD_SPAN, (_, key: string) => fieldToken(key)) : html;
}

/** Chữ hiện trên thẻ trường: tên tiếng Việt (chữ ký có ✍); chưa có danh sách trường thì hiện mã. */
export function fieldChipText(key: string, labels: Map<string, string>): { text: string; unknown: boolean } {
  const label = labels.get(key);
  if (!label) return { text: key, unknown: labels.size > 0 };
  return { text: key.startsWith('chu_ky_') ? `✍ ${label}` : label, unknown: false };
}
