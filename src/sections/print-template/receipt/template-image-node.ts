import { Node } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';

import { parseImageWidth, IMAGE_WIDTH_RANGE } from '../print-image';

// ----------------------------------------------------------------------
// Ảnh trong mẫu hoá đơn: node nội dòng nằm trong đoạn — căn trái / giữa / phải bằng nút căn lề của đoạn, đặt cạnh nhau
// được, nằm trong cột được. Bề rộng tính bằng % bề rộng khối chứa (kéo nút ở góc dưới phải, hoặc chọn nhanh trên thanh
// công cụ) → co theo khổ giấy.
//  - Ảnh tải lên: <img src="https://<tên miền>/media/print-templates/…" style="width: 40%">.
//  - Logo cửa hàng: <img class="store-logo" style="width: 40%"> — không lưu src, khi in lấy logo hiện tại của cửa hàng
//    (Cài đặt cửa hàng → Thông tin), đổi logo không phải sửa mẫu.
// ----------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    templateImage: {
      /** Chèn ảnh ở con trỏ (hoặc ở vị trí `at`) rồi chọn luôn ảnh đó để đổi cỡ ngay. */
      insertTemplateImage: (
        attrs: { src?: string | null; logo?: boolean; width?: number | null },
        at?: number
      ) => ReturnType;
      setTemplateImageWidth: (width: number | null) => ReturnType;
    };
  }
}

const clampWidth = (value: number) =>
  Math.min(IMAGE_WIDTH_RANGE.max, Math.max(IMAGE_WIDTH_RANGE.min, Math.round(value)));

type Options = {
  /** Logo hiện tại của cửa hàng — chỉ để hiện trong trình soạn. */
  logoUrl: string | null;
};

export const TemplateImage = Node.create<Options>({
  name: 'templateImage',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { logoUrl: null };
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute('src'),
        renderHTML: () => ({}),
      },
      width: {
        default: null,
        parseHTML: (element) => parseImageWidth((element as HTMLElement).style.width),
        renderHTML: () => ({}),
      },
      logo: {
        default: false,
        parseHTML: (element) => element.classList.contains('store-logo'),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'img' }];
  },

  renderHTML({ node }) {
    const { src, width, logo } = node.attrs as {
      src: string | null;
      width: number | null;
      logo: boolean;
    };
    const attrs: Record<string, string> = {};
    if (logo) attrs.class = 'store-logo';
    else if (src) attrs.src = src;
    if (width) attrs.style = `width: ${width}%`;
    attrs.alt = logo ? 'Logo' : '';
    return ['img', attrs];
  },

  addCommands() {
    return {
      insertTemplateImage:
        (attrs, at) =>
        ({ chain }) =>
          chain()
            .command(({ commands }) =>
              at === undefined
                ? commands.insertContent({ type: this.name, attrs })
                : commands.insertContentAt(at, { type: this.name, attrs })
            )
            .command(({ tr }) => {
              // Sau khi chèn, con trỏ đứng ngay sau ảnh (node nội dòng dài 1).
              const pos = tr.selection.from - 1;
              if (pos >= 0 && tr.doc.nodeAt(pos)?.type.name === this.name) {
                tr.setSelection(NodeSelection.create(tr.doc, pos));
              }
              return true;
            })
            .run(),
      setTemplateImageWidth:
        (width) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, {
            width: width === null ? null : clampWidth(width),
          }),
    };
  },

  addNodeView() {
    const { logoUrl } = this.options;
    return ({ node: initialNode, getPos, editor }) => {
      let node = initialNode;
      const dom = document.createElement('span');
      dom.className = 'tpl-img';
      dom.contentEditable = 'false';
      const img = document.createElement('img');
      img.draggable = false;
      const placeholder = document.createElement('span');
      placeholder.className = 'tpl-img-placeholder';
      placeholder.textContent = 'Logo cửa hàng';
      const handle = document.createElement('span');
      handle.className = 'tpl-img-handle';
      handle.title = 'Kéo để đổi cỡ ảnh';

      const paint = () => {
        const { src, width, logo } = node.attrs as {
          src: string | null;
          width: number | null;
          logo: boolean;
        };
        const shown = logo ? logoUrl : src;
        dom.style.width = width ? `${width}%` : '';
        dom.classList.toggle('tpl-img--logo', logo);
        dom.replaceChildren(...(shown ? [img] : [placeholder]), handle);
        if (shown) {
          img.src = shown;
          img.alt = logo ? 'Logo cửa hàng' : 'Ảnh';
        }
        img.style.width = width ? '100%' : '';
      };
      paint();

      handle.addEventListener('pointerdown', (event) => {
        if (!editor.isEditable) return;
        event.preventDefault();
        event.stopPropagation();
        const container = dom.parentElement;
        const containerWidth = container?.getBoundingClientRect().width ?? 0;
        const startWidth = dom.getBoundingClientRect().width;
        if (!containerWidth) return;
        const startX = event.clientX;
        let width = clampWidth((startWidth / containerWidth) * 100);
        handle.setPointerCapture?.(event.pointerId);

        const move = (moveEvent: PointerEvent) => {
          width = clampWidth(((startWidth + moveEvent.clientX - startX) / containerWidth) * 100);
          dom.style.width = `${width}%`;
          img.style.width = '100%';
        };
        const up = () => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', up);
          handle.removeEventListener('pointercancel', up);
          const pos = typeof getPos === 'function' ? getPos() : undefined;
          if (typeof pos !== 'number') return;
          editor.view.dispatch(
            editor.view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, width })
          );
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
        handle.addEventListener('pointercancel', up);
      });

      return {
        dom,
        update: (updated) => {
          if (updated.type !== node.type) return false;
          node = updated;
          paint();
          return true;
        },
        selectNode: () => dom.classList.add('ProseMirror-selectednode'),
        deselectNode: () => dom.classList.remove('ProseMirror-selectednode'),
        // Kéo nút đổi cỡ không phải kéo cả ảnh đi chỗ khác.
        stopEvent: (event) => event.target === handle,
        ignoreMutation: () => true,
      };
    };
  },
});
