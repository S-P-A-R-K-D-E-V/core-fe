import NotificationDetailView from 'src/sections/notification-detail/notification-detail-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Chi tiết thông báo',
};

export default function NotificationDetailPage({ params }: { params: { id: string } }) {
  return <NotificationDetailView id={params.id} />;
}
