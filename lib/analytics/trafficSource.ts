export type TrafficChannel =
  | 'organic_search'
  | 'social'
  | 'direct'
  | 'referral'
  | 'campaign'
  | 'internal';

export type TrafficAttribution = {
  channel: TrafficChannel;
  source: string;
  medium: string;
  campaign?: string;
  referrerHost?: string;
  isInitialAcquisition: boolean;
};

const SEARCH_ENGINES = [
  'google.',
  'bing.',
  'yahoo.',
  'duckduckgo.',
  'ecosia.',
  'yandex.',
  'baidu.',
];

const SOCIAL_NETWORKS: Record<string, string> = {
  'facebook.com': 'facebook',
  'fb.me': 'facebook',
  'instagram.com': 'instagram',
  'twitter.com': 'twitter',
  't.co': 'twitter',
  'x.com': 'twitter',
  'whatsapp.com': 'whatsapp',
  'api.whatsapp.com': 'whatsapp',
  'web.whatsapp.com': 'whatsapp',
  'wa.me': 'whatsapp',
  't.me': 'telegram',
  'telegram.org': 'telegram',
  'linkedin.com': 'linkedin',
  'lnkd.in': 'linkedin',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'reddit.com': 'reddit',
  'pinterest.com': 'pinterest',
};

const INTERNAL_HOSTS = ['lokswami.com', 'www.lokswami.com', 'localhost', '127.0.0.1'];

export function parseTrafficSource(input: {
  currentUrl: string;
  referrerUrl?: string | null;
  existingSessionSource?: TrafficAttribution | null;
}): TrafficAttribution {
  // If an acquisition channel is already active in the session, preserve it rather than overwriting with internal navigation
  if (input.existingSessionSource && input.existingSessionSource.channel !== 'internal') {
    return {
      ...input.existingSessionSource,
      isInitialAcquisition: false,
    };
  }

  let searchParams: URLSearchParams;
  try {
    const url = new URL(input.currentUrl, 'https://lokswami.com');
    searchParams = url.searchParams;
  } catch {
    searchParams = new URLSearchParams();
  }

  const utmSource = searchParams.get('utm_source')?.trim().toLowerCase();
  const utmMedium = searchParams.get('utm_medium')?.trim().toLowerCase();
  const utmCampaign = searchParams.get('utm_campaign')?.trim();

  // 1. Explicit UTM Campaign Parameters
  if (utmSource || utmMedium || utmCampaign) {
    let channel: TrafficChannel = 'campaign';
    if (utmMedium === 'social' || utmMedium === 'whatsapp' || utmSource === 'whatsapp' || utmSource === 'facebook') {
      channel = 'social';
    } else if (utmMedium === 'cpc' || utmMedium === 'ppc' || utmMedium === 'paid') {
      channel = 'campaign';
    } else if (utmMedium === 'organic') {
      channel = 'organic_search';
    }

    return {
      channel,
      source: utmSource || 'campaign',
      medium: utmMedium || 'custom',
      ...(utmCampaign ? { campaign: utmCampaign } : {}),
      isInitialAcquisition: true,
    };
  }

  // 2. Referrer Evaluation
  const rawReferrer = input.referrerUrl?.trim();
  if (!rawReferrer) {
    return {
      channel: 'direct',
      source: 'direct',
      medium: 'none',
      isInitialAcquisition: true,
    };
  }

  try {
    const refUrl = new URL(rawReferrer);
    const refHost = refUrl.hostname.toLowerCase();

    // Internal navigation
    if (INTERNAL_HOSTS.some((h) => refHost === h || refHost.endsWith(`.${h}`))) {
      return {
        channel: 'internal',
        source: 'lokswami_internal',
        medium: 'internal_link',
        referrerHost: refHost,
        isInitialAcquisition: false,
      };
    }

    // Search Engine
    if (SEARCH_ENGINES.some((se) => refHost.includes(se))) {
      const engineName = refHost.replace(/^www\./, '').split('.')[0];
      return {
        channel: 'organic_search',
        source: engineName,
        medium: 'organic',
        referrerHost: refHost,
        isInitialAcquisition: true,
      };
    }

    // Social Network
    for (const [domain, network] of Object.entries(SOCIAL_NETWORKS)) {
      if (refHost === domain || refHost.endsWith(`.${domain}`)) {
        return {
          channel: 'social',
          source: network,
          medium: 'social_referral',
          referrerHost: refHost,
          isInitialAcquisition: true,
        };
      }
    }

    // Other External Referral
    return {
      channel: 'referral',
      source: refHost,
      medium: 'referral',
      referrerHost: refHost,
      isInitialAcquisition: true,
    };
  } catch {
    return {
      channel: 'direct',
      source: 'direct',
      medium: 'none',
      isInitialAcquisition: true,
    };
  }
}
