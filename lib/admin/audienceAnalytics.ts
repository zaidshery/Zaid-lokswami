import connectDB from '@/lib/db/mongoose';
import AnalyticsEvent from '@/lib/models/AnalyticsEvent';
import { listStoredAnalyticsEvents } from '@/lib/storage/analyticsEventsFile';

type AnalyticsEventSource = {
  _id?: unknown;
  event?: string;
  page?: string;
  source?: string;
  sessionId?: string;
  userAgent?: string;
  metadata?: unknown;
  createdAt?: Date | string;
};

type AudienceEventRecord = {
  event: string;
  page: string;
  source: string;
  sessionId: string;
  userAgent: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type AudienceMetricSnapshot = {
  events: number;
  pageViews: number;
  sessions: number;
  contactStarts: number;
  contactSuccesses: number;
  popupViews: number;
  popupSuccesses: number;
};

export type AudienceTopPage = {
  page: string;
  events: number;
  sessions: number;
  lastSeenAt: string;
};

export type AudienceSourceBreakdown = {
  source: string;
  events: number;
  sessions: number;
};

export type AudienceDeviceBreakdown = {
  device: string;
  events: number;
  sessions: number;
};

export type AudienceChannelBreakdown = {
  channel: string;
  events: number;
  sessions: number;
};

export type AudienceCampaignBreakdown = {
  label: string;
  campaign: string;
  source: string;
  medium: string;
  events: number;
  sessions: number;
};

export type AudienceSectionBreakdown = {
  section: string;
  pageViews: number;
  sessions: number;
};

export type AudienceTimeZoneBreakdown = {
  timeZone: string;
  events: number;
  sessions: number;
};

export type AudienceLanguageBreakdown = {
  language: string;
  events: number;
  sessions: number;
};

export type AudienceCountryBreakdown = {
  country: string;
  events: number;
  sessions: number;
};

export type AudienceSegmentTrend = {
  label: string;
  currentEvents: number;
  previousEvents: number;
  deltaEvents: number;
  currentSessions: number;
  previousSessions: number;
  deltaSessions: number;
};

export type AudienceSegmentConversionBreakdown = {
  label: string;
  sessions: number;
  conversionSessions: number;
  overallConversionRate: number;
  popupViewSessions: number;
  popupConversionSessions: number;
  popupConversionRate: number;
  contactStartSessions: number;
  contactConversionSessions: number;
  contactConversionRate: number;
};

export type AudienceCampaignConversionBreakdown = AudienceSegmentConversionBreakdown & {
  campaign: string;
  source: string;
  medium: string;
};

export type AudienceCampaignLandingBreakdown = {
  label: string;
  campaign: string;
  page: string;
  source: string;
  medium: string;
  section: string;
  pageType: string;
  sessions: number;
  conversionSessions: number;
  overallConversionRate: number;
  popupViewSessions: number;
  popupConversionSessions: number;
  popupConversionRate: number;
  contactStartSessions: number;
  contactConversionSessions: number;
  contactConversionRate: number;
};

export type AudienceSegmentConversionTrend = {
  label: string;
  currentSessions: number;
  previousSessions: number;
  currentConversionSessions: number;
  previousConversionSessions: number;
  deltaConversionSessions: number;
  currentConversionRate: number;
  previousConversionRate: number;
  deltaConversionRate: number;
};

export type AudiencePathConversionBreakdown = {
  label: string;
  channel: string;
  section: string;
  device: string;
  pageType: string;
  sessions: number;
  conversionSessions: number;
  overallConversionRate: number;
  popupViewSessions: number;
  popupConversionSessions: number;
  popupConversionRate: number;
  contactStartSessions: number;
  contactConversionSessions: number;
  contactConversionRate: number;
};

export type AudiencePageTypeBreakdown = {
  pageType: string;
  section: string;
  events: number;
  sessions: number;
};

export type AudienceEventBreakdown = {
  event: string;
  count: number;
};

export type AudienceConversionSnapshot = {
  popupViewToSubmitRate: number;
  contactStartToSubmitRate: number;
  sessionToContactRate: number;
  sessionToPopupRate: number;
};

export type AudienceAnalyticsSummary = {
  source: 'mongodb' | 'file';
  current: {
    metrics: AudienceMetricSnapshot;
    topPages: AudienceTopPage[];
    sourceBreakdown: AudienceSourceBreakdown[];
    deviceBreakdown: AudienceDeviceBreakdown[];
    channelBreakdown: AudienceChannelBreakdown[];
    campaignBreakdown: AudienceCampaignBreakdown[];
    sectionBreakdown: AudienceSectionBreakdown[];
    timeZoneBreakdown: AudienceTimeZoneBreakdown[];
    languageBreakdown: AudienceLanguageBreakdown[];
    countryBreakdown: AudienceCountryBreakdown[];
    sectionTrends: AudienceSegmentTrend[];
    channelTrends: AudienceSegmentTrend[];
    campaignTrends: AudienceSegmentTrend[];
    deviceConversionBreakdown: AudienceSegmentConversionBreakdown[];
    channelConversionBreakdown: AudienceSegmentConversionBreakdown[];
    campaignConversionBreakdown: AudienceCampaignConversionBreakdown[];
    sectionConversionBreakdown: AudienceSegmentConversionBreakdown[];
    deviceConversionTrends: AudienceSegmentConversionTrend[];
    channelConversionTrends: AudienceSegmentConversionTrend[];
    campaignConversionTrends: AudienceSegmentConversionTrend[];
    sectionConversionTrends: AudienceSegmentConversionTrend[];
    campaignLandingLeaders: AudienceCampaignLandingBreakdown[];
    campaignLandingRisks: AudienceCampaignLandingBreakdown[];
    pathConversionLeaders: AudiencePathConversionBreakdown[];
    pathConversionLaggards: AudiencePathConversionBreakdown[];
    pathConversionTrends: AudienceSegmentConversionTrend[];
    pageTypeBreakdown: AudiencePageTypeBreakdown[];
    eventBreakdown: AudienceEventBreakdown[];
    conversion: AudienceConversionSnapshot;
  };
  previous: {
    metrics: AudienceMetricSnapshot;
    conversion: AudienceConversionSnapshot;
  } | null;
  deltas: {
    events: number;
    pageViews: number;
    sessions: number;
    contactSuccesses: number;
    popupSuccesses: number;
  } | null;
};

function normalizeEventLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeMetadata(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  return input as Record<string, unknown>;
}

function normalizeLabel(value: string, fallback: string) {
  return String(value || '').trim() || fallback;
}

function toIsoDate(value: unknown) {
  const parsed =
    value instanceof Date ? value : value ? new Date(String(value)) : new Date(0);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function isWithinRange(value: string, start: Date, end: Date) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return timestamp >= start.getTime() && timestamp <= end.getTime();
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI?.trim()) {
    return true;
  }

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for audience analytics, using file fallback.', error);
    return true;
  }
}

