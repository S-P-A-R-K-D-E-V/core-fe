import StaffInviteView from 'src/sections/invite/staff-invite-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Lời mời làm nhân viên',
  robots: { index: false, follow: false },
};

type Props = {
  params: { token: string };
};

export default function StaffInvitePage({ params }: Props) {
  return <StaffInviteView token={params.token} />;
}
