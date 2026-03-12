import { UserEditView } from 'src/sections/user/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: User Edit',
};

type Props = {
  params: {
    id: string;
  };
};

export default function UserEditPage({ params }: Props) {
  const { id } = params;

  return <UserEditView id={id} />;
}