async function loadFromFileStore() {
  const stored = await listStoredAnalyticsEvents();
  return stored.map((event) => ({
    event: event.event,
    page: event.page,
    source: event.source,
    sessionId: event.sessionId,
    userAgent: String(event.userAgent || ''),
    createdAt: event.createdAt,
    metadata: normalizeMetadata(event.metadata),
  }));
}

async function loadFromMongo() {
  await connectDB();
  const docs = (await AnalyticsEvent.find({})
    .select('event page source sessionId userAgent metadata createdAt')
    .sort({ createdAt: -1 })
    .lean()) as AnalyticsEventSource[];

  return docs.map((event) => ({
    event: String(event.event || ''),
    page: String(event.page || ''),
    source: String(event.source || ''),
    sessionId: String(event.sessionId || ''),
    userAgent: String(event.userAgent || ''),
    createdAt: toIsoDate(event.createdAt),
    metadata: normalizeMetadata(event.metadata),
  }));
}

function toAudienceMetrics(events: AudienceEventRecord[]) {
  const uniqueSessions = new Set(events.map((event) => event.sessionId).filter(Boolean));
  return {
    events: events.length,
    pageViews: events.filter((event) => event.event === 'page_view').length,
    sessions: uniqueSessions.size,
    contactStarts: events.filter((event) => event.event === 'contact_form_start').length,
    contactSuccesses: events.filter((event) => event.event === 'contact_submit_success').length,
    popupViews: events.filter((event) => event.event === 'engagement_popup_view').length,
    popupSuccesses: events.filter((event) => event.event === 'engagement_popup_submit_success')
      .length,
  } satisfies AudienceMetricSnapshot;
}

function buildTopPages(events: AudienceEventRecord[]) {
  const pageViewEvents = events.filter((event) => event.event === 'page_view');
  const eventsForRanking = pageViewEvents.length ? pageViewEvents : events;
  const pageMap = new Map<
    string,
    { events: number; sessions: Set<string>; lastSeenAt: string }
  >();

  for (const event of eventsForRanking) {
    const page = String(event.page || '').trim() || '/';
    const current = pageMap.get(page) || {
      events: 0,
      sessions: new Set<string>(),
      lastSeenAt: event.createdAt,
    };
    current.events += 1;
    if (event.sessionId) current.sessions.add(event.sessionId);
    if (new Date(event.createdAt).getTime() > new Date(current.lastSeenAt).getTime()) {
      current.lastSeenAt = event.createdAt;
    }
    pageMap.set(page, current);
  }

  return Array.from(pageMap.entries())
    .map(([page, value]) => ({
      page,
      events: value.events,
      sessions: value.sessions.size,
      lastSeenAt: value.lastSeenAt,
    }))
    .sort((left, right) => right.events - left.events)
    .slice(0, 8);
}

function buildSourceBreakdown(events: AudienceEventRecord[]) {
  const sourceMap = new Map<string, { events: number; sessions: Set<string> }>();

  for (const event of events) {
    const source = String(event.source || 'web').trim() || 'web';
    const current = sourceMap.get(source) || { events: 0, sessions: new Set<string>() };
    current.events += 1;
    if (event.sessionId) current.sessions.add(event.sessionId);
    sourceMap.set(source, current);
  }

  return Array.from(sourceMap.entries())
    .map(([source, value]) => ({
      source,
      events: value.events,
      sessions: value.sessions.size,
    }))
    .sort((left, right) => right.events - left.events)
    .slice(0, 8);
}

export function classifyAudienceDeviceCategory(
  event: Pick<AudienceEventRecord, 'userAgent' | 'metadata'>
) {
  const metadataDevice = String(event.metadata.deviceCategory || '').trim().toLowerCase();
  if (metadataDevice === 'mobile' || metadataDevice === 'tablet' || metadataDevice === 'desktop') {
    return metadataDevice;
  }

  const userAgent = String(event.userAgent || '').toLowerCase();
  if (/ipad|tablet/.test(userAgent)) return 'tablet';
  if (/mobi|android|iphone/.test(userAgent)) return 'mobile';
  return userAgent ? 'desktop' : 'unknown';
}

export function classifyAudienceChannel(event: Pick<AudienceEventRecord, 'metadata'>) {
  const referrerCategory = String(event.metadata.referrerCategory || '').trim().toLowerCase();

  if (
    referrerCategory === 'search' ||
    referrerCategory === 'social' ||
    referrerCategory === 'messaging' ||
    referrerCategory === 'referral' ||
    referrerCategory === 'internal'
  ) {
    return referrerCategory;
  }

  return 'direct';
}

