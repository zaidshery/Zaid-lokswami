import { resolveNotificationCapability } from '@/lib/pwa/client';

export type PopupType = 'state' | 'notification' | 'personalization';
export type EngagementSurface = PopupType | 'epaper-alert' | 'install-app';
export type EngagementSurfaceLevel = 'medium' | 'high';

type PopupStorageState = {
  signinPromptShown: boolean;
  statePromptShown: boolean;
  notifPromptShown: boolean;
  personalizationShown: boolean;
  neverStatePrompt: boolean;
  neverNotifPrompt: boolean;
  neverPersonalizationPrompt: boolean;
  activePopup: PopupType | null;
  activeSurface: EngagementSurface | null;
  readCount: number;
  visitCount: number;
  hasVisitedEpaper: boolean;
  selectedState: string;
  preferredCategories: string[];
  lastTrackedPath: string;
  popupCooldownUntil: number;
  bannerCooldownUntil: number;
  lastHighPriorityShownAt: number;
  lastMediumPriorityShownAt: number;
  epaperAlertShownOn: string;
  epaperAlertDismissedOn: string;
};

export type PopupUserState = {
  isAuthenticated: boolean;
  notificationPermission:
    | NotificationPermission
    | 'unsupported'
    | 'requires-install';
};

const POPUP_STORAGE_KEY = 'lokswami_popup_manager_state_v1';
export const POPUP_STATE_CHANGE_EVENT = 'lokswami:popup-state-change';
const POPUP_COOLDOWN_MS = 20 * 60 * 1000;
const BANNER_COOLDOWN_MS = 12 * 60 * 1000;

const DEFAULT_POPUP_STATE: PopupStorageState = {
  signinPromptShown: false,
  statePromptShown: false,
  notifPromptShown: false,
  personalizationShown: false,
  neverStatePrompt: false,
  neverNotifPrompt: false,
  neverPersonalizationPrompt: false,
  activePopup: null,
  activeSurface: null,
  readCount: 0,
  visitCount: 0,
  hasVisitedEpaper: false,
  selectedState: '',
  preferredCategories: [],
  lastTrackedPath: '',
  popupCooldownUntil: 0,
  bannerCooldownUntil: 0,
  lastHighPriorityShownAt: 0,
  lastMediumPriorityShownAt: 0,
  epaperAlertShownOn: '',
  epaperAlertDismissedOn: '',
};

function canUseStorage() {
  return typeof window !== 'undefined';
}

