// ----------------------------------------------------------------------
// Trang "Hỗ trợ" công khai — Support URL khai với App Store Connect và ô Website / email liên hệ trên Google Play.
// Câu trả lời khớp cách app hoạt động (đăng nhập theo cửa hàng, chấm công GPS + khuôn mặt, thông báo, xoá tài khoản).
// ----------------------------------------------------------------------

import type { PolicySection } from './saas-privacy-content';

export type SupportLanguage = {
  lang: 'en' | 'vi';
  heading: string;
  intro: string;
  contactLabel: string;
  sections: PolicySection[];
};

export function supportContent(product: string, supportEmail: string): SupportLanguage[] {
  return [
    {
      lang: 'en',
      heading: 'Support',
      intro:
        `Need help with ${product}? Most questions about your account, shifts or pay are answered fastest by the ` +
        'manager of your store. For problems with the app itself, contact us and we will reply within 2 business days.',
      contactLabel: 'Contact us',
      sections: [
        {
          title: 'How do I sign in?',
          content: [
            `${product} accounts are created by a store. On the first screen tap "Sign in with email account", ` +
              'enter the store code your store owner gave you, then your email and password.',
            'If your account is linked to Google or Apple, tap "Continue with Google" or "Continue with Apple" instead.',
          ],
        },
        {
          title: 'I do not know my store code',
          content: [
            'Ask your store owner or manager. The store code is the first part of the store’s web address ' +
              '(for example "mystore" in mystore.store.devbyspark.com). You can also leave the field empty: the app ' +
              'then finds the stores your account belongs to.',
          ],
        },
        {
          title: 'I forgot my password',
          content: [
            'Reset it on your store’s website, or ask your store manager to set a new one. If you signed in with ' +
              'Google or Apple before, you can keep using that button.',
          ],
        },
        {
          title: 'Check-in does not work',
          content: [
            '• Allow Location and Camera for the app in your phone settings.',
            '• Check-in only works when you are at the store and have a shift today.',
            '• If face check fails, enrol your face again in Profile, in good light.',
          ],
        },
        {
          title: 'I do not receive notifications',
          content: [
            'Allow notifications for the app in your phone settings, then open the app once while signed in to your store.',
          ],
        },
        {
          title: 'Wrong shift, attendance or pay data',
          content: [
            'This data belongs to your store. Send a request in the app (Requests) or talk to your store manager; ' +
              'we cannot change a store’s records ourselves.',
          ],
        },
        {
          title: 'Privacy and deleting your account',
          content: [
            'You can delete your account in the app under Profile → Delete account. See also the pages below.',
          ],
        },
      ],
    },
    {
      lang: 'vi',
      heading: 'Hỗ trợ',
      intro:
        `Cần trợ giúp khi dùng ${product}? Phần lớn câu hỏi về tài khoản, ca làm hay lương được quản lý cửa hàng của ` +
        'bạn giải đáp nhanh nhất. Với lỗi của chính ứng dụng, hãy liên hệ chúng tôi — chúng tôi trả lời trong 2 ngày làm việc.',
      contactLabel: 'Liên hệ',
      sections: [
        {
          title: 'Đăng nhập thế nào?',
          content: [
            `Tài khoản ${product} do cửa hàng tạo. Ở màn hình đầu, bấm "Đăng nhập bằng tài khoản email", nhập mã cửa ` +
              'hàng do chủ cửa hàng cung cấp, rồi email và mật khẩu.',
            'Nếu tài khoản đã liên kết Google hoặc Apple, chỉ cần bấm "Tiếp tục với Google" hoặc "Tiếp tục với Apple".',
          ],
        },
        {
          title: 'Tôi không biết mã cửa hàng',
          content: [
            'Hãy hỏi chủ cửa hàng hoặc quản lý. Mã cửa hàng là phần đầu địa chỉ web của cửa hàng (ví dụ "cuahang" ' +
              'trong cuahang.store.devbyspark.com). Bạn cũng có thể để trống ô này: ứng dụng sẽ tự tìm các cửa hàng mà ' +
              'tài khoản của bạn thuộc về.',
          ],
        },
        {
          title: 'Tôi quên mật khẩu',
          content: [
            'Đặt lại mật khẩu trên trang web của cửa hàng, hoặc nhờ quản lý cửa hàng đặt mật khẩu mới. Nếu trước đây ' +
              'bạn đăng nhập bằng Google hoặc Apple thì vẫn dùng tiếp được nút đó.',
          ],
        },
        {
          title: 'Không chấm công được',
          content: [
            '• Cho phép ứng dụng dùng Vị trí và Camera trong phần cài đặt của điện thoại.',
            '• Chỉ chấm công được khi bạn đang ở cửa hàng và có ca làm hôm nay.',
            '• Nếu nhận diện khuôn mặt không khớp, hãy đăng ký lại khuôn mặt trong Hồ sơ, ở nơi đủ sáng.',
          ],
        },
        {
          title: 'Không nhận được thông báo',
          content: [
            'Cho phép ứng dụng gửi thông báo trong cài đặt điện thoại, rồi mở ứng dụng một lần khi đang đăng nhập cửa hàng.',
          ],
        },
        {
          title: 'Dữ liệu ca làm, chấm công hoặc lương bị sai',
          content: [
            'Dữ liệu này thuộc về cửa hàng của bạn. Hãy gửi yêu cầu trong ứng dụng (mục Yêu cầu) hoặc trao đổi với quản ' +
              'lý cửa hàng; chúng tôi không tự sửa sổ sách của cửa hàng.',
          ],
        },
        {
          title: 'Quyền riêng tư và xoá tài khoản',
          content: ['Bạn có thể xoá tài khoản trong ứng dụng tại Hồ sơ → Xoá tài khoản. Xem thêm các trang bên dưới.'],
        },
      ],
    },
  ];
}
