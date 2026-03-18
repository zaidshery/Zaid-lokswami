export {};

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Article = require('../lib/models/Article');
const Category = require('../lib/models/Category');
const Author = require('../lib/models/Author');
const User = require('../lib/models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lokswami';
const FIXTURE_PATH = path.resolve(__dirname, 'seed-fixtures.json');
const MAX_FIXTURE_ARTICLES = 5;
const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || '');

const categories = [
  { name: 'National', slug: 'national', description: 'National news and updates' },
  { name: 'International', slug: 'international', description: 'International news coverage' },
  { name: 'Sports', slug: 'sports', description: 'Sports news and updates' },
  { name: 'Entertainment', slug: 'entertainment', description: 'Entertainment and celebrity news' },
  { name: 'Tech', slug: 'tech', description: 'Technology and innovation news' },
  { name: 'Business', slug: 'business', description: 'Business and economy news' },
];

const authors = [
  {
    name: 'Raj Kumar',
    email: 'raj@lokswami.com',
    bio: 'Senior journalist covering national and business stories.',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=raj',
  },
  {
    name: 'Priya Sharma',
    email: 'priya@lokswami.com',
    bio: 'Entertainment and culture correspondent.',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya',
  },
  {
    name: 'Amit Patel',
    email: 'amit@lokswami.com',
    bio: 'Sports editor and match analyst.',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=amit',
  },
];

function loadArticlesFromFixtures() {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  const parsed = JSON.parse(raw || '{}');
  const fixtureArticles = Array.isArray(parsed.articles) ? parsed.articles : [];

  if (fixtureArticles.length === 0) {
    throw new Error('scripts/seed-fixtures.json must contain at least one article.');
  }

  if (fixtureArticles.length > MAX_FIXTURE_ARTICLES) {
    throw new Error(
      `scripts/seed-fixtures.json may contain at most ${MAX_FIXTURE_ARTICLES} articles.`
    );
  }

  const validCategories = new Set(categories.map((category) => category.name));
  const validAuthors = new Set(authors.map((author) => author.name));

  return fixtureArticles.map((article: Record<string, unknown>, index: number) => {
    const title = typeof article.title === 'string' ? article.title.trim() : '';
    const summary = typeof article.summary === 'string' ? article.summary.trim() : '';
    const content = typeof article.content === 'string' ? article.content.trim() : '';
    const image = typeof article.image === 'string' ? article.image.trim() : '';
    const category = typeof article.category === 'string' ? article.category.trim() : '';
    const author = typeof article.author === 'string' ? article.author.trim() : '';
    const views = Number(article.views);
    const publishedAtOffsetHours = Number(article.publishedAtOffsetHours);

    if (!title || !summary || !content || !image || !category || !author) {
      throw new Error(`Fixture article ${index + 1} is missing a required field.`);
    }

    if (!validCategories.has(category)) {
      throw new Error(`Fixture article ${index + 1} uses unknown category "${category}".`);
    }

    if (!validAuthors.has(author)) {
      throw new Error(`Fixture article ${index + 1} uses unknown author "${author}".`);
    }

    return {
      title,
      summary,
      content,
      image,
      category,
      author,
      isBreaking: Boolean(article.isBreaking),
      isTrending: Boolean(article.isTrending),
      views: Number.isFinite(views) ? views : 0,
      publishedAt: new Date(
        Date.now() -
          (Number.isFinite(publishedAtOffsetHours)
            ? Math.max(0, publishedAtOffsetHours)
            : index * 2) *
            60 *
            60 *
            1000
      ),
    };
  });
}

function parseAdminEmails(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

async function seedSuperAdmins() {
  const adminEmails = parseAdminEmails(ADMIN_EMAILS);

  if (adminEmails.length === 0) {
    console.log('Skipping super admin seed because ADMIN_EMAILS is not set');
    return;
  }

  for (const email of adminEmails) {
    await User.updateOne(
      { email },
      {
        $set: {
          name: 'Super Admin',
          role: 'super_admin',
          isActive: true,
          lastLoginAt: new Date(),
        },
        $setOnInsert: {
          email,
          image: '',
          savedArticles: [],
          preferredLanguage: 'hi',
          preferredCategories: [],
          notificationsEnabled: false,
        },
      },
      { upsert: true }
    );
  }

  console.log(`Seeded ${adminEmails.length} super admin account(s) from ADMIN_EMAILS`);
}

async function seed() {
  try {
    const articles = loadArticlesFromFixtures();
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    await Article.deleteMany({});
    await Category.deleteMany({});
    await Author.deleteMany({});
    console.log('Cleared existing data');

    await Category.insertMany(categories);
    console.log('Seeded categories');

    await Author.insertMany(authors);
    console.log('Seeded authors');

    await Article.insertMany(articles);
    console.log(`Seeded ${articles.length} articles from scripts/seed-fixtures.json`);

    await seedSuperAdmins();

    console.log('\nDatabase seeded successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
