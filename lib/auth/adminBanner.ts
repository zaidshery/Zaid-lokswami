export const ADMIN_SIGNIN_BANNER_KEY = 'showAdminBanner';

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function armAdminSigninBanner() {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(ADMIN_SIGNIN_BANNER_KEY, '1');
}

export function dismissAdminSigninBanner() {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.removeItem(ADMIN_SIGNIN_BANNER_KEY);
}

export function shouldShowAdminSigninBanner() {
  if (!canUseSessionStorage()) {
    return false;
  }

  return window.sessionStorage.getItem(ADMIN_SIGNIN_BANNER_KEY) === '1';
}
