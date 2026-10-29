import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Trình soạn mẫu hợp đồng: giữ bảng khi nạp HTML, bấm chip trường chèn {{ma}} vào nội dung, kéo chip mang {{ma}} để thả;
// hiển thị: trường chữ ký thành ảnh chữ ký khi nhân viên đã ký, chỗ trống khi chưa.
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

// Imported after the mock above.
import { ContractEditor } from 'src/sections/hr/contract-editor';
import { htmlContractBody, fillSignatureFields } from 'src/sections/hr/contract-render';

const theme = createTheme();
const fields = [
  { key: 'ho_ten', label: 'Họ và tên', required: true },
  { key: 'chu_ky_nguoi_lao_dong', label: 'Chữ ký người lao động', required: false },
];

describe('ContractEditor', () => {
  it('giữ bảng, bấm chip để chèn trường vào nội dung', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <ContractEditor
          value="<p>Họ tên: </p><table><tbody><tr><td><p>Bên A</p></td><td><p>CiCi</p></td></tr></tbody></table>"
          onChange={onChange}
          fields={fields}
        />
      </ThemeProvider>
    );

    expect(await screen.findByText('Bên A')).toBeInTheDocument();
    expect(document.querySelector('.ProseMirror table')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Chèn bảng' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ngắt trang' })).toBeInTheDocument();

    await user.click(screen.getByText('{{ho_ten}}'));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.stringContaining('{{ho_ten}}')));
    expect(onChange.mock.calls.at(-1)![0]).toContain('<table');
  });

  it('kéo chip trường mang {{ma}} dạng chữ để thả vào nội dung', async () => {
    render(
      <ThemeProvider theme={theme}>
        <ContractEditor value="<p>A</p>" onChange={vi.fn()} fields={fields} />
      </ThemeProvider>
    );
    const chip = (await screen.findByText('{{ho_ten}}')).closest('[draggable="true"]')!;
    const setData = vi.fn();

    fireEvent.dragStart(chip, { dataTransfer: { setData, effectAllowed: 'none' } });

    expect(setData).toHaveBeenCalledWith('text/plain', '{{ho_ten}}');
  });

  it('không có bảng trường khi sửa nội dung một hợp đồng', async () => {
    render(
      <ThemeProvider theme={theme}>
        <ContractEditor value="<p>Nội dung</p>" onChange={vi.fn()} />
      </ThemeProvider>
    );
    expect(await screen.findByText('Nội dung')).toBeInTheDocument();
    expect(screen.queryByText('Trường thông tin')).toBeNull();
  });
});

describe('contract rendering', () => {
  it('trường chữ ký: ảnh khi đã ký, chỗ trống khi chưa; [[CHU_KY]] thành khối ký', () => {
    expect(fillSignatureFields('<p>{{chu_ky_nguoi_lao_dong}}</p>', null)).toContain('class="sign-slot"');
    const signed = fillSignatureFields('<p>{{chu_ky_nguoi_lao_dong}} {{chu_ky_cua_hang}}</p>', '<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(signed).toContain('src="data:image/svg+xml;base64,');
    expect(signed).toContain('class="sign-slot"');

    const block = htmlContractBody('<p>[[CHU_KY]]</p><p>[[NGAT_TRANG]]</p>', 'Trần Lan', '<svg/>');
    expect(block).toContain('NGƯỜI SỬ DỤNG LAO ĐỘNG');
    expect(block).toContain('class="sign-image"');
    expect(block).toContain('class="page-break"');
  });
});
