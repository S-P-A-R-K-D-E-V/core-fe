'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { markOnlineOrderPaid } from 'src/api/online-orders';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import { fVnd, CONVERSATION_ORDER_STATUS } from 'src/lib/inbox';
import { rejectAgentAction, approveAgentAction } from 'src/api/agent-actions';
import { useConversationOrder, confirmConversationOrder, discardConversationOrder } from 'src/api/inbox';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';

import InboxOrderDialog from './inbox-order-dialog';

// ----------------------------------------------------------------------
// Thẻ đơn của hội thoại (F4) ở cột khách: đơn nháp (agent hoặc nhân viên lên) → Sửa / Bỏ / Chốt; agent đã xin chốt → Chốt (=
// duyệt phiếu) / Từ chối (lý do để agent báo khách); chờ thanh toán → mã QR đã gửi, hạn, "Đã nhận tiền"; đã trả → hoá đơn, mã
// vận đơn. Chốt = máy chủ gửi tóm tắt đơn + QR (hoặc tin giữ hàng) vào chat.
// ----------------------------------------------------------------------

type Props = {
  conversationId: string;
  /** Hội thoại bình luận: không lên đơn (nhắn riêng rồi lên đơn trong tin nhắn). */
  isComment: boolean;
  customerAddress?: string | null;
};

