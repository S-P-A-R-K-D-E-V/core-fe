import type { BoxProps } from '@mui/material/Box';

import Box from '@mui/material/Box';

import { newsContentSx } from 'src/components/news-editor/news-content-sx';

// ----------------------------------------------------------------------

type Props = BoxProps & {
  /** HTML đã lọc ở core-be (StorePostHtml.Sanitize) — chỉ thẻ định dạng an toàn. */
  html: string;
};

/** Nội dung bài tin tức: định dạng chữ cho HTML của bài (tiêu đề, đoạn, danh sách, trích dẫn, ảnh, link). */
export function NewsContent({ html, sx, ...other }: Props) {
  return (
    <Box
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
      sx={[newsContentSx, ...(Array.isArray(sx) ? sx : [sx])]}
      {...other}
    />
  );
}