export function classifyAudienceCampaignMeta(event: Pick<AudienceEventRecord, 'metadata'>) {
  const rawCampaign = String(
    event.metadata.utmCampaign || event.metadata.utm_campaign || ''
  ).trim();
  const rawSource = String(
    event.metadata.utmSource || event.metadata.utm_source || ''
  ).trim();
  const rawMedium = String(
    event.metadata.utmMedium || event.metadata.utm_medium || ''
  ).trim();

  const campaign = rawCampaign ? normalizeEventLabel(rawCampaign.toLowerCase()) : 'No Campaign';
  const source = rawSource ? normalizeEventLabel(rawSource.toLowerCase()) : 'Unknown';
  const medium = rawMedium ? normalizeEventLabel(rawMedium.toLowerCase()) : 'Unknown';
  const label =
    source === 'Unknown' && medium === 'Unknown'
      ? campaign
      : `${campaign} (${source} / ${medium})`;

  return {
    label,
    campaign,
    source,
    medium,
  };
}

export function classifyAudienceTimeZone(event: Pick<AudienceEventRecord, 'metadata'>) {
  const raw = String(event.metadata.browserTimeZone || '').trim();
  if (!raw) return 'Unknown';
  return raw.replace(/\//g, ' / ');
}

export function classifyAudienceLanguage(event: Pick<AudienceEventRecord, 'metadata'>) {
  const raw = String(event.metadata.browserLanguage || '').trim();
  if (!raw) return 'Unknown';
  const normalized = raw.split(',')[0]?.trim() || raw;
  return normalized.toLowerCase();
}

export function classifyAudienceCountry(event: Pick<AudienceEventRecord, 'metadata'>) {
  const raw = String(event.metadata.countryCode || '').trim().toUpperCase();
  return raw || 'Unknown';
}

function buildDeviceBreakdown(events: AudienceEventRecord[]) {
  const pageViewEvents = events.filter((event) => event.event === 'page_view');
  const records = pageViewEvents.length ? pageViewEvents : events;
  const deviceMap = new Map<string, { events: number; sessions: Set<string> }>();

  for (const event of records) {
    const device = classifyAudienceDeviceCategory(event);
    const current = deviceMap.get(device) || { events: 0, sessions: new Set<string>() };
    current.events += 1;
    if (event.sessionId) current.sessions.add(event.sessionId);
    deviceMap.set(device, current);
  }

  return Array.from(deviceMap.entries())
    .map(([device, value]) => ({
      device: normalizeEventLabel(device),
      events: value.events,
      sessions: value.sessions.size,
    }))
    .sort((left, right) => right.events - left.events)
    .slice(0, 6);
}

function buildChannelBreakdown(events: AudienceEventRecord[]) {
  const pageViewEvents = events.filter((event) => event.event === 'page_view');
  const records = pageViewEvents.length ? pageViewEvents : events;
  const channelMap = new Map<string, { events: number; sessions: Set<string> }>();

  for (const event of records) {
    const channel = classifyAudienceChannel(event);
    const current = channelMap.get(channel) || { events: 0, sessions: new Set<string>() };
    current.events += 1;
    if (event.sessionId) current.sessions.add(event.sessionId);
    channelMap.set(channel, current);
  }

  return Array.from(channelMap.entries())
    .map(([channel, value]) => ({
      channel: normalizeEventLabel(channel),
      events: value.events,
      sessions: value.sessions.size,
    }))
    .sort((left, right) => right.events - left.events)
    .slice(0, 6);
}

function buildCampaignBreakdown(events: AudienceEventRecord[]) {
  const pageViewEvents = events.filter((event) => event.event === 'page_view');
  const records = pageViewEvents.length ? pageViewEvents : events;
  const campaignMap = new Map<
    string,
    AudienceCampaignBreakdown & { sessionsSet: Set<string> }
  >();

  for (const event of records) {
    const campaignMeta = classifyAudienceCampaignMeta(event);
    const key = `${campaignMeta.campaign}::${campaignMeta.source}::${campaignMeta.medium}`;
    const current = campaignMap.get(key) || {
      label: campaignMeta.label,
      campaign: campaignMeta.campaign,
      source: campaignMeta.source,
      medium: campaignMeta.medium,
      events: 0,
      sessions: 0,
      sessionsSet: new Set<string>(),
    };
    current.events += 1;
    if (event.sessionId) current.sessionsSet.add(event.sessionId);
    current.sessions = current.sessionsSet.size;
    campaignMap.set(key, current);
  }

  return Array.from(campaignMap.values())
    .map((value) => ({
      label: value.label,
      campaign: value.campaign,
      source: value.source,
      medium: value.medium,
      events: value.events,
      sessions: value.sessions,
    }))
    .sort((left, right) => right.events - left.events)
    .slice(0, 8);
}

function buildSectionBreakdown(events: AudienceEventRecord[]) {
  const pageViewEvents = events.filter((event) => event.event === 'page_view');
  const sectionMap = new Map<string, { pageViews: number; sessions: Set<string> }>();

  for (const event of pageViewEvents) {
    const section = normalizeLabel(String(event.metadata.section || ''), 'general');
    const current = sectionMap.get(section) || { pageViews: 0, sessions: new Set<string>() };
    current.pageViews += 1;
    if (event.sessionId) current.sessions.add(event.sessionId);
    sectionMap.set(section, current);
  }

  return Array.from(sectionMap.entries())
    .map(([section, value]) => ({
      section: normalizeEventLabel(section),
      pageViews: value.pageViews,
      sessions: value.sessions.size,
    }))
    .sort((left, right) => right.pageViews - left.pageViews)
    .slice(0, 8);
}

function buildTimeZoneBreakdown(events: AudienceEventRecord[]) {
  const pageViewEvents = events.filter((event) => event.event === 'page_view');
  const records = pageViewEvents.length ? pageViewEvents : events;
  const timeZoneMap = new Map<string, { events: number; sessions: Set<string> }>();

  for (const event of records) {
    const timeZone = classifyAudienceTimeZone(event);
    const current = timeZoneMap.get(timeZone) || { events: 0, sessions: new Set<string>() };
    current.events += 1;
    if (event.sessionId) current.sessions.add(event.sessionId);
    timeZoneMap.set(timeZone, current);
  }

  return Array.from(timeZoneMap.entries())
    .map(([timeZone, value]) => ({
      timeZone,
      events: value.events,
      sessions: value.sessions.size,
    }))
    .sort((left, right) => right.events - left.events)
    .slice(0, 8);
}

function buildLanguageBreakdown(events: AudienceEventRecord[]) {
  const pageViewEvents = events.filter((event) => event.event === 'page_view');
  const records = pageViewEvents.length ? pageViewEvents : events;
  const languageMap = new Map<string, { events: number; sessions: Set<string> }>();

  for (const event of records) {
    const language = classifyAudienceLanguage(event);
    const current = languageMap.get(language) || { events: 0, sessions: new Set<string>() };
    current.events += 1;
    if (event.sessionId) current.sessions.add(event.sessionId);
    languageMap.set(language, current);
  }

  return Array.from(languageMap.entries())
    .map(([language, value]) => ({
      language,
      events: value.events,
      sessions: value.sessions.size,
    }))
    .sort((left, right) => right.events - left.events)
    .slice(0, 8);
}

function buildCountryBreakdown(events: AudienceEventRecord[]) {
  const pageViewEvents = events.filter((event) => event.event === 'page_view');
  const records = pageViewEvents.length ? pageViewEvents : events;
  const countryMap = new Map<string, { events: number; sessions: Set<string> }>();

  for (const event of records) {
    const country = classifyAudienceCountry(event);
    const current = countryMap.get(country) || { events: 0, sessions: new Set<string>() };
    current.events += 1;
    if (event.sessionId) current.sessions.add(event.sessionId);
    countryMap.set(country, current);
  }

  return Array.from(countryMap.entries())
    .map(([country, value]) => ({
      country,
      events: value.events,
      sessions: value.sessions.size,
    }))
    .sort((left, right) => right.events - left.events)
    .slice(0, 8);
}

type TrendRow = {
  label: string;
  events: number;
  sessions: number;
};

type ConversionTrendRow = {
  label: string;
  sessions: number;
  conversionSessions: number;
  conversionRate: number;
};

type SessionSegmentSummary = {
  label: string;
  sessions: number;
  conversionSessions: number;
  popupViewSessions: number;
  popupConversionSessions: number;
  contactStartSessions: number;
  contactConversionSessions: number;
};

type PathSessionSegmentSummary = SessionSegmentSummary & {
  channel: string;
  section: string;
  device: string;
  pageType: string;
};

export function buildAudienceSegmentTrends(
  currentRows: TrendRow[],
  previousRows: TrendRow[],
  limit = 6
) {
  const labels = new Set<string>();
  for (const row of currentRows) labels.add(row.label);
  for (const row of previousRows) labels.add(row.label);

  return Array.from(labels)
    .map((label) => {
      const current = currentRows.find((row) => row.label === label) || {
        label,
        events: 0,
        sessions: 0,
      };
      const previous = previousRows.find((row) => row.label === label) || {
        label,
        events: 0,
        sessions: 0,
      };

      return {
        label,
        currentEvents: current.events,
        previousEvents: previous.events,
        deltaEvents: current.events - previous.events,
        currentSessions: current.sessions,
        previousSessions: previous.sessions,
        deltaSessions: current.sessions - previous.sessions,
      } satisfies AudienceSegmentTrend;
    })
    .sort((left, right) => {
      if (right.deltaEvents !== left.deltaEvents) {
        return right.deltaEvents - left.deltaEvents;
      }
      return right.currentEvents - left.currentEvents;
    })
    .slice(0, limit);
}

export function buildAudienceConversionSegmentBreakdown(
  events: AudienceEventRecord[],
  classifyLabel: (event: AudienceEventRecord) => string,
  limit = 6
) {
  const sessionEventMap = new Map<string, AudienceEventRecord[]>();

  for (const event of events) {
    if (!event.sessionId) continue;
    const current = sessionEventMap.get(event.sessionId) || [];
    current.push(event);
    sessionEventMap.set(event.sessionId, current);
  }

  const segmentMap = new Map<string, SessionSegmentSummary>();

  for (const sessionEvents of sessionEventMap.values()) {
    const ordered = [...sessionEvents].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
    const entryEvent =
      ordered.find((event) => event.event === 'page_view') ||
      ordered.find((event) => event.metadata && Object.keys(event.metadata).length > 0) ||
      ordered[0];
    if (!entryEvent) continue;

    const label = String(classifyLabel(entryEvent) || '').trim() || 'Unknown';
    const hasPopupView = ordered.some((event) => event.event === 'engagement_popup_view');
    const hasPopupSuccess = ordered.some(
      (event) => event.event === 'engagement_popup_submit_success'
    );
    const hasContactStart = ordered.some((event) => event.event === 'contact_form_start');
    const hasContactSuccess = ordered.some(
      (event) => event.event === 'contact_submit_success'
    );

    const current = segmentMap.get(label) || {
      label,
      sessions: 0,
      conversionSessions: 0,
      popupViewSessions: 0,
      popupConversionSessions: 0,
      contactStartSessions: 0,
      contactConversionSessions: 0,
    };

    current.sessions += 1;
    if (hasPopupView) current.popupViewSessions += 1;
    if (hasPopupSuccess) current.popupConversionSessions += 1;
    if (hasContactStart) current.contactStartSessions += 1;
    if (hasContactSuccess) current.contactConversionSessions += 1;
    if (hasPopupSuccess || hasContactSuccess) current.conversionSessions += 1;
    segmentMap.set(label, current);
  }

  return Array.from(segmentMap.values())
    .map((row) => ({
      label: row.label,
      sessions: row.sessions,
      conversionSessions: row.conversionSessions,
      overallConversionRate: calculateRate(row.conversionSessions, row.sessions),
      popupViewSessions: row.popupViewSessions,
      popupConversionSessions: row.popupConversionSessions,
      popupConversionRate: calculateRate(row.popupConversionSessions, row.popupViewSessions),
      contactStartSessions: row.contactStartSessions,
      contactConversionSessions: row.contactConversionSessions,
      contactConversionRate: calculateRate(
        row.contactConversionSessions,
        row.contactStartSessions
      ),
    }))
    .sort((left, right) => {
      if (right.overallConversionRate !== left.overallConversionRate) {
        return right.overallConversionRate - left.overallConversionRate;
      }
      if (right.conversionSessions !== left.conversionSessions) {
        return right.conversionSessions - left.conversionSessions;
      }
      return right.sessions - left.sessions;
    })
    .slice(0, limit);
}

function buildAudienceCampaignConversionBreakdown(
  events: AudienceEventRecord[],
  limit = 6
) {
  const sessionEventMap = new Map<string, AudienceEventRecord[]>();

  for (const event of events) {
    if (!event.sessionId) continue;
    const current = sessionEventMap.get(event.sessionId) || [];
    current.push(event);
    sessionEventMap.set(event.sessionId, current);
  }

  const segmentMap = new Map<string, AudienceCampaignConversionBreakdown>();

  for (const sessionEvents of sessionEventMap.values()) {
    const ordered = [...sessionEvents].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
    const entryEvent =
      ordered.find((event) => event.event === 'page_view') ||
      ordered.find((event) => event.metadata && Object.keys(event.metadata).length > 0) ||
      ordered[0];
    if (!entryEvent) continue;

    const campaignMeta = classifyAudienceCampaignMeta(entryEvent);
    const key = `${campaignMeta.campaign}::${campaignMeta.source}::${campaignMeta.medium}`;
    const hasPopupView = ordered.some((event) => event.event === 'engagement_popup_view');
    const hasPopupSuccess = ordered.some(
      (event) => event.event === 'engagement_popup_submit_success'
    );
    const hasContactStart = ordered.some((event) => event.event === 'contact_form_start');
    const hasContactSuccess = ordered.some(
      (event) => event.event === 'contact_submit_success'
    );

    const current = segmentMap.get(key) || {
      label: campaignMeta.label,
      campaign: campaignMeta.campaign,
      source: campaignMeta.source,
      medium: campaignMeta.medium,
      sessions: 0,
      conversionSessions: 0,
      popupViewSessions: 0,
      popupConversionSessions: 0,
      contactStartSessions: 0,
      contactConversionSessions: 0,
      overallConversionRate: 0,
      popupConversionRate: 0,
      contactConversionRate: 0,
    };

    current.sessions += 1;
    if (hasPopupView) current.popupViewSessions += 1;
    if (hasPopupSuccess) current.popupConversionSessions += 1;
    if (hasContactStart) current.contactStartSessions += 1;
    if (hasContactSuccess) current.contactConversionSessions += 1;
    if (hasPopupSuccess || hasContactSuccess) current.conversionSessions += 1;
    segmentMap.set(key, current);
  }

  return Array.from(segmentMap.values())
    .map((row) => ({
      ...row,
      overallConversionRate: calculateRate(row.conversionSessions, row.sessions),
      popupConversionRate: calculateRate(row.popupConversionSessions, row.popupViewSessions),
      contactConversionRate: calculateRate(
        row.contactConversionSessions,
        row.contactStartSessions
      ),
    }))
    .sort((left, right) => {
      if (right.overallConversionRate !== left.overallConversionRate) {
        return right.overallConversionRate - left.overallConversionRate;
      }
      if (right.conversionSessions !== left.conversionSessions) {
        return right.conversionSessions - left.conversionSessions;
      }
      return right.sessions - left.sessions;
    })
    .slice(0, limit);
}

export function buildAudienceCampaignLandingBreakdown(
  events: AudienceEventRecord[],
  limit = 6,
  sortOrder: 'best' | 'worst' = 'best'
) {
  const sessionEventMap = new Map<string, AudienceEventRecord[]>();

  for (const event of events) {
    if (!event.sessionId) continue;
    const current = sessionEventMap.get(event.sessionId) || [];
    current.push(event);
    sessionEventMap.set(event.sessionId, current);
  }

  const landingMap = new Map<string, AudienceCampaignLandingBreakdown>();

  for (const sessionEvents of sessionEventMap.values()) {
    const ordered = [...sessionEvents].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
    const entryEvent =
      ordered.find((event) => event.event === 'page_view') ||
      ordered.find((event) => event.metadata && Object.keys(event.metadata).length > 0) ||
      ordered[0];
    if (!entryEvent) continue;

    const campaignMeta = classifyAudienceCampaignMeta(entryEvent);
    if (campaignMeta.campaign === 'No Campaign') continue;

    const landingPage = normalizeLabel(String(entryEvent.page || ''), '/');
    const section = normalizeEventLabel(
      normalizeLabel(String(entryEvent.metadata.section || ''), 'general')
    );
    const pageType = normalizeEventLabel(
      normalizeLabel(String(entryEvent.metadata.pageType || ''), 'unknown')
    );
    const key = `${campaignMeta.label}::${landingPage}`;
    const hasPopupView = ordered.some((event) => event.event === 'engagement_popup_view');
    const hasPopupSuccess = ordered.some(
      (event) => event.event === 'engagement_popup_submit_success'
    );
    const hasContactStart = ordered.some((event) => event.event === 'contact_form_start');
    const hasContactSuccess = ordered.some(
      (event) => event.event === 'contact_submit_success'
    );

    const current = landingMap.get(key) || {
      label: `${campaignMeta.campaign} -> ${landingPage}`,
      campaign: campaignMeta.campaign,
      page: landingPage,
      source: campaignMeta.source,
      medium: campaignMeta.medium,
      section,
      pageType,
      sessions: 0,
      conversionSessions: 0,
      overallConversionRate: 0,
      popupViewSessions: 0,
      popupConversionSessions: 0,
      popupConversionRate: 0,
      contactStartSessions: 0,
      contactConversionSessions: 0,
      contactConversionRate: 0,
    };

    current.sessions += 1;
    if (hasPopupView) current.popupViewSessions += 1;
    if (hasPopupSuccess) current.popupConversionSessions += 1;
    if (hasContactStart) current.contactStartSessions += 1;
    if (hasContactSuccess) current.contactConversionSessions += 1;
    if (hasPopupSuccess || hasContactSuccess) current.conversionSessions += 1;
    landingMap.set(key, current);
  }

  return Array.from(landingMap.values())
    .map((row) => ({
      ...row,
      overallConversionRate: calculateRate(row.conversionSessions, row.sessions),
      popupConversionRate: calculateRate(row.popupConversionSessions, row.popupViewSessions),
      contactConversionRate: calculateRate(
        row.contactConversionSessions,
        row.contactStartSessions
      ),
    }))
    .sort((left, right) => {
      if (sortOrder === 'worst') {
        if (left.overallConversionRate !== right.overallConversionRate) {
          return left.overallConversionRate - right.overallConversionRate;
        }
        if (right.sessions !== left.sessions) {
          return right.sessions - left.sessions;
        }
        return left.label.localeCompare(right.label);
      }

      if (right.overallConversionRate !== left.overallConversionRate) {
        return right.overallConversionRate - left.overallConversionRate;
      }
      if (right.conversionSessions !== left.conversionSessions) {
        return right.conversionSessions - left.conversionSessions;
      }
      return right.sessions - left.sessions;
    })
    .slice(0, limit);
}

export function buildAudiencePathConversionBreakdown(
  events: AudienceEventRecord[],
  limit = 6,
  sortOrder: 'best' | 'worst' = 'best'
) {
  const sessionEventMap = new Map<string, AudienceEventRecord[]>();

  for (const event of events) {
    if (!event.sessionId) continue;
    const current = sessionEventMap.get(event.sessionId) || [];
    current.push(event);
    sessionEventMap.set(event.sessionId, current);
  }

  const pathMap = new Map<string, PathSessionSegmentSummary>();

  for (const sessionEvents of sessionEventMap.values()) {
    const ordered = [...sessionEvents].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
    const entryEvent =
      ordered.find((event) => event.event === 'page_view') ||
      ordered.find((event) => event.metadata && Object.keys(event.metadata).length > 0) ||
      ordered[0];
    if (!entryEvent) continue;

    const channel = normalizeEventLabel(classifyAudienceChannel(entryEvent));
    const section = normalizeEventLabel(
      normalizeLabel(String(entryEvent.metadata.section || ''), 'general')
    );
    const device = normalizeEventLabel(classifyAudienceDeviceCategory(entryEvent));
    const pageType = normalizeEventLabel(
      normalizeLabel(String(entryEvent.metadata.pageType || ''), 'unknown')
    );
    const label = `${channel} -> ${section}`;
    const hasPopupView = ordered.some((event) => event.event === 'engagement_popup_view');
    const hasPopupSuccess = ordered.some(
      (event) => event.event === 'engagement_popup_submit_success'
    );
    const hasContactStart = ordered.some((event) => event.event === 'contact_form_start');
    const hasContactSuccess = ordered.some(
      (event) => event.event === 'contact_submit_success'
    );

    const current = pathMap.get(label) || {
      label,
      channel,
      section,
      device,
      pageType,
      sessions: 0,
      conversionSessions: 0,
      popupViewSessions: 0,
      popupConversionSessions: 0,
      contactStartSessions: 0,
      contactConversionSessions: 0,
    };

    current.sessions += 1;
    if (hasPopupView) current.popupViewSessions += 1;
    if (hasPopupSuccess) current.popupConversionSessions += 1;
    if (hasContactStart) current.contactStartSessions += 1;
    if (hasContactSuccess) current.contactConversionSessions += 1;
    if (hasPopupSuccess || hasContactSuccess) current.conversionSessions += 1;
    pathMap.set(label, current);
  }

  const rows = Array.from(pathMap.values()).map((row) => ({
    label: row.label,
    channel: row.channel,
    section: row.section,
    device: row.device,
    pageType: row.pageType,
    sessions: row.sessions,
    conversionSessions: row.conversionSessions,
    overallConversionRate: calculateRate(row.conversionSessions, row.sessions),
    popupViewSessions: row.popupViewSessions,
    popupConversionSessions: row.popupConversionSessions,
    popupConversionRate: calculateRate(row.popupConversionSessions, row.popupViewSessions),
    contactStartSessions: row.contactStartSessions,
    contactConversionSessions: row.contactConversionSessions,
    contactConversionRate: calculateRate(
      row.contactConversionSessions,
      row.contactStartSessions
    ),
  }));

  return rows
    .sort((left, right) => {
      if (sortOrder === 'worst') {
        if (left.overallConversionRate !== right.overallConversionRate) {
          return left.overallConversionRate - right.overallConversionRate;
        }
        if (right.sessions !== left.sessions) {
          return right.sessions - left.sessions;
        }
        return left.label.localeCompare(right.label);
      }

      if (right.overallConversionRate !== left.overallConversionRate) {
        return right.overallConversionRate - left.overallConversionRate;
      }
      if (right.conversionSessions !== left.conversionSessions) {
        return right.conversionSessions - left.conversionSessions;
      }
      return right.sessions - left.sessions;
    })
    .slice(0, limit);
}

export function buildAudienceConversionTrends(
  currentRows: ConversionTrendRow[],
  previousRows: ConversionTrendRow[],
  limit = 6
) {
  const labels = new Set<string>();
  for (const row of currentRows) labels.add(row.label);
  for (const row of previousRows) labels.add(row.label);

  return Array.from(labels)
    .map((label) => {
      const current = currentRows.find((row) => row.label === label) || {
        label,
        sessions: 0,
        conversionSessions: 0,
        conversionRate: 0,
      };
      const previous = previousRows.find((row) => row.label === label) || {
        label,
        sessions: 0,
        conversionSessions: 0,
        conversionRate: 0,
      };

      return {
        label,
        currentSessions: current.sessions,
        previousSessions: previous.sessions,
        currentConversionSessions: current.conversionSessions,
        previousConversionSessions: previous.conversionSessions,
        deltaConversionSessions:
          current.conversionSessions - previous.conversionSessions,
        currentConversionRate: current.conversionRate,
        previousConversionRate: previous.conversionRate,
        deltaConversionRate:
          Math.round((current.conversionRate - previous.conversionRate) * 10) / 10,
      } satisfies AudienceSegmentConversionTrend;
    })
    .sort((left, right) => {
      if (right.currentConversionRate !== left.currentConversionRate) {
        return right.currentConversionRate - left.currentConversionRate;
      }
      if (right.deltaConversionRate !== left.deltaConversionRate) {
        return right.deltaConversionRate - left.deltaConversionRate;
      }
      return right.currentConversionSessions - left.currentConversionSessions;
    })
    .slice(0, limit);
}

function buildPageTypeBreakdown(events: AudienceEventRecord[]) {
  const pageViewEvents = events.filter((event) => event.event === 'page_view');
  const breakdownMap = new Map<
    string,
    { pageType: string; section: string; events: number; sessions: Set<string> }
  >();

  for (const event of pageViewEvents) {
    const pageType = String(event.metadata.pageType || 'unknown').trim() || 'unknown';
    const section = String(event.metadata.section || 'general').trim() || 'general';
    const key = `${pageType}::${section}`;
    const current = breakdownMap.get(key) || {
      pageType,
      section,
      events: 0,
      sessions: new Set<string>(),
    };
    current.events += 1;
    if (event.sessionId) current.sessions.add(event.sessionId);
    breakdownMap.set(key, current);
  }

  return Array.from(breakdownMap.values())
    .map((value) => ({
      pageType: normalizeEventLabel(value.pageType),
      section: normalizeEventLabel(value.section),
      events: value.events,
      sessions: value.sessions.size,
    }))
    .sort((left, right) => right.events - left.events)
    .slice(0, 8);
}

function buildEventBreakdown(events: AudienceEventRecord[]) {
  const eventMap = new Map<string, number>();
  for (const event of events) {
    const label = normalizeEventLabel(String(event.event || 'unknown'));
    eventMap.set(label, Number(eventMap.get(label) || 0) + 1);
  }

  return Array.from(eventMap.entries())
    .map(([event, count]) => ({ event, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);
}

function calculateRate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function buildConversionSnapshot(metrics: AudienceMetricSnapshot): AudienceConversionSnapshot {
  return {
    popupViewToSubmitRate: calculateRate(metrics.popupSuccesses, metrics.popupViews),
    contactStartToSubmitRate: calculateRate(metrics.contactSuccesses, metrics.contactStarts),
    sessionToContactRate: calculateRate(metrics.contactSuccesses, metrics.sessions),
    sessionToPopupRate: calculateRate(metrics.popupViews, metrics.sessions),
  };
}

export async function getAudienceAnalyticsSummary(args: {
  start: Date;
  end: Date;
  previousStart?: Date | null;
  previousEnd?: Date | null;
}): Promise<AudienceAnalyticsSummary> {
  const useFileStore = await shouldUseFileStore();
  const source: 'mongodb' | 'file' = useFileStore ? 'file' : 'mongodb';
  const allEvents = useFileStore ? await loadFromFileStore() : await loadFromMongo();

  const currentEvents = allEvents.filter((event) =>
    isWithinRange(event.createdAt, args.start, args.end)
  );

  const previousEvents =
    args.previousStart && args.previousEnd
      ? allEvents.filter((event) => isWithinRange(event.createdAt, args.previousStart!, args.previousEnd!))
      : null;

  const currentMetrics = toAudienceMetrics(currentEvents);
  const previousMetrics = previousEvents ? toAudienceMetrics(previousEvents) : null;
  const currentConversion = buildConversionSnapshot(currentMetrics);
  const previousConversion = previousMetrics ? buildConversionSnapshot(previousMetrics) : null;
  const currentSectionBreakdown = buildSectionBreakdown(currentEvents);
  const previousSectionBreakdown = previousEvents ? buildSectionBreakdown(previousEvents) : [];
  const currentChannelBreakdown = buildChannelBreakdown(currentEvents);
  const previousChannelBreakdown = previousEvents ? buildChannelBreakdown(previousEvents) : [];
  const currentCampaignBreakdown = buildCampaignBreakdown(currentEvents);
  const previousCampaignBreakdown = previousEvents ? buildCampaignBreakdown(previousEvents) : [];
  const currentDeviceConversionBreakdown = buildAudienceConversionSegmentBreakdown(
    currentEvents,
    (event) => normalizeEventLabel(classifyAudienceDeviceCategory(event))
  );
  const previousDeviceConversionBreakdown = previousEvents
    ? buildAudienceConversionSegmentBreakdown(previousEvents, (event) =>
        normalizeEventLabel(classifyAudienceDeviceCategory(event))
      )
    : [];
  const currentChannelConversionBreakdown = buildAudienceConversionSegmentBreakdown(
    currentEvents,
    (event) => normalizeEventLabel(classifyAudienceChannel(event))
  );
  const previousChannelConversionBreakdown = previousEvents
    ? buildAudienceConversionSegmentBreakdown(previousEvents, (event) =>
        normalizeEventLabel(classifyAudienceChannel(event))
      )
    : [];
  const currentSectionConversionBreakdown = buildAudienceConversionSegmentBreakdown(
    currentEvents,
    (event) =>
      normalizeEventLabel(normalizeLabel(String(event.metadata.section || ''), 'general'))
  );
  const previousSectionConversionBreakdown = previousEvents
    ? buildAudienceConversionSegmentBreakdown(previousEvents, (event) =>
        normalizeEventLabel(normalizeLabel(String(event.metadata.section || ''), 'general'))
      )
    : [];
  const currentCampaignConversionBreakdown = buildAudienceCampaignConversionBreakdown(
    currentEvents,
    8
  );
  const previousCampaignConversionBreakdown = previousEvents
    ? buildAudienceCampaignConversionBreakdown(previousEvents, 8)
    : [];
  const currentCampaignLandingLeaders = buildAudienceCampaignLandingBreakdown(
    currentEvents,
    6,
    'best'
  );
  const currentCampaignLandingRisks = buildAudienceCampaignLandingBreakdown(
    currentEvents,
    6,
    'worst'
  );
  const currentPathConversionBreakdown = buildAudiencePathConversionBreakdown(
    currentEvents,
    8,
    'best'
  );
  const previousPathConversionBreakdown = previousEvents
    ? buildAudiencePathConversionBreakdown(previousEvents, 16, 'best')
    : [];
  const currentPathConversionLaggards = buildAudiencePathConversionBreakdown(
    currentEvents,
    8,
    'worst'
  );

  return {
    source,
    current: {
      metrics: currentMetrics,
      topPages: buildTopPages(currentEvents),
      sourceBreakdown: buildSourceBreakdown(currentEvents),
      deviceBreakdown: buildDeviceBreakdown(currentEvents),
      channelBreakdown: currentChannelBreakdown,
      campaignBreakdown: currentCampaignBreakdown,
      sectionBreakdown: currentSectionBreakdown,
      timeZoneBreakdown: buildTimeZoneBreakdown(currentEvents),
      languageBreakdown: buildLanguageBreakdown(currentEvents),
      countryBreakdown: buildCountryBreakdown(currentEvents),
      sectionTrends: buildAudienceSegmentTrends(
        currentSectionBreakdown.map((row) => ({
          label: row.section,
          events: row.pageViews,
          sessions: row.sessions,
        })),
        previousSectionBreakdown.map((row) => ({
          label: row.section,
          events: row.pageViews,
          sessions: row.sessions,
        }))
      ),
      channelTrends: buildAudienceSegmentTrends(
        currentChannelBreakdown.map((row) => ({
          label: row.channel,
          events: row.events,
          sessions: row.sessions,
        })),
        previousChannelBreakdown.map((row) => ({
          label: row.channel,
          events: row.events,
          sessions: row.sessions,
        }))
      ),
      campaignTrends: buildAudienceSegmentTrends(
        currentCampaignBreakdown.map((row) => ({
          label: row.label,
          events: row.events,
          sessions: row.sessions,
        })),
        previousCampaignBreakdown.map((row) => ({
          label: row.label,
          events: row.events,
          sessions: row.sessions,
        })),
        8
      ),
      deviceConversionBreakdown: currentDeviceConversionBreakdown,
      channelConversionBreakdown: currentChannelConversionBreakdown,
      campaignConversionBreakdown: currentCampaignConversionBreakdown,
      sectionConversionBreakdown: currentSectionConversionBreakdown,
      deviceConversionTrends: buildAudienceConversionTrends(
        currentDeviceConversionBreakdown.map((row) => ({
          label: row.label,
          sessions: row.sessions,
          conversionSessions: row.conversionSessions,
          conversionRate: row.overallConversionRate,
        })),
        previousDeviceConversionBreakdown.map((row) => ({
          label: row.label,
          sessions: row.sessions,
          conversionSessions: row.conversionSessions,
          conversionRate: row.overallConversionRate,
        }))
      ),
      channelConversionTrends: buildAudienceConversionTrends(
        currentChannelConversionBreakdown.map((row) => ({
          label: row.label,
          sessions: row.sessions,
          conversionSessions: row.conversionSessions,
          conversionRate: row.overallConversionRate,
        })),
        previousChannelConversionBreakdown.map((row) => ({
          label: row.label,
          sessions: row.sessions,
          conversionSessions: row.conversionSessions,
          conversionRate: row.overallConversionRate,
        }))
      ),
      campaignConversionTrends: buildAudienceConversionTrends(
        currentCampaignConversionBreakdown.map((row) => ({
          label: row.label,
          sessions: row.sessions,
          conversionSessions: row.conversionSessions,
          conversionRate: row.overallConversionRate,
        })),
        previousCampaignConversionBreakdown.map((row) => ({
          label: row.label,
          sessions: row.sessions,
          conversionSessions: row.conversionSessions,
          conversionRate: row.overallConversionRate,
        })),
        8
      ),
      sectionConversionTrends: buildAudienceConversionTrends(
        currentSectionConversionBreakdown.map((row) => ({
          label: row.label,
          sessions: row.sessions,
          conversionSessions: row.conversionSessions,
          conversionRate: row.overallConversionRate,
        })),
        previousSectionConversionBreakdown.map((row) => ({
          label: row.label,
          sessions: row.sessions,
          conversionSessions: row.conversionSessions,
          conversionRate: row.overallConversionRate,
        }))
      ),
      campaignLandingLeaders: currentCampaignLandingLeaders,
      campaignLandingRisks: currentCampaignLandingRisks,
      pathConversionLeaders: currentPathConversionBreakdown,
      pathConversionLaggards: currentPathConversionLaggards,
      pathConversionTrends: buildAudienceConversionTrends(
        currentPathConversionBreakdown.map((row) => ({
          label: row.label,
          sessions: row.sessions,
          conversionSessions: row.conversionSessions,
          conversionRate: row.overallConversionRate,
        })),
        previousPathConversionBreakdown.map((row) => ({
          label: row.label,
          sessions: row.sessions,
          conversionSessions: row.conversionSessions,
          conversionRate: row.overallConversionRate,
        })),
        8
      ),
      pageTypeBreakdown: buildPageTypeBreakdown(currentEvents),
      eventBreakdown: buildEventBreakdown(currentEvents),
      conversion: currentConversion,
    },
    previous:
      previousMetrics && previousConversion
        ? { metrics: previousMetrics, conversion: previousConversion }
        : null,
    deltas: previousMetrics
      ? {
          events: currentMetrics.events - previousMetrics.events,
          pageViews: currentMetrics.pageViews - previousMetrics.pageViews,
          sessions: currentMetrics.sessions - previousMetrics.sessions,
          contactSuccesses:
            currentMetrics.contactSuccesses - previousMetrics.contactSuccesses,
          popupSuccesses: currentMetrics.popupSuccesses - previousMetrics.popupSuccesses,
        }
      : null,
  };
}
