import { NextResponse } from 'next/server';
import { getArticleForMetadata } from '@/lib/content/serverArticles';
import { buildArticlePublicPath } from '@/lib/seo/articleSeo';
import { resolveShareRequestOrigin } from '@/lib/server/requestOrigin';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const token = decodeURIComponent(id || '').trim();
  const origin = resolveShareRequestOrigin(request);

  if (!token) {
    return NextResponse.redirect(new URL('/main', origin), 307);
  }

  const article = await getArticleForMetadata(token);
  const targetPath = article
    ? buildArticlePublicPath({ id: article.id, slug: article.slug })
    : `/main/article/${encodeURIComponent(token)}`;

  return NextResponse.redirect(new URL(targetPath, origin), 307);
}
