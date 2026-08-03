export const ELECTION_STATES = [
  { id: 'wb', name: 'West Bengal', totalSeats: 294 },
  { id: 'kerala', name: 'Kerala', totalSeats: 140 },
  { id: 'tn', name: 'Tamil Nadu', totalSeats: 234 },
  { id: 'assam', name: 'Assam', totalSeats: 126 },
  { id: 'puducherry', name: 'Puducherry', totalSeats: 30 },
] as const;

export const ELECTION_MODES = ['live', 'final', 'hidden'] as const;

export type ElectionMode = (typeof ELECTION_MODES)[number];
export type ElectionStateId = (typeof ELECTION_STATES)[number]['id'];

export type ElectionParty = {
  name: string;
  color: string;
  won: number;
  leading: number;
};

export type ElectionStateResult = {
  name: string;
  totalSeats: number;
  parties: ElectionParty[];
};

export const FEATURED_ELECTION_STATUSES = ['scheduled', 'live', 'final'] as const;
export type FeaturedElectionStatus = (typeof FEATURED_ELECTION_STATUSES)[number];

export type FeaturedElectionCandidate = {
  id: string;
  name: string;
  party: string;
  color: string;
  votes: number | null;
  statusLabel: string;
  voteNote: string;
  photoUrl: string;
  symbolUrl: string;
};

export type FeaturedElectionContest = {
  enabled: boolean;
  status: FeaturedElectionStatus;
  liveLabelHi: string;
  backgroundImageUrl: string;
  eyebrow: string;
  title: string;
  summary: string;
  constituencyNumber: string;
  constituencyName: string;
  stateName: string;
  electionType: string;
  pollDate: string;
  countingDate: string;
  countingStartTime: string;
  turnoutPercent: number;
  votesCast: number;
  totalElectors: number;
  candidateCount: number;
  roundsCompleted: number;
  totalRounds: number;
  leadMargin: number;
  leaderCandidateId: string;
  lastVerifiedLabel: string;
  sourceLabel: string;
  sourceUrl: string;
  verificationNote: string;
  candidates: FeaturedElectionCandidate[];
  whyElection: string;
  previousResult: string;
  candidateContext: string;
  politicalImportance: string;
  controversy: string;
  bottomLine: string;
};

export type ElectionResultsData = {
  mode: ElectionMode;
  homepageEnabled: boolean;
  title: string;
  badgeLabel: string;
  sourceLabel: string;
  lastUpdated: string | null;
  featuredContest: FeaturedElectionContest;
  states: Record<string, ElectionStateResult>;
};

export const DEFAULT_FEATURED_ELECTION: FeaturedElectionContest = {
  enabled: true,
  status: 'live',
  liveLabelHi: '\u0932\u093e\u0907\u0935',
  backgroundImageUrl: '',
  eyebrow: 'Datia Assembly by-election',
  title: 'Datia bypoll: Congress ahead as counting continues',
  summary:
    'After six of 15 scheduled rounds, Congress candidate Ghanshyam Singh was leading BJP candidate Ashutosh Tiwari. This is a counting trend, not the final result.',
  constituencyNumber: '22',
  constituencyName: 'Datia',
  stateName: 'Madhya Pradesh',
  electionType: 'Assembly by-election',
  pollDate: '30 July 2026',
  countingDate: '3 August 2026',
  countingStartTime: '8:00 AM IST',
  turnoutPercent: 71.44,
  votesCast: 157473,
  totalElectors: 220410,
  candidateCount: 21,
  roundsCompleted: 6,
  totalRounds: 15,
  leadMargin: 1786,
  leaderCandidateId: 'ghanshyam-singh',
  lastVerifiedLabel: 'Around 12:45 PM IST on 3 August 2026',
  sourceLabel: 'ECI, Datia district administration and newsroom-verified counting reports',
  sourceUrl: 'https://results.eci.gov.in/',
  verificationNote:
    'Counting figures can change after every round. The Returning Officer\'s final declaration and Form 20 remain authoritative.',
  candidates: [
    {
      id: 'ghanshyam-singh',
      name: 'Ghanshyam Singh',
      party: 'Indian National Congress',
      color: '#16A34A',
      votes: null,
      statusLabel: 'Leading',
      voteNote: 'Overall lead reported after round 6',
      photoUrl: '',
      symbolUrl: '',
    },
    {
      id: 'ashutosh-tiwari',
      name: 'Ashutosh Tiwari',
      party: 'Bharatiya Janata Party',
      color: '#F97316',
      votes: null,
      statusLabel: 'Main challenger',
      voteNote: 'Trailing the leader by 1,786 votes after round 6',
      photoUrl: '',
      symbolUrl: '',
    },
    {
      id: 'damodar-yadav',
      name: 'Damodar Yadav',
      party: 'Azad Samaj Party (Kanshi Ram)',
      color: '#2563EB',
      votes: 4874,
      statusLabel: 'Third position',
      voteNote: 'Vote total reported after round 3',
      photoUrl: '',
      symbolUrl: '',
    },
  ],
  whyElection:
    'The by-election was required after Congress MLA Rajendra Bharti lost his Assembly membership following a Delhi court sentence of three years in a cheating and forgery case in April 2026.',
  previousResult:
    'In the 2023 Assembly election, Rajendra Bharti defeated former Madhya Pradesh home minister Narottam Mishra by more than 7,500 votes.',
  candidateContext:
    'Congress fielded veteran former MLA Ghanshyam Singh. BJP selected organisation leader Ashutosh Tiwari instead of Narottam Mishra. Damodar Yadav of the Azad Samaj Party emerged as the major third candidate in a 21-candidate field.',
  politicalImportance:
    'For Congress, the contest tests whether it can defend the seat captured from BJP in 2023. For BJP, it tests the decision to field Ashutosh Tiwari and is being watched as an organisational test for the state leadership.',
  controversy:
    'Congress workers raised EVM-security concerns after two men were reportedly seen with laptops near the strong room. The district administration said the machines and security arrangements had not been compromised.',
  bottomLine:
    'Congress held the advantage in the six-round snapshot, but nine scheduled rounds potentially remained. No winner had been officially declared at the time of this update.',
};

