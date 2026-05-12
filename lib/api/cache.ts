export type PublicCacheHeaderInput = {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
};

export type CacheHeaders = {
  'Cache-Control': string;
};

function toNonNegativeSeconds(value: number | undefined, fallback: number) {
  const next = Number(value ?? fallback);
  return Number.isFinite(next) ? Math.max(0, Math.floor(next)) : fallback;
}

export function cacheControl(value: string): CacheHeaders {
  return {
    'Cache-Control': value,
  };
}

export function noStore(): CacheHeaders {
  return cacheControl('private, no-store, no-cache, max-age=0, must-revalidate');
}

export function publicJsonCacheHeaders(input: PublicCacheHeaderInput = {}): CacheHeaders {
  const maxAge = Math.max(0, input.maxAge ?? 0);
  const sMaxAge = Math.max(0, input.sMaxAge ?? 60);
  const staleWhileRevalidate = Math.max(0, input.staleWhileRevalidate ?? 300);

  return cacheControl(
    `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`
  );
}

export function staleWhileRevalidate(input: PublicCacheHeaderInput = {}): CacheHeaders {
  return publicJsonCacheHeaders(input);
}

export function shortPublicCache(input: PublicCacheHeaderInput = {}): CacheHeaders {
  return publicJsonCacheHeaders({
    maxAge: toNonNegativeSeconds(input.maxAge, 0),
    sMaxAge: toNonNegativeSeconds(input.sMaxAge, 30),
    staleWhileRevalidate: toNonNegativeSeconds(input.staleWhileRevalidate, 120),
  });
}

export function mediumPublicCache(input: PublicCacheHeaderInput = {}): CacheHeaders {
  return publicJsonCacheHeaders({
    maxAge: toNonNegativeSeconds(input.maxAge, 0),
    sMaxAge: toNonNegativeSeconds(input.sMaxAge, 300),
    staleWhileRevalidate: toNonNegativeSeconds(input.staleWhileRevalidate, 900),
  });
}

export function longPublicCache(input: PublicCacheHeaderInput = {}): CacheHeaders {
  return publicJsonCacheHeaders({
    maxAge: toNonNegativeSeconds(input.maxAge, 0),
    sMaxAge: toNonNegativeSeconds(input.sMaxAge, 3600),
    staleWhileRevalidate: toNonNegativeSeconds(input.staleWhileRevalidate, 86400),
  });
}
