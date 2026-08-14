import type { Metadata } from 'next';
import { getArticleForMetadata } from '@/lib/content/serverArticles';
import { resolveArticleOgImageUrl } from '@/lib/utils/articleMedia';
import {
  buildArticlePageMetadata,
  normalizeMetadataSiteUrl,
} from '@/lib/seo/articleMetadata';
import {
  buildArticlePublicPath,
  buildBreadcrumbListJsonLd,
  buildNewsArticleJsonLd,
} from '@/lib/seo/articleSeo';

type LayoutContext = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(context: LayoutContext): Promise<Metadata> {
  const { id } = await context.params;
  const siteUrl = normalizeMetadataSiteUrl();

  const article = await getArticleForMetadata(id);
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
  const siteUrl = normalizeMetadataSiteUrl();
  const article = await getArticleForMetadata(id);

  if (!article) {
    return <>{children}</>;
  }

  const newsArticleJsonLd = buildNewsArticleJsonLd({
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
  });

  const articlePath = buildArticlePublicPath({ id: article.id, slug: article.slug });
  const breadcrumbJsonLd = buildBreadcrumbListJsonLd({
    category: article.category,
    title: article.title,
    articleUrl: articlePath,
    siteUrl,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}

