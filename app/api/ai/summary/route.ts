import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import { generateJSON, isGeminiConfigured } from '@/lib/ai/gemini';

interface GeminiSummaryResponse {
  points: string[];
  headline: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface SummaryRequestBody {
  articleId?: string;
  text?: string;
  language?: 'hi' | 'en';
}

interface ArticleSummaryDoc {
  title?: string;
  content?: string;
  summary?: string;
}

function normalizeSummaryPoints(points: string[]) {
  const cleaned = points
    .filter((point): point is string => typeof point === 'string')
    .map((point) => point.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (cleaned.length !== 3) {
    throw new Error('Gemini summary did not return exactly 3 points.');
  }

  return [cleaned[0], cleaned[1], cleaned[2]] as [string, string, string];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as SummaryRequestBody;
    const language = body.language === 'en' ? 'en' : 'hi';

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI summary not configured. Set GEMINI_API_KEY.',
        },
        { status: 500 }
      );
    }

    let textToSummarize = '';
    let sourceTitle = '';
    const articleId = typeof body.articleId === 'string' ? body.articleId.trim() : '';

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
      textToSummarize = body.text.trim().substring(0, 2000);
    }

    if (!textToSummarize) {
      return NextResponse.json(
        { success: false, error: 'Provide articleId or text' },
        { status: 400 }
      );
    }

    const languageInstruction =
      language === 'hi'
        ? 'Write all 3 points in Hindi (Devanagari script).'
        : 'Write all 3 points in English.';

    const prompt = `Summarize this news article in exactly 3 bullet points.
${languageInstruction}
Each point must be one clear, complete sentence.

Article: ${textToSummarize}

Respond ONLY in valid JSON (no markdown, no code fences):
{
  "points": ["point 1", "point 2", "point 3"],
  "headline": "5 word max summary",
  "sentiment": "positive"
}`;

    const result = await generateJSON<GeminiSummaryResponse>(prompt);
    const points = normalizeSummaryPoints(Array.isArray(result.points) ? result.points : []);

    return NextResponse.json({
      success: true,
      headline: result.headline,
      points,
      sentiment: result.sentiment,
      language,
      data: {
        sourceTitle,
        language,
        mode: articleId ? 'article' : 'text',
        bullets: points,
        headline: result.headline,
        sentiment: result.sentiment,
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
