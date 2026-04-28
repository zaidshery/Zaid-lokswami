'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'headerCompact' | 'headerMobile' | 'headerDesktop';
  href?: string;
}

export default function Logo({ size = 'md', href }: LogoProps) {
  const reduceMotion = useReducedMotion();

  const sizes = {
    sm: { icon: 36, wordmarkW: 122, wordmarkH: 24, gap: 3, iconX: 0, iconY: 0, wordmarkY: 0 },
    md: { icon: 34, wordmarkW: 158, wordmarkH: 34, gap: 8, iconX: 0, iconY: 0, wordmarkY: 0 },
    lg: { icon: 44, wordmarkW: 200, wordmarkH: 43, gap: 8, iconX: 0, iconY: 0, wordmarkY: 0 },
    headerCompact: { icon: 36, wordmarkW: 112, wordmarkH: 24, gap: 3, iconX: 2, iconY: 2, wordmarkY: 0 },
    headerMobile: { icon: 44, wordmarkW: 148, wordmarkH: 31, gap: 8, iconX: 3, iconY: 2, wordmarkY: 0 },
    headerDesktop: { icon: 54, wordmarkW: 192, wordmarkH: 40, gap: 10, iconX: 4, iconY: 3, wordmarkY: 0 },
  };

  const sizeConfig = sizes[size];

  const logoContent = (
    <motion.div
      className="group/logo flex max-w-full shrink-0 items-center"
      whileHover={reduceMotion ? undefined : { scale: 1.012, y: -1 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
    >
      <motion.div
        className="flex items-center"
        style={{ gap: `${sizeConfig.gap}px` }}
        animate={reduceMotion ? undefined : { y: [0, -1, 0] }}
        transition={
          reduceMotion
            ? undefined
            : { duration: 5.4, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.25, delay: 0.7 }
        }
      >
        <motion.span
          className="relative inline-flex overflow-hidden rounded-md"
          style={{ transform: `translate(${sizeConfig.iconX}px, ${sizeConfig.iconY}px)` }}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.9, y: 2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-transparent"
            animate={reduceMotion ? { opacity: 0.24, scale: 1 } : { opacity: [0.2, 0.34, 0.2], scale: [0.95, 1.05, 0.95] }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 4.8, ease: 'easeInOut', repeat: Infinity, delay: 0.8 }
            }
          />
          <Image
            src="/logo-header-cutout.png"
            alt="Lokswami Logo"
            width={sizeConfig.icon}
            height={sizeConfig.icon}
            className="relative z-[1] block object-contain transition-transform duration-300 motion-safe:group-hover/logo:rotate-[2deg] motion-safe:group-hover/logo:scale-[1.06]"
            priority={size === 'headerCompact' || size === 'headerMobile' || size === 'headerDesktop'}
            sizes="(max-width: 639px) 36px, (max-width: 1023px) 44px, 54px"
          />
        </motion.span>

        <motion.span
          className="relative inline-flex overflow-hidden"
          style={{ transform: `translateY(${sizeConfig.wordmarkY}px)` }}
          initial={reduceMotion ? false : { opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: reduceMotion ? 0.01 : 0.42,
            ease: [0.22, 1, 0.36, 1],
            delay: reduceMotion ? 0 : 0.08,
          }}
        >
          <Image
            src="/logo-wordmark-final.png"
            alt="Lokswami"
            width={sizeConfig.wordmarkW}
            height={sizeConfig.wordmarkH}
            className={`block max-w-full object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.18)] dark:brightness-0 dark:invert ${size === 'headerCompact' ? 'max-w-[108px]' : size === 'headerMobile' ? 'max-w-[132px]' : ''}`}
            priority={size === 'headerCompact' || size === 'headerMobile' || size === 'headerDesktop'}
            sizes="(max-width: 639px) 112px, (max-width: 1023px) 148px, 192px"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-1/3 hidden w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-0 transition-all duration-700 motion-reduce:transition-none motion-safe:group-hover/logo:left-[125%] motion-safe:group-hover/logo:opacity-100 dark:via-zinc-200/35 md:block"
          />
        </motion.span>
      </motion.div>
    </motion.div>
  );

  return href ? <Link href={href} className="inline-flex max-w-full items-center align-middle">{logoContent}</Link> : logoContent;
}
