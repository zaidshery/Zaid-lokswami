import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { getArticleForMetadata } from '@/lib/content/serverArticles';
import { resolveArticleOgImageUrl } from '@/lib/utils/articleMedia';
import {
  buildArticlePageMetadata,
  normalizeMetadataSiteUrl,
} from '@/lib/seo/articleMetadata';
import {
  buildArticlePublicPath,
  buildNewsArticleJsonLd,
} from '@/lib/seo/articleSeo';

type LayoutContext = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(context: LayoutContext): Promise<Metadata> {
  const { id } = await context.params;
  const decodedId = decodeURIComponent(id);
  const siteUrl = normalizeMetadataSiteUrl();

  const article = await getArticleForMetadata(decodedId);
  return buildArticlePageMetadata({ article, siteUrl });
}

export default function ArticleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  return <ArticleStructuredData params={params}>{children}</ArticleStructuredData>;
}

async function ArticleStructuredData({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const siteUrl = normalizeMetadataSiteUrl();
  const article = await getArticleForMetadata(decodedId);

  if (
    article?.slug &&
    decodedId !== article.slug &&
    (decodedId === article.id || article.previousSlugs.includes(decodedId))
  ) {
    permanentRedirect(buildArticlePublicPath({ id: article.id, slug: article.slug }));
  }

  const jsonLd = article
    ? buildNewsArticleJsonLd({
        id: article.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        image: resolveArticleOgImageUrl({
          ogImage: article.seo.ogImage,
          image: article.image,
        }),
        category: article.category,
        author: article.author,
        publishedAt: article.publishedAt,
        updatedAt: article.updatedAt,
        seo: article.seo,
        siteUrl,
      })
    : null;

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      {children}
    </>
  );
}
