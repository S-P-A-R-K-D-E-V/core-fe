import { redirect } from 'next/navigation';
import { paths } from 'src/routes/paths';

export default function UnitOfMeasurePage() {
  redirect(paths.dashboard.pos.unitOfMeasure.list);
}
