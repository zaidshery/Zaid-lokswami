'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Search,
  SendHorizonal,
  Sparkles,
  X,
} from 'lucide-react';
import { TTS_LANGUAGE_OPTIONS } from '@/lib/constants/tts';
import {
  fetchTtsStatus,
} from '@/lib/ai/ttsClient';
import { useAppStore } from '@/lib/store/appStore';

type ChatRole = 'assistant' | 'user';

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  links?: Array<{ id: string; title: string }>;
};

type AwarenessResult = {
  id: string;
  title: string;
  summary: string;
  snippet?: string;
};

type AwarenessResponse = {
  success?: boolean;
  data?: {
    answer?: string;
    results?: AwarenessResult[];
  };
  error?: string;
};

type SummaryResponse = {
  success?: boolean;
  data?: {
    bullets?: string[];
  };
  error?: string;
};

function createMessage(role: ChatRole, text: string, links?: ChatMessage['links']): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    role,
    text,
    links,
  };
}

function isAwarenessResult(value: unknown): value is AwarenessResult {
  if (!value || typeof value !== 'object') return false;
  const source = value as Partial<AwarenessResult>;
  return (
    typeof source.id === 'string' &&
    typeof source.title === 'string' &&
    typeof source.summary === 'string'
  );
}

function AiIdentityMark({
  compact = false,
  status = 'online',
}: {
  compact?: boolean;
  status?: 'online' | 'busy';
}) {
  const isBusy = status === 'busy';

  if (compact) {
    return (
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 via-red-600 to-orange-500 shadow-[0_10px_24px_rgba(220,38,38,0.34)]">
        <Sparkles className="h-[18px] w-[18px] text-white" />
        <span
          className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 ${
            isBusy ? 'bg-amber-300' : 'bg-emerald-300'
          }`}
        />
      </span>
    );
  }

  return (
    <span className="relative block">
      <span className="absolute inset-0 rounded-[1.4rem] bg-red-500/25 blur-md transition-transform duration-300 group-hover:scale-110" />
      <span className="relative flex items-center gap-2 rounded-[1.2rem] border border-white/10 bg-zinc-950/92 px-3 py-2 text-white shadow-[0_18px_40px_rgba(15,23,42,0.38)] backdrop-blur">
        <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 via-red-600 to-orange-500 shadow-[0_10px_24px_rgba(220,38,38,0.34)]">
          <Sparkles className="h-[18px] w-[18px] text-white" />
          <span
            className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 ${
              isBusy ? 'bg-amber-300' : 'bg-emerald-300'
            }`}
          />
        </span>
        <span className="flex flex-col items-start leading-none">
          <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/55">
            Lokswami
          </span>
          <span className="text-sm font-black tracking-[0.08em]">AI</span>
        </span>
      </span>
    </span>
  );
}

