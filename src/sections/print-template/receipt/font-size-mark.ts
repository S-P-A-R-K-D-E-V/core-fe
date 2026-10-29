import { Mark, mergeAttributes } from '@tiptap/core';

// ----------------------------------------------------------------------
// Cỡ chữ cho một đoạn chữ trong mẫu hoá đơn: <span style="font-size: 12pt">. Máy chủ và trình dựng trang in chỉ giữ
// thuộc tính CSS font-size (cùng text-align), nên mark này chỉ ghi đúng một thuộc tính đó.
// ----------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FONT_SIZE_CHOICES = [
  '7pt',
  '8pt',
  '9pt',
  '10pt',
  '11pt',
  '12pt',
  '14pt',
  '16pt',
  '18pt',
  '20pt',
  '24pt',
];

export const FontSize = Mark.create({
  name: 'fontSize',

  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).style.fontSize || null,
        renderHTML: (attributes) =>
          attributes.size ? { style: `font-size: ${attributes.size}` } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (element) => ((element as HTMLElement).style?.fontSize ? {} : false),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { size }),
      unsetFontSize:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
