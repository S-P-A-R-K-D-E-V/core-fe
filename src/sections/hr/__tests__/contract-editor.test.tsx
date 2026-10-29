import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Trình soạn mẫu hợp đồng: giữ bảng khi nạp HTML, trường là thẻ tên tiếng Việt (lưu ra vẫn {{ma}}), bấm / kéo thả trường;
// hiển thị: trường chữ ký thành ảnh chữ ký khi nhân viên đã ký, chỗ trống khi chưa.
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

// Imported after the mock above.
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import { MergeField, ContractEditor, handleFieldDrop } from 'src/sections/hr/contract-editor';
import { htmlContractBody, fillSignatureFields } from 'src/sections/hr/contract-render';

import type { IContractCustomField } from 'src/types/hr';

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

    await user.click(screen.getByRole('button', { name: 'Chèn trường Họ và tên' }));
    expect(document.querySelector('.ProseMirror .merge-field[data-field="ho_ten"]')?.textContent).toBe('Họ và tên');

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.stringContaining('{{ho_ten}}')));
    expect(onChange.mock.calls.at(-1)![0]).toContain('<table');
  });

  it('kéo trường mang mã riêng của trường (và {{ma}} dạng chữ cho ô khác)', async () => {
    render(
      <ThemeProvider theme={theme}>
        <ContractEditor value="<p>A</p>" onChange={vi.fn()} fields={fields} />
      </ThemeProvider>
    );
    const chip = await screen.findByRole('button', { name: 'Chèn trường Họ và tên' });
    const setData = vi.fn();

    fireEvent.dragStart(chip, { dataTransfer: { setData, effectAllowed: 'none' } });

    expect(setData).toHaveBeenCalledWith('application/x-contract-field', 'ho_ten');
    expect(setData).toHaveBeenCalledWith('text/plain', '{{ho_ten}}');
  });

  it('nạp {{ma}} thành thẻ tên tiếng Việt, mã lạ tô đỏ, lưu ra vẫn {{ma}}', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <ContractEditor value="<p>Ông/bà {{ho_ten}} ký {{chu_ky_nguoi_lao_dong}} {{bia}}</p>" onChange={onChange} fields={fields} />
      </ThemeProvider>
    );

    await waitFor(() => expect(document.querySelectorAll('.ProseMirror .merge-field')).toHaveLength(3));
    const chips = Array.from(document.querySelectorAll<HTMLElement>('.ProseMirror .merge-field'));
    expect(chips.map((c) => c.textContent)).toEqual(['Họ và tên', '✍ Chữ ký người lao động', 'bia']);
    expect(chips[2].classList.contains('merge-field--unknown')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Chèn trường Họ và tên' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const saved = onChange.mock.calls.at(-1)![0] as string;
    expect(saved).toContain('Ông/bà {{ho_ten}} ký {{chu_ky_nguoi_lao_dong}} {{bia}}');
    expect(saved).not.toContain('data-field');
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

describe('ContractEditor — định dạng ngày + trường riêng của mẫu', () => {
  const dateFields = [
    {
      key: 'ngay_lap',
      label: 'Ngày lập',
      required: true,
      isDate: true,
      formats: [
        { code: 'ngay', label: 'Ngày (29)' },
        { code: 'thang', label: 'Tháng (10)' },
        { code: 'nam2', label: 'Năm 2 số (26)' },
      ],
    },
  ];

  it('bấm thẻ trường ngày → chọn định dạng → lưu {{ma:dinh_dang}}', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <ContractEditor value="<p>Hôm nay ngày {{ngay_lap:ngay}}</p>" onChange={onChange} fields={dateFields} />
      </ThemeProvider>
    );
    await waitFor(() =>
      expect(document.querySelector('.ProseMirror .merge-field[data-field="ngay_lap"]')?.textContent).toBe('Ngày lập · ngày')
    );

    fireEvent.click(document.querySelector('.ProseMirror .merge-field[data-field="ngay_lap"]')!);
    await user.click(await screen.findByRole('menuitem', { name: 'Tháng (10)' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.stringContaining('{{ngay_lap:thang}}')));
    expect(document.querySelector('.ProseMirror .merge-field[data-field="ngay_lap"]')?.textContent).toBe('Ngày lập · tháng');
  });

  it('thêm trường riêng: mã tự sinh rieng_…, hiện trong bảng trường, kéo được', async () => {
    const user = userEvent.setup();
    const onCustom = vi.fn();
    function Harness() {
      const [custom, setCustom] = useState<IContractCustomField[]>([]);
      return (
        <ThemeProvider theme={theme}>
          <ContractEditor
            value="<p>MST: {{rieng_ma_so_thue}}</p>"
            onChange={vi.fn()}
            fields={fields}
            customFields={custom}
            onCustomFieldsChange={(list) => {
              onCustom(list);
              setCustom(list);
            }}
          />
        </ThemeProvider>
      );
    }
    render(<Harness />);
    // Chưa khai báo thì mã riêng trong nội dung là mã lạ (đỏ).
    await waitFor(() =>
      expect(
        document.querySelector('.ProseMirror .merge-field[data-field="rieng_ma_so_thue"]')?.classList.contains('merge-field--unknown')
      ).toBe(true)
    );

    await user.click(screen.getByRole('button', { name: 'Thêm' }));
    await user.type(screen.getByLabelText('Nhãn'), 'Mã số thuế');
    expect((screen.getByLabelText('Mã') as HTMLInputElement).value).toBe('rieng_ma_so_thue');
    await user.type(screen.getByLabelText('Giá trị mặc định'), '0109876543');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(onCustom).toHaveBeenLastCalledWith([
      { key: 'rieng_ma_so_thue', label: 'Mã số thuế', required: true, defaultValue: '0109876543' },
    ]);
    const chip = await screen.findByRole('button', { name: 'Chèn trường Mã số thuế' });
    await waitFor(() => {
      const inBody = document.querySelector('.ProseMirror .merge-field[data-field="rieng_ma_so_thue"]');
      expect(inBody?.textContent).toBe('Mã số thuế');
      expect(inBody?.classList.contains('merge-field--unknown')).toBe(false);
    });

    const setData = vi.fn();
    fireEvent.dragStart(chip, { dataTransfer: { setData, effectAllowed: 'none' } });
    expect(setData).toHaveBeenCalledWith('application/x-contract-field', 'rieng_ma_so_thue');
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

describe('handleFieldDrop', () => {
  it('thả trường từ danh sách: chèn thẻ đúng chỗ thả; kéo thứ khác để tiptap tự xử lý', () => {
    const editor = new Editor({ extensions: [StarterKit, MergeField], content: '<p>Họ tên: A</p>' });
    const { view } = editor;
    // jsdom không có bố cục: giả chỗ thả là ngay trước "A" (vị trí 9).
    view.posAtCoords = () => ({ pos: 9, inside: -1 });
    const drag = (data: Record<string, string>) =>
      ({
        clientX: 10,
        clientY: 10,
        preventDefault: vi.fn(),
        dataTransfer: { getData: (type: string) => data[type] ?? '' },
      }) as unknown as DragEvent;

    expect(handleFieldDrop(view, drag({ 'text/plain': 'chữ thường' }))).toBe(false);
    expect(handleFieldDrop(view, drag({ 'application/x-contract-field': 'ho_ten' }))).toBe(true);

    expect(editor.getHTML()).toBe('<p>Họ tên: <span data-field="ho_ten" class="merge-field">{{ho_ten}}</span>A</p>');
    editor.destroy();
  });
});
