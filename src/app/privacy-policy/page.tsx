import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Chính sách quyền riêng tư – CiCi',
  description: 'Chính sách quyền riêng tư của ứng dụng CiCi',
};

const SECTIONS = [
  {
    title: '1. Thông tin chúng tôi thu thập',
    content: [
      'Khi bạn đăng ký và sử dụng CiCi, chúng tôi có thể thu thập các thông tin sau:',
      '• Thông tin tài khoản: họ tên, địa chỉ email, ảnh đại diện (khi đăng nhập qua Google hoặc Facebook).',
      '• Thông tin thiết bị: địa chỉ IP, loại trình duyệt, hệ điều hành, thông tin phiên đăng nhập.',
      '• Thông tin sử dụng: lịch sử hoạt động trong ứng dụng, nhật ký truy cập.',
      '• Dữ liệu nghiệp vụ: thông tin ca làm việc, chấm công, bảng lương và các dữ liệu liên quan mà bạn nhập vào hệ thống.',
    ],
  },
  {
    title: '2. Mục đích sử dụng thông tin',
    content: [
      'Chúng tôi sử dụng thông tin thu thập được để:',
      '• Cung cấp, vận hành và cải thiện các tính năng của ứng dụng.',
      '• Xác thực danh tính và bảo mật tài khoản người dùng.',
      '• Gửi thông báo liên quan đến hoạt động tài khoản và cập nhật dịch vụ.',
      '• Hỗ trợ kỹ thuật và giải quyết các sự cố phát sinh.',
      '• Tuân thủ các yêu cầu pháp lý hiện hành.',
    ],
  },
  {
    title: '3. Chia sẻ thông tin',
    content: [
      'CiCi không bán, trao đổi hoặc chuyển giao thông tin cá nhân của bạn cho bên thứ ba ngoại trừ:',
      '• Nhà cung cấp dịch vụ tin cậy hỗ trợ vận hành hệ thống (lưu trữ đám mây, gửi email) với cam kết bảo mật tương đương.',
      '• Trường hợp được yêu cầu bởi cơ quan có thẩm quyền theo quy định pháp luật.',
      '• Trường hợp bạn đã cấp quyền rõ ràng cho việc chia sẻ đó.',
    ],
  },
  {
    title: '4. Đăng nhập qua mạng xã hội (Google, Facebook)',
    content: [
      'Khi bạn sử dụng tính năng đăng nhập qua Google hoặc Facebook:',
      '• Chúng tôi chỉ nhận các thông tin cơ bản (tên, email, ảnh đại diện) mà bạn đồng ý chia sẻ.',
      '• Chúng tôi không lưu trữ mật khẩu tài khoản mạng xã hội của bạn.',
      '• Token xác thực được xác minh trực tiếp với Google/Facebook và không được lưu lâu dài.',
      '• Bạn có thể ngắt kết nối tài khoản mạng xã hội bất kỳ lúc nào trong phần Cài đặt tài khoản.',
    ],
  },
  {
    title: '5. Bảo mật dữ liệu',
    content: [
      'Chúng tôi áp dụng các biện pháp kỹ thuật và tổ chức phù hợp để bảo vệ thông tin của bạn:',
      '• Mã hóa dữ liệu truyền tải bằng HTTPS/TLS.',
      '• Mật khẩu được băm (hash) và không được lưu dưới dạng văn bản thuần.',
      '• Kiểm soát quyền truy cập nghiêm ngặt đối với dữ liệu nội bộ.',
      '• Theo dõi và ghi nhật ký các phiên đăng nhập để phát hiện truy cập bất thường.',
    ],
  },
  {
    title: '6. Lưu trữ và xóa dữ liệu',
    content: [
      '• Dữ liệu tài khoản được lưu trữ trong suốt thời gian tài khoản còn hoạt động.',
      '• Khi bạn yêu cầu xóa tài khoản, dữ liệu cá nhân sẽ được xóa hoặc ẩn danh hóa trong vòng 30 ngày.',
      '• Một số dữ liệu nhật ký có thể được giữ lại tối đa 90 ngày vì lý do bảo mật và kiểm toán.',
    ],
  },
  {
    title: '7. Quyền của người dùng',
    content: [
      'Bạn có quyền:',
      '• Truy cập và xem lại thông tin cá nhân chúng tôi lưu trữ về bạn.',
      '• Yêu cầu chỉnh sửa thông tin không chính xác.',
      '• Yêu cầu xóa tài khoản và dữ liệu liên quan.',
      '• Rút lại sự đồng ý đối với các xử lý dữ liệu không bắt buộc.',
      'Để thực hiện các quyền trên, vui lòng liên hệ: support@cici21chualang.vn',
    ],
  },
  {
    title: '8. Cookie và công nghệ theo dõi',
    content: [
      '• Chúng tôi sử dụng cookie phiên (session cookie) để duy trì trạng thái đăng nhập.',
      '• Chúng tôi có thể sử dụng các công cụ phân tích ẩn danh để hiểu cách người dùng tương tác với ứng dụng.',
      '• Bạn có thể tắt cookie trong cài đặt trình duyệt, tuy nhiên một số tính năng có thể bị ảnh hưởng.',
    ],
  },
  {
    title: '9. Thay đổi chính sách',
    content: [
      'Chúng tôi có thể cập nhật Chính sách quyền riêng tư này theo thời gian. Khi có thay đổi quan trọng, chúng tôi sẽ thông báo qua email hoặc thông báo nổi bật trong ứng dụng. Việc tiếp tục sử dụng dịch vụ sau khi thay đổi có hiệu lực đồng nghĩa với việc bạn chấp nhận chính sách mới.',
    ],
  },
  {
    title: '10. Liên hệ',
    content: [
      'Nếu bạn có câu hỏi hoặc khiếu nại liên quan đến chính sách này, vui lòng liên hệ:',
      '• Email: support@cici21chualang.vn',
      '• Website: https://cici21chualang.vn',
    ],
  },
];

// ----------------------------------------------------------------------

export default function PrivacyPolicyPage() {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 6, md: 10 } }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 2 }}>
            Chính sách quyền riêng tư
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Cập nhật lần cuối: 19 tháng 5, 2026
          </Typography>
        </Box>

        {/* Intro */}
        <Box
          sx={{
            bgcolor: 'primary.lighter',
            borderRadius: 2,
            p: 3,
            mb: 5,
            borderLeft: '4px solid',
            borderColor: 'primary.main',
          }}
        >
          <Typography variant="body1">
            CiCi (<strong>cici21chualang.vn</strong>) cam kết bảo vệ quyền riêng tư của bạn. Chính
            sách này mô tả cách chúng tôi thu thập, sử dụng và bảo vệ thông tin cá nhân khi bạn sử
            dụng nền tảng quản lý nhân sự và ca làm việc của chúng tôi.
          </Typography>
        </Box>

        {/* Sections */}
        {SECTIONS.map((section, index) => (
          <Box key={section.title}>
            {index > 0 && <Divider sx={{ my: 4 }} />}
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
              {section.title}
            </Typography>
            {section.content.map((line, i) => (
              <Typography
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                variant="body1"
                sx={{ color: 'text.secondary', mb: 1, lineHeight: 1.8 }}
              >
                {line}
              </Typography>
            ))}
          </Box>
        ))}

        {/* Footer note */}
        <Divider sx={{ my: 5 }} />
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', textAlign: 'center' }}>
          © {new Date().getFullYear()} CiCi – Tất cả các quyền được bảo lưu.
        </Typography>
      </Container>
    </Box>
  );
}
