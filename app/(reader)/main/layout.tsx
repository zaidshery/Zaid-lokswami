'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store/appStore';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import MobileMenu from '@/components/layout/MobileMenu';
import Footer from '@/components/layout/Footer';
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
  { path: '/main/epaper', name: 'E-Paper' },
  { path: '/main/e-magazine', name: 'E-Magazine' },
  { path: '/main/videos', name: 'Videos' },
  { path: '/main/ftaftaf', name: 'Quick' },
  { path: '/main/menu', name: 'Menu', type: 'menu' },
];

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === '/main/elections') {
    return (
      <Suspense fallback={<MainLayoutContent pathname={pathname} isElectionObsMode={false}>{children}</MainLayoutContent>}>
        <ElectionMainLayout pathname={pathname}>{children}</ElectionMainLayout>
      </Suspense>
    );
  }

  return <MainLayoutContent pathname={pathname} isElectionObsMode={false}>{children}</MainLayoutContent>;
}

function ElectionMainLayout({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const searchParams = useSearchParams();
  return (
    <MainLayoutContent pathname={pathname} isElectionObsMode={searchParams.get('obs') === '1'}>
      {children}
    </MainLayoutContent>
  );
}

function MainLayoutContent({
  children,
  pathname,
  isElectionObsMode,
}: {
  children: React.ReactNode;
  pathname: string;
  isElectionObsMode: boolean;
}) {
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
  const isEpaperRoute =
    pathname?.startsWith('/main/epaper') || pathname?.startsWith('/main/e-magazine') || false;
  const isReaderImmersiveMode = isEpaperRoute && isEpaperReaderOpen;
  const showBottomNav = (!isImmersiveVideoMode || isVideosRoute) && !isReaderImmersiveMode && !isElectionObsMode;


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
    <div className="min-h-screen overflow-x-clip bg-white transition-colors duration-500 dark:bg-slate-950">
      {/* Breaking News Bar (Top) */}
      {!isImmersiveVideoMode && !isReaderImmersiveMode && !isElectionObsMode ? <BreakingNews /> : null}

      {/* Header (below breaking bar) */}
      {!isImmersiveVideoMode && !isReaderImmersiveMode && !isElectionObsMode ? <Header /> : null}

      {/* Mobile Menu Drawer */}
      {!isElectionObsMode ? <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setMobileMenuOpen(false)} /> : null}

      <MobileSwipeTabs
        routes={MOBILE_BOTTOM_TAB_ROUTES}
        onMenuSwipe={() => setMobileMenuOpen(true)}
      >
        <main
          className={
            isElectionObsMode
              ? 'pb-0 pt-0'
              : isImmersiveVideoMode
                ? 'pb-0 pt-0'
                : isReaderImmersiveMode
                  ? 'pb-0 pt-0'
                  : isVideosRoute
                    ? 'pt-[8rem] sm:pt-[8.5rem] md:pt-[9rem] xl:pb-4'
                    : 'reader-bottom-safe-pad pt-[8rem] sm:pt-[8.5rem] md:pt-[9rem] xl:pb-4'
          }
        >
          {!isImmersiveVideoMode && !isReaderImmersiveMode && !isElectionObsMode ? <SigninRoleBanner /> : null}
          <Container
            className={
              isElectionObsMode
                ? 'py-0 !max-w-none !px-0'
                : isImmersiveVideoMode
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
      {!isImmersiveVideoMode && !isReaderImmersiveMode && !isElectionObsMode ? (
        <div className="block">
          <Footer />
        </div>
      ) : null}

      {!isImmersiveVideoMode && !isReaderImmersiveMode && !isElectionObsMode ? <DailyEpaperAlert /> : null}
      {!isImmersiveVideoMode && !isReaderImmersiveMode && !isElectionObsMode ? <PopupOrchestrator /> : null}

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
