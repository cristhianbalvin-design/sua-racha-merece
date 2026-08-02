export const AUTH_REDIRECT_STORAGE_KEY = 'authRedirectTo';

type RedirectState = {
  redirectTo?: unknown;
};

type RedirectStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const normalizeInternalRedirect = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  return value;
};

export const buildAuthRedirect = (pathname: string, search = ''): string =>
  `${pathname}${search}`;

export const getAuthRedirectFromState = (state: unknown): string | null =>
  normalizeInternalRedirect((state as RedirectState | null)?.redirectTo);

export const persistAuthRedirect = (
  redirectTo: string,
  storage: RedirectStorage = sessionStorage,
): void => {
  const normalized = normalizeInternalRedirect(redirectTo);
  if (normalized) storage.setItem(AUTH_REDIRECT_STORAGE_KEY, normalized);
};

export const consumeAuthRedirect = (
  storage: RedirectStorage = sessionStorage,
): string | null => {
  const redirectTo = normalizeInternalRedirect(storage.getItem(AUTH_REDIRECT_STORAGE_KEY));
  storage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
  return redirectTo;
};

export const clearAuthRedirect = (
  storage: RedirectStorage = sessionStorage,
): void => {
  storage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
};
