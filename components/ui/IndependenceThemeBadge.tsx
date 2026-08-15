'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store/appStore';
import TirangaCelebrationEffect from './TirangaCelebrationEffect';

/**
 * 🇮🇳 Ashoka Chakra SVG Icon (24 spokes with center hub)
 */
export function AshokaChakraIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      {/* 24 spokes */}
      {[...Array(12)].map((_, i) => (
        <line
          key={i}
          x1="12"
          y1="2"
          x2="12"
          y2="22"
          stroke="currentColor"
          strokeWidth="0.8"
          transform={`rotate(${i * 15} 12 12)`}
        />
      ))}
    </svg>
  );
}

/**
 * 🇮🇳 Indian National Flag (Tiranga) SVG Icon
 */
export function TirangaFlagIcon({ className = 'h-3.5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 20"
      className={`inline-block shrink-0 rounded-[2px] shadow-xs ${className}`}
      aria-hidden="true"
    >
      {/* Saffron Top Stripe */}
      <rect width="30" height="6.67" fill="#FF9933" />
      {/* White Middle Stripe */}
      <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
      {/* Green Bottom Stripe */}
      <rect y="13.34" width="30" height="6.67" fill="#138808" />
      {/* Ashoka Chakra */}
      <circle cx="15" cy="10" r="2.3" fill="none" stroke="#000080" strokeWidth="0.5" />
      <circle cx="15" cy="10" r="0.6" fill="#000080" />
      {[...Array(12)].map((_, i) => (
        <line
          key={i}
          x1="15"
          y1="7.7"
          x2="15"
          y2="12.3"
          stroke="#000080"
          strokeWidth="0.25"
          transform={`rotate(${i * 15} 15 10)`}
        />
      ))}
    </svg>
  );
}

/**
 * 🇮🇳 IndependenceThemeBadge
 * Matches the exact 15 August Special pill badge from the design with red capsule,
 * stacked "15 अगस्त / स्पेशल" text, and the circular Ashoka Chakra emblem.
 */
export default function IndependenceThemeBadge({
  compact = false,
  className = '',
}: {
  compact?: boolean;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { isFestiveMode, toggleFestiveMode, language } = useAppStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleCelebrate = () => {
    toggleFestiveMode();
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4500);
  };

  const isHindi = language === 'hi';
  const badgeTitle = isHindi
    ? isFestiveMode
      ? '15 अगस्त स्पेशल थीम सक्रिय है (क्लिक करें)'
      : '15 अगस्त स्पेशल थीम चालू करें'
    : isFestiveMode
      ? '15 August Special Theme Active (Click to toggle)'
      : 'Enable 15 August Special Theme';

  return (
    <>
      <TirangaCelebrationEffect active={showConfetti} />
      
      <motion.button
        type="button"
        onClick={handleCelebrate}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        aria-label={badgeTitle}
        title={badgeTitle}
        className={`group relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl border border-red-500/80 bg-gradient-to-r from-red-600 via-[#b3141a] to-red-600 px-2.5 text-white shadow-[0_4px_16px_rgba(220,38,38,0.35)] transition-all duration-300 hover:shadow-[0_6px_22px_rgba(220,38,38,0.5)] ${
          compact ? 'h-9 py-0.5' : 'h-10 py-1'
        } ${className}`}
      >
        {/* Subtle inner top highlight */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent"
        />

        {/* Text Container: 15 अगस्त / स्पेशल */}
        <div className="flex flex-col items-start leading-[1.05]">
          <span className="text-[11px] font-black tracking-tight text-white drop-shadow-sm sm:text-xs">
            {isHindi ? '15 अगस्त' : '15 Aug'}
          </span>
          <span className="text-[9px] font-bold tracking-wider text-red-100/90 sm:text-[10px]">
            {isHindi ? 'स्पेशल' : 'Special'}
          </span>
        </div>

        {/* Circular White Emblem with Ashoka Chakra */}
        <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-blue-900 shadow-sm sm:h-7 sm:w-7">
          <AshokaChakraIcon className="h-4 w-4 animate-ashoka-slow text-blue-900" />
        </div>
      </motion.button>
    </>
  );
}
