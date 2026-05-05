'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Activity, Archive } from 'lucide-react';
import {
  ELECTION_STATES,
  type ElectionResultsData,
} from '@/lib/elections/results';

const SESSION_TS = Math.floor(Date.now() / 300_000);

const ELECTION_SLIDES = ELECTION_STATES.map((state) => ({
  id: state.id,
  src: `/elections/${state.id}.jpg`,
  label: state.name,
}));

type ElectionImageWidgetProps = {
  surface?: 'home' | 'archive';
};

export default function ElectionImageWidget({ surface = 'home' }: ElectionImageWidgetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [results, setResults] = useState<ElectionResultsData | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch('/api/elections/results', { cache: 'no-store' });
      if (res.ok) setResults(await res.json());
    } catch {
      // Keep homepage resilient if the optional election feed is unavailable.
    }
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    if (results?.mode !== 'live') return;
    const pollInterval = setInterval(fetchResults, 30000);
    return () => clearInterval(pollInterval);
  }, [fetchResults, results?.mode]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isHovered) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((previous) => (previous + 1) % ELECTION_SLIDES.length);
      }, 5000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered]);

  if (
    results &&
    surface === 'home' &&
    (!results.homepageEnabled || results.mode === 'hidden')
  ) {
    return null;
  }

  const handleNext = () => setCurrentIndex((previous) => (previous + 1) % ELECTION_SLIDES.length);
  const handlePrev = () =>
    setCurrentIndex((previous) => (previous - 1 + ELECTION_SLIDES.length) % ELECTION_SLIDES.length);

  const slide = ELECTION_SLIDES[currentIndex];
  const stateData = results?.states?.[slide.id];
  const isLive = results?.mode === 'live';
  const title = results?.title?.trim() || 'Election Results 2026';
  const badgeLabel = results?.badgeLabel?.trim() || (isLive ? 'LIVE' : 'FINAL');
  const sourceLabel = results?.sourceLabel?.trim() || 'ECI';
  const majority = Math.floor((stateData?.totalSeats ?? 0) / 2) + 1;
  const sortedParties = [...(stateData?.parties ?? [])].sort(
    (a, b) => b.won + b.leading - (a.won + a.leading)
  );
  const maxTotal = sortedParties[0] ? sortedParties[0].won + sortedParties[0].leading : 1;
  const hasResults = sortedParties.length > 0;
  const totalDeclared = sortedParties.reduce((sum, party) => sum + party.won + party.leading, 0);
  const gridTemplateColumns = isLive ? '1fr 32px 32px 36px' : '1fr 52px';

  return (
    <div className="w-full overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl ring-1 ring-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${
            isLive ? 'bg-red-500/20' : 'bg-emerald-500/15'
          }`}>
            <Activity className={`h-3.5 w-3.5 ${isLive ? 'animate-pulse text-red-500' : 'text-emerald-400'}`} />
          </span>
          <h2 className="text-[13px] font-bold uppercase tracking-widest text-white">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {surface === 'home' ? (
            <Link
              href="/main/elections"
              className="hidden items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-300 hover:border-zinc-500 hover:text-white sm:inline-flex"
            >
              <Archive className="h-3 w-3" />
              Archive
            </Link>
          ) : null}
          <span className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-widest text-white ${
            isLive ? 'animate-pulse bg-red-600' : 'bg-emerald-600'
          }`}>
            {badgeLabel}
          </span>
        </div>
      </div>

      <div className="flex overflow-x-auto border-b border-zinc-800 bg-zinc-900/70 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ELECTION_SLIDES.map((state, index) => (
          <button
            key={state.id}
            type="button"
            onClick={() => setCurrentIndex(index)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-[11px] font-semibold transition-all ${
              index === currentIndex
                ? 'border-red-500 bg-red-500/10 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {state.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="relative w-full flex-shrink-0 border-b border-zinc-800 bg-zinc-900 sm:w-[48%] sm:border-b-0 sm:border-r">
            <div className="aspect-[16/10] w-full overflow-hidden sm:aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${slide.src}?v=${SESSION_TS}`}
                alt={slide.label}
                className="h-full w-full object-cover"
              />
            </div>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/90"
              aria-label="Previous election state"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/90"
              aria-label="Next election state"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {ELECTION_SLIDES.map((state, index) => (
                <button
                  key={state.id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`Show ${state.label}`}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    index === currentIndex ? 'w-5 bg-red-500' : 'w-1.5 bg-white/30 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {hasResults ? (
              <>
                <div className="flex items-center justify-between border-b border-zinc-800/60 bg-zinc-900/50 px-3 py-2">
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-zinc-400">
                      <span className="font-bold text-white">{stateData?.totalSeats}</span> seats
                    </span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-zinc-400">
                      Majority: <span className="font-bold text-yellow-400">{majority}</span>
                    </span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-zinc-400">
                      {isLive ? 'Counted' : 'Declared'}:{' '}
                      <span className="font-bold text-green-400">{totalDeclared}</span>
                    </span>
                  </div>
                  <div className="hidden items-center gap-2 text-[9px] text-zinc-500 sm:flex">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-sm bg-green-500/80" />
                      {isLive ? 'Won' : 'Seats'}
                    </span>
                    {isLive ? (
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-sm bg-amber-400/60" />
                        Leads
                      </span>
                    ) : null}
                  </div>
                </div>

                <div
                  className="grid items-center border-b border-zinc-800/40 bg-zinc-900/30 px-3 py-1"
                  style={{ gridTemplateColumns }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Party</span>
                  {isLive ? (
                    <>
                      <span className="text-center text-[10px] font-semibold text-green-500">W</span>
                      <span className="text-center text-[10px] font-semibold text-amber-400">L</span>
                      <span className="text-center text-[10px] font-semibold text-white">Tot</span>
                    </>
                  ) : (
                    <span className="text-center text-[10px] font-semibold text-white">Seats</span>
                  )}
                </div>

                <div className="flex max-h-[280px] flex-col divide-y divide-zinc-800/40 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {sortedParties.map((party, index) => {
                    const total = party.won + party.leading;
                    const barPct = (total / maxTotal) * 100;
                    const wonRatio = total > 0 ? party.won / total : 0;
                    const isMajority = total >= majority;
                    const isLeader = index === 0;

                    return (
                      <motion.div
                        key={party.name}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className={`relative px-3 py-2 ${isLeader ? 'bg-zinc-800/40' : ''}`}
                      >
                        <div className="grid items-center gap-1" style={{ gridTemplateColumns }}>
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: party.color }}
                            />
                            <span className={`truncate text-[13px] font-bold ${isLeader ? 'text-white' : 'text-zinc-300'}`}>
                              {party.name}
                            </span>
                            {isMajority ? (
                              <span className="shrink-0 text-[8px] font-black text-yellow-400">*</span>
                            ) : null}
                          </div>

                          {isLive ? (
                            <>
                              <span className="text-center text-[13px] font-bold tabular-nums text-green-400">
                                {party.won}
                              </span>
                              <span className="text-center text-[13px] font-bold tabular-nums text-amber-400">
                                {party.leading}
                              </span>
                              <span className={`pr-1 text-right text-[14px] font-black tabular-nums ${isLeader ? 'text-white' : 'text-zinc-200'}`}>
                                {total}
                              </span>
                            </>
                          ) : (
                            <span className={`pr-1 text-right text-[14px] font-black tabular-nums ${isLeader ? 'text-white' : 'text-zinc-200'}`}>
                              {total}
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div className="flex h-full overflow-hidden rounded-full transition-all duration-700" style={{ width: `${barPct}%` }}>
                            <div className="h-full" style={{ width: `${wonRatio * 100}%`, background: party.color }} />
                            {isLive ? (
                              <div className="h-full flex-1 opacity-40" style={{ background: party.color }} />
                            ) : null}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {results?.lastUpdated ? (
                  <div className="mt-auto border-t border-zinc-800/60 bg-zinc-900/30 px-3 py-1.5">
                    <p className="text-right text-[10px] text-zinc-600">
                      Source: {sourceLabel} | {isLive ? 'Updated' : 'Final updated'}{' '}
                      {new Date(results.lastUpdated).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      IST
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex min-h-[160px] flex-1 flex-col items-center justify-center gap-3 p-6 text-zinc-600">
                <Activity className="h-7 w-7 animate-pulse" />
                <p className="text-center text-xs font-medium">
                  Results are not available yet.
                  <br />
                  Check back soon.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
