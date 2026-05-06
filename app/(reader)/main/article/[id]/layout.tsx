import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { COMPANY_INFO } from '@/lib/constants/company';
import { getArticleForMetadata } from '@/lib/content/serverArticles';
import { resolveArticleOgImageUrl } from '@/lib/utils/articleMedia';
import {
  buildArticlePublicPath,
  buildNewsArticleJsonLd,
  toAbsoluteArticleUrl,
} from '@/lib/seo/articleSeo';

const fallbackSiteUrl = 'http://localhost:3000';

function normalizeSiteUrl(value: string) {
  return value.replace(/\/+$/, '');
}

type LayoutContext = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(context: LayoutContext): Promise<Metadata> {
  const { id } = await context.params;
  const decodedId = decodeURIComponent(id);
  const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || fallbackSiteUrl);

  const article = await getArticleForMetadata(decodedId);
  if (!article) {
    return {
      title: `Article | ${COMPANY_INFO.name}`,
      description: COMPANY_INFO.tagline.en,
      robots: { index: false, follow: true },
    };
  }

  const seoTitle = article.seo.metaTitle || article.title;
  const title = `${seoTitle} | ${COMPANY_INFO.name}`;
  const description = article.seo.metaDescription || article.summary;
  const canonical =
    article.seo.canonicalUrl ||
    `${siteUrl}${buildArticlePublicPath({ id: article.id, slug: article.slug })}`;
  const ogImageRaw = resolveArticleOgImageUrl({
    ogImage: article.seo.ogImage,
    image: article.image,
  });
  const ogImage = ogImageRaw ? toAbsoluteArticleUrl(ogImageRaw, siteUrl) : '';

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'article',
      siteName: COMPANY_INFO.name,
      section: article.category,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.author],
      images: ogImage
        ? [
            {
              url: ogImage,
              width: 1200,
              height: 630,
              alt: article.seo.featuredImageAlt || seoTitle,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  };
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
  const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || fallbackSiteUrl);
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
