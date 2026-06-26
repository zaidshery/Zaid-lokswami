'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  MessageSquareQuote,
  Redo2,
  Table2,
  Underline,
  Undo2,
  Wand2,
  X,
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

const HINDI_EDITOR_FONT_STYLE =
  '"Noto Sans Devanagari", "Noto Sans", Mangal, "Kohinoor Devanagari", system-ui, sans-serif';

function hasDevanagariText(value: string) {
  return /[\u0900-\u097F]/u.test(value);
}

function escapeEditorHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BODY_LABEL_PATTERN = /^(body|article body|story body|content|article content)\s*:?$/i;
const BULLET_LINE_PATTERN = /^[-*\u2022]\s+/;
const NUMBERED_LINE_PATTERN = /^\d+[\.)]\s+/;
const SENTENCE_END_PATTERN = /[.!?\u0964]$/u;
const HEADING_MAX_LENGTH = 110;

type PolishedTextBlock = {
  lines: string[];
  text: string;
};

function normalizeEditorLine(value: string) {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function buildBasicPolishedPlainTextHtml(value: string) {
  const blocks = value
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (!blocks.length) return '';

  return blocks
    .map((block) => {
      const lines = block
        .split('\n')
        .map(normalizeEditorLine)
        .filter(Boolean);

      if (lines.length > 1 && lines.every((line) => /^[-*•]\s+/.test(line))) {
        return `<ul>${lines
          .map((line) => `<li>${escapeEditorHtml(line.replace(/^[-*•]\s+/, ''))}</li>`)
          .join('')}</ul>`;
      }

      return `<p>${escapeEditorHtml(lines.join(' '))}</p>`;
    })
    .join('');
}

function getPolishedTextBlocks(value: string): PolishedTextBlock[] {
  const blocks = value
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block
        .split('\n')
        .map(normalizeEditorLine)
        .filter(Boolean);

      return {
        lines,
        text: lines.join(' '),
      };
    })
    .filter((block) => block.text);

  if (blocks[0]?.lines[0] && BODY_LABEL_PATTERN.test(blocks[0].lines[0])) {
    const [, ...remainingLines] = blocks[0].lines;
    if (!remainingLines.length) {
      return blocks.slice(1);
    }

    return [
      {
        lines: remainingLines,
        text: remainingLines.join(' '),
      },
      ...blocks.slice(1),
    ];
  }

  return blocks;
}

function isLikelySectionHeading(
  block: PolishedTextBlock,
  index: number,
  blocks: PolishedTextBlock[]
) {
  if (block.lines.length !== 1) return false;
  if (block.text.length < 4 || block.text.length > HEADING_MAX_LENGTH) return false;
  if (SENTENCE_END_PATTERN.test(block.text)) return false;
  if (BULLET_LINE_PATTERN.test(block.text) || NUMBERED_LINE_PATTERN.test(block.text)) {
    return false;
  }

  const nextBlock = blocks[index + 1];
  if (!nextBlock) return false;

  return nextBlock.text.length >= Math.max(80, block.text.length + 30);
}

export function buildPolishedPlainTextHtml(value: string) {
  const blocks = getPolishedTextBlocks(value);

  if (!blocks.length) return buildBasicPolishedPlainTextHtml(value);

  return blocks
    .map((block, index) => {
      if (block.lines.length > 1 && block.lines.every((line) => BULLET_LINE_PATTERN.test(line))) {
        return `<ul>${block.lines
          .map((line) => `<li>${escapeEditorHtml(line.replace(BULLET_LINE_PATTERN, ''))}</li>`)
          .join('')}</ul>`;
      }

      if (block.lines.length > 1 && block.lines.every((line) => NUMBERED_LINE_PATTERN.test(line))) {
        return `<ol>${block.lines
          .map((line) => `<li>${escapeEditorHtml(line.replace(NUMBERED_LINE_PATTERN, ''))}</li>`)
          .join('')}</ol>`;
      }

      if (isLikelySectionHeading(block, index, blocks)) {
        return `<h2>${escapeEditorHtml(block.text)}</h2>`;
      }

      return `<p>${escapeEditorHtml(block.text)}</p>`;
    })
    .join('');
}

