'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store/appStore';
import { NEWS_CATEGORIES, getNewsCategoryHref } from '@/lib/constants/newsCategories';

const primaryLinks = [
  { name: '\u0939\u094b\u092e', nameEn: 'Home', href: '/main' },
  { name: '\u0908-\u092a\u0947\u092a\u0930', nameEn: 'E-Paper', href: '/main/epaper' },
  { name: '\u0921\u093f\u091c\u093f\u091f\u0932 \u0928\u094d\u092f\u0942\u091c\u0930\u0942\u092e', nameEn: 'Digital Newsroom', href: '/main/digital-newsroom' },
];

const categoryLinks = NEWS_CATEGORIES.map((category) => ({
  name: category.name,
  nameEn: category.nameEn,
  href: getNewsCategoryHref(category.slug),
}));

const utilityLinks = [
  { name: '\u0938\u0902\u092a\u0930\u094d\u0915', nameEn: 'Contact', href: '/main/contact' },
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
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`cnp-motion group relative rounded-md px-2 py-1.5 text-[12px] font-semibold sm:px-3 sm:py-2 sm:text-sm md:px-3.5 md:py-2.5 md:text-[15px] ${
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
