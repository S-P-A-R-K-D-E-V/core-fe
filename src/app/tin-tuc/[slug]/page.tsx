import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { NewsDetailsView } from 'src/sections/news/view/news-details-view';
import { getPublishedPost } from 'src/lib/store-posts';
import {
  clip,
  absoluteUrl,
  postJsonLd,
  jsonLdString,
  storeDisplayName,
  DESCRIPTION_MAX,
} from 'src/lib/store-seo';
import { getRequestOrigin, getTenantBranding } from 'src/lib/tenant-branding';

// ----------------------------------------------------------------------

type Props = {
  params: { slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [branding, data] = await Promise.all([getTenantBranding(), getPublishedPost(params.slug)]);
  if (!data) return { title: 'Tin tức', robots: { index: false, follow: true } };

  const { post } = data;
  const storeName = storeDisplayName(branding);
  const title = post.metaTitle || post.title;
  const description = clip(post.metaDescription || post.summary || post.title, DESCRIPTION_MAX);
  const image = absoluteUrl(post.coverUrl, getRequestOrigin());
  const url = `/tin-tuc/${post.slug}/`;

  return {
    title: { absolute: `${title} — ${storeName}` },
    description,
    ...(post.metaKeywords && { keywords: post.metaKeywords }),
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      locale: 'vi_VN',
      siteName: storeName,
      title,
      description,
      ...(post.publishedAt && { publishedTime: post.publishedAt }),
      modifiedTime: post.updatedAt,
      ...(post.tags.length && { tags: post.tags }),
      ...(image && { images: [{ url: image, alt: post.title }] }),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description },
  };
}

export default async function NewsDetailsPage({ params }: Props) {
  const [branding, data] = await Promise.all([getTenantBranding(), getPublishedPost(params.slug)]);
  if (!data) notFound();

  const jsonLd = postJsonLd({
    post: data.post,
    origin: getRequestOrigin(),
    storeName: storeDisplayName(branding),
    logoUrl: branding?.logoUrl,
  });

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <NewsDetailsView branding={branding} data={data} />
    </>
  );
}
