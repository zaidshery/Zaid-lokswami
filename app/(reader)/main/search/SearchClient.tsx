'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store/appStore';
import { articles as mockArticles, type Article } from '@/lib/mock/data';
import { NEWS_CATEGORY_DEFINITIONS } from '@/lib/constants/newsCategories';
import NewsCard from '@/components/ui/NewsCard';
import { Search, X, TrendingUp, Clock, Filter } from 'lucide-react';
import { categoryMatches, fetchMergedLiveArticles } from '@/lib/content/liveArticles';

const TRENDING_SEARCHES: Record<'hi' | 'en', string[]> = {
  hi: ['IPL 2026', 'Lok Sabha', 'Mausam Update', 'Gold Price'],
  en: ['IPL 2026', 'Lok Sabha', 'Weather Update', 'Gold Price'],
};

export default function SearchClient() {
  const { language } = useAppStore();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [sourceArticles, setSourceArticles] = useState<Article[]>(mockArticles);
  const [searchResults, setSearchResults] = useState<Article[]>(mockArticles);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'latest' | 'popular'>('relevance');

  const categoryOptions = useMemo(
    () => [
      { slug: 'all', label: language === 'hi' ? 'Sabhi Categories' : 'All Categories' },
      ...NEWS_CATEGORY_DEFINITIONS.map((item) => ({
        slug: item.slug,
        label: language === 'hi' ? item.name : item.nameEn,
      })),
    ],
    [language]
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      const merged = await fetchMergedLiveArticles(120);
      if (!active) return;

      setSourceArticles(merged);

      if (initialQuery.trim()) {
        await performSearch(initialQuery, merged, selectedCategory, sortBy);
      } else {
        setSearchResults(merged);
      }
    };

    void load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const performLocalSearch = (
    searchQuery: string,
    dataSet: Article[] = sourceArticles,
    categoryValue: string = selectedCategory,
    sortValue: 'relevance' | 'latest' | 'popular' = sortBy
  ) => {
    const lowerQuery = searchQuery.toLowerCase().trim();

    const filtered = dataSet.filter((article) => {
      const matchesQuery =
        !lowerQuery ||
        article.title.toLowerCase().includes(lowerQuery) ||
        article.summary.toLowerCase().includes(lowerQuery) ||
        article.category.toLowerCase().includes(lowerQuery);

      const matchesCategory =
        categoryValue === 'all' ||
        categoryMatches(article.category, categoryValue, NEWS_CATEGORY_DEFINITIONS);

      return matchesQuery && matchesCategory;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortValue === 'latest') {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }
      if (sortValue === 'popular') {
        return (b.views || 0) - (a.views || 0);
      }
      return 0;
    });

    setSearchResults(sorted);
  };

  const performSearch = async (
    searchQuery: string,
    dataSet: Article[] = sourceArticles,
    categoryValue: string = selectedCategory,
    sortValue: 'relevance' | 'latest' | 'popular' = sortBy
  ) => {
    const cleanQuery = searchQuery.trim();

    if (!cleanQuery) {
      setSearchResults(dataSet);
      return;
    }

    performLocalSearch(cleanQuery, dataSet, categoryValue, sortValue);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void performSearch(query, sourceArticles, selectedCategory, sortBy);

    const url = new URL(window.location.href);
    url.searchParams.set('q', query);
    window.history.pushState({}, '', url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-lokswami-white">
          <span className="h-8 w-1 rounded-full bg-lokswami-red" />
          {language === 'hi' ? 'Khoj' : 'Search'}
        </h1>
      </div>

      <form onSubmit={handleSearch} className="relative" data-swipe-ignore="true">
        <div className="flex items-center overflow-hidden rounded-xl border border-lokswami-border bg-lokswami-surface transition-colors focus-within:border-lokswami-red">
          <Search className="ml-4 h-5 w-5 text-lokswami-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={language === 'hi' ? 'Khabar khoje...' : 'Search news...'}
            className="min-h-12 flex-1 bg-transparent px-4 py-3.5 text-lokswami-white placeholder:text-lokswami-text-muted focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="reader-touch-button reader-focus-ring inline-flex h-12 w-12 items-center justify-center text-lokswami-text-muted hover:text-lokswami-white"
              aria-label="Clear query"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
          <button
            type="submit"
            className="reader-touch-button reader-focus-ring min-h-12 bg-lokswami-red px-5 font-medium text-white transition-colors hover:bg-lokswami-red/90 sm:px-6"
          >
            {language === 'hi' ? 'Khoje' : 'Search'}
          </button>
        </div>
      </form>

      {query ? (
        <div className="flex flex-wrap items-center gap-3" data-swipe-ignore="true">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-lokswami-text-muted" />
            <select
              value={selectedCategory}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedCategory(next);
                void performSearch(query, sourceArticles, next, sortBy);
              }}
              className="reader-focus-ring min-h-11 rounded-lg border border-lokswami-border bg-lokswami-surface px-3 py-2 text-sm text-lokswami-white focus:border-lokswami-red"
            >
              {categoryOptions.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => {
                const next = (e.target.value as 'relevance' | 'latest' | 'popular') || 'relevance';
                setSortBy(next);
                void performSearch(query, sourceArticles, selectedCategory, next);
              }}
              className="reader-focus-ring min-h-11 rounded-lg border border-lokswami-border bg-lokswami-surface px-3 py-2 text-sm text-lokswami-white focus:border-lokswami-red"
            >
              <option value="relevance">{language === 'hi' ? 'Prasangikta' : 'Relevance'}</option>
              <option value="latest">{language === 'hi' ? 'Taaza' : 'Latest'}</option>
              <option value="popular">{language === 'hi' ? 'Lokpriya' : 'Popular'}</option>
            </select>
          </div>
        </div>
      ) : null}

      {query ? (
        <div>
          <div className="mb-4 space-y-3">
            <p className="text-lokswami-text-secondary">
              {language === 'hi'
                ? `"${query}" ke liye ${searchResults.length} parinaam`
                : `${searchResults.length} results for "${query}"`}
            </p>
          </div>

          {searchResults.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {searchResults.map((article, index) => (
                <NewsCard key={article.id} article={article} index={index} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <Search className="mx-auto mb-4 h-16 w-16 text-lokswami-text-muted" />
              <h3 className="mb-2 text-xl font-semibold text-lokswami-white">
                {language === 'hi' ? 'Koi result nahi mila' : 'No results found'}
              </h3>
              <p className="text-lokswami-text-secondary">
                {language === 'hi'
                  ? 'Kripya alag keyword ke saath dubara try karein.'
                  : 'Please try searching with different keywords.'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-lokswami-white">
              <TrendingUp className="h-5 w-5 text-lokswami-red" />
              {language === 'hi' ? 'Trending Searches' : 'Trending Searches'}
            </h2>
            <div className="flex flex-wrap gap-2">
              {TRENDING_SEARCHES[language].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setQuery(term);
                    void performSearch(term, sourceArticles, selectedCategory, sortBy);
                  }}
                  className="reader-touch-button reader-focus-ring min-h-11 rounded-full bg-lokswami-surface px-4 py-2 text-sm text-lokswami-text-secondary transition-colors hover:bg-lokswami-red hover:text-lokswami-white"
                >
                  {term}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-lokswami-white">
              <Clock className="h-5 w-5 text-lokswami-red" />
              {language === 'hi' ? 'Recent Searches' : 'Recent Searches'}
            </h2>
            <div className="space-y-2">
              {TRENDING_SEARCHES[language].slice(0, 3).map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setQuery(term);
                    void performSearch(term, sourceArticles, selectedCategory, sortBy);
                  }}
                  className="reader-touch-button reader-focus-ring flex min-h-12 w-full items-center justify-between rounded-lg bg-lokswami-surface p-3 text-left transition-colors hover:bg-lokswami-black"
                >
                  <span className="text-lokswami-text-secondary">{term}</span>
                  <Clock className="h-4 w-4 text-lokswami-text-muted" />
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
