import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------
// Hướng dẫn xoá dữ liệu — URL khai với Meta ("Data Deletion Instructions URL" của app CiCi Sales) và với cửa hàng ứng dụng.
// Song ngữ: người duyệt của Meta đọc tiếng Anh. Quy trình thật: quản lý mở hội thoại của khách → "Xoá dữ liệu khách"
// (DELETE /conversations/{id}/customer-data). Đổi thời hạn / email ở đây thì đổi cả mục 5 + 8 của /privacy-policy.
// ----------------------------------------------------------------------

export const metadata = {
  title: 'Yêu cầu xoá dữ liệu / Data deletion – CiCi',
  description: 'Hướng dẫn yêu cầu xoá dữ liệu người dùng khỏi hệ thống CiCi (Fanpage Facebook, ứng dụng CiCi).',
};

const SUPPORT_EMAIL = 'support@cici21chualang.vn';
const PAGE_URL = 'https://m.me/275709846293360';

type Block = { title: string; lines: string[] };

const VI: Block[] = [
  {
    title: 'Dữ liệu nào có thể được xoá',
    lines: [
      '• Nếu bạn nhắn tin / bình luận trên Fanpage Cici Accessories: hội thoại, nội dung tin nhắn và bình luận, ảnh bạn gửi, tên và ảnh đại diện Facebook, mã người dùng theo trang (PSID), số điện thoại / địa chỉ bạn đã cung cấp trong hội thoại, nhật ký trợ lý tự động đã đọc hội thoại.',
      '• Nếu bạn là nhân viên / người dùng ứng dụng CiCi: tài khoản và dữ liệu cá nhân — xem thêm trang Xoá tài khoản (/account-deletion).',
    ],
  },
  {
    title: 'Cách gửi yêu cầu',
    lines: [
      '1. Nhắn "XOÁ DỮ LIỆU" vào Fanpage Cici Accessories, hoặc',
      `2. Gửi email tới ${SUPPORT_EMAIL} với tiêu đề "Xoá dữ liệu", ghi tên Facebook (và số điện thoại nếu đã cung cấp) để chúng tôi tìm đúng hội thoại.`,
      'Chúng tôi xác nhận đã nhận yêu cầu và xoá trong vòng 7 ngày làm việc, rồi báo lại cho bạn khi xong.',
    ],
  },
  {
    title: 'Dữ liệu được giữ lại',
    lines: [
      '• Hoá đơn và đơn hàng đã mua (món hàng, số tiền, tên, số điện thoại, địa chỉ giao) được giữ theo quy định kế toán, thuế; chỉ gỡ liên kết với hội thoại.',
      '• Tin nhắn trong Messenger do Meta lưu trên tài khoản Facebook của bạn và của trang — bạn có thể tự xoá trong Messenger.',
    ],
  },
  {
    title: 'Gỡ quyền ứng dụng CiCi Sales (dành cho quản trị viên trang)',
    lines: [
      'Nếu bạn đã cho ứng dụng "CiCi Sales" quyền quản lý trang: vào Facebook → Cài đặt và quyền riêng tư → Cài đặt → Tích hợp doanh nghiệp, chọn CiCi Sales → Gỡ. Hệ thống CiCi không lưu thông tin tài khoản Facebook cá nhân của bạn, chỉ lưu mã truy cập của trang; sau khi gỡ, mã đó hết hiệu lực và cửa hàng ngừng nhận tin của trang.',
    ],
  },
];

const EN: Block[] = [
  {
    title: 'What can be deleted',
    lines: [
      '• If you messaged or commented on the Cici Accessories Facebook Page: the conversation, your messages and comments, photos you sent, your Facebook name and profile picture, your page-scoped ID (PSID), the phone number / address you gave in the chat, and the logs of the shop assistant (AI) that read the conversation.',
      '• If you are a staff member / user of the CiCi app: your account and personal data — see /account-deletion.',
    ],
  },
  {
    title: 'How to request deletion',
    lines: [
      '1. Send "DELETE MY DATA" to the Cici Accessories Facebook Page, or',
      `2. Email ${SUPPORT_EMAIL} with the subject "Data deletion", including your Facebook name (and phone number if you shared one) so we can find your conversation.`,
      'We confirm receipt and delete the data within 7 working days, then notify you when it is done.',
    ],
  },
  {
    title: 'Data we keep',
    lines: [
      '• Invoices and orders you placed (items, amount, name, phone, delivery address) are kept as required by accounting and tax law; only their link to the conversation is removed.',
      '• Messages in Messenger are stored by Meta in your and the Page’s Facebook accounts — you can delete them in Messenger.',
    ],
  },
  {
    title: 'Removing the CiCi Sales app (Page admins)',
    lines: [
      'If you granted the "CiCi Sales" app access to manage your Page: Facebook → Settings & privacy → Settings → Business integrations → select CiCi Sales → Remove. CiCi does not store your personal Facebook account data, only the Page access token; after removal the token stops working and the shop no longer receives the Page’s messages.',
    ],
  },
];

function Section({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block) => (
        <Box key={block.title} sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            {block.title}
          </Typography>
          {block.lines.map((line) => (
            <Typography key={line} variant="body1" sx={{ color: 'text.secondary', mb: 0.75, lineHeight: 1.75 }}>
              {line}
            </Typography>
          ))}
        </Box>
      ))}
    </>
  );
}

export default function DataDeletionPage() {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 6, md: 10 } }}>
      <Container maxWidth="md">
        <Typography variant="overline" component="a" href="/" sx={{ color: 'primary.main', textDecoration: 'none' }}>
          CiCi
        </Typography>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
          Yêu cầu xoá dữ liệu
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.disabled', mb: 4 }}>
          Cập nhật: 20/11/2026 · Áp dụng cho Fanpage Cici Accessories, ứng dụng Meta “CiCi Sales” và ứng dụng CiCi.
        </Typography>

        <Section blocks={VI} />

        <Box
          sx={{ bgcolor: 'grey.100', borderRadius: 2, p: 3, my: 4, borderLeft: '4px solid', borderColor: 'primary.main' }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Liên hệ / Contact
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            Email:{' '}
            <a href={`mailto:${SUPPORT_EMAIL}?subject=Xoa%20du%20lieu%20%2F%20Data%20deletion`} style={{ color: 'inherit' }}>
              {SUPPORT_EMAIL}
            </a>
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            Fanpage:{' '}
            <a href={PAGE_URL} style={{ color: 'inherit' }} target="_blank" rel="noopener noreferrer">
              Cici Accessories (Messenger)
            </a>
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Chính sách quyền riêng tư / Privacy policy: <a href="/privacy-policy" style={{ color: 'inherit' }}>/privacy-policy</a>
          </Typography>
        </Box>

        <Divider sx={{ my: 4 }} />

        <Typography variant="h4" component="h2" sx={{ fontWeight: 700, mb: 3 }} lang="en">
          Data deletion request
        </Typography>
        <Box lang="en">
          <Section blocks={EN} />
        </Box>

        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 4 }}>
          © {new Date().getFullYear()} CiCi – Tất cả các quyền được bảo lưu.
        </Typography>
      </Container>
    </Box>
  );
}
