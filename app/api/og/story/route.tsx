import { COMPANY_INFO } from '@/lib/constants/company';
import { buildArticleSocialPreview, socialPreviewHeaders } from '@/lib/server/socialPreviewImage';
import { getPublicStoryForMetadata } from '@/lib/server/publicStoryMetadata';
import { getSiteUrl, toAbsoluteArticleUrl } from '@/lib/seo/articleSeo';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  const siteUrl = getSiteUrl();
  const story = id ? await getPublicStoryForMetadata(id) : null;
  const fallbackImage = toAbsoluteArticleUrl('/lokswami-share-preview.png', siteUrl);
  const image = await buildArticleSocialPreview({
    title: story?.title || COMPANY_INFO.name,
    description:
      story?.caption || 'Open the latest Lokswami visual story with big images and quick updates.',
    imageUrl: story?.thumbnail
      ? toAbsoluteArticleUrl(story.thumbnail, siteUrl)
      : fallbackImage,
    label: story?.category || 'VISUAL STORY',
  });

  return new Response(Uint8Array.from(image), { headers: socialPreviewHeaders() });
}
