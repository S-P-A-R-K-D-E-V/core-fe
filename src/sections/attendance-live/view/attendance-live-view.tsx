'use client';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Grid from '@mui/material/Grid2';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fTime } from 'src/utils/format-time';

import { useWorkingBranch } from 'src/store/working-branch-store';
import { getBranchBoard, getBranchBoardBranches } from 'src/api/attendance-live';
import { frameKey, useStoreLiveHub, type LiveFrameState } from 'src/hooks/use-store-live-hub';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { StatCard, STAFF_STATUS } from 'src/sections/store-monitor/store-monitor-shared';

import type { KioskAction } from 'src/types/kiosk';
import type {
  IBranchBoard,
  IBranchBoardCamera,
  IBranchBoardBranch,
  IBranchBoardDevice,
  IStorePresenceChanged,
  ILiveOverlayBox,
  IBranchBoardStaleOpen,
  StoreLiveConnectionState,
} from 'src/types/attendance-live';

// ----------------------------------------------------------------------
// Chấm công trực tiếp: chủ/quản lý chọn một chi nhánh có agent camera (spark-camera-agent trên máy tính ở quầy)
// và xem hình trực tiếp camera quầy, nhân sự được phân ca hôm nay (giờ vào/ra, lúc camera thấy) và những người
// camera thấy nhưng không có ca ở chi nhánh. Bảng tự làm mới 20 giây và ngay khi camera nhận ra ai đó.

const REFRESH_MS = 20_000;
/** Gom các sự kiện nhận diện dồn dập thành một lần tải lại. */
const PRESENCE_REFETCH_MS = 1_000;
/** Hình mới nhất nhận trong khoảng này → "LIVE". */
const LIVE_WINDOW_MS = 3_000;
/** Cùng một người + thao tác không báo lại trong khoảng này. */
const PRESENCE_TOAST_GAP_MS = 30_000;

const EMPTY_DEVICES: IBranchBoardDevice[] = [];

const ACTION_LABEL: Record<KioskAction, string> = {
  checkin: 'Vào ca',
  checkout: 'Ra ca',
  overtime: 'Ngoài giờ',
  noaction: 'Không thao tác',
};

const num = (n: number | null | undefined) => (n ?? 0).toLocaleString('vi-VN');

/** Độ khớp cao nhất hôm nay, vd " · khớp 68%"; trống khi chưa có. */
const similarity = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : ` · khớp ${Math.round(v * 100)}%`;

function dayTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const METHOD_LABEL: Record<string, string> = { Kiosk: 'máy chấm công', SmartMobile: 'điện thoại', Manual: 'chấm tay' };

/** Giờ địa phương của máy xem; thiếu / sai định dạng → "—". */
function clock(iso: string | null | undefined, withSeconds = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return fTime(d, withSeconds ? 'HH:mm:ss' : 'HH:mm');
}

function seenRange(first: string | null, last: string | null) {
  if (!first && !last) return '—';
  const a = clock(first ?? last);
  const b = clock(last ?? first);
  return a === b ? a : `${a}–${b}`;
}

function errorMessage(err: any, fallback: string): string {
  return err?.title || err?.message || fallback;
}

// ----------------------------------------------------------------------

type LiveTileModel = { device: IBranchBoardDevice; camera: IBranchBoardCamera };

const FACE_BOXES_KEY = 'attendance-live.showFaceBoxes';

function readFaceBoxesPref(): boolean {
  try {
    return localStorage.getItem(FACE_BOXES_KEY) !== '0';
  } catch {
    return true;
  }
}

const OVERLAY_COLOR: Record<string, 'success' | 'warning' | 'error' | 'info' | 'grey'> = {
  matched: 'success',
  no_match: 'warning',
  ambiguous: 'warning',
  liveness: 'error',
  error: 'error',
  detecting: 'info',
  small: 'grey',
};

