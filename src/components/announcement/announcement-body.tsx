import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';

import Link from '@mui/material/Link';

import { RouterLink } from 'src/routes/components';

import StyledMarkdown from 'src/components/markdown/styles';

import { isInternalPath } from './utils';

// ----------------------------------------------------------------------
// Nội dung thông báo. Không dùng components/markdown vì component đó bật rehype-raw (dựng HTML thô). Ở đây HTML thô bị bỏ, không có ảnh
// (tránh ảnh ngoài lộ IP người đọc), link chỉ bấm được khi là đường dẫn nội bộ; link ngoài hiện như chữ thường.
// ----------------------------------------------------------------------

const ALLOWED_ELEMENTS = [
  'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote', 'hr', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a',
];

const REMARK_PLUGINS = [remarkGfm];

const COMPONENTS = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) =>
    isInternalPath(href) ? (
      <Link component={RouterLink} href={href}>
        {children}
      </Link>
    ) : (
      <span>{children}</span>
    ),
};

/** Kiểu bài viết của StyledMarkdown (tiêu đề h1, trích dẫn to) quá lớn cho một hộp thoại. */
const COMPACT_SX = {
  overflowWrap: 'anywhere',
  '& > *:not(:first-child)': { mt: 1.5 },
  '& h1, & h2': { typography: 'h6' },
  '& h3, & h4, & h5, & h6': { typography: 'subtitle1' },
  '& p, & li': { typography: 'body2' },
  '& ul, & ol': { pl: 2.5 },
  '& ul li, & ol li': { lineHeight: 1.7 },
  '& blockquote': {
    m: 0,
    py: 1,
    px: 1.5,
    width: 'auto',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    borderLeft: '3px solid',
    borderColor: 'divider',
    borderRadius: 0,
    bgcolor: 'transparent',
    '&:before': { display: 'none' },
  },
  '& pre, & pre > code': { fontSize: 13, whiteSpace: 'pre-wrap' },
};

export default function AnnouncementBody({ body }: { body: string }) {
  return (
    <StyledMarkdown sx={COMPACT_SX}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        skipHtml
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        components={COMPONENTS}
      >
        {body}
      </ReactMarkdown>
    </StyledMarkdown>
  );
}
