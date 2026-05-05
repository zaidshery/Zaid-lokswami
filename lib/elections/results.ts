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

export type ElectionResultsData = {
  mode: ElectionMode;
  homepageEnabled: boolean;
  title: string;
  badgeLabel: string;
  sourceLabel: string;
  lastUpdated: string | null;
  states: Record<string, ElectionStateResult>;
};

export const DEFAULT_ELECTION_RESULTS: ElectionResultsData = {
  mode: 'final',
  homepageEnabled: true,
  title: 'Election Results 2026',
  badgeLabel: 'FINAL',
  sourceLabel: 'ECI',
  lastUpdated: null,
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
