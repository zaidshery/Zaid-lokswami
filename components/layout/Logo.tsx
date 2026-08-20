'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';

export type LogoSize = 'sm' | 'md' | 'lg' | 'headerCompact' | 'headerMobile' | 'headerDesktop';

export interface LogoSizeConfig {
  icon: number;
  wordmarkW: number;
  wordmarkH: number;
  gap: number;
  iconX: number;
  iconY: number;
  wordmarkY: number;
}

export const LOGO_SIZES: Record<LogoSize, LogoSizeConfig> = {
  sm: { icon: 36, wordmarkW: 122, wordmarkH: 24, gap: 4, iconX: 0, iconY: 0, wordmarkY: 0 },
  md: { icon: 34, wordmarkW: 158, wordmarkH: 34, gap: 8, iconX: 0, iconY: 0, wordmarkY: 0 },
  lg: { icon: 44, wordmarkW: 200, wordmarkH: 43, gap: 8, iconX: 0, iconY: 0, wordmarkY: 0 },
  headerCompact: { icon: 38, wordmarkW: 136, wordmarkH: 28, gap: 6, iconX: 1, iconY: 1, wordmarkY: 0 },
  headerMobile: { icon: 44, wordmarkW: 156, wordmarkH: 33, gap: 8, iconX: 2, iconY: 1, wordmarkY: 0 },
  headerDesktop: { icon: 54, wordmarkW: 192, wordmarkH: 40, gap: 10, iconX: 4, iconY: 3, wordmarkY: 0 },
};

export interface LogoIconProps {
  size?: LogoSize;
  variant?: 'standard';
  className?: string;
}

/** Standalone targetable 'लो' Logo Emblem component */
export function LogoIcon({
  size = 'md',
  variant = 'standard',
  className = '',
}: LogoIconProps) {
  const sizeConfig = LOGO_SIZES[size];

  return (
    <span
      data-logo-element="icon"
      className={`lokswami-logo-icon relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md ${className}`}
      style={{
        transform: `translate(${sizeConfig.iconX}px, ${sizeConfig.iconY}px)`,
        width: `${sizeConfig.icon}px`,
        height: `${sizeConfig.icon}px`,
      }}
    >
      <Image
        src="/logo-header-cutout.png"
        alt="Lokswami Emblem"
        width={sizeConfig.icon}
        height={sizeConfig.icon}
        className="relative z-[1] block h-auto w-full object-contain transition-transform duration-300 motion-safe:group-hover/logo:rotate-[2deg] motion-safe:group-hover/logo:scale-[1.06]"
        priority={size === 'headerCompact' || size === 'headerMobile' || size === 'headerDesktop'}
        sizes="(max-width: 639px) 38px, (max-width: 1023px) 44px, 54px"
      />
    </span>
  );
}

export interface LogoWordmarkProps {
  size?: LogoSize;
  variant?: 'standard' | 'white' | 'dark';
  className?: string;
}

/** Standalone targetable 'लोकस्वामी' Wordmark component */
export function LogoWordmark({
  size = 'md',
  variant = 'standard',
  className = '',
}: LogoWordmarkProps) {
  const sizeConfig = LOGO_SIZES[size];

  const maxWClass =
    size === 'headerCompact'
      ? 'max-w-[136px]'
      : size === 'headerMobile'
        ? 'max-w-[156px]'
        : '';

  return (
    <span
      data-logo-element="wordmark"
      className={`lokswami-logo-wordmark relative inline-flex items-center overflow-hidden ${className}`}
      style={{ transform: `translateY(${sizeConfig.wordmarkY}px)` }}
    >
      <div
        className={`relative block ${maxWClass}`}
        style={{
          width: `${sizeConfig.wordmarkW}px`,
          height: `${sizeConfig.wordmarkH}px`,
        }}
      >
        <Image
          src="/logo-wordmark-final.png"
          alt="Lokswami"
          width={sizeConfig.wordmarkW}
          height={sizeConfig.wordmarkH}
          className={`block h-full w-full object-contain ${
            variant === 'white'
              ? 'brightness-0 invert'
              : variant === 'dark'
                ? 'brightness-0'
                : 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.18)] dark:brightness-0 dark:invert'
          }`}
          priority={size === 'headerCompact' || size === 'headerMobile' || size === 'headerDesktop'}
          sizes="(max-width: 639px) 136px, (max-width: 1023px) 156px, 192px"
        />
      </div>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/3 hidden w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-0 transition-all duration-700 motion-reduce:transition-none motion-safe:group-hover/logo:left-[125%] motion-safe:group-hover/logo:opacity-100 dark:via-zinc-200/35 md:block"
      />
    </span>
  );
}

export interface LogoProps {
  size?: LogoSize;
  href?: string;
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  iconVariant?: 'standard';
  wordmarkVariant?: 'standard' | 'white' | 'dark';
  showIcon?: boolean;
  showWordmark?: boolean;
}

/** Complete Lokswami Brand Logo with separately targetable Emblem & Wordmark sub-elements */
export default function Logo({
  size = 'md',
  href,
  className = '',
  iconClassName = '',
  wordmarkClassName = '',
  iconVariant = 'standard',
  wordmarkVariant = 'standard',
  showIcon = true,
  showWordmark = true,
}: LogoProps) {
  const reduceMotion = useReducedMotion();
  const sizeConfig = LOGO_SIZES[size];

  const logoContent = (
    <motion.div
      data-logo-root="true"
      className={`group/logo flex max-w-full shrink-0 items-center ${className}`}
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
        {showIcon ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9, y: 2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <LogoIcon size={size} variant={iconVariant} className={iconClassName} />
          </motion.div>
        ) : null}

        {showWordmark ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: reduceMotion ? 0.01 : 0.42,
              ease: [0.22, 1, 0.36, 1],
              delay: reduceMotion ? 0 : 0.08,
            }}
          >
            <LogoWordmark size={size} variant={wordmarkVariant} className={wordmarkClassName} />
          </motion.div>
        ) : null}
      </motion.div>
    </motion.div>
  );

  return href ? (
    <Link href={href} className="inline-flex max-w-full items-center align-middle">
      {logoContent}
    </Link>
  ) : (
    logoContent
  );
}
