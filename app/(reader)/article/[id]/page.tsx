import { notFound, permanentRedirect } from 'next/navigation';
import { buildArticleRedirectPath } from '@/lib/seo/articleSeo';
import {
  PublicArticleResolutionError,
  resolvePublicArticleToken,
} from '@/lib/server/publicArticles';

export default async function LegacyArticleRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolution = await resolvePublicArticleToken(id);
  if (resolution.kind === 'missing') notFound();
  if (resolution.kind === 'ambiguous' || resolution.kind === 'unavailable') {
    throw new PublicArticleResolutionError(resolution.kind);
  }
  permanentRedirect(
    buildArticleRedirectPath(resolution.article, searchParams ? await searchParams : undefined)
  );
}
