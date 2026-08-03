import { describe, expect, it } from 'vitest';
import {
  READER_NAVIGATION,
  isReaderNavigationActive,
} from '@/lib/constants/readerNavigation';

describe('reader navigation registry', () => {
  it('keeps high-value reader destinations in one canonical registry', () => {
    expect(READER_NAVIGATION.search.href).toBe('/main/search');
    expect(READER_NAVIGATION.epaper.href).toBe('/main/epaper');
    expect(READER_NAVIGATION.emagazine.href).toBe('/main/e-magazine');
    expect(READER_NAVIGATION.elections.href).toBe('/main/elections');
    expect(new Set(Object.values(READER_NAVIGATION).map((item) => item.href)).size).toBe(
      Object.keys(READER_NAVIGATION).length
    );
  });

  it('does not mark Home active on every reader route', () => {
    expect(isReaderNavigationActive('/main', READER_NAVIGATION.home.href)).toBe(true);
    expect(isReaderNavigationActive('/main/search', READER_NAVIGATION.home.href)).toBe(false);
    expect(isReaderNavigationActive('/main/search/results', READER_NAVIGATION.search.href)).toBe(true);
  });
});
