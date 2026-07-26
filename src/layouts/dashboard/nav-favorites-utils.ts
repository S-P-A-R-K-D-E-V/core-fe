import { NavProps, NavItemBaseProps } from 'src/components/nav-section/types';

// ----------------------------------------------------------------------

export type FlatNavItem = {
  path: string;
  label: string;
  groupLabel?: string;
  icon?: React.ReactElement;
};

/** Đệ quy toàn bộ navData thành danh sách phẳng {path, label} để hiển thị trong picker */
export function flattenNavItems(navData: NavProps['data']): FlatNavItem[] {
  const result: FlatNavItem[] = [];

  navData.forEach((group) => {
    group.items.forEach((item) => {
      result.push({ path: item.path, label: item.title, groupLabel: group.subheader, icon: item.icon });

      (item.children as NavItemBaseProps[] | undefined)?.forEach((child) => {
        result.push({
          path: child.path,
          label: `${item.title} · ${child.title}`,
          groupLabel: group.subheader,
          icon: item.icon,
        });
      });
    });
  });

  return result;
}

/** Ghép danh sách favorite (path[]) với dữ liệu nav hiện tại → items cho NavSectionVertical */
export function buildFavoriteNavItems(
  navData: NavProps['data'],
  favorites: string[]
): NavItemBaseProps[] {
  const flat = flattenNavItems(navData);
  const byPath = new Map(flat.map((item) => [item.path, item]));

  return favorites
    .map((path) => byPath.get(path))
    .filter((item): item is FlatNavItem => !!item)
    .map((item) => ({ title: item.label, path: item.path, icon: item.icon }));
}
