'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import {
  CheckCircle2,
  Eye,
  LayoutPanelTop,
  Maximize2,
  Minimize2,
  PenSquare,
} from 'lucide-react';
import RichTextEditor from '@/components/forms/RichTextEditor';
import { analyzeArticleEditorContent } from '@/lib/utils/articleEditorAnalysis';
import { renderArticleRichContent } from '@/lib/utils/articleRichContent';
import {
  analyzeArticleSeo,
  buildArticlePublicPath,
  normalizeArticleSeo,
  type ArticleSeoFields,
} from '@/lib/seo/articleSeo';

export type ArticleEditorStudioMode = 'write' | 'split' | 'preview';

type ArticleEditorStudioProps = {
  title: string;
  summary: string;
  content: string;
  mode: ArticleEditorStudioMode;
  focusMode?: boolean;
  showSidebar?: boolean;
  previewVariant?: 'compact' | 'article';
  author?: string;
  image?: string;
  editorClassName?: string;
  onModeChange: (mode: ArticleEditorStudioMode) => void;
  onFocusModeChange?: (focusMode: boolean) => void;
  onContentChange: (content: string) => void;
  placeholder?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function PreviewPanel({
  title,
  summary,
  html,
  variant = 'compact',
  author,
  image,
}: {
  title: string;
  summary: string;
  html: string;
  variant?: 'compact' | 'article';
  author?: string;
  image?: string;
}) {
  const trimmedTitle = title.trim();
  const trimmedSummary = summary.trim();
  const trimmedAuthor = author?.trim();
  const trimmedImage = image?.trim();

  if (variant === 'article') {
    return (
      <article className="min-h-[420px] rounded-lg border border-gray-300 bg-white dark:border-white/30 dark:bg-[#111317]">
        {trimmedImage ? (
          <div className="overflow-hidden rounded-t-lg border-b border-gray-200 bg-gray-100 dark:border-white/15 dark:bg-white/[0.04]">
            <Image
              src={trimmedImage}
              alt={trimmedTitle || 'Article image preview'}
              width={960}
              height={540}
              sizes="(min-width: 1280px) 42vw, 90vw"
              className="h-56 w-full object-cover"
            />
          </div>
        ) : null}
        <div className="mx-auto max-w-3xl px-6 py-6">
          <header>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-spanish-red">
              Article Preview
            </p>
            <h3 className="mt-3 text-3xl font-bold leading-tight text-gray-950 dark:text-white">
              {trimmedTitle || 'Untitled article'}
            </h3>
            <p className="mt-3 text-lg leading-7 text-gray-600 dark:text-gray-200">
              {trimmedSummary || 'Summary preview will appear here.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-gray-200 py-3 text-sm text-gray-500 dark:border-white/15 dark:text-gray-300">
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                {trimmedAuthor || 'News Desk'}
              </span>
              <span>Draft article</span>
            </div>
          </header>
          <div
            className="article-rich-content mt-6 text-[16px] leading-8 text-gray-800 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:marker:text-gray-700 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:marker:text-gray-700 dark:text-gray-100 dark:[&_ol]:marker:text-gray-100 dark:[&_ul]:marker:text-gray-100"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </article>
    );
  }

  return (
    <div className="min-h-[180px] rounded-lg border border-gray-300 bg-white p-3 sm:min-h-[260px] sm:p-4">
      <h3 className="text-lg font-bold text-gray-900">{trimmedTitle || 'Untitled article'}</h3>
      <p className="mt-1 text-sm text-gray-600">
        {trimmedSummary || 'Summary preview will appear here.'}
      </p>
      <div className="my-4 h-px bg-gray-200" />
      <div
        className="article-rich-content text-gray-800 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:marker:text-gray-700 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:marker:text-gray-700 dark:text-gray-100 dark:[&_ol]:marker:text-gray-100 dark:[&_ul]:marker:text-gray-100"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function InsightCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function ChecklistItem({
  label,
  done,
}: {
  label: string;
  done: boolean;
}) {
  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
        done
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      )}
    >
      <CheckCircle2 className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}

type ArticleEditorSidebarProps = {
  title: string;
  summary: string;
  content: string;
  slug?: string;
  image?: string;
  seo?: Partial<ArticleSeoFields>;
  category?: string;
  relatedArticles?: Array<{
    id: string;
    slug?: string;
    title: string;
    category?: string;
  }>;
  className?: string;
};

export function ArticleEditorSidebar({
  title,
  summary,
  content,
  slug = '',
  image = '',
  seo,
  category = '',
  relatedArticles = [],
  className,
}: ArticleEditorSidebarProps) {
  const insights = analyzeArticleEditorContent(content);
  const normalizedSeo = normalizeArticleSeo(seo);
  const seoAnalysis = analyzeArticleSeo({
    title,
    summary,
    content,
    slug,
    seo: normalizedSeo,
    hasFeaturedImage: Boolean(image),
    hasSourceOrExternalLink: insights.linkCount > 0 || insights.resourceCount > 0,
  });
  const lowerCategory = category.trim().toLowerCase();
  const focusKeyword = normalizedSeo.focusKeyword.trim().toLowerCase();
  const suggestions = relatedArticles
    .filter((article) => {
      const sameCategory =
        lowerCategory && article.category?.trim().toLowerCase() === lowerCategory;
      const keywordMatch =
        focusKeyword && article.title.toLowerCase().includes(focusKeyword);
      return sameCategory || keywordMatch;
    })
    .slice(0, 4);

  return (
    <aside className={cx('space-y-4', className)}>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900">Editorial Snapshot</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <InsightCard label="Words" value={insights.wordCount} />
          <InsightCard label="Characters" value={insights.characterCount} />
          <InsightCard label="Paragraphs" value={insights.paragraphCount} />
          <InsightCard label="Headings" value={insights.headingCount} />
          <InsightCard label="Images" value={insights.imageCount} />
          <InsightCard label="Links" value={insights.linkCount} />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">SEO Score</h3>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-900">
            {seoAnalysis.score}%
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {seoAnalysis.items.map((item) => (
            <ChecklistItem key={item.label} label={item.label} done={item.done} />
          ))}
        </div>
        {seoAnalysis.missingInlineImageAltCount > 0 ? (
          <p className="mt-3 text-xs font-medium text-amber-700">
            {seoAnalysis.missingInlineImageAltCount} inline image needs alt text.
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900">Internal Links</h3>
        {suggestions.length ? (
          <div className="mt-3 space-y-2">
            {suggestions.map((article) => {
              const href = buildArticlePublicPath({ id: article.id, slug: article.slug });
              return (
                <div key={`${article.id}-${article.slug || ''}`} className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="line-clamp-2 text-sm font-semibold text-gray-800">{article.title}</p>
                  <p className="mt-1 break-all text-xs text-gray-500">{href}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">
            Related article suggestions appear after category or keyword matches are available.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900">Heading Outline</h3>
        {insights.outline.length ? (
          <div className="mt-3 space-y-2">
            {insights.outline.map((item) => (
              <div
                key={item.id}
                className={cx(
                  'rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700',
                  item.level === 3 && 'ml-4'
                )}
              >
                {item.text}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">
            Add H2/H3 headings to build a cleaner story structure for editors and readers.
          </p>
        )}
      </div>
    </aside>
  );
}

export default function ArticleEditorStudio({
  title,
  summary,
  content,
  mode,
  focusMode = false,
  showSidebar = true,
  previewVariant = 'compact',
  author,
  image,
  editorClassName,
  onModeChange,
  onFocusModeChange,
  onContentChange,
  placeholder,
}: ArticleEditorStudioProps) {
  useEffect(() => {
    if (!focusMode || !onFocusModeChange) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onFocusModeChange(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode, onFocusModeChange]);

  const previewSource = content.trim() || summary.trim();
  const previewContentHtml = previewSource
    ? renderArticleRichContent(previewSource)
    : '<p>Start writing your article to see a live preview.</p>';

  return (
    <div
      className={cx(
        'grid gap-4',
        focusMode || !showSidebar
          ? 'grid-cols-1'
          : 'xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]'
      )}
    >
      <div>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-gray-300 bg-white sm:inline-flex">
            <button
              type="button"
              onClick={() => onModeChange('write')}
              className={cx(
                'inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors sm:px-4',
                mode === 'write'
                  ? 'bg-spanish-red text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              <PenSquare className="h-4 w-4" />
              Write
            </button>
            <button
              type="button"
              onClick={() => onModeChange('split')}
              className={cx(
                'hidden items-center gap-2 border-x border-gray-300 px-4 py-2 text-sm font-medium transition-colors sm:inline-flex',
                mode === 'split'
                  ? 'bg-spanish-red text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              <LayoutPanelTop className="h-4 w-4" />
              Split
            </button>
            <button
              type="button"
              onClick={() => onModeChange('preview')}
              className={cx(
                'inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors sm:px-4',
                mode === 'preview'
                  ? 'bg-spanish-red text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
          </div>

          {onFocusModeChange ? (
            <button
              type="button"
              onClick={() => onFocusModeChange(!focusMode)}
              aria-pressed={focusMode}
              className={cx(
                'inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors sm:w-auto sm:px-4',
                focusMode
                  ? 'border-spanish-red bg-red-50 text-spanish-red hover:bg-red-100'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="sm:hidden">{focusMode ? 'Exit' : 'Focus'}</span>
              <span className="hidden sm:inline">{focusMode ? 'Exit Focus' : 'Focus Writing'}</span>
            </button>
          ) : null}
        </div>

        {focusMode ? (
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Focus mode is on. Desk checklist and side insights are hidden so you can write with fewer distractions.
            <span className="ml-1 font-medium">Press Esc to exit.</span>
          </div>
        ) : null}

        {mode === 'write' ? (
          <RichTextEditor
            value={content}
            onChange={onContentChange}
            placeholder={placeholder}
            editorClassName={editorClassName}
          />
        ) : null}

        {mode === 'preview' ? (
          <PreviewPanel
            title={title}
            summary={summary}
            html={previewContentHtml}
            variant={previewVariant}
            author={author}
            image={image}
          />
        ) : null}

        {mode === 'split' ? (
          <div
            className={cx(
              'grid gap-4',
              focusMode
                ? 'xl:grid-cols-2'
                : previewVariant === 'article'
                  ? '2xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]'
                  : '2xl:grid-cols-2'
            )}
          >
            <RichTextEditor
              value={content}
              onChange={onContentChange}
              placeholder={placeholder}
              editorClassName={editorClassName}
            />
            <div className="hidden xl:block">
              <PreviewPanel
                title={title}
                summary={summary}
                html={previewContentHtml}
                variant={previewVariant}
                author={author}
                image={image}
              />
            </div>
          </div>
        ) : null}
      </div>

      {!focusMode && showSidebar ? (
        <ArticleEditorSidebar
          title={title}
          summary={summary}
          content={content}
          className="xl:sticky xl:top-24 xl:self-start"
        />
      ) : null}
    </div>
  );
}
