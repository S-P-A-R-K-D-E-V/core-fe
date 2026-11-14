'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { apiErrorMessage } from 'src/utils/api-error';
import { printHtmlDocument } from 'src/utils/print-html';

import {
  getPrintTemplate,
  createPrintTemplate,
  updatePrintTemplate,
} from 'src/api/print-templates';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useStoreBrand } from 'src/components/branding';

import { DEFAULT_CALIBRATION } from 'src/sections/pos/label-print/label-template';

import type { PrintTemplateKind } from 'src/types/print-template';

import { PRINT_KIND_LABEL } from '../print-template-resolve';
import { LabelDesigner } from '../label/label-designer';
import { ReceiptTemplateEditor } from '../receipt/receipt-template-editor';
import { ReceiptBlockEditor } from '../receipt/blocks/receipt-block-editor';
import { compileReceiptBlocks } from '../receipt/blocks/receipt-blocks-compile';
import { RECEIPT_FIELD_SET } from '../receipt/receipt-template-fields';
import { ReceiptTemplatePreview } from '../receipt/receipt-template-preview';
import { PURCHASE_PREVIEW_SOURCE } from '../purchase/purchase-preview-source';
import {
  BLOCK_STARTERS,
  starterBlocks,
  readReceiptBlocks,
  RECEIPT_BLOCKS_VERSION,
} from '../receipt/blocks/receipt-blocks';
import {
  purchaseDocument,
  PURCHASE_FIELD_SET,
  samplePurchasePrint,
} from '../purchase/purchase-template-fields';
import { renderDesignSheetHtml, snapDesignToDots } from '../label/label-design-render';
import { sampleReceipt, defaultReceiptTemplate } from '../receipt/receipt-template-default';
import { ReceiptTemplateSettingsPanel } from '../receipt/receipt-template-settings-panel';
import { parseLabelDesign, defaultLabelDesign, serializeLabelDesign } from '../label/label-design';
import {
  normalizeReceiptSettings,
  defaultReceiptSettings,
} from '../receipt/receipt-template-settings';

import type { LabelDesign } from '../label/label-design';
import type { ReceiptBlock, BlockDocumentKind } from '../receipt/blocks/receipt-blocks';
import type { RenderedReceiptTemplate } from '../receipt/receipt-template-render';
import type { ReceiptTemplateSettings } from '../receipt/receipt-template-settings';
import type { DesignLabelSource, DesignPrintContext } from '../label/label-design-render';

// ----------------------------------------------------------------------
// Soạn một mẫu in: hoá đơn (soạn theo khối HOẶC soạn tự do bằng tiptap + thiết lập trang + xem trước) hoặc tem mã (khung
// thiết kế tem). Mẫu mới (id = 'new') bắt đầu từ bố cục khối giấy cuộn 80 mm / bố cục tem gợi ý; Lưu lần đầu tạo mẫu rồi
// chuyển sang địa chỉ của mẫu.
// Soạn theo khối: khối lưu ở `settings.blocks`, `content` là HTML dịch từ khối (bộ in chỉ đọc `content`). "Soạn tự do"
// chuyển một chiều: lấy HTML đã dịch làm nội dung tiptap, lưu thì bỏ `settings.blocks`.
// ----------------------------------------------------------------------

const SAMPLE_LABEL_ITEMS: DesignLabelSource[] = [
  {
    key: 's1',
    name: 'Kẹp tóc nơ nhung đỏ',
    code: 'K35',
    barcode: '8938505974194',
    price: 35000,
    unit: 'cái',
    quantity: 2,
  },
  {
    key: 's2',
    name: 'Bông tai bạc đính đá',
    code: 'BT120',
    barcode: null,
    price: 120000,
    unit: 'đôi',
    quantity: 2,
    discount: { percent: 20 },
  },
];

type Props = {
  id: string;
  /** Loại mẫu khi tạo mới (?kind=). */
  kind?: string;
};

type Draft = {
  name: string;
  /** Hoá đơn — soạn tự do (khi `blocks` = null). */
  html: string;
  /** Hoá đơn — soạn theo khối; null = soạn tự do. */
  blocks: ReceiptBlock[] | null;
  receiptSettings: ReceiptTemplateSettings;
  /** Tem */
  design: LabelDesign;
};

const asKind = (value: string | undefined): PrintTemplateKind =>
  value === 'label' || value === 'purchase' ? value : 'receipt';

/** Hoá đơn / phiếu nhập soạn theo khối; tem mã có trình thiết kế riêng. */
const blockKindOf = (kind: PrintTemplateKind): BlockDocumentKind =>
  kind === 'purchase' ? 'purchase' : 'receipt';

const NEW_NAMES: Record<PrintTemplateKind, string> = {
  receipt: 'Hoá đơn giấy cuộn 80 mm',
  purchase: 'Phiếu nhập A4',
  label: 'Tem mã',
};

