import { NextResponse } from 'next/server';
import { getArticleForMetadata } from '@/lib/content/serverArticles';
import { buildArticlePublicPath } from '@/lib/seo/articleSeo';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const token = decodeURIComponent(id || '').trim();
  const url = new URL(request.url);

  if (!token) {
    return NextResponse.redirect(new URL('/main', url), 307);
  }

  const article = await getArticleForMetadata(token);
  const targetPath = article
    ? buildArticlePublicPath({ id: article.id, slug: article.slug })
    : `/main/article/${encodeURIComponent(token)}`;

  return NextResponse.redirect(new URL(targetPath, url), 307);
}
