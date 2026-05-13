'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { BarChart3, Users, Briefcase, ChevronRight, Activity, MousePointerClick } from 'lucide-react';
import Link from 'next/link';

interface ValueScore {
  source: string;
  score: number;
}

interface TopPage {
  url: string;
  score: number;
  articleId: string | null;
  title: string;
  status: string;
}

export default function BusinessValueDashboard() {
  const { data: session } = useSession();
  const [days, setDays] = useState(30);
  const [valueScores, setValueScores] = useState<ValueScore[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [scoresRes, pagesRes] = await Promise.all([
          fetch(`/api/admin/analytics/value-scoring?days=${days}`),
          fetch(`/api/admin/analytics/top-lead-pages?days=${days}`)
        ]);

        const scoresData = await scoresRes.json();
        const pagesData = await pagesRes.json();

        if (scoresData.success) setValueScores(scoresData.data);
        if (pagesData.success) setTopPages(pagesData.data);
      } catch (error) {
        console.error('Failed to fetch business value metrics', error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user) {
        fetchData();
    }
  }, [days, session]);

  if (!session?.user) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--admin-shell-text)] sm:text-3xl">
            Business Value Intelligence
          </h1>
          <p className="mt-1 text-sm text-[color:var(--admin-shell-text-muted)]">
            Analyze which content drives the most actionable leads (Contact & Advertising inquiries).
          </p>
        </div>
        
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="admin-shell-input w-full rounded-xl px-3 py-2 text-sm sm:w-auto"
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
        </select>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] shadow-[var(--admin-shell-shadow)]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--admin-shell-border-strong)] border-t-[color:var(--admin-shell-active)]" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Sources Card */}
          <div className="rounded-3xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] p-6 shadow-[var(--admin-shell-shadow)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[color:var(--admin-shell-text)]">
                  Top Converting Sections
                </h2>
                <p className="text-xs text-[color:var(--admin-shell-text-muted)]">
                  Sections generating the most leads
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>

            <div className="space-y-4">
              {valueScores.length === 0 ? (
                <p className="text-sm text-[color:var(--admin-shell-text-muted)]">No leads recorded in this period.</p>
              ) : (
                valueScores.slice(0, 8).map((item, i) => (
                  <div key={item.source} className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--admin-shell-surface-strong)] text-xs font-semibold text-[color:var(--admin-shell-text-muted)]">
                        {i + 1}
                      </div>
                      <p className="truncate text-sm font-medium text-[color:var(--admin-shell-text)]">
                        {item.source === 'unknown' ? 'Direct / Unknown' : item.source}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold text-[color:var(--admin-shell-text)]">
                      <span>{item.score}</span>
                      <span className="text-[10px] uppercase text-[color:var(--admin-shell-text-muted)]">Leads</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Articles Card */}
          <div className="rounded-3xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface)] p-6 shadow-[var(--admin-shell-shadow)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[color:var(--admin-shell-text)]">
                  Most Valuable Articles
                </h2>
                <p className="text-xs text-[color:var(--admin-shell-text-muted)]">
                  Specific articles driving contact form submissions
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400">
                <MousePointerClick className="h-5 w-5" />
              </div>
            </div>

            <div className="space-y-4">
              {topPages.length === 0 ? (
                 <p className="text-sm text-[color:var(--admin-shell-text-muted)]">No article leads recorded in this period.</p>
              ) : (
                topPages.map((page, i) => (
                  <div key={page.url} className="group relative flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--admin-shell-border)] bg-[color:var(--admin-shell-surface-muted)] p-3 transition-colors hover:border-[color:var(--admin-shell-border-strong)]">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-[color:var(--admin-shell-text)]">
                        {page.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--admin-shell-text-muted)]">
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${page.status === 'published' ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300'}`}>
                          {page.status}
                        </span>
                        <span className="truncate">{page.url}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                            <span className="text-lg font-black text-[color:var(--admin-shell-active)]">{page.score}</span>
                            <span className="text-[10px] uppercase text-[color:var(--admin-shell-text-muted)]">Leads</span>
                        </div>
                        {page.articleId && (
                            <Link 
                                href={`/admin/articles/${page.articleId}/edit`}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--admin-shell-surface)] text-[color:var(--admin-shell-text-muted)] shadow-sm transition-colors hover:bg-[color:var(--admin-shell-active)] hover:text-white"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Link>
                        )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
