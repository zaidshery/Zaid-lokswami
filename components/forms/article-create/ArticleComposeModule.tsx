'use client';

import { useState, type ChangeEvent } from 'react';
import ArticleEditorStudio, { type ArticleEditorStudioMode } from '@/components/forms/ArticleEditorStudio';
import { CmsEditorMain } from '@/components/admin/CmsEditorLayout';
import { getAuthHeader } from '@/lib/auth/clientToken';

type ComposeValue = {
  title: string;
  summary: string;
  content: string;
  category: string;
  author: string;
  featuredImageAlt: string;
  featuredImageCaption: string;
  imageCredit: string;
  locationTag: string;
  reporterNotes: string;
  sourceInfo: string;
  sourceConfidential: boolean;
};

type StaffOption = { id: string; name: string; role: string; profileUrl?: string };

type ArticleComposeModuleProps = {
  value: ComposeValue;
  image: string;
  mode: ArticleEditorStudioMode;
  focusMode: boolean;
  categories: string[];
  canCreateCategories: boolean;
  authorOptions: StaffOption[];
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onContentChange: (content: string) => void;
  onModeChange: (mode: ArticleEditorStudioMode) => void;
  onFocusModeChange: (focusMode: boolean) => void;
  onCategoryCreated: (name: string) => void;
};

const fieldClass = 'w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors focus:border-spanish-red focus:outline-none';

