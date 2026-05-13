import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import { generateThreePointSummary } from '@/lib/ai/summarizer';

type SummaryRequestBody = {
  articleId?: string;
  text?: string;
  language?: 'hi' | 'en';
};

type ArticleSummaryDoc = {
  title?: string;
  content?: string;
  summary?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as SummaryRequestBody;
    const language = body.language === 'en' ? 'en' : 'hi';
    const articleId = typeof body.articleId === 'string' ? body.articleId.trim() : '';

    let textToSummarize = '';
    let sourceTitle = '';

    if (articleId) {
      await connectDB();
      const article = (await Article.findById(articleId)
        .select('title content summary')
        .lean()) as ArticleSummaryDoc | null;

      if (!article) {
        return NextResponse.json(
          { success: false, error: 'Article not found' },
          { status: 404 }
        );
      }

      sourceTitle = typeof article.title === 'string' ? article.title.trim() : '';
      const articleSummary =
        typeof article.summary === 'string' ? article.summary.trim() : '';
      const articleContent =
        typeof article.content === 'string' ? article.content.trim() : '';

      textToSummarize = `${sourceTitle}. ${articleSummary} ${articleContent}`.trim();
    } else if (typeof body.text === 'string' && body.text.trim()) {
      textToSummarize = body.text.trim().slice(0, 6000);
    }

    if (!textToSummarize) {
      return NextResponse.json(
        { success: false, error: 'Provide articleId or text' },
        { status: 400 }
      );
    }

    const summary = await generateThreePointSummary(textToSummarize, language);
    const points = summary.bullets.slice(0, 3);
    const headline = sourceTitle || (language === 'hi' ? 'Lokswami summary' : 'Lokswami summary');

    return NextResponse.json({
      success: true,
      headline,
      points,
      sentiment: 'neutral',
      language,
      data: {
        sourceTitle,
        language,
        mode: articleId ? 'article' : 'text',
        provider: summary.mode,
        bullets: points,
        headline,
        sentiment: 'neutral',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Summary failed';
    console.error('[AI Summary] Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