function normalizeState(raw: unknown): PopupStorageState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_POPUP_STATE };
  }

  const value = raw as Partial<PopupStorageState>;
  const activePopup = normalizePopupType(value.activePopup);
  const activeSurface = normalizeEngagementSurface(value.activeSurface);

  return {
    signinPromptShown: Boolean(value.signinPromptShown),
    statePromptShown: Boolean(value.statePromptShown),
    notifPromptShown: Boolean(value.notifPromptShown),
    personalizationShown: Boolean(value.personalizationShown),
    neverStatePrompt: Boolean(value.neverStatePrompt),
    neverNotifPrompt: Boolean(value.neverNotifPrompt),
    neverPersonalizationPrompt: Boolean(value.neverPersonalizationPrompt),
    activePopup,
    activeSurface,
    readCount:
      typeof value.readCount === 'number' && Number.isFinite(value.readCount)
        ? Math.max(0, Math.floor(value.readCount))
        : 0,
    visitCount:
      typeof value.visitCount === 'number' && Number.isFinite(value.visitCount)
        ? Math.max(0, Math.floor(value.visitCount))
        : 0,
    hasVisitedEpaper: Boolean(value.hasVisitedEpaper),
    selectedState:
      typeof value.selectedState === 'string' ? value.selectedState.trim().slice(0, 80) : '',
    preferredCategories: Array.isArray(value.preferredCategories)
      ? value.preferredCategories
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim().slice(0, 40))
          .slice(0, 10)
      : [],
    lastTrackedPath:
      typeof value.lastTrackedPath === 'string' ? value.lastTrackedPath.slice(0, 200) : '',
    popupCooldownUntil:
      typeof value.popupCooldownUntil === 'number' &&
      Number.isFinite(value.popupCooldownUntil)
        ? Math.max(0, Math.floor(value.popupCooldownUntil))
        : 0,
    bannerCooldownUntil:
      typeof value.bannerCooldownUntil === 'number' &&
      Number.isFinite(value.bannerCooldownUntil)
        ? Math.max(0, Math.floor(value.bannerCooldownUntil))
        : 0,
    lastHighPriorityShownAt:
      typeof value.lastHighPriorityShownAt === 'number' &&
      Number.isFinite(value.lastHighPriorityShownAt)
        ? Math.max(0, Math.floor(value.lastHighPriorityShownAt))
        : 0,
    lastMediumPriorityShownAt:
      typeof value.lastMediumPriorityShownAt === 'number' &&
      Number.isFinite(value.lastMediumPriorityShownAt)
        ? Math.max(0, Math.floor(value.lastMediumPriorityShownAt))
        : 0,
    epaperAlertShownOn:
      typeof value.epaperAlertShownOn === 'string'
        ? value.epaperAlertShownOn.trim().slice(0, 32)
        : '',
    epaperAlertDismissedOn:
      typeof value.epaperAlertDismissedOn === 'string'
        ? value.epaperAlertDismissedOn.trim().slice(0, 32)
        : '',
  };
}

function normalizePopupType(value: unknown): PopupType | null {
  return value === 'state' || value === 'notification' || value === 'personalization'
    ? value
    : null;
}

function normalizeEngagementSurface(value: unknown): EngagementSurface | null {
  return value === 'epaper-alert' || value === 'install-app' || normalizePopupType(value)
    ? (value as EngagementSurface)
    : null;
}

function readPopupStateInternal(): PopupStorageState {
  if (!canUseStorage()) {
    return { ...DEFAULT_POPUP_STATE };
  }

  try {
    const raw = window.localStorage.getItem(POPUP_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_POPUP_STATE };
    }

    return normalizeState(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_POPUP_STATE };
  }
}

function savePopupStateInternal(next: PopupStorageState) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(POPUP_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent(POPUP_STATE_CHANGE_EVENT, {
        detail: next,
      })
    );
  } catch {
    // Ignore localStorage write failures.
  }
}

function updatePopupState(updater: (current: PopupStorageState) => PopupStorageState) {
  const current = readPopupStateInternal();
  const next = normalizeState(updater(current));
  savePopupStateInternal(next);
  return next;
}

export function readPopupState() {
  return readPopupStateInternal();
}

export function subscribePopupState(listener: (state: PopupStorageState) => void) {
  if (!canUseStorage()) {
    return () => {};
  }

  const handleCustomEvent = (event: Event) => {
    const next = (event as CustomEvent<PopupStorageState>).detail;
    listener(normalizeState(next));
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== POPUP_STORAGE_KEY) {
      return;
    }

    listener(readPopupStateInternal());
  };

  window.addEventListener(POPUP_STATE_CHANGE_EVENT, handleCustomEvent as EventListener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(
      POPUP_STATE_CHANGE_EVENT,
      handleCustomEvent as EventListener
    );
    window.removeEventListener('storage', handleStorage);
  };
}

export function registerPathVisit(pathname: string) {
  const normalizedPath = pathname.trim();
  if (!normalizedPath || !normalizedPath.startsWith('/')) {
    return readPopupStateInternal();
  }

  return updatePopupState((current) => {
    if (current.lastTrackedPath === normalizedPath) {
      return current;
    }

    const isArticleRead = normalizedPath.startsWith('/main/article/');
    const isEpaperVisit = normalizedPath.startsWith('/main/epaper');

    return {
      ...current,
      visitCount: current.visitCount + 1,
      readCount: isArticleRead ? current.readCount + 1 : current.readCount,
      hasVisitedEpaper: current.hasVisitedEpaper || isEpaperVisit,
      lastTrackedPath: normalizedPath,
    };
  });
}

