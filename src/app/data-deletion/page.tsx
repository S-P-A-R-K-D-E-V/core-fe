import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Yêu cầu xóa dữ liệu – CiCi',
  description: 'Hướng dẫn yêu cầu xóa dữ liệu người dùng khỏi hệ thống CiCi',
};

// ----------------------------------------------------------------------

export default function DataDeletionPage() {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 6, md: 10 } }}>
      <Container maxWidth="sm">
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
          Yêu cầu xóa dữ liệu
        </Typography>

        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
          Nếu bạn muốn xóa dữ liệu cá nhân của mình khỏi hệ thống CiCi, vui lòng liên hệ quản trị
          viên qua email bên dưới. Chúng tôi sẽ xử lý yêu cầu trong vòng <strong>7 ngày làm việc</strong>.
        </Typography>

        <Box
          sx={{
            bgcolor: 'grey.100',
            borderRadius: 2,
            p: 3,
            borderLeft: '4px solid',
            borderColor: 'error.main',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Liên hệ quản trị viên
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            📧 Email:{' '}
            <a href="mailto:support@cici21chualang.vn" style={{ color: 'inherit' }}>
              support@cici21chualang.vn
            </a>
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            🌐 Website:{' '}
            <a href="https://cici21chualang.vn" style={{ color: 'inherit' }}>
              cici21chualang.vn
            </a>
          </Typography>
        </Box>

        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 4 }}>
          © {new Date().getFullYear()} CiCi – Tất cả các quyền được bảo lưu.
        </Typography>
      </Container>
    </Box>
  );
}
