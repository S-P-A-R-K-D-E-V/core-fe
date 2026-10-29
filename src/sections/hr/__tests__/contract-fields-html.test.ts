import { describe, expect, it } from 'vitest';

import { fieldChipText, fieldNodesToTokens, tokensToFieldNodes } from 'src/sections/hr/contract-fields-html';

// ----------------------------------------------------------------------
// Trường trộn: chữ {{ma}} (lưu / máy chủ) ↔ thẻ <span data-field> (trình soạn). Không đụng thẻ HTML, không bọc hai lần.
// ----------------------------------------------------------------------

describe('contract field html', () => {
  it('chữ {{ma}} thành thẻ, chỉ trong phần chữ, không bọc lại thẻ đã có', () => {
    const html = '<p title="{{x}}">Ông/bà {{ho_ten}}, {{ so_cccd }}</p><p><span data-field="ho_ten">{{ho_ten}}</span></p>';

    expect(tokensToFieldNodes(html)).toBe(
      '<p title="{{x}}">Ông/bà <span data-field="ho_ten">{{ho_ten}}</span>, <span data-field="so_cccd">{{so_cccd}}</span></p>'
        + '<p><span data-field="ho_ten">{{ho_ten}}</span></p>'
    );
  });

  it('thẻ thành chữ {{ma}}, giữ nguyên phần còn lại', () => {
    expect(
      fieldNodesToTokens('<p>A <span data-field="ho_ten" class="merge-field">{{ho_ten}}</span> B <strong>C</strong></p>')
    ).toBe('<p>A {{ho_ten}} B <strong>C</strong></p>');
    expect(fieldNodesToTokens(tokensToFieldNodes('<td><p>{{muc_luong}} / tháng</p></td>'))).toBe(
      '<td><p>{{muc_luong}} / tháng</p></td>'
    );
  });

  it('chữ trên thẻ: tên tiếng Việt, chữ ký có ✍, mã lạ chỉ đỏ khi đã có danh sách', () => {
    const labels = new Map([
      ['ho_ten', 'Họ và tên'],
      ['chu_ky_cua_hang', 'Chữ ký cửa hàng'],
    ]);
    expect(fieldChipText('ho_ten', labels)).toEqual({ text: 'Họ và tên', unknown: false });
    expect(fieldChipText('chu_ky_cua_hang', labels)).toEqual({ text: '✍ Chữ ký cửa hàng', unknown: false });
    expect(fieldChipText('bia', labels)).toEqual({ text: 'bia', unknown: true });
    expect(fieldChipText('ho_ten', new Map())).toEqual({ text: 'ho_ten', unknown: false });
  });
});
