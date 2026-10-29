'use client';

import { useRef, useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { apiErrorMessage } from 'src/utils/api-error';
import { printHtmlDocument } from 'src/utils/print-html';

import { getBankAccounts } from 'src/api/bank-accounts';
import { getSalesOrderReceipt } from 'src/api/sales-orders';
import { getPrintTemplates } from 'src/api/print-templates';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { resolveAppliedTemplate } from 'src/sections/print-template/print-template-resolve';
import { renderReceiptTemplate } from 'src/sections/print-template/receipt/receipt-template-render';
import {
  RECEIPT_TEMPLATE_PAPERS,
  normalizeReceiptSettings,
} from 'src/sections/print-template/receipt/receipt-template-settings';

import type { IPrintTemplateList } from 'src/types/print-template';
import type { ISalesOrderReceipt, IKiotVietBankAccount } from 'src/types/corecms-api';

import {
  renderReceiptHtml,
  receiptPageSizeMm,
  formatReceiptMoney,
  RECEIPT_PAPER_WIDTHS,
} from './receipt-html';
import {
  loadReceiptSettings,
  saveReceiptSettings,
  needsTransferAccount,
  transferAccountLabel,
  usableTransferAccounts,
} from './receipt-settings';

import type { ReceiptPaperWidth } from './receipt-html';
import type { ReceiptPrintSettings } from './receipt-settings';

// ----------------------------------------------------------------------
// Hộp thoại "In hoá đơn": tải phiếu thanh toán của một hoá đơn, xem trước ĐÚNG tài liệu sẽ in, chọn khổ
// giấy (80 / 58 mm — nhớ theo trình duyệt) rồi in qua hộp thoại in của trình duyệt (iframe ẩn).
// Hoá đơn còn tiền phải trả mà core-be chưa xác định được tài khoản nhận thì cho chọn tài khoản để in
// kèm mã QR chuyển khoản; tài khoản đã chọn được nhớ cho lần in sau.
// Cửa hàng có mẫu in hoá đơn (Mẫu in): mặc định dùng mẫu áp dụng cho kênh × phương thức của hoá đơn; người in đổi được
// sang mẫu khác hoặc mẫu hệ thống. Khổ giấy khi đó theo mẫu. Không có mẫu nào → như trước.
// ----------------------------------------------------------------------

/** Lựa chọn mẫu: theo bảng áp dụng của cửa hàng / mẫu hệ thống / id một mẫu. */
const TEMPLATE_AUTO = '__auto__';
const TEMPLATE_SYSTEM = '__system__';
const NO_TEMPLATES: IPrintTemplateList = { templates: [], assignments: [] };

const PX_PER_MM = 96 / 25.4;
const PREVIEW_SCALE = 1.25;
const PREVIEW_MAX_HEIGHT_PX = 440;

const LOAD_ERROR = 'Không tải được phiếu thanh toán';

// axios reject bằng chuỗi này khi response không có body (mất mạng, 403 rỗng…) — không đáng hiện ra.
const receiptErrorMessage = (error: unknown) =>
  error === 'Something went wrong' ? LOAD_ERROR : apiErrorMessage(error, LOAD_ERROR);

type Props = {
  open: boolean;
  onClose: VoidFunction;
  /** Id (Guid) của hoá đơn cần in. */
  orderId: string | null;
};

export default function ReceiptPrintDialog({ open, onClose, orderId }: Props) {
  // Giữ id của lần mở gần nhất: nơi gọi thường đặt orderId về null khi đóng, mà nội dung phải còn đó
  // trong lúc hộp thoại mờ dần.
  const [shownId, setShownId] = useState(orderId);
  if (orderId && orderId !== shownId) setShownId(orderId);

  // Nội dung chỉ được dựng khi hộp thoại mở → mỗi lần mở (hay đổi hoá đơn) là một lần tải phiếu mới.
  return (
    <Dialog open={open && !!orderId} onClose={onClose} maxWidth="sm" fullWidth>
      {shownId && <ReceiptPrintContent key={shownId} orderId={shownId} onClose={onClose} />}
    </Dialog>
  );
}

// ----------------------------------------------------------------------

function ReceiptPrintContent({ orderId, onClose }: { orderId: string; onClose: VoidFunction }) {
  const { enqueueSnackbar } = useSnackbar();

  const [settings, setSettings] = useState<ReceiptPrintSettings>(loadReceiptSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  // Phiếu core-be trả về khi không chỉ định tài khoản, và phiếu đang xem (có thể kèm mã QR đã chọn).
  const [baseReceipt, setBaseReceipt] = useState<ISalesOrderReceipt | null>(null);
  const [receipt, setReceipt] = useState<ISalesOrderReceipt | null>(null);

  // Tài khoản nhận để người dùng chọn; rỗng = không cần / không có gì để chọn.
  const [accounts, setAccounts] = useState<IKiotVietBankAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountNote, setAccountNote] = useState<string | null>(null);
  const accountRequest = useRef(0);

  const printButtonRef = useRef<HTMLButtonElement>(null);

  // Mẫu in của cửa hàng: không tải được thì in bằng mẫu hệ thống như trước.
  const [templates, setTemplates] = useState<IPrintTemplateList | null>(null);
  const [templateChoice, setTemplateChoice] = useState(TEMPLATE_AUTO);
  const [templated, setTemplated] = useState<Awaited<
    ReturnType<typeof renderReceiptTemplate>
  > | null>(null);
  const [templating, setTemplating] = useState(false);

  useEffect(() => {
    let active = true;
    getPrintTemplates('receipt')
      .then((list) => {
        if (active) setTemplates(list);
      })
      .catch(() => {
        if (active) setTemplates(NO_TEMPLATES);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const base = await getSalesOrderReceipt(orderId);
        let current = base;
        let usable: IKiotVietBankAccount[] = [];
        let picked = '';

        if (needsTransferAccount(base)) {
          // Không lấy được danh sách tài khoản thì vẫn in được phiếu, chỉ thiếu mã QR
          usable = await getBankAccounts()
            .then(usableTransferAccounts)
            .catch(() => []);
          const remembered = loadReceiptSettings().bankAccountId;
          if (remembered && usable.some((account) => account.id === remembered)) {
            const withQr = await getSalesOrderReceipt(orderId, remembered).catch(() => null);
            if (withQr?.transferQr) {
              current = withQr;
              picked = remembered;
            }
          }
        }

        if (!active) return;
        setBaseReceipt(base);
        setReceipt(current);
        setAccounts(usable);
        setAccountId(picked);
        setAccountNote(null);
      } catch (loadError) {
        if (!active) return;
        setBaseReceipt(null);
        setReceipt(null);
        setError(receiptErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [orderId, reloadCount]);

  const changeSettings = (patch: Partial<ReceiptPrintSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveReceiptSettings(next);
  };

  const handlePickAccount = async (id: string) => {
    accountRequest.current += 1;
    const request = accountRequest.current;
    setAccountId(id);
    setAccountNote(null);
    changeSettings({ bankAccountId: id || null });

    if (!id) {
      setAccountLoading(false);
      setReceipt(baseReceipt);
      return;
    }

    setAccountLoading(true);
    try {
      const withQr = await getSalesOrderReceipt(orderId, id);
      if (request !== accountRequest.current) return;
      setReceipt(withQr);
      if (!withQr.transferQr) {
        setAccountNote('Tài khoản này không tạo được mã QR — phiếu sẽ in không có mã QR.');
      }
    } catch (pickError) {
      if (request !== accountRequest.current) return;
      setAccountId('');
      setReceipt(baseReceipt);
      enqueueSnackbar(receiptErrorMessage(pickError), { variant: 'error' });
    } finally {
      if (request === accountRequest.current) setAccountLoading(false);
    }
  };

  const { paperWidth } = settings;

  const appliedTemplate = useMemo(
    () =>
      receipt
        ? resolveAppliedTemplate(templates, 'receipt', receipt.channel, receipt.paymentMethod)
        : null,
    [templates, receipt]
  );
  const activeTemplate = useMemo(() => {
    if (templateChoice === TEMPLATE_AUTO) return appliedTemplate;
    if (templateChoice === TEMPLATE_SYSTEM) return null;
    return templates?.templates.find((template) => template.id === templateChoice) ?? null;
  }, [templateChoice, appliedTemplate, templates]);

  // Mẫu của cửa hàng: dựng bất đồng bộ (giấy cuộn phải đo chiều cao nội dung).
  useEffect(() => {
    if (!activeTemplate || !receipt) {
      setTemplated(null);
      setTemplating(false);
      return undefined;
    }
    let active = true;
    setTemplating(true);
    renderReceiptTemplate(activeTemplate, receipt)
      .then((result) => {
        if (active) setTemplated(result);
      })
      .catch((renderError) => {
        console.error(renderError);
        if (active) setTemplated(null);
      })
      .finally(() => {
        if (active) setTemplating(false);
      });
    return () => {
      active = false;
    };
  }, [activeTemplate, receipt]);

  const systemHtml = useMemo(
    () => (receipt && !activeTemplate ? renderReceiptHtml(receipt, { paperWidth }) : ''),
    [receipt, paperWidth, activeTemplate]
  );
  const systemPage = useMemo(
    () => (receipt && !activeTemplate ? receiptPageSizeMm(receipt, { paperWidth }) : null),
    [receipt, paperWidth, activeTemplate]
  );
  const html = activeTemplate ? (templated?.html ?? '') : systemHtml;
  const page = activeTemplate ? (templated?.page ?? null) : systemPage;
  const templatePaperLabel = activeTemplate
    ? RECEIPT_TEMPLATE_PAPERS[normalizeReceiptSettings(activeTemplate.settings).paper].label
    : null;

  const canPrint = !!html && !loading && !accountLoading && templates !== null && !templating;

  // Phiếu sẵn sàng → nút In nhận focus để thu ngân chỉ cần nhấn Enter.
  useEffect(() => {
    if (canPrint) printButtonRef.current?.focus();
  }, [canPrint]);

  const handlePrint = () => {
    if (!canPrint) return;
    printHtmlDocument(html).catch((printError) => {
      console.error(printError);
      enqueueSnackbar('Không mở được hộp thoại in của trình duyệt', { variant: 'error' });
    });
  };

  const previewTitle = 'Xem trước phiếu thanh toán';

  return (
    <>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {receipt ? `In hoá đơn ${receipt.invoice.code}` : 'In hoá đơn'}
        <IconButton onClick={onClose} size="small" aria-label="Đóng hộp thoại">
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {(templates?.templates.length ?? 0) > 0 && (
            <TextField
              select
              size="small"
              label="Mẫu in"
              value={templateChoice}
              onChange={(event) => setTemplateChoice(event.target.value)}
            >
              <MenuItem value={TEMPLATE_AUTO}>
                Theo cài đặt cửa hàng ({appliedTemplate ? appliedTemplate.name : 'Mẫu hệ thống'})
              </MenuItem>
              <MenuItem value={TEMPLATE_SYSTEM}>Mẫu hệ thống</MenuItem>
              {(templates?.templates ?? []).map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name}
                </MenuItem>
              ))}
            </TextField>
          )}

          {templatePaperLabel ? (
            <Typography variant="body2" color="text.secondary">
              Khổ giấy theo mẫu: <strong>{templatePaperLabel}</strong>
            </Typography>
          ) : (
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="subtitle2" id="receipt-paper-width-label">
                Khổ giấy
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                color="primary"
                value={paperWidth}
                aria-labelledby="receipt-paper-width-label"
                onChange={(_, value: ReceiptPaperWidth | null) => {
                  if (value) changeSettings({ paperWidth: value });
                }}
              >
                {RECEIPT_PAPER_WIDTHS.map((width) => (
                  <ToggleButton key={width} value={width} sx={{ px: 2 }}>
                    {width} mm
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>
          )}

          {(loading || (!!receipt && (templates === null || templating) && !page)) && (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress size={28} aria-label="Đang tải phiếu thanh toán" />
            </Stack>
          )}

          {!loading && error && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => setReloadCount((n) => n + 1)}>
                  Thử lại
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {!loading && receipt && accounts.length > 0 && (
            <Stack spacing={1}>
              <TextField
                select
                size="small"
                label="Tài khoản nhận chuyển khoản"
                value={accountId}
                onChange={(event) => handlePickAccount(event.target.value)}
                helperText={`Hoá đơn còn ${formatReceiptMoney(receipt.totals.remaining)} chưa trả — chọn tài khoản để in kèm mã QR chuyển khoản.`}
                SelectProps={{ displayEmpty: true }}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value="">Không in mã QR</MenuItem>
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {transferAccountLabel(account)}
                  </MenuItem>
                ))}
              </TextField>
              {accountNote && <Alert severity="warning">{accountNote}</Alert>}
            </Stack>
          )}

          {!loading && receipt && page && (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  overflow: 'auto',
                  maxHeight: PREVIEW_MAX_HEIGHT_PX,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.neutral',
                }}
              >
                <Box
                  sx={{
                    flexShrink: 0,
                    width: page.widthMm * PX_PER_MM * PREVIEW_SCALE,
                    height: page.heightMm * PX_PER_MM * PREVIEW_SCALE,
                    overflow: 'hidden',
                  }}
                >
                  <iframe
                    title={previewTitle}
                    sandbox=""
                    srcDoc={html}
                    style={{
                      display: 'block',
                      border: 0,
                      width: `${page.widthMm}mm`,
                      height: `${page.heightMm}mm`,
                      transform: `scale(${PREVIEW_SCALE})`,
                      transformOrigin: '0 0',
                    }}
                  />
                </Box>
              </Box>
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 1, color: 'text.secondary' }}
              >
                Trang in {page.widthMm} × {page.heightMm} mm (phần trống cuối trang là khoảng dự
                phòng). Trong hộp thoại in: chọn máy in hoá đơn, Lề: Không có, Tỉ lệ: 100%, bỏ chọn
                “Đầu trang và chân trang”.
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Đóng
        </Button>
        <Button
          ref={printButtonRef}
          variant="contained"
          onClick={handlePrint}
          disabled={!canPrint}
          startIcon={<Iconify icon="solar:printer-minimalistic-bold" />}
        >
          In hoá đơn
        </Button>
      </DialogActions>
    </>
  );
}
