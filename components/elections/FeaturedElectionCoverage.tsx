'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown, CookingPot, ExternalLink, Flower2, Hand, UserRound, Vote } from 'lucide-react';
import type { ElectionResultsData, FeaturedElectionContest } from '@/lib/elections/results';

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value);
}

function statusCopy(status: FeaturedElectionContest['status']) {
  if (status === 'final') return { badge: 'FINAL RESULT', label: 'Result declared', live: false };
  if (status === 'scheduled') return { badge: 'UPCOMING', label: 'Counting scheduled', live: false };
  return { badge: 'LIVE', label: 'Live counting', live: true };
}

const ELECTION_LABEL_HI = '\u091a\u0941\u0928\u093e\u0935';
const POSITION_HEIGHTS = [100, 74, 52];

function PartySymbolFallback({ party, color }: { party: string; color: string }) {
  const normalizedParty = party.toLowerCase();
  const Icon = normalizedParty.includes('congress')
    ? Hand
    : normalizedParty.includes('bharatiya janata') || normalizedParty.includes('bjp')
      ? Flower2
      : normalizedParty.includes('azad samaj') || normalizedParty.includes('aazad samaj')
        ? CookingPot
        : Vote;

  return <Icon className="h-3.5 w-3.5" style={{ color }} aria-hidden="true" />;
}

