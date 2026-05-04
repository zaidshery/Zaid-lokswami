'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Activity } from 'lucide-react';

const ELECTION_SLIDES = [
  { id: 'wb', src: '/elections/wb.jpg', alt: 'West Bengal Election Results' },
  { id: 'kerala', src: '/elections/kerala.jpg', alt: 'Kerala Election Results' },
  { id: 'tn', src: '/elections/tn.jpg', alt: 'Tamil Nadu Election Results' },
  { id: 'assam', src: '/elections/assam.jpg', alt: 'Assam Election Results' },
  { id: 'puducherry', src: '/elections/puducherry.jpg', alt: 'Puducherry Election Results' },
];

export default function ElectionImageWidget() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ELECTION_SLIDES.length);
    }, 4000); // 4 seconds per slide
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (!isHovered) {
      startTimer();
    } else {
      stopTimer();
    }
    return stopTimer;
  }, [isHovered]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % ELECTION_SLIDES.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + ELECTION_SLIDES.length) % ELECTION_SLIDES.length);
  };

  return (
    <div className="w-full relative overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl ring-1 ring-zinc-800">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-zinc-900 px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20">
            <Activity className="h-3.5 w-3.5 text-red-500 animate-pulse" />
          </div>
          <h2 className="text-sm font-bold tracking-wider text-white sm:text-base uppercase">
            Live Election Results 2026
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="animate-pulse rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white tracking-widest sm:text-xs">
            LIVE
          </span>
        </div>
      </div>

      {/* Image Carousel */}
      <div 
        className="relative aspect-[16/9] w-full bg-zinc-950 sm:aspect-[21/9] md:aspect-[24/9] lg:aspect-[2.5/1]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            <Image
              src={ELECTION_SLIDES[currentIndex].src}
              alt={ELECTION_SLIDES[currentIndex].alt}
              fill
              className="object-contain sm:object-cover"
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1200px"
            />
          </motion.div>
        </AnimatePresence>

        {/* Controls */}
        <div className="absolute inset-0 flex items-center justify-between p-2 sm:p-4 opacity-0 transition-opacity hover:opacity-100 pointer-events-none group-hover:opacity-100">
          <button
            onClick={handlePrev}
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/80 sm:h-10 sm:w-10"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={handleNext}
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/80 sm:h-10 sm:w-10"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Dots */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 sm:bottom-4 sm:gap-2">
          {ELECTION_SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'w-6 bg-red-500 sm:w-8' : 'w-1.5 bg-white/50 hover:bg-white/80 sm:w-2'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
