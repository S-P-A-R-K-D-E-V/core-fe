// ----------------------------------------------------------------------
// Đọc số tiền bằng chữ tiếng Việt cho hoá đơn: 125000 → "Một trăm hai mươi lăm nghìn đồng".
// Quy tắc: "mười / mươi", "mốt" (21, 31…), "lăm" (15, 25…), "tư" (24, 34…), "linh" (105), nhóm 3 chữ số với nghìn / triệu
// / tỷ (tỷ lặp lại cho số rất lớn). Chỉ phần nguyên, làm tròn tới đồng; âm thêm "Âm".
// ----------------------------------------------------------------------

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/** Đọc một nhóm 3 chữ số; `full` = nhóm không đứng đầu (phải đọc "không trăm", "linh"). */
function readGroup(value: number, full: boolean): string {
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const units = value % 10;
  const words: string[] = [];

  if (hundreds > 0 || full) words.push(`${DIGITS[hundreds]} trăm`);

  if (tens > 1) {
    words.push(`${DIGITS[tens]} mươi`);
    if (units === 1) words.push('mốt');
    else if (units === 4) words.push('tư');
    else if (units === 5) words.push('lăm');
    else if (units > 0) words.push(DIGITS[units]);
  } else if (tens === 1) {
    words.push('mười');
    if (units === 5) words.push('lăm');
    else if (units > 0) words.push(DIGITS[units]);
  } else if (units > 0) {
    if (hundreds > 0 || full) words.push('linh');
    words.push(DIGITS[units]);
  }
  return words.join(' ');
}

const SCALES = ['', 'nghìn', 'triệu'];

function readInteger(value: number): string {
  if (value === 0) return 'không';
  // Số ≥ 1 tỷ: phần trên tỷ đọc đệ quy rồi thêm "tỷ".
  const billion = 1_000_000_000;
  if (value >= billion) {
    const high = Math.floor(value / billion);
    const low = value % billion;
    const head = `${readInteger(high)} tỷ`;
    return low === 0 ? head : `${head} ${readBelowBillion(low, true)}`;
  }
  return readBelowBillion(value, false);
}

function readBelowBillion(value: number, full: boolean): string {
  const groups = [
    value % 1000,
    Math.floor(value / 1000) % 1000,
    Math.floor(value / 1_000_000) % 1000,
  ];
  const highest = groups.reduce((top, group, index) => (group > 0 ? index : top), -1);
  const words: string[] = [];
  for (let index = 2; index >= 0; index -= 1) {
    const group = groups[index];
    if (group > 0) {
      words.push(readGroup(group, full || index < highest));
      if (SCALES[index]) words.push(SCALES[index]);
    }
  }
  return words.join(' ');
}

/** "Một trăm hai mươi lăm nghìn đồng"; không phải số → chuỗi rỗng. */
export function moneyInWords(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '';
  const rounded = Math.round(amount);
  const text = `${rounded < 0 ? 'âm ' : ''}${readInteger(Math.abs(rounded))} đồng`;
  return text.charAt(0).toLocaleUpperCase('vi') + text.slice(1);
}
