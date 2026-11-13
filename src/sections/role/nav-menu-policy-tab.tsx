'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import TableContainer from '@mui/material/TableContainer';
import FormControlLabel from '@mui/material/FormControlLabel';

import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import {
  customRoleCode,
  saveNavMenuPolicy,
  resetNavMenuPolicy,
  getNavMenuPolicies,
  type NavMenuPolicyItem,
  type NavMenuPolicyRequest,
} from 'src/api/nav-menu';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useStoreBrand } from 'src/components/branding';
import { useSnackbar } from 'src/components/snackbar';

import { filterModules, flattenModules } from 'src/layouts/dashboard/nav/nav-filter';
import {
  buildMeModule,
  buildSettingsModule,
  buildBusinessModules,
} from 'src/layouts/dashboard/nav/nav-config';

import type { NavAccess, NavFlatPage } from 'src/layouts/dashboard/nav/nav-types';
import type { ICustomRole, IPermissionCatalog } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// "Menu hiển thị": chủ cửa hàng chọn cho từng vai trò mục nào ẩn khỏi menu, mục nào ghim sẵn, trang nào mở đầu. Chỉ là
// giao diện — ẩn menu KHÔNG chặn quyền (muốn chặn thì bỏ quyền ở tab Vai trò & quyền). Ô "Không quyền": vai trò chưa
// được cấp quyền nên không thể hiện. Người mang nhiều vai trò: mục hiện nếu ít nhất một vai trò không ẩn nó.
// Lưu ở Core-be /nav-menu-policies; người dùng nhận bản đã gộp qua GET /users/me → navMenu.
// ----------------------------------------------------------------------

type Column = { code: string; label: string; access: NavAccess; isAdmin: boolean };
type CellState = 'show' | 'hide' | 'pin';

const EMPTY: NavMenuPolicyRequest = {
  hiddenKeys: [],
  pinnedKeys: [],
  homeKey: null,
  hideFromSearch: false,
};

const STATE_LABEL: Record<CellState, string> = { show: 'Hiện', hide: 'Ẩn', pin: '★ Ghim' };
const STATE_COLOR: Record<CellState, 'success' | 'default' | 'warning'> = {
  show: 'success',
  hide: 'default',
  pin: 'warning',
};

type Props = {
  catalog: IPermissionCatalog | null;
  customRoles: ICustomRole[] | null;
};

