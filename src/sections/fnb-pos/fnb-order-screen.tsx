'use client';

import type { IFnbMenu, IFnbFloor, IOrderLine, IOpenOrder, IFnbMenuDish, IKitchenTicket } from 'src/types/fnb';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardActionArea from '@mui/material/CardActionArea';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { fCurrency } from 'src/utils/format-number';
import { printHtmlDocument } from 'src/utils/print-html';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import CustomPopover, { usePopover } from 'src/components/custom-popover';

import ReceiptPrintDialog from 'src/sections/pos/receipt-print/receipt-print-dialog';

import { getFnbOrder, runFnbCommand } from 'src/api/fnb';

import { newId, currentDeviceId } from './lib/ids';
import { readProblem } from './lib/errors';
import { checkoutPlan } from './lib/checkout';
import FnbCheckoutDialog from './fnb-checkout-dialog';
import { billHtml, kitchenTicketHtml } from './lib/print';
import { FnbDishDialog, FnbOpenItemDialog } from './fnb-dish-dialog';
import { addDraft, itemDraft, draftTotal, draftAmount, setDraftQty, toLineInput } from './lib/draft';
import { filterDishes, defaultVariant, dishNeedsOptions, sortedCategories } from './lib/menu';
import { FnbMoveDialog, FnbVoidDialog, FnbCancelDialog, FnbDiscountDialog } from './fnb-order-actions';
import {
  roundsOf,
  lineTitle,
  billOutdated,
  pendingLines,
  voidableLines,
  moveSelection,
  voidSelection,
} from './lib/order-view';
import {
  billCmd,
  sendCmd,
  voidCmd,
  moveCmd,
  cancelCmd,
  addLinesCmd,
  checkoutCmd,
  discountCmd,
  openOrderCmd,
  printResultCmd,
  removePendingLineCmd,
} from './lib/commands';

import type { DraftLine } from './lib/draft';
import type { MoveOption } from './lib/floor';
import type { PaymentInput } from './lib/checkout';
import type { FnbCommand } from './lib/commands';

// ----------------------------------------------------------------------
// Màn gọi món F&B trên web (hợp đồng API v1, mục 5): thực đơn bên trái, đơn bên phải.
//   - Món đang chọn (draft) chỉ nằm trên trình duyệt tới khi "Gửi bar": mở đơn (nếu mới) → thêm dòng + gửi bar một phiếu.
//   - Lệnh có kiểm phiên bản (huỷ món, chuyển, giảm giá, tạm tính, thanh toán, huỷ đơn) gửi baseVersion của bản đang
//     hiện; máy chủ trả 409 kèm đơn mới nhất thì thay đơn và báo người dùng làm lại.
//   - Đơn được làm mới mỗi 8 giây (máy khác cùng gọi món vào bàn này).
// ----------------------------------------------------------------------

export type OrderTarget = {
  orderId: string;
  isNew: boolean;
  tableId: string | null;
  tableName: string | null;
  areaName: string | null;
  /** Mở thêm đơn ở bàn đang có đơn (tách bàn). */
  allowSharedTable?: boolean;
};

type Props = {
  branchId: string;
  storeName: string | null;
  menu: IFnbMenu | null;
  floor: IFnbFloor | null;
  target: OrderTarget;
  onBack: VoidFunction;
  /** Sau chuyển món: mở đơn đích. */
  onOpenOrder: (target: OrderTarget) => void;
  onChanged: VoidFunction;
};

const AUTO_PRINT_KEY = 'fnb.autoPrintTickets';
const REFRESH_MS = 8_000;

