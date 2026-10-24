import Typography from '@mui/material/Typography';
import Paper, { PaperProps } from '@mui/material/Paper';

// ----------------------------------------------------------------------

interface Props extends PaperProps {
  query?: string;
}

export default function SearchNotFound({ query, sx, ...other }: Props) {
  return query ? (
    <Paper
      sx={{
        bgcolor: 'unset',
        textAlign: 'center',
        ...sx,
      }}
      {...other}
    >
      <Typography variant="h6" gutterBottom>
        Không tìm thấy
      </Typography>

      <Typography variant="body2">
        Không có kết quả cho &nbsp;
        <strong>&quot;{query}&quot;</strong>.
        <br /> Thử kiểm tra lỗi chính tả hoặc gõ đủ từ.
      </Typography>
    </Paper>
  ) : (
    <Typography variant="body2" sx={sx}>
      Nhập từ khoá để tìm
    </Typography>
  );
}
