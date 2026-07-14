'use client';

import type { ChangeEvent } from 'react';

type SeoValues = {
  seoSlug: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  secondaryKeywords: string;
  ogImage: string;
  canonicalUrl: string;
  includeInNewsSitemap: boolean;
};

type ArticleSeoModuleProps = {
  active: boolean;
  value: SeoValues;
  previewPath: string;
  googlePreview: { title: string; url: string; description: string };
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
};

const inputClass = 'w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-spanish-red focus:outline-none';

export default function ArticleSeoModule({ active, value, previewPath, googlePreview, onChange }: ArticleSeoModuleProps) {
  return (
    <div id="article-inspector-seo" role="tabpanel" className={active ? 'space-y-4' : 'hidden'}>
      <details open data-article-field="seo" className="rounded-xl border border-gray-200 bg-gray-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">SEO Settings</summary>
        <div className="space-y-4 border-t border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-900">
            SEO Slug
            <input type="text" name="seoSlug" value={value.seoSlug} onChange={onChange} placeholder="article-public-url-slug" maxLength={200} className={`${inputClass} mt-2`} />
            <span className="mt-1 block break-all text-xs font-normal text-gray-500">{previewPath}</span>
          </label>
          <label className="block text-sm font-medium text-gray-900">
            Meta Title
            <input type="text" name="seoTitle" value={value.seoTitle} onChange={onChange} placeholder="Optional SEO title (recommended under 60 chars)" maxLength={160} className={`${inputClass} mt-2`} />
            <span className="mt-1 block text-xs font-normal text-gray-500">{value.seoTitle.length}/160</span>
          </label>
          <label className="block text-sm font-medium text-gray-900">
            Meta Description
            <textarea name="seoDescription" value={value.seoDescription} onChange={onChange} placeholder="Optional SEO description" rows={3} maxLength={320} className={`${inputClass} mt-2`} />
            <span className="mt-1 block text-xs font-normal text-gray-500">{value.seoDescription.length}/320</span>
          </label>
          <label className="block text-sm font-medium text-gray-900">
            Focus Keyword
            <input type="text" name="focusKeyword" value={value.focusKeyword} onChange={onChange} placeholder="Primary topic for internal SEO checks" maxLength={120} className={`${inputClass} mt-2`} />
          </label>
          <label className="block text-sm font-medium text-gray-900">
            Secondary Keywords
            <input type="text" name="secondaryKeywords" value={value.secondaryKeywords} onChange={onChange} placeholder="Comma separated supporting topics" maxLength={240} className={`${inputClass} mt-2`} />
          </label>
          <label className="block text-sm font-medium text-gray-900">
            OG Image URL
            <input type="text" name="ogImage" value={value.ogImage} onChange={onChange} placeholder="https://example.com/image.jpg or /uploads/image.jpg" className={`${inputClass} mt-2`} />
            <span className="mt-1 block text-xs font-normal text-gray-500">Leave empty to auto-use featured image as 1200x630 OG preview.</span>
          </label>
          <label className="block text-sm font-medium text-gray-900">
            Canonical URL
            <input type="url" name="canonicalUrl" value={value.canonicalUrl} onChange={onChange} placeholder="https://example.com/main/article/slug" className={`${inputClass} mt-2`} />
            <span className="mt-1 block text-xs font-normal text-gray-500">Leave empty to use the default public article permalink after publish. Override it only for migrated or syndicated stories.</span>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
            <input type="checkbox" name="includeInNewsSitemap" checked={value.includeInNewsSitemap} onChange={onChange} className="h-4 w-4 rounded border-gray-300 text-spanish-red focus:ring-spanish-red" />
            <span className="text-sm text-gray-700">Include in Google News sitemap after publish</span>
          </label>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Google Preview</p>
            <p className="mt-2 line-clamp-2 text-sm font-semibold text-blue-700">{googlePreview.title}</p>
            <p className="mt-1 break-all text-xs text-green-700">{googlePreview.url}</p>
            <p className="mt-1 line-clamp-3 text-xs text-gray-600">{googlePreview.description || 'Meta description or summary will appear here.'}</p>
          </div>
        </div>
      </details>
    </div>
  );
}