export default function FnbOrderScreen({ branchId, storeName, menu, floor, target, onBack, onOpenOrder, onChanged }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const more = usePopover();

  const [order, setOrder] = useState<IOpenOrder | null>(null);
  const [drafts, setDrafts] = useState<DraftLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [dish, setDish] = useState<IFnbMenuDish | null>(null);
  const [dialog, setDialog] = useState<null | 'openItem' | 'checkout' | 'void' | 'move' | 'discount' | 'cancel'>(null);
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  const [autoPrint, setAutoPrint] = useState(true);

  const ctx = useMemo(() => ({ deviceId: currentDeviceId() }), []);

  useEffect(() => {
    try {
      setAutoPrint(window.localStorage.getItem(AUTO_PRINT_KEY) !== '0');
    } catch {
      // giữ mặc định
    }
  }, []);

  // Đơn có sẵn: tải từ máy chủ; đơn mới: chưa có gì cho tới lượt gửi đầu tiên.
  useEffect(() => {
    setDrafts([]);
    setOrder(null);
    if (target.isNew) return;
    getFnbOrder(target.orderId)
      .then(setOrder)
      .catch(() => enqueueSnackbar('Không tải được đơn', { variant: 'error' }));
  }, [target, enqueueSnackbar]);

  // Làm mới định kỳ — chỉ nhận bản mới hơn.
  useEffect(() => {
    if (!order || order.status !== 'Open') return undefined;
    const timer = setInterval(() => {
      if (busy || dialog) return;
      getFnbOrder(order.id)
        .then((fresh) => setOrder((cur) => (cur && fresh.version >= cur.version ? fresh : cur)))
        .catch(() => {});
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [order, busy, dialog]);

  // ---------- Gửi lệnh ----------

  const run = useCallback(
    async (command: FnbCommand) => {
      try {
        const result = await runFnbCommand(command);
        setOrder(result.order);
        return result;
      } catch (error) {
        const problem = readProblem(error);
        if (problem.order) setOrder(problem.order);
        enqueueSnackbar(problem.title ?? 'Có lỗi xảy ra — thử lại', { variant: 'error' });
        return null;
      }
    },
    [enqueueSnackbar]
  );

  const printTicket = useCallback(
    async (ticket: IKitchenTicket | null) => {
      if (!ticket) return;
      if (!autoPrint) {
        // Máy này không in: báo "bỏ qua" ngay để Máy in phiếu của chi nhánh nhận in, không phải chờ 30 giây.
        await runFnbCommand(printResultCmd({ ...ctx, deviceName: 'Web' }, ticket.id, { result: 'Skipped' })).catch(() => {});
        return;
      }
      try {
        await printHtmlDocument(kitchenTicketHtml(ticket));
        await runFnbCommand(printResultCmd({ ...ctx, deviceName: 'Web' }, ticket.id, { result: 'Printed' }));
      } catch {
        enqueueSnackbar('Không in được phiếu bar — in lại từ máy khác hoặc bấm in lại.', { variant: 'warning' });
      }
    },
    [autoPrint, ctx, enqueueSnackbar]
  );

  /** Đơn mới: mở trên máy chủ lần đầu (id do máy sinh — mở lại cùng id trả về cùng đơn). */
  const ensureOpened = useCallback(async (): Promise<IOpenOrder | null> => {
    if (order) return order;
    const result = await run(
      openOrderCmd(ctx, {
        orderId: target.orderId,
        branchId,
        tableId: target.tableId,
        allowSharedTable: target.allowSharedTable,
      })
    );
    return result?.order ?? null;
  }, [order, run, ctx, target, branchId]);

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const sendDrafts = () =>
    withBusy(async () => {
      const opened = await ensureOpened();
      if (!opened) return;
      if (drafts.length > 0) {
        const result = await run(addLinesCmd(ctx, opened.id, drafts.map(toLineInput), newId()));
        if (!result) return;
        setDrafts([]);
        await printTicket(result.ticket);
      } else if (pendingLines(opened).length > 0) {
        const result = await run(sendCmd(ctx, opened.id, newId()));
        if (result) await printTicket(result.ticket);
      }
    });

  const bill = () =>
    withBusy(async () => {
      if (!order) return;
      const result = await run(billCmd(ctx, order));
      if (result) await printHtmlDocument(billHtml(result.order, storeName)).catch(() => {});
    });

  const pay = (payment: PaymentInput) =>
    withBusy(async () => {
      let current = await ensureOpened();
      if (!current) return;
      if (drafts.length > 0) {
        // Món đang chọn vào đơn trước (chưa gửi), thanh toán gửi bar luôn trong cùng lệnh.
        const added = await run(addLinesCmd(ctx, current.id, drafts.map(toLineInput), null));
        if (!added) return;
        setDrafts([]);
        current = added.order;
      }
      const total = current.totals.total;
      const plan = checkoutPlan(total, payment);
      const result = await run(
        checkoutCmd(ctx, current, {
          expectedTotal: total,
          payments: plan.payments,
          cashTendered: plan.cashTendered,
          sendPending: pendingLines(current).length > 0,
        })
      );
      if (!result) return;
      setDialog(null);
      await printTicket(result.ticket);
      enqueueSnackbar(`Đã thanh toán đơn ${result.order.displayNo}`);
      if (result.order.payment?.salesOrderId) setReceiptOrderId(result.order.payment.salesOrderId);
      else onBack();
    });

  const voidLines = (sel: Record<string, number>, reason: string, alreadyMade: boolean) =>
    withBusy(async () => {
      if (!order) return;
      const result = await run(voidCmd(ctx, order, { reason, alreadyMade, lines: voidSelection(order, sel) }));
      if (!result) return;
      setDialog(null);
      await printTicket(result.ticket);
    });

  const move = (sel: Record<string, number>, option: MoveOption) =>
    withBusy(async () => {
      if (!order) return;
      const targetOrder =
        option.kind === 'existing'
          ? ({ kind: 'existing', orderId: option.orderId } as const)
          : ({ kind: 'create', orderId: newId(), tableId: option.tableId } as const);
      const result = await run(moveCmd(ctx, order, targetOrder, moveSelection(order, sel)));
      if (!result) return;
      setDialog(null);
      enqueueSnackbar('Đã chuyển món');
      if (result.order.status !== 'Open' && result.otherOrder) {
        onOpenOrder({
          orderId: result.otherOrder.id,
          isNew: false,
          tableId: result.otherOrder.tableId,
          tableName: result.otherOrder.tableName,
          areaName: result.otherOrder.areaName,
        });
      }
    });

  const discount = (type: 'Percent' | 'Amount' | null, value: number, reason: string) =>
    withBusy(async () => {
      if (!order) return;
      if (await run(discountCmd(ctx, order, { type, value, reason }))) setDialog(null);
    });

  const cancel = (reason: string, alreadyMade: boolean) =>
    withBusy(async () => {
      if (!order) {
        onBack();
        return;
      }
      const result = await run(
        cancelCmd(ctx, order, { hasSentLines: voidableLines(order).length > 0, reason, alreadyMade })
      );
      if (!result) return;
      setDialog(null);
      await printTicket(result.ticket);
      enqueueSnackbar(`Đã huỷ đơn ${order.displayNo}`);
      onBack();
    });

  const removePending = (line: IOrderLine) =>
    withBusy(async () => {
      if (order) await run(removePendingLineCmd(ctx, order.id, line));
    });

  // ---------- Thực đơn ----------

  const categories = useMemo(() => sortedCategories(menu), [menu]);
  const dishes = useMemo(() => filterDishes(menu, { categoryId, keyword }), [menu, categoryId, keyword]);

  const pickDish = (d: IFnbMenuDish) => {
    if (d.isSoldOut) return;
    if (dishNeedsOptions(menu, d)) {
      setDish(d);
      return;
    }
    const variant = defaultVariant(d);
    if (variant) setDrafts((prev) => addDraft(prev, itemDraft(d, variant)));
  };

  // ---------- Hiển thị ----------

  const isOpen = !order || order.status === 'Open';
  const rounds = roundsOf(order);
  const pending = pendingLines(order);
  const orderTotal = order?.totals.total ?? 0;
  const total = orderTotal + draftTotal(drafts);
  const place = target.tableName ? `${target.areaName ? `${target.areaName} · ` : ''}${target.tableName}` : 'Mang về';
  const canSend = isOpen && (drafts.length > 0 || pending.length > 0);
  const hasActive = (order?.totals.itemCount ?? 0) > 0 || drafts.length > 0;

  return (
    <Grid container spacing={2}>
      {/* Thực đơn */}
      <Grid item xs={12} md={7}>
        <Card sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <TextField
              size="small"
              placeholder="Tìm món (không cần dấu)…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" />
                  </InputAdornment>
                ),
              }}
            />
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
              <Chip label="Tất cả" color={!categoryId ? 'primary' : 'default'} onClick={() => setCategoryId(null)} />
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  color={categoryId === c.id ? 'primary' : 'default'}
                  onClick={() => setCategoryId(c.id)}
                />
              ))}
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                maxHeight: 'calc(100vh - 300px)',
                overflowY: 'auto',
              }}
            >
              {dishes.map((d) => (
                <Card key={d.id} variant="outlined" sx={{ opacity: d.isSoldOut ? 0.45 : 1 }}>
                  <CardActionArea disabled={!isOpen || d.isSoldOut} onClick={() => pickDish(d)} sx={{ p: 1.5, height: '100%' }}>
                    <Typography variant="subtitle2" sx={{ minHeight: 40 }}>
                      {d.name}
                    </Typography>
                    <Typography variant="body2" color={d.isSoldOut ? 'error.main' : 'text.secondary'}>
                      {d.isSoldOut ? 'Hết món' : fCurrency(d.priceFrom)}
                    </Typography>
                  </CardActionArea>
                </Card>
              ))}
              {menu && dishes.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  Không có món phù hợp.
                </Typography>
              )}
            </Box>
          </Stack>
        </Card>
      </Grid>

      {/* Đơn */}
      <Grid item xs={12} md={5}>
        <Card sx={{ p: 2, position: { md: 'sticky' }, top: { md: 16 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <IconButton onClick={onBack}>
              <Iconify icon="eva:arrow-ios-back-fill" />
            </IconButton>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">{place}</Typography>
              <Typography variant="caption" color="text.secondary">
                {order ? `Đơn ${order.displayNo} · ${order.openedByName}` : 'Đơn mới'}
              </Typography>
            </Box>
            <IconButton onClick={more.onOpen} disabled={busy}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </Stack>

          {order && order.status !== 'Open' && (
            <Alert severity="info" sx={{ mb: 1 }}>
              Đơn đã {order.status === 'Paid' ? 'thanh toán' : order.status === 'Cancelled' ? 'huỷ' : 'chuyển'}.
            </Alert>
          )}
          {billOutdated(order) && (
            <Alert severity="warning" sx={{ mb: 1 }}>
              Tổng tiền đã đổi sau lần in tạm tính.
            </Alert>
          )}

          <Box sx={{ maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
            {rounds.map((round) => (
              <Box key={round.ticketId} sx={{ mb: 1 }}>
                <Typography variant="overline" color="text.secondary">
                  Lượt {round.no}
                </Typography>
                {round.lines.map((l) => (
                  <LineRow key={l.id} line={l} />
                ))}
              </Box>
            ))}

            {pending.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="overline" color="warning.main">
                  Chưa gửi bar (từ máy khác)
                </Typography>
                {pending.map((l) => (
                  <LineRow key={l.id} line={l} onRemove={isOpen ? () => removePending(l) : undefined} />
                ))}
              </Box>
            )}

            {drafts.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="overline" color="primary.main">
                  Đang chọn
                </Typography>
                {drafts.map((d) => (
                  <Stack key={d.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>
                        {lineTitle(d)}
                      </Typography>
                      <DraftDetails line={d} />
                    </Box>
                    <IconButton size="small" onClick={() => setDrafts((p) => setDraftQty(p, d.id, d.quantity - 1))}>
                      <Iconify icon="eva:minus-fill" width={16} />
                    </IconButton>
                    <Typography variant="body2" sx={{ minWidth: 18, textAlign: 'center' }}>
                      {d.quantity}
                    </Typography>
                    <IconButton size="small" onClick={() => setDrafts((p) => setDraftQty(p, d.id, d.quantity + 1))}>
                      <Iconify icon="eva:plus-fill" width={16} />
                    </IconButton>
                    <Typography variant="body2" sx={{ minWidth: 72, textAlign: 'right' }}>
                      {fCurrency(draftAmount(d))}
                    </Typography>
                  </Stack>
                ))}
              </Box>
            )}

            {!order && drafts.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                Chọn món ở thực đơn bên trái.
              </Typography>
            )}
          </Box>

          <Divider sx={{ my: 1.5 }} />

          {order && order.totals.discountAmount > 0 && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2">Giảm giá</Typography>
              <Typography variant="body2">-{fCurrency(order.totals.discountAmount)}</Typography>
            </Stack>
          )}
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1">Tổng</Typography>
            <Typography variant="h6" color="primary.main">
              {fCurrency(total)}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            <LoadingButton fullWidth variant="contained" loading={busy} disabled={!canSend} onClick={sendDrafts}>
              Gửi bar{drafts.length > 0 ? ` (${drafts.reduce((s, d) => s + d.quantity, 0)})` : ''}
            </LoadingButton>
            <Button fullWidth variant="outlined" disabled={busy || !order || !isOpen || (order?.totals.itemCount ?? 0) === 0} onClick={bill}>
              Tạm tính
            </Button>
            <Button
              fullWidth
              variant="contained"
              color="success"
              disabled={busy || !isOpen || !hasActive}
              onClick={() => setDialog('checkout')}
            >
              Thanh toán
            </Button>
          </Stack>
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Switch
                size="small"
                checked={autoPrint}
                onChange={(e) => {
                  setAutoPrint(e.target.checked);
                  try {
                    window.localStorage.setItem(AUTO_PRINT_KEY, e.target.checked ? '1' : '0');
                  } catch {
                    // bỏ qua
                  }
                }}
              />
            }
            label={
              <Typography variant="caption">
                In phiếu bar tại máy này (tắt nếu quầy bar đã có Máy in phiếu)
              </Typography>
            }
          />
        </Card>
      </Grid>

      <CustomPopover open={more.open} onClose={more.onClose} arrow="right-top" sx={{ width: 220 }}>
        <MenuItem
          disabled={!isOpen}
          onClick={() => {
            more.onClose();
            setDialog('openItem');
          }}
        >
          <Iconify icon="mingcute:add-line" /> Món khác
        </MenuItem>
        <MenuItem
          disabled={!order || !isOpen || (order?.totals.itemCount ?? 0) === 0}
          onClick={() => {
            more.onClose();
            setDialog('move');
          }}
        >
          <Iconify icon="solar:transfer-horizontal-bold" /> Chuyển món / bàn
        </MenuItem>
        <MenuItem
          disabled={!order || !isOpen || voidableLines(order).length === 0}
          onClick={() => {
            more.onClose();
            setDialog('void');
          }}
        >
          <Iconify icon="solar:close-circle-bold" /> Huỷ món đã gửi
        </MenuItem>
        <MenuItem
          disabled={!order || !isOpen || (order?.totals.subtotal ?? 0) === 0}
          onClick={() => {
            more.onClose();
            setDialog('discount');
          }}
        >
          <Iconify icon="solar:tag-price-bold" /> Giảm giá
        </MenuItem>
        <MenuItem
          disabled={!isOpen}
          sx={{ color: 'error.main' }}
          onClick={() => {
            more.onClose();
            if (!order) {
              setDrafts([]);
              onBack();
            } else setDialog('cancel');
          }}
        >
          <Iconify icon="solar:trash-bin-trash-bold" /> Huỷ đơn
        </MenuItem>
      </CustomPopover>

      <FnbDishDialog open={!!dish} menu={menu} dish={dish} onClose={() => setDish(null)} onAdd={(l) => setDrafts((p) => addDraft(p, l))} />
      <FnbOpenItemDialog open={dialog === 'openItem'} onClose={() => setDialog(null)} onAdd={(l) => setDrafts((p) => [...p, l])} />
      <FnbCheckoutDialog
        open={dialog === 'checkout'}
        order={order}
        total={total}
        hasDrafts={drafts.length > 0}
        busy={busy}
        onClose={() => setDialog(null)}
        onPay={pay}
      />
      <FnbVoidDialog open={dialog === 'void'} order={order} busy={busy} onClose={() => setDialog(null)} onConfirm={voidLines} />
      <FnbMoveDialog
        open={dialog === 'move'}
        order={order}
        floor={floor}
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={move}
      />
      <FnbDiscountDialog
        open={dialog === 'discount'}
        order={order}
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={discount}
      />
      <FnbCancelDialog open={dialog === 'cancel'} order={order} busy={busy} onClose={() => setDialog(null)} onConfirm={cancel} />

      {receiptOrderId && (
        <ReceiptPrintDialog
          open
          orderId={receiptOrderId}
          onClose={() => {
            setReceiptOrderId(null);
            onBack();
          }}
        />
      )}
    </Grid>
  );
}