function polishEditorHtml(html: string) {
  if (typeof document === 'undefined') return html;

  const container = document.createElement('div');
  container.innerHTML = html;

  const hasStructuredBlocks = Boolean(
    container.querySelector(
      'p,h1,h2,h3,h4,ul,ol,li,blockquote,figure,table,iframe,img,.article-resource-card'
    )
  );

  if (!hasStructuredBlocks) {
    return buildPolishedPlainTextHtml(container.textContent || html);
  }

  container.querySelectorAll('script,style').forEach((node) => node.remove());
  container.querySelectorAll('p,li,h2,h3,blockquote').forEach((node) => {
    node.textContent = normalizeEditorLine(node.textContent || '');
  });
  container.querySelectorAll('p,li,h2,h3,blockquote').forEach((node) => {
    if (!normalizeEditorLine(node.textContent || '')) node.remove();
  });

  return container.innerHTML.trim();
}

type EditorTool =
  | 'link'
  | 'youtube'
  | 'social'
  | 'resource'
  | 'table'
  | 'quote'
  | 'imageDetails'
  | 'error';

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your article content here...',
  editorClassName = 'min-h-64',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isUploadingInlineImage, setIsUploadingInlineImage] = useState(false);
  const [activeTool, setActiveTool] = useState<EditorTool | null>(null);
  const [toolFields, setToolFields] = useState<Record<string, string>>({});
  const [toolError, setToolError] = useState('');
  const isHindiDraft = hasDevanagariText(value);

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

  const saveEditorSelection = () => {
    if (typeof window === 'undefined') return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreEditorSelection = () => {
    if (typeof window === 'undefined') return;
    const selection = window.getSelection();
    if (!selection || !savedSelectionRef.current) return;
    selection.removeAllRanges();
    selection.addRange(savedSelectionRef.current);
  };

  const openTool = (tool: EditorTool, fields: Record<string, string> = {}) => {
    saveEditorSelection();
    setToolFields(fields);
    setToolError('');
    setActiveTool(tool);
  };

  const closeTool = () => {
    setActiveTool(null);
    setToolFields({});
    setToolError('');
  };

  const updateToolField = (name: string, value: string) => {
    setToolFields((current) => ({ ...current, [name]: value }));
  };

  const insertHtml = (html: string) => {
    if (!html) return;
    restoreEditorSelection();
    document.execCommand('insertHTML', false, html);
    handleInput();
    editorRef.current?.focus();
  };

  const insertLink = () => {
    openTool('link', { url: '', text: '' });
  };

  const submitLink = () => {
    const rawUrl = toolFields.url || '';
    if (!rawUrl.trim()) {
      setToolError('Enter a link URL.');
      return;
    }

    const normalizedUrl = normalizeArticleEditorLinkUrl(rawUrl);
    if (!normalizedUrl) {
      setToolError('Enter a valid link URL.');
      return;
    }

    restoreEditorSelection();
    const selection = window.getSelection();
    const hasSelectedText = Boolean(selection && selection.toString().trim().length);

    if (hasSelectedText) {
      document.execCommand('createLink', false, normalizedUrl);
    } else {
      const label = toolFields.text?.trim() || normalizedUrl;
      const safeText = label.replace(/"/g, '&quot;');
      const safeUrl = normalizedUrl.replace(/"/g, '&quot;');
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeText}</a>`
      );
    }

    handleInput();
    editorRef.current?.focus();
    closeTool();
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
    if (text.includes('\n')) {
      const polishedHtml = buildPolishedPlainTextHtml(text);
      if (polishedHtml) {
        document.execCommand('insertHTML', false, polishedHtml);
        handleInput();
        return;
      }
    }

    document.execCommand('insertText', false, text);
    handleInput();
  };

  const polishCurrentDraft = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const polishedHtml = polishEditorHtml(editor.innerHTML || value);
    if (!polishedHtml) return;

    editor.innerHTML = polishedHtml;
    onChange(polishedHtml);
    editor.focus();
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
    openTool('youtube', { url: '' });
  };

  const submitYouTubeEmbed = () => {
    const input = toolFields.url || '';
    if (!input.trim()) {
      setToolError('Paste a YouTube URL.');
      return;
    }

    const videoId = extractYouTubeVideoId(input);
    if (!videoId) {
      setToolError('Please enter a valid YouTube link.');
      return;
    }

    const shortcode = `[youtube:https://www.youtube.com/watch?v=${videoId}]`;
    restoreEditorSelection();
    document.execCommand('insertText', false, shortcode);
    handleInput();
    editorRef.current?.focus();
    closeTool();
  };

  const insertSocialEmbed = (platform: 'facebook' | 'x' | 'instagram' | 'link') => {
    const label =
      platform === 'facebook'
        ? 'Facebook'
        : platform === 'x'
          ? 'X / Twitter'
          : platform === 'instagram'
            ? 'Instagram'
            : 'social media';
    openTool('social', { platform, label, url: '' });
  };

  const submitSocialEmbed = () => {
    const input = toolFields.url || '';
    if (!input.trim()) {
      setToolError(`Paste a ${toolFields.label || 'social'} URL.`);
      return;
    }
    const platform = (toolFields.platform || 'link') as 'facebook' | 'x' | 'instagram' | 'link';
    const url = normalizeArticleEditorLinkUrl(input);
    const shortcode = `[social:${platform}:${url}]`;
    restoreEditorSelection();
    document.execCommand('insertText', false, shortcode);
    handleInput();
    editorRef.current?.focus();
    closeTool();
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
      setToolError('Please choose a JPG, PNG, or WebP image.');
      setActiveTool('error');
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

      openTool('imageDetails', {
        src: imageUrl,
        alt: file.name.replace(/\.[^.]+$/, ''),
        caption: '',
        sourceName: '',
        sourceUrl: '',
      });
    } catch (error) {
      setToolError(error instanceof Error ? error.message : 'Failed to upload inline image');
      setActiveTool('error');
    } finally {
      setIsUploadingInlineImage(false);
      event.target.value = '';
    }
  };

  const insertResourceCard = () => {
    openTool('resource', { title: 'Source / Reference', url: '', description: '' });
  };

  const submitResourceCard = () => {
    const title = toolFields.title || '';
    if (!title.trim()) {
      setToolError('Enter a resource title.');
      return;
    }

    insertHtml(
      buildArticleResourceCardHtml({
        title,
        url: toolFields.url || '',
        description: toolFields.description || '',
      })
    );
    closeTool();
  };

  const insertTable = () => {
    openTool('table', { columns: '3', rows: '3' });
  };

  const submitTable = () => {
    const columns = Number.parseInt(toolFields.columns || '3', 10);
    const rows = Number.parseInt(toolFields.rows || '3', 10);
    insertHtml(
      buildArticleTableHtml({
        columns,
        rows,
      })
    );
    closeTool();
  };

  const insertQuote = () => {
    openTool('quote', { quote: '', attribution: '' });
  };

  const submitQuote = () => {
    const quote = toolFields.quote || '';
    if (!quote.trim()) {
      setToolError('Enter quote text.');
      return;
    }

    insertHtml(
      buildArticleQuoteHtml({
        quote,
        attribution: toolFields.attribution || '',
      })
    );
    closeTool();
  };

  const submitImageDetails = () => {
    insertHtml(
      buildArticleImageFigureHtml({
        src: toolFields.src || '',
        alt: toolFields.alt || '',
        caption: toolFields.caption || '',
        sourceName: toolFields.sourceName || '',
        sourceUrl: toolFields.sourceUrl || '',
      })
    );
    closeTool();
  };

  const submitActiveTool = (event: React.FormEvent) => {
    event.preventDefault();
    if (activeTool === 'link') submitLink();
    if (activeTool === 'youtube') submitYouTubeEmbed();
    if (activeTool === 'social') submitSocialEmbed();
    if (activeTool === 'resource') submitResourceCard();
    if (activeTool === 'table') submitTable();
    if (activeTool === 'quote') submitQuote();
    if (activeTool === 'imageDetails') submitImageDetails();
  };

  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm transition-colors focus-within:border-spanish-red focus-within:shadow-[0_0_0_1px_rgba(231,33,41,0.28)] dark:border-white/20 dark:bg-zinc-950">
      <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 p-2 dark:border-white/15 dark:bg-white/[0.04] sm:p-3">
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
          className="hidden rounded p-2 text-xs font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10 sm:inline-flex"
          title="Remove Link"
        >
          Unlink
        </button>

        <div className="mx-1 hidden w-px bg-gray-300 dark:bg-white/20 sm:block" />

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
          className="hidden rounded p-2 transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10 sm:inline-flex"
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
          className="hidden rounded p-2 text-sm font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10 sm:inline-flex"
          title="Subheading"
        >
          H3
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={insertQuote}
          className="hidden rounded p-2 transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10 sm:inline-flex"
          title="Insert Quote"
        >
          <MessageSquareQuote className="w-4 h-4" />
        </button>

        <div className="mx-1 hidden w-px bg-gray-300 dark:bg-white/20 sm:block" />

        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={triggerInlineImageUpload}
          disabled={isUploadingInlineImage}
          className="rounded p-2 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-100 dark:hover:bg-white/10"
          title="Upload Inline Image"
        >
          {isUploadingInlineImage ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4" />
          )}
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={insertResourceCard}
          className="hidden rounded px-2.5 py-2 text-sm font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10 sm:inline-flex"
          title="Insert Resource Callout"
        >
          Resource
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={insertTable}
          className="hidden rounded p-2 transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10 sm:inline-flex"
          title="Insert Table"
        >
          <Table2 className="w-4 h-4" />
        </button>

        <div className="mx-1 hidden w-px bg-gray-300 dark:bg-white/20 sm:block" />

        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => applyFormat('insertHorizontalRule')}
          className="hidden rounded p-2 text-sm transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10 sm:inline-flex"
          title="Divider"
        >
          ---
        </button>

        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => applyFormat('removeFormat')}
          className="hidden rounded p-2 text-sm transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10 sm:inline-flex"
          title="Clear Formatting"
        >
          Clear
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={polishCurrentDraft}
          className="rounded p-2 text-spanish-red transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
          title="Polish pasted formatting"
        >
          <Wand2 className="w-4 h-4" />
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

        <div className="mx-1 hidden w-px bg-gray-300 dark:bg-white/20 sm:block" />

        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={insertYouTubeEmbed}
          className="hidden rounded px-2.5 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-gray-200 dark:text-red-400 dark:hover:bg-white/10 sm:inline-flex"
          title="Insert YouTube Embed"
        >
          YouTube
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => insertSocialEmbed('facebook')}
          className="hidden rounded px-2.5 py-2 text-sm font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10 sm:inline-flex"
          title="Insert Facebook Post"
        >
          Facebook
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => insertSocialEmbed('x')}
          className="hidden rounded px-2.5 py-2 text-sm font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10 sm:inline-flex"
          title="Insert X / Twitter Post"
        >
          X
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => insertSocialEmbed('instagram')}
          className="hidden rounded px-2.5 py-2 text-sm font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10 sm:inline-flex"
          title="Insert Instagram Post"
        >
          Instagram
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => insertSocialEmbed('link')}
          className="hidden rounded px-2.5 py-2 text-sm font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10 sm:inline-flex"
          title="Insert Other Social Link"
        >
          Social
        </button>
      </div>

      <details className="border-b border-gray-200 bg-gray-50 text-sm dark:border-white/15 dark:bg-white/[0.04] sm:hidden">
        <summary className="cursor-pointer px-3 py-2 font-semibold text-gray-800 dark:text-gray-100">
          More tools
        </summary>
        <div className="flex flex-wrap gap-1 px-2 pb-2">
          <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyFormat('formatBlock', '<h3>')} className="rounded px-2.5 py-2 font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10" title="Subheading">
            H3
          </button>
          <button type="button" onMouseDown={keepEditorSelection} onClick={insertQuote} className="rounded px-2.5 py-2 font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10" title="Insert Quote">
            Quote
          </button>
          <button type="button" onMouseDown={keepEditorSelection} onClick={insertResourceCard} className="rounded px-2.5 py-2 font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10" title="Insert Resource Callout">
            Resource
          </button>
          <button type="button" onMouseDown={keepEditorSelection} onClick={insertTable} className="rounded px-2.5 py-2 font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10" title="Insert Table">
            Table
          </button>
          <button type="button" onMouseDown={keepEditorSelection} onClick={insertYouTubeEmbed} className="rounded px-2.5 py-2 font-semibold text-red-700 transition-colors hover:bg-gray-200 dark:text-red-400 dark:hover:bg-white/10" title="Insert YouTube Embed">
            YouTube
          </button>
          <button type="button" onMouseDown={keepEditorSelection} onClick={() => insertSocialEmbed('facebook')} className="rounded px-2.5 py-2 font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10" title="Insert Facebook Post">
            Facebook
          </button>
          <button type="button" onMouseDown={keepEditorSelection} onClick={() => insertSocialEmbed('instagram')} className="rounded px-2.5 py-2 font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10" title="Insert Instagram Post">
            Instagram
          </button>
          <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyFormat('removeFormat')} className="rounded px-2.5 py-2 font-semibold transition-colors hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-white/10" title="Clear Formatting">
            Clear
          </button>
          <button type="button" onMouseDown={keepEditorSelection} onClick={polishCurrentDraft} className="rounded px-2.5 py-2 font-semibold text-spanish-red transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10" title="Polish pasted formatting">
            Polish
          </button>
        </div>
      </details>

      <div className="relative bg-white dark:bg-zinc-950">
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
          className={`${editorClassName} prose prose-sm max-w-none p-3 text-gray-900 focus:outline-none [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:marker:text-gray-700 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:marker:text-gray-700 dark:prose-invert dark:text-gray-100 dark:[&_ol]:marker:text-gray-100 dark:[&_ul]:marker:text-gray-100 sm:p-4`}
          style={{
            fontFamily: isHindiDraft ? HINDI_EDITOR_FONT_STYLE : undefined,
            lineHeight: isHindiDraft ? 1.85 : undefined,
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        />
        {!value && !isFocused && (
          <span className="pointer-events-none absolute left-3 top-3 text-gray-400 dark:text-gray-500 sm:left-4 sm:top-4">{placeholder}</span>
        )}
      </div>

      <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-white/15 dark:bg-white/[0.04] dark:text-gray-400 sm:px-4">
        <span>{value.length} characters</span>
        <span className="mx-2 hidden sm:inline">|</span>
        <span className="hidden sm:inline">
          Use H2/H3, Quote, Image, Resource, Table, Link, YouTube, and social tools for richer stories
        </span>
        {isUploadingInlineImage ? (
          <>
            <span className="mx-2">|</span>
            <span className="font-semibold text-spanish-red">Uploading image...</span>
          </>
        ) : null}
      </div>

      {activeTool ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <form
            onSubmit={submitActiveTool}
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-950 dark:text-white">
                  {activeTool === 'link'
                    ? 'Insert link'
                    : activeTool === 'youtube'
                      ? 'Insert YouTube'
                      : activeTool === 'social'
                        ? `Insert ${toolFields.label || 'social'} post`
                        : activeTool === 'resource'
                          ? 'Insert resource'
                          : activeTool === 'table'
                            ? 'Insert table'
                            : activeTool === 'quote'
                              ? 'Insert quote'
                              : activeTool === 'imageDetails'
                                ? 'Image details'
                                : 'Editor notice'}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Add the details, then insert the prepared block into the story.
                </p>
              </div>
              <button
                type="button"
                onClick={closeTool}
                className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close editor tool"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {toolError ? (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-100">
                {toolError}
              </p>
            ) : null}

            {activeTool !== 'error' ? (
              <div className="mt-4 space-y-3">
                {activeTool === 'link' ? (
                  <>
                    <input
                      value={toolFields.url || ''}
                      onChange={(event) => updateToolField('url', event.target.value)}
                      placeholder="https://example.com"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-spanish-red focus:outline-none dark:border-white/20 dark:bg-zinc-900 dark:text-white"
                    />
                    <input
                      value={toolFields.text || ''}
                      onChange={(event) => updateToolField('text', event.target.value)}
                      placeholder="Optional link text when no text is selected"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-spanish-red focus:outline-none dark:border-white/20 dark:bg-zinc-900 dark:text-white"
                    />
                  </>
                ) : null}

                {activeTool === 'youtube' || activeTool === 'social' ? (
                  <input
                    value={toolFields.url || ''}
                    onChange={(event) => updateToolField('url', event.target.value)}
                    placeholder={activeTool === 'youtube' ? 'Paste YouTube URL' : 'Paste post URL'}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-spanish-red focus:outline-none dark:border-white/20 dark:bg-zinc-900 dark:text-white"
                  />
                ) : null}

                {activeTool === 'resource' ? (
                  <>
                    <input
                      value={toolFields.title || ''}
                      onChange={(event) => updateToolField('title', event.target.value)}
                      placeholder="Resource title"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-spanish-red focus:outline-none dark:border-white/20 dark:bg-zinc-900 dark:text-white"
                    />
                    <input
                      value={toolFields.url || ''}
                      onChange={(event) => updateToolField('url', event.target.value)}
                      placeholder="Resource link"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-spanish-red focus:outline-none dark:border-white/20 dark:bg-zinc-900 dark:text-white"
                    />
                    <textarea
                      value={toolFields.description || ''}
                      onChange={(event) => updateToolField('description', event.target.value)}
                      placeholder="Short note"
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-spanish-red focus:outline-none dark:border-white/20 dark:bg-zinc-900 dark:text-white"
                    />
                  </>
                ) : null}

                {activeTool === 'table' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      min={2}
                      max={6}
                      value={toolFields.columns || '3'}
                      onChange={(event) => updateToolField('columns', event.target.value)}
                      aria-label="Table columns"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-spanish-red focus:outline-none dark:border-white/20 dark:bg-zinc-900 dark:text-white"
                    />
                    <input
                      type="number"
                      min={2}
                      max={8}
                      value={toolFields.rows || '3'}
                      onChange={(event) => updateToolField('rows', event.target.value)}
                      aria-label="Table rows"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-spanish-red focus:outline-none dark:border-white/20 dark:bg-zinc-900 dark:text-white"
                    />
                  </div>
                ) : null}

                {activeTool === 'quote' ? (
                  <>
                    <textarea
                      value={toolFields.quote || ''}
                      onChange={(event) => updateToolField('quote', event.target.value)}
                      placeholder="Quote text"
                      rows={4}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-spanish-red focus:outline-none dark:border-white/20 dark:bg-zinc-900 dark:text-white"
                    />
                    <input
                      value={toolFields.attribution || ''}
                      onChange={(event) => updateToolField('attribution', event.target.value)}
                      placeholder="Attribution"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-spanish-red focus:outline-none dark:border-white/20 dark:bg-zinc-900 dark:text-white"
                    />
                  </>
                ) : null}

                {activeTool === 'imageDetails' ? (
                  <>
                    <input
                      value={toolFields.alt || ''}
                      onChange={(event) => updateToolField('alt', event.target.value)}
                      placeholder="Alt text"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-spanish-red focus:outline-none dark:border-white/20 dark:bg-zinc-900 dark:text-white"
                    />
                    <textarea
                      value={toolFields.caption || ''}
                      onChange={(event) => updateToolField('caption', event.target.value)}
                      placeholder="Caption"
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-spanish-red focus:outline-none dark:border-white/20 dark:bg-zinc-900 dark:text-white"
                    />
                    <input
                      value={toolFields.sourceName || ''}
                      onChange={(event) => updateToolField('sourceName', event.target.value)}
                      placeholder="Image source / credit"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-spanish-red focus:outline-none dark:border-white/20 dark:bg-zinc-900 dark:text-white"
                    />
                    <input
                      value={toolFields.sourceUrl || ''}
                      onChange={(event) => updateToolField('sourceUrl', event.target.value)}
                      placeholder="Image source link"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-spanish-red focus:outline-none dark:border-white/20 dark:bg-zinc-900 dark:text-white"
                    />
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeTool}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/20 dark:text-gray-200 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              {activeTool !== 'error' ? (
                <button
                  type="submit"
                  className="rounded-md bg-spanish-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-guardsman-red"
                >
                  Insert
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
