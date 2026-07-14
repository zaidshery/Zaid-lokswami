'use client';

import {
  ARTICLE_AI_DISCLOSURES,
  ARTICLE_EVIDENCE_TYPES,
  ARTICLE_FACT_CHECK_STATUSES,
  ARTICLE_REVIEW_STATUSES,
  ARTICLE_STORY_TYPES,
  type ArticleEditorialMeta,
} from '@/lib/content/articleEditorial';

type Props = {
  value: ArticleEditorialMeta;
  onChange: <Key extends keyof ArticleEditorialMeta>(
    key: Key,
    value: ArticleEditorialMeta[Key]
  ) => void;
};

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-spanish-red focus:outline-none';

export default function ArticleEditorialChecklist({ value, onChange }: Props) {
  return (
    <details open className="rounded-xl border border-gray-200 bg-gray-50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">
        Editorial evidence & review
      </summary>
      <div className="space-y-4 border-t border-gray-200 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Story type</span>
            <select
              name="storyType"
              value={value.storyType}
              onChange={(event) =>
                onChange('storyType', event.target.value as ArticleEditorialMeta['storyType'])
              }
              className={inputClass}
            >
              {ARTICLE_STORY_TYPES.map((type) => (
                <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Evidence type</span>
            <select
              name="evidenceType"
              value={value.evidenceType}
              onChange={(event) =>
                onChange('evidenceType', event.target.value as ArticleEditorialMeta['evidenceType'])
              }
              className={inputClass}
            >
              {ARTICLE_EVIDENCE_TYPES.map((type) => (
                <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Source attribution</span>
          <textarea
            name="sourceAttribution"
            value={value.sourceAttribution}
            onChange={(event) => onChange('sourceAttribution', event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Name the source, record, document, agency, or confidential verification path."
            className={inputClass}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quote attribution</span>
          <textarea
            name="quoteAttribution"
            value={value.quoteAttribution}
            onChange={(event) => onChange('quoteAttribution', event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Who said it, where it was recorded, and how the quote was verified."
            className={inputClass}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Event date & time</span>
          <input
            type="datetime-local"
            name="eventDateTime"
            value={value.eventDateTime}
            onChange={(event) => onChange('eventDateTime', event.target.value)}
            className={inputClass}
          />
        </label>

        <div className="grid gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fact check</span>
            <select
              name="factCheckStatus"
              value={value.factCheckStatus}
              onChange={(event) =>
                onChange(
                  'factCheckStatus',
                  event.target.value as ArticleEditorialMeta['factCheckStatus']
                )
              }
              className={inputClass}
            >
              {ARTICLE_FACT_CHECK_STATUSES.map((status) => (
                <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          {(['legalReviewStatus', 'sensitivityReviewStatus'] as const).map((field) => (
            <label key={field} className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {field === 'legalReviewStatus' ? 'Legal review' : 'Sensitivity review'}
              </span>
              <select
                name={field}
                value={value[field]}
                onChange={(event) =>
                  onChange(field, event.target.value as ArticleEditorialMeta[typeof field])
                }
                className={inputClass}
              >
                {ARTICLE_REVIEW_STATUSES.map((status) => (
                  <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <input
              type="checkbox"
              name="headlineSupportConfirmed"
              checked={value.headlineSupportConfirmed}
              onChange={(event) => onChange('headlineSupportConfirmed', event.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-spanish-red focus:ring-spanish-red"
            />
            <span className="text-sm text-gray-700">Headline claims are supported by the reporting</span>
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <input
              type="checkbox"
              name="duplicateCheckComplete"
              checked={value.duplicateCheckComplete}
              onChange={(event) => onChange('duplicateCheckComplete', event.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-spanish-red focus:ring-spanish-red"
            />
            <span className="text-sm text-gray-700">No duplicate or substantially similar story found</span>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">AI disclosure</span>
          <select
            name="aiDisclosure"
            value={value.aiDisclosure}
            onChange={(event) =>
              onChange('aiDisclosure', event.target.value as ArticleEditorialMeta['aiDisclosure'])
            }
            className={inputClass}
          >
            {ARTICLE_AI_DISCLOSURES.map((entry) => (
              <option key={entry} value={entry}>{entry.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Correction / update note</span>
          <textarea
            name="correctionNote"
            value={value.correctionNote}
            onChange={(event) => onChange('correctionNote', event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Describe a correction, clarification, or material post-publication update."
            className={inputClass}
          />
        </label>
      </div>
    </details>
  );
}