export function markSigninPromptShown() {
  return updatePopupState((current) => ({
    ...current,
    signinPromptShown: true,
  }));
}

function markPromptShown(current: PopupStorageState, popup: PopupType) {
  if (popup === 'state') {
    return { ...current, statePromptShown: true };
  }

  if (popup === 'notification') {
    return { ...current, notifPromptShown: true };
  }

  return { ...current, personalizationShown: true };
}

function levelForSurface(surface: EngagementSurface): EngagementSurfaceLevel {
  return surface === 'epaper-alert' || surface === 'install-app' ? 'medium' : 'high';
}

function cooldownKeyForLevel(level: EngagementSurfaceLevel) {
  return level === 'high' ? 'popupCooldownUntil' : 'bannerCooldownUntil';
}

function setSurfaceCooldown(
  current: PopupStorageState,
  level: EngagementSurfaceLevel,
  now: number
) {
  const cooldownMs = level === 'high' ? POPUP_COOLDOWN_MS : BANNER_COOLDOWN_MS;
  const cooldownKey = cooldownKeyForLevel(level);

  return {
    ...current,
    [cooldownKey]: now + cooldownMs,
  };
}

function clearSurface(current: PopupStorageState, surface: EngagementSurface, now: number) {
  const base: PopupStorageState = {
    ...current,
    activeSurface: current.activeSurface === surface ? null : current.activeSurface,
  };

  return setSurfaceCooldown(base, levelForSurface(surface), now);
}

export function isEngagementSurfaceBlocked(
  level: EngagementSurfaceLevel,
  now = Date.now()
) {
  const state = readPopupStateInternal();

  if (state.activeSurface) {
    return true;
  }

  if (level === 'high') {
    return state.popupCooldownUntil > now || state.bannerCooldownUntil > now;
  }

  return state.popupCooldownUntil > now || state.bannerCooldownUntil > now;
}

export function canShowDailyEpaperAlert(dateKey: string, now = Date.now()) {
  const state = readPopupStateInternal();

  if (!dateKey.trim()) {
    return false;
  }

  if (state.epaperAlertShownOn === dateKey || state.epaperAlertDismissedOn === dateKey) {
    return false;
  }

  if (state.activeSurface && state.activeSurface !== 'epaper-alert') {
    return false;
  }

  return !isEngagementSurfaceBlocked('medium', now);
}

export function canShowInstallPrompt(now = Date.now()) {
  const state = readPopupStateInternal();

  if (state.activeSurface && state.activeSurface !== 'install-app') {
    return false;
  }

  return !isEngagementSurfaceBlocked('medium', now);
}

export function markDailyEpaperAlertShown(dateKey: string, now = Date.now()) {
  return updatePopupState((current) => ({
    ...current,
    activeSurface: 'epaper-alert',
    epaperAlertShownOn: dateKey.trim().slice(0, 32),
    lastMediumPriorityShownAt: now,
  }));
}

export function dismissDailyEpaperAlert(dateKey: string, now = Date.now()) {
  return updatePopupState((current) => ({
    ...clearSurface(current, 'epaper-alert', now),
    epaperAlertDismissedOn: dateKey.trim().slice(0, 32),
  }));
}

export function markInstallPromptShown(now = Date.now()) {
  return updatePopupState((current) => ({
    ...current,
    activeSurface: 'install-app',
    lastMediumPriorityShownAt: now,
  }));
}

export function dismissInstallPrompt(now = Date.now()) {
  return updatePopupState((current) => clearSurface(current, 'install-app', now));
}