export default function ArticleComposeModule(props: ArticleComposeModuleProps) {
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySlug, setNewCategorySlug] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [createCategoryError, setCreateCategoryError] = useState('');

  const createCategory = async () => {
    setCreateCategoryError('');
    if (!newCategoryName.trim()) return setCreateCategoryError('Please provide a category name');
    setIsCreatingCategory(true);
    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ name: newCategoryName.trim(), slug: newCategorySlug.trim() || undefined }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; data?: { name?: string } };
      if (!response.ok || !payload.data?.name) throw new Error(payload.error || 'Failed to create category');
      props.onCategoryCreated(payload.data.name);
      setNewCategoryName('');
      setNewCategorySlug('');
      setShowCreateCategory(false);
    } catch (error) {
      setCreateCategoryError(error instanceof Error ? error.message : 'Failed to create category');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  return (
    <CmsEditorMain>
      <div data-article-field="title">
        <label className="mb-2 block text-sm font-medium text-gray-900">Article Title <span className="text-red-500">*</span></label>
        <input type="text" name="title" value={props.value.title} onChange={props.onChange} placeholder="Enter an engaging title" className={fieldClass} required />
      </div>
      <div data-article-field="summary">
        <label className="mb-2 block text-sm font-medium text-gray-900">Summary <span className="text-red-500">*</span></label>
        <textarea name="summary" value={props.value.summary} onChange={props.onChange} placeholder="Brief summary of the article (will appear in article feed)" rows={2} className={fieldClass} required />
      </div>
      <div data-article-field="content">
        <label className="mb-2 block text-sm font-medium text-gray-900">Article Content <span className="text-red-500">*</span></label>
        <details className="mb-3 rounded-lg border border-amber-100 bg-amber-50 text-xs text-amber-900">
          <summary className="cursor-pointer px-3 py-2 font-semibold">Writing tools and embed tips</summary>
          <div className="grid gap-3 border-t border-amber-100 p-3 sm:grid-cols-2 xl:grid-cols-4">
            <div><p className="font-semibold">Headings</p><p className="mt-1">Use H2 and H3 buttons to break long copy into clean sections.</p></div>
            <div><p className="font-semibold">Inline Images</p><p className="mt-1">Upload article images with caption and source credit.</p></div>
            <div><p className="font-semibold">Resources & Tables</p><p className="mt-1">Add source cards, comparison tables, quotes, and links.</p></div>
            <div><p className="font-semibold">Video</p><p className="mt-1">Paste a YouTube link on its own line or use the toolbar button.</p></div>
          </div>
        </details>
        <ArticleEditorStudio
          title={props.value.title}
          summary={props.value.summary}
          content={props.value.content}
          mode={props.mode}
          focusMode={props.focusMode}
          showSidebar={false}
          previewVariant="article"
          author={props.value.author}
          image={props.image}
          imageAlt={props.value.featuredImageAlt}
          imageCaption={props.value.featuredImageCaption}
          imageCredit={props.value.imageCredit}
          category={props.value.category}
          onModeChange={props.onModeChange}
          onFocusModeChange={props.onFocusModeChange}
          onContentChange={props.onContentChange}
          editorClassName="min-h-[60vh]"
          placeholder="Write your article here. Use the toolbar above for formatting."
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div data-article-field="category">
          <label className="mb-2 block text-sm font-medium text-gray-900">Category <span className="text-red-500">*</span></label>
          <select name="category" value={props.value.category} onChange={props.onChange} className={fieldClass}>
            {props.categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          {props.canCreateCategories ? (
            <div className="mt-3">
              <button type="button" onClick={() => setShowCreateCategory((current) => !current)} className="text-sm font-medium text-spanish-red hover:underline">{showCreateCategory ? 'Cancel' : '+ Create new category'}</button>
              {showCreateCategory ? (
                <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  {createCategoryError ? <div className="text-sm text-red-600">{createCategoryError}</div> : null}
                  <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Category name" className="w-full rounded-md border border-gray-300 px-3 py-2" />
                  <input value={newCategorySlug} onChange={(event) => setNewCategorySlug(event.target.value)} placeholder="Optional slug (auto-generated if blank)" className="w-full rounded-md border border-gray-300 px-3 py-2" />
                  <div className="flex gap-2">
                    <button type="button" disabled={isCreatingCategory} onClick={() => void createCategory()} className="rounded-md bg-spanish-red px-4 py-2 text-white disabled:opacity-50">{isCreatingCategory ? 'Creating...' : 'Create'}</button>
                    <button type="button" onClick={() => { setShowCreateCategory(false); setNewCategoryName(''); setNewCategorySlug(''); setCreateCategoryError(''); }} className="rounded-md border border-gray-300 px-4 py-2">Cancel</button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div data-article-field="author">
          <label className="mb-2 block text-sm font-medium text-gray-900">Staff author <span className="text-red-500">*</span></label>
          <select name="author" value={props.value.author} onChange={props.onChange} className={`${fieldClass} bg-white`} required>
            <option value="">Choose a newsroom staff profile</option>
            {props.value.author && !props.authorOptions.some((member) => member.name === props.value.author) ? <option value={props.value.author}>{props.value.author} (source byline)</option> : null}
            {props.authorOptions.map((member) => <option key={member.id} value={member.name}>{member.name} ({member.role.replace(/_/g, ' ')})</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500">Byline identity comes from an active newsroom staff account.</p>
        </div>
      </div>
      <details className="rounded-lg border border-gray-200 bg-gray-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">Reporter submission details</summary>
        <div className="space-y-4 border-t border-gray-200 p-4">
          <div><p className="text-sm font-semibold text-gray-900">Reporter Submission</p><p className="mt-1 text-xs text-gray-500">Add location context, source notes, and reporter handoff details for the desk.</p></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm font-medium text-gray-900">Location Tag<input type="text" name="locationTag" value={props.value.locationTag} onChange={props.onChange} placeholder="Indore, Madhya Pradesh" className={`${fieldClass} mt-2`} /></label>
            <label className="block text-sm font-medium text-gray-900">Reporter Notes<textarea name="reporterNotes" value={props.value.reporterNotes} onChange={props.onChange} placeholder="Extra context for copy edit, verification, or publishing." rows={3} className={`${fieldClass} mt-2`} /></label>
          </div>
          <label className="block text-sm font-medium text-gray-900">Source Info<textarea name="sourceInfo" value={props.value.sourceInfo} onChange={props.onChange} placeholder="Who provided the information, documents, or quotes?" rows={3} className={`${fieldClass} mt-2`} /></label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
            <input type="checkbox" name="sourceConfidential" checked={props.value.sourceConfidential} onChange={props.onChange} className="h-4 w-4 rounded border-gray-300 text-spanish-red focus:ring-spanish-red" />
            <span className="text-sm text-gray-700">Source is confidential and should stay internal to the desk</span>
          </label>
        </div>
      </details>
    </CmsEditorMain>
  );
}
