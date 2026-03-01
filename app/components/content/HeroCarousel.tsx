"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import HeroCard from "./HeroCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Article } from '@/lib/mock/data';

interface HeroCarouselProps {
  articles: Article[];
  interval?: number;
  variant?: 'editorial' | 'modern';
  className?: string;
}

export default function HeroCarousel({
  articles,
  interval = 6000,
  variant = 'editorial',
  className = "",
}: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const timer = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // parallax offsets in px
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const pointerStartX = useRef<number | null>(null);
  const pointerDeltaX = useRef(0);

  useEffect(() => {
    if (!articles || articles.length <= 1) return;
    startAutoPlay();
    return stopAutoPlay;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, interval]);

  const startAutoPlay = () => {
    stopAutoPlay();
    timer.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % articles.length);
    }, interval);
  };

  const stopAutoPlay = () => {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  };

  if (!articles || articles.length === 0) return null;

  const goPrev = () => {
    stopAutoPlay();
    setIndex((i) => (i - 1 + articles.length) % articles.length);
    startAutoPlay();
  };

  const goNext = () => {
    stopAutoPlay();
    setIndex((i) => (i + 1) % articles.length);
    startAutoPlay();
  };

  // Pointer / swipe handlers
  const onPointerDown = (e: React.PointerEvent) => {
    pointerStartX.current = e.clientX;
    pointerDeltaX.current = 0;
    (e.target as Element).setPointerCapture(e.pointerId);
    stopAutoPlay();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointerStartX.current == null) return;
    pointerDeltaX.current = e.clientX - pointerStartX.current;
    // small parallax based on pointer position
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const relX = (e.clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      setParallax({ x: relX * 20, y: relY * 12 });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (pointerStartX.current == null) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    const delta = pointerDeltaX.current;
    pointerStartX.current = null;
    pointerDeltaX.current = 0;
    setParallax({ x: 0, y: 0 });
    // swipe threshold
    if (Math.abs(delta) > 60) {
      if (delta > 0) {
        goPrev();
      } else {
        goNext();
      }
    } else {
      startAutoPlay();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goPrev();
    if (e.key === 'ArrowRight') goNext();
  };

  return (
    <div className={`relative group w-full ${className}`}>
      <div
        ref={containerRef}
        className={`relative h-full overflow-hidden select-none ${
          variant === 'editorial'
            ? 'rounded-2xl shadow-lg ring-1 ring-zinc-200/70 dark:ring-zinc-800'
            : 'rounded-3xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10'
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onMouseEnter={stopAutoPlay}
        onMouseLeave={startAutoPlay}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Top stories carousel"
      >
        <div className={`relative h-full overflow-hidden ${variant === 'editorial' ? 'rounded-2xl' : 'rounded-3xl'}`}>
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={articles[index].id}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              className="relative h-full"
            >
              <HeroCard article={articles[index]} parallax={parallax} variant={variant} />
            </motion.div>
          </AnimatePresence>

          {/* ARIA Live for screen readers */}
          <div className="sr-only" aria-live="polite">
            Slide {index + 1} of {articles.length}: {articles[index].title}
          </div>

          {/* Arrow Controls - Glassmorphism, visible on hover */}
          <div className="absolute inset-0 flex items-center justify-between p-2 sm:p-4 pointer-events-none">
            <button
              aria-label="Previous slide"
              onClick={goPrev}
                className={`pointer-events-auto flex items-center justify-center cnp-motion ${
                variant === 'editorial'
                  ? 'h-9 w-9 rounded-full border border-white/40 bg-black/35 text-white/90 backdrop-blur-sm opacity-100 sm:h-10 sm:w-10 sm:opacity-0 lg:h-11 lg:w-11 sm:group-hover:opacity-100'
                  : 'h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11 rounded-full bg-black/20 hover:bg-black/40 text-white/90 backdrop-blur-md opacity-90 sm:opacity-0 sm:group-hover:opacity-100 -translate-x-0 sm:-translate-x-4 sm:group-hover:translate-x-0'
              }`}
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button
              aria-label="Next slide"
              onClick={goNext}
                className={`pointer-events-auto flex items-center justify-center cnp-motion ${
                variant === 'editorial'
                  ? 'h-9 w-9 rounded-full border border-white/40 bg-black/35 text-white/90 backdrop-blur-sm opacity-100 sm:h-10 sm:w-10 sm:opacity-0 lg:h-11 lg:w-11 sm:group-hover:opacity-100'
                  : 'h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11 rounded-full bg-black/20 hover:bg-black/40 text-white/90 backdrop-blur-md opacity-90 sm:opacity-0 sm:group-hover:opacity-100 translate-x-0 sm:translate-x-4 sm:group-hover:translate-x-0'
              }`}
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>

        {/* Dots (overlay) - Modern Pills */}
        <div className={`absolute left-0 right-0 z-30 flex items-center justify-center ${variant === 'editorial' ? 'hidden' : 'bottom-6 gap-2'}`}>
          {articles.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => {
                stopAutoPlay();
                setIndex(i);
                startAutoPlay();
              }}
              animate={
                variant === 'editorial'
                  ? { width: i === index ? 22 : 5, opacity: i === index ? 1 : 0.5 }
                  : { width: i === index ? 32 : 8, opacity: i === index ? 1 : 0.5 }
              }
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className={`rounded-full cnp-motion ${
                variant === 'editorial'
                  ? i === index
                    ? 'h-1 bg-white'
                    : 'h-1 bg-white/45 hover:bg-white/65'
                  : i === index
                    ? "h-1.5 bg-white shadow-lg"
                    : "h-1.5 bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
