'use client';

import { useMemo, useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { getAuthHeader } from '@/lib/auth/clientToken';

type TranslationField = 'title' | 'summary' | 'content';
type TranslationLanguage = 'hi' | 'en';

type ArticleTranslationReviewProps = {
  title: string;
  summary: string;
  content: string;
  reporterNotes: string;
  sourcePackage: string;
  onApply: (field: TranslationField, value: string) => void;
};

export default function ArticleTranslationReview({
  title,
  summary,
  content,
  reporterNotes,
  sourcePackage,
  onApply,
}: ArticleTranslationReviewProps) {
  const [field, setField] = useState<TranslationField>('summary');
  const [targetLanguage, setTargetLanguage] = useState<TranslationLanguage>('hi');
  const [sourceSnapshot, setSourceSnapshot] = useState('');
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const sourceText = useMemo(
    () => ({ title, summary, content })[field],
    [content, field, summary, title]
  );

  const runTranslation = async () => {
    if (!sourceText.trim()) {
      setError(`Add ${field} text before translating.`);
      return;
    }
    setIsLoading(true);
    setError('');
    setTranslation('');
    try {
      const response = await fetch('/api/admin/articles/assist/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          field,
          targetLanguage,
          sourceText,
          articleBody: content,
          reporterNotes,
          sourcePackage,
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        success?: boolean;
        error?: string;
        data?: { sourceText?: string; translation?: string };
      };
      if (!response.ok || !payload.success || !payload.data?.translation) {
        throw new Error(payload.error || 'Translation failed');
      }
      setSourceSnapshot(payload.data.sourceText || sourceText);
      setTranslation(payload.data.translation);
    } catch (translationError) {
      setError(translationError instanceof Error ? translationError.message : 'Translation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const applyTranslation = () => {
    if (!translation.trim()) return;
    onApply(field, translation);
    setSourceSnapshot('');
    setTranslation('');
  };

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-400/20 dark:bg-violet-500/10" aria-labelledby="article-translation-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="article-translation-heading" className="flex items-center gap-2 text-sm font-semibold text-gray-950 dark:text-white">
            <Languages className="h-4 w-4 text-violet-700" />
            Hindi / English translation
          </h3>
          <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-300">
            Uses only the article body, reporter notes, and attached source package. Review the diff before applying it.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          Field
          <select value={field} onChange={(event) => { setField(event.target.value as TranslationField); setTranslation(''); }} className="mt-1 min-h-9 w-full rounded-md border bg-white px-2 py-1.5 text-sm dark:bg-zinc-950">
            <option value="title">Headline</option>
            <option value="summary">Summary</option>
            <option value="content">Article body</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          Translate to
          <select value={targetLanguage} onChange={(event) => { setTargetLanguage(event.target.value as TranslationLanguage); setTranslation(''); }} className="mt-1 min-h-9 w-full rounded-md border bg-white px-2 py-1.5 text-sm dark:bg-zinc-950">
            <option value="hi">Hindi</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>

      <button type="button" onClick={() => void runTranslation()} disabled={isLoading || !sourceText.trim()} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
        Generate review draft
      </button>

      {error ? <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

      {translation ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-md border border-red-100 bg-red-50/80 p-3 dark:border-red-400/20 dark:bg-red-500/10">
            <p className="text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-200">Before</p>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-xs text-gray-700 dark:text-gray-200">{sourceSnapshot}</pre>
          </div>
          <label className="block rounded-md border border-emerald-100 bg-emerald-50/80 p-3 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
            After — editable review draft
            <textarea value={translation} onChange={(event) => setTranslation(event.target.value)} rows={field === 'content' ? 10 : 4} aria-label="Translation review draft" className="mt-2 w-full rounded-md border border-emerald-200 bg-white p-2 font-sans text-sm font-normal normal-case text-gray-900 dark:border-emerald-400/20 dark:bg-zinc-950 dark:text-white" />
          </label>
          <p className="text-xs text-gray-600 dark:text-gray-300">Verify every name, number, quote, and attribution. Nothing changes until you approve.</p>
          <div className="flex gap-2">
            <button type="button" onClick={applyTranslation} className="min-h-9 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">Apply translation</button>
            <button type="button" onClick={() => { setSourceSnapshot(''); setTranslation(''); }} className="min-h-9 rounded-md border bg-white px-3 py-2 text-xs font-semibold text-gray-700 dark:bg-zinc-950 dark:text-gray-200">Discard</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
