'use client';
/* eslint-disable @next/next/no-img-element */

import { FileAudio, Image as ImageIcon, Loader2, Search, Upload, Volume2, X } from 'lucide-react';
import ArticleFeaturedImageReaderPreview from '@/components/forms/ArticleFeaturedImageReaderPreview';
import { ARTICLE_IMAGE_UPLOAD_GUIDE } from '@/lib/utils/articleImageUpload';
import { ARTICLE_IMAGE_LICENSES, type ArticleEditorialMeta } from '@/lib/content/articleEditorial';
import type { ArticleMediaMetadata } from '@/lib/content/articleMediaMetadata';

type MediaLibraryItem = { _id: string; filename: string; url: string; size?: number; type?: string };

type ArticleMediaModuleProps = {
  active: boolean;
  busy: boolean;
  audioAccept: string;
  audioFile: File | null;
  audioSizeLabel: string;
  audioPreviewUrl: string;
  audioStored: boolean;
  audioValidationError: string;
  onAudioChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearAudio: () => void;
  image: string;
  imageQualityNote: string;
  media: ArticleMediaMetadata;
  editorial: ArticleEditorialMeta;
  title: string;
  summary: string;
  category: string;
  featuredImageAlt: string;
  featuredImageCaption: string;
  imageCredit: string;
  mediaSearch: string;
  mediaLibraryLoading: boolean;
  mediaLibraryError: string;
  mediaLibrary: MediaLibraryItem[];
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onMediaSearchChange: (value: string) => void;
  onSelectMedia: (item: MediaLibraryItem) => void;
  onMediaChange: <Key extends keyof Omit<ArticleMediaMetadata, 'variants'>>(key: Key, value: ArticleMediaMetadata[Key]) => void;
  onEditorialChange: <Key extends keyof ArticleEditorialMeta>(key: Key, value: ArticleEditorialMeta[Key]) => void;
  onTextChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
};

const fieldClass = 'w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-spanish-red focus:outline-none';

