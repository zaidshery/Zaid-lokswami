type BuildArticleWhatsAppShareInput = {
  title: string;
  articleUrl: string;
};

function cleanUrl(value: string) {
  return value.trim();
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function isLocalOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '::1'
    );
  } catch {
    return true;
  }
}

function getPreferredOrigin(origin: string) {
  const runtimeOrigin = trimTrailingSlash(cleanUrl(origin));
  const configured = trimTrailingSlash(cleanUrl(process.env.NEXT_PUBLIC_SITE_URL || ''));

  if (configured && !isLocalOrigin(configured)) return configured;
  return runtimeOrigin;
}

export function toAbsoluteShareUrl(value: string, origin: string) {
  const trimmed = cleanUrl(value);
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const baseOrigin = getPreferredOrigin(origin);
  return `${baseOrigin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

export function buildArticleWhatsAppShareText({
  title,
  articleUrl,
}: BuildArticleWhatsAppShareInput) {
  const lines: string[] = [];
  const cleanTitle = title.trim();
  const cleanArticleUrl = cleanUrl(articleUrl);

  // URL on the first line gives WhatsApp the best chance to create a preview card.
  if (cleanArticleUrl) {
    lines.push(cleanArticleUrl);
    lines.push('');
  }

  if (cleanTitle) lines.push(cleanTitle);
  lines.push('');
  lines.push('Lokswami');

  return lines.join('\n').trim();
}

export function buildArticleWhatsAppShareUrl(input: BuildArticleWhatsAppShareInput) {
  const text = buildArticleWhatsAppShareText(input);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