// ----------------------------------------------------------------------

function DraftDetails({ line }: { line: Pick<DraftLine, 'toppings' | 'quickNotes' | 'note'> }) {
  const parts = [
    ...line.toppings.map((t) => `+${t.name}${t.quantity > 1 ? ` x${t.quantity}` : ''}`),
    ...line.quickNotes,
    ...(line.note ? [line.note] : []),
  ];
  if (parts.length === 0) return null;
  return (
    <Typography variant="caption" color="text.secondary" display="block" noWrap>
      {parts.join(' · ')}
    </Typography>
  );
}

function LineRow({ line, onRemove }: { line: IOrderLine; onRemove?: VoidFunction }) {
  const voided = line.status === 'Voided' || line.quantity === 0;
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.5, opacity: voided ? 0.5 : 1 }}>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ textDecoration: voided ? 'line-through' : 'none' }}>
          {lineTitle(line)}
        </Typography>
        <DraftDetails line={line} />
        {line.voidedQuantity > 0 && (
          <Typography variant="caption" color="error.main" display="block">
            Đã huỷ {line.voidedQuantity}
          </Typography>
        )}
      </Box>
      <Typography variant="body2">x{line.quantity}</Typography>
      <Typography variant="body2" sx={{ minWidth: 72, textAlign: 'right' }}>
        {fCurrency(line.amount)}
      </Typography>
      {onRemove && (
        <IconButton size="small" color="error" onClick={onRemove}>
          <Iconify icon="solar:trash-bin-trash-bold" width={16} />
        </IconButton>
      )}
    </Stack>
  );
}