export default function ArticleMediaModule(props: ArticleMediaModuleProps) {
  const activeClass = props.active ? 'space-y-4' : 'hidden';
  return (
    <div id="article-inspector-media" role="tabpanel" className={activeClass}>
      <section id="article-inspector-media-audio" aria-label="Article listen audio">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white p-2 text-spanish-red shadow-sm"><Volume2 className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-gray-900">Article Listen Audio</p><span className="rounded-full border border-spanish-red/30 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-spanish-red">Optional</span></div>
              <p className="mt-1 text-xs leading-5 text-gray-600">Upload MP3, WAV, or M4A audio. It attaches to the server draft as soon as the draft has an ID.</p>
            </div>
          </div>
          {props.audioFile ? (
            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-start gap-3">
                <FileAudio className="mt-0.5 h-4 w-4 shrink-0 text-spanish-red" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{props.audioFile.name}</p><p className="mt-1 text-xs text-gray-500">{props.audioSizeLabel}{props.audioValidationError ? ' | Needs replacement' : ' | Ready to attach after article creation'}</p></div>
                <button type="button" onClick={props.onClearAudio} className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50" aria-label="Remove article listen audio"><X className="h-3.5 w-3.5" /></button>
              </div>
              {props.audioPreviewUrl ? <audio controls preload="metadata" src={props.audioPreviewUrl} className="mt-3 w-full" /> : null}
            </div>
          ) : null}
          {props.audioStored ? <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Listen audio is attached to this server draft.</p> : null}
          {props.audioValidationError ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{props.audioValidationError}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <label className={`inline-flex items-center gap-2 rounded-md border border-spanish-red bg-white px-3 py-2 text-xs font-semibold text-spanish-red hover:bg-red-50 ${props.busy ? 'pointer-events-none cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
              <Upload className="h-4 w-4" />{props.audioFile || props.audioStored ? 'Replace Audio' : 'Upload Audio'}
              <input type="file" accept={props.audioAccept} disabled={props.busy} onChange={props.onAudioChange} className="sr-only" />
            </label>
            {props.audioFile ? <button type="button" onClick={props.onClearAudio} disabled={props.busy} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"><X className="h-4 w-4" />Remove</button> : null}
          </div>
        </div>
      </section>

      <section id="article-inspector-media-image" aria-label="Featured image">
        <div data-article-field="image" className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
          <label className="mb-3 block text-sm font-medium text-gray-900">Featured Image <span className="text-red-500">*</span></label>
          <label className="flex w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 hover:border-spanish-red hover:bg-gray-50">
            <div className="flex flex-col items-center gap-2"><ImageIcon className="h-6 w-6 text-gray-400" /><span className="text-sm font-medium text-gray-700">Click to upload image</span><span className="text-xs text-gray-500">PNG, JPG, WebP</span></div>
            <input type="file" accept="image/*" onChange={props.onImageChange} className="hidden" required={!props.image} />
          </label>
          <p className="mt-2 hidden text-xs text-gray-500 sm:block">{ARTICLE_IMAGE_UPLOAD_GUIDE}</p>
          <details className="mt-3 rounded-lg border border-gray-200 bg-gray-50">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-800">Choose from media library</summary>
            <div className="space-y-3 border-t border-gray-200 p-3">
              <label className="relative block"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input type="search" value={props.mediaSearch} onChange={(event) => props.onMediaSearchChange(event.target.value)} placeholder="Search image filenames" className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-spanish-red focus:outline-none" /></label>
              {props.mediaLibraryLoading ? <p className="flex items-center gap-2 text-xs text-gray-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading library…</p> : null}
              {props.mediaLibraryError ? <p className="text-xs text-amber-700">{props.mediaLibraryError}</p> : null}
              {!props.mediaLibraryLoading && !props.mediaLibraryError && props.mediaLibrary.length === 0 ? <p className="text-xs text-gray-500">No matching image assets.</p> : null}
              {props.mediaLibrary.length ? <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">{props.mediaLibrary.map((item) => <button key={item._id} type="button" onClick={() => props.onSelectMedia(item)} className={`overflow-hidden rounded-lg border bg-white text-left hover:border-spanish-red ${props.media.sourceMediaId === item._id ? 'border-spanish-red ring-2 ring-red-100' : 'border-gray-200'}`} aria-label={`Use media ${item.filename}`}><img src={item.url} alt="" className="aspect-video w-full object-cover" loading="lazy" /><span className="block truncate px-2 py-1.5 text-[11px] font-medium text-gray-700">{item.filename}</span></button>)}</div> : null}
            </div>
          </details>
          {props.imageQualityNote ? <p className="mt-2 text-xs font-medium text-amber-700">{props.imageQualityNote}</p> : null}
          <ArticleFeaturedImageReaderPreview
            image={props.image}
            title={props.title}
            summary={props.summary}
            caption={props.featuredImageCaption}
            credit={props.imageCredit}
            alt={props.featuredImageAlt}
            category={props.category}
            focalPointX={props.media.focalPointX}
            focalPointY={props.media.focalPointY}
          />
          {props.image ? <button type="button" onClick={props.onRemoveImage} className="mt-2 w-full rounded-md bg-red-50 py-2 text-sm font-medium text-red-600 hover:bg-red-100">Remove Image</button> : null}
          {props.image ? (
            <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <label className="block space-y-1"><span className="text-xs font-medium text-gray-600">Focal point X: {props.media.focalPointX}%</span><input type="range" min="0" max="100" value={props.media.focalPointX} onChange={(event) => props.onMediaChange('focalPointX', Number(event.target.value))} className="w-full accent-red-600" /></label>
                <label className="block space-y-1"><span className="text-xs font-medium text-gray-600">Focal point Y: {props.media.focalPointY}%</span><input type="range" min="0" max="100" value={props.media.focalPointY} onChange={(event) => props.onMediaChange('focalPointY', Number(event.target.value))} className="w-full accent-red-600" /></label>
              </div>
              <p className="text-xs text-gray-500">The focal point is preserved for desktop, mobile, Google, and social crops.</p>
            </div>
          ) : null}
          <div className="mt-4 space-y-3">
            <input type="text" name="featuredImageAlt" value={props.featuredImageAlt} onChange={props.onTextChange} placeholder="Featured image alt text" maxLength={220} className={fieldClass} />
            <textarea name="featuredImageCaption" value={props.featuredImageCaption} onChange={props.onTextChange} placeholder="Featured image caption" rows={2} maxLength={300} className={fieldClass} />
            <input type="text" name="imageCredit" value={props.imageCredit} onChange={props.onTextChange} placeholder="Image credit/source" maxLength={180} className={fieldClass} />
            <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Image license</span><select value={props.editorial.imageLicense} onChange={(event) => props.onEditorialChange('imageLicense', event.target.value as ArticleEditorialMeta['imageLicense'])} className={`${fieldClass} bg-white`}>{ARTICLE_IMAGE_LICENSES.map((license) => <option key={license} value={license}>{license.replace(/_/g, ' ')}</option>)}</select></label>
          </div>
        </div>
      </section>
    </div>
  );
}
