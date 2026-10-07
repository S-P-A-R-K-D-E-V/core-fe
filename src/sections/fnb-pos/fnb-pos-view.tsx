'use client';

import type { IFnbMenu, IFnbFloor } from 'src/types/fnb';
import type { IBranchLocation } from 'src/types/corecms-api';

import { useState, useEffect, useCallback } from 'react';

import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { getCurrentUser } from 'src/api/users';
import { getBranchLocations } from 'src/api/attendance';
import { getFnbMenu, getFnbFloor } from 'src/api/fnb';

import { useStoreBrand } from 'src/components/branding';
import { useSettingsContext } from 'src/components/settings';

import FnbFloor from './fnb-floor';
import { newId } from './lib/ids';
import FnbOrderScreen from './fnb-order-screen';

import type { OrderTarget } from './fnb-order-screen';

// ----------------------------------------------------------------------
// Bán hàng F&B trên web: chọn chi nhánh F&B (trong phạm vi được phân công) → sơ đồ bàn → màn gọi món.
// Sơ đồ làm mới mỗi 10 giây để thấy đơn do máy khác mở / thanh toán.
// ----------------------------------------------------------------------

const BRANCH_KEY = 'fnb.pos.branchId';
const FLOOR_REFRESH_MS = 10_000;

export default function FnbPosView() {
  const settings = useSettingsContext();
  const { brandName } = useStoreBrand();

  const [branches, setBranches] = useState<IBranchLocation[] | null>(null);
  const [branchId, setBranchId] = useState('');
  const [menu, setMenu] = useState<IFnbMenu | null>(null);
  const [floor, setFloor] = useState<IFnbFloor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<OrderTarget | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Chi nhánh F&B mà tài khoản được làm (Admin / chưa phân công = mọi chi nhánh).
  useEffect(() => {
    Promise.all([getBranchLocations(), getCurrentUser().catch(() => null)])
      .then(([list, me]) => {
        const scope = me?.branchScope;
        const fnb = list.filter(
          (b) =>
            b.isActive !== false &&
            b.businessType?.toLowerCase() === 'fnb' &&
            (!scope || scope.allBranches || scope.branchIds.includes(b.id))
        );
        setBranches(fnb);
        let saved = '';
        try {
          saved = window.localStorage.getItem(BRANCH_KEY) ?? '';
        } catch {
          // bỏ qua
        }
        setBranchId(fnb.some((b) => b.id === saved) ? saved : fnb[0]?.id ?? '');
      })
      .catch(() => setBranches([]));
  }, []);

  const loadFloor = useCallback(async () => {
    if (!branchId) return;
    try {
      const data = await getFnbFloor(branchId);
      setFloor(data);
      setError(null);
    } catch {
      setError('Không tải được sơ đồ bàn — thử tải lại trang.');
    }
    setNow(Date.now());
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    try {
      window.localStorage.setItem(BRANCH_KEY, branchId);
    } catch {
      // bỏ qua
    }
    setMenu(null);
    setFloor(null);
    setTarget(null);
    getFnbMenu(branchId)
      .then(setMenu)
      .catch(() => setError('Không tải được thực đơn.'));
    loadFloor();
  }, [branchId, loadFloor]);

  useEffect(() => {
    if (!branchId) return undefined;
    const timer = setInterval(loadFloor, FLOOR_REFRESH_MS);
    return () => clearInterval(timer);
  }, [branchId, loadFloor]);

  const back = useCallback(() => {
    setTarget(null);
    loadFloor();
  }, [loadFloor]);

  if (branches === null) {
    return (
      <Stack alignItems="center" sx={{ py: 10 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Bán hàng F&B
        </Typography>
        {branches.length > 0 && (
          <TextField
            select
            size="small"
            label="Chi nhánh"
            value={branchId}
            disabled={branches.length === 1 || !!target}
            onChange={(e) => setBranchId(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            {branches.map((b) => (
              <MenuItem key={b.id} value={b.id}>
                {b.branchName}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      {branches.length === 0 && (
        <Alert severity="info">
          Chưa có chi nhánh F&B nào bạn được làm. Quản lý đặt loại hình chi nhánh là F&B (trang quản trị cửa hàng) và phân
          công chi nhánh cho bạn.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {menu && menu.dishes.length === 0 && !target && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Thực đơn chi nhánh đang trống — thêm món ở Thiết lập F&B.
        </Alert>
      )}

      {branchId && !target && (
        <FnbFloor
          floor={floor}
          now={now}
          onOpenOrder={(o, table) =>
            setTarget({
              orderId: o.id,
              isNew: false,
              tableId: table?.id ?? null,
              tableName: table?.name ?? null,
              areaName: table?.areaName ?? null,
            })
          }
          onNewOrder={(table, shared) =>
            setTarget({
              orderId: newId(),
              isNew: true,
              tableId: table?.id ?? null,
              tableName: table?.name ?? null,
              areaName: table?.areaName ?? null,
              allowSharedTable: shared,
            })
          }
        />
      )}

      {branchId && target && (
        <FnbOrderScreen
          key={target.orderId}
          branchId={branchId}
          storeName={brandName}
          menu={menu}
          floor={floor}
          target={target}
          onBack={back}
          onOpenOrder={setTarget}
          onChanged={loadFloor}
        />
      )}
    </Container>
  );
}