export function activatePopup(popup: PopupType) {
  const now = Date.now();
  return updatePopupState((current) => {
    const withShown = markPromptShown(current, popup);
    return {
      ...withShown,
      activePopup: popup,
      activeSurface: popup,
      lastHighPriorityShownAt: now,
    };
  });
}

export function dismissPopup(popup: PopupType) {
  const now = Date.now();
  return updatePopupState((current) => {
    if (current.activePopup !== popup) {
      return current;
    }

    return clearSurface(
      {
        ...current,
        activePopup: null,
      },
      popup,
      now
    );
  });
}

export function clearActiveSurface(surface: EngagementSurface, now = Date.now()) {
  return updatePopupState((current) => {
    if (current.activeSurface !== surface) {
      return current;
    }

    return clearSurface(current, surface, now);
  });
}

export function releaseActiveSurface(surface: EngagementSurface) {
  return updatePopupState((current) => {
    if (current.activeSurface !== surface) {
      return current;
    }

    return {
      ...current,
      activeSurface: null,
      activePopup: normalizePopupType(surface) ? null : current.activePopup,
    };
  });
}

export function neverShowPopupAgain(popup: PopupType) {
  const now = Date.now();
  return updatePopupState((current) => {
    const base = clearSurface(
      {
        ...current,
        activePopup: current.activePopup === popup ? null : current.activePopup,
      },
      popup,
      now
    );

    if (popup === 'state') {
      return { ...base, neverStatePrompt: true, statePromptShown: true };
    }

    if (popup === 'notification') {
      return { ...base, neverNotifPrompt: true, notifPromptShown: true };
    }

    return {
      ...base,
      neverPersonalizationPrompt: true,
      personalizationShown: true,
    };
  });
}

export function saveSelectedState(value: string) {
  const now = Date.now();
  return updatePopupState((current) => ({
    ...clearSurface(current, 'state', now),
    selectedState: value.trim().slice(0, 80),
    activePopup: current.activePopup === 'state' ? null : current.activePopup,
  }));
}

export function savePreferredCategories(values: string[]) {
  const normalized = values
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 40))
    .slice(0, 10);

  const now = Date.now();

  return updatePopupState((current) => ({
    ...clearSurface(current, 'personalization', now),
    preferredCategories: normalized,
    activePopup:
      current.activePopup === 'personalization' ? null : current.activePopup,
  }));
}

export function resolveNotificationPermission() {
  return resolveNotificationCapability().state;
}

/**
 * Decides the next popup in priority order and guarantees one active popup at once.
 */
export function getNextPopup(userState: PopupUserState): PopupType | null {
  const state = readPopupStateInternal();
  const now = Date.now();

  if (state.activePopup) {
    return state.activePopup;
  }

  if (state.activeSurface || isEngagementSurfaceBlocked('high', now)) {
    return null;
  }

  const shouldShowStatePrompt =
    !state.selectedState &&
    !state.neverStatePrompt &&
    !state.statePromptShown &&
    (state.readCount >= 2 || state.visitCount >= 2);

  if (shouldShowStatePrompt) {
    return 'state';
  }

  const notificationHandled =
    userState.notificationPermission === 'granted' ||
    userState.notificationPermission === 'denied' ||
    userState.notificationPermission === 'unsupported';

  const shouldShowNotificationPrompt =
    !notificationHandled &&
    !state.neverNotifPrompt &&
    (state.readCount >= 4 || (state.hasVisitedEpaper && state.visitCount >= 2));

  if (shouldShowNotificationPrompt) {
    return 'notification';
  }

  const shouldShowPersonalizationPrompt =
    userState.isAuthenticated &&
    !state.neverPersonalizationPrompt &&
    !state.personalizationShown &&
    state.preferredCategories.length === 0 &&
    state.readCount >= 5;

  if (shouldShowPersonalizationPrompt) {
    return 'personalization';
  }

  return null;
}

