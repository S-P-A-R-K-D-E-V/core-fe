import remarkGfm from 'remark-gfm';
import ReactMarkdown, { type Components } from 'react-markdown';
import { memo, useMemo, Children, isValidElement, type ReactNode } from 'react';

import Box from '@mui/material/Box';

import { isHttpUrl, stripUiFence } from './chatbot-blocks';

// ----------------------------------------------------------------------
// Markdown của câu trả lời trợ lý. Nội dung do model viết nên:
//   - link chỉ http(s), luôn mở tab mới (noopener noreferrer); scheme khác chỉ hiện chữ;
//   - ảnh markdown ![alt](url) KHÔNG tự tải (URL tuỳ ý = lộ thông tin người xem) → hiện thành link;
//     ảnh thật đi qua khối image đã được server kiểm host (chatbot-message-blocks);
//   - bảng nằm trong hộp cuộn ngang riêng, khối mã cuộn ngang riêng → khung chat không bao giờ có
//     thanh cuộn ngang. Ô bảng ngắn (số tiền, ngày, tên) không xuống dòng — bảng rộng thì cuộn ngang
//     trong hộp của nó; chỉ ô chữ dài (ghi chú) mới tự xuống dòng ở bề rộng vừa phải.
// ----------------------------------------------------------------------

/** Ô bảng dài hơn ngần này ký tự thì cho xuống dòng. */
const LONG_CELL_CHARS = 32;

function textLength(children: ReactNode): number {
  let total = 0;
  Children.forEach(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      total += String(child).length;
    } else if (isValidElement(child)) {
      total += textLength((child.props as { children?: ReactNode }).children);
    }
  });
  return total;
}

const MARKDOWN_COMPONENTS: Components = {
  a({ node: _node, href, children, ...other }) {
    if (!isHttpUrl(href)) return <span>{children}</span>;
    return (
      <a {...other} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  img({ node: _node, src, alt }) {
    if (!isHttpUrl(src)) return <span>{alt || ''}</span>;
    return (
      <a href={src} target="_blank" rel="noopener noreferrer">
        {alt || 'Xem ảnh'}
      </a>
    );
  },
  table({ node: _node, ...other }) {
    return (
      <div className="chatbot-md-table">
        <table {...other} />
      </div>
    );
  },
  td({ node: _node, children, ...other }) {
    if (textLength(children) <= LONG_CELL_CHARS) return <td {...other}>{children}</td>;
    return (
      <td {...other}>
        <div className="chatbot-md-long-cell">{children}</div>
      </td>
    );
  },
};

const REMARK_PLUGINS = [remarkGfm];

type Props = {
  text: string;
};

function ChatbotMarkdown({ text }: Props) {
  const clean = useMemo(() => stripUiFence(text), [text]);

  return (
    <Box
      sx={{
        minWidth: 0,
        maxWidth: '100%',
        fontSize: 14,
        lineHeight: 1.6,
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        '& > :first-of-type': { mt: 0 },
        '& > :last-child': { mb: 0 },
        '& p': { m: 0, mb: 0.75 },
        '& h1, & h2, & h3, & h4, & h5, & h6': {
          m: 0,
          mt: 1.25,
          mb: 0.5,
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.4,
        },
        '& ul, & ol': { pl: 2.5, my: 0.5 },
        '& li': { mb: 0.25 },
        '& li > p': { mb: 0.25 },
        '& code': {
          bgcolor: 'action.hover',
          px: 0.5,
          borderRadius: 0.5,
          fontFamily: 'monospace',
          fontSize: 13,
        },
        '& pre': {
          bgcolor: 'action.hover',
          p: 1,
          borderRadius: 1,
          maxWidth: '100%',
          overflowX: 'auto',
          my: 0.75,
          '& code': {
            bgcolor: 'transparent',
            p: 0,
            whiteSpace: 'pre',
            overflowWrap: 'normal',
            wordBreak: 'normal',
          },
        },
        '& strong': { fontWeight: 700 },
        '& a': { color: 'primary.main', textDecoration: 'underline' },
        '& hr': { my: 1, border: 0, borderTop: '1px solid', borderColor: 'divider' },
        '& .chatbot-md-table': {
          maxWidth: '100%',
          overflowX: 'auto',
          my: 0.75,
          // Trong bảng không bẻ chữ giữa từ — bảng rộng thì cuộn ngang trong hộp này.
          overflowWrap: 'normal',
          wordBreak: 'normal',
        },
        '& table': {
          borderCollapse: 'collapse',
          fontSize: 13,
          // Rộng theo nội dung (ít nhất bằng bong bóng); rộng hơn bong bóng thì hộp ngoài cuộn ngang.
          width: 'max-content',
          minWidth: '100%',
        },
        '& th, & td': {
          border: '1px solid',
          borderColor: 'divider',
          p: '4px 8px',
          textAlign: 'left',
          verticalAlign: 'top',
          whiteSpace: 'nowrap',
        },
        '& th': { fontWeight: 600, bgcolor: 'action.hover' },
        '& .chatbot-md-long-cell': { width: 'max-content', maxWidth: 260, whiteSpace: 'normal' },
        '& blockquote': {
          borderLeft: '3px solid',
          borderColor: 'primary.main',
          pl: 1,
          ml: 0,
          mr: 0,
          my: 0.5,
          color: 'text.secondary',
        },
      }}
    >
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {clean}
      </ReactMarkdown>
    </Box>
  );
}

export default memo(ChatbotMarkdown);
