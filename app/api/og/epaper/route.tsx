import { getPublicEpaperForMetadata } from '@/lib/server/publicEpaperMetadata';
import {
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
  const siteUrl = getSiteUrl();
  const issue = await getPublicEpaperForMetadata({
    id: paper,
    citySlug: city,
    publishDate: date,
  });
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
  const image = await buildEpaperSocialPreview({
    title,
    cityLabel,
    dateLabel,
    imageUrl,
  });

  return new Response(Uint8Array.from(image), { headers: socialPreviewHeaders() });
}
