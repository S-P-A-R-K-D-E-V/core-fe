'use client';

import { useMemo, useState, useEffect, useContext, useCallback, createContext } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { hasApiErrorCode } from 'src/utils/api-error';
import {
  vnToday,
  hasShiftOn,
  canUseShiftCash,
  ShiftCashGeoError,
  geofenceBranches,
  isShiftCashBypass,
  checkShiftCashGeofence,
  acquireShiftCashPosition,
  SHIFT_CASH_MAX_ACCURACY_M,
} from 'src/utils/shift-cash-access';

import { setShiftCashGeo } from 'src/api/shiftCash';
import { getMySchedule, getBranchLocations } from 'src/api/attendance';

import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// Cổng vào trang Kiểm tiền quầy (web) — cùng luật với app và BE (ShiftCashAccess):
//  - Admin: vào thẳng, không hỏi GPS. Vai trò ngoài Admin/Manager/Staff: chặn ngay.
//  - Staff / Manager: 1) có ca hôm nay (giờ VN, qua /shift-assignments/my-schedule)
//                     2) tải toạ độ chi nhánh — lỗi thì CHẶN, không mở cổng khi không kiểm được
//                     3) GPS trình duyệt (độ chính xác cao) trong bán kính một chi nhánh, sai số ≤ 200 m.
//    Chưa chi nhánh nào có toạ độ → bỏ qua bước GPS (giống chấm công).
// Qua cổng: vị trí đặt vào src/api/shiftCash (header X-Geo-*), và tiếp tục cập nhật khi người dùng di chuyển.
// Trang con gặp 403 ShiftCash.* từ BE → gọi deny(message) để quay lại màn chặn với đúng thông điệp BE.
// ----------------------------------------------------------------------

type GateState =
  | { step: 'checking-shift' }
  | { step: 'checking-location' }
  | { step: 'passed'; trackLocation: boolean }
  | {
      step: 'blocked';
      icon: string;
      title: string;
      message: string;
      showSchedule?: boolean;
    };

type ShiftCashAccessContextValue = {
  // Admin — bỏ qua mọi kiểm tra, được chọn ngày cũ và xem nhật ký.
  bypass: boolean;
  // BE từ chối (403 ShiftCash.*) → về màn chặn với thông điệp của BE.
  deny: (message: string) => void;
  // Chạy lại toàn bộ kiểm tra (vd. qua ngày mới khi trang vẫn mở).
  recheck: () => void;
};

const ShiftCashAccessContext = createContext<ShiftCashAccessContextValue>({
  bypass: false,
  deny: () => {},
  recheck: () => {},
});

export const useShiftCashAccess = () => useContext(ShiftCashAccessContext);

// ----------------------------------------------------------------------

function blocked(icon: string, title: string, message: string, showSchedule = false): GateState {
  return { step: 'blocked', icon, title, message, showSchedule };
}

function geoFailureState(err: unknown): GateState {
  const reason = err instanceof ShiftCashGeoError ? err.reason : 'unavailable';
  switch (reason) {
    case 'unsupported':
      return blocked(
        'solar:map-point-remove-bold-duotone',
        'Trình duyệt không hỗ trợ định vị',
        'Hãy mở trang bằng Chrome / Safari / Edge bản mới (qua https) để kiểm quầy.'
      );
    case 'denied':
      return blocked(
        'solar:map-point-remove-bold-duotone',
        'Chưa cho phép truy cập vị trí',
        'Kiểm quầy cần vị trí để xác nhận bạn đang ở cửa hàng. Bấm biểu tượng ổ khoá cạnh địa chỉ trang → cho phép Vị trí, rồi bấm Thử lại.'
      );
    case 'timeout':
    case 'unavailable':
    default:
      return blocked(
        'solar:map-point-search-bold-duotone',
        'Không lấy được vị trí GPS',
        'Bật định vị / Wi-Fi của thiết bị, đứng gần cửa ra vào hoặc cửa sổ rồi bấm Thử lại.'
      );
  }
}

