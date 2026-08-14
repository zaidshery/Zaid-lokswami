import { COMPANY_INFO } from '@/lib/constants/company';
import { getArticleForMetadata } from '@/lib/content/serverArticles';
import {
  buildArticleSocialPreview,
  socialPreviewHeaders,
} from '@/lib/server/socialPreviewImage';
import { resolveArticleOgImageUrl } from '@/lib/utils/articleMedia';
import { getSiteUrl, toAbsoluteArticleUrl } from '@/lib/seo/articleSeo';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const siteUrl = getSiteUrl();
  let article: Awaited<ReturnType<typeof getArticleForMetadata>> = null;
  try {
    article = await getArticleForMetadata(id);
  } catch {
    article = null;
  }
  const fallbackImage = toAbsoluteArticleUrl('/lokswami-share-preview.png', siteUrl);

  if (!article) {
    const image = await buildArticleSocialPreview({
      title: COMPANY_INFO.name,
      description: COMPANY_INFO.tagline.en,
      imageUrl: fallbackImage,
      label: 'LOKSWAMI',
    });
    return new Response(Uint8Array.from(image), { headers: socialPreviewHeaders() });
  }

  const imageRaw = resolveArticleOgImageUrl({
    ogImage: article.seo.ogImage,
    image: article.image,
  });

  const image = await buildArticleSocialPreview({
    title: article.seo.metaTitle || article.title,
    description: article.seo.metaDescription || article.summary,
    imageUrl: imageRaw ? toAbsoluteArticleUrl(imageRaw, siteUrl) : fallbackImage,
    label: article.category || 'NEWS',
  });
  return new Response(Uint8Array.from(image), { headers: socialPreviewHeaders() });
}