/** Khung khuôn mặt + nhãn kết quả nhận diện, đặt theo toạ độ tương đối của hình. */
function FaceBoxes({ boxes }: { boxes: ILiveOverlayBox[] }) {
  return (
    <>
      {boxes.map((b, i) => {
        const tone = OVERLAY_COLOR[b.kind ?? ''] ?? 'info';
        const color = tone === 'grey' ? 'grey.400' : `${tone}.main`;
        return (
          <Box
            key={i}
            data-testid="face-box"
            sx={{
              position: 'absolute',
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.w * 100}%`,
              height: `${b.h * 100}%`,
              border: 2,
              borderColor: color,
              borderRadius: 0.5,
              pointerEvents: 'none',
            }}
          >
            {b.label && (
              <Box
                component="span"
                sx={{
                  position: 'absolute',
                  left: -2,
                  bottom: '100%',
                  mb: 0.25,
                  px: 0.75,
                  py: 0.125,
                  borderRadius: 0.5,
                  bgcolor: color,
                  color: tone === 'grey' ? 'grey.900' : 'common.white',
                  typography: 'caption',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  lineHeight: 1.4,
                }}
              >
                {b.label}
              </Box>
            )}
          </Box>
        );
      })}
    </>
  );
}

/** Camera quầy (role counter_face); chi nhánh chưa khai báo vai trò camera → mọi camera chưa có vai trò. */
export function counterTiles(devices: IBranchBoardDevice[]): LiveTileModel[] {
  const all = devices.flatMap((device) => (device.cameras ?? []).map((camera) => ({ device, camera })));
  const counter = all.filter((t) => t.camera.role === 'counter_face');
  return counter.length ? counter : all.filter((t) => !t.camera.role);
}

type LiveTileProps = {
  tile: LiveTileModel;
  frame: LiveFrameState | undefined;
  sourceConnected: boolean;
  paused: boolean;
  now: number;
  showFaceBoxes: boolean;
};

function LiveTile({ tile, frame, sourceConnected, paused, now, showFaceBoxes }: LiveTileProps) {
  const { device, camera } = tile;
  // Ô theo đúng tỉ lệ hình (Tapo 16:9) để toạ độ khung nhận diện 0..1 khớp hình, không bị viền đen.
  const [aspect, setAspect] = useState(16 / 9);
  const isLive = !paused && !!frame && now - frame.receivedAt < LIVE_WINDOW_MS;

  let overlay: { text: string; icon: string | null } | null = null;
  if (paused) overlay = { text: 'Đã tạm dừng xem', icon: 'solar:pause-circle-bold' };
  else if (isLive) overlay = null;
  else if (!device.online) overlay = { text: 'Thiết bị mất kết nối', icon: 'solar:danger-triangle-bold' };
  else if (!sourceConnected) overlay = { text: 'Agent chưa kết nối', icon: 'solar:videocamera-record-bold' };
  else overlay = { text: 'Đang chờ hình…', icon: null };

  const title = camera.name || camera.key;

  return (
    <Stack spacing={1}>
      <Box
        sx={{
          position: 'relative',
          width: 1,
          maxWidth: '100%',
          aspectRatio: `${aspect}`,
          overflow: 'hidden',
          borderRadius: 1.5,
          bgcolor: 'grey.900',
        }}
      >
        {frame && (
          <Box
            component="img"
            alt={title}
            src={`data:image/jpeg;base64,${frame.data}`}
            onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                const next = img.naturalWidth / img.naturalHeight;
                setAspect((prev) => (Math.abs(prev - next) > 0.01 ? next : prev));
              }
            }}
            sx={{
              position: 'absolute',
              inset: 0,
              width: 1,
              height: 1,
              maxWidth: '100%',
              objectFit: 'contain',
              opacity: overlay ? 0.35 : 1,
            }}
          />
        )}

        {isLive && showFaceBoxes && frame?.overlay && frame.overlay.length > 0 && <FaceBoxes boxes={frame.overlay} />}

        {isLive && (
          <Chip
            size="small"
            color="error"
            label="LIVE"
            icon={<Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'common.white' }} />}
            sx={{ position: 'absolute', top: 8, left: 8, fontWeight: 700, letterSpacing: 0.5 }}
          />
        )}

        {overlay && (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={1}
            sx={{ position: 'absolute', inset: 0, p: 2, textAlign: 'center', color: 'common.white' }}
          >
            {overlay.icon ? (
              <Iconify icon={overlay.icon} width={32} />
            ) : (
              <CircularProgress size={24} sx={{ color: 'common.white' }} />
            )}
            <Typography variant="subtitle2">{overlay.text}</Typography>
          </Stack>
        )}
      </Box>

      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {device.name}
          {frame ? ` · hình lúc ${clock(frame.at, true)}` : ''}
        </Typography>
      </Stack>
    </Stack>
  );
}

const CONNECTION_CHIP: Record<StoreLiveConnectionState, { label: string; color: 'default' | 'success' | 'warning' | 'error' } | null> = {
  idle: null,
  connecting: { label: 'Đang kết nối…', color: 'default' },
  connected: { label: 'Đã kết nối', color: 'success' },
  reconnecting: { label: 'Đang kết nối lại…', color: 'warning' },
  disconnected: { label: 'Mất kết nối máy chủ', color: 'error' },
};

type LivePanelProps = {
  branchId: string;
  devices: IBranchBoardDevice[];
  boardLoaded: boolean;
  onPresence: (event: IStorePresenceChanged) => void;
};

/** Hình trực tiếp nằm riêng ở đây để ~4 hình/giây mỗi camera chỉ vẽ lại khối này, không vẽ lại các bảng. */
function LivePanel({ branchId, devices, boardLoaded, onPresence }: LivePanelProps) {
  const [paused, setPaused] = useState(false);
  const [showFaceBoxes, setShowFaceBoxes] = useState(readFaceBoxesPref);
  const [now, setNow] = useState(() => Date.now());

  const toggleFaceBoxes = (checked: boolean) => {
    setShowFaceBoxes(checked);
    try {
      localStorage.setItem(FACE_BOXES_KEY, checked ? '1' : '0');
    } catch {
      // trình duyệt chặn lưu: chỉ nhớ trong phiên này
    }
  };

  const tiles = useMemo(() => counterTiles(devices), [devices]);
  const deviceIds = useMemo(() => tiles.map((t) => t.device.id), [tiles]);

  const { connectionState, frames, sources, error } = useStoreLiveHub({ branchId, deviceIds, paused, onPresence });

  // Đồng hồ để chip LIVE tắt khi hình ngừng tới.
  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [paused]);

  const connection = CONNECTION_CHIP[connectionState];
  const many = tiles.length >= 3;

  return (
    <Card sx={{ height: 1 }}>
      <CardHeader
        title="Camera quầy"
        subheader="Hình trực tiếp từ agent camera ở quầy chấm công"
        action={
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ pr: 1 }}>
            {connection && <Chip size="small" variant="soft" color={connection.color} label={connection.label} />}
            <FormControlLabel
              sx={{ mr: 0 }}
              control={
                <Switch
                  size="small"
                  checked={showFaceBoxes}
                  onChange={(e) => toggleFaceBoxes(e.target.checked)}
                  inputProps={{ 'aria-label': 'Hiện khung nhận diện' }}
                />
              }
              label="Hiện khung nhận diện"
            />
            <FormControlLabel
              sx={{ mr: 0 }}
              control={<Switch size="small" checked={paused} onChange={(e) => setPaused(e.target.checked)} />}
              label="Tạm dừng xem"
            />
          </Stack>
        }
        sx={{ flexWrap: 'wrap', rowGap: 1, '& .MuiCardHeader-action': { alignSelf: 'center', m: 0 } }}
      />

      <Box sx={{ p: 3, pt: 2 }}>
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!boardLoaded && tiles.length === 0 && (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size={28} />
          </Stack>
        )}

        {boardLoaded && tiles.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Chi nhánh này chưa có camera quầy (camera nhìn vào nhân viên khi chấm công).
          </Typography>
        )}

        {tiles.length > 0 && (
          <Grid container spacing={2}>
            {tiles.map((tile) => {
              const key = frameKey(tile.device.id, tile.camera.key);
              return (
                <Grid key={key} size={tiles.length === 1 ? 12 : { xs: 12, sm: 6, lg: many ? 4 : 6 }}>
                  <LiveTile
                    tile={tile}
                    frame={frames[key]}
                    sourceConnected={sources[tile.device.id] ?? tile.device.liveConnected}
                    paused={paused}
                    now={now}
                    showFaceBoxes={showFaceBoxes}
                  />
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    </Card>
  );
}

// ----------------------------------------------------------------------

function StaffCell({ name, avatarUrl, children }: { name: string; avatarUrl: string | null; children?: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Avatar src={avatarUrl ?? undefined} alt={name} sx={{ width: 32, height: 32 }}>
        {name.charAt(0)}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2">{name}</Typography>
        {children}
      </Box>
    </Stack>
  );
}

/** Camera thấy trong khoảng này thì coi là "vừa thấy" (đang ở quầy). */
const RECENT_SEEN_MS = 2 * 60_000;

function SeenLine({ first, last, similarity: sim, count }: { first: string | null; last: string | null; similarity: number | null; count?: number }) {
  if (!first && !last) return null;
  return (
    <Typography variant="caption" color="text.secondary" component="div">
      Camera thấy {seenRange(first, last)}
      {count && count > 1 ? ` · ${num(count)} lần` : ''}
      {similarity(sim)}
    </Typography>
  );
}

function RecentDot({ last, now }: { last: string | null; now: number }) {
  if (!last || now - new Date(last).getTime() > RECENT_SEEN_MS) return null;
  return (
    <Box
      component="span"
      title="Camera vừa thấy (2 phút gần nhất)"
      sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', flexShrink: 0, boxShadow: 2 }}
    />
  );
}

function SideRow({ name, avatarUrl, right, children, last, now }: {
  name: string;
  avatarUrl: string | null;
  right?: React.ReactNode;
  children?: React.ReactNode;
  last: string | null;
  now: number;
}) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 1.25 }}>
      <Avatar src={avatarUrl ?? undefined} alt={name} sx={{ width: 36, height: 36 }}>
        {name.charAt(0)}
      </Avatar>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {name}
          </Typography>
          <RecentDot last={last} now={now} />
        </Stack>
        {children}
      </Box>
      {right && <Box sx={{ flexShrink: 0 }}>{right}</Box>}
    </Stack>
  );
}

/** Cột bên phải camera: người được phân ca hôm nay + người camera nhận ra ngoài ca. */
function StaffSidePanel({ board }: { board: IBranchBoard | null }) {
  const now = Date.now();
  return (
    <Card sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title="Nhân sự hôm nay"
        subheader="Được phân ca và người camera nhận ra ngoài ca · chấm xanh = camera vừa thấy"
      />
      {!board ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={28} />
        </Stack>
      ) : (
        <Box sx={{ px: 2.5, pb: 2, overflowY: 'auto', maxHeight: { md: 560 }, flexGrow: 1 }}>
          <Typography variant="overline" color="text.secondary" component="div" sx={{ mt: 1 }}>
            Được phân ca ({num(board.assigned.length)})
          </Typography>
          {board.assigned.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              Hôm nay chưa phân ca cho ai ở chi nhánh này.
            </Typography>
          )}
          <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
            {board.assigned.map((s) => (
              <SideRow
                key={s.assignmentId}
                name={s.staffName}
                avatarUrl={s.avatarUrl}
                last={s.lastSeenAt}
                now={now}
                right={
                  <Stack spacing={0.5} alignItems="flex-end">
                    <Chip
                      size="small"
                      variant="soft"
                      color={STAFF_STATUS[s.status]?.color ?? 'default'}
                      label={STAFF_STATUS[s.status]?.label ?? s.status}
                    />
                    {s.lateMinutes > 0 && <Chip size="small" variant="soft" color="error" label={`Muộn ${s.lateMinutes}′`} />}
                  </Stack>
                }
              >
                <Typography variant="caption" color="text.secondary" component="div">
                  {s.shiftName} {s.startTime}–{s.endTime} · Vào {clock(s.checkInTime)} · Ra {clock(s.checkOutTime)}
                </Typography>
                <SeenLine first={s.firstSeenAt} last={s.lastSeenAt} similarity={s.bestSimilarity} />
                {!s.branchAssigned && (
                  <Chip size="small" variant="outlined" color="warning" label="Ca chưa gắn chi nhánh" sx={{ mt: 0.5 }} />
                )}
              </SideRow>
            ))}
          </Stack>

          <Typography variant="overline" color="text.secondary" component="div" sx={{ mt: 2 }}>
            Ngoài ca — camera nhận ra ({num(board.unassigned.length)})
          </Typography>
          {board.unassigned.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              Hôm nay camera chưa nhận ra ai ngoài danh sách phân ca.
            </Typography>
          )}
          <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
            {board.unassigned.map((s) => (
              <SideRow
                key={s.staffId}
                name={s.staffName}
                avatarUrl={s.avatarUrl}
                last={s.lastSeenAt}
                now={now}
                right={
                  s.lastAction ? (
                    <Chip size="small" variant="outlined" label={ACTION_LABEL[s.lastAction] ?? s.lastAction} />
                  ) : undefined
                }
              >
                <SeenLine first={s.firstSeenAt} last={s.lastSeenAt} similarity={s.bestSimilarity} count={s.seenCount} />
                {(s.checkInTime || s.checkOutTime) && (
                  <Typography variant="caption" color="text.secondary" component="div">
                    Chấm công ngoài ca · Vào {clock(s.checkInTime)} · Ra {clock(s.checkOutTime)}
                  </Typography>
                )}
                {s.hasShiftElsewhere && (
                  <Chip size="small" variant="outlined" color="info" label="Có ca ở chi nhánh khác" sx={{ mt: 0.5 }} />
                )}
              </SideRow>
            ))}
          </Stack>
        </Box>
      )}
    </Card>
  );
}

function StaleOpenCard({ rows }: { rows: IBranchBoardStaleOpen[] }) {
  return (
    <Alert severity="error" icon={<Iconify icon="solar:danger-triangle-bold" />} sx={{ '& .MuiAlert-message': { width: 1 } }}>
      <Typography variant="subtitle2">Lượt chấm công đang mở từ ngày trước ({num(rows.length)})</Typography>
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        Cần đóng hoặc điều chỉnh ở Chấm công → Điều chỉnh. Camera không tự đóng lượt mở quá 16 giờ (sẽ thành hàng trăm giờ
        công), nhưng lượt này vẫn treo trên bảng công cho tới khi được xử lý.
      </Typography>
      <Stack spacing={1}>
        {rows.map((r) => (
          <Stack key={r.logId} direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Avatar src={r.avatarUrl ?? undefined} alt={r.staffName} sx={{ width: 28, height: 28 }}>
              {r.staffName.charAt(0)}
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {r.staffName}
            </Typography>
            <Typography variant="body2">vào lúc {dayTime(r.checkInTime)}</Typography>
            <Typography variant="body2">
              · đang mở {r.hoursOpen.toLocaleString('vi-VN')} giờ
              {r.hoursOpen >= 48 ? ` (~${Math.round(r.hoursOpen / 24).toLocaleString('vi-VN')} ngày)` : ''}
            </Typography>
            {r.shiftName ? (
              <Chip size="small" variant="outlined" label={r.shiftName} />
            ) : (
              <Chip size="small" variant="soft" color="warning" label="Ngoài ca" />
            )}
            {(r.checkInMethod || r.deviceName) && (
              <Typography variant="caption" color="text.secondary">
                {[r.checkInMethod ? METHOD_LABEL[r.checkInMethod] ?? r.checkInMethod : null, r.deviceName]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            )}
          </Stack>
        ))}
      </Stack>
    </Alert>
  );
}

// ----------------------------------------------------------------------

export function AttendanceLiveView() {
  const { enqueueSnackbar } = useSnackbar();
  const workingBranchId = useWorkingBranch((s) => s.branch?.id ?? null);

  const [branches, setBranches] = useState<IBranchBoardBranch[] | null>(null);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState('');
  /** Người dùng đã tự chọn chi nhánh trên trang → không đi theo chi nhánh đang làm việc ở header nữa. */
  const pickedRef = useRef(false);

  // Bảng kèm id chi nhánh đã hỏi — đổi chi nhánh thì không hiện bảng cũ trong lúc chờ.
  const [board, setBoard] = useState<{ branchId: string; data: IBranchBoard } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const loadBranches = useCallback(async () => {
    try {
      const list = await getBranchBoardBranches();
      setBranches(list);
      setBranchesError(null);
    } catch (err: any) {
      setBranchesError(errorMessage(err, 'Không tải được danh sách chi nhánh có camera.'));
    }
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  // Mặc định: chi nhánh đang làm việc (nếu có camera), không thì chi nhánh đầu tiên.
  useEffect(() => {
    if (!branches) return;
    setBranchId((prev) => {
      const has = (id: string | null) => !!id && branches.some((b) => b.branchId === id);
      if (!pickedRef.current && workingBranchId && has(workingBranchId)) return workingBranchId;
      if (has(prev)) return prev;
      return branches[0]?.branchId ?? '';
    });
  }, [branches, workingBranchId]);

  const loadBoard = useCallback(
    async (silent = false) => {
      if (!branchId) return;
      requestRef.current += 1;
      const request = requestRef.current;
      if (!silent) setLoading(true);
      try {
        const data = await getBranchBoard(branchId);
        if (request !== requestRef.current) return;
        setBoard({ branchId, data });
        setError(null);
      } catch (err: any) {
        if (request !== requestRef.current) return;
        setError(errorMessage(err, 'Không tải được bảng chấm công của chi nhánh.'));
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [branchId]
  );

  useEffect(() => {
    setError(null);
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!branchId) return undefined;
    const timer = setInterval(() => loadBoard(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [branchId, loadBoard]);

  // presence_changed → báo ngắn + tải lại bảng (gom trong 1 giây). Callback ổn định theo enqueueSnackbar.
  const loadBoardRef = useRef(loadBoard);
  useEffect(() => {
    loadBoardRef.current = loadBoard;
  }, [loadBoard]);

  const presenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastedRef = useRef<Map<string, number>>(new Map());

  useEffect(
    () => () => {
      if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
    },
    []
  );

  const handlePresence = useCallback(
    (event: IStorePresenceChanged) => {
      if (event.staffName) {
        const key = `${event.staffId || event.staffName}|${event.action ?? ''}`;
        const at = Date.now();
        if (at - (toastedRef.current.get(key) ?? 0) >= PRESENCE_TOAST_GAP_MS) {
          toastedRef.current.set(key, at);
          const action = event.action && event.action !== 'noaction' ? ACTION_LABEL[event.action] : null;
          enqueueSnackbar(`Camera nhận ra ${event.staffName}${action ? ` · ${action}` : ''}`, { variant: 'info' });
        }
      }
      if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
      presenceTimerRef.current = setTimeout(() => {
        presenceTimerRef.current = null;
        loadBoardRef.current(true);
      }, PRESENCE_REFETCH_MS);
    },
    [enqueueSnackbar]
  );

  const handleRefresh = useCallback(() => {
    loadBranches();
    loadBoard();
  }, [loadBranches, loadBoard]);

  const current = board && board.branchId === branchId ? board.data : null;
  const counts = current?.counts;

  return (
    <Container maxWidth="xl">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4">Chấm công trực tiếp</Typography>
          <Typography variant="body2" color="text.secondary">
            Camera quầy, nhân sự được phân ca và người camera nhận ra hôm nay
            {current ? ` · cập nhật ${clock(current.generatedAt, true)}` : ''}
            {branchId ? ' · tự làm mới 20 giây' : ''}
          </Typography>
        </Box>
        {branches && branches.length > 0 && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              id="attendance-live-branch"
              select
              size="small"
              label="Chi nhánh"
              value={branchId}
              onChange={(e) => {
                pickedRef.current = true;
                setBranchId(e.target.value);
              }}
              sx={{ minWidth: 220 }}
            >
              {branches.map((b) => (
                <MenuItem key={b.branchId} value={b.branchId}>
                  {b.branchName}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              startIcon={<Iconify icon="solar:refresh-bold" />}
              onClick={handleRefresh}
              disabled={loading || !branchId}
            >
              Làm mới
            </Button>
          </Stack>
        )}
      </Stack>

      {branchesError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {branchesError}
        </Alert>
      )}

      {!branches && !branchesError && (
        <Stack alignItems="center" sx={{ py: 10 }}>
          <CircularProgress />
        </Stack>
      )}

      {branches && branches.length === 0 && (
        <Alert severity="info">
          Chưa có chi nhánh nào có camera chấm công. Cài <strong>Spark Camera Agent</strong> trên máy tính ở quầy (cùng
          mạng Wi-Fi với camera quầy), chạy <code>python -m agent pair</code> rồi nhập mã 6 số agent hiện ra ở trang{' '}
          <Link component={RouterLink} href={paths.dashboard.attendance.kioskDevices}>
            Thiết bị cửa hàng
          </Link>
          . Khi agent chạy, chi nhánh sẽ hiện ở đây.
        </Alert>
      )}

      {branchId && (
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 7, xl: 8 }}>
              <LivePanel
                branchId={branchId}
                devices={current?.devices ?? EMPTY_DEVICES}
                boardLoaded={!!current}
                onPresence={handlePresence}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 5, xl: 4 }}>
              <StaffSidePanel board={current} />
            </Grid>
          </Grid>

          {current && counts && (
            <>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <StatCard
                    title="Được phân ca"
                    value={num(counts.assigned)}
                    caption={`${num(counts.upcoming)} ca sắp tới`}
                    icon="solar:calendar-mark-bold"
                    color="primary"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <StatCard
                    title="Đang làm"
                    value={num(counts.working)}
                    caption={`${num(counts.done)} đã về`}
                    icon="solar:user-check-bold"
                    color="success"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <StatCard
                    title="Chưa vào"
                    value={num(counts.notIn)}
                    caption={`${num(counts.absent)} vắng`}
                    icon="solar:clock-circle-bold"
                    color="warning"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <StatCard
                    title="Đi muộn"
                    value={num(counts.late)}
                    caption="So với giờ bắt đầu ca"
                    icon="solar:alarm-bold"
                    color="error"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <StatCard
                    title="Có trong hình nhưng không có ca"
                    value={num(counts.unassignedSeen)}
                    caption="Camera quầy nhận ra hôm nay"
                    icon="solar:eye-bold"
                    color="info"
                    wrapTitle
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <StatCard
                    title="Lượt mở từ ngày trước"
                    value={num(counts.staleOpen)}
                    caption={counts.staleOpen > 0 ? 'Cần xử lý ở Điều chỉnh' : 'Không có'}
                    icon="solar:danger-triangle-bold"
                    color={counts.staleOpen > 0 ? 'error' : 'success'}
                    wrapTitle
                  />
                </Grid>
              </Grid>

              {current.staleOpen.length > 0 && <StaleOpenCard rows={current.staleOpen} />}
            </>
          )}

          {!current && loading && (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress />
            </Stack>
          )}
        </Stack>
      )}
    </Container>
  );
}
