import { IAddressItem } from './address';

// ----------------------------------------------------------------------

export type ICheckoutItem = {
  id: string;
  name: string;
  coverUrl: string;
  available: number;
  price: number;
  colors: string[];
  size: string;
  quantity: number;
  subTotal: number;
};

export type ICheckoutValue = {
  total: number;
  subTotal: number;
  discount: number;
  shipping: number;
  activeStep: number;
  totalItems: number;
  items: ICheckoutItem[];
  billing: IAddressItem | null;
  orderId?: string;
};

export type CheckoutContextProps = ICheckoutValue & {
  completed: boolean;
  //
  onAddToCart: (newItem: Omit<ICheckoutItem, 'subTotal'>) => void;
  onDeleteCart: (itemId: string) => void;
  //
  onIncreaseQuantity: (itemId: string) => void;
  onDecreaseQuantity: (itemId: string) => void;
  //
  onBackStep: VoidFunction;
  onNextStep: VoidFunction;
  onGotoStep: (step: number) => void;
  //
  /** Đã đặt đơn online (máy chủ tạo đơn + mã thanh toán): làm trống giỏ, nhớ đơn trên máy này. */
  onOrderPlaced: (orderCode: string, token: string) => void;
  onApplyDiscount: (discount: number) => void;
  onApplyShipping: (discount: number) => void;
  //
  canReset: boolean;
  onReset: VoidFunction;
};
