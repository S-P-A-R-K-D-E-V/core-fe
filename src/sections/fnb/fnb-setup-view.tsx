'use client';

import { useState, useEffect } from 'react';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';

import { paths } from 'src/routes/paths';

import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { IBranchLocation } from 'src/types/corecms-api';

import { getBranchLocations } from 'src/api/attendance';

import FnbMenuTab from './fnb-menu-tab';
import FnbRecipeTab from './fnb-recipe-tab';
import FnbFloorTab from './fnb-floor-tab';
import FnbQuickNotesTab from './fnb-quick-notes-tab';

// ----------------------------------------------------------------------
// Thiết lập F&B trên web (Admin / Quản lý): khu vực và bàn theo chi nhánh, thực đơn theo chi nhánh (hết món, món thêm
// của từng món), ghi chú nhanh dùng chung cửa hàng. Món tạo ở trang Hàng hoá (Loại mặt hàng = Món). Gọi món, gửi bar,
// thanh toán làm trên app.
// ----------------------------------------------------------------------

const TABS = [
  { value: 'floor', label: 'Khu vực & bàn', icon: 'solar:sofa-bold' },
  { value: 'menu', label: 'Thực đơn', icon: 'solar:cup-hot-bold' },
  { value: 'recipes', label: 'Định lượng', icon: 'solar:scale-bold' },
  { value: 'notes', label: 'Ghi chú nhanh', icon: 'solar:notes-bold' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

export default function FnbSetupView() {
  const settings = useSettingsContext();
  const [tab, setTab] = useState<TabValue>('floor');
  const [branches, setBranches] = useState<IBranchLocation[] | null>(null);
  const [branchId, setBranchId] = useState('');

  useEffect(() => {
    getBranchLocations()
      .then((list) => {
        const fnb = list.filter((b) => b.isActive !== false && b.businessType?.toLowerCase() === 'fnb');
        setBranches(fnb);
        setBranchId((current) => current || fnb[0]?.id || '');
      })
      .catch(() => setBranches([]));
  }, []);

  const needsBranch = tab !== 'notes';

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Thiết lập F&B"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Thiết lập F&B' }]}
        action={
          needsBranch && branches && branches.length > 0 ? (
            <TextField
              select
              size="small"
              label="Chi nhánh"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.branchName}
                </MenuItem>
              ))}
            </TextField>
          ) : null
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: { xs: 3, md: 4 } }}>
        {TABS.map((t) => (
          <Tab key={t.value} value={t.value} label={t.label} icon={<Iconify icon={t.icon} width={24} />} />
        ))}
      </Tabs>

      {needsBranch && branches?.length === 0 && (
        <Alert severity="info">
          Cửa hàng chưa có chi nhánh loại hình F&amp;B đang hoạt động. Thêm chi nhánh F&amp;B ở Console rồi quay lại
          trang này.
        </Alert>
      )}

      {tab === 'floor' && branchId && <FnbFloorTab key={branchId} branchId={branchId} />}
      {tab === 'menu' && branchId && <FnbMenuTab key={branchId} branchId={branchId} />}
      {tab === 'recipes' && branchId && <FnbRecipeTab key={branchId} branchId={branchId} />}
      {tab === 'notes' && <FnbQuickNotesTab />}
    </Container>
  );
}
