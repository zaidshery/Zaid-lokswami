"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Article } from '@/lib/mock/data';
import HeroCard from "./HeroCard";

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
      setIndex((i) => (i + 1) % (articles?.length || 1));
    }, interval);
  };

  const stopAutoPlay = () => {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  };

  if (!articles || articles.length === 0) {
    return null;
  }

  const safeArticle = articles[index] || articles[0];

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
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const px = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
      const py = ((e.clientY - rect.top) / rect.height - 0.5) * 12;
      setParallax({ x: px, y: py });
    }
  };

  const onPointerUp = () => {
    if (pointerStartX.current == null) return;
    const dx = pointerDeltaX.current;
    pointerStartX.current = null;
    pointerDeltaX.current = 0;
    setParallax({ x: 0, y: 0 });

    if (dx < -50) {
      goNext();
    } else if (dx > 50) {
      goPrev();
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
      {/* 🇮🇳 3-Color (Tricolor) Card Frame: Saffron -> White -> Green */}
      <div className="relative rounded-[28px] p-[1.5px] bg-gradient-to-br from-[#FF9933] via-[#FFFFFF] to-[#138808] shadow-[0_18px_48px_-12px_rgba(0,0,0,0.5),0_0_18px_-4px_rgba(255,153,51,0.25)]">
        <div
          ref={containerRef}
          className={`relative h-full overflow-hidden select-none ${
            variant === 'editorial'
              ? 'rounded-[26.5px]'
              : 'rounded-[26.5px] bg-[var(--newsroom-hero-surface)] dark:bg-zinc-950'
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
          <div className="relative h-full overflow-hidden rounded-[inherit]">
            <HeroCard article={safeArticle} parallax={parallax} variant={variant} />

            {/* ARIA Live for screen readers */}
            <div className="sr-only" aria-live="polite">
              Slide {index + 1} of {articles.length}: {safeArticle.title}
            </div>

            {/* Arrow Controls - Glassmorphism, visible on hover */}
            <div className="absolute inset-x-0 top-1/3 flex -translate-y-1/2 items-center justify-between p-2 sm:p-4 pointer-events-none z-20">
              <button
                aria-label="Previous slide"
                onClick={goPrev}
                className="pointer-events-auto flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/75 text-white/95 backdrop-blur-md shadow-lg border border-white/20 transition-all hover:scale-105 active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                aria-label="Next slide"
                onClick={goNext}
                className="pointer-events-auto flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/75 text-white/95 backdrop-blur-md shadow-lg border border-white/20 transition-all hover:scale-105 active:scale-95"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