export default function InboxOrderCard({ conversationId, isComment, customerAddress }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const canOrder = hasPermission(user, PERMISSIONS.conversation.order);
  const canApprove = hasPermission(user, PERMISSIONS.agent.approve);
  const { order, orderLoading, mutateOrder } = useConversationOrder(conversationId);

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [paying, setPaying] = useState(false);
  const [payMethod, setPayMethod] = useState<'transfer' | 'cash'>('transfer');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, ok: string, fail: string) => {
    setBusy(true);
    try {
      await action();
      enqueueSnackbar(ok);
      await mutateOrder();
      return true;
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, fail), { variant: 'error' });
      await mutateOrder();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!order) return;
    const done = await run(
      () => (order.pendingActionId ? approveAgentAction(order.pendingActionId) : confirmConversationOrder(conversationId, order.id)),
      'Đã chốt đơn — mã thanh toán / tin xác nhận đã gửi khách',
      'Không chốt được đơn'
    );
    if (done) setConfirming(false);
  };

  const handleReject = async () => {
    if (!order?.pendingActionId || !rejectNote.trim()) return;
    const done = await run(
      () => rejectAgentAction(order.pendingActionId!, rejectNote.trim()),
      'Đã từ chối — agent sẽ báo khách theo lý do',
      'Không từ chối được'
    );
    if (done) {
      setRejecting(false);
      setRejectNote('');
    }
  };

  const handleDiscard = async () => {
    const done = await run(() => discardConversationOrder(conversationId), 'Đã bỏ đơn nháp', 'Không bỏ được đơn nháp');
    if (done) setDiscarding(false);
  };

  const handlePaid = async () => {
    if (!order) return;
    const done = await run(() => markOnlineOrderPaid(order.id, payMethod), 'Đã ghi nhận tiền — đã tạo hoá đơn', 'Không ghi nhận được');
    if (done) setPaying(false);
  };

  const status = order ? CONVERSATION_ORDER_STATUS[order.status] : null;
  const canCreate = canOrder && !isComment && (!order || order.status !== 'draft');

  return (
    <Card variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Iconify icon="solar:cart-large-2-bold" width={18} sx={{ color: 'text.secondary' }} />
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Đơn trong hội thoại
        </Typography>
        {status && (
          <Label color={status.color} variant="soft">
            {status.label}
          </Label>
        )}
      </Stack>

      {orderLoading && !order && (
        <Typography variant="body2" sx={{ color: 'text.disabled', mt: 1 }}>
          Đang tải…
        </Typography>
      )}

      {!orderLoading && !order && (
        <Typography variant="body2" sx={{ color: 'text.disabled', mt: 1 }}>
          {isComment ? 'Bình luận: nhắn riêng cho khách rồi lên đơn trong tin nhắn.' : 'Chưa có đơn.'}
        </Typography>
      )}

      {order && (
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle2">{order.code}</Typography>
            {order.draftedByAgent && (
              <Label color="info" variant="soft" startIcon={<Iconify icon="mdi:robot-outline" />}>
                Agent lên
              </Label>
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {order.delivery === 'pickup' ? 'Nhận tại cửa hàng' : 'Giao tận nơi'} ·{' '}
              {order.payment === 'pay_at_store' ? 'trả tại quầy' : 'chuyển khoản'}
            </Typography>
          </Stack>

          {order.lines.map((l) => (
            <Stack key={l.productId} direction="row" spacing={1} alignItems="center">
              <Avatar variant="rounded" src={l.imageUrl ?? undefined} sx={{ width: 32, height: 32 }}>
                <Iconify icon="solar:box-bold" width={16} />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {l.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {l.quantity} × {fVnd(l.price)}
                </Typography>
              </Box>
              <Typography variant="body2">{fVnd(l.amount)}</Typography>
            </Stack>
          ))}

          {order.delivery === 'ship' && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {order.address}
              {order.carrier ? ` · ${order.carrier}` : ''} · ship{' '}
              {order.shippingFee > 0 ? fVnd(order.shippingFee) : 'miễn phí'}
              {order.shippingFeeOverridden ? ' (đặt tay)' : ''}
            </Typography>
          )}
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="subtitle2">Tổng</Typography>
            <Typography variant="subtitle2">{fVnd(order.total)}</Typography>
          </Stack>
          {order.note && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Ghi chú: {order.note}
            </Typography>
          )}

          {order.status === 'draft' && order.pendingActionId && (
            <Typography variant="caption" sx={{ color: 'warning.main' }}>
              Agent đã xin chốt — khách đang chờ shop xác nhận.
            </Typography>
          )}

          {order.status === 'pending_payment' && order.payment === 'transfer' && (
            <Stack direction="row" spacing={1} alignItems="center">
              {order.qrImageUrl && (
                <Box component="img" src={order.qrImageUrl} alt="Mã QR" sx={{ width: 64, height: 64, borderRadius: 1 }} />
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Đã gửi mã QR{order.paymentCode ? ` · nội dung ${order.paymentCode}` : ''}
                {order.accountNumber ? ` · ${order.bankName ?? ''} ${order.accountNumber}` : ''}
                {order.paymentExpiresAt ? ` · QR tới ${fDateTime(order.paymentExpiresAt)}` : ''}
              </Typography>
            </Stack>
          )}
          {order.status === 'pending_payment' && order.payment === 'pay_at_store' && order.holdUntil && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Giữ hàng tới {fDateTime(order.holdUntil)} — khách trả tại quầy.
            </Typography>
          )}
          {order.status === 'paid' && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Đã thanh toán{order.paidAt ? ` ${fDateTime(order.paidAt)}` : ''}
              {order.salesOrderCode ? ` · hoá đơn ${order.salesOrderCode}` : ''}
              {order.trackingCode ? ` · vận đơn ${order.trackingCode}` : ''}
            </Typography>
          )}

          {order.status === 'draft' && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {(order.pendingActionId ? canApprove : canOrder) && (
                <Button size="small" variant="contained" disabled={busy} onClick={() => setConfirming(true)}>
                  Chốt đơn
                </Button>
              )}
              {order.pendingActionId && canApprove && (
                <Button size="small" color="error" variant="outlined" disabled={busy} onClick={() => setRejecting(true)}>
                  Từ chối
                </Button>
              )}
              {canOrder && (
                <Button size="small" variant="outlined" disabled={busy} onClick={() => setEditing(true)}>
                  Sửa
                </Button>
              )}
              {canOrder && (
                <Button size="small" color="inherit" disabled={busy} onClick={() => setDiscarding(true)}>
                  Bỏ nháp
                </Button>
              )}
            </Stack>
          )}
          {order.status === 'pending_payment' && canOrder && (
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              startIcon={<Iconify icon="solar:wallet-money-bold" />}
              onClick={() => {
                setPayMethod(order.payment === 'pay_at_store' ? 'cash' : 'transfer');
                setPaying(true);
              }}
            >
              Đã nhận tiền
            </Button>
          )}
        </Stack>
      )}

      {canCreate && (
        <Button
          fullWidth
          variant="outlined"
          startIcon={<Iconify icon="mingcute:add-line" />}
          sx={{ mt: 1.5 }}
          onClick={() => setEditing(true)}
        >
          Lên đơn cho khách
        </Button>
      )}

      <InboxOrderDialog
        open={editing}
        conversationId={conversationId}
        draft={order?.status === 'draft' ? order : null}
        customerAddress={customerAddress}
        onClose={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false);
          enqueueSnackbar('Đã lưu đơn nháp');
          await mutateOrder();
        }}
      />

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Chốt đơn ${order?.code ?? ''}?`}
        content={
          order?.payment === 'pay_at_store'
            ? 'Hệ thống gửi khách tin xác nhận đơn + giữ hàng tới hạn để khách tới trả tại quầy.'
            : `Hệ thống tạo mã QR chuyển khoản ${order ? fVnd(order.total) : ''} và gửi khách cùng tóm tắt đơn. Giá / phí ship được tính lại lúc chốt.`
        }
        action={
          <LoadingButton variant="contained" loading={busy} onClick={handleConfirm}>
            Chốt đơn
          </LoadingButton>
        }
      />

      <ConfirmDialog
        open={discarding}
        onClose={() => setDiscarding(false)}
        title="Bỏ đơn nháp?"
        content="Đơn nháp bị xoá (chưa gửi khách gì)."
        action={
          <LoadingButton variant="contained" color="error" loading={busy} onClick={handleDiscard}>
            Bỏ nháp
          </LoadingButton>
        }
      />

      <Dialog open={rejecting} onClose={busy ? undefined : () => setRejecting(false)} fullWidth maxWidth="xs">
        <DialogTitle>Từ chối chốt đơn</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Lý do (agent dùng để báo khách)"
            placeholder="Vd: mẫu hồng hết hàng, gợi ý khách màu xanh"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejecting(false)} disabled={busy}>
            Huỷ
          </Button>
          <LoadingButton variant="contained" color="error" loading={busy} disabled={!rejectNote.trim()} onClick={handleReject}>
            Từ chối
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <Dialog open={paying} onClose={busy ? undefined : () => setPaying(false)} fullWidth maxWidth="xs">
        <DialogTitle>Đã nhận tiền đơn {order?.code}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Chỉ bấm khi đã thấy {order ? fVnd(order.total) : ''} về tài khoản hoặc đã cầm tiền — ảnh chuyển khoản khách gửi không
            phải căn cứ. Hệ thống tạo hoá đơn và báo gói hàng.
          </Typography>
          <TextField
            select
            fullWidth
            size="small"
            label="Cách nhận"
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value as 'transfer' | 'cash')}
          >
            <MenuItem value="transfer">Chuyển khoản (đã về tài khoản)</MenuItem>
            <MenuItem value="cash">Tiền mặt tại quầy</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaying(false)} disabled={busy}>
            Huỷ
          </Button>
          <LoadingButton variant="contained" loading={busy} onClick={handlePaid}>
            Xác nhận đã nhận
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
