'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Activity } from 'lucide-react';

// Stable per-session cache buster — set once on load, not on every render
const SESSION_TS = Math.floor(Date.now() / 300_000); // changes every 5 min max

const ELECTION_SLIDES = [
  { id: 'wb',         src: '/elections/wb.jpg',         label: 'West Bengal'  },
  { id: 'kerala',     src: '/elections/kerala.jpg',     label: 'Kerala'       },
  { id: 'tn',         src: '/elections/tn.jpg',         label: 'Tamil Nadu'   },
  { id: 'assam',      src: '/elections/assam.jpg',      label: 'Assam'        },
  { id: 'puducherry', src: '/elections/puducherry.jpg', label: 'Puducherry'   },
];

type Party      = { name: string; color: string; won: number; leading: number };
type StateResult = { name: string; totalSeats: number; parties: Party[] };
type ResultsData = { lastUpdated: string | null; states: Record<string, StateResult> };

export default function ElectionImageWidget() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered,    setIsHovered]    = useState(false);
  const [results,      setResults]      = useState<ResultsData | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /* ── Fetch live results ── */
  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch('/api/elections/results', { cache: 'no-store' });
      if (res.ok) setResults(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  /* ── Auto-slide ── */
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isHovered) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((p) => (p + 1) % ELECTION_SLIDES.length);
      }, 5000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isHovered]);

  const handleNext = () => setCurrentIndex((p) => (p + 1) % ELECTION_SLIDES.length);
  const handlePrev = () => setCurrentIndex((p) => (p - 1 + ELECTION_SLIDES.length) % ELECTION_SLIDES.length);

  const slide          = ELECTION_SLIDES[currentIndex];
  const stateData      = results?.states?.[slide.id];
  const majority       = Math.floor((stateData?.totalSeats ?? 0) / 2) + 1;
  const sortedParties  = [...(stateData?.parties ?? [])].sort(
    (a, b) => (b.won + b.leading) - (a.won + a.leading),
  );
  const maxSeats       = sortedParties[0] ? sortedParties[0].won + sortedParties[0].leading : 1;
  const hasResults     = sortedParties.length > 0;

  return (
    <div className="w-full overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl ring-1 ring-zinc-800">

      {/* ── Header ── */}
      <div className="flex items-center justify-between bg-zinc-900 px-4 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20">
            <Activity className="h-3.5 w-3.5 text-red-500 animate-pulse" />
          </span>
          <h2 className="text-sm font-bold tracking-wider text-white uppercase">
            Live Election Results 2026
          </h2>
        </div>
        <span className="animate-pulse rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white tracking-widest">
          LIVE
        </span>
      </div>

      {/* ── State tabs ── */}
      <div className="flex bg-zinc-900/60 border-b border-zinc-800 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ELECTION_SLIDES.map((s, idx) => (
          <button
            key={s.id} type="button"
            onClick={() => setCurrentIndex(idx)}
            className={`shrink-0 px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap border-b-2 ${
              idx === currentIndex
                ? 'border-red-500 text-white bg-red-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {stateData && idx === currentIndex ? stateData.name : s.label}
          </button>
        ))}
      </div>

      {/* ── Content: graphic + results side-by-side ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* ── Graphic ── */}
          <div className="relative w-full sm:w-1/2 aspect-[16/9] sm:aspect-auto sm:min-h-[220px] bg-zinc-900 border-b sm:border-b-0 sm:border-r border-zinc-800 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${slide.src}?v=${SESSION_TS}`}
              alt={slide.label}
              className="absolute inset-0 w-full h-full object-contain"
            />

            {/* Prev / Next arrows */}
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/80 transition-colors z-10"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/80 transition-colors z-10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Dots */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {ELECTION_SLIDES.map((_, idx) => (
                <button
                  key={idx} onClick={() => setCurrentIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentIndex ? 'w-5 bg-red-500' : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* ── Results scoreboard ── */}
          <div className="flex-1 p-4 space-y-2.5 min-h-[180px]">
            {hasResults ? (
              <>
                {/* Seat summary */}
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] text-zinc-400">
                    <span className="text-white font-semibold">{stateData?.totalSeats}</span> seats &nbsp;·&nbsp;
                    Majority: <span className="text-yellow-400 font-semibold">{majority}</span>
                  </p>
                  <div className="flex gap-2 text-[10px] text-zinc-500">
                    <span className="flex items-center gap-0.5">
                      <span className="inline-block w-2 h-2 rounded-sm bg-green-500" /> Won
                    </span>
                    <span className="flex items-center gap-0.5">
                      <span className="inline-block w-2 h-2 rounded-sm bg-yellow-400/70" /> Leading
                    </span>
                  </div>
                </div>

                {/* Party rows */}
                {sortedParties.map((party) => {
                  const total      = party.won + party.leading;
                  const wonPct     = (party.won     / maxSeats) * 100;
                  const ledPct     = (party.leading / maxSeats) * 100;
                  const isMajority = total >= majority;

                  return (
                    <div key={party.name} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: party.color }}
                          />
                          <span className="font-semibold text-white">{party.name}</span>
                          {isMajority && (
                            <span className="text-[9px] font-bold text-yellow-400 border border-yellow-400/50 rounded px-1 leading-4">
                              ★
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 text-zinc-300 tabular-nums">
                          <span className="text-green-400 font-bold w-6 text-right">{party.won}</span>
                          <span className="text-yellow-400/80 w-6 text-right">{party.leading}</span>
                          <span className="font-bold text-white w-6 text-right">{total}</span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden flex">
                        <div
                          className="h-full transition-all duration-700"
                          style={{ width: `${wonPct}%`, background: party.color }}
                        />
                        <div
                          className="h-full transition-all duration-700 opacity-45"
                          style={{ width: `${ledPct}%`, background: party.color }}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Last updated */}
                {results?.lastUpdated && (
                  <p className="text-[10px] text-zinc-600 pt-1 text-right">
                    Updated {new Date(results.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[140px] gap-2 text-zinc-600">
                <Activity className="w-6 h-6 animate-pulse" />
                <p className="text-xs font-medium">Results coming soon…</p>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