function initialDraft(kind: PrintTemplateKind): Draft {
  const receipt = defaultReceiptTemplate('80');
  const blockKind = blockKindOf(kind);
  const starter = starterBlocks(BLOCK_STARTERS[blockKind][0].key, blockKind);
  return {
    name: NEW_NAMES[kind],
    html: receipt.content,
    blocks: kind === 'label' ? null : starter.items,
    receiptSettings: defaultReceiptSettings(starter.paper),
    design: defaultLabelDesign(),
  };
}

export function PrintTemplateEditView({ id, kind: kindParam }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { brandName, logoUrl } = useStoreBrand();
  const isNew = id === 'new';

  const [kind, setKind] = useState<PrintTemplateKind>(asKind(kindParam));
  const [draft, setDraft] = useState<Draft>(() => initialDraft(asKind(kindParam)));
  const blockKind = blockKindOf(kind);
  const htmlKind = kind !== 'label';
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [panel, setPanel] = useState<'settings' | 'preview'>('preview');
  const [zoom, setZoom] = useState(1.25);
  const [rendered, setRendered] = useState<RenderedReceiptTemplate | null>(null);

  useEffect(() => {
    if (isNew) return undefined;
    let active = true;
    setLoading(true);
    getPrintTemplate(id)
      .then((template) => {
        if (!active) return;
        const html = template.kind !== 'label';
        setKind(template.kind);
        setDraft({
          name: template.name,
          html: html ? template.content : '',
          blocks: html ? (readReceiptBlocks(template.settings)?.items ?? null) : null,
          receiptSettings: html
            ? normalizeReceiptSettings(template.settings)
            : defaultReceiptSettings(),
          design:
            template.kind === 'label' ? parseLabelDesign(template.content) : defaultLabelDesign(),
        });
        setLoadError(null);
      })
      .catch((error) => {
        if (active) setLoadError(apiErrorMessage(error, 'Không tải được mẫu in'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, isNew]);

  // Rời trang khi còn thay đổi chưa lưu → trình duyệt hỏi lại.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const change = (patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const onHtmlChange = useCallback((html: string) => {
    setDraft((prev) => (prev.html === html ? prev : { ...prev, html }));
    setDirty(true);
  }, []);

  const labelContext: DesignPrintContext = useMemo(
    () => ({
      storeName: brandName,
      logoUrl,
      warehouse: { name: 'Kho chính', address: '21 Chùa Láng, Đống Đa', phone: '0901 234 567' },
    }),
    [brandName, logoUrl]
  );
  const sample = useMemo(
    () =>
      kind === 'purchase'
        ? purchaseDocument(samplePurchasePrint(brandName, logoUrl))
        : sampleReceipt(brandName, logoUrl),
    [kind, brandName, logoUrl]
  );

  /** Nội dung sẽ lưu / in: HTML dịch từ khối, hoặc HTML soạn tự do. */
  const receiptContent = useMemo(
    () => (draft.blocks ? compileReceiptBlocks(draft.blocks, draft.receiptSettings) : draft.html),
    [draft.blocks, draft.receiptSettings, draft.html]
  );

  const onBlocksChange = useCallback((blocks: ReceiptBlock[]) => {
    setDraft((prev) => ({ ...prev, blocks }));
    setDirty(true);
  }, []);

  const applyStarter = (key: string) => {
    const starter = BLOCK_STARTERS[blockKind].find((s) => s.key === key);
    if (!starter) return;
    const { paper, items } = starterBlocks(key, blockKind);
    change({ blocks: items, receiptSettings: defaultReceiptSettings(paper) });
  };

  const switchToFreeMode = () => {
    if (
      !window.confirm(
        'Chuyển sang soạn tự do? Bố cục hiện tại được chép sang trình soạn văn bản. Sau khi lưu, mẫu này không mở lại theo khối được.'
      )
    )
      return;
    change({ html: receiptContent, blocks: null });
  };

  const handleSave = async () => {
    const name = draft.name.trim();
    if (!name) {
      enqueueSnackbar('Nhập tên mẫu in', { variant: 'warning' });
      return;
    }
    const payload = htmlKind
        ? {
            name,
            content: receiptContent,
            settings: JSON.stringify(
              draft.blocks
                ? { ...draft.receiptSettings, blocks: { v: RECEIPT_BLOCKS_VERSION, items: draft.blocks } }
                : draft.receiptSettings
            ),
          }
        : { name, content: serializeLabelDesign(snapDesignToDots(draft.design)), settings: '{}' };
    setSaving(true);
    try {
      if (isNew) {
        const created = await createPrintTemplate(kind, payload);
        setDirty(false);
        enqueueSnackbar('Đã tạo mẫu in');
        router.replace(paths.dashboard.storeSettings.printTemplateEdit(created.id));
      } else {
        const updated = await updatePrintTemplate(id, payload);
        // Máy chủ lọc lại HTML — nạp bản đã lọc để trình soạn khớp với thứ sẽ in.
        // Soạn theo khối: nội dung luôn dịch lại từ khối nên không cần nạp.
        if (updated.kind !== 'label')
          setDraft((prev) => (prev.blocks ? prev : { ...prev, html: updated.content }));
        setDirty(false);
        enqueueSnackbar('Đã lưu mẫu in');
      }
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Lưu mẫu in thất bại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = () => {
    const html = htmlKind
        ? rendered?.html
        : renderDesignSheetHtml(
            { items: SAMPLE_LABEL_ITEMS, context: labelContext },
            draft.design,
            DEFAULT_CALIBRATION
          );
    if (!html) {
      enqueueSnackbar('Bản xem trước chưa dựng xong', { variant: 'info' });
      return;
    }
    printHtmlDocument(html).catch((error) => {
      console.error(error);
      enqueueSnackbar('Không mở được hộp thoại in của trình duyệt', { variant: 'error' });
    });
  };

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 10 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (loadError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              component={RouterLink}
              href={paths.dashboard.storeSettings.printTemplates}
            >
              Về danh sách
            </Button>
          }
        >
          {loadError}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, pb: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Button
          color="inherit"
          component={RouterLink}
          href={paths.dashboard.storeSettings.printTemplates}
          startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
        >
          Mẫu in
        </Button>
        <Typography variant="overline" color="text.secondary">
          {PRINT_KIND_LABEL[kind]}
        </Typography>
        <TextField
          size="small"
          label="Tên mẫu"
          value={draft.name}
          onChange={(event) => change({ name: event.target.value })}
          inputProps={{ maxLength: 120 }}
          sx={{ flexGrow: 1, maxWidth: 420 }}
        />
        <Box sx={{ flexGrow: 1 }} />
        {htmlKind && !draft.blocks && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 180 }}>
            <Iconify icon="eva:search-fill" width={18} sx={{ color: 'text.disabled' }} />
            <Slider
              size="small"
              min={0.75}
              max={2.5}
              step={0.25}
              value={zoom}
              onChange={(_, next) => setZoom(next as number)}
              aria-label="Phóng to trang soạn"
            />
            <Typography variant="caption" sx={{ width: 40 }}>
              {Math.round(zoom * 100)}%
            </Typography>
          </Stack>
        )}
        <Button
          variant="outlined"
          color="inherit"
          onClick={handleTestPrint}
          startIcon={<Iconify icon="solar:printer-minimalistic-bold" />}
        >
          In thử
        </Button>
        <LoadingButton
          variant="contained"
          loading={saving}
          onClick={handleSave}
          startIcon={<Iconify icon="solar:diskette-bold" />}
        >
          {isNew ? 'Tạo mẫu' : 'Lưu'}
        </LoadingButton>
      </Stack>

      {htmlKind ? (
        <Box
          display="grid"
          gap={2}
          gridTemplateColumns={{ xs: 'minmax(0, 1fr)', xl: 'minmax(0, 1fr) 380px' }}
          alignItems="start"
        >
          {draft.blocks ? (
            <ReceiptBlockEditor
              kind={blockKind}
              blocks={draft.blocks}
              onChange={onBlocksChange}
              onStarter={applyStarter}
              onFreeMode={switchToFreeMode}
            />
          ) : (
            <ReceiptTemplateEditor
              key={kind}
              fieldSet={kind === 'purchase' ? PURCHASE_FIELD_SET : RECEIPT_FIELD_SET}
              value={draft.html}
              onChange={onHtmlChange}
              settings={draft.receiptSettings}
              zoom={zoom}
              logoUrl={logoUrl}
            />
          )}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Tabs value={panel} onChange={(_, next) => setPanel(next)} sx={{ mb: 2 }}>
              <Tab value="preview" label="Xem trước" />
              <Tab value="settings" label="Khổ giấy & lề" />
            </Tabs>
            {panel === 'settings' && (
              <ReceiptTemplateSettingsPanel
                value={draft.receiptSettings}
                onChange={(receiptSettings) => change({ receiptSettings })}
              />
            )}
            {/* Xem trước luôn dựng (ẩn khi đang ở thẻ thiết lập) để "In thử" in đúng bản mới nhất. */}
            <Box sx={{ display: panel === 'preview' ? 'block' : 'none' }}>
              <ReceiptTemplatePreview
                content={receiptContent}
                settings={draft.receiptSettings}
                sample={sample}
                source={kind === 'purchase' ? PURCHASE_PREVIEW_SOURCE : undefined}
                onRendered={setRendered}
              />
            </Box>
            {!draft.blocks && kind === 'receipt' && (
              <Button
                size="small"
                color="inherit"
                sx={{ mt: 2 }}
                onClick={() => {
                  if (window.confirm('Thay nội dung bằng mẫu giống phiếu hệ thống?')) {
                    change({ html: defaultReceiptTemplate(draft.receiptSettings.paper).content });
                  }
                }}
              >
                Đặt lại nội dung mẫu chuẩn
              </Button>
            )}
          </Paper>
        </Box>
      ) : (
        <LabelDesigner
          value={draft.design}
          onChange={(design) => change({ design })}
          context={labelContext}
        />
      )}
    </Box>
  );
}
