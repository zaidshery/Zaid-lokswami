'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Activity, BarChart2, Image as ImageIcon } from 'lucide-react';

const ELECTION_SLIDES = [
  { id: 'wb',         src: '/elections/wb.jpg',         alt: 'West Bengal Election Results'  },
  { id: 'kerala',     src: '/elections/kerala.jpg',     alt: 'Kerala Election Results'       },
  { id: 'tn',         src: '/elections/tn.jpg',         alt: 'Tamil Nadu Election Results'   },
  { id: 'assam',      src: '/elections/assam.jpg',      alt: 'Assam Election Results'        },
  { id: 'puducherry', src: '/elections/puducherry.jpg', alt: 'Puducherry Election Results'   },
];

type Party = { name: string; color: string; won: number; leading: number };
type StateResult = { name: string; totalSeats: number; parties: Party[] };
type ResultsData = { lastUpdated: string | null; states: Record<string, StateResult> };

export default function ElectionImageWidget() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered,    setIsHovered]    = useState(false);
  const [viewMode,     setViewMode]     = useState<'image' | 'results'>('image');
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
    if (!isHovered && viewMode === 'image') {
      timerRef.current = setInterval(() => {
        setCurrentIndex((p) => (p + 1) % ELECTION_SLIDES.length);
      }, 4000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isHovered, viewMode]);

  const handleNext = () => setCurrentIndex((p) => (p + 1) % ELECTION_SLIDES.length);
  const handlePrev = () => setCurrentIndex((p) => (p - 1 + ELECTION_SLIDES.length) % ELECTION_SLIDES.length);

  const activeStateId    = ELECTION_SLIDES[currentIndex].id;
  const activeStateData  = results?.states?.[activeStateId];
  const hasResultsData   = (activeStateData?.parties?.length ?? 0) > 0;
  const majority         = Math.floor((activeStateData?.totalSeats ?? 0) / 2) + 1;
  const sortedParties    = [...(activeStateData?.parties ?? [])].sort(
    (a, b) => (b.won + b.leading) - (a.won + a.leading)
  );
  const maxSeats         = sortedParties[0] ? sortedParties[0].won + sortedParties[0].leading : 1;

  return (
    <div className="w-full relative overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl ring-1 ring-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between bg-zinc-900 px-4 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20">
            <Activity className="h-3.5 w-3.5 text-red-500 animate-pulse" />
          </div>
          <h2 className="text-sm font-bold tracking-wider text-white uppercase">
            Live Election Results 2026
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle — only show if results data exists */}
          {hasResultsData && (
            <div className="flex rounded-lg overflow-hidden border border-zinc-700">
              <button type="button" onClick={() => setViewMode('image')}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors ${viewMode === 'image' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <ImageIcon className="w-3 h-3" /> Graphic
              </button>
              <button type="button" onClick={() => setViewMode('results')}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors ${viewMode === 'results' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <BarChart2 className="w-3 h-3" /> Results
              </button>
            </div>
          )}
          <span className="animate-pulse rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white tracking-widest">
            LIVE
          </span>
        </div>
      </div>

      {/* State name strip */}
      <div className="flex bg-zinc-900/60 border-b border-zinc-800 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ELECTION_SLIDES.map((slide, idx) => (
          <button key={slide.id} type="button" onClick={() => setCurrentIndex(idx)}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap border-b-2 ${
              idx === currentIndex
                ? 'border-red-500 text-white bg-red-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {results?.states?.[slide.id]?.name ?? slide.alt.replace(' Election Results', '')}
          </button>
        ))}
      </div>

      {/* Content area */}
      <AnimatePresence mode="wait">
        {viewMode === 'image' ? (
          <motion.div key={`img-${currentIndex}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="relative aspect-[16/9] w-full bg-zinc-950 sm:aspect-[21/9]"
            onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ELECTION_SLIDES[currentIndex].src}
              alt={ELECTION_SLIDES[currentIndex].alt}
              className="absolute inset-0 w-full h-full object-contain sm:object-cover"
            />

            {/* Arrow controls */}
            <div className="absolute inset-0 flex items-center justify-between px-2 sm:px-4 opacity-0 transition-opacity hover:opacity-100">
              <button onClick={handlePrev} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/80 transition-colors sm:h-10 sm:w-10">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={handleNext} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/80 transition-colors sm:h-10 sm:w-10">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Dots */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {ELECTION_SLIDES.map((_, idx) => (
                <button key={idx} onClick={() => setCurrentIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-6 bg-red-500' : 'w-1.5 bg-white/50 hover:bg-white/80'}`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </motion.div>
        ) : (
          /* ── Results scoreboard ── */
          <motion.div key={`results-${activeStateId}`}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4 space-y-2 min-h-[180px]"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-zinc-400">
                Total seats: <span className="text-white font-semibold">{activeStateData?.totalSeats}</span>
                &nbsp;&nbsp;Majority: <span className="text-yellow-400 font-semibold">{majority}</span>
              </p>
              <div className="flex gap-3 text-[10px] text-zinc-500">
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-green-500" /> Won</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-yellow-400/70" /> Leading</span>
              </div>
            </div>

            {sortedParties.map((party) => {
              const total   = party.won + party.leading;
              const wonPct  = (party.won    / maxSeats) * 100;
              const ledPct  = (party.leading / maxSeats) * 100;
              const isMajority = total >= majority;

              return (
                <div key={party.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: party.color }} />
                      <span className="font-semibold text-white">{party.name}</span>
                      {isMajority && (
                        <span className="text-[9px] font-bold text-yellow-400 border border-yellow-400/50 rounded px-1 py-0.5">MAJORITY</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-zinc-300">
                      <span className="text-green-400 font-bold">{party.won}</span>
                      <span className="text-yellow-400/80">{party.leading}</span>
                      <span className="font-bold text-white w-8 text-right">{total}</span>
                    </div>
                  </div>
                  {/* Bar */}
                  <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden flex">
                    <div className="h-full rounded-l-full transition-all duration-500" style={{ width: `${wonPct}%`, background: party.color }} />
                    <div className="h-full transition-all duration-500 opacity-50" style={{ width: `${ledPct}%`, background: party.color }} />
                  </div>
                </div>
              );
            })}

            {sortedParties.length === 0 && (
              <p className="text-center text-zinc-500 text-sm py-6">Results not yet available for this state.</p>
            )}

            {results?.lastUpdated && (
              <p className="text-[10px] text-zinc-600 pt-1 text-right">
                Updated: {new Date(results.lastUpdated).toLocaleTimeString('en-IN')}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
