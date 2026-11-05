'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';

import { useStoreBrand } from 'src/components/branding';

import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { STAFF_GUIDE } from './staff-guide-content';

import type { GuideBlock, GuideSection } from './staff-guide-types';

// ----------------------------------------------------------------------
// Hướng dẫn sử dụng app S Store cho nhân viên CiCi, kèm tóm tắt nội quy và quy chế lương thưởng T11–T12/2026.
// Nội dung tĩnh (staff-guide-content.ts), không gọi API. Nút "In / Lưu PDF" dùng hộp in của trình duyệt;
// bản PDF chính thức dựng từ cùng nội dung bằng scripts/build-staff-guide-pdf.mts.
// ----------------------------------------------------------------------

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case 'p':
      return (
        <Typography variant="body2" sx={{ color: 'text.primary' }}>
          {block.text}
        </Typography>
      );
    case 'steps':
    case 'bullets': {
      const Tag = block.kind === 'steps' ? 'ol' : 'ul';
      return (
        <Box>
          {block.title && (
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {block.title}
            </Typography>
          )}
          <Box component={Tag} sx={{ m: 0, pl: 3, '& li': { typography: 'body2', mb: 0.5 } }}>
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </Box>
        </Box>
      );
    }
    case 'table':
      return (
        <Box>
          {block.title && (
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {block.title}
            </Typography>
          )}
          <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {block.head.map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {block.rows.map((row) => (
                  <TableRow key={row.join('|')}>
                    {row.map((cell, i) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <TableCell key={i} sx={{ typography: 'body2', verticalAlign: 'top' }}>
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      );
    case 'note':
      return (
        <Alert severity={block.tone} variant="outlined" sx={{ typography: 'body2' }}>
          {block.text}
        </Alert>
      );
    default:
      return null;
  }
}

function Section({ section }: { section: GuideSection }) {
  return (
    <Box id={section.id} sx={{ scrollMarginTop: 96, breakInside: 'avoid-page' }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        {section.title}
      </Typography>
      {section.lead && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          {section.lead}
        </Typography>
      )}
      <Stack spacing={1.5}>
        {section.blocks.map((block, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Block key={i} block={block} />
        ))}
      </Stack>
    </Box>
  );
}

export default function StaffGuideView() {
  const settings = useSettingsContext();
  const { isCiCi } = useStoreBrand();

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={STAFF_GUIDE.title}
        links={[{ name: 'Nhân sự', href: paths.dashboard.hr.leave }, { name: 'Hướng dẫn sử dụng' }]}
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="solar:printer-minimalistic-bold" />}
            onClick={() => window.print()}
            sx={{ displayPrint: 'none' }}
          >
            In / Lưu PDF
          </Button>
        }
        sx={{ mb: 3, '@media print': { '& nav, & .MuiBreadcrumbs-root': { display: 'none' } } }}
      />

      {!isCiCi && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Phần quy định trong hướng dẫn này là của cửa hàng CiCi; cửa hàng khác dùng phần thao tác trên app để tham khảo.
        </Alert>
      )}

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        {STAFF_GUIDE.subtitle} Cập nhật ngày {STAFF_GUIDE.updatedAt}.
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
        {/* Mục lục */}
        <Card
          sx={{
            p: 2,
            width: { xs: 1, md: 260 },
            flexShrink: 0,
            position: { md: 'sticky' },
            top: { md: 88 },
            maxHeight: { md: 'calc(100vh - 120px)' },
            overflowY: { md: 'auto' },
            displayPrint: 'none',
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Mục lục
          </Typography>
          <Stack spacing={1.25}>
            {STAFF_GUIDE.parts.map((part) => (
              <Box key={part.id}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {part.title}
                </Typography>
                <Stack spacing={0.25} sx={{ mt: 0.25 }}>
                  {part.sections.map((s) => (
                    <Link key={s.id} href={`#${s.id}`} underline="hover" variant="body2" color="text.primary">
                      {s.title}
                    </Link>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Card>

        {/* Nội dung */}
        <Stack spacing={3} sx={{ flex: 1, minWidth: 0 }}>
          {STAFF_GUIDE.parts.map((part) => (
            <Card key={part.id} id={part.id} sx={{ p: { xs: 2, md: 3 }, '@media print': { boxShadow: 'none' } }}>
              <Typography variant="h5" sx={{ mb: 2 }}>
                {part.title}
              </Typography>
              <Stack spacing={3} divider={<Divider flexItem />}>
                {part.sections.map((s) => (
                  <Section key={s.id} section={s} />
                ))}
              </Stack>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}
