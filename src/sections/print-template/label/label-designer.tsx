'use client';

import { useRef, useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButton from '@mui/material/ToggleButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import {
  LABEL_TEMPLATES,
  normalizeTemplate,
  TEMPLATE_NUMBER_FIELDS,
} from 'src/sections/pos/label-print/label-template';

import {
  renderElement,
  designErrors,
  LABEL_ELEMENT_CSS,
  labelFieldValues,
} from './label-design-render';
import {
  GRID_MM,
  LABEL_FIELDS,
  presetPaper,
  clampElement,
  newElementId,
  createElement,
  LABEL_FIELD_BY_KEY,
  suggestedElements,
  LABEL_FIELD_GROUPS,
} from './label-design';

import { imageFilesOf } from '../print-image';
import { uploadTemplateImage } from '../print-image-upload';

import type { DesignLabelSource, DesignPrintContext } from './label-design-render';
import type {
  LabelDesign,
  LabelElement,
  LabelTextAlign,
  LabelElementType,
  LabelPriceSuffix,
} from './label-design';

// ----------------------------------------------------------------------
// Thiết kế tem mã: một ô tem phóng to trên lưới mm. Kéo trường / phần tử từ bảng bên trái thả vào tem (hoặc bấm để thêm),
// kéo để di chuyển, kéo các nút ở góc / cạnh để đổi cỡ; phím mũi tên nhích 0,5 mm (Shift: 1 điểm in = 0,125 mm), Delete
// để xoá. Lớp hiển thị dùng ĐÚNG HTML sẽ in (renderElement) với dữ liệu mẫu, lớp trên cùng chỉ để chọn / kéo.
// Không chọn phần tử nào → bảng bên phải là khổ giấy và định dạng giá.
// ----------------------------------------------------------------------

const PX_PER_MM = 96 / 25.4;
const DRAG_TYPE = 'application/x-label-element';
const CANVAS_TARGET_PX = 560;
const MAX_ZOOM = 10;
const CUSTOM_PRESET = 'custom';

const SAMPLE_SOURCE: DesignLabelSource = {
  key: 'sample',
  name: 'Kẹp tóc nơ nhung đỏ size lớn',
  code: 'K35',
  barcode: '8938505974194',
  price: 35000,
  unit: 'cái',
  quantity: 1,
  discount: { percent: 20 },
};

const ELEMENT_TOOLS: { type: LabelElementType; label: string; icon: string }[] = [
  { type: 'text', label: 'Chữ tự do', icon: 'solar:text-bold' },
  { type: 'barcode', label: 'Mã vạch', icon: 'mdi:barcode' },
  { type: 'qrcode', label: 'Mã QR', icon: 'mdi:qrcode' },
  { type: 'line', label: 'Đường kẻ', icon: 'mdi:minus' },
  { type: 'box', label: 'Khung viền', icon: 'mdi:square-outline' },
];

const TYPE_LABEL: Record<LabelElementType, string> = {
  text: 'Chữ',
  barcode: 'Mã vạch',
  qrcode: 'Mã QR',
  line: 'Đường kẻ',
  box: 'Khung viền',
  image: 'Ảnh',
};

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

type DragState = {
  id: string;
  mode: 'move' | Handle;
  startX: number;
  startY: number;
  origin: LabelElement;
};

const round3 = (value: number) => Math.round(value * 1000) / 1000;

type Props = {
  value: LabelDesign;
  onChange: (next: LabelDesign) => void;
  context: DesignPrintContext;
  disabled?: boolean;
};

