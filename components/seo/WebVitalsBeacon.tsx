'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function getDeviceCategory(): 'mobile' | 'desktop' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  const width = window.innerWidth || 0;
  if (/ipad|tablet/.test(ua) || (width >= 768 && width < 1024)) return 'tablet';
  if (/mobile|android|iphone|ipod/.test(ua) || width < 768) return 'mobile';
  return 'desktop';
}

function sendVitalBeacon(metric: {
  name: string;
  value: number;
  id?: string;
  navigationType?: string;
  path: string;
}) {
  if (typeof window === 'undefined') return;

  const payload = {
    ...metric,
    deviceType: getDeviceCategory(),
  };

  const body = JSON.stringify(payload);
  const endpoint = '/api/v1/public/analytics/vitals';

  if (typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(endpoint, blob);
  } else {
    void fetch(endpoint, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  }
}

export default function WebVitalsBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
      return;
    }

    const reportedMetrics = new Set<string>();

    // Measure FCP and TTFB from navigation entries
    try {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries && navEntries.length > 0) {
        const nav = navEntries[0];
        if (nav.responseStart > 0 && !reportedMetrics.has('TTFB')) {
          reportedMetrics.add('TTFB');
          sendVitalBeacon({
            name: 'TTFB',
            value: nav.responseStart,
            id: `ttfb_${Date.now()}`,
            path: pathname || window.location.pathname,
            navigationType: nav.type,
          });
        }
      }
    } catch {
      // Ignore navigation timing errors
    }

    // Measure Paint entries (FCP)
    try {
      const paintObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (entry.name === 'first-contentful-paint' && !reportedMetrics.has('FCP')) {
            reportedMetrics.add('FCP');
            sendVitalBeacon({
              name: 'FCP',
              value: entry.startTime,
              id: `fcp_${Date.now()}`,
              path: pathname || window.location.pathname,
            });
          }
        }
      });
      paintObserver.observe({ type: 'paint', buffered: true });
    } catch {
      // Paint observer unsupported
    }

    // Measure LCP
    try {
      let largestLcp = 0;
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry && lastEntry.startTime > largestLcp) {
          largestLcp = lastEntry.startTime;
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      const flushLcp = () => {
        if (largestLcp > 0 && !reportedMetrics.has('LCP')) {
          reportedMetrics.add('LCP');
          sendVitalBeacon({
            name: 'LCP',
            value: largestLcp,
            id: `lcp_${Date.now()}`,
            path: pathname || window.location.pathname,
          });
        }
      };

      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushLcp();
      });
      window.addEventListener('pagehide', flushLcp);
    } catch {
      // LCP observer unsupported
    }

    // Measure CLS
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          // Layout shift entries that had no recent user input
          const shiftEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!shiftEntry.hadRecentInput && typeof shiftEntry.value === 'number') {
            clsValue += shiftEntry.value;
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      const flushCls = () => {
        if (clsValue >= 0 && !reportedMetrics.has('CLS')) {
          reportedMetrics.add('CLS');
          sendVitalBeacon({
            name: 'CLS',
            value: clsValue,
            id: `cls_${Date.now()}`,
            path: pathname || window.location.pathname,
          });
        }
      };

      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushCls();
      });
      window.addEventListener('pagehide', flushCls);
    } catch {
      // CLS observer unsupported
    }
  }, [pathname]);

  return null;
}
