'use client';

import type { IKitchenTicket } from 'src/types/fnb';

import { useRef, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import List from '@mui/material/List';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { getKitchenTickets } from 'src/api/fnb';

import { stationDeviceId } from './lib/ids';
import { useFnbBranches } from './use-fnb-branches';
import { printTicketFlow, stationQueue } from './lib/ticket-print';
import { FnbTicketRow, webTicketPrintDeps } from './fnb-ticket-list';

// ----------------------------------------------------------------------
// Máy in phiếu: một máy tính ở quầy bar mở trang này, nối máy in phiếu. Mỗi 3 giây lấy phiếu bar của chi nhánh và tự in
// phiếu chưa in (kể cả phiếu app / máy bán hàng không có máy in báo "bỏ qua"), theo giao thức giữ quyền in — nhiều máy
// cùng chạy cũng không in trùng. Chỉ tự in phiếu tạo từ lúc bật (lùi 1 phút); phiếu cũ hơn in tay ở danh sách.
// ----------------------------------------------------------------------

const POLL_MS = 3_000;
const LOOKBACK_MS = 2 * 60 * 60 * 1000;
const GRACE_MS = 60_000;
const RUNNING_KEY = 'fnb.printStation.running';
const NAME_KEY = 'fnb.printStation.name';

const readStorage = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // bỏ qua
  }
};

