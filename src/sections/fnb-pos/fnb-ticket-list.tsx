'use client';

import type { IKitchenTicket } from 'src/types/fnb';

import { useState, useEffect, useCallback } from 'react';

import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { printHtmlDocument } from 'src/utils/print-html';

import { useSnackbar } from 'src/components/snackbar';

import { getKitchenTickets, claimTicketPrint, reportTicketPrint } from 'src/api/fnb';

import { currentDeviceId } from './lib/ids';
import { kitchenTicketHtml } from './lib/print';
import { printTicketFlow } from './lib/ticket-print';
import { lineTitle } from './lib/order-view';

import type { TicketPrintDeps } from './lib/ticket-print';

// ----------------------------------------------------------------------

/** Các bước in phiếu trên web: giữ quyền / ghi in lại (6.3) → hộp thoại in của trình duyệt → báo kết quả (6.4). */
export function webTicketPrintDeps(deviceName: string, deviceId: string = currentDeviceId()): TicketPrintDeps {
  return {
    claim: (ticketId, reprint) => claimTicketPrint(ticketId, deviceName, reprint, deviceId),
    print: (ticket, reprint) => printHtmlDocument(kitchenTicketHtml(ticket, reprint)),
    report: (ticketId, result, error, reprint) => reportTicketPrint(ticketId, deviceName, result, error, reprint, deviceId),
  };
}

const STATUS: Record<string, { label: string; color: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  Pending: { label: 'Chưa in', color: 'warning' },
  Failed: { label: 'In lỗi', color: 'error' },
  Skipped: { label: 'Máy gửi không in', color: 'info' },
  Printed: { label: 'Đã in', color: 'success' },
};

export const ticketPlace = (t: Pick<IKitchenTicket, 'tableName' | 'areaName' | 'displayNo'>) =>
  t.tableName ? `${t.areaName ? `${t.areaName} · ` : ''}${t.tableName}` : `Mang về #${t.displayNo}`;

export const ticketTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

type RowProps = { ticket: IKitchenTicket; busy: boolean; onPrint: (reprint: boolean) => void };

export function FnbTicketRow({ ticket, busy, onPrint }: RowProps) {
  const status = STATUS[ticket.printStatus] ?? STATUS.Pending;
  const printed = ticket.printStatus === 'Printed';
  return (
    <ListItem
      divider
      secondaryAction={
        <LoadingButton size="small" variant={printed ? 'text' : 'contained'} loading={busy} onClick={() => onPrint(printed)}>
          {printed ? 'In lại' : 'In'}
        </LoadingButton>
      }
    >
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle2">
              {ticket.kind === 'Void' ? 'HỦY · ' : ''}
              {ticketPlace(ticket)} · Đơn {ticket.displayNo}
              {ticket.roundNo ? ` · Lượt ${ticket.roundNo}` : ''}
            </Typography>
            <Chip size="small" color={status.color} variant="soft" label={status.label} />
          </Stack>
        }
        secondary={
          <>
            {ticketTime(ticket.createdAt)} · {ticket.createdByName} ·{' '}
            {ticket.lines.map((l) => `${l.quantity} ${lineTitle(l)}`).join(', ')}
            {ticket.lastPrintError ? ` · Lỗi: ${ticket.lastPrintError}` : ''}
          </>
        }
        secondaryTypographyProps={{ noWrap: false }}
        sx={{ pr: 10 }}
      />
    </ListItem>
  );
}

// ----------------------------------------------------------------------

type DialogProps = { open: boolean; branchId: string; onClose: VoidFunction; onPrinted: VoidFunction };

/** Phiếu bar chưa in của chi nhánh (Chưa in / In lỗi) — in từ máy này. */
export function FnbUnprintedDialog({ open, branchId, onClose, onPrinted }: DialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [tickets, setTickets] = useState<IKitchenTicket[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTickets(await getKitchenTickets(branchId, { printStatus: ['Pending', 'Failed'], limit: 50 }));
    } catch {
      setTickets([]);
    }
  }, [branchId]);

  useEffect(() => {
    if (open) {
      setTickets(null);
      load();
    }
  }, [open, load]);

  const print = async (ticket: IKitchenTicket, reprint: boolean) => {
    setBusyId(ticket.id);
    try {
      const { outcome, error } = await printTicketFlow(ticket, webTicketPrintDeps('Web'), reprint);
      if (outcome === 'busy') enqueueSnackbar('Máy khác đang in phiếu này — chờ vài giây.', { variant: 'info' });
      else if (outcome === 'failed') enqueueSnackbar(`Không in được: ${error}`, { variant: 'error' });
      else enqueueSnackbar(outcome === 'done' ? 'Phiếu đã được in ở máy khác.' : 'Đã in phiếu');
    } catch {
      enqueueSnackbar('Không in được phiếu', { variant: 'error' });
    } finally {
      setBusyId(null);
      load();
      onPrinted();
    }
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle>Phiếu bar chưa in</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {tickets && tickets.length === 0 && (
          <Alert severity="success" sx={{ m: 2 }}>
            Không còn phiếu nào chưa in.
          </Alert>
        )}
        <List disablePadding>
          {(tickets ?? []).map((t) => (
            <FnbTicketRow key={t.id} ticket={t} busy={busyId === t.id} onPrint={(reprint) => print(t, reprint)} />
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}
