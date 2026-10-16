import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------
// Việc vai trò hệ thống làm được sẵn (Core-be SystemRoleProfiles) — không nằm trong danh mục quyền chi tiết nên thiếu nó
// thì Nhân viên và Người dùng trông như nhau (cùng 0 quyền).

type Props = {
  baseline?: readonly string[];
  title?: string;
};

export default function SystemRoleBaseline({ baseline, title = 'Làm được sẵn theo vai trò' }: Props) {
  if (!baseline?.length) return null;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary', typography: 'body2' }}>
        {baseline.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </Box>
    </Box>
  );
}
