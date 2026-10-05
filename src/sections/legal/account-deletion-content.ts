// ----------------------------------------------------------------------
// Trang "Yêu cầu xoá tài khoản" — URL khai với Google Play (mục Data safety → Account deletion) và App Store.
// Nội dung khớp việc xoá thật ở core-be (DeleteMyAccountCommand): xoá gì, giữ gì. Sửa bên đó thì sửa ở đây.
// ----------------------------------------------------------------------

import type { PolicySection } from './saas-privacy-content';

export type DeletionLanguage = {
  lang: 'en' | 'vi';
  heading: string;
  intro: string;
  sections: PolicySection[];
};

export function accountDeletionContent(product: string, supportEmail: string): DeletionLanguage[] {
  return [
    {
      lang: 'en',
      heading: 'Delete your account',
      intro:
        `This page explains how to delete your ${product} account and the data linked to it. ` +
        'You can delete the account yourself in the app, or ask us to do it by email.',
      sections: [
        {
          title: '1. Delete it in the app (fastest)',
          content: [
            `1. Open the ${product} app and sign in.`,
            '2. Go to Profile (tap your avatar).',
            '3. Tap "Delete account" and confirm.',
            'The account is deleted immediately and you are signed out on every device.',
          ],
        },
        {
          title: '2. Request deletion by email',
          content: [
            `If you cannot sign in or no longer have the app, send an email to ${supportEmail} from the email address ` +
              'of the account, with the subject "Delete my account" and the name of your store (if you know it).',
            'We may ask you to confirm that the account is yours. We delete it within 30 days of your confirmed request.',
          ],
        },
        {
          title: '3. What is deleted',
          content: [
            '• Sign-in details: password, linked Google / Apple / Facebook sign-in, all sessions.',
            '• Contact and identity details: email address, phone number, address, bank account, ID card photos.',
            '• Profile photo and face-recognition data used for attendance.',
            '• Push-notification registrations on all your devices.',
          ],
        },
        {
          title: '4. What is kept, and for how long',
          content: [
            '• Your name stays on attendance records, payslips and invoices that already exist. Stores must keep ' +
              'these accounting and payroll records for the period required by law (up to 10 years in Vietnam).',
            '• Security and access logs may be kept for up to 90 days.',
            'After deletion nobody can sign in to the account, and it cannot be restored.',
          ],
        },
        {
          title: '5. Delete only some data',
          content: [
            'To correct or delete specific data without deleting the account (for example a profile photo, a face ' +
              `enrolment or a chat attachment), edit it in the app or contact your store administrator or ${supportEmail}.`,
          ],
        },
        {
          title: '6. Store owners',
          content: [
            'The last administrator of a store cannot delete their account while the store is still active. Hand the ' +
              `store over to another administrator first, or email ${supportEmail} to close the store and delete its data.`,
          ],
        },
      ],
    },
    {
      lang: 'vi',
      heading: 'Xoá tài khoản',
      intro:
        `Trang này hướng dẫn cách xoá tài khoản ${product} và dữ liệu gắn với tài khoản. ` +
        'Bạn có thể tự xoá ngay trong ứng dụng, hoặc gửi email yêu cầu chúng tôi xoá.',
      sections: [
        {
          title: '1. Xoá trong ứng dụng (nhanh nhất)',
          content: [
            `1. Mở ứng dụng ${product} và đăng nhập.`,
            '2. Vào Hồ sơ (bấm ảnh đại diện).',
            '3. Bấm "Xoá tài khoản" và xác nhận.',
            'Tài khoản bị xoá ngay và bạn được đăng xuất trên mọi thiết bị.',
          ],
        },
        {
          title: '2. Gửi yêu cầu xoá qua email',
          content: [
            `Nếu bạn không đăng nhập được hoặc không còn ứng dụng, hãy gửi email tới ${supportEmail} từ chính địa chỉ ` +
              'email của tài khoản, tiêu đề "Xoá tài khoản", kèm tên cửa hàng (nếu biết).',
            'Chúng tôi có thể hỏi lại để xác nhận tài khoản là của bạn. Tài khoản được xoá trong vòng 30 ngày kể từ ' +
              'khi yêu cầu được xác nhận.',
          ],
        },
        {
          title: '3. Dữ liệu bị xoá',
          content: [
            '• Thông tin đăng nhập: mật khẩu, liên kết đăng nhập Google / Apple / Facebook, mọi phiên đăng nhập.',
            '• Thông tin liên hệ và định danh: email, số điện thoại, địa chỉ, tài khoản ngân hàng, ảnh CCCD.',
            '• Ảnh đại diện và dữ liệu nhận diện khuôn mặt dùng để chấm công.',
            '• Đăng ký nhận thông báo trên mọi thiết bị của bạn.',
          ],
        },
        {
          title: '4. Dữ liệu được giữ lại và thời hạn',
          content: [
            '• Họ tên của bạn vẫn nằm trên bảng công, bảng lương và hoá đơn đã phát sinh. Cửa hàng phải lưu các chứng ' +
              'từ kế toán, tiền lương này theo thời hạn pháp luật quy định (tối đa 10 năm tại Việt Nam).',
            '• Nhật ký bảo mật và truy cập có thể được giữ tối đa 90 ngày.',
            'Sau khi xoá, không ai đăng nhập được vào tài khoản và không khôi phục lại được.',
          ],
        },
        {
          title: '5. Chỉ xoá một phần dữ liệu',
          content: [
            'Muốn sửa hoặc xoá một số dữ liệu mà không xoá tài khoản (ví dụ ảnh đại diện, dữ liệu khuôn mặt, tệp đã gửi ' +
              `trong trò chuyện), hãy sửa trong ứng dụng hoặc liên hệ quản trị viên cửa hàng hay ${supportEmail}.`,
          ],
        },
        {
          title: '6. Chủ cửa hàng',
          content: [
            'Quản trị viên cuối cùng của một cửa hàng không tự xoá được tài khoản khi cửa hàng còn hoạt động. Hãy ' +
              `chuyển quyền quản trị cho người khác trước, hoặc gửi email tới ${supportEmail} để đóng cửa hàng và xoá dữ liệu của cửa hàng.`,
          ],
        },
      ],
    },
  ];
}
