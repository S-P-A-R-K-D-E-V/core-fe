import { describe, expect, it, vi } from 'vitest';

import type { IProductListItem } from 'src/types/corecms-api';

import { fetchCatalog, searchCatalog, normalizeSearchText } from '../pos-catalog';

const product = (over: Partial<IProductListItem>): IProductListItem =>
  ({
    id: 'p',
    code: 'SP1',
    name: 'Sản phẩm',
    categoryName: '',
    hasVariants: false,
    basePrice: 1000,
    productType: 2,
    isActive: true,
    minQuantity: 0,
    maxQuantity: 0,
    createdDate: '2026-10-01T00:00:00Z',
    ...over,
  }) as IProductListItem;

const KEO = product({ id: 'keo', code: 'SP015826', name: 'Kéo' });
const KEO_BAM = product({ id: 'keo-bam', code: 'SP000928', name: 'Kéo bấm' });
const KEP = product({ id: 'kep', code: 'SP000123', barCode: '8930001', name: 'Kẹp tóc nơ nhung đỏ' });
const BUT = product({ id: 'but', code: 'SP014569', name: 'Bút nhớ' });
const VI = product({
  id: 'vi',
  code: 'SP015256',
  name: 'Ví thời trang',
  childProducts: [
    {
      id: 'vi-85',
      code: 'SP015259',
      barCode: '8935259',
      name: 'Ví thời trang',
      fullName: 'Ví thời trang - 85',
      basePrice: 85000,
      isActive: true,
      attributes: [],
    } as any,
  ],
});
const ALL = [BUT, KEO_BAM, KEP, VI, KEO];

describe('normalizeSearchText', () => {
  it('bỏ dấu, đ → d, chữ thường, gộp khoảng trắng', () => {
    expect(normalizeSearchText('  Kẹp TÓC   nơ Đỏ ')).toBe('kep toc no do');
    expect(normalizeSearchText(undefined)).toBe('');
  });
});

describe('searchCatalog', () => {
  it('không phân biệt dấu; đủ mọi từ', () => {
    expect(searchCatalog(ALL, 'kep do').map((p) => p.id)).toEqual(['kep']);
    expect(searchCatalog(ALL, 'KEO').map((p) => p.id)).toEqual(['keo', 'keo-bam']);
    // "kéo" không ra "Bút nhớ" như cách tìm cũ của máy chủ
    expect(searchCatalog(ALL, 'kéo').map((p) => p.id)).not.toContain('but');
  });

  it('đúng mã / mã vạch lên đầu; tìm được cả mã, mã vạch, tên của phiên bản', () => {
    expect(searchCatalog(ALL, 'sp000928')[0].id).toBe('keo-bam');
    expect(searchCatalog(ALL, '8930001').map((p) => p.id)).toEqual(['kep']);
    expect(searchCatalog(ALL, '8935259').map((p) => p.id)).toEqual(['vi']);
    expect(searchCatalog(ALL, 'thoi trang 85').map((p) => p.id)).toEqual(['vi']);
  });

  it('từ khoá trống → không có kết quả; giới hạn số kết quả', () => {
    expect(searchCatalog(ALL, '   ')).toEqual([]);
    expect(searchCatalog(ALL, 'sp', 2)).toHaveLength(2);
  });
});

describe('fetchCatalog', () => {
  it('tải đủ mọi trang (200 hàng / trang) + khách + kho', async () => {
    const page1 = Array.from({ length: 200 }, (_, i) => product({ id: `p${i}`, code: `SP${i}` }));
    const page2 = [product({ id: 'p200', code: 'SP200' })];
    const getAllProducts = vi
      .fn()
      .mockResolvedValueOnce({ items: page1, totalCount: 201, page: 1, pageSize: 200 })
      .mockResolvedValueOnce({ items: page2, totalCount: 201, page: 2, pageSize: 200 });

    const snap = await fetchCatalog(
      {
        getAllProducts,
        getAllCustomers: vi.fn().mockResolvedValue([{ id: 'c1' }]),
        getAllWarehouses: vi.fn().mockResolvedValue([{ id: 'w1' }]),
      },
      () => new Date('2026-11-12T10:00:00Z')
    );

    expect(getAllProducts).toHaveBeenNthCalledWith(1, { isActive: true, page: 1, pageSize: 200 });
    expect(getAllProducts).toHaveBeenNthCalledWith(2, { isActive: true, page: 2, pageSize: 200 });
    expect(snap.products).toHaveLength(201);
    expect(snap.complete).toBe(true);
    expect(snap).toMatchObject({ customers: [{ id: 'c1' }], warehouses: [{ id: 'w1' }], syncedAt: '2026-11-12T10:00:00.000Z' });
  });

  it('một trang lỗi → cả lần tải lỗi (giữ bản đã lưu)', async () => {
    await expect(
      fetchCatalog({
        getAllProducts: vi.fn().mockRejectedValue('Something went wrong'),
        getAllCustomers: vi.fn().mockResolvedValue([]),
        getAllWarehouses: vi.fn().mockResolvedValue([]),
      })
    ).rejects.toBe('Something went wrong');
  });
});
