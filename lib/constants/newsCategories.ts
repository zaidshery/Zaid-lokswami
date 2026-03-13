export type NewsCategory = {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  icon: string;
  color: string;
  aliases: string[];
};

const TECH_HI = '\u091f\u0947\u0915';
const TECHNOLOGY_HI = '\u091f\u0947\u0915\u094d\u0928\u094b\u0932\u0949\u091c\u0940';
const BUSINESS_HI = '\u092c\u093f\u091c\u0928\u0947\u0938';
const TRADE_HI = '\u0935\u094d\u092f\u093e\u092a\u093e\u0930';
const REGIONAL_HI = '\u0915\u094d\u0937\u0947\u0924\u094d\u0930\u0940\u092f';
const POLITICS_HI = '\u0930\u093e\u091c\u0928\u0940\u0924\u093f';

export const NEWS_CATEGORIES: NewsCategory[] = [
  {
    id: 'regional',
    slug: 'regional',
    name: REGIONAL_HI,
    nameEn: 'Regional',
    icon: '\ud83d\udccd',
    color: '#F59E0B',
    aliases: ['regional', 'local', REGIONAL_HI],
  },
  {
    id: 'politics',
    slug: 'politics',
    name: POLITICS_HI,
    nameEn: 'Politics',
    icon: '\ud83c\udfdb\ufe0f',
    color: '#EF4444',
    aliases: ['politics', 'government', 'rajneeti', POLITICS_HI],
  },
  {
    id: 'national',
    slug: 'national',
    name: '\u0930\u093e\u0937\u094d\u091f\u094d\u0930\u0940\u092f',
    nameEn: 'National',
    icon: '\ud83c\uddee\ud83c\uddf3',
    color: '#3B82F6',
    aliases: ['national', '\u0930\u093e\u0937\u094d\u091f\u094d\u0930\u0940\u092f'],
  },
  {
    id: 'international',
    slug: 'international',
    name: '\u0905\u0902\u0924\u0930\u094d\u0930\u093e\u0937\u094d\u091f\u094d\u0930\u0940\u092f',
    nameEn: 'International',
    icon: '\ud83c\udf0d',
    color: '#8B5CF6',
    aliases: [
      'international',
      '\u0905\u0902\u0924\u0930\u0930\u093e\u0937\u094d\u091f\u094d\u0930\u0940\u092f',
      '\u0905\u0902\u0924\u0930\u094d\u0930\u093e\u0937\u094d\u091f\u094d\u0930\u0940\u092f',
    ],
  },
  {
    id: 'sports',
    slug: 'sports',
    name: '\u0916\u0947\u0932',
    nameEn: 'Sports',
    icon: '\ud83c\udfcf',
    color: '#10B981',
    aliases: ['sports', '\u0916\u0947\u0932'],
  },
  {
    id: 'entertainment',
    slug: 'entertainment',
    name: '\u092e\u0928\u094b\u0930\u0902\u091c\u0928',
    nameEn: 'Entertainment',
    icon: '\ud83c\udfac',
    color: '#EC4899',
    aliases: ['entertainment', '\u092e\u0928\u094b\u0930\u0902\u091c\u0928'],
  },
  {
    id: 'technology',
    slug: 'technology',
    name: TECH_HI,
    nameEn: 'Tech',
    icon: '\ud83d\udcbb',
    color: '#06B6D4',
    aliases: ['tech', 'technology', TECH_HI, TECHNOLOGY_HI],
  },
  {
    id: 'business',
    slug: 'business',
    name: BUSINESS_HI,
    nameEn: 'Business',
    icon: '\ud83d\udcbc',
    color: '#F97316',
    aliases: ['business', 'biz', BUSINESS_HI, TRADE_HI],
  },
];

export type NewsCategoryDefinition = {
  slug: string;
  name: string;
  nameEn: string;
  aliases?: string[];
};

export const NEWS_CATEGORY_DEFINITIONS: NewsCategoryDefinition[] = NEWS_CATEGORIES.map(
  (category) => ({
    slug: category.slug,
    name: category.name,
    nameEn: category.nameEn,
    aliases: category.aliases,
  })
);

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function resolveNewsCategory(value: string) {
  const selected = normalize(value);
  if (!selected) return undefined;

  return NEWS_CATEGORIES.find((category) => {
    const candidates = [category.slug, category.name, category.nameEn, ...category.aliases];
    return candidates.some((candidate) => normalize(candidate) === selected);
  });
}

export function getNewsCategoryHref(slug: string) {
  return `/main/category/${slug}`;
}
