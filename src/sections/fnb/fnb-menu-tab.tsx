'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import { useSnackbar } from 'src/components/snackbar';

import type { IFnbMenu, IFnbMenuDish } from 'src/types/fnb';

import { getFnbMenu, setFnbSoldOut, setFnbDishToppings } from 'src/api/fnb';

// ----------------------------------------------------------------------
// Thực đơn của một chi nhánh F&B (GET /fnb/menu). Món là hàng hoá có Loại mặt hàng = Món; size là biến thể; món thêm là
// hàng hoá bật "Là món thêm". Ở đây: đánh dấu hết món theo chi nhánh (món, size, món thêm) và chọn món thêm được phép
// cho từng món (dùng chung mọi chi nhánh).
// ----------------------------------------------------------------------

const byOrder = <T extends { sortOrder: number; name?: string | null }>(a: T, b: T) =>
  a.sortOrder - b.sortOrder || (a.name ?? '').localeCompare(b.name ?? '', 'vi');

export default function FnbMenuTab({ branchId }: { branchId: string }) {
  const { enqueueSnackbar } = useSnackbar();

  const [menu, setMenu] = useState<IFnbMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toppingDish, setToppingDish] = useState<IFnbMenuDish | null>(null);
  const [toppingIds, setToppingIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMenu(await getFnbMenu(branchId));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được thực đơn'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [branchId, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    if (!menu) return [];
    const categories = [...menu.categories].sort(byOrder);
    const dishes = [...menu.dishes].sort(byOrder);
    const result = categories
      .map((c) => ({ id: c.id, name: c.name, dishes: dishes.filter((d) => d.categoryId === c.id) }))
      .filter((g) => g.dishes.length > 0);
    const orphan = dishes.filter((d) => !categories.some((c) => c.id === d.categoryId));
    if (orphan.length > 0) result.push({ id: 'none', name: 'Chưa có nhóm', dishes: orphan });
    return result;
  }, [menu]);

  const toggleSoldOut = async (productId: string, isSoldOut: boolean) => {
    setBusyId(productId);
    try {
      await setFnbSoldOut({ branchId, productId, isSoldOut });
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không cập nhật được'), { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const openToppings = (dish: IFnbMenuDish) => {
    setToppingDish(dish);
    setToppingIds(dish.toppingIds);
  };

  const saveToppings = async () => {
    if (!toppingDish) return;
    setSaving(true);
    try {
      await setFnbDishToppings(toppingDish.id, toppingIds, branchId);
      enqueueSnackbar('Đã lưu món thêm');
      setToppingDish(null);
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không lưu được món thêm'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toppings = useMemo(() => [...(menu?.toppings ?? [])].sort(byOrder), [menu]);
  const toppingName = (id: string) => toppings.find((t) => t.productId === id)?.name;

  return (
    <>
      <Alert
        severity="info"
        sx={{ mb: 3 }}
        action={
          <Button component={RouterLink} href={paths.dashboard.pos.product.new} color="inherit" size="small">
            Tạo món
          </Button>
        }
      >
        Món tạo ở trang Hàng hoá: chọn <strong>Loại mặt hàng = Món</strong>, size thêm bằng biến thể. Món thêm (trân
        châu, thêm shot…) bật <strong>Là món thêm</strong>.
      </Alert>

      {loading && !menu && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Đang tải...
        </Typography>
      )}

      {menu && groups.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 5 }}>
          Thực đơn chưa có món nào.
        </Typography>
      )}

      <Stack spacing={3}>
        {groups.map((group) => (
          <Card key={group.id} sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {group.name}
            </Typography>
            <Stack divider={<Divider flexItem />} spacing={1.5}>
              {group.dishes.map((dish) => (
                <Stack key={dish.id} spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Stack sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
                        {dish.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {dish.code} · từ {fCurrency(dish.priceFrom)}
                        {dish.toppingIds.length > 0 &&
                          ` · món thêm: ${dish.toppingIds.map(toppingName).filter(Boolean).join(', ')}`}
                      </Typography>
                    </Stack>
                    <Button size="small" onClick={() => openToppings(dish)} disabled={toppings.length === 0}>
                      Món thêm
                    </Button>
                    <FormControlLabel
                      label="Hết món"
                      control={
                        <Switch
                          color="error"
                          checked={dish.isSoldOut}
                          disabled={busyId === dish.id}
                          onChange={(e) => toggleSoldOut(dish.id, e.target.checked)}
                        />
                      }
                    />
                  </Stack>
                  {dish.variants.length > 1 && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {[...dish.variants].sort(byOrder).map((v) => (
                        <Chip
                          key={v.productId}
                          size="small"
                          color={v.isSoldOut ? 'error' : 'default'}
                          variant={v.isSoldOut ? 'soft' : 'outlined'}
                          label={`${v.name ?? ''} · ${fCurrency(v.price)}${v.isSoldOut ? ' · hết' : ''}`}
                          disabled={busyId === v.productId}
                          onClick={() => toggleSoldOut(v.productId, !v.isSoldOut)}
                        />
                      ))}
                    </Stack>
                  )}
                </Stack>
              ))}
            </Stack>
          </Card>
        ))}

        {toppings.length > 0 && (
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Món thêm
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {toppings.map((t) => (
                <Chip
                  key={t.productId}
                  color={t.isSoldOut ? 'error' : 'default'}
                  variant={t.isSoldOut ? 'soft' : 'outlined'}
                  label={`${t.name} · ${fCurrency(t.price)}${t.isSoldOut ? ' · hết' : ''}`}
                  disabled={busyId === t.productId}
                  onClick={() => toggleSoldOut(t.productId, !t.isSoldOut)}
                />
              ))}
            </Stack>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
              Bấm vào món thêm hoặc size để đánh dấu hết / có lại ở chi nhánh này.
            </Typography>
          </Card>
        )}
      </Stack>

      <Dialog fullWidth maxWidth="xs" open={!!toppingDish} onClose={() => setToppingDish(null)}>
        <DialogTitle>Món thêm của {toppingDish?.name}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            Áp dụng cho món này ở mọi chi nhánh. Thứ tự hiển thị theo thứ tự chọn.
          </Typography>
          <Stack>
            {toppings.map((t) => (
              <FormControlLabel
                key={t.productId}
                label={`${t.name} · ${fCurrency(t.price)}`}
                control={
                  <Checkbox
                    checked={toppingIds.includes(t.productId)}
                    onChange={() =>
                      setToppingIds((prev) =>
                        prev.includes(t.productId) ? prev.filter((x) => x !== t.productId) : [...prev, t.productId]
                      )
                    }
                  />
                }
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setToppingDish(null)}>
            Huỷ
          </Button>
          <LoadingButton variant="contained" loading={saving} onClick={saveToppings}>
            Lưu
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
