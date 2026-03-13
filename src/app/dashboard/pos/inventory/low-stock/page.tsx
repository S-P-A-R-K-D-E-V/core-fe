import { InventoryListView } from 'src/sections/pos/inventory/view';

export const metadata = { title: 'Sắp hết hàng' };

export default function InventoryLowStockPage() {
  return <InventoryListView lowStockOnly />;
}