export default function NavMenuPolicyTab({ catalog, customRoles }: Props) {
  const { user } = useAuthContext();
  const { isCiCi } = useStoreBrand();
  const { enqueueSnackbar } = useSnackbar();

  const [policies, setPolicies] = useState<Record<string, NavMenuPolicyRequest>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const enabledFeatures: string[] = useMemo(
    () => user?.enabledFeatures ?? [],
    [user?.enabledFeatures]
  );

  const modules = useMemo(
    () => [...buildBusinessModules(), buildSettingsModule(isCiCi), buildMeModule()],
    [isCiCi]
  );

  // Cột: vai trò hệ thống + vai trò tuỳ chỉnh (vai trò tuỳ chỉnh có vai trò gốc cho mục còn kiểm theo vai trò).
  const columns: Column[] = useMemo(() => {
    const base = { enabledFeatures, blockedFeatures: [], branchTypes: null };
    const systemPerms = (name: string) =>
      catalog?.systemRoles.find((r) => r.name === name)?.permissions ?? [];
    return [
      {
        code: 'Admin',
        label: 'Chủ cửa hàng',
        access: { ...base, roles: ['Admin'] },
        isAdmin: true,
      },
      {
        code: 'Manager',
        label: 'Quản lý',
        access: { ...base, roles: ['Manager'], permissions: systemPerms('Manager') },
        isAdmin: false,
      },
      {
        code: 'Staff',
        label: 'Nhân viên',
        access: { ...base, roles: ['Staff'], permissions: systemPerms('Staff') },
        isAdmin: false,
      },
      ...(customRoles ?? []).map((role) => ({
        code: customRoleCode(role.id),
        label: role.name,
        access: { ...base, roles: [role.baseRole], permissions: role.permissions },
        isAdmin: false,
      })),
    ];
  }, [catalog, customRoles, enabledFeatures]);

  // Hàng: mọi trang cửa hàng đang bật (như chủ cửa hàng thấy).
  const rows = useMemo(
    () =>
      flattenModules(
        filterModules(
          modules,
          { roles: ['Admin'], enabledFeatures, blockedFeatures: [], branchTypes: null },
          { ignorePolicy: true }
        )
      ),
    [modules, enabledFeatures]
  );

  // Trang mỗi vai trò có quyền thấy.
  const allowed = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    columns.forEach((col) => {
      map[col.code] = new Set(
        flattenModules(filterModules(modules, col.access, { ignorePolicy: true })).map((p) => p.key)
      );
    });
    return map;
  }, [columns, modules]);

  const load = useCallback(async () => {
    try {
      const list = await getNavMenuPolicies();
      const next: Record<string, NavMenuPolicyRequest> = {};
      list.forEach((item: NavMenuPolicyItem) => {
        next[item.roleCode] = {
          hiddenKeys: item.hiddenKeys ?? [],
          pinnedKeys: item.pinnedKeys ?? [],
          homeKey: item.homeKey ?? null,
          hideFromSearch: !!item.hideFromSearch,
        };
      });
      setPolicies(next);
      setDirty(new Set());
      setLoadError(null);
    } catch (error) {
      setLoadError(apiErrorMessage(error, 'Không tải được cấu hình menu (Core-be chưa hỗ trợ?)'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const policyOf = (code: string) => policies[code] ?? EMPTY;

  const update = (code: string, change: (p: NavMenuPolicyRequest) => NavMenuPolicyRequest) => {
    setPolicies((prev) => ({ ...prev, [code]: change(prev[code] ?? EMPTY) }));
    setDirty((prev) => new Set(prev).add(code));
  };

  const stateOf = (code: string, key: string): CellState => {
    const p = policyOf(code);
    if (p.hiddenKeys.includes(key)) return 'hide';
    if (p.pinnedKeys.includes(key)) return 'pin';
    return 'show';
  };

  const cycle = (code: string, key: string) =>
    update(code, (p) => {
      const state = stateOf(code, key);
      if (state === 'show') return { ...p, hiddenKeys: [...p.hiddenKeys, key] };
      if (state === 'hide')
        return {
          ...p,
          hiddenKeys: p.hiddenKeys.filter((k) => k !== key),
          pinnedKeys: [...p.pinnedKeys, key],
        };
      return { ...p, pinnedKeys: p.pinnedKeys.filter((k) => k !== key) };
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        Array.from(dirty).map((code) => {
          const p = policyOf(code);
          const isEmpty =
            !p.hiddenKeys.length && !p.pinnedKeys.length && !p.homeKey && !p.hideFromSearch;
          return isEmpty ? resetNavMenuPolicy(code) : saveNavMenuPolicy(code, p);
        })
      );
      enqueueSnackbar('Đã lưu menu theo vai trò — người dùng thấy menu mới khi tải lại trang');
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không lưu được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const applyCashierPreset = (code: string) =>
    update(code, (p) => ({
      ...p,
      hiddenKeys: Array.from(
        new Set(
          [...p.hiddenKeys, 'goods.products', 'goods.shift-checks'].filter((k) =>
            allowed[code]?.has(k)
          )
        )
      ),
      pinnedKeys: ['sales.pos', 'cash.shift', 'sales.online-orders', 'me.checkin'].filter((k) =>
        allowed[code]?.has(k)
      ),
      homeKey: allowed[code]?.has('sales.pos') ? 'sales.pos' : p.homeKey,
    }));

  // Nhóm hàng theo module.
  const grouped = useMemo(() => {
    const out: { title: string; pages: NavFlatPage[] }[] = [];
    rows.forEach((page) => {
      const last = out[out.length - 1];
      if (last && last.title === page.moduleTitle) last.pages.push(page);
      else out.push({ title: page.moduleTitle, pages: [page] });
    });
    return out;
  }, [rows]);

  if (loadError) {
    return (
      <Alert severity="warning" action={<Button onClick={load}>Thử lại</Button>}>
        {loadError}
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        Ẩn khỏi menu <strong>không chặn quyền</strong> — muốn chặn thì bỏ quyền ở tab Vai trò &
        quyền. Ô &quot;Không quyền&quot;: vai trò chưa được cấp quyền nên không thể hiện. Người mang
        nhiều vai trò: mục hiện nếu ít nhất một vai trò không ẩn. Bấm ô để đổi Hiện → Ẩn → Ghim. Mục
        ẩn vẫn tìm được bằng ô tìm nhanh, trừ khi chọn &quot;Ẩn cả tìm kiếm&quot;.
      </Alert>

      <Card>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            Menu theo vai trò
          </Typography>
          <Button variant="contained" disabled={!dirty.size || saving} onClick={handleSave}>
            {saving ? 'Đang lưu…' : dirty.size ? `Lưu (${dirty.size} vai trò)` : 'Đã lưu'}
          </Button>
        </Stack>

        <TableContainer sx={{ maxHeight: '70vh' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 260 + columns.length * 150 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 240 }}>Mục menu</TableCell>
                {columns.map((col) => (
                  <TableCell key={col.code} align="center" sx={{ minWidth: 150 }}>
                    <Typography variant="subtitle2">{col.label}</Typography>
                    {!col.isAdmin && (
                      <Stack direction="row" justifyContent="center" spacing={0.5} sx={{ mt: 0.5 }}>
                        <Tooltip title="Ẩn hàng hoá, ghim Bán hàng / Kiểm quầy / Đơn online / Chấm công, mở đầu bằng Màn bán hàng">
                          <Button size="small" onClick={() => applyCashierPreset(col.code)}>
                            Thu ngân gọn
                          </Button>
                        </Tooltip>
                        <Tooltip title="Bỏ mọi tuỳ chỉnh của vai trò này">
                          <Button
                            size="small"
                            color="inherit"
                            onClick={() => update(col.code, () => EMPTY)}
                          >
                            Mặc định
                          </Button>
                        </Tooltip>
                      </Stack>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>
                  <strong>Trang mở đầu</strong>
                  <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                    Khi vào /dashboard. Trống = Kiểm quầy.
                  </Typography>
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col.code} align="center">
                    <Select
                      size="small"
                      displayEmpty
                      value={policyOf(col.code).homeKey ?? ''}
                      onChange={(e) =>
                        update(col.code, (p) => ({ ...p, homeKey: e.target.value || null }))
                      }
                      sx={{ maxWidth: 170, typography: 'body2' }}
                    >
                      <MenuItem value="">
                        <em>Mặc định</em>
                      </MenuItem>
                      {rows
                        .filter((page) => allowed[col.code]?.has(page.key))
                        .map((page) => (
                          <MenuItem key={page.key} value={page.key}>
                            {page.moduleTitle} › {page.title}
                          </MenuItem>
                        ))}
                    </Select>
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>
                  <strong>Ẩn cả tìm kiếm</strong>
                  <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                    Mục ẩn không hiện trong ô tìm nhanh.
                  </Typography>
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col.code} align="center">
                    <FormControlLabel
                      sx={{ m: 0 }}
                      label=""
                      control={
                        <Checkbox
                          checked={policyOf(col.code).hideFromSearch}
                          onChange={(e) =>
                            update(col.code, (p) => ({ ...p, hideFromSearch: e.target.checked }))
                          }
                          inputProps={{ 'aria-label': `Ẩn cả tìm kiếm — ${col.label}` }}
                        />
                      }
                    />
                  </TableCell>
                ))}
              </TableRow>

              {grouped.map((group) => [
                <TableRow key={`m:${group.title}`}>
                  <TableCell
                    colSpan={columns.length + 1}
                    sx={{
                      bgcolor: 'background.neutral',
                      typography: 'overline',
                      color: 'text.secondary',
                    }}
                  >
                    {group.title}
                  </TableCell>
                </TableRow>,
                ...group.pages.map((page) => (
                  <TableRow key={page.key} hover>
                    <TableCell>
                      {page.title}
                      <Typography variant="caption" sx={{ color: 'text.disabled', ml: 0.75 }}>
                        · {page.groupTitle}
                      </Typography>
                    </TableCell>
                    {columns.map((col) => {
                      if (!allowed[col.code]?.has(page.key)) {
                        return (
                          <TableCell key={col.code} align="center">
                            <Tooltip title="Vai trò này không có quyền — cấp quyền ở tab Vai trò & quyền">
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                Không quyền
                              </Typography>
                            </Tooltip>
                          </TableCell>
                        );
                      }
                      const locked =
                        col.isAdmin && (page.key === 'staff.roles' || page.key === 'set.store');
                      if (locked) {
                        return (
                          <TableCell key={col.code} align="center">
                            <Tooltip title="Không ẩn được với chủ cửa hàng">
                              <Box
                                component="span"
                                sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                  color: 'text.secondary',
                                }}
                              >
                                <Iconify icon="solar:lock-keyhole-minimalistic-bold" width={14} />
                                <Typography variant="caption">Hiện</Typography>
                              </Box>
                            </Tooltip>
                          </TableCell>
                        );
                      }
                      const state = stateOf(col.code, page.key);
                      return (
                        <TableCell key={col.code} align="center">
                          <ButtonBase
                            onClick={() => cycle(col.code, page.key)}
                            aria-label={`${page.title} — ${col.label}: ${STATE_LABEL[state]}`}
                            sx={{ borderRadius: 1 }}
                          >
                            <Label
                              variant="soft"
                              color={STATE_COLOR[state]}
                              sx={{
                                minWidth: 64,
                                cursor: 'pointer',
                                ...(state === 'hide' && { textDecoration: 'line-through' }),
                              }}
                            >
                              {STATE_LABEL[state]}
                            </Label>
                          </ButtonBase>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                )),
              ])}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Stack>
  );
}
