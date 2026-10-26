import type { Theme } from '@mui/material/styles';

// ----------------------------------------------------------------------

/** Định dạng chữ của nội dung bài — dùng chung cho trang công khai và khung soạn bài (editor). */
export const newsContentSx = (theme: Theme) => ({
  typography: 'body1',
  color: 'text.primary',
  wordBreak: 'break-word',
  '& > :first-child': { mt: 0 },
  '& h2': { ...theme.typography.h4, mt: 5, mb: 2 },
  '& h3': { ...theme.typography.h5, mt: 4, mb: 1.5 },
  '& h4': { ...theme.typography.h6, mt: 3, mb: 1 },
  '& p': { my: 2, lineHeight: 1.85 },
  '& ul, & ol': { pl: 3, my: 2, '& li': { my: 0.75, lineHeight: 1.8 } },
  '& a': { color: 'primary.dark', textDecoration: 'underline', textUnderlineOffset: '3px' },
  '& blockquote': {
    m: 0,
    my: 4,
    py: 2,
    px: 3,
    borderRadius: 1.5,
    typography: 'h6',
    fontStyle: 'italic',
    color: 'text.secondary',
    bgcolor: 'background.neutral',
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    '& p': { my: 0 },
  },
  '& img': {
    display: 'block',
    maxWidth: 1,
    height: 'auto',
    mx: 'auto',
    my: 3,
    borderRadius: 2,
  },
  '& figure': {
    m: 0,
    my: 3,
    '& figcaption': { typography: 'caption', color: 'text.secondary', textAlign: 'center' },
  },
  '& hr': { my: 4, border: 0, borderTop: `1px dashed ${theme.palette.divider}` },
  '& pre, & code': {
    fontFamily: 'monospace',
    fontSize: '0.9em',
    bgcolor: 'background.neutral',
    borderRadius: 1,
  },
  '& code': { px: 0.5 },
  '& pre': { p: 2, overflowX: 'auto' },
  '& table': {
    width: 1,
    my: 3,
    borderCollapse: 'collapse',
    '& th, & td': { p: 1.25, border: `1px solid ${theme.palette.divider}` },
    '& th': { bgcolor: 'background.neutral', fontWeight: 600 },
  },
});
