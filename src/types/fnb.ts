// ----------------------------------------------------------------------
// F&B — kiểu dữ liệu theo hợp đồng API v1 (core-be Docs/fnb/api-contract.md, mục 3 và 4). Chỉ phần thiết lập trên
// web: khu vực, bàn, thực đơn (hết món, món thêm), ghi chú nhanh. Gọi món / thanh toán làm trên app.
// ----------------------------------------------------------------------

export interface IDiningTable {
  id: string;
  branchId: string;
  areaId: string;
  name: string;
  seats: number | null;
  sortOrder: number;
  isActive: boolean;
}

export interface IDiningArea {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  tables: IDiningTable[];
}

export interface IFnbMenuVariant {
  productId: string;
  name: string | null;
  price: number;
  isSoldOut: boolean;
  sortOrder: number;
}

export interface IFnbMenuDish {
  id: string;
  categoryId: string | null;
  code: string;
  name: string;
  imageUrl: string | null;
  sortOrder: number;
  isSoldOut: boolean;
  priceFrom: number;
  variants: IFnbMenuVariant[];
  toppingIds: string[];
}

export interface IFnbMenuTopping {
  productId: string;
  name: string;
  price: number;
  isSoldOut: boolean;
  sortOrder: number;
}

export interface IFnbMenuCategory {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

export interface IFnbQuickNote {
  id: string;
  text: string;
  categoryIds: string[];
  sortOrder: number;
}

export interface IFnbMenu {
  branchId: string;
  menuVersion: string;
  generatedAt: string;
  categories: IFnbMenuCategory[];
  dishes: IFnbMenuDish[];
  toppings: IFnbMenuTopping[];
  quickNotes: IFnbQuickNote[];
}
