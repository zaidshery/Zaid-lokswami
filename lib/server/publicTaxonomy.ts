import {
  NEWS_CATEGORIES,
  getNewsCategoryHref,
} from '@/lib/constants/newsCategories';
import { EPAPER_CITY_OPTIONS } from '@/lib/constants/epaperCities';

export type PublicCategoryItem = {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  icon: string;
  color: string;
  href: string;
};

export type PublicCityItem = {
  slug: string;
  name: string;
  href: string;
};

export function listPublicCategories(): PublicCategoryItem[] {
  return NEWS_CATEGORIES.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    nameEn: category.nameEn,
    icon: category.icon,
    color: category.color,
    href: getNewsCategoryHref(category.slug),
  }));
}

export function listPublicCities(): PublicCityItem[] {
  return EPAPER_CITY_OPTIONS.map((city) => ({
    slug: city.slug,
    name: city.name,
    href: `/main/epaper?city=${encodeURIComponent(city.slug)}`,
  }));
}
