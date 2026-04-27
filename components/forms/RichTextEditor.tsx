'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquareQuote,
  Redo2,
  Table2,
  Underline,
  Undo2,
} from 'lucide-react';
import { getAuthHeader } from '@/lib/auth/clientToken';
import {
  buildArticleImageFigureHtml,
  buildArticleQuoteHtml,
  buildArticleResourceCardHtml,
  buildArticleTableHtml,
  normalizeArticleEditorLinkUrl,
} from '@/lib/utils/articleEditorTemplates';
import { extractYouTubeVideoId } from '@/lib/utils/youtube';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  editorClassName?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your article content here...',
  editorClassName = 'min-h-64',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isUploadingInlineImage, setIsUploadingInlineImage] = useState(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Keep DOM in sync when value changes externally (e.g. loading an article for edit).
    // Avoid writing when unchanged to prevent caret jumps and duplicate insert behavior.
    const current = editor.innerHTML === '<br>' ? '' : editor.innerHTML;
    if (current !== value) {
      editor.innerHTML = value || '';
    }
  }, [value]);

  const applyFormat = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML || '');
  };

  const keepEditorSelection = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const insertHtml = (html: string) => {
    if (!html) return;
    document.execCommand('insertHTML', false, html);
    handleInput();
    editorRef.current?.focus();
  };

  const insertLink = () => {
    if (typeof window === 'undefined') return;
    const rawUrl = window.prompt('Enter link URL');
    if (!rawUrl) return;

    const normalizedUrl = normalizeArticleEditorLinkUrl(rawUrl);
    if (!normalizedUrl) return;

    const selection = window.getSelection();
    const hasSelectedText = Boolean(selection && selection.toString().trim().length);

    if (hasSelectedText) {
      document.execCommand('createLink', false, normalizedUrl);
    } else {
      const safeText = normalizedUrl.replace(/"/g, '&quot;');
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${safeText}" target="_blank" rel="noopener noreferrer">${safeText}</a>`
      );
    }

    handleInput();
    editorRef.current?.focus();
  };

  const handleInput = () => {
    const html = editorRef.current?.innerHTML || '';
    onChange(html === '<br>' ? '' : html);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';

    const compactText = text.trim();
    const isSingleToken = compactText.length > 0 && compactText.split(/\s+/).length === 1;
    const youtubeId = isSingleToken ? extractYouTubeVideoId(compactText) : null;

    if (youtubeId) {
      const shortcode = `[youtube:https://www.youtube.com/watch?v=${youtubeId}]`;
      document.execCommand('insertText', false, shortcode);
      handleInput();
      return;
    }

    // Paste plain text only, then update state from DOM once.
    document.execCommand('insertText', false, text);
    handleInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const withMeta = e.ctrlKey || e.metaKey;
    if (!withMeta) return;

    if (e.key.toLowerCase() === 'k') {
      e.preventDefault();
      insertLink();
    }
  };

  const insertYouTubeEmbed = () => {
    if (typeof window === 'undefined') return;
    const input = window.prompt('Paste YouTube URL');
    if (!input) return;

    const videoId = extractYouTubeVideoId(input);
    if (!videoId) {
      window.alert('Please enter a valid YouTube link');
      return;
    }

    const shortcode = `[youtube:https://www.youtube.com/watch?v=${videoId}]`;
    document.execCommand('insertText', false, shortcode);
    handleInput();
    editorRef.current?.focus();
  };

  const insertSocialEmbed = (platform: 'facebook' | 'x' | 'instagram' | 'link') => {
    if (typeof window === 'undefined') return;

    const label =
      platform === 'facebook'
        ? 'Facebook'
        : platform === 'x'
          ? 'X / Twitter'
          : platform === 'instagram'
            ? 'Instagram'
            : 'social media';
    const input = window.prompt(`Paste ${label} post URL`);
    if (!input?.trim()) return;

    const url = normalizeArticleEditorLinkUrl(input);
    const shortcode = `[social:${platform}:${url}]`;
    document.execCommand('insertText', false, shortcode);
    handleInput();
    editorRef.current?.focus();
  };

  const triggerInlineImageUpload = () => {
    inlineImageInputRef.current?.click();
  };

  const handleInlineImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.toLowerCase().startsWith('image/')) {
      window.alert('Please choose a JPG, PNG, or WebP image.');
      event.target.value = '';
      return;
    }

    setIsUploadingInlineImage(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('purpose', 'image');

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
        },
        body,
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
            data?: {
              url?: string;
              secureUrl?: string;
            };
          }
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to upload inline image');
      }

      const imageUrl = String(payload.data?.secureUrl || payload.data?.url || '').trim();
      if (!imageUrl) {
        throw new Error('Inline image upload returned an empty URL');
      }

      const altText = window.prompt('Alt text for this image', file.name.replace(/\.[^.]+$/, '')) || '';
      const caption = window.prompt('Caption (optional)') || '';
      const sourceName = window.prompt('Image source / credit (optional)') || '';
      const sourceUrl = sourceName
        ? window.prompt('Image source link (optional)') || ''
        : '';

      insertHtml(
        buildArticleImageFigureHtml({
          src: imageUrl,
          alt: altText,
          caption,
          sourceName,
          sourceUrl,
        })
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to upload inline image');
    } finally {
      setIsUploadingInlineImage(false);
      event.target.value = '';
    }
  };

  const insertResourceCard = () => {
    if (typeof window === 'undefined') return;
    const title = window.prompt('Resource title', 'Source / Reference') || '';
    if (!title.trim()) return;
    const url = window.prompt('Resource link (optional)') || '';
    const description = window.prompt('Short note (optional)') || '';

    insertHtml(
      buildArticleResourceCardHtml({
        title,
        url,
        description,
      })
    );
  };

  const insertTable = () => {
    if (typeof window === 'undefined') return;
    const columns = Number.parseInt(window.prompt('How many columns?', '3') || '3', 10);
    const rows = Number.parseInt(window.prompt('How many body rows?', '3') || '3', 10);
    insertHtml(
      buildArticleTableHtml({
        columns,
        rows,
      })
    );
  };

  const insertQuote = () => {
    if (typeof window === 'undefined') return;
    const quote = window.prompt('Quote text');
    if (!quote?.trim()) return;
    const attribution = window.prompt('Quote attribution (optional)') || '';

    insertHtml(
      buildArticleQuoteHtml({
        quote,
        attribution,
      })
    );
  };

  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-300 transition-colors focus-within:border-spanish-red dark:border-white/30">
      <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 p-3 dark:border-white/15 dark:bg-white/[0.04]">
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => applyFormat('bold')}
          className="rounded p-2 transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => applyFormat('italic')}
          className="rounded p-2 transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => applyFormat('underline')}
          className="rounded p-2 transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Underline (Ctrl+U)"
        >
          <Underline className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={insertLink}
          className="rounded p-2 transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Insert Link (Ctrl+K)"
        >
          <Link2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => applyFormat('unlink')}
          className="rounded p-2 text-xs font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Remove Link"
        >
          Unlink
        </button>

        <div className="mx-1 w-px bg-gray-300 dark:bg-white/20" />

        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => applyFormat('insertUnorderedList')}
          className="rounded p-2 transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => applyFormat('insertOrderedList')}
          className="rounded p-2 transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="mx-1 w-px bg-gray-300 dark:bg-white/20" />

        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => applyFormat('formatBlock', '<h2>')}
          className="rounded p-2 text-sm font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Heading"
        >
          H2
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => applyFormat('formatBlock', '<h3>')}
          className="rounded p-2 text-sm font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Subheading"
        >
          H3
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={insertQuote}
          className="rounded p-2 transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Insert Quote"
        >
          <MessageSquareQuote className="w-4 h-4" />
        </button>

        <div className="mx-1 w-px bg-gray-300 dark:bg-white/20" />

        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={triggerInlineImageUpload}
          disabled={isUploadingInlineImage}
          className="rounded p-2 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-100 dark:hover:bg-white/10"
          title="Upload Inline Image"
        >
          <ImagePlus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={insertResourceCard}
          className="rounded px-2.5 py-2 text-sm font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Insert Resource Callout"
        >
          Resource
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={insertTable}
          className="rounded p-2 transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Insert Table"
        >
          <Table2 className="w-4 h-4" />
        </button>

        <div className="mx-1 w-px bg-gray-300 dark:bg-white/20" />

        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => applyFormat('insertHorizontalRule')}
          className="rounded p-2 text-sm transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Divider"
        >
          ---
        </button>

        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => applyFormat('removeFormat')}
          className="rounded p-2 text-sm transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Clear Formatting"
        >
          Clear
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => applyFormat('undo')}
          className="rounded p-2 transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => applyFormat('redo')}
          className="rounded p-2 transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="mx-1 w-px bg-gray-300 dark:bg-white/20" />

        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={insertYouTubeEmbed}
          className="rounded px-2.5 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-gray-200 dark:text-red-400 dark:hover:bg-white/10"
          title="Insert YouTube Embed"
        >
          YouTube
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => insertSocialEmbed('facebook')}
          className="rounded px-2.5 py-2 text-sm font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Insert Facebook Post"
        >
          Facebook
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => insertSocialEmbed('x')}
          className="rounded px-2.5 py-2 text-sm font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Insert X / Twitter Post"
        >
          X
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => insertSocialEmbed('instagram')}
          className="rounded px-2.5 py-2 text-sm font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Insert Instagram Post"
        >
          Instagram
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => insertSocialEmbed('link')}
          className="rounded px-2.5 py-2 text-sm font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10"
          title="Insert Other Social Link"
        >
          Social
        </button>
      </div>

      <div className="relative">
        <input
          ref={inlineImageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/jpg"
          onChange={handleInlineImageUpload}
          className="hidden"
        />
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          suppressContentEditableWarning
          className={`${editorClassName} prose prose-sm max-w-none p-4 text-gray-900 focus:outline-none [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:marker:text-gray-700 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:marker:text-gray-700 dark:prose-invert dark:text-gray-100 dark:[&_ol]:marker:text-gray-100 dark:[&_ul]:marker:text-gray-100`}
          style={{
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        />
        {!value && !isFocused && (
          <span className="pointer-events-none absolute left-4 top-4 text-gray-400 dark:text-gray-500">{placeholder}</span>
        )}
      </div>

      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500 dark:border-white/15 dark:bg-white/[0.04] dark:text-gray-400">
        <span>{value.length} characters</span>
        <span className="mx-2">|</span>
        <span>
          Use H2/H3, Quote, Image, Resource, Table, Link, YouTube, and social tools for richer stories
        </span>
        {isUploadingInlineImage ? (
          <>
            <span className="mx-2">|</span>
            <span className="font-semibold text-spanish-red">Uploading image...</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
