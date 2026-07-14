import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import ContactMessage from '@/lib/models/ContactMessage';
import AdvertiseInquiry from '@/lib/models/AdvertiseInquiry';
import Article from '@/lib/models/Article';

type LeadArticleSummary = {
  _id: { toString(): string };
  title?: string;
  status?: string;
};

export async function GET(req: NextRequest) {
  try {
    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canViewPage(user.role, 'business_value')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    await connectDB();

    // We specifically want paths that look like articles: /main/article/...
    const matchCondition = {
        createdAt: { $gte: startDate },
        source: { $regex: /^\/main\/article\//i }
    };

    const contactLeads = await ContactMessage.aggregate([
      { $match: matchCondition },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    const adLeads = await AdvertiseInquiry.aggregate([
      { $match: matchCondition },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    const urlScores = new Map<string, number>();

    const addScore = (url: string, count: number) => {
        // Strip query params if any
        const cleanUrl = url.split('?')[0];
        urlScores.set(cleanUrl, (urlScores.get(cleanUrl) || 0) + count);
    };

    contactLeads.forEach(lead => addScore(lead._id, lead.count));
    adLeads.forEach(lead => addScore(lead._id, lead.count));

    // Get the top URLs
    const topUrls = Array.from(urlScores.entries())
        .map(([url, score]) => ({ url, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

    // Extract Article IDs from URLs
    const articleIds = topUrls.map(item => {
        const match = item.url.match(/\/main\/article\/([a-zA-Z0-9_-]+)/i);
        return match ? match[1] : null;
    }).filter(Boolean);

    // Lookup article metadata to display nice titles in the UI
    const articles = (await Article.find(
        { _id: { $in: articleIds } },
        { title: 1, _id: 1, status: 1 }
    ).lean()) as unknown as LeadArticleSummary[];

    const articlesMap = new Map(articles.map(a => [a._id.toString(), a]));

    const enrichedResults = topUrls.map(item => {
        const match = item.url.match(/\/main\/article\/([a-zA-Z0-9_-]+)/i);
        const articleId = match ? match[1] : null;
        const articleData = articleId ? articlesMap.get(articleId) : null;

        return {
            url: item.url,
            score: item.score,
            articleId,
            title: articleData?.title || 'Unknown Article',
            status: articleData?.status || 'unknown'
        };
    });

    return NextResponse.json({
        success: true,
        data: enrichedResults,
        period: { days, startDate }
    });

  } catch (error) {
    console.error('Top Lead Pages API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
