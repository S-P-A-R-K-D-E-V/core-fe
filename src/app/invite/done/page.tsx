import { StaffInviteDoneView } from 'src/sections/invite/staff-invite-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Đã nhận lời mời',
  robots: { index: false, follow: false },
};

export default function StaffInviteDonePage() {
  return <StaffInviteDoneView />;
}
