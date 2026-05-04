'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Activity } from 'lucide-react';

// Stable per-session cache buster — changes every 5 min max
const SESSION_TS = Math.floor(Date.now() / 300_000);

const ELECTION_SLIDES = [
  { id: 'wb',         src: '/elections/wb.jpg',         label: 'West Bengal'  },
  { id: 'kerala',     src: '/elections/kerala.jpg',     label: 'Kerala'       },
  { id: 'tn',         src: '/elections/tn.jpg',         label: 'Tamil Nadu'   },
  { id: 'assam',      src: '/elections/assam.jpg',      label: 'Assam'        },
  { id: 'puducherry', src: '/elections/puducherry.jpg', label: 'Puducherry'   },
];

type Party       = { name: string; color: string; won: number; leading: number };
type StateResult = { name: string; totalSeats: number; parties: Party[] };
type ResultsData = { lastUpdated: string | null; states: Record<string, StateResult> };

export default function ElectionImageWidget() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered,    setIsHovered]    = useState(false);
  const [results,      setResults]      = useState<ResultsData | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch('/api/elections/results', { cache: 'no-store' });
      if (res.ok) setResults(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isHovered) {
      timerRef.current = setInterval(() =>
        setCurrentIndex((p) => (p + 1) % ELECTION_SLIDES.length), 5000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isHovered]);

  const handleNext = () => setCurrentIndex((p) => (p + 1) % ELECTION_SLIDES.length);
  const handlePrev = () => setCurrentIndex((p) => (p - 1 + ELECTION_SLIDES.length) % ELECTION_SLIDES.length);

  const slide         = ELECTION_SLIDES[currentIndex];
  const stateData     = results?.states?.[slide.id];
  const majority      = Math.floor((stateData?.totalSeats ?? 0) / 2) + 1;
  const sortedParties = [...(stateData?.parties ?? [])].sort(
    (a, b) => (b.won + b.leading) - (a.won + a.leading),
  );
  const maxTotal      = sortedParties[0] ? sortedParties[0].won + sortedParties[0].leading : 1;
  const hasResults    = sortedParties.length > 0;
  const totalCounted  = sortedParties.reduce((s, p) => s + p.won + p.leading, 0);

  return (
    <div className="w-full overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl ring-1 ring-zinc-800">

      {/* ── Header ── */}
      <div className="flex items-center justify-between bg-zinc-900 px-3 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20">
            <Activity className="h-3.5 w-3.5 text-red-500 animate-pulse" />
          </span>
          <h2 className="text-[13px] font-bold tracking-widest text-white uppercase">
            Live Election Results 2026
          </h2>
        </div>
        <span className="animate-pulse rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white tracking-widest">
          LIVE
        </span>
      </div>

      {/* ── State tabs ── */}
      <div className="flex bg-zinc-900/70 border-b border-zinc-800 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ELECTION_SLIDES.map((s, idx) => (
          <button key={s.id} type="button" onClick={() => setCurrentIndex(idx)}
            className={`shrink-0 px-3 py-2 text-[11px] font-semibold transition-all whitespace-nowrap border-b-2 ${
              idx === currentIndex
                ? 'border-red-500 text-white bg-red-500/10'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <AnimatePresence mode="wait">
        <motion.div key={currentIndex}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row"
          onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
        >

          {/* ── Graphic ── */}
          <div className="relative w-full sm:w-[45%] bg-zinc-900 border-b sm:border-b-0 sm:border-r border-zinc-800 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${slide.src}?v=${SESSION_TS}`}
              alt={slide.label}
              className="block w-full h-auto"
            />
            {/* Prev / Next arrows */}
            <button onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors z-10">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors z-10">
              <ChevronRight className="h-4 w-4" />
            </button>
            {/* Dots */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {ELECTION_SLIDES.map((_, idx) => (
                <button key={idx} onClick={() => setCurrentIndex(idx)}
                  className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-5 bg-red-500' : 'w-1.5 bg-white/30 hover:bg-white/60'}`}
                />
              ))}
            </div>
          </div>

          {/* ── Scoreboard ── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {hasResults ? (
              <>
                {/* Stats bar */}
                <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/50 border-b border-zinc-800/60">
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-zinc-400">
                      <span className="text-white font-bold">{stateData?.totalSeats}</span> seats
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-400">
                      Majority: <span className="text-yellow-400 font-bold">{majority}</span>
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-400">
                      Counted: <span className="text-green-400 font-bold">{totalCounted}</span>
                    </span>
                  </div>
                  {/* Legend */}
                  <div className="hidden sm:flex items-center gap-2 text-[9px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-sm bg-green-500/80" />Won
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-sm bg-amber-400/60" />Leads
                    </span>
                  </div>
                </div>

                {/* Column headers */}
                <div className="grid items-center px-3 py-1 border-b border-zinc-800/40 bg-zinc-900/30"
                  style={{ gridTemplateColumns: '1fr 32px 32px 36px' }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Party</span>
                  <span className="text-[10px] font-semibold text-center text-green-500">W</span>
                  <span className="text-[10px] font-semibold text-center text-amber-400">L</span>
                  <span className="text-[10px] font-semibold text-center text-white">Tot</span>
                </div>

                {/* Party rows */}
                <div className="flex flex-col divide-y divide-zinc-800/40 overflow-y-auto max-h-[280px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {sortedParties.map((party, idx) => {
                    const total      = party.won + party.leading;
                    const barPct     = (total / maxTotal) * 100;
                    const wonRatio   = total > 0 ? party.won / total : 0;
                    const isMajority = total >= majority;
                    const isLeader   = idx === 0;

                    return (
                      <motion.div key={party.name}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className={`relative px-3 py-2 ${isLeader ? 'bg-zinc-800/40' : ''}`}
                      >
                        {/* Party name row */}
                        <div className="grid items-center gap-1"
                          style={{ gridTemplateColumns: '1fr 32px 32px 36px' }}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: party.color }} />
                            <span className={`text-[13px] font-bold truncate ${isLeader ? 'text-white' : 'text-zinc-300'}`}>
                              {party.name}
                            </span>
                            {isMajority && (
                              <span className="text-[8px] font-black text-yellow-400 shrink-0">★</span>
                            )}
                          </div>
                          <span className="text-[13px] font-bold text-green-400 text-center tabular-nums">
                            {party.won}
                          </span>
                          <span className="text-[13px] font-bold text-amber-400 text-center tabular-nums">
                            {party.leading}
                          </span>
                          <span className={`text-[14px] font-black text-right tabular-nums pr-1 ${isLeader ? 'text-white' : 'text-zinc-200'}`}>
                            {total}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-1.5 h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                          <div className="h-full rounded-full overflow-hidden flex transition-all duration-700"
                            style={{ width: `${barPct}%` }}>
                            <div className="h-full" style={{ width: `${wonRatio * 100}%`, background: party.color }} />
                            <div className="h-full flex-1 opacity-40" style={{ background: party.color }} />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Footer */}
                {results?.lastUpdated && (
                  <div className="px-3 py-1.5 border-t border-zinc-800/60 bg-zinc-900/30 mt-auto">
                    <p className="text-[10px] text-zinc-600 text-right">
                      Source: ECI &nbsp;·&nbsp; Updated {new Date(results.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 min-h-[160px] gap-3 text-zinc-600 p-6">
                <Activity className="w-7 h-7 animate-pulse" />
                <p className="text-xs font-medium text-center">
                  Results not yet available.<br />Check back soon.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
