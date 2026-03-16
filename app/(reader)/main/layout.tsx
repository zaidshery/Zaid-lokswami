'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store/appStore';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import MobileMenu from '@/components/layout/MobileMenu';
import Footer from '@/components/layout/Footer';
import AiChatLauncher from '@/components/ai-chat/AiChatLauncher';
import SigninRoleBanner from '@/components/auth/SigninRoleBanner';
import BreakingNews from '@/components/ui/BreakingNews';
import Container from '@/components/layout/Container';
import DailyEpaperAlert from '@/components/ui/DailyEpaperAlert';
import PopupOrchestrator from '@/components/ui/PopupOrchestrator';
import MobileSwipeTabs, {
  type MobileSwipeTabRoute,
} from '@/components/layout/MobileSwipeTabs';

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
    isEpaperReaderOpen,
  } = useAppStore();
  const isVideosRoute = pathname?.startsWith('/main/videos') ?? false;
  const isEpaperRoute = pathname?.startsWith('/main/epaper') ?? false;
  const isReaderImmersiveMode = isEpaperRoute && isEpaperReaderOpen;
  const showBottomNav = (!isImmersiveVideoMode || isVideosRoute) && !isReaderImmersiveMode;


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
      {!isImmersiveVideoMode && !isReaderImmersiveMode ? <BreakingNews /> : null}

      {/* Header (below breaking bar) */}
      {!isImmersiveVideoMode && !isReaderImmersiveMode ? <Header /> : null}

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
              : isReaderImmersiveMode
                ? 'pb-0 pt-0'
                : 'pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+0.5rem)] pt-[7.25rem] sm:pt-[8rem] md:pt-[8.75rem] xl:pb-4'
          }
        >
          {!isImmersiveVideoMode && !isReaderImmersiveMode ? <SigninRoleBanner /> : null}
          <Container
            className={
              isImmersiveVideoMode
                ? 'py-0 !max-w-none !px-0'
                : isReaderImmersiveMode
                  ? 'py-0 !max-w-none !px-0'
                  : 'py-4 md:py-5 !px-3 sm:!px-5 lg:!px-6'
            }
          >
            {children}
          </Container>
        </main>
      </MobileSwipeTabs>

      {/* Footer */}
      {!isImmersiveVideoMode && !isReaderImmersiveMode ? (
        <div className="block">
          <Footer />
        </div>
      ) : null}

      {!isImmersiveVideoMode && !isReaderImmersiveMode ? <DailyEpaperAlert /> : null}
      {!isImmersiveVideoMode && !isReaderImmersiveMode ? <PopupOrchestrator /> : null}
      {!isImmersiveVideoMode && !isReaderImmersiveMode ? <AiChatLauncher /> : null}

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
