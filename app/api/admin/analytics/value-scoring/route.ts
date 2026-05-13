import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import ContactMessage from '@/lib/models/ContactMessage';
import AdvertiseInquiry from '@/lib/models/AdvertiseInquiry';

export async function GET(req: NextRequest) {
  try {
    const user = await getAdminSessionFromReq(req);
    if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    await connectDB();

    // Aggregate Contact Messages
    const contactLeads = await ContactMessage.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    // Aggregate Advertise Inquiries
    const adLeads = await AdvertiseInquiry.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    // Combine and score
    const scores = new Map<string, number>();

    const normalizeSource = (source: string | null) => {
        if (!source) return 'unknown';
        // Basic normalization: remove query params if it's a URL
        if (source.startsWith('http') || source.startsWith('/')) {
            try {
                const url = new URL(source, 'https://lokswami.com');
                return url.pathname;
            } catch {
                return source;
            }
        }
        return source;
    };

    contactLeads.forEach(lead => {
        const source = normalizeSource(lead._id);
        scores.set(source, (scores.get(source) || 0) + lead.count);
    });

    adLeads.forEach(lead => {
        const source = normalizeSource(lead._id);
        // Advertise leads might be higher value, but we use 1:1 score for now
        scores.set(source, (scores.get(source) || 0) + lead.count);
    });

    const sortedScores = Array.from(scores.entries())
        .map(([source, score]) => ({ source, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);

    return NextResponse.json({
        success: true,
        data: sortedScores,
        period: { days, startDate }
    });

  } catch (error) {
    console.error('Value Scoring API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