// Không tải được lịch làm. Cửa hàng chưa bật xếp ca (RequireFeature → 403 { error: 'feature_disabled' })
// thì không ai ngoài Admin có ca để kiểm quầy — báo đúng lý do, đừng bảo "kiểm tra mạng".
function scheduleFailureState(err: unknown): GateState {
  if (hasApiErrorCode(err, 'feature_disabled')) {
    return blocked(
      'solar:calendar-search-bold-duotone',
      'Cửa hàng chưa bật xếp ca',
      'Kiểm quầy cần lịch làm để biết bạn có ca hôm nay, nhưng cửa hàng chưa bật tính năng xếp ca — hiện chỉ Admin kiểm quầy được. Hãy báo chủ cửa hàng.'
    );
  }
  return blocked(
    'solar:calendar-search-bold-duotone',
    'Không kiểm tra được ca làm',
    'Không tải được lịch làm hôm nay. Kiểm tra mạng rồi bấm Thử lại.'
  );
}

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export default function ShiftCashAccessGate({ children }: Props) {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const bypass = isShiftCashBypass(user);
  const allowedRole = canUseShiftCash(user);

  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<GateState>(
    bypass ? { step: 'passed', trackLocation: false } : { step: 'checking-shift' }
  );

  const recheck = useCallback(() => setAttempt((n) => n + 1), []);

  const deny = useCallback((message: string) => {
    setShiftCashGeo(null);
    setState(
      blocked('solar:shield-cross-bold-duotone', 'Không được kiểm quầy lúc này', message, true)
    );
  }, []);

  // ── Kiểm tra lúc vào trang / Thử lại ──
  useEffect(() => {
    let cancelled = false;
    setShiftCashGeo(null);

    if (bypass) {
      setState({ step: 'passed', trackLocation: false });
      return undefined;
    }

    if (!allowedRole) {
      setState(
        blocked(
          'solar:shield-cross-bold-duotone',
          'Tài khoản không có quyền kiểm quầy',
          'Kiểm quầy chỉ dành cho nhân viên, quản lý và Admin của cửa hàng.'
        )
      );
      return undefined;
    }

    (async () => {
      setState({ step: 'checking-shift' });
      const today = vnToday();

      // 1) Có ca hôm nay
      let assignments;
      try {
        assignments = await getMySchedule(today, today);
      } catch (error) {
        console.error('Shift-cash gate: my-schedule failed', error);
        if (!cancelled) setState(scheduleFailureState(error));
        return;
      }
      if (cancelled) return;
      if (!hasShiftOn(assignments, today)) {
        setState(
          blocked(
            'solar:calendar-minimalistic-bold-duotone',
            'Hôm nay bạn không có ca',
            'Chỉ nhân viên / quản lý có ca trong ngày hôm nay mới được kiểm quầy. Nếu vừa được xếp ca, bấm Thử lại.',
            true
          )
        );
        return;
      }

      // 2) Toạ độ chi nhánh — lỗi thì chặn (không mở cổng khi không kiểm được vị trí)
      setState({ step: 'checking-location' });
      let branches;
      try {
        branches = await getBranchLocations();
      } catch (error) {
        console.error('Shift-cash gate: branches failed', error);
        if (!cancelled) {
          setState(
            blocked(
              'solar:shop-2-bold-duotone',
              'Không tải được vị trí cửa hàng',
              'Không kiểm tra được bạn có ở cửa hàng hay không. Kiểm tra mạng rồi bấm Thử lại.'
            )
          );
        }
        return;
      }
      if (cancelled) return;
      if (geofenceBranches(branches).length === 0) {
        // Chưa chi nhánh nào có toạ độ → BE cũng bỏ qua geofence
        setState({ step: 'passed', trackLocation: false });
        return;
      }

      // 3) GPS trong bán kính cửa hàng
      let geo;
      try {
        geo = await acquireShiftCashPosition();
      } catch (error) {
        if (!cancelled) setState(geoFailureState(error));
        return;
      }
      if (cancelled) return;

      const result = checkShiftCashGeofence(geo, branches);
      if (result.status === 'low_accuracy') {
        setState(
          blocked(
            'solar:map-point-search-bold-duotone',
            'Vị trí chưa đủ chính xác',
            `Sai số GPS hiện khoảng ${Math.round(result.accuracy)} m (cần ≤ ${SHIFT_CASH_MAX_ACCURACY_M} m). Bật định vị chính xác / Wi-Fi, đứng gần cửa ra vào hoặc cửa sổ rồi bấm Thử lại.`
          )
        );
        return;
      }
      if (result.status === 'outside') {
        const where =
          result.branchName && result.distance != null
            ? ` Chi nhánh gần nhất: ${result.branchName}, cách khoảng ${result.distance} m (bán kính ${result.radius} m).`
            : '';
        setState(
          blocked(
            'solar:map-point-wave-bold-duotone',
            'Bạn đang ở ngoài cửa hàng',
            `Chỉ kiểm quầy được khi có mặt tại cửa hàng.${where}`
          )
        );
        return;
      }

      setShiftCashGeo(geo);
      setState({ step: 'passed', trackLocation: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [bypass, allowedRole, attempt]);

  // ── Đã qua cổng: cập nhật vị trí gửi kèm (người dùng mở trang cả ca) ──
  // Chỉ nhận điểm đủ chính xác; không tự khoá trang khi GPS chập chờn — BE quyết định khi bật geofence.
  const trackLocation = state.step === 'passed' && state.trackLocation;
  useEffect(() => {
    if (!trackLocation || typeof navigator === 'undefined' || !navigator.geolocation) {
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.accuracy <= SHIFT_CASH_MAX_ACCURACY_M) {
          setShiftCashGeo({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        }
      },
      (error) => console.warn('Shift-cash gate: watchPosition', error),
      { enableHighAccuracy: true, maximumAge: 30000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [trackLocation]);

  // Rời trang → không để vị trí cũ dính vào lời gọi khác
  useEffect(() => () => setShiftCashGeo(null), []);

  const contextValue = useMemo(() => ({ bypass, deny, recheck }), [bypass, deny, recheck]);

  if (state.step === 'passed') {
    return (
      <ShiftCashAccessContext.Provider value={contextValue}>
        {children}
      </ShiftCashAccessContext.Provider>
    );
  }

  const checking = state.step === 'checking-shift' || state.step === 'checking-location';

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Kiểm tiền quầy"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Kiểm tiền' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ p: { xs: 3, md: 5 }, maxWidth: 560, mx: 'auto' }}>
        {checking ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 3 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              {state.step === 'checking-shift'
                ? 'Đang kiểm tra ca làm hôm nay…'
                : 'Đang xác định vị trí của bạn…'}
            </Typography>
          </Stack>
        ) : (
          state.step === 'blocked' && (
            <Stack alignItems="center" spacing={2} sx={{ textAlign: 'center' }}>
              <Iconify icon={state.icon} width={64} sx={{ color: 'warning.main' }} />
              <Typography variant="h5">{state.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {state.message}
              </Typography>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ pt: 1 }}
                flexWrap="wrap"
                justifyContent="center"
              >
                <Button
                  variant="contained"
                  startIcon={<Iconify icon="solar:refresh-bold" />}
                  onClick={recheck}
                >
                  Thử lại
                </Button>
                {state.showSchedule && (
                  <Button
                    variant="outlined"
                    component={RouterLink}
                    href={paths.dashboard.attendance.mySchedule}
                    startIcon={<Iconify icon="solar:calendar-bold" />}
                  >
                    Lịch làm của tôi
                  </Button>
                )}
              </Stack>
            </Stack>
          )
        )}
      </Card>
    </Container>
  );
}
