import {
  getPublicEpaperForMetadata,
  getPublicEpaperStoryForMetadata,
} from '@/lib/server/publicEpaperMetadata';
import {
  buildArticleSocialPreview,
  buildEpaperSocialPreview,
  socialPreviewHeaders,
} from '@/lib/server/socialPreviewImage';
import { getSiteUrl, toAbsoluteArticleUrl } from '@/lib/seo/articleSeo';
import { formatUiDate } from '@/lib/utils/dateFormat';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paper = url.searchParams.get('paper') || '';
  const city = url.searchParams.get('city') || '';
  const date = url.searchParams.get('date') || '';
  const storyToken = url.searchParams.get('story') || '';
  const siteUrl = getSiteUrl();
  const issue = await getPublicEpaperForMetadata({
    id: paper,
    citySlug: city,
    publishDate: date,
  });
  const story =
    storyToken && (issue?.id || paper)
      ? await getPublicEpaperStoryForMetadata({
          epaperId: issue?.id || paper,
          storyToken,
        })
      : null;
  const cityLabel = issue?.cityName || city || 'Digital Edition';
  const dateLabel = issue?.publishDate
    ? formatUiDate(issue.publishDate, issue.publishDate)
    : date
      ? formatUiDate(date, date)
      : 'Latest edition';
  const title =
    cityLabel && cityLabel !== 'Digital Edition'
      ? `Lokswami ${cityLabel} E-Paper`
      : 'Lokswami Digital E-Paper';
  const imageUrl = issue?.thumbnailPath
    ? toAbsoluteArticleUrl(issue.thumbnailPath, siteUrl)
    : toAbsoluteArticleUrl('/placeholders/epaper-3x4.svg', siteUrl);
  const image = story
    ? await buildArticleSocialPreview({
        title: story.title || title,
        description:
          story.excerpt ||
          `Read this story from the ${cityLabel} Lokswami e-paper${
            story.pageNumber > 0 ? ` on page ${story.pageNumber}` : ''
          }.`,
        imageUrl: story.coverImagePath
          ? toAbsoluteArticleUrl(story.coverImagePath, siteUrl)
          : imageUrl,
        label:
          story.pageNumber > 0
            ? `E-Paper | Page ${story.pageNumber}`
            : 'E-Paper Story',
      })
    : await buildEpaperSocialPreview({
        title,
        cityLabel,
        dateLabel,
        imageUrl,
      });

  return new Response(Uint8Array.from(image), { headers: socialPreviewHeaders() });
}
