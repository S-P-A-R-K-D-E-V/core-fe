import type { IPermissionCatalog } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Quyền phải có kèm (GET /permissions/catalog → requires, Core-be PermissionDefinition.Requires): chọn quyền thì chọn
// luôn quyền nó cần, bỏ quyền thì bỏ luôn quyền đang cần nó — để vai trò không có quyền "ghi" mà thiếu quyền "xem"
// (API kiểm cả hai; server cũng tự thêm khi lưu).
// ----------------------------------------------------------------------

type Catalog = Pick<IPermissionCatalog, 'groups'>;

function requiresOf(catalog: Catalog): Map<string, string[]> {
  return new Map(
    catalog.groups.flatMap((g) => g.permissions.map((p) => [p.code, p.requires ?? []] as const))
  );
}

/** `selected` + `codes` + mọi quyền chúng cần (lan nhiều cấp). */
export function withRequired(
  selected: readonly string[],
  codes: readonly string[],
  catalog: Catalog
): string[] {
  const requires = requiresOf(catalog);
  const result = new Set(selected);
  const visited = new Set<string>();
  const pending = [...codes];
  while (pending.length) {
    const code = pending.pop()!;
    if (!visited.has(code)) {
      visited.add(code);
      result.add(code);
      pending.push(...(requires.get(code) ?? []));
    }
  }
  return Array.from(result);
}

/** `selected` bỏ `codes` và mọi quyền (đang chọn) cần tới chúng (lan nhiều cấp). */
export function withoutDependents(
  selected: readonly string[],
  codes: readonly string[],
  catalog: Catalog
): string[] {
  const requires = requiresOf(catalog);
  const removed = new Set(codes);
  let changed = true;
  while (changed) {
    changed = false;
    selected.forEach((code) => {
      if (!removed.has(code) && (requires.get(code) ?? []).some((r) => removed.has(r))) {
        removed.add(code);
        changed = true;
      }
    });
  }
  return selected.filter((code) => !removed.has(code));
}

/** Nhãn của các quyền mà `code` cần — hiện dưới quyền đó. */
export function requiredLabels(code: string, catalog: Catalog): string[] {
  const labels = new Map(
    catalog.groups.flatMap((g) => g.permissions.map((p) => [p.code, p.label] as const))
  );
  return (requiresOf(catalog).get(code) ?? []).map((r) => labels.get(r) ?? r);
}