export const DEFAULT_ELECTION_RESULTS: ElectionResultsData = {
  mode: 'final',
  homepageEnabled: true,
  title: 'Election Results 2026',
  badgeLabel: 'FINAL',
  sourceLabel: 'ECI',
  lastUpdated: null,
  featuredContest: DEFAULT_FEATURED_ELECTION,
  states: Object.fromEntries(
    ELECTION_STATES.map((state) => [
      state.id,
      {
        name: state.name,
        totalSeats: state.totalSeats,
        parties: [],
      },
    ])
  ),
};

function cloneDefaultResults() {
  return JSON.parse(JSON.stringify(DEFAULT_ELECTION_RESULTS)) as ElectionResultsData;
}

function parseMode(value: unknown): ElectionMode {
  return ELECTION_MODES.includes(value as ElectionMode) ? (value as ElectionMode) : 'final';
}

function toNonNegativeInt(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function normalizeParty(value: unknown): ElectionParty | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const name = String(source.name || '').trim();
  if (!name) return null;

  return {
    name,
    color: String(source.color || '#6B7280').trim() || '#6B7280',
    won: toNonNegativeInt(source.won),
    leading: toNonNegativeInt(source.leading),
  };
}

function toOptionalNonNegativeInt(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  return toNonNegativeInt(value);
}

