'use client';

import { useEffect } from 'react';
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

export type ArticleEditorStudioMode = 'write' | 'split' | 'preview';

type ArticleEditorStudioProps = {
  title: string;
  summary: string;
  content: string;
  mode: ArticleEditorStudioMode;
  focusMode?: boolean;
  showSidebar?: boolean;
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
}: {
  title: string;
  summary: string;
  html: string;
}) {
  return (
    <div className="min-h-[260px] rounded-lg border border-gray-300 bg-white p-4">
      <h3 className="text-lg font-bold text-gray-900">{title.trim() || 'Untitled article'}</h3>
      <p className="mt-1 text-sm text-gray-600">
        {summary.trim() || 'Summary preview will appear here.'}
      </p>
      <div className="my-4 h-px bg-gray-200" />
      <div
        className="article-rich-content text-gray-800"
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
  className?: string;
};

export function ArticleEditorSidebar({
  title,
  summary,
  content,
  className,
}: ArticleEditorSidebarProps) {
  const insights = analyzeArticleEditorContent(content);
  const checklist = [
    {
      label: 'Title added',
      done: title.trim().length >= 8,
    },
    {
      label: 'Summary ready',
      done: summary.trim().length >= 30,
    },
    {
      label: 'Structure with headings',
      done: insights.headingCount >= 2,
    },
    {
      label: 'Reference or links added',
      done: insights.linkCount > 0 || insights.resourceCount > 0,
    },
    {
      label: 'Visual/data support added',
      done: insights.imageCount > 0 || insights.tableCount > 0,
    },
  ];

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
        <h3 className="text-sm font-semibold text-gray-900">Desk Checklist</h3>
        <div className="mt-3 space-y-2">
          {checklist.map((item) => (
            <ChecklistItem key={item.label} label={item.label} done={item.done} />
          ))}
        </div>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-300 bg-white">
            <button
              type="button"
              onClick={() => onModeChange('write')}
              className={cx(
                'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
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
                'inline-flex items-center gap-2 border-x border-gray-300 px-4 py-2 text-sm font-medium transition-colors',
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
                'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
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
                'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                focusMode
                  ? 'border-spanish-red bg-red-50 text-spanish-red hover:bg-red-100'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {focusMode ? 'Exit Focus' : 'Focus Writing'}
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
          />
        ) : null}

        {mode === 'preview' ? (
          <PreviewPanel title={title} summary={summary} html={previewContentHtml} />
        ) : null}

        {mode === 'split' ? (
          <div className={cx('grid gap-4', focusMode ? 'xl:grid-cols-2' : '2xl:grid-cols-2')}>
            <RichTextEditor
              value={content}
              onChange={onContentChange}
              placeholder={placeholder}
            />
            <PreviewPanel title={title} summary={summary} html={previewContentHtml} />
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
