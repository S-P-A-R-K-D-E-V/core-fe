import { redirect } from 'next/navigation';
import { paths } from 'src/routes/paths';

export default function VariantAttributePage() {
  redirect(paths.dashboard.pos.variantAttribute.list);
}
