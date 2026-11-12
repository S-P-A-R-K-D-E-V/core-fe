// ----------------------------------------------------------------------
// Mã tạm của hoá đơn bán lúc mất mạng: "<mã máy>-<yyMMdd>-<số thứ tự trong ngày>" (vd "Q7-261112-003") — cấp tại máy,
// in trên phiếu tạm và ghi vào ghi chú hoá đơn ("Mã tạm: …") để tra lại sau khi có mã chính thức HD-…
// Mã máy sinh một lần cho mỗi trình duyệt (2 ký tự, bỏ các ký tự dễ nhầm 0/O, 1/I) nên các máy không đụng nhau.
// ----------------------------------------------------------------------

const DEVICE_KEY = 'pos_device_code';
const SEQ_KEY = 'pos_offline_seq';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

const browserStorage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

export function deviceCode(storage: Storage | null = browserStorage(), random = Math.random): string {
  const saved = storage?.getItem(DEVICE_KEY);
  if (saved && /^[A-Z0-9]{2}$/.test(saved)) return saved;
  const code = Array.from({ length: 2 }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join('');
  storage?.setItem(DEVICE_KEY, code);
  return code;
}

/** yyMMdd theo giờ Việt Nam (ngày bán ở quầy). */
export function vnDayKey(now: Date): string {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const yy = String(vn.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(vn.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/** Cấp mã tạm kế tiếp của máy này (số thứ tự đếm lại từ 1 mỗi ngày). */
export function nextOfflineCode(now = new Date(), storage: Storage | null = browserStorage()): string {
  const day = vnDayKey(now);
  let seq = 1;
  try {
    const saved = JSON.parse(storage?.getItem(SEQ_KEY) ?? 'null');
    if (saved && saved.day === day && Number.isInteger(saved.seq)) seq = saved.seq + 1;
  } catch {
    seq = 1;
  }
  storage?.setItem(SEQ_KEY, JSON.stringify({ day, seq }));
  return `${deviceCode(storage)}-${day}-${String(seq).padStart(3, '0')}`;
}

/** Ghi "Mã tạm: …" vào ghi chú hoá đơn (một lần). */
export function noteWithOfflineCode(note: string | undefined, code: string): string {
  const tag = `Mã tạm: ${code}`;
  if (note?.includes(tag)) return note;
  return note?.trim() ? `${note} | ${tag}` : tag;
}
