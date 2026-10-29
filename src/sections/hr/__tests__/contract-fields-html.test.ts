import { describe, expect, it } from 'vitest';

import {
  bodyUsesField,
  fieldChipText,
  customFieldKey,
  CUSTOM_FIELD_KEY,
  fieldNodesToTokens,
  tokensToFieldNodes,
} from 'src/sections/hr/contract-fields-html';

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

describe('contract field formats + custom fields', () => {
  it('{{ma:dinh_dang}} ↔ thẻ có data-format, khứ hồi giữ nguyên', () => {
    const html = '<p>ngày {{ngay_lap:ngay}} tháng {{ngay_lap:thang}} năm 20{{ngay_lap:nam2}}, sinh {{ngay_sinh}}</p>';
    const nodes = tokensToFieldNodes(html);

    expect(nodes).toContain('<span data-field="ngay_lap" data-format="thang">{{ngay_lap:thang}}</span>');
    expect(nodes).toContain('<span data-field="ngay_sinh">{{ngay_sinh}}</span>');
    expect(fieldNodesToTokens(nodes)).toBe(html);
    // Thứ tự thuộc tính do tiptap ghi (data-field, data-format, class) không ảnh hưởng.
    expect(
      fieldNodesToTokens('<p><span class="merge-field" data-format="nam" data-field="ngay_bat_dau">x</span></p>')
    ).toBe('<p>{{ngay_bat_dau:nam}}</p>');
  });

  it('chữ trên thẻ trường ngày kèm định dạng', () => {
    const labels = new Map([['ngay_lap', 'Ngày lập']]);
    expect(fieldChipText('ngay_lap', labels, 'thang')).toEqual({ text: 'Ngày lập · tháng', unknown: false });
    expect(fieldChipText('ngay_lap', labels, null)).toEqual({ text: 'Ngày lập', unknown: false });
  });

  it('mã trường riêng: rieng_ + tên không dấu, không trùng; nội dung có dùng trường kể cả kèm định dạng', () => {
    expect(customFieldKey('Mã số thuế')).toBe('rieng_ma_so_thue');
    expect(customFieldKey('Người đại diện pháp luật')).toBe('rieng_nguoi_dai_dien_phap_luat');
    expect(customFieldKey('Mã số thuế', ['rieng_ma_so_thue'])).toBe('rieng_ma_so_thue_2');
    expect(customFieldKey('!!!')).toBe('rieng_truong');
    expect(CUSTOM_FIELD_KEY.test(customFieldKey('Địa chỉ đăng ký hộ kinh doanh ở Hà Nội và các tỉnh lân cận'))).toBe(true);
    expect(CUSTOM_FIELD_KEY.test('ma_so_thue')).toBe(false);

    expect(bodyUsesField('<p>{{ngay_lap:thang}}</p>', 'ngay_lap')).toBe(true);
    expect(bodyUsesField('<p>{{ngay_lap_x}}</p>', 'ngay_lap')).toBe(false);
  });
});
