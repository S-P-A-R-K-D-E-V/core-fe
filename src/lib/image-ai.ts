// ----------------------------------------------------------------------
// Lõi AI ảnh dùng chung (core-be SocialImageStudio + ProductImageAnalyzer): Studio ảnh của Bán hàng online và trang ảnh
// sản phẩm. Phân tích ảnh → gợi ý cách dùng / bối cảnh hợp đúng món + tag prompt; client chỉ gửi lại id.

/** "studio" = nền sạch, ánh sáng chuyên nghiệp | "lifestyle" = ảnh thực tế (người dùng / bối cảnh). */
export type ImagePresetGroup = 'studio' | 'lifestyle';

export type ImagePreset = { id: string; label: string; group: ImagePresetGroup; hint: string };

export type ImageTag = { id: string; label: string };

export type ImageAnalysis = {
  /** Loại hàng tiếng Việt, vd "Kẹp tóc". */
  category: string;
  kind: string;
  /** Đồ lót / đồ bơi…: chỉ dựng trên manocanh hoặc xếp phẳng. */
  sensitive: boolean;
  summary: string | null;
  presets: ImagePreset[];
  tags: ImageTag[];
  /** Model chưa phân tích được — chỉ có gợi ý chung. */
  fallback: boolean;
};

export type ImageBackground = { id: string; label: string; color: string };

/** Gợi ý có sẵn (dùng được khi chưa phân tích) + màu nền cho chế độ giữ nguyên ảnh. */
export type ImageCatalog = {
  items: ImagePreset[];
  tags: ImageTag[];
  backgrounds: ImageBackground[];
  maxNoteLength: number;
};

/** style "frame" = giữ nguyên ảnh gốc đặt lên nền màu (không qua AI). */
export type ImageResult = { url: string; sourceUrl: string; style: string; label: string };

export const IMAGE_PRESET_GROUPS: { id: ImagePresetGroup; label: string }[] = [
  { id: 'studio', label: 'Ảnh studio' },
  { id: 'lifestyle', label: 'Ảnh thực tế / cách dùng' },
];

export const MAX_IMAGE_TAGS = 6;

/** Bấm tag: thêm / bỏ, tối đa {@link MAX_IMAGE_TAGS}. */
export function toggleTag(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((t) => t !== id);
  if (selected.length >= MAX_IMAGE_TAGS) return selected;
  return [...selected, id];
}

/** Gợi ý mặc định: cách dùng đầu tiên (ảnh thực tế) nếu có, không thì nền trắng. */
export function defaultPreset(presets: ImagePreset[]): string | null {
  return presets.find((p) => p.group === 'lifestyle')?.id ?? presets[0]?.id ?? null;
}
