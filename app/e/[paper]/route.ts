import { NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ paper: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { paper } = await context.params;
  const paperId = decodeURIComponent(paper || '').trim();
  const url = new URL(request.url);

  if (!paperId) {
    return NextResponse.redirect(new URL('/main/epaper', url), 307);
  }

  const params = new URLSearchParams({ paper: paperId });
  const page = Number.parseInt(url.searchParams.get('p') || '', 10);
  const story = (url.searchParams.get('s') || '').trim();

  if (Number.isFinite(page) && page > 0) {
    params.set('page', String(Math.floor(page)));
  }
  if (story) {
    params.set('story', story);
  }

  return NextResponse.redirect(new URL(`/main/epaper?${params.toString()}`, url), 307);
}
