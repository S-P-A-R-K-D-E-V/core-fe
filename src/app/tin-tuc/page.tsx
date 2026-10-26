import type { Metadata } from 'next';

import { NewsListView } from 'src/sections/news/view/news-list-view';
import { getPublishedPosts } from 'src/lib/store-posts';
import { clip, jsonLdString, storeDisplayName, DESCRIPTION_MAX } from 'src/lib/store-seo';
import { getRequestOrigin, getTenantBranding } from 'src/lib/tenant-branding';

// ----------------------------------------------------------------------

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function param(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() ? v.trim().slice(0, 100) : undefined;
}

function pageOf(searchParams: Props['searchParams']): number {
  const n = Number(param(searchParams?.page));
  return Number.isInteger(n) && n > 1 ? Math.min(n, 1000) : 1;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const branding = await getTenantBranding();
  const storeName = storeDisplayName(branding);
  const page = pageOf(searchParams);
  const q = param(searchParams?.q);
  const tag = param(searchParams?.tag);
  const title = tag ? `${tag} — Tin tức ${storeName}` : `Tin tức — ${storeName}`;
  const description = clip(
    `Bài viết, mẹo hay và tin mới từ ${storeName}${branding?.shortDescription ? ` — ${branding.shortDescription}` : ''}.`,
    DESCRIPTION_MAX
  );

  return {
    title: { absolute: page > 1 ? `${title} — trang ${page}` : title },
    description,
    alternates: { canonical: page > 1 ? `/tin-tuc/?page=${page}` : '/tin-tuc/' },
    // Trang kết quả tìm kiếm không cần lập chỉ mục (nội dung trùng các bài); thẻ và phân trang thì vẫn được.
    ...(q && { robots: { index: false, follow: true } }),
    openGraph: {
      type: 'website',
      url: '/tin-tuc/',
      locale: 'vi_VN',
      siteName: storeName,
      title,
      description,
    },
  };
}

export default async function NewsPage({ searchParams }: Props) {
  const page = pageOf(searchParams);
  const q = param(searchParams?.q);
  const tag = param(searchParams?.tag);
  const [branding, data] = await Promise.all([
    getTenantBranding(),
    getPublishedPosts({ page, q, tag }),
  ]);
  const origin = getRequestOrigin();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${origin}/tin-tuc/#blog`,
    name: `Tin tức — ${storeDisplayName(branding)}`,
    url: `${origin}/tin-tuc/`,
    blogPost: data.items.map((p) => ({
      '@type': 'BlogPosting',
      headline: clip(p.title, 110),
      url: `${origin}/tin-tuc/${p.slug}/`,
      ...(p.publishedAt && { datePublished: p.publishedAt }),
    })),
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <NewsListView branding={branding} data={data} q={q} tag={tag} />
    </>
  );
}
