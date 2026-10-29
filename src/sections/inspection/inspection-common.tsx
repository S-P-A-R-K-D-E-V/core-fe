'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { fDateTime } from 'src/utils/format-time';
import { getStorageUrl } from 'src/utils/storage';

import Iconify from 'src/components/iconify';
import Lightbox, { useLightBox } from 'src/components/lightbox';

import type {
  IInspectionPhoto,
  IShiftWorkCompletion,
  InspectionLevel,
  InspectionOutcome,
  InspectionStatus,
  InspectionZoneCode,
} from 'src/types/inspection';
import { INSPECTION_LEVEL_LABEL, INSPECTION_OUTCOME_LABEL } from 'src/types/inspection';

// ----------------------------------------------------------------------
// Thành phần dùng chung của kiểm tra cửa hàng: nhãn mức B/T, khu, trạng thái, nút Đạt / Không đạt / NA, chọn ảnh.
// ----------------------------------------------------------------------

/** Nhắc quy định ảnh (quy chế: ảnh chỉ dùng nội bộ, không chụp khu thay đồ / WC khi có người, không chụp mặt khách). */
export function InspectionPhotoRules() {
  return (
    <Alert severity="info" icon={<Iconify icon="solar:camera-bold" />}>
      Ảnh kiểm tra chỉ dùng nội bộ. Không chụp mặt khách, không chụp khu thay đồ hoặc WC khi có người bên trong.
    </Alert>
  );
}

export function LevelChip({ level }: { level: InspectionLevel }) {
  return (
    <Chip
      size="small"
      label={INSPECTION_LEVEL_LABEL[level]}
      color={level === 'Mandatory' ? 'error' : 'default'}
      variant={level === 'Mandatory' ? 'filled' : 'outlined'}
      sx={{ minWidth: 28, fontWeight: 700 }}
    />
  );
}

export function ZoneChips({ zones }: { zones: InspectionZoneCode[] }) {
  if (zones.length === 0) return <Chip size="small" variant="outlined" label="Trưởng ca" />;
  return (
    <Stack direction="row" spacing={0.5}>
      {zones.map((z) => (
        <Chip key={z} size="small" variant="outlined" label={`Khu ${z}`} />
      ))}
    </Stack>
  );
}

export function StatusChip({ status }: { status: InspectionStatus }) {
  return status === 'Submitted' ? (
    <Chip size="small" color="success" label="Đã nộp" />
  ) : (
    <Chip size="small" color="warning" label="Đang kiểm" />
  );
}

const OUTCOME_COLOR: Record<InspectionOutcome, 'success' | 'error' | 'inherit'> = {
  Pass: 'success',
  Fail: 'error',
  NotApplicable: 'inherit',
};

/** 3 nút lớn Đạt / Không đạt / NA. */
export function OutcomeButtons({
  value,
  disabled,
  onChange,
}: {
  value: InspectionOutcome | null;
  disabled?: boolean;
  onChange: (value: InspectionOutcome) => void;
}) {
  return (
    <Stack direction="row" spacing={1}>
      {(['Pass', 'Fail', 'NotApplicable'] as InspectionOutcome[]).map((o) => (
        <Button
          key={o}
          size="small"
          disabled={disabled}
          color={OUTCOME_COLOR[o]}
          variant={value === o ? 'contained' : 'outlined'}
          onClick={() => onChange(o)}
          sx={{ minWidth: o === 'NotApplicable' ? 48 : 88 }}
        >
          {INSPECTION_OUTCOME_LABEL[o]}
        </Button>
      ))}
    </Stack>
  );
}

