import { NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import { NEWS_CATEGORIES, resolveNewsCategory } from '@/lib/constants/newsCategories';
import Article from '@/lib/models/Article';

type CategoryAggregateRow = {
  _id?: string;
  count?: number;
};

type CategoryResponseItem = {
  name: string;
  hindi: string;
  count: number;
};

function nonEmpty(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function toCategoryItem(categoryName: string, count: number): CategoryResponseItem {
  const resolved = resolveNewsCategory(categoryName);

  return {
    name: resolved?.nameEn || categoryName,
    hindi: resolved?.name || categoryName,
    count,
  };
}

function buildDefaultCategories(): CategoryResponseItem[] {
  return NEWS_CATEGORIES.slice(0, 4).map((category) => ({
    name: category.nameEn,
    hindi: category.name,
    count: 0,
  }));
}

export async function GET() {
  try {
    await connectDB();

    const aggregated = (await Article.aggregate([
      {
        $match: {
          category: { $exists: true, $type: 'string', $ne: '' },
        },
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 8 },
    ])) as CategoryAggregateRow[];

    const categories = aggregated
      .map((row) => {
        const categoryName = nonEmpty(row._id);
        if (!categoryName) {
          return null;
        }

        return toCategoryItem(categoryName, typeof row.count === 'number' ? row.count : 0);
      })
      .filter((item): item is CategoryResponseItem => item !== null)
      .slice(0, 4);

    return NextResponse.json({
      categories: categories.length ? categories : buildDefaultCategories(),
    });
  } catch (error) {
    console.error('[AI Categories] Failed to load category suggestions:', error);

    return NextResponse.json({
      categories: buildDefaultCategories(),
    });
  }
}
