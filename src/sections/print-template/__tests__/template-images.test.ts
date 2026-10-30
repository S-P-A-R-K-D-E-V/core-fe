import { it, expect, describe } from 'vitest';

import { DEFAULT_CALIBRATION } from 'src/sections/pos/label-print/label-template';

import { isSafeLogoSrc, isSafeImageSrc } from '../print-image';
import { sampleReceipt } from '../receipt/receipt-template-default';
import { renderDesignSheetHtml } from '../label/label-design-render';
import { defaultReceiptSettings } from '../receipt/receipt-template-settings';
import { parseLabelDesign, defaultLabelDesign } from '../label/label-design';
import {
  mergeReceiptTemplate,
  receiptTemplateContentCss,
} from '../receipt/receipt-template-render';

import type { LabelElement } from '../label/label-design';

// ----------------------------------------------------------------------
// Ảnh, logo cửa hàng và khối chia cột trong mẫu in: chỉ ảnh của chính cửa hàng (/media/…), logo lấy logo hiện tại khi in,
// lớp bố cục được giữ, lớp lạ bị bỏ.
// ----------------------------------------------------------------------

const LOGO = 'https://cici.vn/media/branding/logo-1.png';
const IMG = 'https://cici.vn/media/print-templates/img-1-abcd1234.png';

const merged = (html: string, logoUrl: string | null = LOGO) => {
  const out = mergeReceiptTemplate(
    html,
    sampleReceipt('CiCi', logoUrl),
    defaultReceiptSettings('80')
  );
  return new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html').body;
};

describe('isSafeImageSrc / isSafeLogoSrc', () => {
  it.each([
    [IMG, true],
    ['/media/print-templates/a.webp', true],
    ['https://evil.example/a.png', false],
    ['http://cici.vn/media/a.png', false],
    ['//evil.example/media/a.png', false],
    ['/media/../secret.png', false],
    ['data:image/png;base64,AAAA', false],
    ['javascript:alert(1)', false],
  ])('%s → %s', (src, ok) => {
    expect(isSafeImageSrc(src)).toBe(ok);
  });

  it('logo của cửa hàng có thể là đường dẫn tĩnh cùng tên miền', () => {
    expect(isSafeLogoSrc('/logo/logo_single.png')).toBe(true);
    expect(isSafeLogoSrc(LOGO)).toBe(true);
    expect(isSafeLogoSrc('//evil.example/logo.png')).toBe(false);
    expect(isSafeLogoSrc('javascript:alert(1)')).toBe(false);
  });
});

describe('mẫu hoá đơn: ảnh, logo, chia cột', () => {
  it('giữ ảnh của cửa hàng với bề rộng %, bỏ ảnh ngoài / data: / không có src', () => {
    const body = merged(
      `<p style="text-align: center"><img src="${IMG}" style="width: 40%; position: fixed" onerror="x()"></p>` +
        '<p>A<img src="https://evil.example/t.png">B<img src="data:image/png;base64,AA"><img></p>'
    );
    const images = Array.from(body.querySelectorAll('img'));

    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toBe(IMG);
    expect(images[0].getAttribute('style')).toBe('width:40%');
    expect(images[0].hasAttribute('onerror')).toBe(false);
    expect(body.querySelectorAll('p')[1].textContent).toBe('AB');
  });

  it('logo lấy logo hiện tại của cửa hàng; chưa có logo thì bỏ cả đoạn chỉ chứa logo', () => {
    const template =
      '<p style="text-align: center"><img class="store-logo" src="https://evil.example/x.png" style="width: 30%"></p><p>{{store_name}}</p>';

    const withLogo = merged(template);
    const logo = withLogo.querySelector('img.store-logo');
    expect(logo?.getAttribute('src')).toBe(LOGO);
    expect(logo?.getAttribute('style')).toBe('width:30%');

    const withoutLogo = merged(template, null);
    expect(withoutLogo.querySelector('img')).toBeNull();
    expect(Array.from(withoutLogo.querySelectorAll('p'), (p) => p.textContent)).toEqual(['CiCi']);
  });

  it('giữ khối chia cột (lớp bố cục), bỏ lớp lạ; trường trong cột vẫn được trộn', () => {
    const body = merged(
      '<div class="cols cols-12 hacker"><div class="col"><p><img class="store-logo"></p></div>' +
        '<div class="col"><p class="x">{{store_name}}</p><p>{{store_tax_code}}</p></div></div>'
    );
    const cols = body.querySelector('div.cols');

    expect(cols?.getAttribute('class')).toBe('cols cols-12');
    expect(cols?.querySelectorAll(':scope > div.col')).toHaveLength(2);
    expect(body.querySelector('p.x')).toBeNull();
    expect(cols?.querySelectorAll('.col')[1].textContent).toBe('CiCi0101234567');
  });

  it('CSS trang in xếp cột bằng flex và co ảnh trong khối chứa', () => {
    const css = receiptTemplateContentCss(defaultReceiptSettings('80'));

    expect(css).toContain('.rt .cols{display:flex');
    expect(css).toContain(
      '.rt .cols-12>.col:last-child,.rt .cols-21>.col:first-child{flex-grow:2}'
    );
    expect(css).toContain('.rt img{max-width:100%;height:auto');
  });
});

describe('tem: phần tử ảnh / logo', () => {
  const image = (extra: Partial<LabelElement>): LabelElement => ({
    id: 'im',
    type: 'image',
    xMm: 1,
    yMm: 1,
    wMm: 10,
    hMm: 8,
    ...extra,
  });
  const source = { key: 'p1', name: 'Kẹp', code: 'K35', price: 35000, quantity: 1 };
  const render = (elements: LabelElement[], logoUrl: string | null = LOGO) =>
    new DOMParser().parseFromString(
      renderDesignSheetHtml(
        { items: [source], context: { storeName: 'CiCi', logoUrl } },
        { ...defaultLabelDesign(), elements },
        DEFAULT_CALIBRATION
      ),
      'text/html'
    );

  it('in ảnh tải lên và logo hiện tại, vừa khung giữ tỉ lệ', () => {
    const doc = render([image({ src: IMG }), image({ id: 'lg', logo: true })]);

    expect(
      Array.from(doc.querySelectorAll('.lb img.im'), (img) => img.getAttribute('src'))
    ).toEqual([IMG, LOGO]);
    expect(doc.querySelector('style')?.textContent).toContain(
      '.lb .im{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:contain}'
    );
  });

  it('cửa hàng chưa có logo: phần tử logo không in, tem vẫn in', () => {
    const doc = render([image({ logo: true })], null);

    expect(doc.querySelectorAll('.lb')).toHaveLength(1);
    expect(doc.querySelector('img')).toBeNull();
  });

  it('bố cục đọc từ JSON bỏ ảnh không phải của cửa hàng', () => {
    const design = parseLabelDesign({
      presetId: '1x50x30',
      paper: { labelWidthMm: 50, labelHeightMm: 30, pageWidthMm: 50, columns: 1, kind: 'roll' },
      elements: [
        { type: 'image', xMm: 1, yMm: 1, wMm: 10, hMm: 10, src: 'https://evil.example/t.png' },
        { type: 'image', xMm: 1, yMm: 1, wMm: 10, hMm: 10, src: IMG },
        {
          type: 'image',
          xMm: 1,
          yMm: 1,
          wMm: 10,
          hMm: 10,
          logo: true,
          src: 'https://evil.example/x.png',
        },
      ],
    });

    expect(design.elements.map((element) => [element.src ?? null, element.logo ?? false])).toEqual([
      [IMG, false],
      [null, true],
    ]);
  });
});
