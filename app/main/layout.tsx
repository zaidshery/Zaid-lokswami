'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store/appStore';
import Header from '../components/layout/Header';
import BottomNav from '../components/layout/BottomNav';
import MobileMenu from '../components/layout/MobileMenu';
import Footer from '../components/layout/Footer';
import LokswamiAIBot from '../components/ai/LokswamiAIBot';
import BreakingNews from '../components/content/BreakingNews';
import Container from '../components/common/Container';
import DailyEpaperAlert from '../components/notifications/DailyEpaperAlert';
import SmartEngagementPopup from '../components/notifications/SmartEngagementPopup';
import MobileSwipeTabs, {
  type MobileSwipeTabRoute,
} from '../components/layout/MobileSwipeTabs';

const MOBILE_BOTTOM_TAB_ROUTES: MobileSwipeTabRoute[] = [
  { path: '/main', name: 'Home' },
  { path: '/main/videos', name: 'Videos' },
  { path: '/main/epaper', name: 'E-Paper' },
  { path: '/main/ftaftaf', name: 'Quick' },
  { path: '/main/menu', name: 'Menu', type: 'menu' },
  { path: '/main/account', name: 'Account' },
];

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const {
    setIsMobile,
    setIsTablet,
    toggleMobileMenu,
    isMobileMenuOpen,
    setMobileMenuOpen,
    isImmersiveVideoMode,
  } = useAppStore();
  const isVideosRoute = pathname?.startsWith('/main/videos') ?? false;
  const showBottomNav = !isImmersiveVideoMode || isVideosRoute;


  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, [setIsMobile, setIsTablet]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 overflow-x-hidden transition-colors duration-500">
      {/* Breaking News Bar (Top) */}
      {!isImmersiveVideoMode ? <BreakingNews /> : null}

      {/* Header (below breaking bar) */}
      {!isImmersiveVideoMode ? <Header /> : null}

      {/* Mobile Menu Drawer */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <MobileSwipeTabs
        routes={MOBILE_BOTTOM_TAB_ROUTES}
        onMenuSwipe={() => setMobileMenuOpen(true)}
      >
        <main
          className={
            isImmersiveVideoMode
              ? 'pb-0 pt-0'
              : 'pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+0.5rem)] pt-[7.25rem] sm:pt-[8rem] md:pt-[8.75rem] xl:pb-4'
          }
        >
          <Container
            className={
              isImmersiveVideoMode
                ? 'py-0 !max-w-none !px-0'
                : 'py-4 md:py-5 !px-3 sm:!px-5 lg:!px-6'
            }
          >
            {children}
          </Container>
        </main>
      </MobileSwipeTabs>

      {/* Footer */}
      {!isImmersiveVideoMode ? (
        <div className="block">
          <Footer />
        </div>
      ) : null}

      {!isImmersiveVideoMode ? <DailyEpaperAlert /> : null}
      {!isImmersiveVideoMode ? <SmartEngagementPopup /> : null}
      {!isImmersiveVideoMode ? <LokswamiAIBot /> : null}

      {/* Bottom Navigation - Mobile + Tablet (below 1280px) */}
      {showBottomNav ? (
        <BottomNav
          onMenuClick={toggleMobileMenu}
          isMenuOpen={isMobileMenuOpen}
          isOverlayDark={isImmersiveVideoMode && isVideosRoute}
        />
      ) : null}
    </div>
  );
}