export default function LokswamiAIBot() {
  const { language } = useAppStore();
  const pathname = usePathname();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [isTtsConfigured, setIsTtsConfigured] = useState(false);

  const currentArticleId = useMemo(() => {
    const match = pathname.match(/\/main\/article\/([^/?#]+)/i);
    if (!match?.[1]) return '';
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }, [pathname]);

  const searchRouteHref = draft.trim()
    ? `/main/search?q=${encodeURIComponent(draft.trim())}`
    : '/main/search';

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!messages.length) {
      const greeting =
        language === 'hi'
          ? 'Namaste, main Lokswami AI hoon. Aap search aur TL;DR summary use kar sakte hain.'
          : 'Hello, I am Lokswami AI. You can use semantic search and TL;DR summary here.';
      setMessages([createMessage('assistant', greeting)]);
    }
  }, [isOpen, language, messages.length]);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, messages, isWorking]);

  useEffect(() => {
    let active = true;
    const loadTtsStatus = async () => {
      try {
        const payload = await fetchTtsStatus();
        if (!active) return;
        setIsTtsConfigured(Boolean(payload.configured));
      } catch {
        if (!active) return;
        setIsTtsConfigured(false);
      }
    };
    void loadTtsStatus();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const runAwarenessSearch = async (query: string) => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setErrorText('');
    setIsWorking(true);
    appendMessage(createMessage('user', cleanQuery));

    try {
      const response = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cleanQuery, limit: 6 }),
      });
      const payload = (await response.json().catch(() => ({}))) as AwarenessResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'AI search failed.');
      }

      const answer = typeof payload.data.answer === 'string' && payload.data.answer.trim()
          ? payload.data.answer.trim()
          : language === 'hi'
            ? 'Search result mil gaya. Neeche relevant stories dekh sakte hain.'
            : 'Search completed. You can check relevant stories below.';

      const links = Array.isArray(payload.data.results)
        ? payload.data.results
            .filter((item) => isAwarenessResult(item))
            .slice(0, 3)
            .map((item) => ({ id: item.id, title: item.title }))
        : [];

      appendMessage(createMessage('assistant', answer, links.length ? links : undefined));
    } catch (error) {
      const fallback = error instanceof Error ? error.message : 
        language === 'hi' ? 'AI search is samay uplabdh nahi hai.' : 'AI search is currently unavailable.';
      setErrorText(fallback);
      appendMessage(createMessage('assistant', fallback));
    } finally {
      setIsWorking(false);
    }
  };

  const runSummary = async (mode: 'article' | 'text') => {
    const trimmedText = draft.trim();
    const useArticle = mode === 'article' && Boolean(currentArticleId);
    const useText = mode === 'text' && Boolean(trimmedText);

    if (!useArticle && !useText) {
      const noSourceText = language === 'hi' ? 'Summary ke liye article open karein ya text likhein.' : 'Open an article or enter text for summary.';
      setErrorText(noSourceText);
      appendMessage(createMessage('assistant', noSourceText));
      return;
    }

    setErrorText('');
    setIsWorking(true);

    if (useText) {
      appendMessage(createMessage('user', trimmedText));
      setDraft('');
    } else {
      appendMessage(createMessage('user', language === 'hi' ? 'Is article ka TL;DR do.' : 'Summarize this article.'));
    }

    try {
      const body: { articleId?: string; text?: string; language: 'hi' | 'en' } = { language };
      if (useArticle) body.articleId = currentArticleId;
      else body.text = trimmedText;

      const response = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as SummaryResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Summary generation failed.');
      }

      const bullets = Array.isArray(payload.data.bullets)
        ? payload.data.bullets.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];

      if (!bullets.length) throw new Error('Summary returned no points.');

      const summaryText = bullets.slice(0, 3).map((item) => `- ${item}`).join('\n');
      appendMessage(createMessage('assistant', summaryText));
    } catch (error) {
      const fallback = error instanceof Error ? error.message :
        language === 'hi' ? 'Summary banaane mein dikkat aayi.' : 'Unable to generate summary.';
      setErrorText(fallback);
      appendMessage(createMessage('assistant', fallback));
    } finally {
      setIsWorking(false);
    }
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanQuery = draft.trim();
    if (!cleanQuery || isWorking) return;
    setDraft('');
    void runAwarenessSearch(cleanQuery);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (isOpen ? handleClose() : setIsOpen(true))}
        className="group fixed bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+0.75rem)] right-3 z-[96] transition hover:scale-[1.03] xl:bottom-6 xl:right-6"
        aria-label="Open Lokswami AI chat"
      >
        <AiIdentityMark status={isWorking ? 'busy' : 'online'} />
      </button>

      {isOpen ? (
        <section className="fixed bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+4.5rem)] right-2 z-[96] flex h-[min(76vh,40rem)] w-[min(97vw,25rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 xl:bottom-20 xl:right-6">
          <header className="flex items-center justify-between border-b border-zinc-200 bg-gradient-to-r from-zinc-950 to-zinc-900 px-3.5 py-3 text-white dark:border-zinc-800">
            <div className="flex min-w-0 items-center gap-2">
              <AiIdentityMark compact status={isWorking ? 'busy' : 'online'} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">Lokswami AI Chat</p>
                <p className="truncate text-[11px] text-white/70">
                  {isWorking ? 'Thinking...' : 'Online'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Close AI bot"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-900/70">
            <button
              type="button"
              onClick={() => {
                if (!draft.trim() || isWorking) return;
                const cleanQuery = draft.trim();
                setDraft('');
                void runAwarenessSearch(cleanQuery);
              }}
              disabled={isWorking || !draft.trim()}
              className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/35"
            >
              <Search className="h-3 w-3" />
              Search
            </button>
            {currentArticleId ? (
              <button
                type="button"
                onClick={() => void runSummary('article')}
                disabled={isWorking}
                className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-60 dark:border-orange-900/60 dark:bg-orange-900/20 dark:text-orange-300 dark:hover:bg-orange-900/35"
              >
                <Sparkles className="h-3 w-3" />
                Summary
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void runSummary('text')}
              disabled={isWorking || !draft.trim()}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              TL;DR Text
            </button>
            <Link
              href={searchRouteHref}
              className="ml-auto text-[11px] font-semibold text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
            >
              Full Search
            </Link>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-zinc-50/50 px-3 py-3 dark:bg-zinc-950/70">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'rounded-br-md bg-red-600 text-white'
                      : 'rounded-bl-md border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'
                  }`}
                >
                  <p className="whitespace-pre-line">{message.text}</p>
                  {message.links?.length ? (
                    <ul className="mt-2 space-y-1">
                      {message.links.map((linkItem) => (
                        <li key={linkItem.id}>
                          <Link
                            href={`/main/article/${encodeURIComponent(linkItem.id)}`}
                            className="line-clamp-2 text-xs font-semibold text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
                          >
                            {linkItem.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ))}

            {isWorking ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {language === 'hi' ? 'AI soch raha hai...' : 'AI is thinking...'}
                </div>
              </div>
            ) : null}

            {errorText ? (
              <p className="text-xs text-red-600 dark:text-red-400">{errorText}</p>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-950">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  language === 'hi'
                    ? 'Sawal poochhiye ya text paste kijiye...'
                    : 'Ask a question or paste text...'
                }
                className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-red-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <button
                type="submit"
                disabled={isWorking || !draft.trim()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white transition hover:bg-red-700 disabled:opacity-60"
                aria-label="Send message"
              >
                <SendHorizonal className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>
      ) : null}
    </>
  );
}
