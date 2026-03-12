import axios, { endpoints } from 'src/utils/axios';

import { ProductEditView } from 'src/sections/product/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Product Edit',
};

type Props = {
  params: {
    id: string;
  };
};

export default function ProductEditPage({ params }: Props) {
  const { id } = params;

  return <ProductEditView id={id} />;
}

// Commented out to avoid build-time API call
// export async function generateStaticParams() {
//   const res = await axios.get(endpoints.product.list);
//
//   return res.data.products.map((product: { id: string }) => ({
//     id: product.id,
//   }));
// }
