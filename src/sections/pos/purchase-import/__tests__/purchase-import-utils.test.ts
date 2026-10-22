import { describe, expect, it } from 'vitest';

import type { IPurchaseImport, IPurchaseImportLine } from 'src/types/purchase-import';

import {
  lineCounts,
  parseAmount,
  commitBlockers,
  isLinePending,
  totalMismatch,
  hasNumberIssue,
  importErrorMessage,
  isDuplicateInvoice,
} from '../purchase-import-utils';

const line = (patch: Partial<IPurchaseImportLine>): IPurchaseImportLine => ({
  lineNo: 1,
  rawText: '18 mũ x70 1260',
  name: 'mũ',
  sameAsAbove: false,
  quantity: 18,
  unitPrice: 70000,
  lineTotal: 1260000,
  status: 'Matched',
  issues: [],
  candidates: [],
  productId: 'p1',
  resolution: 'None',
  ...patch,
});

const invoice = (lines: IPurchaseImportLine[], patch: Partial<IPurchaseImport> = {}): IPurchaseImport => ({
  id: 'i1',
  status: 'NeedsReview',
  source: 'Web',
  images: [],
  supplierId: 's1',
  linesTotal: lines.filter((l) => l.status !== 'Skipped').reduce((s, l) => s + (l.lineTotal ?? 0), 0),
  warnings: [],
  createdAt: '',
  updatedAt: '',
  lines,
  ...patch,
});

describe('purchase-import utils', () => {
  it('a line without a product or numbers is pending; a skipped line never is', () => {
    expect(isLinePending(line({}))).toBe(false);
    expect(isLinePending(line({ productId: null, status: 'Suggested' }))).toBe(true);
    expect(isLinePending(line({ quantity: null }))).toBe(true);
    expect(isLinePending(line({ unitPrice: null, lineTotal: 390000 }))).toBe(false);
    expect(isLinePending(line({ productId: null, status: 'Skipped' }))).toBe(false);
  });

  it('commit needs a supplier and every kept line decided', () => {
    expect(commitBlockers(invoice([line({})]))).toEqual([]);
    expect(commitBlockers(invoice([line({})], { supplierId: null }))).toEqual(['Chọn nhà cung cấp.']);
    expect(commitBlockers(invoice([line({ productId: null, status: 'Unknown' })]))).toEqual([
      'Còn 1 dòng chưa chọn mã hoặc thiếu số.',
    ]);
    expect(commitBlockers(invoice([line({ status: 'Skipped' })]))).toEqual(['Mọi dòng đều bị bỏ.']);
    expect(commitBlockers(invoice([line({})], { status: 'Committed' }))).toEqual(['Hoá đơn không còn ở bước duyệt.']);
  });

  it('flags a total that does not match the lines, ignoring rounding', () => {
    expect(totalMismatch(invoice([line({})], { invoiceTotal: 1260000 }))).toBeNull();
    expect(totalMismatch(invoice([line({})], { invoiceTotal: 1260500 }))).toBeNull();
    expect(totalMismatch(invoice([line({})], { invoiceTotal: 1250000 }))).toBe(10000);
    expect(totalMismatch(invoice([line({})], { invoiceTotal: null }))).toBeNull();
  });

  it('counts decided, pending and skipped lines', () => {
    const counts = lineCounts(
      invoice([
        line({}),
        line({ lineNo: 2, status: 'Resolved' }),
        line({ lineNo: 3, status: 'Suggested', productId: null }),
        line({ lineNo: 4, status: 'Skipped' }),
      ])
    );
    expect(counts).toEqual({ matched: 2, pending: 1, skipped: 1 });
  });

  it('unit conversion alone is not a number problem', () => {
    expect(hasNumberIssue(line({ issues: ['unit_converted'] }))).toBe(false);
    expect(hasNumberIssue(line({ issues: ['pack_unit'] }))).toBe(false);
    expect(hasNumberIssue(line({ issues: ['ambiguous_reading'] }))).toBe(true);
  });
});

describe('parseAmount', () => {
  it('reads Vietnamese grouping, spaces and decimal comma', () => {
    expect(parseAmount('1.170.000')).toBe(1170000);
    expect(parseAmount('1 170 000')).toBe(1170000);
    expect(parseAmount('16687,5')).toBe(16687.5);
    expect(parseAmount('16687.5')).toBe(16687.5);
    expect(parseAmount('24')).toBe(24);
  });

  it('rejects empty, zero, negative and garbage', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('error bodies', () => {
  it('prefers { error } from upload endpoints, then ErrorOr problem title', () => {
    expect(importErrorMessage({ error: 'Gửi từ 1 đến 6 ảnh.', code: 'attachment_invalid' }, 'x')).toBe('Gửi từ 1 đến 6 ảnh.');
    expect(importErrorMessage({ title: 'Còn 2 dòng chưa chọn mã.', status: 400 }, 'x')).toBe('Còn 2 dòng chưa chọn mã.');
    expect(importErrorMessage(undefined, 'fallback')).toBe('fallback');
  });

  it('detects a duplicate invoice conflict', () => {
    expect(isDuplicateInvoice({ title: 'Hoá đơn số 1200 …', errorCodes: ['PurchaseImport.DuplicateInvoice'] })).toBe(true);
    expect(isDuplicateInvoice({ title: 'x', errorCodes: ['PurchaseImport.NotReviewable'] })).toBe(false);
  });
});
