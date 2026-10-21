import PaymentSectionLayout from 'src/sections/payment/view/payment-section-layout';

// ----------------------------------------------------------------------
// Mục Thanh toán (/dashboard/payment/*): đối soát, đơn online, tài khoản ngân hàng, báo có & kết nối.

type Props = {
  children: React.ReactNode;
};

export default function PaymentLayout({ children }: Props) {
  return <PaymentSectionLayout>{children}</PaymentSectionLayout>;
}
