'use client';

import { Bot, FileAudio, Search, ShieldCheck } from 'lucide-react';
import TtsOperationsPanel from './TtsOperationsPanel';

const STATUS_ITEMS = [
  {
    title: 'Paid AI APIs disabled',
    detail: 'OpenAI and Gemini API actions are not used by this project runtime.',
    icon: ShieldCheck,
  },
  {
    title: 'Manual audio stays active',
    detail: 'Article and e-paper listening continue through manually uploaded audio assets.',
    icon: FileAudio,
  },
  {
    title: 'Local search and summaries',
    detail: 'Reader search and TL;DR use built-in retrieval and extractive summaries.',
    icon: Search,
  },
];

export default function AdminAiTrainingPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <Bot className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">Lokswami AI Controls</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
              Paid external AI APIs are turned off. Use ChatGPT Plus manually in the browser for
              editorial drafting, then paste approved content into the CMS.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {STATUS_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-red-500 shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-3 text-sm font-bold text-gray-900">{item.title}</h2>
                <p className="mt-1 text-sm leading-6 text-gray-500">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </div>

      <TtsOperationsPanel />
    </div>
  );
}
