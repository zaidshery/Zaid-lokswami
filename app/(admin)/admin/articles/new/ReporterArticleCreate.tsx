'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, Send, X } from 'lucide-react';
import { getAuthHeader } from '@/lib/auth/clientToken';

type UploadedImage = { url: string; name: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character] || character);
}

function buildArticleBody(body: string, images: UploadedImage[]) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`);
  const gallery = images.map(
    (image) => `<figure><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.name)}" /></figure>`
  );
  return [...paragraphs, ...gallery].join('\n');
}

export default function ReporterArticleCreate({ reporterName }: { reporterName: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const uploadImages = async (files: File[]) => {
    if (!files.length) return;
    setError('');
    setUploading(true);
    try {
      const uploaded: UploadedImage[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'image');
        const response = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: getAuthHeader(),
          body: formData,
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || `Could not upload ${file.name}`);
        }
        uploaded.push({
          url: String(result.data?.url || result.data?.secureUrl || ''),
          name: file.name,
        });
      }
      setImages((current) => [...current, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError('');
    setSuccess('');
    if (!title.trim()) return setError('Add a short title.');
    if (!body.trim()) return setError('Add the article body.');
    if (uploading) return setError('Wait for the images to finish uploading.');

    setSubmitting(true);
    try {
      const content = buildArticleBody(body, images);
      const response = await fetch('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          intent: 'submit',
          title: title.trim(),
          summary: body.trim().replace(/\s+/g, ' ').slice(0, 240),
          content,
          image: images[0]?.url || '',
          author: reporterName,
          sourceType: 'manual',
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not send article.');
      setSuccess('Article sent to the copy editor.');
      setTitle('');
      setBody('');
      setImages([]);
      window.setTimeout(() => router.push('/admin/work'), 900);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not send article.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-gray-950">Article Create</h1>
        <p className="mt-1 text-sm text-gray-600">Add the report. A copy editor will finish and publish it.</p>

        {error ? <div className="mt-4 flex gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div> : null}
        {success ? <div className="mt-4 flex gap-2 rounded-2xl bg-green-50 p-3 text-sm text-green-700"><CheckCircle2 className="h-5 w-5 shrink-0" />{success}</div> : null}

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-900">Short title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="What happened?" className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-primary-600" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-900">Body</span>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={9} placeholder="Write the full report here..." className="w-full resize-y rounded-2xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-primary-600" />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Images</span>
              <span className="text-xs text-gray-500">No image count limit</span>
            </div>
            <input id="reporter-article-images" type="file" accept="image/*" multiple className="hidden" onChange={(event) => { void uploadImages(Array.from(event.target.files || [])); event.target.value = ''; }} />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              <label htmlFor="reporter-article-images" className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-xs font-semibold text-gray-600">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                {uploading ? 'Uploading' : 'Add images'}
              </label>
              {images.map((image, index) => (
                <div key={`${image.url}-${index}`} className="relative aspect-square overflow-hidden rounded-2xl border border-gray-200">
                  <Image src={image.url} alt={image.name} fill unoptimized className="object-cover" />
                  <button type="button" aria-label={`Remove ${image.name}`} onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => void submit()} disabled={submitting || uploading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-spanish-red px-4 py-3.5 font-semibold text-white disabled:opacity-60">
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {submitting ? 'Sending...' : 'Send to Copy Editor'}
          </button>
        </div>
      </div>
    </div>
  );
}
