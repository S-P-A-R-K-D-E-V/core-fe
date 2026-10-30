import { Node, findParentNode } from '@tiptap/core';
import { Fragment } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';

import type { Node as PMNode } from '@tiptap/pm/model';

// ----------------------------------------------------------------------
// Khối chia cột trong mẫu hoá đơn: <div class="cols cols-2"><div class="col">…</div><div class="col">…</div></div>.
// Bố cục: '2' hai cột đều, '3' ba cột đều, '12' cột trái 1/3 – phải 2/3, '21' trái 2/3 – phải 1/3. Mỗi cột chứa đoạn,
// tiêu đề, bảng, ảnh… như thân phiếu; trường dòng hàng trong cột vẫn lặp theo từng món. In ra là flex (CSS của trang in,
// receipt-template-render) — core-be chỉ giữ đúng các lớp này.
// ----------------------------------------------------------------------

export type ColumnsLayout = '2' | '3' | '12' | '21';

export const COLUMN_LAYOUTS: { value: ColumnsLayout; label: string }[] = [
  { value: '2', label: 'Chia đôi (2 cột đều)' },
  { value: '3', label: 'Chia ba (3 cột đều)' },
  { value: '12', label: '1/3 trái – 2/3 phải' },
  { value: '21', label: '2/3 trái – 1/3 phải' },
];

const columnCount = (layout: ColumnsLayout) => (layout === '3' ? 3 : 2);

const layoutOf = (element: HTMLElement): ColumnsLayout => {
  const found = COLUMN_LAYOUTS.find((item) => element.classList.contains(`cols-${item.value}`));
  return found ? found.value : element.querySelectorAll(':scope > .col').length >= 3 ? '3' : '2';
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      /** Chèn khối chia cột mới, hoặc đổi bố cục khối đang đứng trong (thêm / gộp cột cuối). */
      setColumns: (layout: ColumnsLayout) => ReturnType;
      /** Bỏ chia cột: nội dung các cột xếp lại theo thứ tự. */
      unsetColumns: () => ReturnType;
    };
  }
}

export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  parseHTML() {
    return [{ tag: 'div.col' }];
  },
  renderHTML() {
    return ['div', { class: 'col' }, 0];
  },
});

export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column{2,3}',
  isolating: true,
  defining: true,

  addAttributes() {
    return {
      layout: {
        default: '2',
        parseHTML: (element) => layoutOf(element as HTMLElement),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div.cols' }];
  },

  renderHTML({ node }) {
    return ['div', { class: `cols cols-${node.attrs.layout}` }, 0];
  },

  addCommands() {
    return {
      setColumns:
        (layout) =>
        ({ state, tr, dispatch, chain }) => {
          const { schema } = state;
          const count = columnCount(layout);
          const found = findParentNode((node) => node.type.name === this.name)(state.selection);
          const emptyColumn = () =>
            schema.nodes.column.create(null, schema.nodes.paragraph.create());

          if (!found) {
            const before = state.selection.from;
            return chain()
              .insertContent({
                type: this.name,
                attrs: { layout },
                content: Array.from({ length: count }, () => ({
                  type: 'column',
                  content: [{ type: 'paragraph' }],
                })),
              })
              .command(({ tr: next }) => {
                // Đặt con trỏ vào cột đầu của khối vừa chèn — đổi bố cục ngay sau đó áp vào đúng khối này.
                let target = -1;
                next.doc.descendants((node, pos) => {
                  if (target < 0 && node.type.name === this.name && pos >= before - 2) target = pos;
                  return target < 0;
                });
                if (target >= 0)
                  next.setSelection(TextSelection.near(next.doc.resolve(target + 3)));
                return true;
              })
              .run();
          }

          const columns: PMNode[] = [];
          found.node.forEach((child) => columns.push(child));
          let kept = columns.slice(0, count);
          if (columns.length > count) {
            // Gộp nội dung các cột thừa vào cột cuối còn giữ — không mất chữ.
            const extra = columns.slice(count).flatMap((column) => {
              const blocks: PMNode[] = [];
              column.forEach((block) => blocks.push(block));
              return blocks;
            });
            const last = kept[kept.length - 1];
            kept = [
              ...kept.slice(0, -1),
              last.copy(last.content.append(Fragment.fromArray(extra))),
            ];
          }
          while (kept.length < count) kept.push(emptyColumn());

          if (dispatch) {
            tr.replaceWith(
              found.pos,
              found.pos + found.node.nodeSize,
              this.type.create({ layout }, kept)
            );
            // Giữ con trỏ trong khối (cột đầu) để đổi tiếp / bỏ chia cột ngay được.
            tr.setSelection(TextSelection.near(tr.doc.resolve(found.pos + 3)));
          }
          return true;
        },
      unsetColumns:
        () =>
        ({ state, tr, dispatch }) => {
          const found = findParentNode((node) => node.type.name === this.name)(state.selection);
          if (!found) return false;
          const blocks: PMNode[] = [];
          found.node.forEach((column) => column.forEach((block) => blocks.push(block)));
          if (dispatch)
            tr.replaceWith(found.pos, found.pos + found.node.nodeSize, Fragment.fromArray(blocks));
          return true;
        },
    };
  },
});