/** Ảnh đã lưu + ảnh mới chọn (chưa tải lên). Chọn ảnh mở camera sau trên điện thoại. */
export function PhotoPicker({
  photos,
  files,
  disabled,
  max = 3,
  onAdd,
  onRemove,
}: {
  photos: IInspectionPhoto[];
  files: File[];
  disabled?: boolean;
  max?: number;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const total = photos.length + files.length;
  const slides = photos.map((p) => ({ src: getStorageUrl(p.url) }));
  const lightbox = useLightBox(slides);

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
      {photos.map((p) => (
        <Box
          key={p.id}
          component="img"
          src={getStorageUrl(p.url)}
          alt={p.kind === 'Fixed' ? 'Ảnh sau khi sửa' : 'Ảnh lỗi'}
          onClick={() => lightbox.onOpen(getStorageUrl(p.url))}
          sx={{
            width: 56,
            height: 56,
            borderRadius: 1,
            objectFit: 'cover',
            cursor: 'pointer',
            border: 2,
            borderColor: p.kind === 'Fixed' ? 'success.main' : 'error.main',
          }}
        />
      ))}
      <Lightbox index={lightbox.selected} slides={slides} open={lightbox.open} close={lightbox.onClose} />
      {files.map((f, i) => (
        <Box key={`${f.name}-${f.lastModified}-${i}`} sx={{ position: 'relative', width: 56, height: 56 }}>
          <FileThumb file={f} />
          <IconButton
            size="small"
            aria-label="Bỏ ảnh"
            onClick={() => onRemove(i)}
            sx={{ position: 'absolute', top: -10, right: -10, bgcolor: 'background.paper' }}
          >
            <Iconify icon="mingcute:close-line" width={14} />
          </IconButton>
        </Box>
      ))}
      {!disabled && total < max && (
        <>
          <Button size="small" variant="outlined" startIcon={<Iconify icon="solar:camera-add-bold" />} onClick={() => input.current?.click()}>
            Thêm ảnh
          </Button>
          <input
            ref={input}
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            multiple
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []).slice(0, max - total);
              if (picked.length) onAdd(picked);
              e.target.value = '';
            }}
          />
        </>
      )}
      {total === 0 && disabled && (
        <Typography variant="caption" color="text.secondary">
          Không có ảnh
        </Typography>
      )}
    </Stack>
  );
}

function FileThumb({ file }: { file: File }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <Box
      component="img"
      src={src || undefined}
      alt="Ảnh mới chọn"
      sx={{ width: 1, height: 1, objectFit: 'cover', borderRadius: 1, border: 1, borderColor: 'primary.main' }}
    />
  );
}

/** "yyyy-MM-dd" theo giờ máy. */
export function toDateInput(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** "Đã làm: tên giờ" + ảnh nhân viên chụp khi làm hạng mục trong ca. Chưa làm thì hiện nhãn "Chưa làm" khi cần. */
export function ShiftWorkDoneInfo({
  completion,
  showPending,
}: {
  completion: IShiftWorkCompletion | null | undefined;
  showPending?: boolean;
}) {
  const slides = (completion?.photos ?? []).map((p) => ({ src: getStorageUrl(p.url) }));
  const lightbox = useLightBox(slides);

  if (!completion) {
    return showPending ? <Chip size="small" variant="outlined" color="warning" label="Chưa làm" sx={{ alignSelf: 'flex-start' }} /> : null;
  }
  return (
    <Stack spacing={0.75}>
      <Typography variant="caption" color="success.main">
        Đã làm: {completion.completedByName} · {fDateTime(completion.completedAt, 'HH:mm dd/MM')}
        {completion.note ? ` — ${completion.note}` : ''}
      </Typography>
      {completion.photos.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {completion.photos.map((p) => (
            <Box
              key={p.id}
              component="img"
              src={getStorageUrl(p.url)}
              alt="Ảnh đã làm"
              onClick={() => lightbox.onOpen(getStorageUrl(p.url))}
              sx={{ width: 56, height: 56, borderRadius: 1, objectFit: 'cover', cursor: 'pointer', border: 1, borderColor: 'divider' }}
            />
          ))}
          <Lightbox index={lightbox.selected} slides={slides} open={lightbox.open} close={lightbox.onClose} />
        </Stack>
      )}
    </Stack>
  );
}