function text(value: unknown, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function httpUrl(value: unknown, fallback = '') {
  const candidate = typeof value === 'string' ? value.trim() : fallback;
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function imageUrl(value: unknown, fallback = '') {
  const candidate = typeof value === 'string' ? value.trim() : fallback;
  if (
    candidate.startsWith('/') &&
    !candidate.startsWith('//') &&
    /^\/[A-Za-z0-9._/-]+$/.test(candidate) &&
    !candidate.includes('..')
  ) return candidate;
  return httpUrl(candidate);
}

function normalizeFeaturedCandidate(value: unknown, index: number): FeaturedElectionCandidate | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const name = text(source.name);
  if (!name) return null;
  return {
    id: text(source.id, `candidate-${index + 1}`),
    name,
    party: text(source.party, 'Independent'),
    color: text(source.color, '#6B7280'),
    votes: toOptionalNonNegativeInt(source.votes),
    statusLabel: text(source.statusLabel),
    voteNote: text(source.voteNote),
    photoUrl: imageUrl(source.photoUrl),
    symbolUrl: imageUrl(source.symbolUrl),
  };
}

function normalizeFeaturedContest(value: unknown): FeaturedElectionContest {
  const defaults = JSON.parse(JSON.stringify(DEFAULT_FEATURED_ELECTION)) as FeaturedElectionContest;
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const status = FEATURED_ELECTION_STATUSES.includes(source.status as FeaturedElectionStatus)
    ? (source.status as FeaturedElectionStatus)
    : defaults.status;
  const candidates = Array.isArray(source.candidates)
    ? source.candidates
        .map(normalizeFeaturedCandidate)
        .filter((candidate): candidate is FeaturedElectionCandidate => Boolean(candidate))
    : defaults.candidates;
  const totalRounds = Math.max(1, toNonNegativeInt(source.totalRounds) || defaults.totalRounds);

  return {
    ...defaults,
    enabled: source.enabled !== false,
    status,
    liveLabelHi: text(source.liveLabelHi, defaults.liveLabelHi),
    backgroundImageUrl: imageUrl(source.backgroundImageUrl),
    eyebrow: text(source.eyebrow, defaults.eyebrow),
    title: text(source.title, defaults.title),
    summary: text(source.summary, defaults.summary),
    constituencyNumber: text(source.constituencyNumber, defaults.constituencyNumber),
    constituencyName: text(source.constituencyName, defaults.constituencyName),
    stateName: text(source.stateName, defaults.stateName),
    electionType: text(source.electionType, defaults.electionType),
    pollDate: text(source.pollDate, defaults.pollDate),
    countingDate: text(source.countingDate, defaults.countingDate),
    countingStartTime: text(source.countingStartTime, defaults.countingStartTime),
    turnoutPercent: Math.min(100, Math.max(0, Number(source.turnoutPercent ?? defaults.turnoutPercent) || 0)),
    votesCast: toNonNegativeInt(source.votesCast ?? defaults.votesCast),
    totalElectors: toNonNegativeInt(source.totalElectors ?? defaults.totalElectors),
    candidateCount: toNonNegativeInt(source.candidateCount ?? defaults.candidateCount),
    roundsCompleted: Math.min(totalRounds, toNonNegativeInt(source.roundsCompleted ?? defaults.roundsCompleted)),
    totalRounds,
    leadMargin: toNonNegativeInt(source.leadMargin ?? defaults.leadMargin),
    leaderCandidateId: text(source.leaderCandidateId, candidates[0]?.id || ''),
    lastVerifiedLabel: text(source.lastVerifiedLabel, defaults.lastVerifiedLabel),
    sourceLabel: text(source.sourceLabel, defaults.sourceLabel),
    sourceUrl: httpUrl(source.sourceUrl, defaults.sourceUrl),
    verificationNote: text(source.verificationNote, defaults.verificationNote),
    candidates,
    whyElection: text(source.whyElection, defaults.whyElection),
    previousResult: text(source.previousResult, defaults.previousResult),
    candidateContext: text(source.candidateContext, defaults.candidateContext),
    politicalImportance: text(source.politicalImportance, defaults.politicalImportance),
    controversy: text(source.controversy, defaults.controversy),
    bottomLine: text(source.bottomLine, defaults.bottomLine),
  };
}

export function normalizeElectionResultsData(input: unknown): ElectionResultsData {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const statesSource =
    source.states && typeof source.states === 'object'
      ? (source.states as Record<string, unknown>)
      : {};
  const defaults = cloneDefaultResults();

  const states = Object.fromEntries(
    ELECTION_STATES.map((state) => {
      const rawState =
        statesSource[state.id] && typeof statesSource[state.id] === 'object'
          ? (statesSource[state.id] as Record<string, unknown>)
          : {};
      const parties = Array.isArray(rawState.parties)
        ? rawState.parties.map(normalizeParty).filter((party): party is ElectionParty => Boolean(party))
        : [];

      return [
        state.id,
        {
          name: String(rawState.name || state.name).trim() || state.name,
          totalSeats: toNonNegativeInt(rawState.totalSeats) || state.totalSeats,
          parties,
        },
      ];
    })
  );

  return {
    ...defaults,
    mode: parseMode(source.mode),
    homepageEnabled: source.homepageEnabled !== false,
    title: String(source.title || defaults.title).trim() || defaults.title,
    badgeLabel: String(source.badgeLabel || '').trim() || (parseMode(source.mode) === 'live' ? 'LIVE' : 'FINAL'),
    sourceLabel: String(source.sourceLabel || defaults.sourceLabel).trim() || defaults.sourceLabel,
    lastUpdated:
      typeof source.lastUpdated === 'string' && source.lastUpdated.trim()
        ? source.lastUpdated
        : null,
    featuredContest: normalizeFeaturedContest(source.featuredContest),
    states,
  };
}

export function finalizeElectionResults(input: ElectionResultsData): ElectionResultsData {
  const data = normalizeElectionResultsData(input);
  const states = Object.fromEntries(
    Object.entries(data.states).map(([stateId, state]) => [
      stateId,
      {
        ...state,
        parties: state.parties.map((party) => ({
          ...party,
          won: party.won + party.leading,
          leading: 0,
        })),
      },
    ])
  );

  return {
    ...data,
    mode: 'final',
    badgeLabel: 'FINAL',
    states,
  };
}
