// ----------------------------------------------------------------------
// Chính sách quyền riêng tư của nền tảng cửa hàng (app "Spark Store" + web của các cửa hàng SaaS) —
// trung tính, không gắn CiCi. Hiện trên auth.devbyspark.com và <mã>.store.devbyspark.com; đây là URL
// khai với App Store Connect. Nội dung khớp màn Pháp lý của app (core-mobile
// src/features/settings/legal-store.ts) — sửa một bên thì sửa cả bên kia.
// ----------------------------------------------------------------------

export const SAAS_PRODUCT_NAME = process.env.NEXT_PUBLIC_SAAS_PRODUCT_NAME || 'Spark Store';
export const SAAS_SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'binh.vx@cici21chualang.vn';

export type PolicySection = { title: string; content: string[] };

export type PolicyLanguage = {
  lang: 'en' | 'vi';
  heading: string;
  updated: string;
  intro: string;
  sections: PolicySection[];
};

export const SAAS_PRIVACY: PolicyLanguage[] = [
  {
    lang: 'en',
    heading: 'Privacy Policy',
    updated: 'Last updated: October 1, 2026',
    intro:
      `${SAAS_PRODUCT_NAME} is a platform businesses (stores) use to run their teams: attendance, shifts, payroll, ` +
      'team chat and store reports. This policy explains what we collect when you use the app or a store’s website on ' +
      'our platform, and how it is used.',
    sections: [
      {
        title: '1. Who is responsible',
        content: [
          'The store that invited you decides what data is collected about you and why. We operate the platform and ' +
            'process that data on the store’s behalf.',
        ],
      },
      {
        title: '2. What we collect',
        content: [
          '• Account: name, email, profile photo; Sign in with Apple or Google identifiers when you use them.',
          '• Location (GPS): only when you check in/out or count the cash drawer, to confirm you are at the store.',
          '• Face photos: taken at check-in and during face enrollment to verify it is really you.',
          '• Work data: shifts, attendance, pay, requests, chat messages and anything you enter.',
          '• Device: push-notification token, app version, IP address and crash diagnostics.',
        ],
      },
      {
        title: '3. How we use it',
        content: [
          '• Verify check-ins and prevent attendance fraud.',
          '• Show your schedule and pay, and notify you about them.',
          '• Secure your account, provide support and keep the service running.',
        ],
      },
      {
        title: '4. AI assistant',
        content: [
          'If your store turns on the AI assistant, the questions you type and the store data needed to answer them ' +
            '(for example sales, products, shifts or pay) are sent to an AI service provider to generate the answer. ' +
            'The assistant only reads data and never changes it. The app asks for your permission before you use it ' +
            'the first time. Please avoid typing sensitive personal information.',
        ],
      },
      {
        title: '5. Sharing',
        content: [
          'We do not sell personal data. Data is shared only with the store you work for, with service providers that ' +
            'run the platform (cloud hosting, email and push notifications, AI when enabled), or when the law requires it.',
        ],
      },
      {
        title: '6. Security and retention',
        content: [
          '• Data is encrypted in transit (HTTPS/TLS) and passwords are hashed.',
          '• Check-in photos and locations are kept as long as the related attendance and payroll records.',
          '• When you delete your account, your personal data is deleted or anonymised; your name remains on ' +
            'timesheets and payslips that already exist.',
        ],
      },
      {
        title: '7. Your rights',
        content: [
          'You can view and edit your profile in the app and delete your account under Me → Delete account. ' +
            'To access, correct or delete other data, contact your store administrator or ' +
            `${SAAS_SUPPORT_EMAIL}.`,
        ],
      },
      {
        title: '8. Changes and contact',
        content: [
          'We may update this policy and will announce important changes in the app. Questions: ' + SAAS_SUPPORT_EMAIL + '.',
        ],
      },
    ],
  },
  {
    lang: 'vi',
    heading: 'Chính sách quyền riêng tư',
    updated: 'Cập nhật lần cuối: 01/10/2026',
    intro:
      `${SAAS_PRODUCT_NAME} là nền tảng các doanh nghiệp (cửa hàng) dùng để quản lý đội ngũ: chấm công, ca làm, lương, ` +
      'nhắn tin nội bộ và báo cáo cửa hàng. Chính sách này mô tả thông tin chúng tôi thu thập khi bạn dùng ứng dụng ' +
      'hoặc trang web của một cửa hàng trên nền tảng, và cách sử dụng.',
    sections: [
      {
        title: '1. Ai chịu trách nhiệm',
        content: [
          'Cửa hàng mời bạn quyết định dữ liệu nào được thu thập và vì sao. Chúng tôi vận hành nền tảng và xử lý ' +
            'dữ liệu thay cho cửa hàng.',
        ],
      },
      {
        title: '2. Thông tin thu thập',
        content: [
          '• Tài khoản: họ tên, email, ảnh đại diện; định danh Sign in with Apple hoặc Google khi bạn dùng.',
          '• Vị trí (GPS): chỉ khi chấm công hoặc kiểm tiền quầy, để xác nhận bạn đang ở cửa hàng.',
          '• Ảnh khuôn mặt: chụp khi chấm công và khi đăng ký khuôn mặt để xác thực đúng người.',
          '• Dữ liệu công việc: ca làm, chấm công, lương, yêu cầu, tin nhắn và mọi thông tin bạn nhập.',
          '• Thiết bị: mã nhận thông báo, phiên bản ứng dụng, địa chỉ IP và thông tin lỗi.',
        ],
      },
      {
        title: '3. Mục đích sử dụng',
        content: [
          '• Xác minh chấm công, chống gian lận.',
          '• Hiển thị lịch làm, lương và gửi thông báo liên quan.',
          '• Bảo mật tài khoản, hỗ trợ và duy trì dịch vụ.',
        ],
      },
      {
        title: '4. Trợ lý AI',
        content: [
          'Khi cửa hàng bật trợ lý AI, câu hỏi bạn nhập và dữ liệu cửa hàng cần để trả lời (ví dụ doanh thu, hàng hoá, ' +
            'ca làm, lương) được gửi tới nhà cung cấp dịch vụ AI để tạo câu trả lời. Trợ lý chỉ đọc, không thay đổi dữ ' +
            'liệu. Ứng dụng xin phép bạn trước lần dùng đầu tiên. Không nên nhập thông tin cá nhân nhạy cảm.',
        ],
      },
      {
        title: '5. Chia sẻ',
        content: [
          'Chúng tôi không bán dữ liệu cá nhân. Dữ liệu chỉ được chia sẻ với cửa hàng bạn làm việc, các nhà cung cấp vận ' +
            'hành nền tảng (lưu trữ đám mây, email và thông báo, AI khi được bật), hoặc khi pháp luật yêu cầu.',
        ],
      },
      {
        title: '6. Bảo mật và lưu trữ',
        content: [
          '• Dữ liệu được mã hoá khi truyền (HTTPS/TLS), mật khẩu được băm.',
          '• Ảnh và vị trí chấm công được lưu cùng thời hạn với bảng công, bảng lương liên quan.',
          '• Khi bạn xoá tài khoản, dữ liệu cá nhân được xoá hoặc ẩn danh; họ tên vẫn giữ trên bảng công, bảng lương đã ' +
            'phát sinh.',
        ],
      },
      {
        title: '7. Quyền của bạn',
        content: [
          'Bạn có thể xem, sửa hồ sơ trong ứng dụng và xoá tài khoản tại Tôi → Xoá tài khoản. Để xem, sửa hoặc xoá dữ ' +
            `liệu khác, liên hệ quản trị viên cửa hàng hoặc ${SAAS_SUPPORT_EMAIL}.`,
        ],
      },
      {
        title: '8. Thay đổi và liên hệ',
        content: [
          'Chính sách có thể được cập nhật; thay đổi quan trọng sẽ được thông báo trong ứng dụng. Liên hệ: ' +
            SAAS_SUPPORT_EMAIL + '.',
        ],
      },
    ],
  },
];
