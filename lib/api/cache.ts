export function publicJsonCacheHeaders(input: {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
} = {}) {
  const maxAge = Math.max(0, input.maxAge ?? 0);
  const sMaxAge = Math.max(0, input.sMaxAge ?? 60);
  const staleWhileRevalidate = Math.max(0, input.staleWhileRevalidate ?? 300);

  return {
    'Cache-Control': `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  };
}

