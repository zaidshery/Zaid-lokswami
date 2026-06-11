import { COMPANY_INFO } from '@/lib/constants/company';
import { buildArticleSocialPreview, socialPreviewHeaders } from '@/lib/server/socialPreviewImage';
import { getPublicVideoForMetadata } from '@/lib/server/publicVideoMetadata';
import { getSiteUrl, toAbsoluteArticleUrl } from '@/lib/seo/articleSeo';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  const siteUrl = getSiteUrl();
  const video = id ? await getPublicVideoForMetadata(id) : null;
  const fallbackImage = toAbsoluteArticleUrl('/lokswami-share-preview.png', siteUrl);
  const image = await buildArticleSocialPreview({
    title: video?.title || COMPANY_INFO.name,
    description:
      video?.description || 'Watch the latest Lokswami video update with thumbnail, title, and quick summary.',
    imageUrl: video?.thumbnail
      ? toAbsoluteArticleUrl(video.thumbnail, siteUrl)
      : fallbackImage,
    label: video?.category || 'NEWS VIDEO',
  });

  return new Response(Uint8Array.from(image), { headers: socialPreviewHeaders() });
}