export default function FeaturedElectionCoverage({ initialData }: { initialData: ElectionResultsData }) {
  const [data, setData] = useState(initialData);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/elections/results', { cache: 'no-store' });
      if (response.ok) setData((await response.json()) as ElectionResultsData);
    } catch {
      // Keep the current verified snapshot visible if a refresh fails.
    }
  }, []);

  useEffect(() => {
    if (data.featuredContest.status !== 'live') return;
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [data.featuredContest.status, refresh]);

  const contest = data.featuredContest;
  const status = statusCopy(contest.status);
  const leader = useMemo(
    () => contest.candidates.find((candidate) => candidate.id === contest.leaderCandidateId),
    [contest.candidates, contest.leaderCandidateId]
  );
  const contextSections = [
    ['Why was the by-election required?', contest.whyElection],
    ['Previous result', contest.previousResult],
    ['Candidate context', contest.candidateContext],
    ['Why it matters', contest.politicalImportance],
    ['Strong-room concern', contest.controversy],
  ].filter(([, body]) => body.trim());

  if (!contest.enabled) return null;

  return (
    <section aria-label="Featured election coverage">
      <div className="w-full overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${status.live ? 'bg-red-500/20' : 'bg-emerald-500/15'}`}>
              <Activity className={`h-3.5 w-3.5 ${status.live ? 'animate-pulse text-red-500' : 'text-emerald-500'}`} />
            </span>
            <p className="truncate text-[12px] font-black uppercase tracking-[0.16em] text-zinc-900 dark:text-white">
              {contest.eyebrow}
            </p>
          </div>
          <span className={`rounded px-2 py-0.5 text-[10px] font-black tracking-widest text-white ${status.live ? 'animate-pulse bg-red-600' : 'bg-emerald-600'}`}>
            {status.live ? contest.liveLabelHi : status.badge}
          </span>
        </div>

        <div className="flex overflow-x-auto border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/70 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            contest.stateName,
            contest.constituencyName,
            contest.electionType,
            `Round ${contest.roundsCompleted} of ${contest.totalRounds}`,
          ].map((item, index) => (
            <span
              key={item}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-[10px] font-bold ${index === 1 ? 'border-red-500 bg-red-500/10 text-zinc-950 dark:text-white' : 'border-transparent text-zinc-500'}`}
            >
              {item}
            </span>
          ))}
        </div>

        <div className="grid lg:grid-cols-2">
          <div className="relative min-h-[340px] overflow-hidden border-b border-zinc-800 bg-black lg:min-h-[390px] lg:border-b-0 lg:border-r">
            {contest.backgroundImageUrl ? (
              <Image
                src={contest.backgroundImageUrl}
                alt={`${contest.constituencyName} election coverage`}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                unoptimized
                className="object-contain"
              />
            ) : (
              <>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(30,64,175,0.65),transparent_30%),linear-gradient(135deg,#030712,#111827_55%,#450a0a)]" />
              <span className="pointer-events-none absolute -right-2 top-10 select-none text-8xl font-black text-white/[0.05] sm:text-9xl">
                {ELECTION_LABEL_HI}
              </span>
              </>
            )}
          </div>

          <div className="flex min-w-0 flex-col bg-white dark:bg-zinc-950">
            <div className="grid grid-cols-2 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 sm:grid-cols-4">
              {[
                ['Rounds', `${contest.roundsCompleted}/${contest.totalRounds}`],
                ['Margin', formatNumber(contest.leadMargin)],
                ['Turnout', `${contest.turnoutPercent.toFixed(2)}%`],
                ['Candidates', formatNumber(contest.candidateCount)],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-r border-zinc-200 px-3 py-2.5 last:border-r-0 dark:border-zinc-800 sm:border-b-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
                  <p className="mt-0.5 text-sm font-black tabular-nums text-zinc-950 dark:text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/60 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/30">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-500">Live position tracker</p>
                <p className="mt-0.5 text-[9px] text-zinc-500">Vertical bars show current ranking, not vote share.</p>
              </div>
              <span className="rounded-full bg-red-600 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-white">Round {contest.roundsCompleted}</span>
            </div>

            <div className="flex min-h-[275px] flex-1 overflow-hidden p-2.5 sm:p-3">
              <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
                {contest.candidates.slice(0, 3).map((candidate, index) => {
                  const isLeader = candidate.id === contest.leaderCandidateId;
                  const earlierNonLeaders = contest.candidates
                    .slice(0, index)
                    .filter((entry) => entry.id !== contest.leaderCandidateId).length;
                  const rank = isLeader ? 1 : earlierNonLeaders + 2;
                  const positionHeight = POSITION_HEIGHTS[rank - 1] ?? 40;
                  return (
                    <article key={candidate.id} className={`flex min-w-0 flex-col overflow-hidden rounded-xl border text-center shadow-sm ${isLeader ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40'}`}>
                      <div className="flex min-h-9 items-center justify-center border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
                        <span className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[7px] font-black uppercase tracking-wide ${isLeader ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'}`}>
                          {candidate.statusLabel}
                        </span>
                      </div>

                      <div className="px-2 pt-2 sm:px-3">
                        <div className="relative flex h-[112px] items-end justify-center overflow-hidden rounded-lg border border-zinc-200 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_27px,rgba(113,113,122,0.18)_28px)] dark:border-zinc-800 dark:bg-zinc-950/70">
                          <div
                            className="relative w-10 rounded-t-lg shadow-[0_0_20px_rgba(0,0,0,0.18)] transition-[height] duration-700 sm:w-14"
                            style={{ height: `${positionHeight}%`, background: `linear-gradient(180deg,${candidate.color},${candidate.color}b8)` }}
                            aria-label={`${candidate.name}: ${candidate.statusLabel}`}
                          >
                            <span className="absolute left-1/2 top-2 -translate-x-1/2 text-sm font-black text-white">{rank}</span>
                            {candidate.votes !== null ? <span className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/25 px-1.5 py-0.5 text-[8px] font-black text-white">{formatNumber(candidate.votes)}</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex justify-center">
                        <div className="relative h-12 w-12 overflow-visible">
                          <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 bg-zinc-100 shadow-md dark:bg-zinc-900" style={{ borderColor: candidate.color }}>
                          {candidate.photoUrl ? (
                            <Image src={candidate.photoUrl} alt={candidate.name} fill sizes="48px" unoptimized className="object-cover object-top" />
                          ) : (
                            <span className="flex h-full items-center justify-center text-zinc-500">
                              <UserRound className="h-5 w-5" aria-hidden="true" />
                            </span>
                          )}
                        </div>
                        {candidate.symbolUrl ? (
                          <span className="absolute -bottom-0.5 -right-1 h-5 w-5 overflow-hidden rounded-full border border-white bg-white shadow dark:border-zinc-900">
                            <Image src={candidate.symbolUrl} alt={`${candidate.party} symbol`} fill sizes="20px" unoptimized className="object-contain p-0.5" />
                          </span>
                        ) : (
                          <span className="absolute -bottom-0.5 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-white shadow dark:border-zinc-900 dark:bg-zinc-100" title={`${candidate.party} visual fallback`}>
                            <PartySymbolFallback party={candidate.party} color={candidate.color} />
                          </span>
                        )}
                        </div>
                      </div>

                      <div className="flex min-h-[58px] flex-1 flex-col justify-center px-2 pb-2 pt-1.5 sm:px-3">
                        <p className="line-clamp-2 text-[11px] font-black leading-4 text-zinc-950 dark:text-white">{candidate.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-[8px] leading-3 text-zinc-500">{candidate.party}</p>
                      </div>
                      <div className="h-1 w-full" style={{ backgroundColor: candidate.color }} />
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/30">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] text-zinc-500">
                <span>Leader: <strong className="text-zinc-900 dark:text-white">{leader?.name || 'Awaiting update'}</strong> · {status.label}</span>
                <span>Verified {contest.lastVerifiedLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <details className="group border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-[11px] font-black text-zinc-900 [&::-webkit-details-marker]:hidden dark:text-zinc-100">
            Full election context and verification
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-5 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800 md:grid-cols-2 xl:grid-cols-3">
            {contextSections.map(([title, body]) => (
              <div key={title}>
                <h2 className="text-xs font-black text-zinc-950 dark:text-white">{title}</h2>
                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{body}</p>
              </div>
            ))}
            <div>
              <h2 className="text-xs font-black text-amber-700 dark:text-amber-400">Bottom line</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{contest.bottomLine}</p>
            </div>
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-1.5 text-[9px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p>{contest.verificationNote}</p>
          {contest.sourceUrl ? (
            <a href={contest.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-bold text-red-600 hover:underline">
              Source: {contest.sourceLabel}<ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