export function LabelDesigner({ value, onChange, context, disabled }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const { paper } = value;
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ảnh chọn từ máy: thêm phần tử mới (null) hoặc thay ảnh của phần tử đang chọn (id).
  const pickTarget = useRef<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  const fitZoom = Math.min(
    MAX_ZOOM,
    Math.max(1, CANVAS_TARGET_PX / (paper.labelWidthMm * PX_PER_MM))
  );
  const [zoomOverride, setZoomOverride] = useState<number | null>(null);
  const zoom = zoomOverride ?? fitZoom;
  const drag = useRef<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selected = value.elements.find((element) => element.id === selectedId) ?? null;
  const scale = PX_PER_MM * zoom;
  const snapValue = useCallback(
    (mm: number) => (snap ? Math.round(mm / GRID_MM) * GRID_MM : round3(mm)),
    [snap]
  );

  const sampleValues = useMemo(
    () => labelFieldValues(SAMPLE_SOURCE, value, context),
    [value, context]
  );
  const rendered = useMemo(
    () =>
      value.elements.map((element) => ({
        element,
        result: renderElement(element, SAMPLE_SOURCE, sampleValues, context),
      })),
    [value.elements, sampleValues, context]
  );
  const errors = useMemo(() => designErrors(value), [value]);

  const setElements = (elements: LabelElement[]) => onChange({ ...value, elements });

  const updateElement = (id: string, patch: Partial<LabelElement>) =>
    setElements(
      value.elements.map((element) =>
        element.id === id ? clampElement({ ...element, ...patch }, paper) : element
      )
    );

  const addElement = (
    type: LabelElementType,
    fieldKey?: string,
    at?: { xMm: number; yMm: number },
    extra?: Partial<LabelElement>,
    base: LabelElement[] = value.elements
  ) => {
    if (disabled) return;
    const element = {
      ...createElement(type, paper, at ?? { xMm: paper.paddingMm, yMm: paper.paddingMm }, fieldKey),
      ...extra,
    };
    setElements([...base, element]);
    setSelectedId(element.id);
  };

  // Tải ảnh lên rồi thêm phần tử ảnh (hoặc thay ảnh của phần tử đang chọn). Dùng onChange với bố cục mới nhất qua ref
  // vì việc tải lên chạy bất đồng bộ.
  const latest = useRef(value);
  latest.current = value;
  const uploadImages = (files: File[], at?: { xMm: number; yMm: number }) => {
    const replaceId = pickTarget.current;
    pickTarget.current = null;
    files.forEach(async (file) => {
      setUploading((count) => count + 1);
      try {
        const src = await uploadTemplateImage(file);
        const current = latest.current;
        if (replaceId) {
          onChange({
            ...current,
            elements: current.elements.map((element) =>
              element.id === replaceId ? { ...element, src, logo: false } : element
            ),
          });
        } else {
          const element = {
            ...createElement(
              'image',
              current.paper,
              at ?? { xMm: current.paper.paddingMm, yMm: current.paper.paddingMm }
            ),
            src,
          };
          onChange({ ...current, elements: [...current.elements, element] });
          setSelectedId(element.id);
        }
      } catch (error) {
        enqueueSnackbar(
          error instanceof Error && error.message ? error.message : 'Không tải được ảnh lên',
          {
            variant: 'error',
          }
        );
      } finally {
        setUploading((count) => count - 1);
      }
    });
  };

  const pickImage = (replaceId: string | null) => {
    if (disabled) return;
    pickTarget.current = replaceId;
    fileInputRef.current?.click();
  };

  const removeSelected = () => {
    if (!selected) return;
    setElements(value.elements.filter((element) => element.id !== selected.id));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = clampElement(
      { ...selected, id: newElementId(), xMm: selected.xMm + 1, yMm: selected.yMm + 1 },
      paper
    );
    setElements([...value.elements, copy]);
    setSelectedId(copy.id);
  };

  const moveLayer = (direction: 1 | -1) => {
    if (!selected) return;
    const index = value.elements.findIndex((element) => element.id === selected.id);
    const target = index + direction;
    if (target < 0 || target >= value.elements.length) return;
    const next = [...value.elements];
    [next[index], next[target]] = [next[target], next[index]];
    setElements(next);
  };

  // ── Kéo / đổi cỡ ──

  const onPointerDown = (
    event: React.PointerEvent,
    element: LabelElement,
    mode: DragState['mode']
  ) => {
    if (disabled) return;
    event.stopPropagation();
    event.preventDefault();
    setSelectedId(element.id);
    (event.target as Element).setPointerCapture?.(event.pointerId);
    drag.current = {
      id: element.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: element,
    };
    canvasRef.current?.focus();
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state) return;
    const dx = (event.clientX - state.startX) / scale;
    const dy = (event.clientY - state.startY) / scale;
    const o = state.origin;
    let { xMm, yMm, wMm, hMm } = o;
    if (state.mode === 'move') {
      xMm = snapValue(o.xMm + dx);
      yMm = snapValue(o.yMm + dy);
    } else {
      if (state.mode.includes('e')) wMm = snapValue(o.wMm + dx);
      if (state.mode.includes('s')) hMm = snapValue(o.hMm + dy);
      if (state.mode.includes('w')) {
        xMm = snapValue(o.xMm + dx);
        wMm = round3(o.xMm + o.wMm - xMm);
      }
      if (state.mode.includes('n')) {
        yMm = snapValue(o.yMm + dy);
        hMm = round3(o.yMm + o.hMm - yMm);
      }
    }
    updateElement(state.id, { xMm, yMm, wMm, hMm });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!selected || disabled) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, [contenteditable="true"]')) return;
    const step = event.shiftKey ? 0.125 : GRID_MM;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      updateElement(selected.id, {
        xMm: round3(selected.xMm + dx),
        yMm: round3(selected.yMm + dy),
      });
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeSelected();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateSelected();
    } else if (event.key === 'Escape') {
      setSelectedId(null);
    }
  };

  const onDrop = (event: React.DragEvent) => {
    if (disabled) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const at = {
      xMm: snapValue((event.clientX - rect.left) / scale),
      yMm: snapValue((event.clientY - rect.top) / scale),
    };
    // File ảnh kéo từ máy thả thẳng vào tem.
    const files = imageFilesOf(event.dataTransfer);
    if (files.length > 0) {
      event.preventDefault();
      pickTarget.current = null;
      uploadImages(files, at);
      return;
    }
    const raw = event.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    event.preventDefault();
    try {
      const { type, field, logo } = JSON.parse(raw) as {
        type: LabelElementType;
        field?: string;
        logo?: boolean;
      };
      addElement(type, field, at, logo ? { logo: true } : undefined);
    } catch {
      /* dữ liệu kéo lạ — bỏ qua */
    }
  };

  // ── Khổ giấy ──

  const changePreset = (presetId: string) => {
    const nextPaper =
      presetId === CUSTOM_PRESET ? { ...paper, id: CUSTOM_PRESET } : presetPaper(presetId);
    onChange({
      ...value,
      presetId,
      paper: nextPaper,
      elements: value.elements.map((element) => clampElement(element, nextPaper)),
    });
  };

  // Không kẹp phần tử theo số đang gõ dở ("5" trước khi thành "50"): phần tử thừa ra ngoài chỉ được cảnh báo.
  const changePaperNumber = (
    key: (typeof TEMPLATE_NUMBER_FIELDS)[number]['key'],
    number: number
  ) => {
    onChange({
      ...value,
      presetId: CUSTOM_PRESET,
      paper: normalizeTemplate({ ...paper, id: CUSTOM_PRESET, [key]: number }),
    });
  };

  const outside = value.elements.filter(
    (element) =>
      element.xMm + element.wMm > paper.labelWidthMm + 1e-6 ||
      element.yMm + element.hMm > paper.labelHeightMm + 1e-6
  );

  const isSheet = paper.kind === 'sheet';
  const printLimit =
    paper.printWidthMm > 0 && paper.printWidthMm < paper.labelWidthMm ? paper.printWidthMm : null;

  return (
    <Box
      display="grid"
      gap={2}
      gridTemplateColumns={{ xs: 'minmax(0, 1fr)', lg: '220px minmax(0, 1fr) 320px' }}
      alignItems="start"
    >
      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        accept="image/png,image/jpeg,image/webp"
        aria-label="Chọn ảnh để thêm vào tem"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) uploadImages(files);
          else pickTarget.current = null;
        }}
      />

      {/* Bảng phần tử */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Thêm vào tem
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
          Kéo thả vào tem hoặc bấm để thêm. Trường trống (vd. giá gốc khi không giảm giá) không in
          ra.
        </Typography>
        <Stack
          spacing={1.5}
          sx={{ maxHeight: { lg: 'calc(100vh - 280px)' }, overflow: 'auto', pr: 0.5 }}
        >
          <Box>
            <Typography variant="overline" color="text.secondary">
              Phần tử
            </Typography>
            <Stack spacing={0.5}>
              {ELEMENT_TOOLS.map((tool) => (
                <PaletteItem
                  key={tool.type}
                  label={tool.label}
                  icon={tool.icon}
                  disabled={disabled}
                  payload={{ type: tool.type }}
                  onClick={() => addElement(tool.type)}
                />
              ))}
            </Stack>
          </Box>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Ảnh &amp; logo
            </Typography>
            <Typography variant="caption" color="text.disabled" component="div" sx={{ mb: 0.5 }}>
              Kéo ảnh từ máy thả thẳng vào tem.
            </Typography>
            <Stack spacing={0.5}>
              <PaletteItem
                label="Logo cửa hàng"
                hint="Khi in lấy logo hiện tại"
                icon="solar:shop-bold"
                disabled={disabled}
                payload={{ type: 'image', logo: true }}
                onClick={() => addElement('image', undefined, undefined, { logo: true })}
              />
              <PaletteItem
                label="Ảnh từ máy…"
                icon="solar:gallery-add-bold"
                disabled={disabled}
                payload={null}
                onClick={() => pickImage(null)}
              />
            </Stack>
          </Box>
          {LABEL_FIELD_GROUPS.map((group) => (
            <Box key={group.label}>
              <Typography variant="overline" color="text.secondary">
                {group.label}
              </Typography>
              <Stack spacing={0.5}>
                {group.keys.map((key) => {
                  const field = LABEL_FIELD_BY_KEY.get(key)!;
                  return (
                    <PaletteItem
                      key={key}
                      label={field.label}
                      hint={field.hint}
                      icon="mdi:form-textbox"
                      disabled={disabled}
                      payload={{ type: 'text', field: key }}
                      onClick={() => addElement('text', key)}
                    />
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* Khung tem */}
      <Paper variant="outlined" sx={{ overflow: 'hidden', minWidth: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          gap={1.5}
          sx={{
            px: 1.5,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.neutral',
          }}
        >
          <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            Tem {String(paper.labelWidthMm).replace('.', ',')} ×{' '}
            {String(paper.labelHeightMm).replace('.', ',')} mm
          </Typography>
          <Divider orientation="vertical" flexItem />
          <Tooltip title="Thu nhỏ">
            <IconButton
              size="small"
              aria-label="Thu nhỏ"
              onClick={() => setZoomOverride(Math.max(1, round3(zoom - 0.5)))}
            >
              <Iconify icon="eva:minus-fill" width={18} />
            </IconButton>
          </Tooltip>
          <Slider
            size="small"
            min={1}
            max={MAX_ZOOM}
            step={0.25}
            value={zoom}
            onChange={(_, next) => setZoomOverride(next as number)}
            aria-label="Phóng to"
            sx={{ width: 120 }}
          />
          <Tooltip title="Phóng to">
            <IconButton
              size="small"
              aria-label="Phóng to"
              onClick={() => setZoomOverride(Math.min(MAX_ZOOM, round3(zoom + 0.5)))}
            >
              <Iconify icon="eva:plus-fill" width={18} />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" sx={{ width: 44 }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <Button size="small" color="inherit" onClick={() => setZoomOverride(null)}>
            Vừa khung
          </Button>
          <Divider orientation="vertical" flexItem />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={snap}
                onChange={(event) => setSnap(event.target.checked)}
              />
            }
            label={<Typography variant="body2">Bám lưới 0,5 mm</Typography>}
          />
        </Stack>

        {uploading > 0 && <LinearProgress aria-label="Đang tải ảnh lên" />}

        <Box
          sx={{ p: 4, bgcolor: '#dfe3e8', overflow: 'auto', minHeight: 320, display: 'flex' }}
          onPointerDown={() => setSelectedId(null)}
        >
          <Box
            ref={canvasRef}
            tabIndex={0}
            role="application"
            aria-label="Khung thiết kế tem"
            onKeyDown={onKeyDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDragOver={(event) => {
              if (
                event.dataTransfer.types.includes(DRAG_TYPE) ||
                event.dataTransfer.types.includes('Files')
              )
                event.preventDefault();
            }}
            onDrop={onDrop}
            sx={{
              position: 'relative',
              m: 'auto',
              flexShrink: 0,
              width: paper.labelWidthMm * scale,
              height: paper.labelHeightMm * scale,
              bgcolor: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              outline: 'none',
              // Lưới 1 mm (đậm hơn mỗi 5 mm).
              backgroundImage: [
                `linear-gradient(to right, rgba(145,158,171,0.35) 1px, transparent 1px)`,
                `linear-gradient(to bottom, rgba(145,158,171,0.35) 1px, transparent 1px)`,
                `linear-gradient(to right, rgba(145,158,171,0.12) 1px, transparent 1px)`,
                `linear-gradient(to bottom, rgba(145,158,171,0.12) 1px, transparent 1px)`,
              ].join(','),
              backgroundSize: `${5 * scale}px ${5 * scale}px, ${5 * scale}px ${5 * scale}px, ${scale}px ${scale}px, ${scale}px ${scale}px`,
              '&:focus-visible': { boxShadow: '0 0 0 2px rgba(0, 120, 255, 0.6)' },
            }}
          >
            {/* Lớp hiển thị: đúng HTML in ra, ở cỡ thật rồi phóng to. */}
            <style dangerouslySetInnerHTML={{ __html: LABEL_ELEMENT_CSS }} />
            <Box
              className="lb"
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: `${paper.labelWidthMm}mm`,
                height: `${paper.labelHeightMm}mm`,
                transform: `scale(${zoom})`,
                transformOrigin: '0 0',
                fontFamily: 'Arial,"Segoe UI",Tahoma,sans-serif',
                color: '#000',
                pointerEvents: 'none',
              }}
              dangerouslySetInnerHTML={{
                __html: rendered
                  .map(({ result }) => (result && 'html' in result ? result.html : ''))
                  .join(''),
              }}
            />

            {/* Lề trong và giới hạn vùng in */}
            <Box
              sx={{
                position: 'absolute',
                pointerEvents: 'none',
                left: paper.paddingMm * scale,
                top: paper.paddingMm * scale,
                right: paper.paddingMm * scale,
                bottom: paper.paddingMm * scale,
                border: '1px dashed rgba(0, 120, 255, 0.35)',
              }}
            />
            {printLimit && (
              <Box
                sx={{
                  position: 'absolute',
                  pointerEvents: 'none',
                  left: printLimit * scale,
                  top: 0,
                  bottom: 0,
                  right: 0,
                  bgcolor: 'rgba(145, 158, 171, 0.25)',
                  borderLeft: '1px dashed rgba(255, 86, 48, 0.8)',
                }}
              />
            )}

            {/* Lớp tương tác */}
            {rendered.map(({ element, result }) => {
              const active = element.id === selectedId;
              const problem = result && 'problem' in result ? result.problem : null;
              return (
                <Tooltip
                  key={element.id}
                  title={problem ?? ''}
                  disableHoverListener={!problem}
                  placement="top"
                >
                  <Box
                    role="button"
                    aria-label={`${TYPE_LABEL[element.type]}${element.text ? ` ${element.text}` : ''}`}
                    aria-pressed={active}
                    onPointerDown={(event) => onPointerDown(event, element, 'move')}
                    sx={{
                      position: 'absolute',
                      left: element.xMm * scale,
                      top: element.yMm * scale,
                      width: Math.max(4, element.wMm * scale),
                      height: Math.max(4, element.hMm * scale),
                      cursor: disabled ? 'default' : 'move',
                      outline: problem
                        ? '2px solid rgba(255, 86, 48, 0.9)'
                        : active
                          ? '2px solid rgba(0, 120, 255, 0.9)'
                          : '1px dashed rgba(0, 120, 255, 0.35)',
                      bgcolor: problem
                        ? 'rgba(255, 86, 48, 0.08)'
                        : active
                          ? 'rgba(0, 120, 255, 0.05)'
                          : 'transparent',
                      '&:hover': {
                        outline: active ? undefined : '1px solid rgba(0, 120, 255, 0.7)',
                      },
                    }}
                  >
                    {active &&
                      !disabled &&
                      HANDLES.map((handle) => (
                        <Box
                          key={handle}
                          aria-label={`Kéo để đổi cỡ (${handle})`}
                          onPointerDown={(event) => onPointerDown(event, element, handle)}
                          sx={{
                            position: 'absolute',
                            width: 9,
                            height: 9,
                            bgcolor: '#fff',
                            border: '1.5px solid rgba(0, 120, 255, 0.95)',
                            borderRadius: '2px',
                            ...(handle.includes('n')
                              ? { top: -5 }
                              : handle.includes('s')
                                ? { bottom: -5 }
                                : { top: 'calc(50% - 4.5px)' }),
                            ...(handle.includes('w')
                              ? { left: -5 }
                              : handle.includes('e')
                                ? { right: -5 }
                                : { left: 'calc(50% - 4.5px)' }),
                            cursor: `${handle}-resize`,
                          }}
                        />
                      ))}
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </Box>

        {errors.length > 0 && (
          <Alert severity="error" sx={{ m: 1.5 }}>
            {errors.map((error) => (
              <Typography key={error} variant="body2">
                {error}
              </Typography>
            ))}
          </Alert>
        )}
        {outside.length > 0 && (
          <Alert
            severity="warning"
            sx={{ m: 1.5 }}
            action={
              <Button
                color="inherit"
                size="small"
                disabled={disabled}
                onClick={() =>
                  setElements(value.elements.map((element) => clampElement(element, paper)))
                }
              >
                Đưa vào tem
              </Button>
            }
          >
            {outside.length} phần tử nằm một phần ngoài tem — phần thừa sẽ bị cắt khi in.
          </Alert>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          component="div"
          sx={{ px: 1.5, pb: 1.5 }}
        >
          Dữ liệu mẫu (giảm 20%) chỉ để xem bố cục. Viền xanh nét đứt là lề trong tem; vùng xám là
          phần không in (đuôi tem). Mũi tên: nhích 0,5 mm · Shift + mũi tên: 0,125 mm · Delete: xoá
          · Ctrl + D: nhân bản.
        </Typography>
      </Paper>

      {/* Thuộc tính */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        {selected ? (
          <ElementProperties
            element={selected}
            disabled={disabled}
            onChange={(patch) => updateElement(selected.id, patch)}
            onDelete={removeSelected}
            onDuplicate={duplicateSelected}
            onLayer={moveLayer}
            onDeselect={() => setSelectedId(null)}
            onReplaceImage={() => pickImage(selected.id)}
          />
        ) : (
          <Stack spacing={2}>
            <Typography variant="subtitle2">Khổ giấy tem</Typography>
            <TextField
              select
              size="small"
              label="Loại giấy in tem"
              value={value.presetId}
              disabled={disabled}
              onChange={(event) => changePreset(event.target.value)}
            >
              {LABEL_TEMPLATES.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name}
                </MenuItem>
              ))}
              <MenuItem value={CUSTOM_PRESET}>Tuỳ chỉnh…</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="Kiểu giấy"
              value={paper.kind}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...value,
                  presetId: CUSTOM_PRESET,
                  paper: normalizeTemplate({
                    ...paper,
                    id: CUSTOM_PRESET,
                    kind: event.target.value as 'roll' | 'sheet',
                  }),
                })
              }
            >
              <MenuItem value="roll">Giấy cuộn — mỗi hàng tem một trang</MenuItem>
              <MenuItem value="sheet">Giấy tờ (A4, A5…) — nhiều hàng</MenuItem>
            </TextField>
            <Box display="grid" gap={1.5} gridTemplateColumns="repeat(2, minmax(0, 1fr))">
              {TEMPLATE_NUMBER_FIELDS.filter(
                (field) =>
                  (isSheet || !field.sheetOnly) &&
                  !['namePt', 'codePt', 'pricePt'].includes(field.key)
              ).map((field) => (
                <TextField
                  key={field.key}
                  size="small"
                  type="number"
                  label={`${(isSheet && field.sheetLabel) || field.label} (${field.unit})`}
                  value={paper[field.key]}
                  disabled={disabled}
                  onChange={(event) => {
                    const number = Number(event.target.value);
                    if (Number.isFinite(number) && event.target.value !== '')
                      changePaperNumber(field.key, number);
                  }}
                  inputProps={{ min: field.min, max: field.max, step: field.step }}
                />
              ))}
            </Box>

            <Divider />
            <Typography variant="subtitle2">Định dạng giá</Typography>
            <TextField
              select
              size="small"
              label="Chữ sau giá"
              value={value.priceSuffix}
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...value, priceSuffix: event.target.value as LabelPriceSuffix })
              }
              helperText={`Ví dụ: ${sampleValues.price}`}
            >
              <MenuItem value="đ">đ</MenuItem>
              <MenuItem value="VND">VND</MenuItem>
              <MenuItem value="none">Không ghi</MenuItem>
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  checked={value.priceWithUnit}
                  disabled={disabled}
                  onChange={(event) => onChange({ ...value, priceWithUnit: event.target.checked })}
                />
              }
              label="Kèm đơn vị tính sau giá"
            />

            <Divider />
            <Button
              variant="outlined"
              color="inherit"
              disabled={disabled}
              startIcon={<Iconify icon="solar:magic-stick-3-bold" />}
              onClick={() => {
                if (
                  value.elements.length === 0 ||
                  window.confirm('Thay mọi phần tử bằng bố cục gợi ý cho khổ tem này?')
                ) {
                  onChange({ ...value, elements: suggestedElements(paper) });
                  setSelectedId(null);
                }
              }}
            >
              Bố cục gợi ý
            </Button>
            <Typography variant="caption" color="text.secondary">
              Bấm vào một phần tử trên tem để sửa nội dung, cỡ chữ, vị trí.
            </Typography>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}

// ----------------------------------------------------------------------

function PaletteItem({
  label,
  hint,
  icon,
  payload,
  disabled,
  onClick,
}: {
  label: string;
  hint?: string;
  icon: string;
  /** null = chỉ bấm (không kéo được). */
  payload: { type: LabelElementType; field?: string; logo?: boolean } | null;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      disabled={disabled}
      draggable={!disabled && !!payload}
      onDragStart={(event) => {
        if (!payload) return;
        event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
        event.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={onClick}
      aria-label={`Thêm ${label}`}
      sx={{
        justifyContent: 'flex-start',
        textAlign: 'left',
        gap: 1,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        cursor: disabled ? 'default' : 'grab',
        '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.light' },
      }}
    >
      <Iconify icon={icon} width={16} sx={{ color: 'text.secondary', flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
          {label}
        </Typography>
        {hint && (
          <Typography variant="caption" component="div" color="text.disabled">
            {hint}
          </Typography>
        )}
      </Box>
    </ButtonBase>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
  step = 0.5,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  step?: number;
  min?: number;
}) {
  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        const number = Number(event.target.value);
        if (event.target.value !== '' && Number.isFinite(number)) onChange(number);
      }}
      inputProps={{ step, min }}
    />
  );
}

function ElementProperties({
  element,
  disabled,
  onChange,
  onDelete,
  onDuplicate,
  onLayer,
  onDeselect,
  onReplaceImage,
}: {
  element: LabelElement;
  disabled?: boolean;
  onChange: (patch: Partial<LabelElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onLayer: (direction: 1 | -1) => void;
  onDeselect: () => void;
  onReplaceImage: () => void;
}) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle2">{TYPE_LABEL[element.type]}</Typography>
        <Stack direction="row">
          <Tooltip title="Đưa lên trên">
            <IconButton
              size="small"
              aria-label="Đưa lên trên"
              disabled={disabled}
              onClick={() => onLayer(1)}
            >
              <Iconify icon="mdi:arrange-bring-forward" width={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Đưa xuống dưới">
            <IconButton
              size="small"
              aria-label="Đưa xuống dưới"
              disabled={disabled}
              onClick={() => onLayer(-1)}
            >
              <Iconify icon="mdi:arrange-send-backward" width={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Nhân bản (Ctrl + D)">
            <IconButton
              size="small"
              aria-label="Nhân bản"
              disabled={disabled}
              onClick={onDuplicate}
            >
              <Iconify icon="solar:copy-bold" width={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Xoá (Delete)">
            <IconButton
              size="small"
              color="error"
              aria-label="Xoá phần tử"
              disabled={disabled}
              onClick={onDelete}
            >
              <Iconify icon="solar:trash-bin-trash-bold" width={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Bỏ chọn — xem khổ giấy">
            <IconButton size="small" aria-label="Bỏ chọn" onClick={onDeselect}>
              <Iconify icon="mingcute:close-line" width={18} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Box display="grid" gap={1.5} gridTemplateColumns="repeat(2, minmax(0, 1fr))">
        <NumberField
          label="X (mm)"
          value={element.xMm}
          disabled={disabled}
          onChange={(xMm) => onChange({ xMm })}
        />
        <NumberField
          label="Y (mm)"
          value={element.yMm}
          disabled={disabled}
          onChange={(yMm) => onChange({ yMm })}
        />
        <NumberField
          label="Rộng (mm)"
          value={element.wMm}
          disabled={disabled}
          min={0.1}
          onChange={(wMm) => onChange({ wMm })}
        />
        <NumberField
          label="Cao (mm)"
          value={element.hMm}
          disabled={disabled}
          min={0.1}
          onChange={(hMm) => onChange({ hMm })}
        />
      </Box>

      {element.type === 'text' && (
        <>
          <TextField
            size="small"
            label="Nội dung"
            value={element.text ?? ''}
            disabled={disabled}
            multiline
            maxRows={4}
            onChange={(event) => onChange({ text: event.target.value })}
            helperText="Trường dạng {{ma}} — chọn bên dưới để chèn."
          />
          <TextField
            select
            size="small"
            label="Chèn trường"
            value=""
            disabled={disabled}
            onChange={(event) =>
              onChange({ text: `${element.text ?? ''}{{${event.target.value}}}` })
            }
          >
            {LABEL_FIELDS.map((field) => (
              <MenuItem key={field.key} value={field.key}>
                {field.label}
              </MenuItem>
            ))}
          </TextField>
          <Box display="grid" gap={1.5} gridTemplateColumns="repeat(2, minmax(0, 1fr))">
            <NumberField
              label="Cỡ chữ (pt)"
              value={element.fontPt ?? 7}
              step={0.5}
              min={4}
              disabled={disabled}
              onChange={(fontPt) => onChange({ fontPt: Math.min(48, Math.max(4, fontPt)) })}
            />
            <NumberField
              label="Số dòng tối đa"
              value={element.maxLines ?? 1}
              step={1}
              min={1}
              disabled={disabled}
              onChange={(maxLines) =>
                onChange({ maxLines: Math.min(5, Math.max(1, Math.round(maxLines))) })
              }
            />
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <ToggleButtonGroup
              size="small"
              value={[
                element.bold && 'bold',
                element.italic && 'italic',
                element.strike && 'strike',
              ].filter(Boolean)}
              onChange={(_, next: string[]) =>
                onChange({
                  bold: next.includes('bold'),
                  italic: next.includes('italic'),
                  strike: next.includes('strike'),
                })
              }
              disabled={disabled}
            >
              <ToggleButton value="bold" aria-label="Đậm">
                <Iconify icon="solar:text-bold-bold" width={16} />
              </ToggleButton>
              <ToggleButton value="italic" aria-label="Nghiêng">
                <Iconify icon="solar:text-italic-bold" width={16} />
              </ToggleButton>
              <ToggleButton value="strike" aria-label="Gạch ngang">
                <Iconify icon="solar:text-cross-bold" width={16} />
              </ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={element.align ?? 'center'}
              onChange={(_, next: LabelTextAlign | null) => next && onChange({ align: next })}
              disabled={disabled}
            >
              <ToggleButton value="left" aria-label="Căn trái">
                <Iconify icon="solar:align-left-bold" width={16} />
              </ToggleButton>
              <ToggleButton value="center" aria-label="Căn giữa">
                <Iconify icon="solar:align-horizontal-center-bold" width={16} />
              </ToggleButton>
              <ToggleButton value="right" aria-label="Căn phải">
                <Iconify icon="solar:align-right-bold" width={16} />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </>
      )}

      {(element.type === 'barcode' || element.type === 'qrcode') && (
        <TextField
          select
          size="small"
          label="Mã đem mã hoá"
          value={element.source ?? 'barcode-or-code'}
          disabled={disabled}
          onChange={(event) => onChange({ source: event.target.value as LabelElement['source'] })}
        >
          <MenuItem value="barcode-or-code">Mã vạch — không có thì mã hàng</MenuItem>
          <MenuItem value="code">Mã hàng</MenuItem>
          {element.type === 'qrcode' && (
            <MenuItem value="custom">Nội dung tự nhập (link…)</MenuItem>
          )}
        </TextField>
      )}

      {element.type === 'qrcode' && element.source === 'custom' && (
        <TextField
          size="small"
          label="Nội dung mã QR"
          value={element.text ?? ''}
          disabled={disabled}
          placeholder="https://cuahang.vn/p/{{product_code}}"
          onChange={(event) => onChange({ text: event.target.value })}
          helperText="Dùng được trường {{product_code}}, {{barcode_value}}…"
        />
      )}

      {element.type === 'barcode' && (
        <>
          <FormControlLabel
            control={
              <Switch
                checked={!!element.showText}
                disabled={disabled}
                onChange={(event) => onChange({ showText: event.target.checked })}
              />
            }
            label="In dãy mã dưới vạch"
          />
          <TextField
            select
            size="small"
            label="Độ rộng vạch"
            value={element.moduleDots ?? 0}
            disabled={disabled}
            onChange={(event) =>
              onChange({ moduleDots: Number(event.target.value) as LabelElement['moduleDots'] })
            }
            helperText="Tự động: vạch to nhất còn vừa khung (dễ quét hơn)."
          >
            <MenuItem value={0}>Tự động</MenuItem>
            <MenuItem value={1}>1 điểm (0,125 mm) — mã dài</MenuItem>
            <MenuItem value={2}>2 điểm (0,25 mm) — thông dụng</MenuItem>
            <MenuItem value={3}>3 điểm (0,375 mm) — dễ quét</MenuItem>
          </TextField>
        </>
      )}

      {element.type === 'box' && (
        <NumberField
          label="Độ dày viền (mm)"
          value={element.strokeMm ?? 0.3}
          step={0.1}
          min={0.1}
          disabled={disabled}
          onChange={(strokeMm) => onChange({ strokeMm: Math.min(3, Math.max(0.1, strokeMm)) })}
        />
      )}
      {element.type === 'line' && (
        <Typography variant="caption" color="text.secondary">
          Độ dày đường kẻ = chiều cao (kẻ ngang) hoặc chiều rộng (kẻ dọc) của khung.
        </Typography>
      )}
      {element.type === 'image' && (
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary">
            {element.logo
              ? 'Logo cửa hàng: khi in lấy logo hiện tại (Cài đặt cửa hàng → Thông tin). Ảnh vừa khung, giữ tỉ lệ.'
              : 'Ảnh vừa khung, giữ tỉ lệ. Máy in nhiệt in ảnh trắng đen — ảnh nét đậm, ít chi tiết in rõ nhất.'}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={disabled}
            onClick={onReplaceImage}
            startIcon={<Iconify icon="solar:gallery-add-bold" />}
          >
            {element.logo ? 'Thay bằng ảnh từ máy…' : 'Đổi ảnh…'}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
