import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import Category from '@/lib/models/Category';
import fs from 'fs/promises';
import path from 'path';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import { NEWS_CATEGORIES } from '@/lib/constants/newsCategories';

type CategoryRecord = {
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
};

const DEFAULT_CMS_CATEGORIES: Omit<CategoryRecord, '_id'>[] = NEWS_CATEGORIES.map(
  (category) => ({
    name: category.nameEn,
    slug: category.slug,
    description: `${category.nameEn} news and updates`,
    icon: category.icon,
  })
);

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function sortCategories(items: CategoryRecord[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function findMissingDefaults(existing: CategoryRecord[]) {
  const existingNames = new Set(
    existing
      .map((item) => (typeof item.name === 'string' ? normalize(item.name) : ''))
      .filter(Boolean)
  );
  const existingSlugs = new Set(
    existing
      .map((item) => (typeof item.slug === 'string' ? normalize(item.slug) : ''))
      .filter(Boolean)
  );

  return DEFAULT_CMS_CATEGORIES.filter(
    (item) =>
      !existingNames.has(normalize(item.name)) &&
      !existingSlugs.has(normalize(item.slug))
  );
}

function buildFileCategory(defaultCategory: Omit<CategoryRecord, '_id'>): CategoryRecord {
  return {
    _id: `default-${defaultCategory.slug}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2, 8)}`,
    ...defaultCategory,
  };
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) return true;

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for categories route, using file store.', error);
    return true;
  }
}

export async function GET() {
  try {
    const user = await getAdminSession();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (await shouldUseFileStore()) {
      const dataPath = path.resolve(process.cwd(), 'data', 'categories.json');
      const dataDir = path.dirname(dataPath);
      try {
        await fs.mkdir(dataDir, { recursive: true });
      } catch {
        // Ignore filesystem write restrictions and continue with in-memory defaults.
      }

      let cats: CategoryRecord[] = [];
      try {
        const raw = await fs.readFile(dataPath, 'utf-8');
        const parsed = JSON.parse(raw || '[]');
        cats = Array.isArray(parsed) ? parsed : [];
      } catch {
        cats = [];
      }

      const missingDefaults = findMissingDefaults(cats);
      if (missingDefaults.length) {
        const seeded = [
          ...cats,
          ...missingDefaults.map((item) => buildFileCategory(item)),
        ];
        try {
          await fs.writeFile(dataPath, JSON.stringify(sortCategories(seeded), null, 2), 'utf-8');
        } catch {
          // File may be read-only in restricted environments; still return seeded data.
        }
        cats = seeded;
      }

      return NextResponse.json({ success: true, data: sortCategories(cats) });
    }

    let cats = (await Category.find().sort({ name: 1 }).lean()) as unknown as CategoryRecord[];
    const missingDefaults = findMissingDefaults(cats);

    if (missingDefaults.length) {
      try {
        await Category.insertMany(missingDefaults, { ordered: false });
      } catch {
        // Ignore duplicate insert races and continue with refreshed list.
      }

      cats = (await Category.find().sort({ name: 1 }).lean()) as unknown as CategoryRecord[];
    }

    return NextResponse.json({ success: true, data: cats });
  } catch (err) {
    console.error('categories GET err', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const reqClone = req.clone();
    const user = await getAdminSession();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!canViewPage(user.role, 'categories')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const body = await reqClone.json();
    const { name, description } = body;
    if (!name) return NextResponse.json({ success: false, error: 'Name required' }, { status: 400 });

    if (await shouldUseFileStore()) {
      const dataDir = path.resolve(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
      const dataPath = path.join(dataDir, 'categories.json');
      let cats: CategoryRecord[] = [];
      try {
        const raw = await fs.readFile(dataPath, 'utf-8');
        const parsed = JSON.parse(raw || '[]');
        cats = Array.isArray(parsed) ? (parsed as CategoryRecord[]) : [];
      } catch {}
      if (cats.find((c) => c.name.toLowerCase() === name.toLowerCase())) {
        return NextResponse.json({ success: false, error: 'Category already exists' }, { status: 400 });
      }
      const newCat = { _id: Date.now().toString(), name, description: description || '', slug: name.toLowerCase().replace(/\s+/g, '-') };
      cats.push(newCat);
      await fs.writeFile(dataPath, JSON.stringify(cats, null, 2), 'utf-8');
      return NextResponse.json({ success: true, data: newCat }, { status: 201 });
    }

    const existing = await Category.findOne({ name });
    if (existing) return NextResponse.json({ success: false, error: 'Category already exists' }, { status: 400 });

    const cat = new Category({ name, description: description || '' });
    await cat.save();
    return NextResponse.json({ success: true, data: cat }, { status: 201 });
  } catch (err) {
    console.error('cat create err', err);
    return NextResponse.json({ success: false, error: 'Failed to create category' }, { status: 500 });
  }
}

