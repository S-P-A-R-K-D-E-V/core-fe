import { describe, expect, it } from 'vitest';

import { productAccessFor } from '../product-access';

// ----------------------------------------------------------------------
// Nút Thêm / Sửa / Xoá ở danh sách hàng hoá theo quyền products.* (Core-be ProductsController). Thêm / sửa cần kèm xem
// giá vốn vì form gửi cả giá vốn. Máy quầy chỉ xem + in tem.
// ----------------------------------------------------------------------

describe('productAccessFor', () => {
  it('chủ cửa hàng làm được mọi thứ, trừ khi đang ở máy quầy', () => {
    expect(productAccessFor({ role: 'Admin' }, false)).toEqual({ canCreate: true, canUpdate: true, canDelete: true });
    expect(productAccessFor({ role: 'Admin' }, true)).toEqual({ canCreate: false, canUpdate: false, canDelete: false });
  });

  it('nhân viên thường chỉ xem', () => {
    expect(productAccessFor({ role: 'Staff', permissions: [] }, false)).toEqual({
      canCreate: false,
      canUpdate: false,
      canDelete: false,
    });
  });

  it('thêm / sửa cần kèm quyền xem giá vốn; xoá thì không', () => {
    const withoutCost = productAccessFor(
      { role: 'Staff', permissions: ['products.create', 'products.update', 'products.delete'] },
      false
    );
    expect(withoutCost).toEqual({ canCreate: false, canUpdate: false, canDelete: true });

    const keeper = productAccessFor({ role: 'Staff', permissions: ['products.update', 'products.cost.read'] }, false);
    expect(keeper).toEqual({ canCreate: false, canUpdate: true, canDelete: false });
  });
});
