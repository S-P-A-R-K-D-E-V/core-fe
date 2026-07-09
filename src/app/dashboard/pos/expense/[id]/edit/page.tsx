import { ExpenseEditView } from 'src/sections/expense/view';

export const metadata = { title: 'Sửa chi phí' };

type Props = { params: { id: string } };

export default function ExpenseEditPage({ params }: Props) {
  return <ExpenseEditView id={params.id} />;
}
