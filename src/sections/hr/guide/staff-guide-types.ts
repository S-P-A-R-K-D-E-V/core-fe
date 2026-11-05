// Kiểu dữ liệu của tài liệu "Hướng dẫn sử dụng app cho nhân viên" — dùng chung cho trang web và bản PDF
// (scripts/build-staff-guide-pdf.mts đọc thẳng nội dung để dựng HTML in PDF, nên tệp này không import gì).

export type GuideBlock =
  | { kind: 'p'; text: string }
  | { kind: 'steps'; title?: string; items: string[] }
  | { kind: 'bullets'; title?: string; items: string[] }
  | { kind: 'table'; title?: string; head: string[]; rows: string[][] }
  | { kind: 'note'; tone: 'info' | 'warning'; text: string }
  /** Ảnh chụp màn hình app (public/assets/staff-guide/<file>), xếp thành hàng. */
  | { kind: 'shots'; items: GuideShot[] };

export type GuideShot = {
  /** Tên tệp trong public/assets/staff-guide, vd "trang-chu.webp". */
  file: string;
  caption: string;
};

/** Thư mục ảnh chụp (trang web dùng đường dẫn này; bản PDF đọc thẳng từ public/). */
export const STAFF_GUIDE_SHOTS_PATH = '/assets/staff-guide';

export type GuideSection = {
  /** Mã neo dùng cho mục lục (#id). */
  id: string;
  title: string;
  /** Một câu tóm tắt dưới tiêu đề. */
  lead?: string;
  blocks: GuideBlock[];
};

export type GuidePart = {
  id: string;
  title: string;
  sections: GuideSection[];
};

export type StaffGuide = {
  title: string;
  subtitle: string;
  /** Ngày cập nhật nội dung, dd/MM/yyyy. */
  updatedAt: string;
  parts: GuidePart[];
};
