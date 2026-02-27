import { COMPANY_INFO } from '@/lib/constants/company';

type BuildArticleWhatsAppShareInput = {
  title: string;
  articleUrl: string;
  imageUrl?: string;
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
  const lines: string[] = [title.trim()];

  // Keep article URL first so WhatsApp can build the preview card reliably.
  const cleanArticleUrl = cleanUrl(articleUrl);
  lines.push(cleanArticleUrl);
  lines.push('');
  lines.push('Follow Lokswami:');
  lines.push(`Facebook: ${COMPANY_INFO.social.facebook}`);
  lines.push(`Instagram: ${COMPANY_INFO.social.instagram}`);
  lines.push(`YouTube: ${COMPANY_INFO.social.youtube}`);
  lines.push(`X: ${COMPANY_INFO.social.twitter}`);
  lines.push(`WhatsApp Channel: ${COMPANY_INFO.social.whatsapp}`);

  return lines.join('\n');
}

export function buildArticleWhatsAppShareUrl(input: BuildArticleWhatsAppShareInput) {
  const text = buildArticleWhatsAppShareText(input);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
