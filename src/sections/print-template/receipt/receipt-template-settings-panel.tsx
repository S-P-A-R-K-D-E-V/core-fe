'use client';

import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  MARGIN_LIMIT_MM,
  FONT_SIZE_RANGE,
  LINE_HEIGHT_RANGE,
  RECEIPT_FONT_STACKS,
  RECEIPT_TEMPLATE_PAPERS,
  defaultReceiptSettings,
  RECEIPT_TEMPLATE_PAPER_KEYS,
} from './receipt-template-settings';

import type {
  ReceiptRuleStyle,
  ReceiptFontFamily,
  ReceiptTableBorder,
  ReceiptTemplatePaper,
  ReceiptTemplateSettings,
} from './receipt-template-settings';

// ----------------------------------------------------------------------
// Thiết lập trang của mẫu hoá đơn: khổ giấy (đổi khổ → lề và cỡ chữ về mặc định của khổ), lề bốn phía, chữ, kẻ bảng,
// kiểu đường kẻ ngang.
// ----------------------------------------------------------------------

type Props = {
  value: ReceiptTemplateSettings;
  onChange: (next: ReceiptTemplateSettings) => void;
  disabled?: boolean;
};

const MARGINS: {
  key: 'marginTopMm' | 'marginRightMm' | 'marginBottomMm' | 'marginLeftMm';
  label: string;
}[] = [
  { key: 'marginTopMm', label: 'Lề trên' },
  { key: 'marginBottomMm', label: 'Lề dưới' },
  { key: 'marginLeftMm', label: 'Lề trái' },
  { key: 'marginRightMm', label: 'Lề phải' },
];

const toNumber = (text: string, fallback: number) => {
  const number = Number(text.replace(',', '.'));
  return Number.isFinite(number) ? number : fallback;
};

export function ReceiptTemplateSettingsPanel({ value, onChange, disabled }: Props) {
  const set = (patch: Partial<ReceiptTemplateSettings>) => onChange({ ...value, ...patch });
  const roll = RECEIPT_TEMPLATE_PAPERS[value.paper].heightMm === null;

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">Khổ giấy &amp; lề</Typography>
      <TextField
        select
        size="small"
        label="Khổ giấy"
        value={value.paper}
        disabled={disabled}
        onChange={(event) => {
          const paper = event.target.value as ReceiptTemplatePaper;
          const defaults = defaultReceiptSettings(paper);
          onChange({
            ...value,
            ...RECEIPT_TEMPLATE_PAPERS[paper].defaults,
            paper,
            fontSizePt: defaults.fontSizePt,
          });
        }}
        helperText={
          roll
            ? 'Giấy cuộn: chiều dài trang tự tính theo nội dung từng hoá đơn.'
            : 'Máy in văn phòng: trang cố định, lề theo số bên dưới.'
        }
      >
        {RECEIPT_TEMPLATE_PAPER_KEYS.map((paper) => (
          <MenuItem key={paper} value={paper}>
            {RECEIPT_TEMPLATE_PAPERS[paper].label}
          </MenuItem>
        ))}
      </TextField>

      <Stack direction="row" flexWrap="wrap" gap={1.5}>
        {MARGINS.map((margin) => (
          <TextField
            key={margin.key}
            size="small"
            type="number"
            label={`${margin.label} (mm)`}
            value={value[margin.key]}
            disabled={disabled}
            onChange={(event) =>
              set({
                [margin.key]: Math.min(
                  MARGIN_LIMIT_MM,
                  Math.max(0, toNumber(event.target.value, value[margin.key]))
                ),
              })
            }
            inputProps={{ min: 0, max: MARGIN_LIMIT_MM, step: 0.5 }}
            sx={{ width: 'calc(50% - 6px)' }}
          />
        ))}
      </Stack>

      <Typography variant="subtitle2">Chữ</Typography>
      <TextField
        select
        size="small"
        label="Phông chữ"
        value={value.fontFamily}
        disabled={disabled}
        onChange={(event) => set({ fontFamily: event.target.value as ReceiptFontFamily })}
      >
        {(Object.keys(RECEIPT_FONT_STACKS) as ReceiptFontFamily[]).map((family) => (
          <MenuItem key={family} value={family}>
            {RECEIPT_FONT_STACKS[family].label}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction="row" gap={1.5}>
        <TextField
          size="small"
          type="number"
          label="Cỡ chữ (pt)"
          value={value.fontSizePt}
          disabled={disabled}
          onChange={(event) =>
            set({
              fontSizePt: Math.min(
                FONT_SIZE_RANGE.max,
                Math.max(FONT_SIZE_RANGE.min, toNumber(event.target.value, value.fontSizePt))
              ),
            })
          }
          inputProps={{ min: FONT_SIZE_RANGE.min, max: FONT_SIZE_RANGE.max, step: 0.5 }}
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          type="number"
          label="Giãn dòng"
          value={value.lineHeight}
          disabled={disabled}
          onChange={(event) =>
            set({
              lineHeight: Math.min(
                LINE_HEIGHT_RANGE.max,
                Math.max(LINE_HEIGHT_RANGE.min, toNumber(event.target.value, value.lineHeight))
              ),
            })
          }
          inputProps={{ min: LINE_HEIGHT_RANGE.min, max: LINE_HEIGHT_RANGE.max, step: 0.1 }}
          sx={{ flex: 1 }}
        />
      </Stack>

      <Typography variant="subtitle2">Đường kẻ</Typography>
      <TextField
        select
        size="small"
        label="Kẻ bảng"
        value={value.tableBorder}
        disabled={disabled}
        onChange={(event) => set({ tableBorder: event.target.value as ReceiptTableBorder })}
      >
        <MenuItem value="none">Không kẻ (ô chấm mờ chỉ để soạn)</MenuItem>
        <MenuItem value="rows">Kẻ ngang giữa các hàng</MenuItem>
        <MenuItem value="all">Kẻ đủ ô</MenuItem>
      </TextField>
      <TextField
        select
        size="small"
        label="Kiểu đường kẻ ngang"
        value={value.ruleStyle}
        disabled={disabled}
        onChange={(event) => set({ ruleStyle: event.target.value as ReceiptRuleStyle })}
      >
        <MenuItem value="dashed">Nét đứt - - - -</MenuItem>
        <MenuItem value="solid">Nét liền ────</MenuItem>
        <MenuItem value="dotted">Chấm · · · ·</MenuItem>
      </TextField>
    </Stack>
  );
}
