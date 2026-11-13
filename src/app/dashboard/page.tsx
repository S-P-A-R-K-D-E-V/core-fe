import NavHomeRedirect from 'src/layouts/dashboard/nav/nav-home-redirect';

// ----------------------------------------------------------------------
// /dashboard → trang mở đầu của vai trò (chủ cửa hàng chọn trong Vai trò & quyền › Menu hiển thị); chưa chọn thì
// Kiểm quầy như trước.

export default function DashboardRootPage() {
  return <NavHomeRedirect />;
}
