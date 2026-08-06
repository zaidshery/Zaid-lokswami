'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store/appStore';
import { NEWS_CATEGORIES, getNewsCategoryHref } from '@/lib/constants/newsCategories';
import { READER_NAVIGATION, isReaderNavigationActive } from '@/lib/constants/readerNavigation';

const primaryLinks = [
  READER_NAVIGATION.home,
  READER_NAVIGATION.elections,
  READER_NAVIGATION.epaper,
  READER_NAVIGATION.emagazine,
];

const categoryLinks = NEWS_CATEGORIES.map((category) => ({
  name: category.name,
  nameEn: category.nameEn,
  href: getNewsCategoryHref(category.slug),
}));

const utilityLinks = [
  READER_NAVIGATION.search,
  READER_NAVIGATION.contact,
];

const mainLinks = [...primaryLinks, ...categoryLinks, ...utilityLinks];

interface DesktopNavProps {
  className?: string;
}

export default function DesktopNav({ className = '' }: DesktopNavProps) {
  const pathname = usePathname();
  const { language } = useAppStore();

  return (
    <nav className={`flex items-center gap-0 whitespace-nowrap sm:gap-1 md:gap-1.5 ${className}`}>
      {mainLinks.map((link) => {
        const isActive = isReaderNavigationActive(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={`cnp-motion reader-touch-link reader-focus-ring group relative inline-flex min-h-10 items-center rounded-md px-2.5 py-2 text-[12px] font-semibold sm:px-3 sm:text-sm md:min-h-11 md:px-3.5 md:py-2.5 md:text-[15px] ${
              isActive
                ? 'text-red-600 dark:text-red-400'
                : 'text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100'
            }`}
          >
            <motion.span
              className="absolute inset-0 -z-10 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/70"
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />

            <span>{language === 'hi' ? link.name : link.nameEn}</span>

            {isActive ? (
              <motion.span
                layoutId="active-nav-line"
                className="absolute bottom-0.5 left-2 right-2 h-0.5 rounded-full bg-red-600 dark:bg-red-400 md:left-2.5 md:right-2.5"
                transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
