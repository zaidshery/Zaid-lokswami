import { NextRequest, NextResponse } from 'next/server';
import { runSemanticRagSearch } from '@/lib/ai/semanticSearch';

type SearchRequestBody = {
  query?: string;
  category?: string;
  limit?: number;
  sortBy?: 'relevance' | 'latest' | 'popular';
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as SearchRequestBody;
    const query = typeof body.query === 'string' ? body.query.trim() : '';

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    const payload = await runSemanticRagSearch({
      query,
      category: body.category,
      limit: body.limit,
      sortBy: body.sortBy,
    });

    return NextResponse.json({
      success: true,
      answer: payload.answer,
      answerSource: payload.results.length ? 'cms_articles' : 'empty_database',
      confidence: payload.results.length ? 'medium' : 'low',
      query: payload.query,
      data: {
        ...payload,
        provider: 'local',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local search failed';
    console.error('[AI Search Route] Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