export default function FnbPrintStationView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { branches, branchId, setBranchId } = useFnbBranches();

  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [deviceName, setDeviceName] = useState('Máy in phiếu');
  const [tickets, setTickets] = useState<IKitchenTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [printedCount, setPrintedCount] = useState(0);

  const handled = useRef(new Set<string>());
  const processing = useRef(false);

  useEffect(() => {
    setDeviceName(readStorage(NAME_KEY) || 'Máy in phiếu');
    if (readStorage(RUNNING_KEY) === '1') {
      setRunning(true);
      setStartedAt(Date.now());
    }
  }, []);

  const deps = useCallback(() => webTicketPrintDeps(deviceName.trim() || 'Máy in phiếu', stationDeviceId()), [deviceName]);

  const poll = useCallback(async () => {
    if (!branchId || processing.current) return;
    processing.current = true;
    try {
      const lookback = Date.now() - LOOKBACK_MS;
      const from = new Date(running ? Math.min(startedAt - GRACE_MS, lookback) : lookback).toISOString();
      const list = await getKitchenTickets(branchId, { from, limit: 100 });
      setTickets(list);
      setError(null);
      if (!running) return;

      const fresh = list.filter((t) => Date.parse(t.createdAt) >= startedAt - GRACE_MS);
      const queue = stationQueue(fresh, Date.now(), stationDeviceId(), handled.current);
      // Lần lượt từng phiếu (hộp thoại in của trình duyệt chỉ mở được một lúc).
      // eslint-disable-next-line no-restricted-syntax
      for (const ticket of queue) {
        // eslint-disable-next-line no-await-in-loop
        const { outcome, error: printError } = await printTicketFlow(ticket, deps());
        if (outcome !== 'busy') handled.current.add(ticket.id);
        if (outcome === 'printed') setPrintedCount((n) => n + 1);
        if (outcome === 'failed') enqueueSnackbar(`Phiếu đơn ${ticket.displayNo} in lỗi: ${printError}`, { variant: 'error' });
      }
      if (queue.length > 0) setTickets(await getKitchenTickets(branchId, { from, limit: 100 }));
    } catch {
      setError('Mất kết nối máy chủ — đang thử lại…');
    } finally {
      processing.current = false;
    }
  }, [branchId, running, startedAt, deps, enqueueSnackbar]);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  // Giữ màn hình sáng khi đang chạy (trình duyệt hỗ trợ).
  useEffect(() => {
    if (!running) return undefined;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request('screen')
      .then((l) => {
        lock = l;
      })
      .catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, [running]);

  const toggle = () => {
    const next = !running;
    setRunning(next);
    writeStorage(RUNNING_KEY, next ? '1' : '0');
    if (next) {
      handled.current.clear();
      setStartedAt(Date.now());
      setPrintedCount(0);
    }
  };

  const printOne = async (ticket: IKitchenTicket, reprint: boolean) => {
    setBusyId(ticket.id);
    try {
      const { outcome, error: printError } = await printTicketFlow(ticket, deps(), reprint);
      handled.current.add(ticket.id);
      if (outcome === 'busy') enqueueSnackbar('Máy khác đang in phiếu này.', { variant: 'info' });
      if (outcome === 'failed') enqueueSnackbar(`Không in được: ${printError}`, { variant: 'error' });
    } catch {
      enqueueSnackbar('Không in được phiếu', { variant: 'error' });
    } finally {
      setBusyId(null);
      poll();
    }
  };

  const backlog = tickets.filter(
    (t) => t.printStatus !== 'Printed' && Date.parse(t.createdAt) < startedAt - GRACE_MS
  ).length;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'md'}>
      <CustomBreadcrumbs
        heading="Máy in phiếu"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Máy in phiếu' }]}
        sx={{ mb: 3 }}
      />

      {branches?.length === 0 && <Alert severity="info">Chưa có chi nhánh F&amp;B nào bạn được làm.</Alert>}

      {branches && branches.length > 0 && (
        <Stack spacing={2}>
          <Card sx={{ p: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <TextField
                select
                size="small"
                label="Chi nhánh"
                value={branchId}
                disabled={running || branches.length === 1}
                onChange={(e) => setBranchId(e.target.value)}
                sx={{ minWidth: 200 }}
              >
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.branchName}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Tên máy"
                value={deviceName}
                disabled={running}
                onChange={(e) => {
                  setDeviceName(e.target.value);
                  writeStorage(NAME_KEY, e.target.value);
                }}
                inputProps={{ maxLength: 100 }}
              />
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1, justifyContent: 'flex-end' }}>
                {running && (
                  <Typography variant="body2" color="success.main">
                    Đang chạy · đã in {printedCount}
                  </Typography>
                )}
                <Button
                  variant="contained"
                  color={running ? 'error' : 'primary'}
                  startIcon={<Iconify icon={running ? 'solar:stop-bold' : 'solar:printer-bold'} />}
                  onClick={toggle}
                  disabled={!branchId}
                >
                  {running ? 'Dừng' : 'Bật tự in'}
                </Button>
              </Stack>
            </Stack>
          </Card>

          {!running && (
            <Alert severity="info">
              Mở trang này trên máy tính ở quầy bar có nối máy in phiếu, rồi bấm <b>Bật tự in</b>. Phiếu gọi món từ app, máy
              bán hàng tắt in, hoặc máy in lỗi đều được in ở đây. Để in thẳng không hiện hộp thoại: mở Chrome với tham số{' '}
              <code>--kiosk-printing</code> (chuột phải biểu tượng Chrome › Properties › Target, thêm vào cuối), đặt máy in
              phiếu làm máy in mặc định, khổ giấy 80 mm. Giữ tab mở, máy không ngủ.
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {running && backlog > 0 && (
            <Alert severity="warning">
              {backlog} phiếu tạo trước lúc bật vẫn chưa in — kiểm tra rồi bấm In ở danh sách dưới nếu bar chưa nhận.
            </Alert>
          )}

          <Card>
            <Typography variant="subtitle1" sx={{ p: 2, pb: 0 }}>
              Phiếu 2 giờ gần nhất
            </Typography>
            <List>
              {tickets.map((t) => (
                <FnbTicketRow key={t.id} ticket={t} busy={busyId === t.id} onPrint={(reprint) => printOne(t, reprint)} />
              ))}
              {tickets.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  Chưa có phiếu nào.
                </Typography>
              )}
            </List>
          </Card>
        </Stack>
      )}
    </Container>
  );
}
