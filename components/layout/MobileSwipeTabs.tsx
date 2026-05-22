'use client';

import { useMemo, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSwipeable, type SwipeEventData } from 'react-swipeable';

export interface MobileSwipeTabRoute {
  path: string;
  name: string;
  type?: 'route' | 'menu';
}

interface MobileSwipeTabsProps {
  children: ReactNode;
  routes: MobileSwipeTabRoute[];
  onMenuSwipe?: () => void;
}

const MOBILE_MEDIA_QUERY = '(max-width: 768px)';
const SWIPE_IGNORE_SELECTOR =
  'input, textarea, select, button, a, summary, details, video, iframe, [role="dialog"], [data-swipe-ignore="true"], [data-reader-card="true"], [data-reader-action="true"], [data-reader-scroll="x"]';

function normalizePath(path: string): string {
  if (!path) return '/';
  const [pathnameOnly] = path.split(/[?#]/);
  if (!pathnameOnly || pathnameOnly === '/') return '/';
  return pathnameOnly.replace(/\/+$/, '') || '/';
}

function getEventTargetElement(target: EventTarget | null): Element | null {
  if (!target) return null;
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function shouldIgnoreSwipeTarget(target: EventTarget | null): boolean {
  const element = getEventTargetElement(target);
  if (!element) return false;
  return Boolean(element.closest(SWIPE_IGNORE_SELECTOR));
}

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function findActiveTabIndex(pathname: string, routes: MobileSwipeTabRoute[]): number {
  const normalizedPathname = normalizePath(pathname);
  let matchedIndex = -1;
  let longestMatchLength = -1;

  routes.forEach((route, index) => {
    const routePath = normalizePath(route.path);
    const isExactMatch = normalizedPathname === routePath;
    const isNestedMatch =
      routePath !== '/' && normalizedPathname.startsWith(`${routePath}/`);

    if ((isExactMatch || isNestedMatch) && routePath.length > longestMatchLength) {
      matchedIndex = index;
      longestMatchLength = routePath.length;
    }
  });

  return matchedIndex;
}

export default function MobileSwipeTabs({
  children,
  routes,
  onMenuSwipe,
}: MobileSwipeTabsProps) {
  const pathname = usePathname();
  const router = useRouter();

  const normalizedRoutes = useMemo(
    () =>
      routes
        .map((route) => ({ ...route, path: normalizePath(route.path) }))
        .filter((route, index, arr) => arr.findIndex((item) => item.path === route.path) === index),
    [routes]
  );

  const navigateBySwipe = (direction: 'next' | 'prev', eventData: SwipeEventData) => {
    if (!isMobileViewport()) return;
    if (shouldIgnoreSwipeTarget(eventData.event.target)) return;
    if (normalizedRoutes.length < 2) return;

    const currentIndex = findActiveTabIndex(pathname, normalizedRoutes);
    if (currentIndex < 0) return;

    const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= normalizedRoutes.length) return;

    const targetTab = normalizedRoutes[targetIndex];
    if (!targetTab) return;

    if (targetTab.type === 'menu') {
      onMenuSwipe?.();
      return;
    }

    const targetPath = targetTab.path;
    if (!targetPath || targetPath === normalizePath(pathname)) return;

    router.push(targetPath);
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: (eventData) => navigateBySwipe('next', eventData),
    onSwipedRight: (eventData) => navigateBySwipe('prev', eventData),
    preventScrollOnSwipe: false,
    trackTouch: true,
    trackMouse: false,
    delta: 42,
    swipeDuration: 500,
  });

  return (
    <div {...swipeHandlers} style={{ touchAction: 'pan-y' }}>
      {children}
    </div>
  );
}
