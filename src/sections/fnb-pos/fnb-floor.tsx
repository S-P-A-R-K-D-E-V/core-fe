'use client';

import type { IFnbFloor, IFloorTable, IOrderSummary } from 'src/types/fnb';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogActions from '@mui/material/DialogActions';
import CardActionArea from '@mui/material/CardActionArea';
import ListItemButton from '@mui/material/ListItemButton';

import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';

import { tablesOf, tableStatus, minutesSince, staleUnprinted } from './lib/floor';

import type { TableStatus } from './lib/floor';

// ----------------------------------------------------------------------
// Sơ đồ bàn: khu vực, bàn (trống / có khách / đã in tạm tính), đơn mang về đang mở. Bấm bàn trống → đơn mới; bàn một
// đơn → mở đơn; bàn nhiều đơn (đã tách) → chọn đơn hoặc mở thêm đơn.
// ----------------------------------------------------------------------

type TableWithArea = IFloorTable & { areaName: string };

type Props = {
  floor: IFnbFloor | null;
  now: number;
  onOpenOrder: (order: IOrderSummary, table: TableWithArea | null) => void;
  onNewOrder: (table: TableWithArea | null, shared: boolean) => void;
};

const STATUS: Record<TableStatus, { label: string; color: string; bg: string }> = {
  free: { label: 'Trống', color: 'text.secondary', bg: 'background.paper' },
  occupied: { label: 'Có khách', color: 'primary.darker', bg: 'primary.lighter' },
  billed: { label: 'Chờ thanh toán', color: 'warning.darker', bg: 'warning.lighter' },
};

export default function FnbFloor({ floor, now, onOpenOrder, onNewOrder }: Props) {
  const [areaId, setAreaId] = useState<string | null>(null);
  const [multi, setMulti] = useState<TableWithArea | null>(null);

  const areas = useMemo(() => [...(floor?.areas ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [floor]);
  const tables = useMemo(() => tablesOf(floor, areaId), [floor, areaId]);
  const stale = floor ? staleUnprinted(floor.unprintedTickets, now) : [];
  const takeaway = floor?.takeawayOrders ?? [];

  const pick = (table: TableWithArea) => {
    if (table.orders.length === 0) onNewOrder(table, false);
    else if (table.orders.length === 1) onOpenOrder(table.orders[0], table);
    else setMulti(table);
  };

  if (floor && areas.length === 0 && takeaway.length === 0) {
    return (
      <Stack spacing={2}>
        <Alert severity="info">
          Chi nhánh chưa có khu vực / bàn — vào Thiết lập F&B để thêm. Vẫn bán mang về được.
        </Alert>
        <Box>
          <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={() => onNewOrder(null, false)}>
            Mang về mới
          </Button>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      {stale.length > 0 && (
        <Alert severity="warning">
          {stale.length} phiếu bar chưa in được — kiểm tra máy in ở quầy.
        </Alert>
      )}

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip label="Tất cả" color={!areaId ? 'primary' : 'default'} onClick={() => setAreaId(null)} />
        {areas.map((a) => (
          <Chip key={a.id} label={a.name} color={areaId === a.id ? 'primary' : 'default'} onClick={() => setAreaId(a.id)} />
        ))}
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={() => onNewOrder(null, false)}>
          Mang về mới
        </Button>
      </Stack>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {tables.map((t) => {
          const status = tableStatus(t);
          const s = STATUS[status];
          const total = t.orders.reduce((sum, o) => sum + o.total, 0);
          const oldest = t.orders[0];
          return (
            <Card key={t.id} variant="outlined" sx={{ bgcolor: s.bg }}>
              <CardActionArea onClick={() => pick(t)} sx={{ p: 1.5, minHeight: 104 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                  <Typography variant="subtitle1">{t.name}</Typography>
                  {t.orders.length > 1 && <Chip size="small" label={`${t.orders.length} đơn`} />}
                </Stack>
                {!areaId && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {t.areaName}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ color: s.color, mt: 0.5 }}>
                  {status === 'free' ? s.label : fCurrency(total)}
                </Typography>
                {oldest && (
                  <Typography variant="caption" color="text.secondary">
                    {s.label} · {minutesSince(oldest.openedAt, now)}′
                    {t.orders.some((o) => o.pendingLineCount > 0) ? ' · chưa gửi bar' : ''}
                  </Typography>
                )}
              </CardActionArea>
            </Card>
          );
        })}
      </Box>

      {takeaway.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ pt: 1 }}>
            Mang về đang mở
          </Typography>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {takeaway.map((o) => (
              <Card key={o.id} variant="outlined" sx={{ bgcolor: STATUS[o.billPrinted ? 'billed' : 'occupied'].bg }}>
                <CardActionArea onClick={() => onOpenOrder(o, null)} sx={{ p: 1.5 }}>
                  <Typography variant="subtitle1">Đơn {o.displayNo}</Typography>
                  <Typography variant="body2">{fCurrency(o.total)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {o.openedByName} · {minutesSince(o.openedAt, now)}′
                  </Typography>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </>
      )}

      <Dialog fullWidth maxWidth="xs" open={!!multi} onClose={() => setMulti(null)}>
        <DialogTitle>{multi?.name} — chọn đơn</DialogTitle>
        <List>
          {multi?.orders.map((o) => (
            <ListItemButton
              key={o.id}
              onClick={() => {
                const table = multi;
                setMulti(null);
                onOpenOrder(o, table);
              }}
            >
              <ListItemText
                primary={`Đơn ${o.displayNo} · ${fCurrency(o.total)}`}
                secondary={`${o.openedByName} · ${minutesSince(o.openedAt, now)} phút`}
              />
            </ListItemButton>
          ))}
        </List>
        <DialogActions>
          <Button
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => {
              const table = multi;
              setMulti(null);
              onNewOrder(table, true);
            }}
          >
            Mở thêm đơn ở bàn này
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
