import { NextRequest, NextResponse } from 'next/server';
import { fetchAllIndexedContent, type IndexedContent } from '@/lib/ai/contentIndex';

type ActionName = 'explain' | 'translate' | 'top_news' | 'trending_topics';

type ActionRequestBody = {
  action?: ActionName;
  text?: string;
  articleId?: string;
  language?: 'hi' | 'en';
};

type GroupedContent = {
  articles: IndexedContent[];
  epapers: IndexedContent[];
  videos: IndexedContent[];
  stories: IndexedContent[];
};

function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function emptyGroupedContent(): GroupedContent {
  return { articles: [], epapers: [], videos: [], stories: [] };
}

function groupContent(items: IndexedContent[]): GroupedContent {
  return items.reduce<GroupedContent>((groups, item) => {
    if (item.type === 'article') groups.articles.push(item);
    if (item.type === 'epaper') groups.epapers.push(item);
    if (item.type === 'video') groups.videos.push(item);
    if (item.type === 'story') groups.stories.push(item);
    return groups;
  }, emptyGroupedContent());
}

function trimGroupedContent(items: IndexedContent[]) {
  const counts = { article: 0, epaper: 0, video: 0, story: 0 };
  const selected: IndexedContent[] = [];

  for (const item of items) {
    if (selected.length >= 5) break;
    if (counts[item.type] >= 2) continue;
    counts[item.type] += 1;
    selected.push(item);
  }

  return groupContent(selected);
}

function summarizeText(text: string) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'No source text was available.';
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  return (sentences.slice(0, 2).join(' ') || cleaned).slice(0, 500);
}

function buildStructuredAnswer(params: {
  headline: string;
  summary: string;
  language: 'hi' | 'en';
}) {
  const keyPoints =
    params.summary
      .split(/(?<=[.!?])\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);

  return {
    headline: params.headline,
    summary: params.summary,
    keyPoints: keyPoints.length ? keyPoints : [params.summary],
    whyItMatters:
      params.language === 'hi'
        ? 'Yeh jawab Lokswami ke local content aur built-in retrieval par based hai.'
        : 'This answer is based on Lokswami local content and built-in retrieval.',
    relatedQuestions:
      params.language === 'hi'
        ? ['Aaj ki top khabrein kya hain?', 'Is topic par aur coverage dikhaiye', 'Latest e-paper kholiye']
        : ["What are today's top stories?", 'Show more coverage on this topic', 'Open the latest e-paper'],
  };
}

function scoreTopNews(items: IndexedContent[]) {
  return [...items].sort((left, right) => {
    const leftDate = new Date(left.date).getTime() || 0;
    const rightDate = new Date(right.date).getTime() || 0;
    const leftViews = typeof left.views === 'number' ? left.views : 0;
    const rightViews = typeof right.views === 'number' ? right.views : 0;
    return rightDate - leftDate || rightViews - leftViews;
  });
}

function scoreTrending(items: IndexedContent[]) {
  return [...items].sort((left, right) => {
    const leftViews = typeof left.views === 'number' ? left.views : 0;
    const rightViews = typeof right.views === 'number' ? right.views : 0;
    const leftDate = new Date(left.date).getTime() || 0;
    const rightDate = new Date(right.date).getTime() || 0;
    return rightViews - leftViews || rightDate - leftDate;
  });
}

function buildDigest(items: IndexedContent[], language: 'hi' | 'en', mode: ActionName) {
  const titles = items.slice(0, 3).map((item) => item.title).filter(Boolean);
  const headline =
    mode === 'trending_topics'
      ? language === 'hi'
        ? 'Trending coverage'
        : 'Trending coverage'
      : language === 'hi'
        ? 'Top news'
        : 'Top news';
  const summary = titles.length
    ? `${headline}: ${titles.join('; ')}.`
    : 'No published content is available yet.';

  return { headline, summary };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as ActionRequestBody;
    const action = body.action;
    const language = body.language === 'en' ? 'en' : 'hi';

    if (!action) {
      return NextResponse.json({ success: false, error: 'Action is required.' }, { status: 400 });
    }

    if (action === 'translate') {
      const answer =
        language === 'hi'
          ? 'Paid translation API disabled hai. ChatGPT Plus browser mein manually translate karke CMS mein paste karein.'
          : 'Paid translation API is disabled. Translate manually in ChatGPT Plus and paste the result into the CMS.';
      return NextResponse.json({
        success: true,
        action,
        answer,
        data: { action, answer },
      });
    }

    if (action === 'explain') {
      let matchedContent: IndexedContent | null = null;
      if (body.articleId) {
        const allContent = await fetchAllIndexedContent();
        matchedContent =
          allContent.find((item) => item.id === body.articleId && item.type === 'article') || null;
      }

      const sourceText =
        cleanText(body.text) ||
        [matchedContent?.title, matchedContent?.description].filter(Boolean).join('. ');
      const summary = summarizeText(sourceText);
      const headline = matchedContent?.title || (language === 'hi' ? 'Simple explanation' : 'Simple explanation');
      const structuredAnswer = buildStructuredAnswer({ headline, summary, language });
      const content = matchedContent ? groupContent([matchedContent]) : emptyGroupedContent();

      return NextResponse.json({
        success: true,
        action,
        answer: summary,
        structuredAnswer,
        content,
        data: {
          action,
          answer: summary,
          structuredAnswer,
          content,
        },
      });
    }

    const allContent = await fetchAllIndexedContent();
    const ranked =
      action === 'trending_topics' ? scoreTrending(allContent) : scoreTopNews(allContent);
    const selectedItems = ranked.slice(0, 8);
    const groupedContent = trimGroupedContent(selectedItems);
    const digest = buildDigest(selectedItems, language, action);
    const structuredAnswer = buildStructuredAnswer({
      headline: digest.headline,
      summary: digest.summary,
      language,
    });
    const primaryAction =
      action === 'top_news'
        ? { label: language === 'hi' ? 'Top coverage' : 'Top coverage', url: '/main/latest' }
        : { label: language === 'hi' ? 'More coverage' : 'More coverage', url: '/main' };

    return NextResponse.json({
      success: true,
      action,
      answer: digest.summary,
      structuredAnswer,
      followUpSuggestion: structuredAnswer.relatedQuestions[0],
      primaryAction,
      content: groupedContent,
      data: {
        action,
        answer: digest.summary,
        structuredAnswer,
        followUpSuggestion: structuredAnswer.relatedQuestions[0],
        primaryAction,
        content: groupedContent,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local AI action failed';
    console.error('[AI Actions] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
